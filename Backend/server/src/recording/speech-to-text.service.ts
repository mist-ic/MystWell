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
    // TODO: Securely fetch credentials - using file path for now
    // Ensure the GOOGLE_APPLICATION_CREDENTIALS env var is set
    // or provide credentials explicitly.
    // Example using env var:
    // If GOOGLE_APPLICATION_CREDENTIALS is set, client automatically uses it.
    // If not set, you might load from ConfigService:
    // const keyFilename = this.configService.get<string>('GOOGLE_APP_CREDS_PATH');
    try {
      // Attempt to explicitly use V2 if the library supports versioning in constructor
      this.speechClient = new SpeechClient({
        // No explicit version option seems standard, rely on correct protos/methods
        // Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly.
      });
      this.logger.log('SpeechClient initialized (ensure GOOGLE_APPLICATION_CREDENTIALS points to a key with V2 API enabled).');
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

    // Construct the request using the audio content (bytes)
    // The client library should handle Base64 encoding if needed when sending binary data.
    const request = {
      recognizer: recognizerName,
      config: {
        languageCode: 'en-US', // Add explicit language code
        // features: {
        //   // Add features as needed
        // },
        // Auto-detection should still work if Recognizer doesn't specify encoding
        // autoDecodingConfig: {},
      },
      // Place the audio content within an `audio` object
      audio: {
        content: audioBytes, 
      }
    } as any; // Still using `as any` to bypass potential library type issues

    try {
      this.logger.debug('Sending V2 transcription request with audio content...');

      const [response] = await this.speechClient.recognize(request as any) as [RecognizeResponseV2, any, any];

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