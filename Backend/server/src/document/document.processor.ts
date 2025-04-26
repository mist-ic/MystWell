import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from './constants';
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
      const BUCKET_NAME = 'mystwell-user-data';
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
      const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
      if (!supportedMimeTypes.includes(mimeType)){
          this.logger.warn(`Unsupported mime type ${mimeType} for document ${documentId}. Skipping Gemini.`);
          throw new Error(`Unsupported image type: ${mimeType}`);
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
      
      // Define the tool (function declaration) for Gemini
      const tools = [
        {
          functionDeclarations: [
            {
              name: "extract_document_data",
              description: "Extracts structured data from the medical document based on the provided schema.",
              parameters: schema, // The JSON schema defined earlier
            },
          ],
        },
      ];

      const model = this.googleAiClient.getGenerativeModel({
          model: "gemini-2.5-flash-preview-04-17",
          safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
          generationConfig: { responseMimeType: "application/json" }, // Ensure JSON output if possible, though function calling is preferred
          tools: tools, // Pass the defined tools
          // Force function calling if needed (might vary by SDK version/model)
          // toolConfig: { functionCallingConfig: { mode: "ANY" /* or REQUIRED */ } } 
      });

      const prompt = "Analyze this medical document image and extract the key information using the provided 'extract_document_data' function.";
      const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };
      
      // Simpler parts structure
      const parts = [ { text: prompt }, imagePart ];

      let extractedJson: any;
      try {
          const result = await model.generateContent({ contents: [{ role: "user", parts }] }); // Correct structure
          const response = result.response;
          const functionCalls = response?.functionCalls;

          // Check for function call in response
          if (functionCalls && functionCalls.length > 0) {
              const functionCall = functionCalls[0];
              if (functionCall.name === "extract_document_data") {
                  extractedJson = functionCall.args; // Arguments should match the schema
                   this.logger.log('Gemini returned structured data via function call.');
              } else {
                  throw new Error(`Unexpected function call returned: ${functionCall.name}`);
              }
          } else {
              // Fallback or error if no function call is present
              const responseText = response?.text(); // Get text response if no function call
              this.logger.warn(`Gemini did not return a function call. Response text: ${responseText}`);
               throw new Error('Gemini did not return the expected function call to extract data.');
          }

      } catch (apiError) {
          this.logger.error(`Gemini API call failed for document ${documentId}: ${apiError.message}`, apiError.stack);
          // Check if error response provides more details (e.g., safety blocks)
          if (apiError.response && apiError.response.promptFeedback) {
              this.logger.error(`Prompt Feedback: ${JSON.stringify(apiError.response.promptFeedback)}`);
              throw new Error(`Gemini API error: Blocked due to ${apiError.response.promptFeedback.blockReason}`);
          }
          throw new Error(`Gemini API error: ${apiError.message}`);
      }

      this.logger.log(`Gemini call successful for document ${documentId}.`);

      // 6. Validate Response (Basic check)
      if (!extractedJson || typeof extractedJson !== 'object' || !extractedJson.detected_document_type) {
        this.logger.error(`Invalid or incomplete JSON structure received from Gemini for ${documentId}: ${JSON.stringify(extractedJson)}`);
        throw new Error('Invalid or incomplete JSON structure received from Gemini');
      }

      // 7. Store Results (use supabaseAdmin)
      await this.updateDocumentStatus(documentId, 'processed', extractedJson);
      this.logger.log(`Job ${job.id} completed successfully for document ${documentId}.`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Job ${job.id} failed for document ${documentId}: ${error.message}`, error.stack);
      // Update status to failed (use supabaseAdmin)
      await this.updateDocumentStatus(documentId, 'processing_failed', null, error.message);
      // Re-throw the error so BullMQ knows the job failed
      throw error;
    }
  }

  // Helper function to update document status
  private async updateDocumentStatus(documentId: string, status: string, structuredData?: any, errorMessage?: string) {
      const updateData: any = { status, updated_at: new Date() };
      if (status === 'processed' && structuredData) {
          updateData.structured_data = structuredData;
          // Ensure detected_document_type exists before assigning
          updateData.detected_document_type = structuredData.detected_document_type ?? 'Unknown'; 
          updateData.error_message = null; // Clear previous errors
      }
      if (status === 'processing_failed') {
          updateData.error_message = errorMessage?.substring(0, 500); // Limit error message length
      }
      // Ensure bucket name is correct
      const BUCKET_NAME = 'mystwell-user-data';
      const { error } = await this.supabaseAdmin
          .from('documents') // Table name
          .update(updateData)
          .eq('id', documentId);

      if (error) {
          this.logger.error(`Failed to update status for document ${documentId} to ${status}: ${error.message}`);
          // Decide if this should throw or just log
      }
  }
} 