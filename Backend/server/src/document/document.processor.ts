import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from './document.constants';
import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module'; // Correct path
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Schema, SchemaType } from '@google/generative-ai';

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

  async process(job: Job<{ storagePath: string; documentId: string; profileId: string }>): Promise<any> {
    this.logger.log(`Processing job ${job.id} for document ${job.data.documentId}...`);
    const { storagePath, documentId, profileId } = job.data;

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
          throw new Error(`Failed to download image: ${downloadError?.message || 'Unknown error'}`);
      }
      this.logger.log(`Image downloaded successfully.`);

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
          throw new Error(`Unsupported file type: ${mimeType}`); // Changed error message slightly
      }

      // 4. Define Schema (more strictly typed)
      const schema: Schema = { // <-- Explicitly type as Schema
          type: SchemaType.OBJECT,
          description: "Extracted information from a medical document.", // Optional top-level description
          properties: {
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

      const prompt = `Analyze the attached medical document (image or PDF) and extract the key information. \nRespond ONLY with a valid JSON object adhering to the following structure. Do NOT include any other text or formatting like backticks (\`\`\").\n\nJSON Structure:\n${JSON.stringify(schema, null, 2)}\n\nDocument Analysis:`;
      const filePart = { inlineData: { data: base64Image, mimeType: mimeType } };
      
      const parts = [ { text: prompt }, filePart ];

      let extractedJson: any;
      try {
          const result = await model.generateContent({ contents: [{ role: "user", parts }] });
          const response = result.response;
          const responseText = response?.text();

          if (!responseText) {
            this.logger.error(`Gemini returned an empty response for document ${documentId}.`);
            throw new Error('Gemini returned an empty response.');
          }

          this.logger.log(`Received raw response text from Gemini: ${responseText}`);

          try {
            extractedJson = JSON.parse(responseText);
            this.logger.log('Successfully parsed Gemini response text as JSON.');
          } catch (parseError) {
            this.logger.error(`Failed to parse Gemini response text as JSON for document ${documentId}. Text: ${responseText}`, parseError.stack);
            const cleanedText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            try {
              extractedJson = JSON.parse(cleanedText);
              this.logger.log('Successfully parsed cleaned Gemini response text as JSON.');
            } catch (cleanedParseError) {
              this.logger.error(`Failed to parse even cleaned Gemini response text as JSON for document ${documentId}. Cleaned Text: ${cleanedText}`, cleanedParseError.stack);
              throw new Error('Gemini response was not valid JSON, even after cleaning.');
            }
          }

      } catch (apiError) {
          this.logger.error(`Gemini API call failed for document ${documentId}: ${apiError.message}`, apiError.stack);
          if (apiError.response && apiError.response.promptFeedback) {
              this.logger.error(`Prompt Feedback: ${JSON.stringify(apiError.response.promptFeedback)}`);
              throw new Error(`Gemini API error: Blocked due to ${apiError.response.promptFeedback.blockReason}`);
          }
          throw new Error(`Gemini API error: ${apiError.message}`);
      }

      this.logger.log(`Gemini call successful for document ${documentId}.`);

      if (!extractedJson || typeof extractedJson !== 'object' || !extractedJson.detected_document_type) {
        this.logger.error(`Invalid or incomplete JSON structure received from Gemini for ${documentId}: ${JSON.stringify(extractedJson)}`);
        throw new Error('Invalid or incomplete JSON structure received from Gemini');
      }

      await this.updateDocumentStatus(documentId, 'processed', extractedJson);
      this.logger.log(`Job ${job.id} completed successfully for document ${documentId}.`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Job ${job.id} failed for document ${documentId}: ${error.message}`, error.stack);
      await this.updateDocumentStatus(documentId, 'processing_failed', null, error.message);
      throw error;
    }
  }

  private async updateDocumentStatus(documentId: string, status: string, structuredData?: any, errorMessage?: string) {
      const updateData: any = { status, updated_at: new Date() };
      if (status === 'processed' && structuredData) {
          updateData.structured_data = structuredData;
          updateData.detected_document_type = structuredData.detected_document_type ?? 'Unknown'; 
          updateData.error_message = null;
      }
      if (status === 'processing_failed') {
          updateData.error_message = errorMessage?.substring(0, 500);
      }
      const BUCKET_NAME = 'documents';
      const { error } = await this.supabaseAdmin
          .from('documents')
          .update(updateData)
          .eq('id', documentId);

      if (error) {
          this.logger.error(`Failed to update status for document ${documentId} to ${status}: ${error.message}`);
      }
  }
} 