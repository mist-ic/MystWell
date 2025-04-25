import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Searchbar, useTheme } from 'react-native-paper';
import { TextInputProps } from 'react-native'; // Import for potential props inheritance

const BASE_GRID = 8;

interface StyledSearchBarProps extends Omit<TextInputProps, 'onChange' | 'style'> {
  value: string;
  onChangeText: (query: string) => void;
  placeholder?: string;
  containerStyle?: object; // Allow passing additional container styles
}

export const StyledSearchBar: React.FC<StyledSearchBarProps> = ({
  value,
  onChangeText,
  placeholder = "Search...",
  containerStyle,
  ...rest // Pass other TextInputProps like autoCapitalize etc.
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const searchBarBackgroundColor = theme.colors.surface; // #FFFFFF
  const defaultBorderColor = theme.colors.outlineVariant; // #D1D5DB
  const focusedBorderColor = theme.colors.primary; // #1D4ED8
  const iconColor = '#9CA3AF'; // Spec color #9CA3AF
  const placeholderColor = '#9CA3AF'; // Spec color #9CA3AF
  const inputTextColor = theme.colors.onSurface; // #111827

  return (
    <View style={[styles.searchOuterContainer, containerStyle]}>
      <Searchbar
        placeholder={placeholder}
        onChangeText={onChangeText}
        value={value}
        iconColor={iconColor}
        placeholderTextColor={placeholderColor}
        inputStyle={styles.searchInput} // Font/Text styling applied here
        style={[
          styles.searchInnerContainer, // Border radius, border width applied here
          {
            backgroundColor: searchBarBackgroundColor,
            borderColor: isFocused ? focusedBorderColor : defaultBorderColor,
            // Box shadow on focus is difficult in RN, using border color change
          }
        ]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        elevation={0} 
        autoCapitalize="none" 
        theme={{ roundness: BASE_GRID }} // Apply border radius via theme prop
        iconProps={{ size: 20 }} // Attempt to set icon size via iconProps
        {...rest} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchOuterContainer: {
    width: '100%',
    maxWidth: 480, 
    height: 40,      // Spec: Height 40px
  },
  searchInnerContainer: {
    height: '100%',
    borderWidth: 1,
    borderRadius: BASE_GRID, // Spec: border-radius 8px (Set via theme prop too)
    paddingLeft: BASE_GRID * 1.5, // Add ~12px left padding for icon gap
    paddingRight: BASE_GRID * 2, // Standard 16px right padding
    // Colors set dynamically via inline style prop
  },
  searchInput: {
    fontSize: 16,
    // fontFamily: 'Inter-Regular', // Should be inherited from theme
    fontWeight: '400', 
    color: '#111827', // Input text color
    lineHeight: 24, // Spec: 16px / 24px line-height
    minHeight: 30, // Adjust minHeight to fit 40px container - Paper adds padding
    paddingLeft: 0, 
    alignSelf: 'center',
    // Paper Searchbar uses specific internal structure, aligning its input can be tricky
    // Placeholder color set via prop
  },
}); 