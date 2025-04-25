import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Memory fallback for server-side rendering
const memoryStorage = new Map<string, string>();

// Custom storage implementation
class CustomStorage {
  async getItem(key: string) {
    try {
      // Check if we're in a Node.js environment
      if (typeof window === 'undefined') {
        return memoryStorage.get(key) || null;
      }
      
      // Browser environment
      if (Platform.OS === 'web') {
        return window.localStorage.getItem(key);
      }
      
      // React Native environment
      return AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string) {
    try {
      // Check if we're in a Node.js environment
      if (typeof window === 'undefined') {
        memoryStorage.set(key, value);
        return;
      }
      
      // Browser environment
      if (Platform.OS === 'web') {
        window.localStorage.setItem(key, value);
        return;
      }
      
      // React Native environment
      return AsyncStorage.setItem(key, value);
    } catch {
      return;
    }
  }

  async removeItem(key: string) {
    try {
      // Check if we're in a Node.js environment
      if (typeof window === 'undefined') {
        memoryStorage.delete(key);
        return;
      }
      
      // Browser environment
      if (Platform.OS === 'web') {
        window.localStorage.removeItem(key);
        return;
      }
      
      // React Native environment
      return AsyncStorage.removeItem(key);
    } catch {
      return;
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new CustomStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-App-Platform': Platform.OS,
    },
  },
}); 