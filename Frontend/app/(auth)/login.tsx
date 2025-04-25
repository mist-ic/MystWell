import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const theme = useTheme();

  // Create styles inside the component using a memoized factory
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
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
        <View style={styles.content}>
          <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.onBackground }]}>
            Welcome Back
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

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || !email || !password}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
            theme={{ roundness: 25 }}
          >
            {loading ? '' : 'Login'}
          </Button>

          <View style={styles.linksContainer}>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>Create Account</Text>
              </TouchableOpacity>
            </Link>
            
            <Link href="/reset-password" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>Forgot Password?</Text>
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
    marginBottom: 40,
    fontWeight: 'bold',
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
    marginTop: 16,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontWeight: '500',
    fontSize: 14,
  }
}); 