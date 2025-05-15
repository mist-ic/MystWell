import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from './document.constants';
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module'; // Correct path
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Schema, SchemaType } from '@google/generative-ai';

interface DocumentJobData {
  storagePath: string; 
  documentId: string; 
  profileId: string; 
  displayName: string;
}

@Injectable() // Add Injectable decorator
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DocumentProcessor.name);
  private googleAiClient: GoogleGenerativeAI;

  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseAdmin: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    super(); // Call super() for WorkerHost
    // Initialize Google AI Client
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY'); // Corrected env var name
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY must be configured in .env');
    }
    this.googleAiClient = new GoogleGenerativeAI(apiKey);
    this.logger.log('GoogleGenerativeAI client initialized.');
  }

  async onModuleInit() {
    this.logger.log(`Processor for queue ${DOCUMENT_PROCESSING_QUEUE} initialized.`);
  }

  async process(job: Job<DocumentJobData>): Promise<any> {
    const { storagePath, documentId, profileId, displayName } = job.data;
    this.logger.log(`Starting job ${job.id} for document ${documentId} (path: ${storagePath}, profile: ${profileId}, attempt: ${job.attemptsMade + 1})`);

    try {
      // 1. Update status to processing (use supabaseAdmin)
      await this.updateDocumentStatus(documentId, 'processing');

      // 2. Download image (use supabaseAdmin)
      this.logger.log(`Downloading image from ${storagePath}`);
      // Ensure bucket name is correct - let's assume it's 'mystwell-user-data' based on service
      const BUCKET_NAME = 'documents';
      const { data: blob, error: downloadError } = await this.supabaseAdmin.storage
          .from(BUCKET_NAME)
          .download(storagePath);

      if (downloadError || !blob) {
          const errorMsg = downloadError?.message || 'Unknown error';
          this.logger.error(`Failed to download image: ${errorMsg}`);
          await this.updateDocumentStatus(documentId, 'download_failed', undefined, undefined, null, `Failed to download: ${errorMsg}`);
          // Return instead of throwing for storage errors to prevent unnecessary retries
          return { success: false, error: 'download_failed' };
      }
      this.logger.log(`Image downloaded successfully (size: ${blob.size} bytes).`);

      // 3. Convert to base64
      const imageBuffer = Buffer.from(await blob.arrayBuffer());
      const base64Image = imageBuffer.toString('base64');
      const mimeType = blob.type; // e.g., 'image/jpeg'
      this.logger.log(`Image converted to base64 (mime-type: ${mimeType}).`);

      // --- Validate Mime Type --- 
      const supportedMimeTypes = [
        'image/png', 
        'image/jpeg', 
        'image/webp', 
        'image/heic', 
        'image/heif',
        'application/pdf' // Add PDF support
      ];
      if (!supportedMimeTypes.includes(mimeType)){
          this.logger.warn(`Unsupported mime type ${mimeType} for document ${documentId}. Skipping Gemini.`);
          await this.updateDocumentStatus(documentId, 'processing_failed', undefined, undefined, null, `Unsupported file type: ${mimeType}`);
          // Return instead of throwing for unsupported mime types (no point in retrying)
          return { success: false, error: 'unsupported_mime_type' };
      }

      // 4. Define Schema (more strictly typed)
      const schema: Schema = { // <-- Explicitly type as Schema
          type: SchemaType.OBJECT,
          description: "Extracted information from a medical document.", // Optional top-level description
          properties: {
              headerDescription: {
                  type: SchemaType.STRING,
                  description: "A detailed, concise summary of the document's content, suitable for identifying relevance without reading the full text. Include patient name (if found), document type, date, provider, and key findings/purpose."
              },
              detected_document_type: { 
                  type: SchemaType.STRING, 
                  description: "The type of medical document identified (e.g., Prescription, Lab Report, Doctor's Note, Invoice)."
              },
              patient_name: { 
                  type: SchemaType.STRING, 
                  description: "Full name of the patient mentioned."
              },
              date_of_service: { 
                  type: SchemaType.STRING, 
                  description: "Date the service was rendered or the document was issued (YYYY-MM-DD format preferred)."
              },
              provider_name: { 
                  type: SchemaType.STRING, 
                  description: "Name of the doctor, clinic, hospital, or lab."
              },
              key_information: { 
                  type: SchemaType.ARRAY, 
                  description: "List of key findings, results, diagnoses, or instructions.", 
                  items: { type: SchemaType.STRING } // Define type of array items
              },
              medications_mentioned: { 
                  type: SchemaType.ARRAY, 
                  description: "List of medications mentioned, including dosage/frequency if available.", 
                  items: { // Define the structure of objects within the array
                      type: SchemaType.OBJECT,
                      properties: { 
                          name: { type: SchemaType.STRING, description: "Name of the medication."},
                          dosage: { type: SchemaType.STRING, description: "Dosage of the medication (e.g., 500mg).", nullable: true },
                          frequency: { type: SchemaType.STRING, description: "How often the medication should be taken (e.g., Once Daily).", nullable: true }
                      }, 
                      required: ["name"] 
                  }
              },
              follow_up_instructions: { 
                  type: SchemaType.STRING, 
                  description: "Any instructions for follow-up appointments or actions.",
                  nullable: true // Make optional fields nullable
              },
              summary: { 
                  type: SchemaType.STRING, 
                  description: "A brief summary of the document's content.",
                  nullable: true
              }
          },
          required: ["detected_document_type"] // Only type is strictly required by the schema itself
      };

      // 5. Call Gemini API
      this.logger.log(`Calling Gemini API (model: gemini-2.5-flash-preview-04-17) for document ${documentId}...`);
      
      let extractedJson: any;
      try {
        const model = this.googleAiClient.getGenerativeModel({
            model: "gemini-2.5-flash-preview-04-17",
            safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              ],
            generationConfig: { responseMimeType: "application/json" },
        });

        const prompt = `
You are analyzing a health document. Identify the following details:
1. Document type: What kind of health document is this? (e.g., blood test, prescription, xray report, doctor's note, hospital discharge)
2. Header description: Write a concise 1-2 sentence summary of what this document contains (max 150 characters)
3. Document date: When was this document created? (in YYYY-MM-DD format)
4. Key findings: Extract 3-5 main points from the document

Format the response as a structured JSON object with the following fields:
{
  "detected_document_type": "blood_test | prescription | xray | imaging | doctor_note | hospital | insurance | other",
  "headerDescription": "1-2 sentence summary",
  "document_date": "YYYY-MM-DD or null if not found",
  "key_findings": ["finding 1", "finding 2", "finding 3"]
}
`;
        const filePart = { inlineData: { data: base64Image, mimeType: mimeType } };
        
        const parts = [ { text: prompt }, filePart ];

        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const response = result.response;
        const responseText = response?.text();

        if (!responseText) {
          this.logger.error(`Gemini returned an empty response for document ${documentId}.`);
          await this.updateDocumentStatus(documentId, 'processing_failed', undefined, undefined, null, 'Gemini returned an empty response');
          // Throw to enable retry for empty responses (could be temporary)
          throw new Error('Gemini returned an empty response.');
        }

        this.logger.debug(`Received raw response text from Gemini for document ${documentId}`);

        try {
          extractedJson = JSON.parse(responseText);
          this.logger.log('Successfully parsed Gemini response text as JSON.');
        } catch (parseError) {
          this.logger.error(`Failed to parse Gemini response text as JSON for document ${documentId}`, parseError.stack);
          // Try to extract JSON from the response if it's wrapped in text or code blocks
          const jsonRegex = /\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/;
          const match = responseText.match(jsonRegex);
          
          if (match && match[0]) {
            try {
              extractedJson = JSON.parse(match[0]);
              this.logger.log('Successfully extracted and parsed JSON from Gemini response.');
            } catch (extractError) {
              this.logger.error(`Failed to extract valid JSON from response for document ${documentId}. Content: ${match[0]}`, extractError.stack);
              await this.updateDocumentStatus(documentId, 'processing_failed', undefined, undefined, null, 'Failed to extract JSON from Gemini response');
              return { success: false, error: 'json_parse_error' };
            }
          } else {
            // No JSON-like structure found
            this.logger.error(`No JSON-like structure found in response for document ${documentId}`);
            await this.updateDocumentStatus(documentId, 'processing_failed', undefined, undefined, null, 'No valid JSON found in Gemini response');
            return { success: false, error: 'json_parse_error' };
          }
        }
      } catch (apiError) {
        this.logger.error(`Gemini API call failed for document ${documentId}: ${apiError.message}`, apiError.stack);
        
        let errorMsg = `Gemini API error: ${apiError.message}`;
        let errorStatus = 'processing_failed';
        
        if (apiError.response && apiError.response.promptFeedback) {
            this.logger.error(`Prompt Feedback: ${JSON.stringify(apiError.response.promptFeedback)}`);
            errorMsg = `Gemini API error: Blocked due to ${apiError.response.promptFeedback.blockReason}`;
            // Don't retry safety blocks
            return { success: false, error: 'safety_block' };
        }
        
        // Check for rate limiting or quota errors to enable retries
        if (apiError.message.includes('quota') || 
            apiError.message.includes('rate limit') || 
            apiError.message.includes('429') ||
            apiError.message.includes('too many requests')) {
          errorStatus = 'quota_exceeded';
          errorMsg = 'Gemini API quota exceeded or rate limited. Will retry automatically.';
          await this.updateDocumentStatus(documentId, errorStatus, undefined, undefined, null, errorMsg);
          // Throw for quota errors to enable retries with backoff
          throw apiError;
        }
        
        await this.updateDocumentStatus(documentId, errorStatus, undefined, undefined, null, errorMsg);
        // For other API errors, throw to enable retries
        throw apiError;
      }

      this.logger.log(`Gemini call successful for document ${documentId}.`);

      // Enhanced validation with repair attempts
      if (!extractedJson || typeof extractedJson !== 'object') {
        this.logger.error(`Invalid JSON structure received from Gemini for ${documentId}: ${JSON.stringify(extractedJson)}`);
        await this.updateDocumentStatus(documentId, 'processing_failed', undefined, undefined, null, 'Invalid JSON structure received from Gemini');
        return { success: false, error: 'invalid_response' };
      }
      
      // If we got a schema definition instead of data, attempt to create a basic valid object
      if (extractedJson.type && extractedJson.properties && !extractedJson.detected_document_type) {
        this.logger.warn(`Received schema instead of data for ${documentId} - attempting to create valid object`);
        
        const repaired = {
          detected_document_type: "Unknown Document",
          headerDescription: displayName || "Document could not be fully analyzed",
          patient_name: null,
          date_of_service: null,
          provider_name: null,
          key_information: ["Document processing partial - please check the original document"],
          medications_mentioned: [],
          follow_up_instructions: null,
          summary: "Document processing could not extract detailed information. Please refer to the original document."
        };
        
        extractedJson = repaired;
        this.logger.log(`Created basic valid object for document ${documentId}`);
      }
      
      // Final check for required field
      if (!extractedJson.detected_document_type) {
        // Add a default value if missing
        extractedJson.detected_document_type = "Unknown Document";
        this.logger.warn(`Added default document type for ${documentId}`);
      }

      // 6. ---> Generate Embedding <--- 
      let embeddingVector: number[] | null = null;
      const textToEmbed = extractedJson.headerDescription;

      if (textToEmbed && typeof textToEmbed === 'string' && textToEmbed.trim().length > 0) {
        try {
          this.logger.log(`Generating embedding for document ${documentId} using headerDescription...`);
          const embeddingModel = this.googleAiClient.getGenerativeModel({ model: "text-embedding-004" });
          const embeddingResult = await embeddingModel.embedContent(textToEmbed);
          embeddingVector = embeddingResult?.embedding?.values ?? null;
          if (embeddingVector) {
            this.logger.log(`Successfully generated embedding for document ${documentId} (dimensions: ${embeddingVector.length})`);
          } else {
            this.logger.warn(`Embedding generation returned no values for document ${documentId}.`);
          }
        } catch (embeddingError) {
          this.logger.error(`Failed to generate embedding for document ${documentId}: ${embeddingError.message}`, embeddingError.stack);
          // Continue without embedding - this is not a fatal error
        }
      } else {
        this.logger.warn(`No valid headerDescription found in extracted JSON for document ${documentId}. Skipping embedding.`);
      }
      // ---> End Embedding Generation <--- 

      // 7. Update final status and save data (including embedding)
      await this.updateDocumentStatus(documentId, 'processed', displayName, extractedJson, embeddingVector);
      this.logger.log(`Job ${job.id} completed successfully for document ${documentId}.`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Job ${job.id} failed for document ${documentId}: ${error.message}`, error.stack);
      
      // Determine if we should retry based on the error
      const isRetryableError = 
        error.message.includes('quota') || 
        error.message.includes('rate limit') ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('connection');
        
      const errorStatus = isRetryableError ? 'retry_pending' : 'processing_failed';
      
      await this.updateDocumentStatus(
        documentId, 
        errorStatus, 
        undefined, 
        undefined, 
        null, 
        isRetryableError ? `Error: ${error.message}. Will retry automatically.` : error.message
      );
      
      // Always throw to let BullMQ handle retry logic based on queue configuration
      throw error;
    }
  }

  // Listen for completion events
  onCompleted(job: Job<DocumentJobData>) {
    const { documentId } = job.data;
    this.logger.log(`Job for document ${documentId} completed successfully after ${job.attemptsMade + 1} attempts.`);
  }

  // Listen for failure events
  onFailed(job: Job<DocumentJobData>, error: Error) {
    const { documentId } = job.data;
    this.logger.error(
      `Job for document ${documentId} failed after ${job.attemptsMade + 1} attempts with error: ${error.message}`, 
      error.stack
    );
  }

  private async updateDocumentStatus(documentId: string, status: string, displayName?: string | undefined, structuredData?: any, embedding?: number[] | null, errorMessage?: string) {
    const updateData: any = { 
        status,
        updated_at: new Date(),
        // Reset error message unless explicitly setting failed status
        error_message: ['processing_failed', 'download_failed', 'retry_pending', 'quota_exceeded'].includes(status) 
            ? errorMessage?.substring(0, 500) 
            : null 
    }; 

    if (status === 'processed') {
        if (structuredData) {
            updateData.structured_data = structuredData;
            updateData.detected_document_type = structuredData.detected_document_type ?? 'Unknown'; 
            
            // Extract header description
            if (structuredData.headerDescription) {
                updateData.header_description = structuredData.headerDescription.substring(0, 200);
            }
            
            // Extract document type as a standardized value
            if (structuredData.detected_document_type) {
                updateData.document_type = this.standardizeDocumentType(structuredData.detected_document_type);
            }
            
            // Extract document date if available
            if (structuredData.document_date) {
                try {
                    // Try to parse the date (could be in YYYY-MM-DD format)
                    const parsedDate = new Date(structuredData.document_date);
                    if (!isNaN(parsedDate.getTime())) {
                        updateData.document_date = parsedDate;
                    }
                } catch (error) {
                    this.logger.warn(`Failed to parse document date: ${structuredData.document_date}`);
                }
            }
        }

        if (embedding) {
            updateData.embedding = embedding;
        }
    }

    if (displayName) {
        updateData.display_name = displayName.substring(0, 100);
    }

    try {
        const { data, error } = await this.supabaseAdmin
            .from('documents')
            .update(updateData)
            .eq('id', documentId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        this.logger.log(`Document ${documentId} status updated to ${status}.`);
        return data;
    } catch (error) {
        this.logger.error(`Failed to update document ${documentId} status: ${error.message}`);
        throw error;
    }
  }

  // Helper function to standardize document types
  private standardizeDocumentType(detectedType: string): string {
    const lowerType = detectedType.toLowerCase();
    
    // Map to standardized document types
    if (lowerType.includes('blood') || lowerType.includes('lab')) return 'blood_test';
    if (lowerType.includes('prescription')) return 'prescription';
    if (lowerType.includes('xray') || lowerType.includes('mri') || lowerType.includes('ct') || 
        lowerType.includes('ultrasound') || lowerType.includes('imaging')) return 'imaging';
    if (lowerType.includes('discharge') || lowerType.includes('admission')) return 'hospital';
    if (lowerType.includes('note') || lowerType.includes('clinical')) return 'doctor_note';
    if (lowerType.includes('vaccine') || lowerType.includes('immunization')) return 'vaccination';
    if (lowerType.includes('insurance') || lowerType.includes('claim')) return 'insurance';
    if (lowerType.includes('bill') || lowerType.includes('invoice')) return 'invoice';
    
    // Default fallback
    return 'other';
  }
} 