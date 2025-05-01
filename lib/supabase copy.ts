import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!; // Reverted to use env variable
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!; // <<< Left as env variable - PLEASE REPLACE MANUALLY if not using .env

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

// Define getURL to handle OAuth returns
const getURL = () => {
  // For Android & iOS (physical device), use your app scheme
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return 'mystwell://';
  }
  
  // On web, use the current window location
  return window.location.origin;
};

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new CustomStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Add deep linking config for mobile platforms
    ...(Platform.OS !== 'web' && {
      // When using PKCE auth, set a valid redirect URL
      // This can be any URL that is registered as a redirect in the Supabase dashboard
      redirectTo: getURL(),
    }),
  },
  global: {
    headers: {
      'X-App-Platform': Platform.OS,
    },
  },
});

// Set up a handler for initial URL and URL events
if (Platform.OS !== 'web') {
  // Handle deep links
  Linking.addEventListener('url', async (event) => {
    if (event.url && event.url.startsWith('mystwell://')) {
      // Extract access token from URL if present
      if (
        event.url.includes('access_token=') || 
        event.url.includes('code=')
      ) {
        try {
          // Handle auth redirects
          const { data, error } = await supabase.auth.setSession({
            access_token: getParameterByName('access_token', event.url) || '',
            refresh_token: getParameterByName('refresh_token', event.url) || '',
          });
          
          if (error) {
            console.error('Error setting session from deep link:', error);
          } else {
            console.log('Successfully restored session from deep link');
          }
        } catch (e) {
          console.error('Failed to process deep link URL:', e);
        }
      }
    }
  });
}

// Helper function to extract parameters from URL
function getParameterByName(name: string, url: string) {
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp('[?&#]' + name + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
} 