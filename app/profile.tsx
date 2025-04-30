import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput as RNTextInput, Alert } from 'react-native';
import { Text, useTheme, Surface, Avatar, Button, Divider, Portal, Switch, List, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/auth';

export default function ProfileScreen() {
  const { user, profile, loading, signOut } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    shareHealthData: false,
    allowNotifications: true,
    showProfilePublicly: false,
    enableLocationServices: true,
    enableAnalytics: true,
  });

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.error('Error logging out:', error);
      Alert.alert("Logout Failed", error?.message || "An unknown error occurred.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
         <ActivityIndicator animating={true} size="large" />
      </SafeAreaView>
    );
  }

  if (!user || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
         <Text>Could not load profile. Please try logging in again.</Text>
         <Button onPress={handleLogout} style={{marginTop: 10}}>Logout</Button>
      </SafeAreaView>
    );
  }

  const { 
    full_name, age, is_minor, guardian_email, avatar_url,
    gender, height_cm, weight_kg, blood_type, allergies, 
    medical_conditions, current_medications, 
    emergency_contact_name, emergency_contact_phone 
  } = profile;
  
  const profileName = full_name || user.email || 'User';
  const avatarLabel = profileName.charAt(0).toUpperCase();
  const avatarIcon = is_minor ? "baby-face-outline" : "account";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <AppHeader 
        title="Profile" 
        leftIcon="arrow-left"
        onLeftPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
        rightIcon="cog"
        onRightPress={() => setShowSettingsModal(true)}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={[styles.medicalCard, { backgroundColor: theme.colors.elevation.level3 }]} elevation={2}>
          <View style={styles.cardHeader}>
            {avatar_url ? (
              <Avatar.Image size={60} source={{ uri: avatar_url }} />
            ) : (
              <Avatar.Text 
                size={60} 
                label={avatarLabel}
                style={{ backgroundColor: theme.colors.primaryContainer }}
                labelStyle={{ color: theme.colors.onPrimaryContainer }}
              />
            )}
            <View style={styles.headerInfo}>
              <Text variant="titleLarge" style={styles.name}>{profileName}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {user.email}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoSection}>
            {age !== null && age !== undefined && (
                 <InfoRow icon="cake-variant-outline" label="Age" value={`${age}`} />
            )}
            <InfoRow icon={is_minor ? "account-child-outline" : "account-check-outline"} label="Account Type" value={is_minor ? 'Minor' : 'Adult'} />
            {is_minor && guardian_email && (
                <InfoRow icon="email-outline" label="Guardian Email" value={guardian_email} />
            )}
            {gender && (
                <InfoRow icon="gender-male-female" label="Gender" value={gender} />
            )}
            {height_cm !== null && height_cm !== undefined && (
                <InfoRow icon="human-male-height" label="Height" value={`${height_cm} cm`} />
            )}
             {weight_kg !== null && weight_kg !== undefined && (
                <InfoRow icon="weight-kilogram" label="Weight" value={`${weight_kg} kg`} />
            )}
             {blood_type && (
                <InfoRow icon="water-outline" label="Blood Type" value={blood_type} />
            )}
            {allergies && (
                <InfoRow icon="alert-circle-outline" label="Allergies" value={allergies} />
            )}
            {medical_conditions && (
                <InfoRow icon="medical-bag" label="Conditions" value={medical_conditions} />
            )}
            {current_medications && (
                <InfoRow icon="pill" label="Medications" value={current_medications} />
            )}
            {emergency_contact_name && (
                <InfoRow 
                  icon="phone-alert-outline" 
                  label="Emergency Contact" 
                  value={`${emergency_contact_name} ${emergency_contact_phone ? `(${emergency_contact_phone})` : ''}`} 
                />
            )}
          </View>

          <Button 
            mode="contained" 
            onPress={() => router.push('/edit-profile')}
            style={styles.editButton}
          >
            Edit Profile
          </Button>
        </Surface>

        <Surface style={[styles.settingsCard, { backgroundColor: theme.colors.elevation.level3 }]} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Quick Settings</Text>
          
          <List.Item
            title="Privacy & Security"
            left={props => <List.Icon {...props} icon="shield-account" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setShowSettingsModal(true)}
          />
          
          <Button
            mode="outlined"
            onPress={handleLogout}
            style={styles.logoutButton}
            textColor={theme.colors.error}
          >
            Logout
          </Button>
        </Surface>
      </ScrollView>

      <Portal>
        <Modal
          visible={showSettingsModal}
          onDismiss={() => setShowSettingsModal(false)}
        >
          <View style={[styles.settingsModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>Privacy & Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.settingsScroll}>
              <List.Item
                title="Allow Notifications"
                description="Receive important health updates and reminders"
                right={() => (
                  <Switch
                    value={privacySettings.allowNotifications}
                    onValueChange={(value) => 
                      setPrivacySettings(prev => ({ ...prev, allowNotifications: value }))
                    }
                  />
                )}
              />
            </ScrollView>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const theme = useTheme();
  
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons 
        name={icon as any}
        size={24} 
        color={theme.colors.primary}
        style={styles.infoIcon}
      />
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
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
  medicalCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontWeight: '600',
  },
  divider: {
    marginVertical: 16,
  },
  infoSection: {
    gap: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  infoIcon: {
    marginRight: 16,
    width: 24, 
    textAlign: 'center',
  },
  editButton: {
    marginTop: 16,
  },
  settingsCard: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 16,
    fontWeight: '600',
  },
  settingsModal: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontWeight: '600',
  },
  settingsScroll: {
  },
  logoutButton: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderColor: 'transparent',
  },
}); 