import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { UserSummaryModule } from '../user-summary/user-summary.module';

@Module({
  imports: [SupabaseModule, UserSummaryModule],
  providers: [ProfileService],
  exports: [ProfileService], // Export ProfileService so AuthModule can use it
})
export class ProfileModule {} 