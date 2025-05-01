import { Platform } from 'react-native';

/**
 * Returns appropriate animation configuration based on platform
 * On web, always disables native driver to prevent warnings
 * On native platforms, uses native driver when appropriate
 */
export const getAnimationConfig = (useNativeDriver = true) => {
  // On web, never use native driver
  if (Platform.OS === 'web') {
    return { useNativeDriver: false };
  }
  
  // On native platforms, use as requested
  return { useNativeDriver };
}; 