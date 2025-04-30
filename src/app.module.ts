import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { RecordingModule } from './recording/recording.module';
import { AuthModule } from './auth/auth.module';
import { MigrationModule } from './supabase/migration.module';
import { BullModule } from '@nestjs/bullmq';
import { PrescriptionModule } from './prescription/prescription.module';
import { ProfileModule } from './profile/profile.module';
import { DocumentModule } from './document/document.module';
import { ChatModule } from './chat/chat.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule global
      envFilePath: '.env',
    }),
    // Configure Throttler (Rate Limiting)
    ThrottlerModule.forRoot([{
      ttl: 60000, // Time-to-live: 60 seconds (in milliseconds)
      limit: 100, // Limit: 100 requests per ttl per IP
    }]),
    // Configure BullMQ connection globally
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6380),
          password: configService.get<string>('REDIS_PASSWORD'),
          tls: {}, // Enable TLS for Azure Redis
          showFriendlyErrorStack: true,
          keepAlive: 60000,
          noDelay: true,
        },
      }),
      inject: [ConfigService],
    }),
    SupabaseModule, // Import SupabaseModule
    MigrationModule, // Import MigrationModule
    RecordingModule, // Import RecordingModule
    AuthModule,
    PrescriptionModule,
    ProfileModule,
    DocumentModule,
    ChatModule,
    RemindersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply ThrottlerGuard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
