import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { ChatGateway } from './chat.gateway';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    DocumentModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {} 