import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function OrderSuccessScreen() {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons
          name="check-circle"
          size={100}
          color={theme.colors.primary}
          style={styles.icon}
        />
        <Text variant="headlineMedium" style={styles.title}>
          Order Placed Successfully!
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your medicines will be delivered within 24-48 hours
        </Text>
        <Text variant="bodyMedium" style={styles.orderNumber}>
          Order #MED123456
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => router.push('/medicine/orders')}
          style={styles.button}
        >
          Track Order
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.push('/medicine')}
          style={styles.button}
        >
          Back to Medicine
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    textAlign: 'center',
    opacity: 0.7,
  },
  buttonContainer: {
    paddingBottom: 16,
  },
  button: {
    marginTop: 12,
  },
}); 