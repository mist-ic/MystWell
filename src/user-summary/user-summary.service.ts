import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { Database } from '../supabase/database.types';
import { EmbeddingService } from '../embedding/embedding.service';

interface DocumentInfo {
  displayName: string;
  documentType: string;
  documentDate: string;
  headerDescription: string;
  documentId?: string;
}

interface ProfileData {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  medical_conditions?: string[];
  allergies?: string[];
  medications?: string[];
  // Add other profile fields as needed
}

interface ChatSessionInfo {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'system' | 'assistant';
    content: string;
  }>;
}

interface TranscriptionInfo {
  transcriptionId: string;
  summary: string;
  content: string;
  recordingDate?: string;
}

@Injectable()
export class UserSummaryService {
  private readonly logger = new Logger(UserSummaryService.name);
  private genAI: GoogleGenerativeAI;
  private summaryModelId: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseAdmin: SupabaseClient<Database>,
    private readonly embeddingService: EmbeddingService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GOOGLE_GEMINI_API_KEY is not configured.');
      throw new Error('Gemini API key configuration is missing.');
    }

    // Use a potentially different model for summarization (could be a less powerful/cheaper one)
    this.summaryModelId = this.configService.get<string>('GEMINI_SUMMARY_MODEL_ID', 'gemini-2.5-flash-preview-04-17');
    
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log(`Initialized Gemini client for health summary generation with model: ${this.summaryModelId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  /**
   * Gets the current health summary for a user profile
   */
  async getUserHealthSummary(profileId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('user_health_summaries')
        .select('summary_content')
        .eq('profile_id', profileId)
        .single();

      if (error) {
        this.logger.error(`Error fetching health summary for profile ${profileId}: ${error.message}`);
        return null;
      }

      return data?.summary_content || null;
    } catch (error) {
      this.logger.error(`Failed to get health summary for profile ${profileId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Creates an initial health summary when a new profile is created
   * @param profileData Basic profile data to initialize the summary
   */
  async createInitialSummary(profileData: ProfileData): Promise<void> {
    try {
      const profileId = profileData.id;
      
      // Check if summary already exists
      const existingSummary = await this.getUserHealthSummary(profileId);
      if (existingSummary) {
        this.logger.log(`Health summary already exists for profile ${profileId}. Skipping initial creation.`);
        return;
      }
      
      // Prepare the prompt for Gemini
      const prompt = this.buildInitialSummaryPrompt(profileData);
      
      // Generate the initial summary
      const summary = await this.generateSummaryWithGemini(prompt);
      if (!summary) {
        this.logger.warn(`Failed to generate initial health summary for profile ${profileId}`);
        return;
      }
      
      // Save the summary to the database
      await this.saveUserHealthSummary(
        profileId, 
        summary, 
        'initial_profile_creation'
      );
      
      this.logger.log(`Created initial health summary for new profile ${profileId}`);
    } catch (error) {
      this.logger.error(`Error creating initial health summary: ${error.message}`);
    }
  }

  /**
   * Updates the user's health summary with information from a new document
   */
  async updateSummaryWithNewDocument(
    profileId: string, 
    documentInfo: DocumentInfo
  ): Promise<void> {
    try {
      // Get the current summary
      const currentSummary = await this.getUserHealthSummary(profileId);
      
      // Prepare the prompt for Gemini
      const prompt = this.buildDocumentUpdatePrompt(currentSummary, documentInfo);
      
      // Generate an updated summary
      const updatedSummary = await this.generateSummaryWithGemini(prompt);
      if (!updatedSummary) {
        this.logger.warn(`Failed to generate updated summary for profile ${profileId}`);
        return;
      }
      
      // Update the database with the new summary
      await this.saveUserHealthSummary(
        profileId, 
        updatedSummary, 
        `document:${documentInfo.documentId || 'unknown'}`
      );
      
      this.logger.log(`Successfully updated health summary for profile ${profileId} from document: ${documentInfo.displayName}`);
    } catch (error) {
      this.logger.error(`Error updating health summary with new document: ${error.message}`);
    }
  }

  /**
   * Updates the user's health summary with information from a chat session
   */
  async updateSummaryFromChatSession(
    profileId: string,
    chatSessionInfo: ChatSessionInfo
  ): Promise<void> {
    try {
      // Get the current summary
      const currentSummary = await this.getUserHealthSummary(profileId);
      
      // Prepare the prompt for Gemini
      const prompt = this.buildChatSessionUpdatePrompt(currentSummary, chatSessionInfo);
      
      // Generate an updated summary
      const updatedSummary = await this.generateSummaryWithGemini(prompt);
      if (!updatedSummary) {
        this.logger.warn(`Failed to generate updated summary from chat session for profile ${profileId}`);
        return;
      }
      
      // Only update if the summary has meaningful changes
      if (this.summaryHasChanged(currentSummary, updatedSummary)) {
        // Update the database with the new summary
        await this.saveUserHealthSummary(
          profileId, 
          updatedSummary, 
          `chat_session:${chatSessionInfo.sessionId}`
        );
        
        this.logger.log(`Successfully updated health summary for profile ${profileId} from chat session`);
      } else {
        this.logger.debug(`No meaningful changes to health summary from chat session for profile ${profileId}`);
      }
    } catch (error) {
      this.logger.error(`Error updating health summary from chat session: ${error.message}`);
    }
  }

  /**
   * Updates the user's health summary with information from a transcription
   */
  async updateSummaryFromTranscription(
    profileId: string,
    transcriptionInfo: TranscriptionInfo
  ): Promise<void> {
    try {
      // Get the current summary
      const currentSummary = await this.getUserHealthSummary(profileId);
      
      // Prepare the prompt for Gemini
      const prompt = this.buildTranscriptionUpdatePrompt(currentSummary, transcriptionInfo);
      
      // Generate an updated summary
      const updatedSummary = await this.generateSummaryWithGemini(prompt);
      if (!updatedSummary) {
        this.logger.warn(`Failed to generate updated summary from transcription for profile ${profileId}`);
        return;
      }
      
      // Update the database with the new summary
      await this.saveUserHealthSummary(
        profileId, 
        updatedSummary, 
        `transcription:${transcriptionInfo.transcriptionId}`
      );
      
      this.logger.log(`Successfully updated health summary for profile ${profileId} from transcription`);
    } catch (error) {
      this.logger.error(`Error updating health summary from transcription: ${error.message}`);
    }
  }

  /**
   * Builds a prompt for Gemini to create an initial health summary from profile data
   */
  private buildInitialSummaryPrompt(profileData: ProfileData): string {
    return `You are an AI assistant helping to create an initial health summary for a user based on their profile information.

The user's profile information is:
${profileData.full_name ? `Name: ${profileData.full_name}` : ''}
${profileData.date_of_birth ? `Date of Birth: ${profileData.date_of_birth}` : ''}
${profileData.gender ? `Gender: ${profileData.gender}` : ''}
${profileData.medical_conditions && profileData.medical_conditions.length > 0 
  ? `Medical Conditions: ${profileData.medical_conditions.join(', ')}` : ''}
${profileData.allergies && profileData.allergies.length > 0 
  ? `Allergies: ${profileData.allergies.join(', ')}` : ''}
${profileData.medications && profileData.medications.length > 0 
  ? `Medications: ${profileData.medications.join(', ')}` : ''}

Please create a concise health summary with the available information. The summary should be objective, factual, and focus on:
- Basic demographic information if provided
- Medical conditions and diagnoses if any
- Known allergies and sensitivities if any
- Current medications if any

If minimal information is available, create a brief placeholder summary noting that more health information is needed.
Avoid conversational phrases. Output only the summary text.`;
  }

  /**
   * Builds a prompt for Gemini to update a health summary based on a new document
   */
  private buildDocumentUpdatePrompt(currentSummary: string | null, documentInfo: DocumentInfo): string {
    return `You are an AI assistant helping to maintain a concise health summary for a user. 
    
The user's current health summary is: '${currentSummary || 'None'}'. 

A new document has just been processed: 
Document Name: '${documentInfo.displayName}', 
Type: '${documentInfo.documentType}', 
Date: '${documentInfo.documentDate}', 
Key Information/Summary: '${documentInfo.headerDescription}'

Please integrate the key, medically relevant information from this new document into the existing summary. 
If the existing summary is 'None', create a new summary based on this document. 

The summary should be objective, factual, and concise, focusing on:
- Medical conditions and diagnoses
- Important test results and their values
- Allergies and sensitivities
- Key medications and treatments
- Significant trends in health indicators (if apparent)

Avoid conversational phrases. Output only the updated summary text.`;
  }

  /**
   * Builds a prompt for Gemini to update a health summary based on a chat session
   */
  private buildChatSessionUpdatePrompt(currentSummary: string | null, chatSessionInfo: ChatSessionInfo): string {
    // Extract the messages into a readable format for the prompt
    const messageContent = chatSessionInfo.messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    return `You are an AI assistant helping to maintain a concise health summary for a user.
    
The user's current health summary is: '${currentSummary || 'None'}'.

The user has had a conversation with an AI assistant. Review the conversation for any new health information that should be added to their health summary:

${messageContent}

IF there is new factual health information in this conversation that is not already reflected in the current summary, update the summary to include it. Focus on:
- New or updated medical conditions and diagnoses
- New test results or medical appointments
- Changes to medications or treatments
- New health goals or concerns
- Any other clinically relevant health information

IF there is no new factual health information, return the current summary unchanged.

The summary should be objective, factual, and concise.
Avoid conversational phrases. Output only the updated summary text.`;
  }

  /**
   * Builds a prompt for Gemini to update a health summary based on a transcription
   */
  private buildTranscriptionUpdatePrompt(currentSummary: string | null, transcriptionInfo: TranscriptionInfo): string {
    return `You are an AI assistant helping to maintain a concise health summary for a user.
    
The user's current health summary is: '${currentSummary || 'None'}'. 

A new medical conversation transcription has been processed: 
Summary: '${transcriptionInfo.summary}'
${transcriptionInfo.recordingDate ? `Recording Date: ${transcriptionInfo.recordingDate}` : ''}

Full Transcription Content:
'${transcriptionInfo.content}'

Please integrate any key, medically relevant information from this transcription into the existing summary.
If the existing summary is 'None', create a new summary based on this transcription.

The summary should be objective, factual, and concise, focusing on:
- Medical conditions and diagnoses mentioned
- Test results or medical findings discussed
- Treatment plans or recommendations
- Medications prescribed or discussed
- Follow-up appointments or next steps

Avoid conversational phrases. Output only the updated summary text.`;
  }

  /**
   * Determines if there are meaningful changes between old and new summaries
   */
  private summaryHasChanged(oldSummary: string | null, newSummary: string): boolean {
    if (!oldSummary) return true; // No old summary, so this is meaningful
    
    // Remove whitespace and normalize for comparison
    const normalizedOld = oldSummary.trim().replace(/\s+/g, ' ').toLowerCase();
    const normalizedNew = newSummary.trim().replace(/\s+/g, ' ').toLowerCase();
    
    // If they're identical, no change
    if (normalizedOld === normalizedNew) return false;
    
    // Calculate similarity (simplified check)
    const longLength = Math.max(normalizedOld.length, normalizedNew.length);
    const editDistance = this.calculateLevenshteinDistance(normalizedOld, normalizedNew);
    const similarity = 1 - (editDistance / longLength);
    
    // If similarity is very high (>95%), consider it unchanged
    return similarity < 0.95;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used to determine how different two texts are
   */
  private calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize the matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1,   // insertion
              matrix[i - 1][j] + 1    // deletion
            )
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Generates a summary using the Gemini API
   */
  private async generateSummaryWithGemini(prompt: string): Promise<string | null> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.summaryModelId });
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      this.logger.error(`Error generating summary with Gemini: ${error.message}`);
      return null;
    }
  }

  /**
   * Saves or updates a user's health summary in the database
   */
  private async saveUserHealthSummary(
    profileId: string, 
    summaryContent: string, 
    lastUpdatedSource: string
  ): Promise<void> {
    try {
      // Check if summary already exists for this profile
      const { data, error: selectError } = await this.supabaseAdmin
        .from('user_health_summaries')
        .select('id')
        .eq('profile_id', profileId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "No rows returned" which is expected if no record exists
        this.logger.error(`Error checking for existing health summary: ${selectError.message}`);
        return;
      }

      // If summary exists, update it
      if (data?.id) {
        const { error: updateError } = await this.supabaseAdmin
          .from('user_health_summaries')
          .update({
            summary_content: summaryContent,
            last_updated_source: lastUpdatedSource,
          })
          .eq('id', data.id);

        if (updateError) {
          this.logger.error(`Error updating health summary: ${updateError.message}`);
        }
      } 
      // If summary doesn't exist, insert a new one
      else {
        const { error: insertError } = await this.supabaseAdmin
          .from('user_health_summaries')
          .insert({
            profile_id: profileId,
            summary_content: summaryContent,
            last_updated_source: lastUpdatedSource,
          });

        if (insertError) {
          this.logger.error(`Error inserting health summary: ${insertError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error saving health summary: ${error.message}`);
    }
  }
} 