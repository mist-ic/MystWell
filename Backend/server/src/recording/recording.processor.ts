import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { RECORDING_PROCESSING_QUEUE } from './constants';
import { SpeechToTextService } from './speech-to-text.service';
import { GeminiAnalysisService, StructuredRecordingDetails } from './gemini-analysis.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.constants';
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
    this.logger.log(`Processing job ${job.id} for recording: ${job.data.recordingId}`);
    const { recordingId, profileId, storagePath, userId } = job.data;

    // Helper function to update recording status/error
    const updateRecording = async (data: { status?: string; raw_transcript?: string | null; structured_details?: StructuredRecordingDetails | null; error?: string | null }) => {
        const { data: updateData, error: updateError } = await this.supabaseAdmin
            .from('recordings') // Use the correct table name
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', recordingId)
            .select(); // Optional: select to confirm update

        if (updateError) {
            this.logger.error(`[Job ${job.id}] Failed to update recording ${recordingId} status:`, updateError.message);
            // Decide if this should halt processing or just be logged
        }
        return { updateData, updateError };
    };

    try {
      // Set initial processing status
      await updateRecording({ status: 'processing' });

      // 1. Get Signed URL for the audio file from Supabase Storage
      this.logger.log(`[Job ${job.id}] Creating signed URL for path: ${storagePath}`);
      const { data: signedUrlData, error: urlError } = await this.supabaseAdmin
        .storage
        .from('recordings') // Ensure this bucket name is correct
        .createSignedUrl(storagePath, 60 * 5); // Signed URL valid for 5 minutes

      if (urlError) {
        this.logger.error(`[Job ${job.id}] Error creating signed URL for ${storagePath}:`, urlError.message);
        await this.recordingService.updateRecordingStatus(userId, recordingId, 'failed', urlError.message);
        throw new Error(`Failed to get signed URL: ${urlError.message}`);
      }

      if (!signedUrlData || !signedUrlData.signedUrl) {
          this.logger.error(`[Job ${job.id}] Failed to create signed URL for ${storagePath}. Received null or invalid data.`);
          await this.recordingService.updateRecordingStatus(userId, recordingId, 'failed', 'Received null or invalid data creating signed URL');
          throw new Error('Failed to create signed URL.');
      }

      const signedUrl = signedUrlData.signedUrl;

      // 2. Download the audio file using the signed URL
      this.logger.log(`[Job ${job.id}] Downloading audio from signed URL...`); // Removed URL logging for security
      
      let audioBytes: Buffer;
      try {
          const response: AxiosResponse<ArrayBuffer> = await firstValueFrom(
            this.httpService.get<ArrayBuffer>(signedUrl, { responseType: 'arraybuffer' }),
          );
          audioBytes = Buffer.from(response.data);
          this.logger.log(`[Job ${job.id}] Downloaded ${audioBytes.length} bytes.`);
      } catch (downloadError) {
          this.logger.error(`[Job ${job.id}] Failed to download audio:`, downloadError.message);
          await updateRecording({ status: 'download_failed', error: 'Failed to download audio file' });
          throw downloadError; // Rethrow to mark job as failed
      }

      // --- Step 1: Transcription (using downloaded bytes) ---
      this.logger.log(`[Job ${job.id}] Starting transcription using downloaded audio bytes...`);
      // Pass the downloaded buffer to the service
      const rawTranscript = await this.speechToTextService.transcribeAudio(audioBytes);

      if (rawTranscript === null) {
        this.logger.warn(`[Job ${job.id}] Transcription failed or returned null.`);
        await updateRecording({ status: 'transcription_failed', error: 'Transcription failed or empty' });
        return; // Stop processing this job
      }

      this.logger.log(`[Job ${job.id}] Transcription successful. Length: ${rawTranscript.length}. Updating DB...`);
      // Update status and save transcript
      await updateRecording({
        raw_transcript: rawTranscript,
        status: 'transcribing_completed',
        error: null, // Clear previous error if any
      });

      // --- Step 2: Gemini Analysis ---
      this.logger.log(`[Job ${job.id}] Starting Gemini analysis...`);
      const structuredDetails = await this.geminiAnalysisService.extractDetailsFromTranscript(rawTranscript);
      // const structuredDetails = { info: `Placeholder analysis for ${recordingId}` }; // Placeholder

      if (!structuredDetails) {
        this.logger.warn(`[Job ${job.id}] Gemini analysis failed or returned empty.`);
        await updateRecording({ status: 'analysis_failed', error: 'Analysis failed or empty' });
        return; // Stop processing this job
      }

      this.logger.log(`[Job ${job.id}] Gemini analysis successful. Updating DB...`);
      // Update status and save structured details
      await updateRecording({
        structured_details: structuredDetails,
        status: 'completed',
        error: null, // Clear error on success
      });

      this.logger.log(`[Job ${job.id}] Successfully processed recording ${recordingId}.`);

    } catch (error) {
      this.logger.error(`[Job ${job.id}] Error processing recording ${recordingId}:`, error.stack);
      // Update recording status to 'processing_failed' or a more specific error status
      const finalErrorStatus = error.message.includes('download') ? 'download_failed' : 'processing_failed';
      try {
        await this.recordingService.updateRecordingStatus(userId, recordingId, finalErrorStatus, error.message || 'Unknown processing error');
      } catch (dbError) {
        this.logger.error(`[Job ${job.id}] Failed to update recording status to failed after main error:`, dbError.stack);
      }
      // Rethrow the error so BullMQ knows the job failed
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