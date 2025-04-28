import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerateContentRequest,
  GenerationConfig,
} from '@google/generative-ai';

// Define structure for the expected output from Gemini
export interface StructuredRecordingDetails {
  prescribedMedicines?: string[]; // List of medicine names
  diagnosis?: string; // Summary of diagnosis
  symptoms?: string[]; // List of mentioned symptoms
  importantPoints?: string[]; // List of key takeaways
}

@Injectable()
export class GeminiAnalysisService {
  private readonly logger = new Logger(GeminiAnalysisService.name);
  private genAI: GoogleGenerativeAI;
  private modelId = 'gemini-1.5-flash-latest'; // Use the Flash model

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GOOGLE_GEMINI_API_KEY is not configured.');
      throw new Error('Gemini API key configuration is missing.');
    }
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log(`Gemini client initialized for model: ${this.modelId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  private buildPrompt(transcript: string): string {
    return `Analyze the following doctor-patient conversation transcript and extract the specified details in JSON format. Only include the requested fields. If a field cannot be determined, omit it or use an empty array/string.

Transcript:
"""
${transcript}
"""

Desired JSON Output Structure:
{
  "prescribedMedicines": ["string"],
  "diagnosis": "string",
  "symptoms": ["string"],
  "importantPoints": ["string"]
}

Extract the information and provide ONLY the JSON object:
`;
  }

  async extractDetailsFromTranscript(
    transcript: string,
    profileId: string,
  ): Promise<StructuredRecordingDetails | null> {
    this.logger.log(
      `Starting Gemini analysis for transcript (length: ${transcript.length}) for profile ${profileId}...`,
    );

    const model = this.genAI.getGenerativeModel({ model: this.modelId });

    const generationConfig: GenerationConfig = {
      // Ensure JSON output if model supports it, otherwise rely on prompt structure
      // responseMimeType: "application/json", // Uncomment if using a model version supporting JSON mode
      temperature: 0.2, // Lower temperature for more deterministic extraction
      maxOutputTokens: 1024,
    };

    // Basic safety settings - adjust as needed
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    const request: GenerateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: this.buildPrompt(transcript) }] }],
      generationConfig,
      safetySettings,
    };

    try {
      this.logger.debug('Sending request to Gemini...');
      const result = await model.generateContent(request);
      const response = result.response;

      if (!response) {
          this.logger.error('Gemini analysis failed: No response received.');
          return null;
      }

      const responseText = response.text(); // Get the text content
      this.logger.debug(`Gemini raw response text: ${responseText}`);

      // Attempt to parse the JSON from the response text
      try {
        // Find the JSON block (robustness depends on model adhering to prompt)
        const jsonMatch = responseText.match(/\{.*?\}/s);
        if (!jsonMatch || !jsonMatch[0]) {
             this.logger.error('Gemini analysis failed: Could not find JSON block in response.', responseText);
             return null;
        }

        const structuredData: StructuredRecordingDetails = JSON.parse(jsonMatch[0]);
        this.logger.log('Gemini analysis successful.');
        this.logger.debug('Extracted structured data:', structuredData);
        return structuredData;
      } catch (parseError) {
        this.logger.error(
          'Gemini analysis failed: Could not parse JSON from response.',
          parseError,
          `Raw Text: ${responseText}`
        );
        return null;
      }
    } catch (error) {
      this.logger.error('Gemini analysis failed:', error.message || error, error.stack);
      // Log specific Google AI errors if available
      if (error.response && error.response.promptFeedback) {
           this.logger.error('Gemini Prompt Feedback:', error.response.promptFeedback);
      }
      return null;
    }
  }
} 