import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, Surface, Button, TextInput, Switch, ActivityIndicator, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/auth';

// Define a type for the form state - ONLY core editable fields
interface EditProfileForm {
  fullName: string;
  age: string;
  isMinor: boolean;
  guardianEmail: string;
}

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, updateProfile, loading: authLoading } = useAuth();
  
  // Initialize form state with ONLY core editable fields
  const [formState, setFormState] = useState<EditProfileForm>({
    fullName: '',
    age: '',
    isMinor: false,
    guardianEmail: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill form when profile data loads or changes - ONLY core fields
  useEffect(() => {
    if (profile) {
      setFormState({
        fullName: profile.full_name || '',
        age: profile.age?.toString() || '',
        isMinor: profile.is_minor || false,
        guardianEmail: profile.guardian_email || '',
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof EditProfileForm, value: string | boolean) => {
    setError('');
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  // Validation functions - ONLY for core fields
  const isAgeValid = () => formState.age === '' || (!isNaN(Number(formState.age)) && Number(formState.age) >= 0 && Number.isInteger(Number(formState.age)));
  const isGuardianEmailValid = () => !formState.isMinor || (formState.isMinor && formState.guardianEmail.includes('@'));

  const handleSave = async () => {
    // Perform validation ONLY for core fields
    if (!formState.fullName.trim()) {
      setError('Full name cannot be empty.');
      return;
    }
    if (!isAgeValid()) {
      setError('Please enter a valid age.');
      return;
    }
    if (formState.isMinor && !isGuardianEmailValid()) {
      setError('A valid guardian email is required for minors.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Prepare data for updateProfile - ONLY core fields
      const numericAge = formState.age === '' ? null : parseInt(formState.age, 10);
            
      await updateProfile({
        // Pass only the fields being edited
        full_name: formState.fullName.trim(),
        age: numericAge,
        is_minor: formState.isMinor,
        guardian_email: formState.isMinor ? formState.guardianEmail.trim() : null,
      });
      Alert.alert("Success", "Profile updated successfully.");
      router.back();
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || 'Failed to update profile.');
      Alert.alert("Error", err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
     return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
         <ActivityIndicator animating={true} size="large" />
      </SafeAreaView>
    );
  }
  
  if (!profile) {
     return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
         <Text>Could not load profile data.</Text>
         <Button onPress={() => router.back()}>Go Back</Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <AppHeader 
        title="Edit Profile" 
        leftIcon="arrow-left"
        onLeftPress={() => router.back()}
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level3 }]} elevation={2}>
             {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            {/* --- Basic Information Section (Core Fields Only) --- */}
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Basic Information</Text>
              <TextInput
                label="Full Name"
                value={formState.fullName}
                onChangeText={(text) => handleInputChange('fullName', text)}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Age"
                value={formState.age}
                onChangeText={(text) => handleInputChange('age', text)}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />
              <HelperText type={isAgeValid() ? 'info' : 'error'} visible={formState.age !== ''}>
                {isAgeValid() ? '' : 'Age must be a whole number'}
              </HelperText>
              <View style={styles.switchContainer}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Is Minor?</Text>
                <Switch
                  value={formState.isMinor}
                  onValueChange={(value) => handleInputChange('isMinor', value)}
                  color={theme.colors.primary}
                />
              </View>
              {formState.isMinor && (
                <>
                  <TextInput
                    label="Guardian Email"
                    value={formState.guardianEmail}
                    onChangeText={(text) => handleInputChange('guardianEmail', text)}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <HelperText type={isGuardianEmailValid() ? 'info' : 'error'} visible={!!formState.guardianEmail}>
                    {isGuardianEmailValid() ? '' : 'Please enter a valid email'}
                  </HelperText>
                </>
              )}
            </View>
          </Surface>

          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading} 
            disabled={loading || authLoading}
            style={styles.saveButton}
          >
            Save Profile
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  saveButton: {
    marginTop: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 12,
  },
}); 