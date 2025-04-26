import { MD3LightTheme, configureFonts } from 'react-native-paper';

// Define Font configuration for Inter
// NOTE: Ensure 'Inter-Regular', 'Inter-Medium', 'Inter-SemiBold' are loaded via expo-font
const fontConfig = {
  // Default fonts (adjust paths/names if needed)
  regular: {
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
  },
  medium: {
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
  },
  semibold: { // Added for weight 600
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  // Map variants to Inter weights (adjust as needed for RN Paper components)
  bodySmall: { fontFamily: 'Inter-Regular', fontWeight: '400', fontSize: 12, lineHeight: 18 },
  bodyMedium: { fontFamily: 'Inter-Regular', fontWeight: '400', fontSize: 14, lineHeight: 21 },
  bodyLarge: { fontFamily: 'Inter-Regular', fontWeight: '400', fontSize: 16, lineHeight: 24 },
  titleSmall: { fontFamily: 'Inter-Medium', fontWeight: '500', fontSize: 14, lineHeight: 21 },
  titleMedium: { fontFamily: 'Inter-Medium', fontWeight: '500', fontSize: 16, lineHeight: 24 },
  titleLarge: { fontFamily: 'Inter-SemiBold', fontWeight: '600', fontSize: 20, lineHeight: 30 }, // Mapped 20px to titleLarge
  headlineSmall: { fontFamily: 'Inter-SemiBold', fontWeight: '600', fontSize: 24, lineHeight: 36 },
  headlineMedium: { fontFamily: 'Inter-SemiBold', fontWeight: '600', fontSize: 28, lineHeight: 42 },
  headlineLarge: { fontFamily: 'Inter-SemiBold', fontWeight: '600', fontSize: 32, lineHeight: 48 }, // Mapped 32px to headlineLarge
  labelSmall: { fontFamily: 'Inter-Medium', fontWeight: '500', fontSize: 11, lineHeight: 16 },
  labelMedium: { fontFamily: 'Inter-Medium', fontWeight: '500', fontSize: 12, lineHeight: 18 },
  labelLarge: { fontFamily: 'Inter-Medium', fontWeight: '500', fontSize: 14, lineHeight: 21 },
  default: { fontFamily: 'Inter-Regular', fontWeight: '400' },
};

// Define custom colors based on specs
const colors = {
  ...MD3LightTheme.colors, // Start with defaults
  primary: '#1D4ED8', // Primary Blue
  onPrimary: '#FFFFFF', // White text on primary
  primaryContainer: '#EFF6FF', // Accent background (Pinned cards)
  onPrimaryContainer: '#111827', // Text on accent background (use body text color)
  secondary: '#374151', // Secondary Heading color
  onSecondary: '#FFFFFF', // Assume white text on secondary
  secondaryContainer: '#E5E7EB', // Use Border color for secondary container? (Adjust if needed)
  onSecondaryContainer: '#374151', // Text on secondary container
  tertiary: '#6B7280', // Muted text/icons -> Tertiary?
  onTertiary: '#FFFFFF', // Assume white text
  tertiaryContainer: '#F3F4F6', // Hover background color?
  onTertiaryContainer: '#6B7280', // Text on tertiary container
  background: '#F9FAFB', // Page background
  onBackground: '#111827', // Heading text on page background
  surface: '#FFFFFF', // Card/Search background
  onSurface: '#111827', // Body text on card/search
  surfaceVariant: '#F3F4F6', // Use for subtle backgrounds/hovers? (like card hover)
  onSurfaceVariant: '#6B7280', // Muted text/icons
  outline: '#E5E7EB', // Border / Divider
  outlineVariant: '#D1D5DB', // Slightly darker border (e.g., search)
  shadow: '#000000',
  surfaceDisabled: '#F3F4F6', // Disabled background (use hover color?)
  onSurfaceDisabled: '#9CA3AF', // Disabled text/icon (Search icon color)
  error: '#DC2626', // Default error red (adjust if spec provides)
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2', // Light red error container
  onErrorContainer: '#B91C1C', // Dark red text on error container
  
  // Custom additions (if needed)
  primaryHover: '#2563EB',
  bodyText: '#111827',
  mutedText: '#6B7280',
};

export const theme = {
  ...MD3LightTheme,
  colors: colors,
  fonts: configureFonts({ config: fontConfig, isV3: true }),
}; 