import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';

interface AudioWaveformProps {
  isRecording: boolean;
  audioLevel?: number;
}

const NUM_BARS = 40;
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 40;

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ isRecording, audioLevel = 0 }) => {
  const theme = useTheme();
  const animatedBars = useRef<Animated.Value[]>(
    Array(NUM_BARS).fill(0).map(() => new Animated.Value(MIN_HEIGHT))
  ).current;

  useEffect(() => {
    if (isRecording) {
      const createBarAnimation = (bar: Animated.Value, index: number) => {
        const randomFactor = 0.3 + Math.random() * 0.7; // Random between 0.3 and 1
        const targetHeight = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * audioLevel * randomFactor;
        const duration = 400 + Math.random() * 200; // Random duration between 400-600ms
        const delay = index * (1000 / NUM_BARS); // Staggered delay

        return Animated.sequence([
          Animated.timing(bar, {
            toValue: targetHeight,
            duration: duration,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: MIN_HEIGHT,
            duration: duration,
            useNativeDriver: false,
          }),
        ]);
      };

      const startAnimations = () => {
        const animations = animatedBars.map((bar, index) => createBarAnimation(bar, index));
        Animated.stagger(50, animations).start(() => {
          if (isRecording) {
            startAnimations(); // Recursively start animations if still recording
          }
        });
      };

      startAnimations();
    } else {
      // Reset all bars when not recording
      Animated.parallel(
        animatedBars.map(bar =>
          Animated.timing(bar, {
            toValue: MIN_HEIGHT,
            duration: 300,
            useNativeDriver: false,
          })
        )
      ).start();
    }
  }, [isRecording, audioLevel]);

  return (
    <View style={styles.container}>
      {animatedBars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: '#FFFFFF',
              height: bar,
              opacity: isRecording ? 0.8 : 0.4,
              marginHorizontal: BAR_GAP / 2,
              width: BAR_WIDTH,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MAX_HEIGHT,
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  bar: {
    borderRadius: BAR_WIDTH / 2,
  },
}); 