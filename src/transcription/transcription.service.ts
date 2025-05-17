import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingService } from '../embedding/embedding.service';
import { StorageService } from '../storage/storage.service';

// Define types for transcription data
export interface Transcription {
  id: string;
  profile_id: string;
  recording_id: string;
  storage_path: string;
  content: string;
  summary: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  recording_date: string | null;
  embedding: number[] | null;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly storageService: StorageService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined');
    }
    
    this.supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
    );
  }

  async findRelevantTranscriptions(
    profileId: string,
    queryEmbedding: number[],
    count = 3,
    threshold = 0.5,
  ): Promise<{ id: string; summary: string; similarity: number }[]> {
    this.logger.log(`Finding relevant transcriptions for profile ${profileId} (threshold: ${threshold}, count: ${count})`);

    try {
      const { data, error } = await this.supabase.rpc('match_transcriptions', {
        query_embedding: queryEmbedding,
        query_profile_id: profileId,
        match_threshold: threshold,
        match_count: count,
      });

      if (error) {
        this.logger.error(`Error finding relevant transcriptions: ${error.message}`);
        throw new InternalServerErrorException('Failed to find relevant transcriptions');
      }

      this.logger.log(`Found ${data?.length || 0} relevant transcriptions for profile ${profileId}.`);
      return data || [];
    } catch (error) {
      this.logger.error(`Error finding relevant transcriptions: ${error.message}`);
      throw new InternalServerErrorException('Failed to find relevant transcriptions');
    }
  }

  async getTranscriptionContent(transcriptionId: string): Promise<Transcription> {
    try {
      const { data, error } = await this.supabase
        .from('transcriptions')
        .select('*')
        .eq('id', transcriptionId)
        .single();

      if (error) {
        this.logger.error(`Error retrieving transcription ${transcriptionId}: ${error.message}`);
        throw new NotFoundException(`Transcription with ID ${transcriptionId} not found`);
      }

      return data;
    } catch (error) {
      this.logger.error(`Error retrieving transcription: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve transcription');
    }
  }

  async listTranscriptions(profileId: string, limit = 10): Promise<Transcription[]> {
    try {
      const { data, error } = await this.supabase
        .from('transcriptions')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'processed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(`Error listing transcriptions for profile ${profileId}: ${error.message}`);
        throw new InternalServerErrorException('Failed to list transcriptions');
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error listing transcriptions: ${error.message}`);
      throw new InternalServerErrorException('Failed to list transcriptions');
    }
  }

  async createTranscription(profileId: string, recordingId: string, content: string, summary: string): Promise<Transcription> {
    try {
      // Generate embedding for the summary
      const embedding = await this.embeddingService.generateEmbedding(summary);
      
      // Store in the database
      const { data, error } = await this.supabase
        .from('transcriptions')
        .insert({
          profile_id: profileId,
          recording_id: recordingId,
          content: content,
          summary: summary,
          embedding: embedding,
          status: 'processed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Error creating transcription: ${error.message}`);
        throw new InternalServerErrorException('Failed to create transcription');
      }

      return data;
    } catch (error) {
      this.logger.error(`Error creating transcription: ${error.message}`);
      throw new InternalServerErrorException('Failed to create transcription');
    }
  }

  async updateTranscription(
    transcriptionId: string, 
    updates: Partial<{ content: string; summary: string; recording_date: string }>
  ): Promise<Transcription> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      
      // If summary is being updated, regenerate the embedding
      if (updates.summary) {
        const embedding = await this.embeddingService.generateEmbedding(updates.summary);
        updateData.embedding = embedding;
      }
      
      const { data, error } = await this.supabase
        .from('transcriptions')
        .update(updateData)
        .eq('id', transcriptionId)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error updating transcription ${transcriptionId}: ${error.message}`);
        throw new InternalServerErrorException('Failed to update transcription');
      }

      return data;
    } catch (error) {
      this.logger.error(`Error updating transcription: ${error.message}`);
      throw new InternalServerErrorException('Failed to update transcription');
    }
  }

  async deleteTranscription(transcriptionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('transcriptions')
        .delete()
        .eq('id', transcriptionId);

      if (error) {
        this.logger.error(`Error deleting transcription ${transcriptionId}: ${error.message}`);
        throw new InternalServerErrorException('Failed to delete transcription');
      }
    } catch (error) {
      this.logger.error(`Error deleting transcription: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete transcription');
    }
  }
} 