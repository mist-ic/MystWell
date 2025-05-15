import { Injectable, Inject, NotFoundException, ForbiddenException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_REQUEST_CLIENT } from './document.constants'; // Import from constants file instead
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from './document.constants'; // Import from constants file
import { RenameDocumentDto } from './dto/rename-document.dto';
import { ProfileService } from '../profile/profile.service';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module'; // Import service role client

// Define an interface for the expected document structure (optional but good practice)
export interface Document {
  id: string;
  profile_id: string;
  storage_path: string;
  display_name: string | null;
  status: string;
  detected_document_type: string | null;
  document_type: string | null;
  document_date: string | null;
  header_description: string | null;
  structured_data: any | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Define the structure returned by the match_documents function
interface MatchedDocument {
  id: string;
  header_description: string | null; // Match the return type of the function
  similarity: number;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly BUCKET_NAME = 'documents'; // Change to match the bucket we'll create

  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseAdmin: SupabaseClient, // Inject service role client
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE) private readonly documentQueue: Queue,
    private readonly profileService: ProfileService,
  ) {}

  private async getProfileIdForUser(userId: string): Promise<string> {
    try {
      // Use ProfileService to get the profile with service role client to bypass RLS
      const profile = await this.profileService.getProfileByUserId(userId);
      
      if (!profile) {
        this.logger.warn(`No profile found for user ${userId}`);
        throw new NotFoundException('User profile not found.');
      }
      
      return profile.id;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw NotFoundException
      }
      this.logger.error(`Error fetching profile for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Could not retrieve user profile.');
    }
  }

  async getUploadDetails(userId: string): Promise<{ uploadUrl: string; documentId: string; storagePath: string }> {
    const profileId = await this.getProfileIdForUser(userId);
    const documentId = uuidv4();
    // Store in a folder structure: public/{profile_id}/documents/{document_id}.{ext}
    // We don't know the extension yet, but Supabase upload handles it.
    // Let's store the base path without extension initially.
    const storagePath = `${profileId}/documents/${documentId}`;

    this.logger.log(`Creating initial record for document ${documentId} for profile ${profileId}`);

    // Create initial DB record using service role client to bypass RLS
    const { error: insertError } = await this.supabaseAdmin
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
    const { data, error: urlError } = await this.supabaseAdmin.storage
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

  async completeUpload(
    userId: string, 
    documentId: string, 
    storagePath: string, 
    displayName?: string
  ): Promise<Document> {
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
        displayName: displayName // Pass the displayName to the job
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail: 1000
      });
    } catch (queueError) {
      this.logger.error(`Failed to add job to queue for document ${documentId}: ${queueError.message}`);
      throw new InternalServerErrorException('Failed to queue document for processing.');
    }

    // Prepare update data
    const updateData: any = { 
      status: 'queued', 
      updated_at: new Date()
    };
    
    // If displayName is provided, update it
    if (displayName) {
      updateData.display_name = displayName;
      this.logger.log(`Setting custom display name for document ${documentId}: "${displayName}"`);
    }

    // Update status to queued - use admin client to bypass RLS
    const { data: updatedDoc, error: updateError } = await this.supabaseAdmin
      .from('documents')
      .update(updateData)
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

  async getDocuments(userId: string, documentType?: string): Promise<Document[]> {
    const profileId = await this.getProfileIdForUser(userId);
    // Use admin client to bypass RLS for fetching documents
    const query = this.supabaseAdmin
      .from('documents')
      .select('*')
      .eq('profile_id', profileId);
    
    // If document type is specified, filter by it
    if (documentType && documentType !== 'all') {
      query.eq('document_type', documentType);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error fetching documents for profile ${profileId}: ${error.message}`);
      throw new InternalServerErrorException('Could not fetch documents.');
    }

    return data || [];
  }

  async getDocumentsByType(userId: string, documentType: string): Promise<Document[]> {
    const profileId = await this.getProfileIdForUser(userId);
    
    // Query documents by type
    const { data, error } = await this.supabaseAdmin
      .from('documents')
      .select('*')
      .eq('profile_id', profileId)
      .eq('document_type', documentType)
      .order('created_at', { ascending: false });
    
    if (error) {
      this.logger.error(`Error fetching documents by type ${documentType} for profile ${profileId}: ${error.message}`);
      throw new InternalServerErrorException('Could not fetch documents by type.');
    }
    
    return data || [];
  }

  async getDocumentTypes(userId: string): Promise<string[]> {
    const profileId = await this.getProfileIdForUser(userId);
    
    // Query for distinct document types that exist for this profile
    const { data, error } = await this.supabaseAdmin
      .from('documents')
      .select('document_type')
      .eq('profile_id', profileId)
      .eq('status', 'processed')
      .not('document_type', 'is', null)
      .order('document_type');
    
    if (error) {
      this.logger.error(`Error fetching document types for profile ${profileId}: ${error.message}`);
      throw new InternalServerErrorException('Could not fetch document types.');
    }
    
    // Extract unique document types
    const types = [...new Set(data.map(doc => doc.document_type))];
    return types;
  }

  // Helper to verify ownership and get a document
  private async getDocumentById(profileId: string, documentId: string, skipOwnershipCheck = false): Promise<Document> {
    // Use admin client to bypass RLS
    const query = this.supabaseAdmin
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

  async getDownloadUrl(userId: string, documentId: string): Promise<{ downloadUrl: string; mimeType: string | null }> {
    const profileId = await this.getProfileIdForUser(userId);
    const document = await this.getDocumentById(profileId, documentId);

    // Attempt to get file metadata including mime type using the service role client
    let mimeType: string | null = null;
    try {
        const { data: listData, error: listError } = await this.supabaseAdmin.storage
            .from(this.BUCKET_NAME)
            .list(document.storage_path.substring(0, document.storage_path.lastIndexOf('/') + 1), { // List directory
                limit: 1,
                search: document.storage_path.substring(document.storage_path.lastIndexOf('/') + 1) // Search for exact file name
            });

        if (listError) {
            this.logger.warn(`Could not list file to get metadata for ${document.storage_path}: ${listError.message}`);
        } else if (listData && listData.length > 0 && listData[0].metadata) {
            mimeType = listData[0].metadata.mimetype ?? null;
            this.logger.log(`Retrieved mime type for ${document.storage_path}: ${mimeType}`);
        } else {
             this.logger.warn(`File not found in storage list or metadata missing for ${document.storage_path}`);
             // Optionally throw error or proceed without mime type?
        }
    } catch (metaError: any) {
        this.logger.error(`Error fetching metadata for ${document.storage_path}: ${metaError.message}`);
        // Proceed without mime type
    }

    // Generate signed URL for download (expires in 5 minutes)
    // Use the ADMIN client now, as the request-scoped one is removed
    const { data, error } = await this.supabaseAdmin.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(document.storage_path, 60 * 5); // 5 minutes expiry

    if (error) {
      this.logger.error(`Failed to create signed download URL for ${document.storage_path}: ${error.message}`);
      throw new InternalServerErrorException('Could not generate download link.');
    }

    return { downloadUrl: data.signedUrl, mimeType }; // Return mimeType along with URL
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

    // Update status to queued - use ADMIN client
    const { error: updateError } = await this.supabaseAdmin
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
    // Verify ownership (uses getDocumentById, which uses supabaseAdmin)
    await this.getDocumentById(profileId, documentId);

    // Use ADMIN client for the update
    const { data: updatedDoc, error: updateError } = await this.supabaseAdmin
      .from('documents')
      .update({ display_name: renameDto.displayName, updated_at: new Date() })
      .eq('id', documentId)
      .eq('profile_id', profileId) 
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

    // Delete storage object first - use ADMIN client
    this.logger.log(`Deleting storage object ${document.storage_path}`);
    const { error: storageError } = await this.supabaseAdmin.storage
      .from(this.BUCKET_NAME)
      .remove([document.storage_path]);

    if (storageError) {
        // Log error but proceed to delete DB record anyway?
        this.logger.error(`Failed to delete storage object ${document.storage_path}: ${storageError.message}. Proceeding with DB deletion.`);
    }

    // Delete database record - use ADMIN client
    const { error: dbError } = await this.supabaseAdmin
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
        const { data: { user }, error } = await this.supabaseAdmin.auth.getUser();
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

  // --- ADDED: Vector Search Method --- 
  async findRelevantDocuments(
    profileId: string, 
    queryEmbedding: number[], 
    matchCount: number = 5, // Default limit
    matchThreshold: number = 0.75 // Default threshold (adjust based on testing)
  ): Promise<MatchedDocument[]> { 
    if (!queryEmbedding || queryEmbedding.length === 0) {
      this.logger.warn(`findRelevantDocuments called for profile ${profileId} with empty embedding.`);
      return [];
    }
    
    this.logger.log(`Finding relevant documents for profile ${profileId} (threshold: ${matchThreshold}, count: ${matchCount})`);

    try {
      // Call the database function using RPC with the service role client
      const { data, error } = await this.supabaseAdmin.rpc('match_documents', {
        query_embedding: queryEmbedding, // Pass the embedding vector
        query_profile_id: profileId,     // Pass the profile ID for filtering
        match_threshold: matchThreshold, // Pass the similarity threshold
        match_count: matchCount         // Pass the result limit
      });

      if (error) {
        this.logger.error(`RPC match_documents failed for profile ${profileId}: ${error.message}`, error.stack);
        throw new InternalServerErrorException('Failed to search for relevant documents.');
      }

      this.logger.log(`Found ${data?.length ?? 0} relevant documents for profile ${profileId}.`);
      return (data as MatchedDocument[]) || []; // Type assertion

    } catch (error) {
      // Catch potential exceptions from the RPC call itself or re-thrown errors
      if (error instanceof InternalServerErrorException) throw error;
      
      this.logger.error(`Unexpected error during document vector search for profile ${profileId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('An unexpected error occurred while searching documents.');
    }
  }
  // --- END: Vector Search Method --- 
} 