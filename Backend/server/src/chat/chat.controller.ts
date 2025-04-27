import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { SendMessageDto } from './dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a message to the Mist chatbot' })
  async sendMessage(@Req() req, @Body() sendMessageDto: SendMessageDto) {
    const userId = req.user?.id || req.user?.sub; // Get user ID from AuthGuard
    if (!userId) {
      this.logger.error('User ID not found on request after AuthGuard');
      throw new BadRequestException('Authentication error: User ID not found');
    }

    this.logger.log(`sendMessage called by user: ${userId}`);
    const { message, history } = sendMessageDto;

    // Basic input validation
    if (!message || message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (!Array.isArray(history)) {
      throw new BadRequestException('History must be an array');
    }

    try {
      const response = await this.chatService.sendMessage(
        userId,
        message,
        history,
      );
      return { response }; // Return the response in a consistent format
    } catch (error) {
      this.logger.error(`Error in sendMessage for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(error.message || 'Failed to process chat message');
    }
  }
} 