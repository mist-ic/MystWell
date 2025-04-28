import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

// Define the Profile type based on the database schema
interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  age: number | null;
  is_minor: boolean | null;
  guardian_email: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  blood_type: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null; // Add profile state
  loading: boolean;
  signUp: (
    email: string, 
    password: string, 
    fullName: string, 
    age: number | null, 
    isMinor: boolean, 
    guardianEmail: string | null
  ) => Promise<void>; // Update signUp signature
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (profileData: Partial<Profile>) => Promise<void>; // Add updateProfile
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // Add profile state
  const [loading, setLoading] = useState(true);

  // Function to fetch profile
  const fetchProfile = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const selectFields = `
        id, user_id, full_name, age, is_minor, guardian_email, avatar_url, updated_at,
        gender, height_cm, weight_kg, blood_type, allergies, medical_conditions, 
        current_medications, emergency_contact_name, emergency_contact_phone
      `;
      const { data, error, status } = await supabase
        .from('profiles')
        .select(selectFields)
        .eq('user_id', userId)
        .single();

      if (error && status !== 406) { // 406 means no row found, which is fine initially
        throw error;
      }

      if (data) {
        setProfile(data);
      } else {
        setProfile(null); // No profile found for this user yet
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      await fetchProfile(session?.user?.id); // Fetch profile on initial load
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      setSession(session);
      setUser(session?.user ?? null);
      await fetchProfile(session?.user?.id); // Fetch profile on auth state change
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string, 
    password: string, 
    fullName: string, 
    age: number | null, 
    isMinor: boolean, 
    guardianEmail: string | null
  ) => {
    try {
      // 1. Sign up the user with Supabase Auth, passing profile data in options.data
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            age: age, // Pass age (trigger will cast)
            is_minor: isMinor, // Pass is_minor (trigger will cast)
            // Only pass guardian_email if they are a minor
            guardian_email: isMinor ? guardianEmail : null 
          }
        }
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup completed but no user data returned.');

      // 2. REMOVE the manual profile insert - the trigger now handles this
      /*
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ 
          user_id: authData.user.id, 
          full_name: fullName,
          email: email, // Also store email in profile for convenience?
          age: age,
          is_minor: isMinor,
          guardian_email: isMinor ? guardianEmail : null, // Only store guardian email if minor
          type: 'GUARDIAN' // Assuming all signups are initially Guardians
        });
      
      if (profileError) {
        console.error("Error creating profile after signup:", profileError);
        // Consider how to handle this - maybe delete the auth user?
        throw profileError; 
      }
      */

      // 3. Profile will be created by the trigger. 
      // The onAuthStateChange listener will fetch it shortly after.

      router.push('/verify-email'); // Redirect to email verification
    } catch (error) {
      console.error('Signup Error:', error);
      throw error; // Re-throw the error to be caught by the UI
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Profile will be fetched by onAuthStateChange listener
      router.replace('/(tabs)'); 
    } catch (error) {
      console.error('Signin Error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null); // Clear profile on sign out
      router.replace('/login');
    } catch (error) {
      console.error('Signout Error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      // Optionally show a success message or navigate
    } catch (error) {
      console.error('Reset Password Error:', error);
      throw error;
    }
  };
  
  // Function to update profile
  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!user) throw new Error('User not logged in');
    if (!profile) throw new Error('Profile not loaded');

    try {
      const updates: Partial<Profile> & { updated_at: string, id: string, user_id: string } = {
        ...profileData,
        updated_at: new Date().toISOString(), // Update timestamp
        id: profile.id, // Ensure ID is included for update
        user_id: user.id // Ensure user_id is included for update (RLS might need it)
      };

      // Clean fields that shouldn't be directly updated or don't exist in Profile
      // delete updates.created_at; // Already removed this line
      
      // Ensure guardian_email is null if not a minor
      if (updates.is_minor === false) {
          updates.guardian_email = null;
      } else if (updates.is_minor === true && !updates.guardian_email) {
          // Optional: Prevent setting is_minor to true without a guardian email if required
          // We handle this validation in the Edit screen now
      }
      
      // Add other fields from profileData to updates implicitly
      // Ensure numeric types are handled if necessary (they are numbers or null in Profile type)

      const { data: updatedData, error } = await supabase
        .from('profiles')
        .update(updates as any) // Cast to any might be needed if TS complains about partial type
        .eq('id', profile.id) // Use profile ID for the update condition
        .select() // Select the updated row to update local state
        .single();

      if (error) throw error;

      // Update local state directly with the returned data
      if (updatedData) {
        setProfile(updatedData as Profile); // Update state with the response
      } else {
         await fetchProfile(user.id); // Fallback to refetch if select doesn't return data
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    profile, // Expose profile
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile, // Expose updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 