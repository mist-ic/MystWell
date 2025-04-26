import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme, HelperText } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuth();
  const theme = useTheme();

  // Create styles inside the component using a memoized factory
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const isPasswordValid = () => PASSWORD_REGEX.test(password);
  const doPasswordsMatch = () => password === confirmPassword;

  const handleSignup = async () => {
    if (!isPasswordValid()) {
      setError('Password does not meet the requirements.');
      return;
    }
    if (!doPasswordsMatch()) {
      setError('Passwords do not match.');
      return;
    }
    try {
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.onBackground }]}>
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
            mode="outlined"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="email-outline" />}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!passwordVisible}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon 
                icon={passwordVisible ? "eye-off-outline" : "eye-outline"} 
                onPress={() => setPasswordVisible(!passwordVisible)} 
              />
            }
          />
          <HelperText type={isPasswordValid() || !password ? 'info' : 'error'} visible={true} style={styles.helperText}>
            Min 8 chars, 1 upper, 1 lower, 1 number, 1 special
          </HelperText>

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!confirmPasswordVisible}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="lock-check-outline" />}
            right={
              <TextInput.Icon 
                icon={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)} 
              />
            }
          />
          <HelperText type={doPasswordsMatch() || !confirmPassword ? 'info' : 'error'} visible={!!confirmPassword}>
            {doPasswordsMatch() ? 'Passwords match' : 'Passwords must match'}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleSignup}
            loading={loading}
            disabled={loading || !email || !password || !confirmPassword || !isPasswordValid() || !doPasswordsMatch()}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
            theme={{ roundness: 25 }}
          >
            Sign Up
          </Button>

          <View style={styles.linksContainer}>
            <Link href="/login" asChild>
              <TouchableOpacity>
                  <Text style={[styles.linkText, { color: theme.colors.primary }]}>Already have an account? Login</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 32, 
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 4, 
    backgroundColor: theme.colors.surface, 
  },
  inputOutline: {
    borderRadius: 12,
    borderWidth: 1.5,
  },
  helperText: {
    marginBottom: 12, 
    paddingHorizontal: 0, 
  },
  button: {
    marginTop: 24, 
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontWeight: '500',
    fontSize: 14,
  }
}); 