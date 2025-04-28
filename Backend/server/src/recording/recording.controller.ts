import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Inject, Query, HttpCode, HttpStatus, ParseUUIDPipe, Logger } from '@nestjs/common';
import { RecordingService, Recording } from './recording.service';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js'; // Import User type
import { IsString, IsNumber, IsOptional } from 'class-validator'; // Import decorators

// DTOs for request body validation (optional but recommended)
class UpdateStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsNumber()
  duration?: number; // Add optional duration

  @IsOptional()
  @IsString()
  error?: string;
}

class UpdateTitleDto {
    title: string;
}

@Controller('recordings')
@UseGuards(AuthGuard) // Protect all routes in this controller
export class RecordingController {
  private readonly logger = new Logger(RecordingController.name);

  constructor(private readonly recordingService: RecordingService) {}

  private getUserIdFromRequest(req: Request): string {
      const user = req.user as User; // AuthGuard attaches user
      if (!user?.id) {
          // This should not happen if AuthGuard is working correctly
          throw new Error('User ID not found on request after AuthGuard.');
      }
      return user.id;
  }

  /**
   * Gets recordings for the authenticated user's current profile.
   */
  @Get()
  async getRecordings(@Req() req: Request): Promise<Recording[]> {
    const userId = this.getUserIdFromRequest(req);
    return this.recordingService.getRecordings(userId);
  }

  /**
   * Gets a specific recording by ID for the authenticated user.
   */
  @Get(':id')
  async getRecordingById(
      @Param('id', ParseUUIDPipe) id: string, 
      @Req() req: Request
    ): Promise<Recording> {
    const userId = this.getUserIdFromRequest(req);
    // Delegate fetching and ownership check to the service
    return this.recordingService.getRecordingById(userId, id); 
  }

  /**
   * Gets a signed URL for uploading a new recording file.
   * Creates the initial recording metadata entry.
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.OK) // Explicitly set OK status for POST
  async getUploadUrl(@Req() req: Request): Promise<{ uploadUrl: string; storagePath: string; recordingId: string }> {
    const userId = this.getUserIdFromRequest(req);
    return this.recordingService.getUploadUrl(userId);
  }

  /**
   * Updates the status of a recording (e.g., after upload completion or failure).
   * Also updates duration if provided.
   */
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
      @Param('id', ParseUUIDPipe) id: string, 
      @Body() body: UpdateStatusDto,
      @Req() req: Request 
    ): Promise<Recording> {
     this.logger.log(`[updateStatus] Received request for ID: ${id}, Body: ${JSON.stringify(body)}`); 
     const userId = this.getUserIdFromRequest(req);
     // Pass userId for potential ownership check within the service method
     // Pass status, error, and optional duration
     return this.recordingService.updateRecordingStatus(userId, id, body.status, body.error, body.duration); 
  }

  /**
   * Gets a signed URL for playing back a specific recording.
   */
  @Get(':id/playback-url')
  async getPlaybackUrl(
      @Param('id', ParseUUIDPipe) id: string, 
      @Req() req: Request
    ): Promise<{ playbackUrl: string }> {
    const userId = this.getUserIdFromRequest(req);
    return this.recordingService.getPlaybackUrl(userId, id);
  }

  // --- PUT Endpoints ---
  @Put(':id') // Endpoint to update recording details (e.g., title)
  async updateRecording(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: UpdateTitleDto, // Use a DTO for update payload
      @Req() req: Request
    ): Promise<Recording> {
      const userId = this.getUserIdFromRequest(req);
      return this.recordingService.updateRecordingTitle(userId, id, body.title);
  }

  // --- DELETE Endpoints ---
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // Standard practice for DELETE success
  async deleteRecording(
      @Param('id', ParseUUIDPipe) id: string,
      @Req() req: Request
    ): Promise<void> {
      const userId = this.getUserIdFromRequest(req);
      await this.recordingService.deleteRecording(userId, id);
      // No content returned on successful deletion
  }

  /**
   * Retry transcription for a recording that previously failed
   */
  @Post(':id/retry-transcription')
  @HttpCode(HttpStatus.OK)
  async retryTranscription(
      @Param('id', ParseUUIDPipe) id: string,
      @Req() req: Request
    ): Promise<Recording> {
      const userId = this.getUserIdFromRequest(req);
      return this.recordingService.retryTranscription(userId, id);
  }
} 