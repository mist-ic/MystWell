import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;
  private readonly transcriptionsBucket = 'transcriptions';

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.logger.log('StorageService initialized');
  }

  /**
   * Upload a file to storage
   * @param path Path where the file should be stored
   * @param file The file buffer to upload
   * @param contentType Optional content type of the file
   */
  async uploadFile(path: string, file: Buffer, contentType?: string): Promise<string> {
    this.logger.log(`Uploading file to ${path}`);
    
    try {
      const { data, error } = await this.supabase.storage
        .from(this.transcriptionsBucket)
        .upload(path, file, {
          contentType,
          upsert: true,
        });

      if (error) {
        this.logger.error(`Failed to upload file: ${error.message}`);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      this.logger.log(`File uploaded successfully to ${data?.path}`);
      return data?.path || path;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw new Error(`Error uploading file: ${error.message}`);
    }
  }

  /**
   * Download a file from storage
   * @param path Path of the file to download
   */
  async downloadFile(path: string): Promise<Buffer> {
    this.logger.log(`Downloading file from ${path}`);
    
    try {
      const { data, error } = await this.supabase.storage
        .from(this.transcriptionsBucket)
        .download(path);

      if (error) {
        this.logger.error(`Failed to download file: ${error.message}`);
        throw new Error(`Failed to download file: ${error.message}`);
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      this.logger.log(`File downloaded successfully from ${path}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Error downloading file: ${error.message}`);
      throw new Error(`Error downloading file: ${error.message}`);
    }
  }

  /**
   * Delete a file from storage
   * @param path Path of the file to delete
   */
  async deleteFile(path: string): Promise<void> {
    this.logger.log(`Deleting file ${path}`);
    
    try {
      const { error } = await this.supabase.storage
        .from(this.transcriptionsBucket)
        .remove([path]);

      if (error) {
        this.logger.error(`Failed to delete file: ${error.message}`);
        throw new Error(`Failed to delete file: ${error.message}`);
      }

      this.logger.log(`File deleted successfully from ${path}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw new Error(`Error deleting file: ${error.message}`);
    }
  }
} 