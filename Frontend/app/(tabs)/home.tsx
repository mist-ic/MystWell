import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, useTheme, FAB, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusItem } from '@/components/ui/StatusItem';
import { ReminderItem } from '@/components/ui/ReminderItem';
import { QuickActionCard } from '@/components/ui/Card/QuickActionCard';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const reminders = [
    {
      title: "Take Vitamin D",
      schedule: "Before Breakfast",
      type: "meal" as const,
    },
    {
      title: "Blood Pressure Check",
      schedule: "After Lunch",
      type: "meal" as const,
    },
    {
      title: "Dr. Smith Appointment",
      schedule: "03:00 PM",
      type: "time" as const,
    },
    {
      title: "Take Blood Sugar Reading",
      schedule: "Before Dinner",
      type: "meal" as const,
    },
    {
      title: "Evening Medicine",
      schedule: "After Dinner",
      type: "meal" as const,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineLarge" style={styles.title}>MystWell</Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Your health assistant
            </Text>
          </View>

          {/* User Profile */}
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
            accessibilityLabel="Open profile"
            accessibilityHint="Navigate to your profile settings"
          >
            <Text variant="titleMedium" style={styles.greeting}>Hello, Sarah</Text>
            <Avatar.Icon 
              size={40} 
              icon="account" 
              style={{ backgroundColor: theme.colors.primaryContainer }}
              color={theme.colors.onPrimaryContainer}
            />
          </TouchableOpacity>
        </View>

        {/* Status Section */}
        <View style={styles.statusContainer}>
          <StatusItem
            icon="pulse"
            label="Last check"
            value="2 days ago"
            containerStyle={styles.statusItem}
          />
          <StatusItem
            icon="calendar"
            label="Next reminder"
            value="Today, 3PM"
            containerStyle={styles.statusItem}
          />
        </View>

        {/* Reminders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Today's Reminders
            </Text>
            <Text variant="bodyMedium" style={styles.date}>Mon, Apr 7</Text>
          </View>

          <View style={styles.remindersContainer}>
            <ScrollView 
              style={styles.remindersScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.remindersList}>
                {reminders.map((reminder, index) => (
                  <ReminderItem
                    key={index}
                    title={reminder.title}
                    schedule={reminder.schedule}
                    type={reminder.type}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.quickActionsGrid}>
            <View style={styles.quickActionRow}>
              <QuickActionCard
                title="Record"
                description="Capture your health data"
                icon="microphone"
                onPress={() => router.push('/record')}
              />
              <QuickActionCard
                title="Medicine"
                description="View & track medications"
                icon="pill"
                onPress={() => router.push('/add')}
              />
            </View>
            <View style={styles.quickActionRow}>
              <QuickActionCard
                title="Add Document"
                description="Manage medical documents"
                icon="file-document"
                onPress={() => router.push('/document')}
              />
              <QuickActionCard
                title="Health Buddy"
                description="Get medical assistance"
                icon="chat"
                onPress={() => router.push('/chat')}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
          borderRadius: 28,
          width: 56,
          height: 56,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.primary 
        }}
        onPress={() => {/* Handle add reminder */}}
        color="white"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 80, // Add padding for FAB
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  header: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.7,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statusItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  date: {
    opacity: 0.6,
  },
  remindersContainer: {
    height: 280, // This will show approximately 4 reminders
  },
  remindersScroll: {
    flex: 1,
  },
  remindersList: {
    gap: 8,
  },
  quickActionsGrid: {
    gap: 16,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  greeting: {
    marginRight: 8,
  },
}); 