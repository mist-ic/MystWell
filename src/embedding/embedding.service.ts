import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private googleAiClient: GoogleGenerativeAI;
  private embeddingModelId: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY must be configured in .env');
    }
    
    this.googleAiClient = new GoogleGenerativeAI(apiKey);
    this.embeddingModelId = this.configService.get<string>('GEMINI_EMBEDDING_MODEL_ID', 'text-embedding-004');
    this.logger.log(`EmbeddingService initialized with model: ${this.embeddingModelId}`);
  }

  /**
   * Generate an embedding vector for the given text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Attempted to generate embedding for empty text');
      return [];
    }
    
    try {
      const embeddingModel = this.googleAiClient.getGenerativeModel({ model: this.embeddingModelId });
      const embeddingResult = await embeddingModel.embedContent(text);
      const embeddingVector = embeddingResult?.embedding?.values ?? [];
      
      if (embeddingVector.length === 0) {
        this.logger.warn('Embedding generation returned empty values');
      } else {
        this.logger.debug(`Generated embedding with ${embeddingVector.length} dimensions`);
      }
      
      return embeddingVector;
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`, error.stack);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
} 