import { Injectable, Inject, NotFoundException, InternalServerErrorException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT, SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { v4 as uuidv4 } from 'uuid';
import { ProfileService } from '../profile/profile.service';
import { Profile } from '../profile/profile.service';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RECORDING_PROCESSING_QUEUE } from './constants';

// Match this interface with your actual DB schema + RLS results
export interface Recording {
  id: string;
  profile_id: string;
  title: string;
  duration: number;
  created_at: string;
  updated_at: string;
  transcription?: string;
  summary?: string;
  storage_path: string;
  status: string;
  error?: string;
  metadata?: any;
  raw_transcript?: string;
  structured_details?: any;
}

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);
  private readonly BUCKET_NAME = 'recordings';
  // Flag to determine whether to use service role client or regular client
  // This can be set to false after fixing the RLS policies
  private readonly useServiceRoleForRecordings: boolean;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseServiceRole: SupabaseClient,
    @InjectQueue(RECORDING_PROCESSING_QUEUE) private recordingQueue: Queue,
    private readonly profileService: ProfileService,
    private readonly configService: ConfigService,
  ) {
    // Read from environment variable, default to true (safer)
    this.useServiceRoleForRecordings = this.configService.get<string>('USE_SERVICE_ROLE_FOR_RECORDINGS') !== 'false';
    this.logger.log(`[RecordingService] Using service role for recordings: ${this.useServiceRoleForRecordings}`);
  }

  // Helper to get profileId from userId, throwing Unauthorized if not found
  private async getProfileIdFromUserId(userId: string): Promise<string> {
      // this.logger.log(`[RecordingService] Getting profile ID for user ID: ${userId}`);
      const profile = await this.profileService.getProfileByUserId(userId);
      
      if (!profile) {
          // If profile doesn't exist for a validated Supabase user, treat as Unauthorized
          this.logger.error(`[RecordingService] No profile found for validated user ID: ${userId}`);
          throw new UnauthorizedException('User profile not found or inaccessible.');
      }
      
      // this.logger.log(`[RecordingService] Profile found: ID=${profile.id}, UserId=${profile.user_id}, Email=${profile.email || 'N/A'}`);
      return profile.id;
  }

  /**
   * DEBUG METHOD: Check if any recordings exist in the database
   * This is temporary and should be removed after debugging
   */
  async debugCheckRecordings(): Promise<void> {
    this.logger.log('[RecordingService] DEBUG: Checking if any recordings exist in the database');
    
    // Use service role to bypass all policies
    const { data, error } = await this.supabaseServiceRole
      .from('recordings')
      .select('id, profile_id, title')
      .limit(10);
      
    if (error) {
      this.logger.error('[RecordingService] DEBUG: Error fetching any recordings:', error.message);
    } else {
      this.logger.log(`[RecordingService] DEBUG: Found ${data?.length || 0} total recordings in database`);
      if (data && data.length > 0) {
        this.logger.log('[RecordingService] DEBUG: Sample recordings:', JSON.stringify(data.slice(0, 3)));
      }
    }
  }

  /**
   * DEBUG METHOD: Test calling get_my_profile_id() using the standard client
   * TODO: Remove this after debugging
   */
  async debugTestGetMyProfileId(userId: string): Promise<void> {
    this.logger.log(`[RecordingService] DEBUG: Testing get_my_profile_id() for user ${userId} using STANDARD client`);
    // We need the standard client instance, which is this.supabase injected via SUPABASE_CLIENT
    // This client should be automatically configured with the user's JWT by the time
    // it reaches the service if the AuthGuard and SupabaseModule are set up correctly.
    try {
      // IMPORTANT: Ensure the standard client (this.supabase) is correctly configured
      // in your SupabaseModule to inherit the user's auth context.
      const { data, error } = await this.supabase.rpc('get_my_profile_id'); 

      if (error) {
        this.logger.error('[RecordingService] DEBUG: Error calling get_my_profile_id() via RPC:', error.message);
      } else {
        this.logger.log('[RecordingService] DEBUG: Result from get_my_profile_id() via RPC:', data);
      }
    } catch (e: any) {
       this.logger.error('[RecordingService] DEBUG: Exception calling get_my_profile_id() via RPC:', e.message);
    }
  }

  /**
   * Fetches recordings for the authenticated user.
   * Uses either the standard client (with proper RLS) or the service role client 
   * based on configuration.
   * 
   * NOTE: Once the RLS policies are fixed, set USE_SERVICE_ROLE_FOR_RECORDINGS=false
   * in your .env file to use the standard client with RLS.
   */
  async getRecordings(userId: string): Promise<Recording[]> {
    // Remove or comment out the previous debug call
    // await this.debugTestGetMyProfileId(userId);

    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] Fetching recordings for profile: ${profileId}`);

    // this.logger.log(`[RecordingService] Using SERVICE ROLE client for fetching recordings (Fallback)`);
    const client = this.supabaseServiceRole; 

    try {
      const { data, error } = await client
        .from('recordings')
        .select('*')
        .eq('profile_id', profileId) 
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logger.error(`[RecordingService] Error fetching recordings for profile ${profileId} (Service Role):`, error.message);
        throw new InternalServerErrorException(`Failed to fetch recordings: ${error.message}`);
      }

      this.logger.log(`[RecordingService] Found ${data?.length || 0} recordings for profile ${profileId} (Service Role)`);
      // this.logger.log(`[RecordingService] Returning data sample (first 3):`, JSON.stringify(data?.slice(0, 3))); // Remove sample logging
      return data || [];

    } catch (catchError: any) {
      this.logger.error(`[RecordingService] Catch block error during getRecordings (Service Role):`, catchError.message);
      // Re-throw as an appropriate NestJS exception
      if (catchError instanceof InternalServerErrorException || catchError instanceof UnauthorizedException || catchError instanceof ForbiddenException) {
        throw catchError;
      }
      throw new InternalServerErrorException(`An unexpected error occurred while fetching recordings: ${catchError.message}`);
    }
  }

  /**
   * Fetches a specific recording by its ID for the authenticated user.
   * Uses the service role client but verifies ownership.
   */
  async getRecordingById(userId: string, recordingId: string): Promise<Recording> {
    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] Fetching recording ID: ${recordingId} for profile: ${profileId}`);

    // Use service role client but enforce profile_id match
    const { data, error } = await this.supabaseServiceRole
      .from('recordings')
      .select('*') // Select all columns for the detail view
      .eq('id', recordingId)
      .eq('profile_id', profileId)
      .maybeSingle(); // Use maybeSingle to handle not found gracefully

    if (error) {
      this.logger.error(`[RecordingService] Error fetching recording ${recordingId} for profile ${profileId}:`, error.message);
      // Avoid leaking detailed SQL errors
      throw new InternalServerErrorException('Failed to fetch recording details.'); 
    }

    if (!data) {
      this.logger.warn(`[RecordingService] Recording ${recordingId} not found for profile ${profileId}.`);
      throw new NotFoundException(`Recording with ID ${recordingId} not found or access denied.`);
    }

    this.logger.log(`[RecordingService] Found recording ${recordingId}. Status: ${data.status}`);
    return data as Recording;
  }

  /**
   * Creates metadata and generates a signed URL for upload for the authenticated user.
   */
  async getUploadUrl(userId: string, title: string, duration: number): Promise<{ uploadUrl: string; storagePath: string; recordingId: string }> {
    const profileId = await this.getProfileIdFromUserId(userId);
    const recordingId = uuidv4();
    const storagePath = `${profileId}/${recordingId}.m4a`;

    this.logger.log(`[RecordingService] Generating upload URL for path: ${storagePath}`);

    const recordingMetadata = await this.createRecordingMetadata(profileId, title, duration, storagePath, recordingId);

    // Use service role client for storage operations
    const { data: urlData, error: urlError } = await this.supabaseServiceRole.storage
      .from(this.BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (urlError) {
      this.logger.error('[RecordingService] Error generating signed upload URL:', urlError.message);
      try {
        // Use internal method, no need to re-fetch profileId
        await this.updateRecordingStatusInternal(recordingMetadata.id, 'failed', 'Failed to generate upload URL'); 
      } catch (updateError) {
        this.logger.error('[RecordingService] Failed to update status after URL generation error:', updateError);
      }
      throw new InternalServerErrorException(`Failed to generate upload URL: ${urlError.message}`);
    }

    return { 
      uploadUrl: urlData.signedUrl, 
      storagePath, 
      recordingId: recordingMetadata.id 
    };
  }

  /**
   * Creates the initial metadata record in the 'recordings' table.
   * Uses service role client to bypass RLS.
   */
  private async createRecordingMetadata(profileId: string, title: string, duration: number, storagePath: string, recordingId: string): Promise<Recording> {
    // this.logger.log(`[RecordingService] Creating metadata for recording: ${recordingId}`);
    // Use the service role client to bypass RLS
    const { data, error } = await this.supabaseServiceRole
      .from('recordings')
      .insert({
        id: recordingId,
        profile_id: profileId,
        title: title || `Recording ${new Date().toISOString()}`, // Default title
        duration, // Expect duration in seconds from frontend
        storage_path: storagePath,
        status: 'pending_upload', // More specific initial status
      })
      .select()
      .single();

    if (error) {
      this.logger.error('[RecordingService] Error creating recording metadata:', error.message);
      throw new InternalServerErrorException(`Failed to create recording metadata: ${error.message}`);
    }
    return data as Recording;
  }

  /**
   * Updates the status of a recording. If status indicates successful upload,
   * queues the recording for background processing (transcription, analysis).
   */
  async updateRecordingStatus(userId: string, recordingId: string, status: string, errorMsg?: string, duration?: number): Promise<Recording> {
    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] User ${userId} (Profile ${profileId}) requesting status update for recording ${recordingId} to ${status}${duration ? ` with duration ${duration}s` : ''}`);

    // Constants for statuses
    const STATUS_UPLOAD_COMPLETED = 'uploaded'; // <--- Changed to match frontend log
    const STATUS_QUEUED = 'queued';
    const STATUS_FAILED = 'failed';

    // Verify recording ownership and get storage path (needed for queuing)
    const { data: recordingData, error: fetchError } = await this.supabaseServiceRole
      .from('recordings')
      .select('id, storage_path, profile_id') // Fetch storage_path
      .eq('id', recordingId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (fetchError || !recordingData) {
      this.logger.error(`[RecordingService] Error verifying/fetching recording ownership: ${fetchError?.message || 'Recording not found'}`);
      throw new ForbiddenException('Access denied or recording not found for status update.');
    }

    // If the status indicates successful upload, queue it for processing
    // Also update duration here if provided
    if (status === STATUS_UPLOAD_COMPLETED) {
        // Update status and potentially duration before queueing
        // (Queue job uses the updated record if needed)
        const updatedRecord = await this.updateRecordingStatusInternal(recordingId, status, errorMsg, duration);
        
        // Check storage path *after* potentially updating duration
        if (!updatedRecord.storage_path) {
             this.logger.error(`[RecordingService] Recording ${recordingId} is missing storage_path, cannot queue for processing.`);
             // Update status back to failed directly
             return this.updateRecordingStatusInternal(recordingId, STATUS_FAILED, 'Internal error: Missing storage path');
        }
        
        this.logger.log(`[RecordingService] Queuing recording ${recordingId} for processing.`); // Keep queue log
        try {
          await this.recordingQueue.add('process-recording', {
            recordingId: recordingId,
            profileId: profileId,
            storagePath: updatedRecord.storage_path, 
            userId: userId, 
          });
          // Update status to 'queued' after successfully adding to queue
          return this.updateRecordingStatusInternal(recordingId, STATUS_QUEUED); 
        } catch (queueError) {
          this.logger.error(`[RecordingService] Failed to add recording ${recordingId} to queue:`, queueError);
          // Update status to failed if queuing fails
          return this.updateRecordingStatusInternal(recordingId, STATUS_FAILED, 'Failed to queue for processing');
        }
    } else {
      // For any other status update (e.g., upload failed from frontend), update directly
      // this.logger.log(`[RecordingService] Updating status directly for recording ${recordingId} to ${status}`);
      return this.updateRecordingStatusInternal(recordingId, status, errorMsg, duration); // Pass duration here too
    }
  }

  /**
   * Updates the status and optionally duration of a recording. Assumes the user has access via the controller/guard.
   * Uses service role client to bypass RLS.
   */
  private async updateRecordingStatusInternal(recordingId: string, status: string, errorMsg?: string, duration?: number): Promise<Recording> {
      // this.logger.log(`[RecordingService] Updating status internally for recording ${recordingId} to ${status}${duration ? ` with duration ${duration}s` : ''}`);
      const updateData: Partial<Recording> & { updated_at: string } = {
         status,
         updated_at: new Date().toISOString()
      };
      if (errorMsg) {
        updateData.error = errorMsg;
      }
      // Add duration to update if provided and is a valid number
      if (duration !== undefined && !isNaN(duration)) { 
          updateData.duration = duration;
      }
  
      // Use service role client to bypass RLS
      const { data, error } = await this.supabaseServiceRole
        .from('recordings')
        .update(updateData)
        .eq('id', recordingId)
        .select()
        .single();
      
      if (error) {
        this.logger.error(`[RecordingService] Error updating internal status for recording ${recordingId}:`, error.message); // Keep error log
        if (error.code === 'PGRST204') { 
            throw new NotFoundException(`Recording with ID ${recordingId} not found or access denied (internal update).`);
        }
        throw new InternalServerErrorException(`Failed to update internal recording status: ${error.message}`);
      }
      if (!data) {
          throw new NotFoundException(`Recording with ID ${recordingId} not found after internal update attempt.`);
      }
      return data as Recording;
  }

  /**
   * Generates a signed URL for playback for the authenticated user.
   */
  async getPlaybackUrl(userId: string, recordingId: string): Promise<{ playbackUrl: string }> {
    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] User ${userId} (Profile ${profileId}) requesting playback URL for recording: ${recordingId}`);

    // Use service role to verify ownership
    const { data: recordingData, error: fetchError } = await this.supabaseServiceRole
      .from('recordings')
      .select('id, storage_path, profile_id') 
      .eq('id', recordingId)
      .single();

    if (fetchError || !recordingData) {
      this.logger.error(`[RecordingService] Error fetching recording ${recordingId} for playback URL:`, fetchError?.message);
      throw new NotFoundException(`Recording with ID ${recordingId} not found.`);
    }

    if (recordingData.profile_id !== profileId) {
       this.logger.warn(`[RecordingService] Profile mismatch for playback URL: Requesting Profile ${profileId}, Recording Profile ${recordingData.profile_id}`);
       throw new ForbiddenException('Access denied to this recording.');
    }

    const storagePath = recordingData.storage_path;
    if (!storagePath) {
        throw new InternalServerErrorException('Recording storage path is missing.');
    }

    // Use service role client for storage operations
    const { data: urlData, error: urlError } = await this.supabaseServiceRole.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(storagePath, 60 * 10); // Expires in 10 minutes

    if (urlError) {
      this.logger.error('[RecordingService] Error generating signed playback URL:', urlError.message);
      throw new InternalServerErrorException(`Failed to generate playback URL: ${urlError.message}`);
    }

    return { 
      playbackUrl: urlData.signedUrl
    };
  }

  /**
   * Deletes a recording for the authenticated user.
   */
  async deleteRecording(userId: string, recordingId: string): Promise<void> {
    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] User ${userId} (Profile ${profileId}) attempting to delete recording: ${recordingId}`);

    // Use service role to verify ownership
    const { data: recordingData, error: fetchError } = await this.supabaseServiceRole
      .from('recordings')
      .select('id, storage_path, profile_id')
      .eq('id', recordingId)
      .single();

    if (fetchError || !recordingData) {
      if (fetchError && fetchError.code !== 'PGRST116') { 
         throw new InternalServerErrorException(`Failed to fetch recording for deletion: ${fetchError.message}`);
      }
      if (!recordingData) { 
           this.logger.log(`[RecordingService] Recording ${recordingId} not found for deletion, assuming already deleted.`);
           return; 
      }
    }    
    
    if (recordingData.profile_id !== profileId) {
       this.logger.warn(`[RecordingService] Profile mismatch for deletion: Requesting Profile ${profileId}, Recording Profile ${recordingData.profile_id}`);
       throw new ForbiddenException('Access denied to delete this recording.');
    }

    if (recordingData.storage_path) {
        // this.logger.log(`[RecordingService] Deleting file from storage: ${recordingData.storage_path}`);
        // Use service role client for storage operations
        const { error: storageError } = await this.supabaseServiceRole.storage
            .from(this.BUCKET_NAME)
            .remove([recordingData.storage_path]);
        if (storageError) {
            this.logger.error(`[RecordingService] Error deleting file ${recordingData.storage_path} from storage: ${storageError.message}. Proceeding with DB deletion.`); // Keep error
        }
    } else {
        this.logger.warn(`[RecordingService] Recording ${recordingId} has no storage path defined, skipping storage deletion.`); // Keep warning
    }

    // Use service role client to delete the recording record
    const { error: deleteError } = await this.supabaseServiceRole
        .from('recordings')
        .delete()
        .eq('id', recordingId);
    
    if (deleteError) {
        this.logger.error(`[RecordingService] Error deleting recording ${recordingId} from database:`, deleteError.message); // Keep error
        throw new InternalServerErrorException(`Failed to delete recording metadata: ${deleteError.message}`);
    }

    this.logger.log(`[RecordingService] Successfully deleted recording ${recordingId}`); // Keep success log
  }

  /**
   * Updates the title of a recording.
   */
  async updateRecordingTitle(userId: string, recordingId: string, newTitle: string): Promise<Recording> {
    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] User ${userId} (Profile ${profileId}) updating title for recording: ${recordingId}`);

    // Verify recording ownership with service role client
    const { data: checkData, error: checkError } = await this.supabaseServiceRole
      .from('recordings')
      .select('id')
      .eq('id', recordingId)
      .eq('profile_id', profileId)
      .maybeSingle();
    
    if (checkError || !checkData) {
      this.logger.error(`[RecordingService] Error verifying recording ownership: ${checkError?.message || 'Recording not found'}`);
      throw new ForbiddenException('Access denied or recording not found for title update.');
    }

    // Use service role client to update the title
    const { data, error } = await this.supabaseServiceRole
      .from('recordings')
      .update({
        title: newTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId)
      .select()
      .single();

    if (error) {
      this.logger.error(`[RecordingService] Error updating title for recording ${recordingId}:`, error.message); // Keep error
      throw new InternalServerErrorException(`Failed to update recording title: ${error.message}`);
    }

    this.logger.log(`[RecordingService] Successfully updated title for recording ${recordingId}`); // Keep success log
    return data as Recording;
  }

  /**
   * Retry transcription for a recording that previously failed
   */
  async retryTranscription(userId: string, recordingId: string): Promise<Recording> {
    const profileId = await this.getProfileIdFromUserId(userId);
    this.logger.log(`[RecordingService] User ${userId} (Profile ${profileId}) requesting transcription retry for recording ${recordingId}`);

    // Verify recording ownership and get storage path (needed for queuing)
    const { data: recordingData, error: fetchError } = await this.supabaseServiceRole
      .from('recordings')
      .select('id, storage_path, profile_id, status') 
      .eq('id', recordingId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (fetchError || !recordingData) {
      this.logger.error(`[RecordingService] Error verifying/fetching recording for retry: ${fetchError?.message || 'Recording not found'}`);
      throw new ForbiddenException('Access denied or recording not found for transcription retry.');
    }

    if (!recordingData.storage_path) {
      this.logger.error(`[RecordingService] Recording ${recordingId} is missing storage_path, cannot retry processing.`);
      return this.updateRecordingStatusInternal(recordingId, 'failed', 'Internal error: Missing storage path');
    }

    // Update status to 'queued' before adding to queue
    await this.updateRecordingStatusInternal(recordingId, 'queued', undefined);
    
    try {
      await this.recordingQueue.add('process-recording', {
        recordingId: recordingId,
        profileId: profileId,
        storagePath: recordingData.storage_path,
        userId: userId,
      });
      
      this.logger.log(`[RecordingService] Successfully queued recording ${recordingId} for transcription retry.`);
      return this.getRecordingById(userId, recordingId); // Return fresh data
    } catch (queueError) {
      this.logger.error(`[RecordingService] Failed to queue recording ${recordingId} for transcription retry:`, queueError);
      return this.updateRecordingStatusInternal(recordingId, 'failed', 'Failed to queue for transcription retry');
    }
  }
} 