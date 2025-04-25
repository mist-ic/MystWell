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

  return <Slot />;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <InitialLayout />
        </ThemeProvider>
      </PaperProvider>
    </AuthProvider>
  );
}
