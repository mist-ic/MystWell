import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Link } from 'expo-router';

export default function VerifyEmailScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Verify Your Email
        </Text>

        <Text style={styles.description}>
          We've sent you an email with a verification link. Please check your inbox and click the link to verify your account.
        </Text>

        <Text style={styles.note}>
          If you don't see the email, please check your spam folder.
        </Text>

        <View style={styles.links}>
          <Link href="/login" asChild>
            <Button mode="contained">
              Return to Login
            </Button>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  description: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  note: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  links: {
    marginTop: 16,
  },
}); 