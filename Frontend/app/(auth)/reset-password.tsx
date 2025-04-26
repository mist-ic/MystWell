import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const theme = useTheme();

  // Create styles inside the component using a memoized factory
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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
      setError(err instanceof Error ? err.message : 'Failed to send reset instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.onBackground }]}>
            Check Your Email
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            We've sent password reset instructions to {email}. Please check your inbox.
          </Text>
          <Text style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
            (Don't forget to check your spam folder)
          </Text>
          <View style={styles.linksContainer}>
            <Link href="/(auth)/login" asChild>
              <Button 
                mode="contained" 
                style={styles.button}
                labelStyle={styles.buttonLabel}
                contentStyle={styles.buttonContent}
                theme={{ roundness: 25 }}
              >
                Return to Login
              </Button>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.onBackground }]}>
            Reset Password
          </Text>

          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            Enter your email address and we'll send you instructions to reset your password.
          </Text>

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="email-outline" />}
            disabled={loading}
          />

          <Button
            mode="contained"
            onPress={handleResetPassword}
            loading={loading}
            disabled={loading || !email}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
            theme={{ roundness: 25 }}
          >
            Send Reset Instructions
          </Button>

          <View style={styles.linksContainer}>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                  Back to Login
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Define the styles factory function outside the component
const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
  },
  note: {
    textAlign: 'center',
    marginBottom: 32,
    fontSize: 14,
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  inputOutline: {
    borderRadius: 12,
    borderWidth: 1.5,
  },
  button: {
    marginTop: 8,
    marginBottom: 24,
    elevation: 2,
  },
  buttonLabel: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  error: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontWeight: '500',
    fontSize: 14,
  }
});