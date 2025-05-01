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

    const recognizerName = this.configService.get<string>(
      'GOOGLE_SPEECH_RECOGNIZER_NAME',
    );

    if (!recognizerName) {
      this.logger.error('GOOGLE_SPEECH_RECOGNIZER_NAME environment variable is not configured.');
      throw new Error('Speech recognizer name configuration is missing.');
    }

    // Using a generic request structure with type assertion
    // This avoids TypeScript errors while still providing the correct structure for the API
    const request = {
      recognizer: recognizerName,
      config: {
        autoDecodingConfig: {}, // Let Google auto-detect the encoding
        // explicitDecodingConfig: {
        //   encoding: 'LINEAR16', // Most common for WAV files
        //   sampleRateHertz: 16000, // Optimal for human speech (reduced from 44100)
        //   audioChannelCount: 1, // Mono is perfect for voice
        // },
        // Speech-specific optimizations
        features: {
          enableAutomaticPunctuation: false,  // Set to false per recognizer config
          enableSpokenPunctuation: false,     // Set to false per recognizer config
          enableWordConfidence: true,         // Set to true per recognizer config
          profanityFilter: false,             // Matches recognizer config
        },
        // Optimize for human conversation
        useEnhanced: true,                    // Use enhanced models if available
        model: 'chirp_2',                     // Using the Chirp-2 model as configured
        languageCode: "en-US",                // Using single language code format for V2 API
        adaptation: {
          phraseSetReferences: [],            // Can be used later for custom vocabulary
        },
      },
      audio: {
        content: audioBytes.toString('base64')
      },
    } as any; // Use type assertion to bypass TypeScript checking

    try {
      this.logger.debug('Sending V2 transcription request with audio content...');

      // Use any type to work with V2 API that might not fully match TypeScript definitions
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