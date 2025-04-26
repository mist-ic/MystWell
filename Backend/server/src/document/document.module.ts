import { Module, Scope } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentProcessor } from './document.processor';
import { BullModule } from '@nestjs/bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from './constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module'; // Import service role client token

// Define a new injection token for the request-scoped client
export const SUPABASE_REQUEST_CLIENT = 'SUPABASE_REQUEST_CLIENT';

@Module({
  imports: [
    ConfigModule, // Import ConfigModule to access ConfigService
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
        // Initialize with global auth options if a JWT is present
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            ...(jwt && { // Conditionally add global option if JWT exists
              headers: { Authorization: `Bearer ${jwt}` },
            })
          },
          // Add global options if needed, e.g., to pass JWT to Functions
          // global: {
          //   ...(jwt && { headers: { Authorization: `Bearer ${jwt}` } })
          // }
        });
      },
      inject: [REQUEST, ConfigService], // Inject the incoming request and ConfigService
    },
    // Provide the DocumentService and Processor as usual
    DocumentService,
    DocumentProcessor,
    // Inject the global Service Role client for the Processor
    // We need a way to inject SUPABASE_SERVICE_ROLE_CLIENT here
    // Since SupabaseModule is Global, its exports *should* be available, 
    // but explicit injection into the processor's dependencies might be needed.
  ],
  // Export the service if needed by other modules (optional)
  // exports: [DocumentService]
})
export class DocumentModule {} 