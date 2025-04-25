import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const isEmailValid = () => EMAIL_REGEX.test(email);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!isEmailValid()) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Check Your Email
          </Text>
          <Text style={styles.description}>
            We've sent password reset instructions to {email}. Please check your inbox.
          </Text>
          <Text style={styles.note}>
            If you don't see the email, please check your spam folder.
          </Text>
          <View style={styles.links}>
            <Link href="/(auth)/login" asChild>
              <Button mode="contained">
                Return to Login
              </Button>
            </Link>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Reset Password
        </Text>

        <Text style={styles.description}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>

        {error ? (
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        ) : null}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
          disabled={loading}
        />

        <Button
          mode="contained"
          onPress={handleResetPassword}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Send Reset Instructions
        </Button>

        <View style={styles.links}>
          <Link href="/login" asChild>
            <Button mode="text">
              Back to Login
            </Button>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
  },
  note: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginBottom: 16,
  },
  links: {
    alignItems: 'center',
  },
});