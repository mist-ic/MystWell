import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, StyleProp, ViewStyle } from 'react-native';
import { Text, useTheme, IconButton, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define the expected props structure for the custom component
interface RightIconComponentProps {
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>; 
}

interface AppHeaderProps {
  title: string;
  leftIcon?: keyof typeof MaterialCommunityIcons.glyphMap; // Use keyof for better type safety
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap; // Use keyof for better type safety
  rightIconBadge?: number;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onBackPress?: () => void;
  // Add the new prop for the custom component
  rightIconComponent?: (props: RightIconComponentProps) => React.ReactNode;
}

export default function AppHeader({
  title,
  leftIcon,
  rightIcon,
  rightIconBadge,
  onLeftPress,
  onRightPress,
  onBackPress,
  rightIconComponent, // Destructure the new prop
}: AppHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const iconSize = 24;
  const iconColor = theme.colors.onSurface;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (onLeftPress && leftIcon === 'arrow-left') {
      onLeftPress();
    }
  };

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.surface,
          paddingTop: Platform.OS === 'ios' ? insets.top : 0,
          borderBottomColor: theme.colors.outlineVariant,
        }
      ]}
    >
      <View style={styles.content}>
        {leftIcon && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel={leftIcon === 'arrow-left' ? 'Go back' : 'Left action'}
          >
            <MaterialCommunityIcons
              name={leftIcon}
              size={iconSize}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
        
        <Text 
          style={[styles.title, { color: iconColor }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {rightIconComponent ? (
          rightIconComponent({ size: iconSize, color: iconColor, style: styles.iconButton })
        ) : rightIcon ? (
          <View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onRightPress}
              accessibilityRole="button"
              accessibilityLabel="Right action"
            >
              <MaterialCommunityIcons
                name={rightIcon}
                size={iconSize}
                color={iconColor}
              />
            </TouchableOpacity>
            {rightIconBadge !== undefined && rightIconBadge > 0 && (
              <Badge
                size={20}
                style={styles.badge}
              >
                {rightIconBadge}
              </Badge>
            )}
          </View>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderBottomWidth: 1,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
}); 