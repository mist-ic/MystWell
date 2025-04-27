import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SUPABASE_CLIENT, SUPABASE_SERVICE_ROLE_CLIENT } from './supabase.constants';

@Global() // Make Supabase client available globally
@Module({
  imports: [ConfigModule], // Ensure ConfigModule is imported
  providers: [
    // Provider for the standard client (Anon Key)
    {
      provide: SUPABASE_CLIENT,
      useFactory: (configService: ConfigService): SupabaseClient => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = configService.get<string>('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase URL and Anon Key must be configured in .env');
        }

        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            // Configure storage options if needed, otherwise defaults work
            // We are letting the frontend handle persistence
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
      },
      inject: [ConfigService],
    },
    // Provider for the Service Role client
    {
        provide: SUPABASE_SERVICE_ROLE_CLIENT,
        useFactory: (configService: ConfigService): SupabaseClient => {
            const supabaseUrl = configService.get<string>('SUPABASE_URL');
            const supabaseServiceKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

            if (!supabaseUrl || !supabaseServiceKey) {
                throw new Error('Supabase URL and Service Role Key must be configured in .env');
            }

            // Create a separate client instance authenticated with the service role key
            return createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                    // Service role client doesn't persist sessions in the same way
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });
        },
        inject: [ConfigService],
    },
    // Add SupabaseService as a provider
    SupabaseService,
  ],
  // Export clients AND the service
  exports: [
    SUPABASE_CLIENT,
    SUPABASE_SERVICE_ROLE_CLIENT,
    SupabaseService,
  ],
})
export class SupabaseModule {} 