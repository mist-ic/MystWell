import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from './supabase.module';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SupabaseService {
  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseServiceRole: SupabaseClient,
  ) {}

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
      
      const { error } = await this.supabaseServiceRole.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`[SupabaseService] Error running migration ${migrationName}:`, error.message);
        throw new InternalServerErrorException(`Failed to run migration: ${error.message}`);
      }
      
      console.log(`[SupabaseService] Migration ${migrationName} completed successfully`);
    } catch (e) {
      console.error(`[SupabaseService] Exception in runMigration:`, e.message, e.stack);
      throw new InternalServerErrorException(`Failed to run migration: ${e.message}`);
    }
  }
} 