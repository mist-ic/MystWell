import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useEffect, useRef } from 'react';

interface MessageSkeletonProps {
  isUser?: boolean;
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ isUser = false }) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(animation).start();

    return () => {
      animation.stop();
    };
  }, [fadeAnim]);

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      {!isUser && (
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          {
            backgroundColor: theme.colors.surfaceVariant,
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.line} />
        <View style={[styles.line, styles.shortLine]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    width: '100%',
  },
  userContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  bubble: {
    maxWidth: '70%',
    borderRadius: 20,
    padding: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  line: {
    height: 12,
    width: 150,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
  },
  shortLine: {
    width: 100,
    marginBottom: 0,
  },
}); 