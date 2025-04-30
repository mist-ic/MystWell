import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path as needed
import { useAuth } from '../context/auth'; // Adjust path as needed
// import { Profile } from '../services/profileService'; // Assuming Profile type exists

// Define a basic Profile type here if not available from service
export interface Profile {
    id: string; // profile_id (UUID)
    user_id: string; // auth.users.id (UUID)
    email?: string;
    // Add other profile fields if needed
    created_at: string;
    updated_at: string;
}

// Simple in-memory cache
let cachedProfile: Profile | null = null;

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [loading, setLoading] = useState<boolean>(!cachedProfile); // Only loading if not cached
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if auth is still loading or user is not logged in
    if (authLoading || !user) {
      if (!authLoading && !user) {
        // Clear cache if user logs out
        cachedProfile = null; 
        setProfile(null);
        setLoading(false);
      }
      return;
    }

    // If profile is already cached or currently loaded, don't refetch
    if (profile) {
        setLoading(false);
        return;
    }
    
    // Flag as loading only if we are actually fetching
    setLoading(true);
    let isMounted = true; // Prevent state update on unmounted component

    const fetchProfile = async () => {
      console.log('[useUserProfile] Fetching profile for user:', user.id);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          console.error('[useUserProfile] Error fetching profile:', fetchError.message);
          if (isMounted) setError(fetchError.message);
          cachedProfile = null; // Clear cache on error
        } else if (data && isMounted) {
          console.log('[useUserProfile] Profile fetched:', data.id);
          setProfile(data as Profile);
          cachedProfile = data as Profile; // Update cache
          setError(null);
        } else if (isMounted) {
          console.warn('[useUserProfile] No profile found for user:', user.id);
          setError('Profile not found.');
          cachedProfile = null; // Clear cache if not found
        }
      } catch (e: any) {
        console.error('[useUserProfile] Unexpected error fetching profile:', e);
        if (isMounted) setError(e.message || 'An unexpected error occurred.');
        cachedProfile = null; // Clear cache on error
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Only fetch if not already loaded/cached
    if (!profile) {
        fetchProfile();
    }

    return () => {
      isMounted = false;
    };
    // Depend on user.id and authLoading to refetch if user changes or auth loads
  }, [user, authLoading, profile]); 

  return { profile, loading, error };
} 