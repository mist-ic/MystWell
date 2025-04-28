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
          port: configService.get<number>('REDIS_PORT', 6379),
          showFriendlyErrorStack: true,
          keepAlive: 60000,
          noDelay: true,
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
  ],
})
export class RecordingModule {} 