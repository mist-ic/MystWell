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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule global
      envFilePath: '.env',
    }),
    // Configure BullMQ connection globally
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          // password: configService.get<string>('REDIS_PASSWORD'), // Uncomment if needed
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
