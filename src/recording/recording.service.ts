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
  private readonly accessibleProfilesCache = new Map<string, Set<string>>();
  private readonly recordingsCache = new Map<string, { data: Recording[]; timestamp: number }>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly recordingsCacheTTL = 30 * 1000; // 30 seconds for recordings

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseServiceRole: SupabaseClient,
    @InjectQueue(RECORDING_PROCESSING_QUEUE) private recordingQueue: Queue,
    private readonly profileService: ProfileService,
    private readonly configService: ConfigService,
  ) {}

  // Helper to get profileId from userId, throwing Unauthorized if not found
  private async getProfileIdFromUserId(userId: string): Promise<string> {
      const profile = await this.profileService.getProfileByUserId(userId);
      
      if (!profile) {
          throw new UnauthorizedException('User profile not found or inaccessible.');
      }
      
      return profile.id;
  }

  // Get all profiles accessible to this user (their own profile + managed profiles)
  private async getAccessibleProfileIds(userId: string): Promise<Set<string>> {
    const cacheKey = `user_${userId}`;
    
    // Check cache first
    if (this.accessibleProfilesCache.has(cacheKey)) {
      return this.accessibleProfilesCache.get(cacheKey) as Set<string>;
    }
    
    // Get user's profile
    const userProfileId = await this.getProfileIdFromUserId(userId);
    const accessibleProfiles = new Set<string>([userProfileId]);
    
    // Get managed profiles if any (family links)
    try {
      const { data, error } = await this.supabaseServiceRole
        .from('family_links')
        .select('managed_profile_id')
        .eq('guardian_profile_id', userProfileId);
        
      if (!error && data) {
        data.forEach(link => {
          accessibleProfiles.add(link.managed_profile_id);
        });
      }
      
      // Cache the result with expiration
      this.accessibleProfilesCache.set(cacheKey, accessibleProfiles);
      setTimeout(() => {
        this.accessibleProfilesCache.delete(cacheKey);
      }, this.cacheTTL);
      
      return accessibleProfiles;
    } catch (err) {
      this.logger.error(`Failed to get managed profiles for ${userProfileId}:`, err);
      return accessibleProfiles; // Return just the user's profile if there's an error
    }
  }

  /**
   * Verify if the user has access to the specified profile
   */
  private async verifyProfileAccess(userId: string, profileIdToAccess: string): Promise<boolean> {
    const accessibleProfiles = await this.getAccessibleProfileIds(userId);
    return accessibleProfiles.has(profileIdToAccess);
  }

  /**
   * Verify if the user has access to a recording
   */
  private async verifyRecordingAccess(userId: string, recordingId: string): Promise<Recording> {
    // Get the recording first
    const { data, error } = await this.supabaseServiceRole
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .maybeSingle();
      
    if (error) {
      throw new InternalServerErrorException('Failed to fetch recording details.');
    }
    
    if (!data) {
      throw new NotFoundException(`Recording with ID ${recordingId} not found.`);
    }
    
    // Now verify if the user has access to this recording's profile
    const hasAccess = await this.verifyProfileAccess(userId, data.profile_id);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this recording.');
    }
    
    return data as Recording;
  }

  // Helper to generate cache key
  private getCacheKey(userId: string, type: string): string {
    return `${type}_${userId}`;
  }

  /**
   * Fetches recordings for the authenticated user.
   */
  async getRecordings(userId: string): Promise<Recording[]> {
    const cacheKey = this.getCacheKey(userId, 'recordings');
    
    // Check cache first
    const cachedData = this.recordingsCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp < this.recordingsCacheTTL)) {
      return cachedData.data;
    }
    
    const accessibleProfiles = await this.getAccessibleProfileIds(userId);
    const profileIdsArray = Array.from(accessibleProfiles);

    try {
      // Only select fields we need to optimize query performance
      const { data, error } = await this.supabaseServiceRole
        .from('recordings')
        .select('id, profile_id, title, duration, created_at, updated_at, status, error, storage_path')
        .in('profile_id', profileIdsArray)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new InternalServerErrorException(`Failed to fetch recordings: ${error.message}`);
      }

      // Cache the result with expiration
      this.recordingsCache.set(cacheKey, { 
        data: data || [],
        timestamp: Date.now()
      });
      
      return data || [];
    } catch (catchError: any) {
      if (catchError instanceof InternalServerErrorException || 
          catchError instanceof UnauthorizedException || 
          catchError instanceof ForbiddenException) {
        throw catchError;
      }
      throw new InternalServerErrorException(`An unexpected error occurred while fetching recordings.`);
    }
  }

  /**
   * Fetches a specific recording by its ID for the authenticated user.
   */
  async getRecordingById(userId: string, recordingId: string): Promise<Recording> {
    return this.verifyRecordingAccess(userId, recordingId);
  }

  /**
   * Invalidate the recordings cache for a user.
   * Call this whenever a recording is created, updated, or deleted.
   */
  private invalidateRecordingsCache(userId: string): void {
    const cacheKey = this.getCacheKey(userId, 'recordings');
    this.recordingsCache.delete(cacheKey);
  }

  /**
   * Creates metadata and generates a signed URL for upload for the authenticated user.
   */
  async getUploadUrl(userId: string): Promise<{ uploadUrl: string; storagePath: string; recordingId: string }> {
    try {
      const profileId = await this.getProfileIdFromUserId(userId);
      const recordingId = uuidv4();
      // Use .mp4 extension which is compatible with both Android and iOS recordings
      const storagePath = `${profileId}/${recordingId}.mp4`;
  
      // Provide default title and 0 duration when creating metadata
      const defaultTitle = `Recording - ${new Date().toLocaleString()}`;
      const recordingMetadata = await this.createRecordingMetadata(profileId, defaultTitle, 0, storagePath, recordingId);
  
      // Create the signed URL for upload
      const { data, error } = await this.supabaseServiceRole.storage
        .from(this.BUCKET_NAME)
        .createSignedUploadUrl(storagePath);
  
      if (error) {
        throw new InternalServerErrorException(`Failed to create upload URL: ${error.message}`);
      }
  
      // Invalidate cache when a new recording is created
      this.invalidateRecordingsCache(userId);
  
      return {
        uploadUrl: data.signedUrl,
        storagePath,
        recordingId,
      };
    } catch (error) {
      this.logger.error(`Error in getUploadUrl: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates the initial metadata record in the 'recordings' table.
   * Uses service role client to bypass RLS.
   */
  private async createRecordingMetadata(profileId: string, title: string, duration: number, storagePath: string, recordingId: string): Promise<Recording> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.supabaseServiceRole
      .from('recordings')
      .insert({
        id: recordingId,
        profile_id: profileId,
        title: title,
        duration: duration,
        storage_path: storagePath,
        status: 'pending_upload',
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Failed to create recording metadata`);
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
          }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 10000,
            },
            removeOnComplete: true,
            removeOnFail: 1000
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
   * Internal helper to update recording status without access checks
   * Used by worker processes and other internal methods
   */
  private async updateRecordingStatusInternal(
    recordingId: string, 
    status: string, 
    errorMsg?: string, 
    duration?: number
  ): Promise<Recording> {
    // Build update object
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };
    
    // Add optional fields if provided
    if (errorMsg !== undefined) {
      updateData.error = errorMsg;
    }
    
    if (duration !== undefined && duration > 0) {
      updateData.duration = duration;
    }
    
    try {
      // Execute update
      const { data, error } = await this.supabaseServiceRole
        .from('recordings')
        .update(updateData)
        .eq('id', recordingId)
        .select()
        .single();
      
      if (error) {
        this.logger.error(`Failed to update recording ${recordingId} status to ${status}: ${error.message}`, error);
        throw new InternalServerErrorException(`Failed to update recording status: ${error.message}`);
      }
      
      if (!data) {
        this.logger.error(`No data returned when updating recording ${recordingId} status to ${status}`);
        throw new NotFoundException(`Recording with ID ${recordingId} not found during status update`);
      }
      
      return data as Recording;
    } catch (error) {
      if (error instanceof InternalServerErrorException || 
          error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Unexpected error updating recording ${recordingId} status: ${error.message}`, error);
      throw new InternalServerErrorException(`An unexpected error occurred while updating recording status`);
    }
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
   * Updates the title of a recording.
   */
  async updateRecordingTitle(userId: string, recordingId: string, newTitle: string): Promise<Recording> {
    // Verify access first
    await this.verifyRecordingAccess(userId, recordingId);
    
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
      throw new InternalServerErrorException(`Failed to update recording title`);
    }

    // Invalidate cache when a recording is updated
    this.invalidateRecordingsCache(userId);
    
    return data as Recording;
  }

  /**
   * Delete a recording and its associated storage file.
   */
  async deleteRecording(userId: string, recordingId: string): Promise<void> {
    // Verify access first and get the recording details
    const recording = await this.verifyRecordingAccess(userId, recordingId);
    
    // Delete from storage if storage_path exists
    if (recording.storage_path) {
      try {
        const { error: storageError } = await this.supabaseServiceRole
          .storage
          .from(this.BUCKET_NAME)
          .remove([recording.storage_path]);
          
        if (storageError) {
          this.logger.warn(`Error removing recording file from storage: ${storageError.message}`);
          // Continue with database deletion even if storage deletion fails
        }
      } catch (storageDeleteError) {
        this.logger.warn(`Exception during storage deletion: ${storageDeleteError}`);
        // Continue with database deletion
      }
    } else {
      this.logger.warn(`Recording ${recordingId} has no storage path defined, skipping storage deletion.`);
    }

    // Use service role client to delete the recording record
    const { error: deleteError } = await this.supabaseServiceRole
      .from('recordings')
      .delete()
      .eq('id', recordingId);
    
    if (deleteError) {
      throw new InternalServerErrorException(`Failed to delete recording`);
    }
    
    // Invalidate cache when a recording is deleted
    this.invalidateRecordingsCache(userId);
  }

  /**
   * Retry transcription for a recording that previously failed
   */
  async retryTranscription(userId: string, recordingId: string): Promise<Recording> {
    // Verify access first and get the recording details
    const recording = await this.verifyRecordingAccess(userId, recordingId);
    
    if (!recording.storage_path) {
      return this.updateRecordingStatusInternal(recordingId, 'failed', 'Internal error: Missing storage path');
    }

    // Update status to 'queued' before adding to queue
    await this.updateRecordingStatusInternal(recordingId, 'queued');
    
    try {
      const profileId = await this.getProfileIdFromUserId(userId);
      
      await this.recordingQueue.add('process-recording', {
        recordingId: recordingId,
        profileId: profileId,
        storagePath: recording.storage_path,
        userId: userId,
      }, {
        // Add job options for better reliability
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
      });
      
      // Invalidate cache when a recording status changes
      this.invalidateRecordingsCache(userId);
      
      return this.getRecordingById(userId, recordingId); // Return fresh data
    } catch (queueError) {
      return this.updateRecordingStatusInternal(recordingId, 'failed', 'Failed to queue for transcription retry');
    }
  }
} 