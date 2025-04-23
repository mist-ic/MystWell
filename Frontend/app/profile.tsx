import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { Text, useTheme, Surface, Avatar, Button, Divider, Portal, Switch, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';

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

interface User {
  id: string;
  name: string;
  color: string;
  isKidsProfile?: boolean;
  profile?: ProfileData;
}

interface PrivacySettings {
  shareHealthData: boolean;
  allowNotifications: boolean;
  showProfilePublicly: boolean;
  enableLocationServices: boolean;
  enableAnalytics: boolean;
}

const COLORS = ['#2196F3', '#E91E63', '#4CAF50', '#9C27B0', '#FF9800', '#607D8B'];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [activeUserId, setActiveUserId] = useState('1');
  const [users, setUsers] = useState<User[]>([
    { 
      id: '1', 
      name: 'Person 1', 
      color: '#2196F3',
      profile: {
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
      }
    },
    { id: '2', name: 'Person 2', color: '#E91E63' },
    { id: '3', name: 'Person 3', color: '#4CAF50' },
    { id: '4', name: 'Person 4', color: '#9C27B0' },
    { 
      id: '5', 
      name: 'Kids', 
      color: '#FF9800', 
      isKidsProfile: true,
      profile: {
        name: 'Kids',
        age: '10',
        isAdult: false,
        gender: 'other',
        height: '140',
        weight: '35',
        bloodType: 'A+',
        allergies: 'None',
        conditions: '',
        medications: '',
        emergencyContact: 'Parent',
        emergencyPhone: '',
      }
    },
  ]);
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileData, setNewProfileData] = useState<Partial<ProfileData>>({
    name: '',
    age: '',
    isAdult: true,
    gender: 'other',
    height: '',
    weight: '',
    bloodType: '',
    allergies: '',
    conditions: '',
    medications: '',
    emergencyContact: '',
    emergencyPhone: '',
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    shareHealthData: false,
    allowNotifications: true,
    showProfilePublicly: false,
    enableLocationServices: true,
    enableAnalytics: true,
  });

  const activeUser = users.find(user => user.id === activeUserId) || users[0];

  const handleAddProfile = () => {
    if (newProfileName.trim()) {
      const newProfile: User = {
        id: (users.length + 1).toString(),
        name: newProfileName.trim(),
        color: COLORS[users.length % COLORS.length],
        profile: {
          name: newProfileName.trim(),
          age: '',
          isAdult: true,
          gender: 'other',
          height: '',
          weight: '',
          bloodType: '',
          allergies: '',
          conditions: '',
          medications: '',
          emergencyContact: '',
          emergencyPhone: '',
        }
      };
      setUsers([...users, newProfile]);
      setNewProfileName('');
      setShowNewProfileModal(false);
    }
  };

  const handleProfileSwitch = (userId: string) => {
    setActiveUserId(userId);
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            // Handle logout logic here
            router.replace('/login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <AppHeader 
        title="Profile" 
        leftIcon="arrow-left"
        onLeftPress={() => router.back()}
        rightIcon="cog"
        onRightPress={() => setShowSettingsModal(true)}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Medical Info Card */}
        <Surface style={[styles.medicalCard, { backgroundColor: theme.colors.elevation.level3 }]} elevation={2}>
          <View style={styles.cardHeader}>
            <Avatar.Icon 
              size={60} 
              icon={activeUser.isKidsProfile ? "baby-face-outline" : "account"}
              style={{ backgroundColor: activeUser.color }}
            />
            <View style={styles.headerInfo}>
              <Text variant="titleLarge" style={styles.name}>{activeUser.name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Active Profile
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          {activeUser.profile ? (
            <View style={styles.infoSection}>
              <InfoRow icon="cake" label="Age" value={`${activeUser.profile.age} ${activeUser.profile.isAdult ? '(Adult)' : '(Minor)'}`} />
              <InfoRow icon="human-male-height" label="Height" value={`${activeUser.profile.height} cm`} />
              <InfoRow icon="weight" label="Weight" value={`${activeUser.profile.weight} kg`} />
              <InfoRow icon="water" label="Blood Type" value={activeUser.profile.bloodType || 'Not set'} />
              <InfoRow icon="alert-circle" label="Allergies" value={activeUser.profile.allergies || 'None'} />
              {activeUser.profile.conditions && (
                <InfoRow icon="medical-bag" label="Conditions" value={activeUser.profile.conditions} />
              )}
              {activeUser.profile.medications && (
                <InfoRow icon="pill" label="Medications" value={activeUser.profile.medications} />
              )}
              {activeUser.profile.emergencyContact && (
                <InfoRow 
                  icon="phone-alert" 
                  label="Emergency Contact" 
                  value={`${activeUser.profile.emergencyContact} ${activeUser.profile.emergencyPhone ? `(${activeUser.profile.emergencyPhone})` : ''}`} 
                />
              )}
            </View>
          ) : (
            <View style={styles.emptyProfile}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                No profile information set
              </Text>
            </View>
          )}

          <Button 
            mode="contained" 
            onPress={() => router.push('/edit-profile')}
            style={styles.editButton}
          >
            Edit Profile
          </Button>
        </Surface>

        {/* Switch Profile Section */}
        <View style={styles.switchSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Switch Profile</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileScroll}
          >
            {users.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.profileItem}
                onPress={() => handleProfileSwitch(user.id)}
              >
                <View style={styles.profileAvatarContainer}>
                  <Avatar.Icon 
                    size={80} 
                    icon={user.isKidsProfile ? "baby-face-outline" : "account"}
                    style={{ backgroundColor: user.color }}
                  />
                  {user.id === activeUserId && (
                    <View style={[styles.activeIndicator, { backgroundColor: theme.colors.primary }]} />
                  )}
                </View>
                <Text variant="bodyMedium" style={styles.profileName}>
                  {user.name}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.profileItem}
              onPress={() => setShowNewProfileModal(true)}
            >
              <Avatar.Icon 
                size={80} 
                icon="plus"
                style={{ backgroundColor: theme.colors.surfaceVariant }}
              />
              <Text variant="bodyMedium" style={styles.profileName}>
                New
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Settings Section */}
        <Surface style={[styles.settingsCard, { backgroundColor: theme.colors.elevation.level3 }]} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Quick Settings</Text>
          
          <List.Item
            title="Privacy & Security"
            left={props => <List.Icon {...props} icon="shield-account" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setShowSettingsModal(true)}
          />
          
          <List.Item
            title="Notifications"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* Handle notifications */}}
          />
          
          <List.Item
            title="Language"
            description="English (US)"
            left={props => <List.Icon {...props} icon="translate" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* Handle language */}}
          />
          
          <List.Item
            title="Help & Support"
            left={props => <List.Icon {...props} icon="help-circle-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* Handle help */}}
          />
          
          <List.Item
            title="About Us"
            left={props => <List.Icon {...props} icon="information-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* Handle about */}}
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

      {/* New Profile Modal */}
      <Portal>
        <Modal
          visible={showNewProfileModal}
          onDismiss={() => setShowNewProfileModal(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface }
          ]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Add New Profile</Text>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.colors.background,
                color: theme.colors.onBackground,
                borderColor: theme.colors.outline,
              }
            ]}
            placeholder="Enter profile name"
            value={newProfileName}
            onChangeText={setNewProfileName}
            placeholderTextColor={theme.colors.onSurfaceVariant}
          />
          <View style={styles.modalButtons}>
            <Button 
              mode="outlined" 
              onPress={() => setShowNewProfileModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleAddProfile}
              style={styles.modalButton}
              disabled={!newProfileName.trim()}
            >
              Add Profile
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Settings Modal */}
      <Portal>
        <Modal
          visible={showSettingsModal}
          onDismiss={() => setShowSettingsModal(false)}
          contentContainerStyle={[
            styles.settingsModal,
            { backgroundColor: theme.colors.surface }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>Privacy & Settings</Text>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.settingsScroll}>
            <Text variant="titleMedium" style={styles.settingsSection}>Privacy Controls</Text>
            
            <List.Item
              title="Share Health Data"
              description="Allow sharing of health data with healthcare providers"
              right={() => (
                <Switch
                  value={privacySettings.shareHealthData}
                  onValueChange={(value) => 
                    setPrivacySettings(prev => ({ ...prev, shareHealthData: value }))
                  }
                />
              )}
            />
            
            <List.Item
              title="Notifications"
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
            
            <List.Item
              title="Public Profile"
              description="Make your profile visible to other users"
              right={() => (
                <Switch
                  value={privacySettings.showProfilePublicly}
                  onValueChange={(value) => 
                    setPrivacySettings(prev => ({ ...prev, showProfilePublicly: value }))
                  }
                />
              )}
            />
            
            <List.Item
              title="Location Services"
              description="Enable location-based features"
              right={() => (
                <Switch
                  value={privacySettings.enableLocationServices}
                  onValueChange={(value) => 
                    setPrivacySettings(prev => ({ ...prev, enableLocationServices: value }))
                  }
                />
              )}
            />
            
            <List.Item
              title="Analytics"
              description="Help improve the app by sharing usage data"
              right={() => (
                <Switch
                  value={privacySettings.enableAnalytics}
                  onValueChange={(value) => 
                    setPrivacySettings(prev => ({ ...prev, enableAnalytics: value }))
                  }
                />
              )}
            />

            <Text variant="titleMedium" style={styles.settingsSection}>Security</Text>
            
            <List.Item
              title="Change Password"
              left={props => <List.Icon {...props} icon="lock-outline" />}
              onPress={() => {/* Handle password change */}}
            />
            
            <List.Item
              title="Two-Factor Authentication"
              left={props => <List.Icon {...props} icon="two-factor-authentication" />}
              onPress={() => {/* Handle 2FA */}}
            />
            
            <List.Item
              title="Connected Devices"
              left={props => <List.Icon {...props} icon="devices" />}
              onPress={() => {/* Handle devices */}}
            />

            <Text variant="titleMedium" style={styles.settingsSection}>Data Management</Text>
            
            <List.Item
              title="Export Health Data"
              left={props => <List.Icon {...props} icon="export" />}
              onPress={() => {/* Handle data export */}}
            />
            
            <List.Item
              title="Delete Account"
              left={props => <List.Icon {...props} icon="delete-outline" />}
              titleStyle={{ color: theme.colors.error }}
              onPress={() => {/* Handle account deletion */}}
            />
          </ScrollView>
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
        name={icon} 
        size={24} 
        color={theme.colors.primary}
        style={styles.infoIcon}
      />
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
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
  },
  infoIcon: {
    marginRight: 12,
    width: 24,
  },
  editButton: {
    marginTop: 8,
  },
  switchSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  profileScroll: {
    paddingHorizontal: 4,
    gap: 16,
    flexDirection: 'row',
    paddingBottom: 8,
  },
  profileItem: {
    alignItems: 'center',
    gap: 8,
    width: 100,
  },
  profileAvatarContainer: {
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  profileName: {
    textAlign: 'center',
  },
  modal: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    minWidth: 100,
  },
  emptyProfile: {
    alignItems: 'center',
    padding: 16,
  },
  settingsCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  settingsModal: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsSection: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 16,
    borderColor: 'transparent',
  },
}); 