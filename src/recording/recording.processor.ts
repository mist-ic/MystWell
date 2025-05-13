import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { RECORDING_PROCESSING_QUEUE } from './constants';
import { SpeechToTextService } from './speech-to-text.service';
import { GeminiAnalysisService } from './gemini-analysis.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { RecordingService } from './recording.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Buffer } from 'buffer';
import { AxiosError, AxiosResponse } from 'axios';
import { AudioProcessorService } from './audio-processor.service';
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
    private readonly audioProcessorService: AudioProcessorService,
    // private readonly prisma: PrismaService, // Inject DB service
  ) {
    super(); // Important: Call super() in constructor
  }

  async process(job: Job<RecordingJobData>): Promise<void> {
    const { recordingId, profileId, storagePath, userId } = job.data;
    this.logger.log(`Processing recording ${recordingId} for profile ${profileId}`);

    try {
      // Set initial processing status
      await this.recordingService.updateRecordingStatus(userId, recordingId, 'processing');

      // Check if FFmpeg is available
      if (!this.audioProcessorService.isFFmpegAvailable()) {
        const errorMsg = 'FFmpeg is not installed or configured on the server. Audio processing cannot proceed.';
        this.logger.error(errorMsg);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'processing_failed', 
          errorMsg
        );
        
        // This is a permanent failure, not a transient one
        throw new Error(errorMsg);
      }

      // 1. Get Signed URL for the audio file from Supabase Storage
      const { data: signedUrlData, error: urlError } = await this.supabaseAdmin
        .storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(storagePath, 60 * 10); // Signed URL valid for 10 minutes (increased from 5)

      if (urlError || !signedUrlData?.signedUrl) {
        const errorMsg = urlError ? urlError.message : 'Failed to create signed URL';
        this.logger.error(`Failed to get signed URL for recording ${recordingId}: ${errorMsg}`);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'failed', 
          errorMsg
        );
        
        // Return without throwing to mark as complete but failed
        return;
      }

      // 2. Download the audio file using the signed URL
      let audioBytes: Buffer;
      try {
        const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
          this.httpService.get<ArrayBuffer>(signedUrlData.signedUrl, { 
            responseType: 'arraybuffer',
            timeout: 60000, // 60 second timeout (increased from 30)
            maxContentLength: 150 * 1024 * 1024, // 150MB max size (increased from 100MB)
          }),
        );
        audioBytes = Buffer.from(response.data);
        this.logger.log(`Downloaded ${audioBytes.length} bytes for recording ${recordingId}`);
      } catch (downloadError) {
        // More specific error handling for download failures
        let errorMessage = 'Failed to download audio file';
        
        if (downloadError instanceof AxiosError) {
          if (downloadError.code === 'ECONNABORTED') {
            errorMessage = 'Download timeout';
          } else if (downloadError.response) {
            errorMessage = `Download failed with status ${downloadError.response.status}`;
          }
        }
        
        this.logger.error(`Failed to download recording ${recordingId}: ${errorMessage}`, downloadError);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'download_failed', 
          errorMessage
        );
        
        // For network errors, throw to allow retries
        if (downloadError instanceof AxiosError && 
            (downloadError.code === 'ECONNRESET' || 
             downloadError.code === 'ETIMEDOUT' || 
             downloadError.code === 'ECONNABORTED')) {
          throw downloadError;
        }
        
        // Otherwise return without throwing to mark as complete but failed
        return;
      }

      // 3. Detect format and convert to WAV if needed
      let inputFormat: string;
      let processedAudioBytes: Buffer;
      
      try {
        inputFormat = await this.audioProcessorService.detectFormat(audioBytes);
        this.logger.log(`Detected input format: ${inputFormat}`);
        
        processedAudioBytes = await this.audioProcessorService.convertToWav(audioBytes, inputFormat);
        this.logger.log(`Converted audio to WAV format, size: ${processedAudioBytes.length} bytes`);
      } catch (processingError) {
        this.logger.error(`Audio processing failed for recording ${recordingId}: ${processingError.message}`);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'processing_failed', 
          `Audio processing failed: ${processingError.message}`
        );
        throw processingError;
      }

      // 4. Transcribe the processed audio
      const rawTranscript = await this.speechToTextService.transcribeAudio(
        processedAudioBytes,
        profileId
      );

      if (!rawTranscript) {
        this.logger.error(`Transcription failed or returned empty for recording ${recordingId}`);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'transcription_failed', 
          'Transcription failed or returned empty'
        );
        return;
      }

      // Update status and save transcript
      await this.recordingService.updateRecordingStatus(
        userId,
        recordingId,
        'transcribing_completed'
      );
      
      this.logger.log(`Transcription completed for recording ${recordingId}`);
      
      // Also update the raw_transcript field directly
      const { error: transcriptUpdateError } = await this.supabaseAdmin
        .from('recordings')
        .update({
          raw_transcript: rawTranscript,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
        
      if (transcriptUpdateError) {
        this.logger.error(`Failed to save transcript for recording ${recordingId}: ${transcriptUpdateError.message}`);
        // Continue processing but log the error
      }

      // 5. Analyze with Gemini
      const structuredDetails = await this.geminiAnalysisService.extractDetailsFromTranscript(
        rawTranscript,
        profileId
      );

      if (!structuredDetails) {
        this.logger.error(`Analysis failed or returned empty for recording ${recordingId}`);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'analysis_failed', 
          'Analysis failed or returned empty'
        );
        return;
      }

      // Update status and save structured details
      const { error: finalUpdateError } = await this.supabaseAdmin
        .from('recordings')
        .update({
          structured_details: structuredDetails,
          status: 'completed',
          error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
        
      if (finalUpdateError) {
        this.logger.error(`Failed to save final analysis for recording ${recordingId}: ${finalUpdateError.message}`);
        await this.recordingService.updateRecordingStatus(
          userId, 
          recordingId, 
          'save_failed', 
          'Failed to save analysis results'
        );
        return;
      }
      
      this.logger.log(`Successfully completed processing recording ${recordingId}`);
    } catch (error) {
      this.logger.error(`Processing error for recording ${recordingId}:`, error);
      
      const errorPhase = error.message.includes('transcribe') 
        ? 'transcription_failed' 
        : error.message.includes('analysis')
        ? 'analysis_failed'
        : error.message.includes('FFmpeg')
        ? 'processing_failed'
        : 'failed';
        
      await this.recordingService.updateRecordingStatus(
        userId,
        recordingId,
        errorPhase,
        error.message
      );
      
      // Re-throw for job handling
      throw error;
    }
  }

  // Optional: Listen for events like completion or failure
  onCompleted(job: Job<RecordingJobData>) {
    const { recordingId } = job.data;
    this.logger.log(`Job for recording ${recordingId} completed successfully after ${job.attemptsMade + 1} attempts.`);
  }

  onFailed(job: Job<RecordingJobData>, error: Error) {
    const { recordingId } = job.data;
    this.logger.error(
      `Job for recording ${recordingId} failed after ${job.attemptsMade + 1} attempts with error: ${error.message}`, 
      error.stack
    );
  }
} 