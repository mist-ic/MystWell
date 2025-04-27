import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Req,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthGuard } from '../auth/auth.guard'; // Assuming AuthGuard is in ../auth
import { Request } from 'express'; // Import Request type
import { User } from '@supabase/supabase-js'; // Import Supabase User type

// Use the augmented Request type from AuthGuard (if globally declared)
// Or define it locally if not global
interface AuthenticatedRequest extends Request {
  user?: User; // Use the actual Supabase User type
}

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard) // Protect this endpoint
  @Post('send')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendMessage(
    @Req() req: AuthenticatedRequest, // Use the authenticated request type
    @Body() sendMessageDto: SendMessageDto,
  ): Promise<{ reply: string }> {
    
    // Use the authenticated user's ID as the session identifier
    // This ensures chat history is tied to the logged-in user
    const userId = req.user?.id;
    if (!userId) {
      this.logger.error('User ID not found in authenticated request.');
      // This shouldn't happen if AuthGuard is working correctly
      throw new HttpException('Authentication error', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(`User ${userId} sending message: ${sendMessageDto.message}`);

    try {
      const reply = await this.chatService.sendMessage(
        userId, // Use userId as sessionId
        sendMessageDto.message,
      );
      return { reply };
    } catch (error) {
      this.logger.error(
        `Error handling chat message for user ${userId}:`,
        error.message || error,
      );
      // Return a generic error response to the client
      throw new HttpException(
        'Failed to get chat response',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 