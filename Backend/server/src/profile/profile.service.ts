import { Injectable, Inject, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT, SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';

// Export the interface
export interface Profile {
  id: string;
  user_id: string; // Supabase auth user ID
  email?: string;
  phone?: string;
  full_name?: string;
  // Add other profile fields as needed
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseServiceRole: SupabaseClient,
  ) {}

  /**
   * Finds a profile by the Supabase user ID using the Service Role client.
   * This bypasses RLS specifically for this lookup to avoid recursion issues
   * where the profile lookup triggers the RLS policy that itself needs the profile.
   * Used by the AuthGuard to link the authenticated user to their application profile.
   * @param userId - The Supabase auth.users.id
   * @returns The profile object or null if not found.
   */
  async getProfileByUserId(userId: string): Promise<Profile | null> {
    // this.logger.log(`Attempting to fetch profile where user_id = ${userId} using Service Role`);
    try {
      const { data, error, status } = await this.supabaseServiceRole
        .from('profiles')
        .select('id, user_id, email, full_name') // Select only needed fields
        .eq('user_id', userId)
        .limit(1); // Ensure only one row is expected

      if (error) {
        this.logger.error(`[ProfileService] Supabase Service Role error fetching profile for user ${userId}:`, status, error.message);
        throw new InternalServerErrorException(`Failed to execute profile query with service role: ${error.message}`);
      }

      // Check if data array is empty or has content
      if (!data || data.length === 0) {
          this.logger.warn(`[ProfileService] Profile not found for user ID (using Service Role): ${userId}`);
          return null;
      }

      const profile = data[0] as Profile; // Get the first element
      this.logger.log(`[ProfileService] Profile found using Service Role: ID=${profile.id}, UserId=${profile.user_id}, Email=${profile.email || 'N/A'}`);
      return profile;
      
    } catch (e) {
        this.logger.error(`[ProfileService] Exception in getProfileByUserId (Service Role) for ${userId}:`, e.message, e.stack);
        // Ensure it throws an appropriate NestJS exception
        if (e instanceof InternalServerErrorException || e instanceof NotFoundException) {
            throw e;
        }
        throw new InternalServerErrorException(`An unexpected error occurred while fetching the profile using service role: ${e.message}`);
    }
  }

  /**
   * Gets the profile for the currently authenticated user based on their JWT.
   * Uses the user-specific client which respects RLS.
   */
  async getMyProfile(userId: string): Promise<Profile | null> {
    // this.logger.log(`Attempting to fetch profile where user_id = ${userId} using Standard Client`);
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error fetching own profile for user ${userId}:`, error.message);
      // Don't throw, return null if not found due to RLS or error
      return null; 
    }
    // this.logger.log(`Profile ${data ? 'found' : 'not found'} using Standard Client: ID=${data?.id}`);
    return data;
  }

  // --- Placeholder for other profile methods --- 

  // async getProfileById(profileId: string): Promise<Profile> { ... }
  // async createManagedProfile(guardianProfileId: string, profileData: any): Promise<Profile> { ... }
  // async updateProfile(profileId: string, updates: any): Promise<Profile> { ... }
  // async getManagedProfiles(guardianProfileId: string): Promise<Profile[]> { ... }
} 