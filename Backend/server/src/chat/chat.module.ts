import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule if needed for API keys
import { AuthModule } from '../auth/auth.module'; // Import AuthModule for AuthGuard
import { SupabaseModule } from '../supabase/supabase.module'; // Import SupabaseModule

@Module({
  imports: [
    ConfigModule, // Make sure ConfigService is available
    AuthModule, // To use AuthGuard in controller
    SupabaseModule, // Import SupabaseModule here to provide SupabaseClient and SupabaseService
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {} 