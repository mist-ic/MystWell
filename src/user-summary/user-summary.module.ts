import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserSummaryService } from './user-summary.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    EmbeddingModule,
  ],
  providers: [UserSummaryService],
  exports: [UserSummaryService],
})
export class UserSummaryModule {} 