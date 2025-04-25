import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, useTheme, HelperText } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuth();
  const theme = useTheme();

  const isPasswordValid = () => PASSWORD_REGEX.test(password);
  const doPasswordsMatch = () => password === confirmPassword;

  const handleSignup = async () => {
    try {
      if (!isPasswordValid()) {
        setError('Password must be at least 8 characters and contain uppercase, lowercase, number, and special character');
        return;
      }

      if (!doPasswordsMatch()) {
        setError('Passwords do not match');
        return;
      }

      setError('');
      setLoading(true);
      await signUp(email, password);
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Create Account
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
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        <HelperText type="info" visible={true}>
          Password must contain at least 8 characters, including uppercase, lowercase, number, and special character
        </HelperText>

        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSignup}
          loading={loading}
          disabled={loading || !email || !password || !confirmPassword}
          style={styles.button}
        >
          Sign Up
        </Button>

        <View style={styles.links}>
          <Link href="/login" asChild>
            <Button mode="text">Already have an account? Login</Button>
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
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    marginBottom: 16,
  },
  error: {
    textAlign: 'center',
    marginBottom: 16,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
}); 