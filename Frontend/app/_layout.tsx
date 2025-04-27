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
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen once fonts are loaded OR if there's an error
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Optional: Log font loading error
  useEffect(() => {
    if (fontError) {
      console.error("Font Loading Error:", fontError);
      // Potentially handle the error, e.g., show an error message
    }
  }, [fontError]);

  // Render loading/null state until fonts are loaded (or error occurs)
  if (!fontsLoaded && !fontError) {
    return null; 
  }

  // Fonts are loaded (or error handled), render the app
  return (
    <SupabaseProvider>
      <AuthProvider>
        <DocumentModalProvider>
          <PaperProvider theme={theme}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <InitialLayout />
            </ThemeProvider>
          </PaperProvider>
        </DocumentModalProvider>
      </AuthProvider>
    </SupabaseProvider>
  );
}
