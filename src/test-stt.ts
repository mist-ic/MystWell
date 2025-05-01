import * as dotenv from 'dotenv';
import * as path from 'path';

// Construct the path to the .env file in the parent directory (FinalMistBacky)
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module'; // Assuming your main module is AppModule
import { SpeechToTextService } from './recording/speech-to-text.service';
import * as fs from 'fs';
import { INestApplicationContext } from '@nestjs/common';

async function testTranscription() {
  let app: INestApplicationContext | null = null;
  try {
    // Get file path from command line arguments
    const filePathArg = process.argv[2];
    if (!filePathArg) {
      console.error('Usage: ts-node src/test-stt.ts <path_to_audio_file>');
      process.exit(1);
    }

    const audioFilePath = path.resolve(filePathArg); // Resolve to absolute path

    if (!fs.existsSync(audioFilePath)) {
      console.error(`Error: Audio file not found at ${audioFilePath}`);
      process.exit(1);
    }

    console.log(`Attempting to transcribe: ${audioFilePath}`);

    // --- Start: Added Credential Test ---
    console.log('Testing credential file read and parse...');
    const credentialsPathFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPathFromEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS env var is not set!');
    }
    // Resolve path relative to the script's directory parent (FinalMistBacky)
    const absoluteCredentialsPath = path.resolve(__dirname, '..', credentialsPathFromEnv);
    console.log(`Attempting to read credentials from: ${absoluteCredentialsPath}`);
    if (!fs.existsSync(absoluteCredentialsPath)) {
      throw new Error(`Credential file not found at: ${absoluteCredentialsPath}`);
    }
    
    // Read as buffer first for debugging
    const credentialsFileBuffer = fs.readFileSync(absoluteCredentialsPath);
    console.log(`Credential file buffer length: ${credentialsFileBuffer.length}`);
    if (credentialsFileBuffer.length === 0) {
        throw new Error('Credential file appears to be empty!');
    }
    console.log(`Credential file buffer starts with bytes: ${credentialsFileBuffer.slice(0, 10).toString('hex')}`); // Log first 10 bytes as hex

    // Now try converting to string and parsing
    const credentialsFileContent = credentialsFileBuffer.toString('utf-8');
    console.log(`Credential file content starts with: ${credentialsFileContent.substring(0, 100)}...`);

    try {
      JSON.parse(credentialsFileContent);
      console.log('Credential file successfully parsed as JSON.');
    } catch (parseError: any) {
      console.error(`Failed to parse credential file content as JSON: ${parseError.message}`);
      // Log again in case conversion caused issues
      console.error(`String content for parsing started with: ${credentialsFileContent.substring(0, 100)}...`); 
      throw parseError; // Re-throw the parsing error
    }
    // --- End: Added Credential Test ---

    // Bootstrap the NestJS application context to access services
    // This ensures ConfigService and other dependencies are properly injected
    app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'], // Enable detailed logging from Nest
    });
    
    // Get the SpeechToTextService instance
    const speechService = app.get(SpeechToTextService);

    // Read the audio file into a buffer
    const audioBytes = fs.readFileSync(audioFilePath);

    // Call the transcription service
    const dummyProfileId = 'test-profile-id';
    const transcription = await speechService.transcribeAudio(audioBytes, dummyProfileId);

    // Print the result
    if (transcription) {
      console.log('\n--- Transcription Result ---');
      console.log(transcription);
      console.log('--------------------------\n');
    } else {
      console.warn('\n--- Transcription failed or returned empty ---');
    }
  } catch (error: any) {
    console.error('\n--- Test Script Error ---');
    console.error(error.message);
    if (error.stack) {
        console.error(error.stack);
    }
    console.error('-----------------------\n');
    process.exitCode = 1; // Indicate failure
  } finally {
    if (app) {
      await app.close(); // Properly close the NestJS context
    }
  }
}

testTranscription(); 