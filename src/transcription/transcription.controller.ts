import { Controller, Get, Param, UseGuards, Request, HttpException, HttpStatus, Query } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProfileGuard } from '../auth/profile.guard';

@ApiTags('transcriptions')
@Controller('transcriptions')
@UseGuards(AuthGuard('jwt'), ProfileGuard)
@ApiBearerAuth()
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'List all transcriptions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns a list of transcriptions for the user' })
  async listTranscriptions(@Request() req, @Query('limit') limit: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 10;
      return await this.transcriptionService.listTranscriptions(req.user.profileId, limitNum);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to list transcriptions',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific transcription by ID' })
  @ApiResponse({ status: 200, description: 'Returns the transcription details' })
  @ApiResponse({ status: 404, description: 'Transcription not found' })
  async getTranscription(@Request() req, @Param('id') id: string) {
    try {
      const transcription = await this.transcriptionService.getTranscriptionContent(id);
      if (!transcription) {
        throw new HttpException('Transcription not found', HttpStatus.NOT_FOUND);
      }
      return transcription;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get transcription',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 