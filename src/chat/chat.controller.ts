import {
  Controller,
  // Post, // Removed
  // Body, // Removed
  // UsePipes, // Removed
  // ValidationPipe, // Removed
  // UseGuards, // Removed
  // Req, // Removed
  Logger,
  // HttpException, // Removed
  // HttpStatus, // Removed
} from '@nestjs/common';
// import { ChatService } from './chat.service'; // Service is used by Gateway now
// import { SendMessageDto } from './dto/send-message.dto'; // DTO not needed
// import { AuthGuard } from '../auth/auth.guard'; // Guard applied at Gateway level
// import { Request } from 'express'; // Request type not needed
// import { User } from '@supabase/supabase-js'; // User type not needed here

// Interface not needed
// interface AuthenticatedRequest extends Request {
//   user?: User;
// }

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  // Remove constructor injection if ChatService isn't needed here anymore
  // constructor(private readonly chatService: ChatService) {}
  constructor() {
      this.logger.log('ChatController initialized (HTTP endpoint removed, use WebSocket Gateway).');
  }

  // Remove the sendMessage method entirely
  /*
  @UseGuards(AuthGuard) 
  @Post('send')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendMessage(
    @Req() req: AuthenticatedRequest, 
    @Body() sendMessageDto: SendMessageDto,
  ): Promise<{ reply: string }> {
    const userId = req.user?.id;
    if (!userId) {
      this.logger.error('User ID not found in authenticated request.');
      throw new HttpException('Authentication error', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(`User ${userId} sending message: ${sendMessageDto.message}`);

    try {
      const reply = await this.chatService.sendMessage(
        userId, 
        sendMessageDto.message,
      );
      return { reply };
    } catch (error) {
      this.logger.error(
        `Error handling chat message for user ${userId}:`,
        error.message || error,
      );
      throw new HttpException(
        'Failed to get chat response',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  */
} 