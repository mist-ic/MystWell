import { Injectable, Logger } from '@nestjs/common';
import { SpeechClient } from '@google-cloud/speech';
import { protos } from '@google-cloud/speech'; // Import protos for types if needed
import { ConfigService } from '@nestjs/config'; // Assuming usage of ConfigModule for credentials
import { Buffer } from 'buffer'; // Import Buffer

// Define the expected type for the V2 recognize response
type RecognizeResponseV2 = protos.google.cloud.speech.v2.IRecognizeResponse;
// Define the expected type for the V2 recognize request
type RecognizeRequestV2 = protos.google.cloud.speech.v2.IRecognizeRequest;

@Injectable()
export class SpeechToTextService {
  private readonly logger = new Logger(SpeechToTextService.name);
  private speechClient: SpeechClient;

  constructor(private configService: ConfigService) {
    try {
      const credentialsJson = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS_JSON');
      let clientOptions = {};

      if (credentialsJson) {
        try {
          const credentials = JSON.parse(credentialsJson);
          clientOptions = { credentials };
          this.logger.log('Initializing SpeechClient using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON env var.');
        } catch (parseError) {
          this.logger.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON. Falling back to default credential discovery.', parseError);
          // If parsing fails, clientOptions remains empty, relying on default discovery
        }
      } else {
        this.logger.log('GOOGLE_APPLICATION_CREDENTIALS_JSON not found. Using default SpeechClient credential discovery (e.g., GOOGLE_APPLICATION_CREDENTIALS file path or instance metadata).');
      }

      // Initialize client with parsed credentials if available, otherwise empty options for default discovery
      this.speechClient = new SpeechClient(clientOptions);
      this.logger.log('SpeechClient initialized successfully.'); // Simplified success log

    } catch (error) {
      this.logger.error('Failed to initialize SpeechClient:', error);
      throw error;
    }
  }

  async transcribeAudio(
    audioBytes: Buffer, // Accept Buffer instead of URI string
    profileId: string, // <-- Add profileId parameter
  ): Promise<string | null> {
    this.logger.log(
      `Starting V2 transcription for profile ${profileId}, audio buffer (${audioBytes.length} bytes)` // <-- Update log
    );

    // Define the full configuration explicitly
    // Use 'any' type due to library expecting V1 types in recognize() signature
    const request: any = {
      // recognizer: recognizerName, // Ensure recognizer field is removed or commented out
      config: { 
        // Specify model and language explicitly
        model: 'chirp_2',
        // Use languageCodes (plural array) as expected by V2 config type
        languageCodes: ["en-US"],
        // Use auto decoding to handle different client formats (WAV, WEBM)
        autoDecodingConfig: {},
        // Specify required features
        features: {
          enableWordConfidence: true,
          // Defaults for others are false, but explicitly setting for clarity
          enableAutomaticPunctuation: false, 
          enableSpokenPunctuation: false,    
          profanityFilter: false,            
        },
      },
      audio: {
        content: audioBytes.toString('base64')
      },
    };

    try {
      // Log the relevant parts of the config being used
      this.logger.debug(`Sending V2 transcription request with model: ${request.config?.model}, language: ${request.config?.languageCodes?.join(', ')}, autoDecoding: true ...`);

      // Still cast response to V2 type
      const [response] = await this.speechClient.recognize(request) as [RecognizeResponseV2, any, any];

      this.logger.debug('Received V2 transcription response');

      if (response.results && response.results.length > 0) {
        const transcription = response.results
          .map(result => result.alternatives?.[0]?.transcript)
          .filter(Boolean)
          .join('\n');

        if (transcription) {
            this.logger.log(`V2 Transcription successful from audio content.`);
            this.logger.debug(`Raw Transcript: ${transcription.substring(0, 100)}...`);
            return transcription;
        } else {
            this.logger.warn(`No valid transcript found in V2 results from audio content.`);
            return null;
        }
      } else {
        this.logger.warn(`No V2 transcription results array from audio content.`);
        return null;
      }
    } catch (error) {
      this.logger.error(
        `V2 Transcription failed for audio content:`, 
        error.message || error,
        error.stack
      );
      if (error.code) {
        this.logger.error(`Google Cloud Error Code: ${error.code} (${error.details})`);
      }
      return null;
    }
  }
} 