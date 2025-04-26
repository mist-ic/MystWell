import { Injectable, Inject, NotFoundException, ForbiddenException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_REQUEST_CLIENT } from './document.module'; // Import the request-scoped token
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from './constants';
import { RenameDocumentDto } from './dto/rename-document.dto';

// Define an interface for the expected document structure (optional but good practice)
export interface Document {
  id: string;
  profile_id: string;
  storage_path: string;
  display_name: string | null;
  status: string;
  detected_document_type: string | null;
  structured_data: any | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly BUCKET_NAME = 'mystwell-user-data'; // Or get from config

  constructor(
    @Inject(SUPABASE_REQUEST_CLIENT) private readonly supabase: SupabaseClient,
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE) private readonly documentQueue: Queue,
  ) {}

  private async getProfileIdForUser(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error) {
      this.logger.error(`Error fetching profile for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Could not retrieve user profile.');
    }
    if (!data) {
      throw new NotFoundException('User profile not found.');
    }
    return data.id;
  }

  async getUploadDetails(userId: string): Promise<{ uploadUrl: string; documentId: string; storagePath: string }> {
    const profileId = await this.getProfileIdForUser(userId);
    const documentId = uuidv4();
    // Store in a folder structure: public/{profile_id}/documents/{document_id}.{ext}
    // We don't know the extension yet, but Supabase upload handles it.
    // Let's store the base path without extension initially.
    const storagePath = `${profileId}/documents/${documentId}`;

    this.logger.log(`Creating initial record for document ${documentId} for profile ${profileId}`);

    // Create initial DB record
    const { error: insertError } = await this.supabase
      .from('documents')
      .insert({
        id: documentId,
        profile_id: profileId,
        storage_path: storagePath, // Store base path
        status: 'pending_upload',
        display_name: 'Untitled Document', // Default display name
      });

    if (insertError) {
      this.logger.error(`Failed to create document record: ${insertError.message}`);
      throw new InternalServerErrorException('Could not initiate document upload.');
    }

    // Generate signed URL for upload (expires in 5 minutes)
    const { data, error: urlError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (urlError) {
      this.logger.error(`Failed to create signed upload URL: ${urlError.message}`);
      // Consider cleaning up the DB record here if URL generation fails critically
      throw new InternalServerErrorException('Could not generate upload link.');
    }

    // Supabase signed upload URL returns path & token, construct the full URL
    const uploadUrl = data.signedUrl;

    return { uploadUrl, documentId, storagePath };
  }

  async completeUpload(userId: string, documentId: string, storagePath: string): Promise<Document> {
    const profileId = await this.getProfileIdForUser(userId);
    const document = await this.getDocumentById(profileId, documentId, true); // Verify ownership internally

    if (document.status !== 'pending_upload') {
        this.logger.warn(`Document ${documentId} already processed or in unexpected state: ${document.status}`);
        // Decide how to handle this - return current state or throw error?
        // For idempotency, perhaps just return current state.
        // return document;
        throw new ForbiddenException('Document upload already completed or in progress.');
    }

    // Add job to the queue
    this.logger.log(`Queueing job for document ${documentId}`);
    try {
      await this.documentQueue.add('process-document', {
        storagePath: document.storage_path, // Use the stored path
        documentId,
        profileId,
      });
    } catch (queueError) {
      this.logger.error(`Failed to add job to queue for document ${documentId}: ${queueError.message}`);
      throw new InternalServerErrorException('Failed to queue document for processing.');
    }

    // Update status to queued
    const { data: updatedDoc, error: updateError } = await this.supabase
      .from('documents')
      .update({ status: 'queued', updated_at: new Date() })
      .eq('id', documentId)
      .eq('profile_id', profileId) // Ensure RLS/ownership again
      .select()
      .single();

    if (updateError) {
      this.logger.error(`Failed to update document ${documentId} status to queued: ${updateError.message}`);
      // Job is queued, but status update failed. Log inconsistency.
      // Return the document state *before* the failed update, or throw?
      throw new InternalServerErrorException('Failed to update document status after queueing.');
    }

     this.logger.log(`Document ${documentId} status updated to queued.`);
    return updatedDoc;
  }

  async getDocuments(userId: string): Promise<Document[]> {
    const profileId = await this.getProfileIdForUser(userId);
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error fetching documents for profile ${profileId}: ${error.message}`);
      // Check if error is due to RLS/auth failure
      if (error.code === 'PGRST000' || error.code === '42501') {
        this.logger.warn('RLS might be blocking document fetch. Verify request-scoped client.');
        throw new ForbiddenException('Cannot access documents.');
      }
      throw new InternalServerErrorException('Could not fetch documents.');
    }

    return data || [];
  }

  // Helper to verify ownership and get a document
  private async getDocumentById(profileId: string, documentId: string, skipOwnershipCheck = false): Promise<Document> {
    const query = this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId);

    // Apply ownership check unless explicitly skipped (for internal calls after ownership is confirmed)
    if (!skipOwnershipCheck) {
      query.eq('profile_id', profileId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST code for "Resource not found or permissions denied"
        throw new NotFoundException(`Document with ID ${documentId} not found or access denied.`);
      }
      this.logger.error(`Error fetching document ${documentId}: ${error.message}`);
      throw new InternalServerErrorException('Could not fetch document.');
    }
    if (!data) {
        throw new NotFoundException(`Document with ID ${documentId} not found.`);
    }

    return data;
  }

  async getDocumentDetails(userId: string, documentId: string): Promise<Document> {
    const profileId = await this.getProfileIdForUser(userId);
    return this.getDocumentById(profileId, documentId);
  }

  async getDownloadUrl(userId: string, documentId: string): Promise<{ downloadUrl: string }> {
    const profileId = await this.getProfileIdForUser(userId);
    const document = await this.getDocumentById(profileId, documentId);

    // Generate signed URL for download (expires in 5 minutes)
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(document.storage_path, 60 * 5); // 5 minutes expiry

    if (error) {
      this.logger.error(`Failed to create signed download URL for ${document.storage_path}: ${error.message}`);
      throw new InternalServerErrorException('Could not generate download link.');
    }

    return { downloadUrl: data.signedUrl };
  }

  async retryProcessing(userId: string, documentId: string): Promise<void> {
    const profileId = await this.getProfileIdForUser(userId);
    const document = await this.getDocumentById(profileId, documentId);

    if (document.status !== 'processing_failed') {
      throw new ForbiddenException('Document processing did not fail or is already in progress.');
    }

    this.logger.log(`Re-Queueing job for failed document ${documentId}`);
    try {
      await this.documentQueue.add('process-document', {
        storagePath: document.storage_path,
        documentId,
        profileId,
      });
    } catch (queueError) {
      this.logger.error(`Failed to re-add job to queue for document ${documentId}: ${queueError.message}`);
      throw new InternalServerErrorException('Failed to re-queue document for processing.');
    }

    // Update status to queued
    const { error: updateError } = await this.supabase
      .from('documents')
      .update({ status: 'queued', error_message: null, updated_at: new Date() }) // Clear previous error
      .eq('id', documentId)
      .eq('profile_id', profileId);

    if (updateError) {
      this.logger.error(`Failed to update document ${documentId} status to queued on retry: ${updateError.message}`);
      // Job is queued, but status update failed. Log inconsistency.
      throw new InternalServerErrorException('Failed to update document status after re-queueing.');
    }
    this.logger.log(`Document ${documentId} status updated to queued for retry.`);
  }

  async renameDocument(userId: string, documentId: string, renameDto: RenameDocumentDto): Promise<Document> {
    const profileId = await this.getProfileIdForUser(userId);
    // First verify ownership by fetching the document
    await this.getDocumentById(profileId, documentId);

    const { data: updatedDoc, error: updateError } = await this.supabase
      .from('documents')
      .update({ display_name: renameDto.displayName, updated_at: new Date() })
      .eq('id', documentId)
      .eq('profile_id', profileId) // Redundant check, but safe
      .select()
      .single();

    if (updateError) {
        this.logger.error(`Failed to rename document ${documentId}: ${updateError.message}`);
        throw new InternalServerErrorException('Could not rename document.');
    }
     this.logger.log(`Document ${documentId} renamed to '${renameDto.displayName}'.`);
    return updatedDoc;
  }

  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const profileId = await this.getProfileIdForUser(userId);
    const document = await this.getDocumentById(profileId, documentId);

    // Delete storage object first
    this.logger.log(`Deleting storage object ${document.storage_path}`);
    const { error: storageError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .remove([document.storage_path]);

    if (storageError) {
        // Log error but proceed to delete DB record anyway?
        this.logger.error(`Failed to delete storage object ${document.storage_path}: ${storageError.message}. Proceeding with DB deletion.`);
    }

    // Delete database record
    const { error: dbError } = await this.supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('profile_id', profileId);

    if (dbError) {
        this.logger.error(`Failed to delete document record ${documentId}: ${dbError.message}`);
        throw new InternalServerErrorException('Could not delete document record.');
    }
    this.logger.log(`Document ${documentId} deleted successfully.`);
  }

    // Example function to test the request-scoped client
    async getUserIdFromClient(userId: string): Promise<string | null> {
        const profileId = await this.getProfileIdForUser(userId); // Use internal helper
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) {
        this.logger.error(`Error getting user from request-scoped client: ${error.message}`);
        return null;
        }
        if (user?.id !== userId) {
          this.logger.warn(`Request-scoped client user ID (${user?.id}) does not match AuthGuard user ID (${userId})`);
        }
        this.logger.log(`Request-scoped client authenticated as user: ${user?.id}, profile: ${profileId}`);
        return user?.id ?? null;
    }
} 