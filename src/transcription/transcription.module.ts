import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { TranscriptionController } from './transcription.controller';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingModule } from '../embedding/embedding.module';
import { StorageModule } from '../storage/storage.module';
import { UserSummaryModule } from '../user-summary/user-summary.module';

@Module({
  imports: [
    ConfigModule,
    EmbeddingModule,
    StorageModule,
    UserSummaryModule
  ],
  controllers: [TranscriptionController],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {} 