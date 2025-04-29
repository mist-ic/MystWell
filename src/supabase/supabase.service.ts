import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from './supabase.module';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseServiceRole: SupabaseClient,
  ) {}

  /**
   * Run a SQL migration file using the service role client
   * @param migrationName The name of the migration file without extension (located in src/supabase/migrations)
   */
  async runMigration(migrationName: string): Promise<void> {
    this.logger.verbose(`Running migration: ${migrationName}`);
    const migrationPath = path.join(__dirname, 'migrations', migrationName);
    
    try {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      
      await this.supabaseServiceRole.rpc('exec_sql', {
        sql_query: sqlContent,
      });
      
      this.logger.verbose(`Migration ${migrationName} completed successfully`);
    } catch (error) {
      this.logger.error(`Error running migration ${migrationName}: ${error.message}`);
      throw error;
    }
  }
} 