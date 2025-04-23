import { MD3LightTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  customVariant: {
    fontFamily: 'SpaceMono',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.5,
    lineHeight: 24,
  },
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6750A4',
    secondary: '#625B71',
    tertiary: '#7D5260',
    background: '#FFFFFF',
    surface: '#FFFBFE',
    error: '#B3261E',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onTertiary: '#FFFFFF',
    onBackground: '#1C1B1F',
    onSurface: '#1C1B1F',
    onError: '#FFFFFF',
  },
  fonts: configureFonts({ config: fontConfig }),
}; 