import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from './supabase.constants';
import * as fs from 'fs';
import * as path from 'path';
import { PostgrestError } from '@supabase/postgrest-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT)
    private supabaseServiceRoleClient: SupabaseClient,
  ) {}

  /**
   * Returns the Supabase client with service role privileges.
   * Use with caution, as this bypasses RLS.
   */
  getServiceClient(): SupabaseClient {
    return this.supabaseServiceRoleClient;
  }

  /**
   * Run a SQL migration file using the service role client
   * @param migrationName The name of the migration file without extension (located in src/supabase/migrations)
   */
  async runMigration(migrationName: string): Promise<void> {
    try {
      console.log(`[SupabaseService] Running migration: ${migrationName}`);
      const migrationPath = path.join(__dirname, 'migrations', `${migrationName}.sql`);
      
      if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }
      
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`[SupabaseService] SQL migration loaded: ${migrationPath}`);
      
      const { error } = await this.supabaseServiceRoleClient.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`[SupabaseService] Error running migration ${migrationName}:`, error.message);
        throw new Error(`Failed to run migration: ${error.message}`);
      }
      
      console.log(`[SupabaseService] Migration ${migrationName} completed successfully`);
    } catch (e) {
      console.error(`[SupabaseService] Exception in runMigration:`, e.message, e.stack);
      throw new Error(`Failed to run migration: ${e.message}`);
    }
  }

  // Run a SQL migration using the service role client
  async runSqlMigration(sql: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseServiceRoleClient.rpc('run_sql', { sql });
      
      if (error) {
        this.logger.error(`SQL migration failed: ${error.message}`, error);
        return { success: false, error: error.message };
      }
      
      this.logger.log('SQL migration executed successfully');
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Exception during SQL migration: ${errorMsg}`, error);
      return { success: false, error: errorMsg };
    }
  }

  // Handle Postgrest errors consistently
  handleError(error: PostgrestError | null): void {
    if (error) {
      this.logger.error(`Supabase error: ${error.message}`, error);
    }
  }
} 