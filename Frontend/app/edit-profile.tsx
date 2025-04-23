import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput as RNTextInput } from 'react-native';
import { Text, useTheme, Surface, Button, SegmentedButtons, TextInput, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ProfileData {
  name: string;
  age: string;
  isAdult: boolean;
  gender: string;
  height: string;
  weight: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  medications: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [profile, setProfile] = useState<ProfileData>({
    name: 'Person 1',
    age: '28',
    isAdult: true,
    gender: 'male',
    height: '175',
    weight: '70',
    bloodType: 'O+',
    allergies: 'None',
    conditions: '',
    medications: '',
    emergencyContact: '',
    emergencyPhone: '',
  });

  const handleSave = () => {
    // Here you would save the profile data
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <AppHeader 
        title="Edit Profile" 
        leftIcon="arrow-left"
        onLeftPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level3 }]} elevation={2}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Basic Information</Text>
            
            <TextInput
              label="Name"
              value={profile.name}
              onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
              mode="outlined"
              style={styles.input}
            />

            <View style={styles.row}>
              <TextInput
                label="Age"
                value={profile.age}
                onChangeText={(text) => setProfile(prev => ({ ...prev, age: text }))}
                mode="outlined"
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
              />
              
              <View style={styles.switchContainer}>
                <Text>Adult</Text>
                <Switch
                  value={profile.isAdult}
                  onValueChange={(value) => setProfile(prev => ({ ...prev, isAdult: value }))}
                />
              </View>
            </View>

            <SegmentedButtons
              value={profile.gender}
              onValueChange={(value) => setProfile(prev => ({ ...prev, gender: value }))}
              buttons={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              style={styles.segmentedButtons}
            />
          </View>

          {/* Physical Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Physical Information</Text>
            
            <View style={styles.row}>
              <TextInput
                label="Height (cm)"
                value={profile.height}
                onChangeText={(text) => setProfile(prev => ({ ...prev, height: text }))}
                mode="outlined"
                keyboardType="numeric"
                style={[styles.input, { flex: 1, marginRight: 8 }]}
              />
              
              <TextInput
                label="Weight (kg)"
                value={profile.weight}
                onChangeText={(text) => setProfile(prev => ({ ...prev, weight: text }))}
                mode="outlined"
                keyboardType="numeric"
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <TextInput
              label="Blood Type"
              value={profile.bloodType}
              onChangeText={(text) => setProfile(prev => ({ ...prev, bloodType: text }))}
              mode="outlined"
              style={styles.input}
            />
          </View>

          {/* Medical Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Medical Information</Text>
            
            <TextInput
              label="Allergies"
              value={profile.allergies}
              onChangeText={(text) => setProfile(prev => ({ ...prev, allergies: text }))}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
            />

            <TextInput
              label="Medical Conditions"
              value={profile.conditions}
              onChangeText={(text) => setProfile(prev => ({ ...prev, conditions: text }))}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />

            <TextInput
              label="Current Medications"
              value={profile.medications}
              onChangeText={(text) => setProfile(prev => ({ ...prev, medications: text }))}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </View>

          {/* Emergency Contact */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Emergency Contact</Text>
            
            <TextInput
              label="Contact Name"
              value={profile.emergencyContact}
              onChangeText={(text) => setProfile(prev => ({ ...prev, emergencyContact: text }))}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Contact Phone"
              value={profile.emergencyPhone}
              onChangeText={(text) => setProfile(prev => ({ ...prev, emergencyPhone: text }))}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
        </Surface>

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
        >
          Save Profile
        </Button>
      </ScrollView>
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
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  segmentedButtons: {
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
}); 