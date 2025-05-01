import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { theme } from '@/theme';
import { AuthProvider, useAuth } from '@/context/auth';
import { SupabaseProvider } from '@/context/SupabaseProvider';
import { DocumentModalProvider } from '@/context/DocumentModalContext';
import { AppStateProvider } from '@/context/AppStateContext';

// Import Inter fonts
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Check if the path is protected
      const inAuthGroup = segments[0] === '(auth)';
      
      if (!session && !inAuthGroup) {
        // Redirect to login if accessing protected page without session
        router.replace('/(auth)/login');
      } else if (session && inAuthGroup) {
        // Redirect to home if accessing auth pages with session
        router.replace('/(tabs)');
      }
    }
  }, [session, loading, segments]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  // Note: Need to wait for fonts in RootLayout before rendering InitialLayout
  // This component will now render conditionally based on font loading in RootLayout
  return <Slot />;
}

export default function RootLayout() {
  // Load fonts, including Inter
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen once fonts are loaded
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Optional: Log font loading error
  useEffect(() => {
    if (!fontsLoaded) {
      console.error("Font Loading Error: Fonts not loaded");
      // Potentially handle the error, e.g., show an error message
    }
  }, [fontsLoaded]);

  // Show loading screen while fonts are loading
  if (!fontsLoaded) {
    // Return a simple loading view instead of SplashScreen component
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#fff' 
      }} />
    );
  }

  // Fonts are loaded (or error handled), render the app
  return (
    <SupabaseProvider>
      <AuthProvider>
        <AppStateProvider>
        <DocumentModalProvider>
          <PaperProvider theme={theme}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <InitialLayout />
            </ThemeProvider>
          </PaperProvider>
        </DocumentModalProvider>
        </AppStateProvider>
      </AuthProvider>
    </SupabaseProvider>
  );
}
