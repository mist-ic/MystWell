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
  const iconColor = '#9CA3AF'; // Spec color for icon
  const placeholderColor = theme.colors.onSurfaceVariant; // #6B7280
  const inputTextColor = theme.colors.onSurface; // #111827

  return (
    <View style={[styles.searchOuterContainer, containerStyle]}>
      <Searchbar
        placeholder={placeholder}
        onChangeText={onChangeText}
        value={value}
        iconColor={iconColor}
        placeholderTextColor={placeholderColor}
        inputStyle={[styles.searchInput, { color: inputTextColor }]}
        style={[
          styles.searchInnerContainer,
          {
            backgroundColor: searchBarBackgroundColor,
            borderColor: isFocused ? focusedBorderColor : defaultBorderColor,
          }
        ]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        elevation={0} // Remove elevation/shadow
        // Pass down other relevant props
        autoCapitalize="none" 
        {...rest} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchOuterContainer: {
    width: '100%',
    maxWidth: 480, // Max width 480px
    height: 48,      // Height 48px
  },
  searchInnerContainer: {
    height: '100%', // Ensure Searchbar fills container height
    borderWidth: 1,
    borderRadius: BASE_GRID, // 8px
    // Colors set dynamically via inline style prop
  },
  searchInput: {
    fontSize: 16,
    // fontFamily: 'Inter-Regular', // Should be inherited from theme
    fontWeight: '400', // Map from spec
    // Color set via inline style prop
    // Paper Searchbar handles internal padding/alignment
    minHeight: 40, // Ensure input text doesn't get cut off vertically
    paddingLeft: 0, // Adjust default padding if needed
    alignSelf: 'center', // Center text vertically
  },
}); 