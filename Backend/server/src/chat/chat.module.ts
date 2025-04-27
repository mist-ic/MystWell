import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // Import ConfigModule to access environment variables
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {} 