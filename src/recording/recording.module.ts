import { Module } from '@nestjs/common';
import { RecordingController } from './recording.controller';
import { RecordingService } from './recording.service';
import { ProfileModule } from '../profile/profile.module'; // Assuming ProfileModule exists
import { ConfigModule, ConfigService } from '@nestjs/config'; // Import ConfigModule and ConfigService
import { SpeechToTextService } from './speech-to-text.service'; // Import new service
import { GeminiAnalysisService } from './gemini-analysis.service'; // Import new service
import { BullModule } from '@nestjs/bullmq'; // Import BullModule
import { RECORDING_PROCESSING_QUEUE } from './constants'; // Assume constants file exists/will be created
import { RecordingProcessor } from './recording.processor'; // Import the processor
import { HttpModule } from '@nestjs/axios'; // Import HttpModule
import { SupabaseModule } from '../supabase/supabase.module'; // Import SupabaseModule
import { AudioProcessorService } from './audio-processor.service';

@Module({
  imports: [
    ProfileModule, // Import ProfileModule if needed for profile ID resolution
    ConfigModule, // Make ConfigService available
    HttpModule, // Add HttpModule here
    BullModule.registerQueueAsync({
      name: RECORDING_PROCESSING_QUEUE,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6380),
          password: configService.get<string>('REDIS_PASSWORD'),
          tls: {},
          showFriendlyErrorStack: true,
          keepAlive: 60000,
          noDelay: true,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 15000, // 15 seconds initial delay
          },
          removeOnComplete: true,
          removeOnFail: 1000, // Keep last 1000 failed jobs
        },
      }),
      inject: [ConfigService],
    }),
    SupabaseModule, // Import SupabaseModule to use the client
  ],
  controllers: [RecordingController],
  providers: [
    RecordingService,
    SpeechToTextService, // Add new service
    GeminiAnalysisService, // Add new service
    RecordingProcessor, // Add the processor
    AudioProcessorService,
  ],
  exports: [RecordingService],
})
export class RecordingModule {} 