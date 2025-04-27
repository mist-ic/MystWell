import Constants from 'expo-constants';

/**
 * Gets the base URL for the backend API.
 * Uses environment variables or Expo constants.
 */
export const getBaseUrl = (): string => {
  // Option 1: Use environment variable if set (e.g., via .env files)
  // const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  // if (envApiUrl) {
  //   return envApiUrl;
  // }

  // Option 2: Use Expo constants (assuming defined in app.config.js or similar)
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraApiUrl) {
    return extraApiUrl;
  }

  // Option 3: Simple check for development vs production (less robust)
  if (__DEV__) {
    // Use localhost for development
    return 'http://localhost:3000'; // Removed the /api suffix to match backend route structure
  } else {
    // Replace with your deployed production backend URL
    return 'https://your-production-api.com'; // Removed the /api suffix
  }
}; 