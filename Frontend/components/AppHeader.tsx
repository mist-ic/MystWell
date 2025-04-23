import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, useTheme, IconButton, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AppHeaderProps {
  title: string;
  leftIcon?: string;
  rightIcon?: string;
  rightIconBadge?: number;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onBackPress?: () => void;
}

export default function AppHeader({
  title,
  leftIcon,
  rightIcon,
  rightIconBadge,
  onLeftPress,
  onRightPress,
  onBackPress,
}: AppHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
              size={24}
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>
        )}
        
        <Text 
          style={[styles.title, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {rightIcon ? (
          <View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onRightPress}
              accessibilityRole="button"
              accessibilityLabel="Right action"
            >
              <MaterialCommunityIcons
                name={rightIcon}
                size={24}
                color={theme.colors.onSurface}
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