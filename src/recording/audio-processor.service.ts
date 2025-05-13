import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AudioProcessorService implements OnModuleInit {
  private readonly logger = new Logger(AudioProcessorService.name);
  private ffmpegAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Try to set custom FFmpeg paths if they're configured
      const ffmpegPath = this.configService.get<string>('FFMPEG_PATH');
      const ffprobePath = this.configService.get<string>('FFPROBE_PATH');
      
      if (ffmpegPath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        this.logger.log(`Custom FFmpeg path set: ${ffmpegPath}`);
      }
      
      if (ffprobePath) {
        ffmpeg.setFfprobePath(ffprobePath);
        this.logger.log(`Custom FFprobe path set: ${ffprobePath}`);
      }
      
      // Verify that FFmpeg is available
      await new Promise<void>((resolve, reject) => {
        ffmpeg.getAvailableFormats((err, formats) => {
          if (err) {
            this.logger.error('FFmpeg not available:', err.message);
            this.ffmpegAvailable = false;
            resolve(); // Continue without FFmpeg
          } else {
            this.ffmpegAvailable = true;
            this.logger.log('FFmpeg is available and properly configured');
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Error initializing FFmpeg:', error);
      this.ffmpegAvailable = false;
    }
  }

  /**
   * Converts audio buffer to WAV format suitable for Google Speech-to-Text
   * @param audioBuffer Input audio buffer
   * @param inputFormat Input format (e.g., 'm4a', 'mp3')
   * @returns Promise<Buffer> WAV format audio buffer
   */
  async convertToWav(audioBuffer: Buffer, inputFormat: string): Promise<Buffer> {
    this.logger.log(`Converting ${inputFormat} audio to WAV format`);

    if (!this.ffmpegAvailable) {
      throw new Error('FFmpeg is not available. Audio conversion is not possible.');
    }

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
   * Detects the audio format from the buffer by writing it to a temporary file
   * @param audioBuffer Input audio buffer
   * @returns Promise<string> Detected format
   */
  async detectFormat(audioBuffer: Buffer): Promise<string> {
    if (!this.ffmpegAvailable) {
      throw new Error('FFmpeg is not available. Format detection is not possible.');
    }

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `temp-${uuidv4()}`);

    try {
      // Write buffer to temporary file
      await fs.writeFile(tempFile, audioBuffer);

      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(tempFile, (err, metadata) => {
          // Clean up temp file
          fs.unlink(tempFile).catch(e => 
            this.logger.warn(`Failed to delete temp file ${tempFile}:`, e)
          );

          if (err) {
            this.logger.error('Error detecting format:', err);
            reject(err);
            return;
          }

          const format = metadata?.format?.format_name;
          if (!format) {
            reject(new Error('Could not detect audio format'));
            return;
          }

          this.logger.log(`Detected audio format: ${format}`);
          resolve(format.split(',')[0]); // Take first format if multiple are detected
        });
      });
    } catch (error) {
      // Clean up temp file in case of error
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  /**
   * Performs a simple check to make sure FFmpeg is available
   * @returns boolean indicating if FFmpeg is available
   */
  isFFmpegAvailable(): boolean {
    return this.ffmpegAvailable;
  }
} 