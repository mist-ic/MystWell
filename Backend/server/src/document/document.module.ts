import { Module, Scope } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentProcessor } from './document.processor';
import { BullModule } from '@nestjs/bullmq';
import { DOCUMENT_PROCESSING_QUEUE, SUPABASE_REQUEST_CLIENT } from './document.constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { SUPABASE_SERVICE_ROLE_CLIENT, SupabaseModule } from '../supabase/supabase.module'; // Import the service role client token and the module
import { ProfileModule } from '../profile/profile.module'; // Import ProfileModule

// Define a token for the request-scoped client
// export const SUPABASE_REQUEST_CLIENT = 'SUPABASE_REQUEST_CLIENT'; // Remove this line as we now import from constants

@Module({
  imports: [
    ConfigModule, // Import ConfigModule to access ConfigService
    SupabaseModule, // Import SupabaseModule explicitly to ensure providers are available
    ProfileModule, // Import ProfileModule to access ProfileService
    BullModule.registerQueue({
      name: DOCUMENT_PROCESSING_QUEUE,
    }),
  ],
  controllers: [DocumentController],
  providers: [
    {
      provide: SUPABASE_REQUEST_CLIENT,
      scope: Scope.REQUEST, // Set scope to Request
      useFactory: (request: Request, configService: ConfigService): SupabaseClient => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = configService.get<string>('SUPABASE_ANON_KEY');
        const authHeader = request.headers.authorization;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase URL and Anon Key must be configured');
        }

        let jwt: string | undefined;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          jwt = authHeader.substring(7); // Extract JWT from Authorization header
        }

        // Create a new client instance for this specific request
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            ...(jwt && { // Conditionally add header if JWT exists
              headers: { Authorization: `Bearer ${jwt}` },
            })
          },
        });
      },
      inject: [REQUEST, ConfigService], // Inject the incoming request and ConfigService
    },
    DocumentService,
    DocumentProcessor,
  ],
  // Export the service if needed by other modules
  exports: [DocumentService]
})
export class DocumentModule {} 