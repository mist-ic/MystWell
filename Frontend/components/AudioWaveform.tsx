import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';

interface AudioWaveformProps {
  isRecording: boolean;
  audioLevel?: number; // Value between 0 and 1
}

const NUM_BARS = 30;
const BAR_WIDTH = 4;
const BAR_GAP = 4;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 48;

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ isRecording, audioLevel = 0 }) => {
  const theme = useTheme();
  const animatedBars = useRef<Animated.Value[]>(
    Array(NUM_BARS).fill(0).map(() => new Animated.Value(MIN_HEIGHT))
  ).current;

  useEffect(() => {
    if (isRecording) {
      // Animate bars continuously while recording
      const animations = animatedBars.map((bar, index) => {
        const randomHeight = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT) * audioLevel;
        const delay = index * (50 / NUM_BARS); // Stagger the animations

        return Animated.sequence([
          Animated.timing(bar, {
            toValue: randomHeight,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: MIN_HEIGHT,
            duration: 200,
            useNativeDriver: false,
          }),
        ]);
      });

      Animated.stagger(50, animations).start();
    } else {
      // Reset all bars when not recording
      const resetAnimations = animatedBars.map(bar =>
        Animated.timing(bar, {
          toValue: MIN_HEIGHT,
          duration: 200,
          useNativeDriver: false,
        })
      );

      Animated.parallel(resetAnimations).start();
    }
  }, [isRecording, audioLevel, animatedBars]);

  return (
    <View style={styles.container}>
      {animatedBars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: theme.colors.primary,
              height: bar,
              opacity: isRecording ? 1 : 0.5,
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
    paddingHorizontal: 16,
  },
  bar: {
    width: BAR_WIDTH,
    marginHorizontal: BAR_GAP / 2,
    borderRadius: BAR_WIDTH / 2,
  },
}); 