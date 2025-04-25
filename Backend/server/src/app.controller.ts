import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service';
import { AuthGuard } from './auth/auth.guard';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Admin endpoint to apply the RLS policy fix for recordings
   * This should be secured or removed after use in production
   */
  @Post('admin/fix-recording-policies')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard) // Add basic protection to prevent random access
  async fixRecordingPolicies(): Promise<{ message: string }> {
    await this.supabaseService.runMigration('fix-recording-policies');
    return { message: 'Recording policies have been updated. Please try accessing your recordings now using the standard client.' };
  }
}
