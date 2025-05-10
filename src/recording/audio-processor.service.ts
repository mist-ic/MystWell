import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { Buffer } from 'buffer';

@Injectable()
export class AudioProcessorService {
  private readonly logger = new Logger(AudioProcessorService.name);

  /**
   * Converts audio buffer to WAV format suitable for Google Speech-to-Text
   * @param audioBuffer Input audio buffer
   * @param inputFormat Input format (e.g., 'm4a', 'mp3')
   * @returns Promise<Buffer> WAV format audio buffer
   */
  async convertToWav(audioBuffer: Buffer, inputFormat: string): Promise<Buffer> {
    this.logger.log(`Converting ${inputFormat} audio to WAV format`);

    return new Promise((resolve, reject) => {
      // Create a readable stream from the buffer
      const inputStream = new Readable();
      inputStream.push(audioBuffer);
      inputStream.push(null);

      // Create a buffer to store the output
      const chunks: Buffer[] = [];

      // Set up ffmpeg command
      const command = ffmpeg(inputStream)
        .toFormat('wav')
        .audioChannels(1) // Mono
        .audioFrequency(16000) // 16kHz
        .audioBitrate('128k')
        // Use signed 16-bit little-endian PCM
        .outputOptions(['-acodec', 'pcm_s16le']);

      // Handle the output stream
      command.pipe()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on('end', () => {
          const outputBuffer = Buffer.concat(chunks);
          this.logger.log(`Conversion complete. Output size: ${outputBuffer.length} bytes`);
          resolve(outputBuffer);
        })
        .on('error', (err) => {
          this.logger.error('Error during audio conversion:', err);
          reject(err);
        });

      // Handle ffmpeg errors
      command.on('error', (err) => {
        this.logger.error('FFmpeg error:', err);
        reject(err);
      });
    });
  }

  /**
   * Detects the audio format from the buffer
   * @param audioBuffer Input audio buffer
   * @returns Promise<string> Detected format
   */
  async detectFormat(audioBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(audioBuffer);
      inputStream.push(null);

      ffmpeg.ffprobe(inputStream, (err, metadata) => {
        if (err) {
          this.logger.error('Error detecting format:', err);
          reject(err);
          return;
        }

        const format = metadata.format.format_name;
        this.logger.log(`Detected audio format: ${format}`);
        resolve(format.split(',')[0]); // Take first format if multiple are detected
      });
    });
  }
} 