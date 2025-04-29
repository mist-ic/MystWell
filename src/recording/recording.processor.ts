import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { RECORDING_PROCESSING_QUEUE } from './constants';
import { SpeechToTextService } from './speech-to-text.service';
import { GeminiAnalysisService, StructuredRecordingDetails } from './gemini-analysis.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { RecordingService } from './recording.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Buffer } from 'buffer';
import { AxiosResponse } from 'axios';
// import { PrismaService } from '../prisma/prisma.service'; // Assuming Prisma or similar for DB interaction

// Define the structure of the job data we expect
interface RecordingJobData {
  recordingId: string; // ID of the recording record in the DB
  profileId: string;
  storagePath: string; // Path to the audio file in Supabase storage
  userId: string; // Add the user ID
}

@Processor(RECORDING_PROCESSING_QUEUE)
export class RecordingProcessor extends WorkerHost {
  private readonly logger = new Logger(RecordingProcessor.name);
  private readonly BUCKET_NAME = 'recordings';

  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private supabaseAdmin: SupabaseClient,
    private readonly recordingService: RecordingService,
    private readonly httpService: HttpService,
    private readonly speechToTextService: SpeechToTextService,
    private readonly geminiAnalysisService: GeminiAnalysisService,
    // private readonly prisma: PrismaService, // Inject DB service
  ) {
    super(); // Important: Call super() in constructor
  }

  async process(job: Job<RecordingJobData>): Promise<void> {
    const { recordingId, profileId, storagePath, userId } = job.data;

    try {
      // Set initial processing status
      await this.recordingService.updateRecordingStatus(userId, recordingId, 'processing');

      // 1. Get Signed URL for the audio file from Supabase Storage
      const { data: signedUrlData, error: urlError } = await this.supabaseAdmin
        .storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(storagePath, 60 * 5); // Signed URL valid for 5 minutes

      if (urlError || !signedUrlData?.signedUrl) {
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'failed', 
          urlError ? urlError.message : 'Failed to create signed URL'
        );
        throw new Error('Failed to get signed URL');
      }

      // 2. Download the audio file using the signed URL
      let audioBytes: Buffer;
      try {
        const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
          this.httpService.get<ArrayBuffer>(signedUrlData.signedUrl, { 
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
            maxContentLength: 100 * 1024 * 1024, // 100MB max size
          }),
        );
        audioBytes = Buffer.from(response.data);
      } catch (downloadError) {
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'download_failed', 
          'Failed to download audio file'
        );
        throw downloadError;
      }

      // 3. Transcribe the audio
      const rawTranscript = await this.speechToTextService.transcribeAudio(
          audioBytes,
          profileId
      );

      if (!rawTranscript) {
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'transcription_failed', 
          'Transcription failed or empty'
        );
        return;
      }

      // Update status and save transcript
      await this.recordingService.updateRecordingStatus(
        userId,
        recordingId,
        'transcribing_completed',
        undefined,
      );
      
      // Also update the raw_transcript field directly
      await this.supabaseAdmin
        .from('recordings')
        .update({
          raw_transcript: rawTranscript,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);

      // 4. Analyze with Gemini
      const structuredDetails = await this.geminiAnalysisService.extractDetailsFromTranscript(
          rawTranscript,
          profileId
      );

      if (!structuredDetails) {
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'analysis_failed', 
          'Analysis failed or empty'
        );
        return;
      }

      // Update status and save structured details
      await this.supabaseAdmin
        .from('recordings')
        .update({
          structured_details: structuredDetails,
          status: 'completed',
          error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);

    } catch (error) {
      this.logger.error(`Error processing recording ${recordingId}: ${error.message}`);
      
      const finalErrorStatus = error.message.includes('download') 
        ? 'download_failed' 
        : 'processing_failed';
        
      try {
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          finalErrorStatus, 
          error.message || 'Unknown processing error'
        );
      } catch (dbError) {
        this.logger.error(`Failed to update recording status after error: ${dbError.message}`);
      }
      
      throw error;
    }
  }

  // Optional: Listen for events like completion or failure
  onCompleted(job: Job, result: any) {
    // this.logger.log(`Job ${job.id} completed successfully.`);
  }

  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`, error.stack);
    // You might add more sophisticated error reporting here
  }
} 