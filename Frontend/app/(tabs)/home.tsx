import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Text, useTheme, FAB, Avatar, Portal, Modal, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StatusItem } from '@/components/ui/StatusItem';
import { ReminderItem, ReminderType } from '@/components/ui/ReminderItem';
import { QuickActionCard } from '@/components/ui/Card/QuickActionCard';
import { useRouter, usePathname } from 'expo-router';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

// Define a type for reminders if not already defined
interface Reminder {
  id: string;
  title: string;
  schedule: string; // Could represent time or general schedule
  date?: string; // Added optional date for appointments
  type: ReminderType;
  medicineIdentifier?: string;
}

// Sample data (replace with actual data fetching logic)
const initialReminders: Reminder[] = [
  {
    id: '1',
    title: "Take Vitamin D",
    schedule: "Before Breakfast",
    type: "meal",
    medicineIdentifier: "Vitamin D 500IU",
  },
  {
    id: '2',
    title: "Blood Pressure Check",
    schedule: "After Lunch",
    type: "check",
  },
  {
    id: '3',
    title: "Dr. Smith Appointment",
    schedule: "03:00 PM",
    date: "2024-07-22", // Example date
    type: "appointment",
  },
  {
    id: '4',
    title: "Take Blood Sugar Reading",
    schedule: "Before Dinner",
    type: "check",
  },
  {
    id: '5',
    title: "Evening Medicine",
    schedule: "After Dinner",
    type: "meal",
    medicineIdentifier: "Metformin 500mg",
  },
];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname(); // Get current route path
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  
  // --- State for Modification Modal ---
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false);
  const [reminderToModify, setReminderToModify] = useState<Reminder | null>(null);
  const [modifiedSchedule, setModifiedSchedule] = useState('');
  const [modifiedDate, setModifiedDate] = useState<Date | undefined>(undefined); // Use Date object
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false); // State for date picker modal
  // --- End State for Modification Modal ---

  // --- Simplified Cart State (Example) ---
  const [cartItems, setCartItems] = useState<string[]>([]); // Store medicine identifiers
  // --- End Cart State ---

  // --- State for FAB Group ---
  const [fabOpen, setFabOpen] = useState(false);
  // --- End State for FAB Group ---

  // Get the bottom tab bar height
  let tabBarHeight = 0;
  try {
    // This hook needs to be called unconditionally, but might throw if not in a tab navigator
    // Use a try-catch as a safeguard if this screen might be used outside tabs.
    tabBarHeight = useBottomTabBarHeight();
  } catch (e) {
    console.warn("Couldn't get bottom tab bar height. FAB might overlap.");
    // Use a default fallback height if needed, e.g., 50 or adjust based on observation
    tabBarHeight = 60; // Example fallback
  }

  // Create styles inside the component using a memoized factory
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // --- Handlers for Date Picker ---
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirmDate = (date: Date) => {
    setModifiedDate(date); // Store selected date
    hideDatePicker();
  };
  // --- End Handlers for Date Picker ---

  const handleUpdateReminderStatus = useCallback((id: string, status: 'completed' | 'skipped' | 'modify' | 'refill') => {
    setReminders(prevReminders => {
      const itemIndex = prevReminders.findIndex(r => r.id === id);
      if (itemIndex === -1) return prevReminders; 

      const item = prevReminders[itemIndex];
      let updatedList = [...prevReminders];

      if (status === 'completed') {
        updatedList.splice(itemIndex, 1);
        updatedList.push(item);
      } else if (status === 'skipped') {
        updatedList.splice(itemIndex, 1);
      } else if (status === 'refill') {
        console.log("Refill requested for:", item.medicineIdentifier || item.title);
        if (item.medicineIdentifier) {
          setCartItems(prevCart => [...prevCart, item.medicineIdentifier!]);
          console.log("Added to cart:", item.medicineIdentifier);
          router.push('/cart'); 
        } else {
          console.warn("Cannot refill, medicine identifier missing for:", item.title);
        }
        updatedList.splice(itemIndex, 1);
      } else if (status === 'modify') {
        setReminderToModify(item);
        setModifiedSchedule(item.schedule); 
        setModifiedDate(item.date ? new Date(item.date) : undefined); 
        setIsModifyModalVisible(true);
        return prevReminders; 
      }
      return updatedList; 
    });
  }, [router]); // Added router dependency

  // --- Handlers for Modification Modal ---
  const handleSaveChanges = () => {
    if (!reminderToModify) return;
    const formattedDate = modifiedDate ? modifiedDate.toISOString().split('T')[0] : undefined; // Format date back to YYYY-MM-DD
    console.log(`Saving changes for ${reminderToModify.id}: New Date - ${formattedDate}, New schedule - ${modifiedSchedule}`);
    setReminders(prev => prev.map(r => 
      r.id === reminderToModify.id ? { ...r, date: formattedDate, schedule: modifiedSchedule } : r
    ));
    closeModifyModal();
  };

  const closeModifyModal = () => {
    setIsModifyModalVisible(false);
    setReminderToModify(null);
    setModifiedSchedule('');
    setModifiedDate(undefined); // Reset date state
  };
  // --- End Handlers for Modification Modal ---

  // Estimate height for ~3 items + padding/gaps
  // Adjusted height for 3 items
  const reminderContainerHeight = 240; 

  // Ensure this FAB only appears on the home tab
  const isHomeTab = pathname === '/(tabs)/home';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Add StatusBar with dark content (black text) */}
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>MystWell</Text>
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

          {/* Container with fixed height and border */}
          <View style={[styles.remindersContainer, { height: reminderContainerHeight }]}>
            {reminders.length > 0 ? (
              // Re-added inner ScrollView
              <ScrollView 
                nestedScrollEnabled={true} // Helps with gesture handling on Android
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.remindersList}>
                  {reminders.map((reminder, index) => (
                    <ReminderItem
                      key={reminder.id}
                      id={reminder.id}
                      title={reminder.title}
                      schedule={reminder.schedule}
                      type={reminder.type}
                      isTopReminder={index === 0}
                      onUpdateStatus={handleUpdateReminderStatus}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : (
              // Empty state needs adjustments due to fixed height
              <View style={styles.emptyRemindersContainer}>
                <Text style={styles.emptyRemindersText}>No reminders for today!</Text>
              </View>
            )}
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
                icon="file-plus-outline"
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

      {/* --- Modification Modal --- */}
      <Portal>
        <Modal 
          visible={isModifyModalVisible} 
          onDismiss={closeModifyModal} 
          contentContainerStyle={[styles.modifyModalContainer, { backgroundColor: theme.colors.surface }]} 
        >
          {reminderToModify && (
            <>
              <Text variant="titleLarge" style={styles.modifyModalTitle}>Modify Appointment</Text>
              <Text variant="titleMedium" style={styles.modifyModalSubTitle}>{reminderToModify.title}</Text>
              
              {/* Replaced TextInput with Button to open Date Picker */}
              <TouchableOpacity onPress={showDatePicker} style={styles.datePickerButton}>
                <Text style={styles.datePickerButtonText}>
                  {modifiedDate ? modifiedDate.toLocaleDateString() : 'Select Date'}
                </Text>
              </TouchableOpacity>
              
              <TextInput
                label="New Time/Schedule"
                value={modifiedSchedule}
                onChangeText={setModifiedSchedule}
                mode="outlined"
                style={styles.modifyInput}
              />
              <View style={styles.modifyModalActions}>
                <Button onPress={closeModifyModal} style={styles.modifyModalButton}>Cancel</Button>
                <Button mode="contained" onPress={handleSaveChanges} style={styles.modifyModalButton}>Save Changes</Button>
              </View>
            </>
          )}
        </Modal>
      </Portal>
      {/* --- End Modification Modal --- */}

      {/* --- Date Picker Modal --- */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        date={modifiedDate || new Date()} // Default to today if no date selected
      />
      {/* --- End Date Picker Modal --- */}

      {/* FAB Group positioned above the tab bar */}
      <Portal>
        <FAB.Group
          open={fabOpen}
          visible={isHomeTab} // Only visible on home tab
          icon={fabOpen ? 'close' : 'plus'}
          actions={[
            {
              // Try filled icon version
              icon: 'file-plus-outline', 
              label: 'Add Document',
              onPress: () => router.push('/document'), 
              style: styles.fabAction, 
              labelTextColor: theme.colors.onSurface, 
              color: theme.colors.tertiaryContainer,
            },
            {
              icon: 'bell-plus-outline',
              label: 'Add Reminder',
              onPress: () => console.log('Add Reminder pressed'), 
              style: styles.fabAction, 
              labelTextColor: theme.colors.onSurface, 
              color: theme.colors.primary, // Set icon color explicitly
            },
            {
              icon: 'microphone-plus', 
              label: 'Record',
              onPress: () => router.push('/record'), 
              style: styles.fabAction, 
              labelTextColor: theme.colors.onSurface, 
              color: theme.colors.primary, // Set icon color explicitly
            },
          ].reverse()} 
          onStateChange={({ open }) => setFabOpen(open)}
          onPress={() => {
            if (fabOpen) { /* Optional action */ }
          }}
          backdropColor="transparent"
          fabStyle={{
            backgroundColor: theme.colors.primary,
            borderRadius: 28 
          }}
          style={[styles.fabGroupContainer, { bottom: tabBarHeight + 16 }]}
          color={theme.colors.onPrimary} 
        />
      </Portal>
    </SafeAreaView>
  );
}

// Define the styles factory function outside the component
const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 80 + 16 + 30, // Example: Reduced extra padding
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: 'bold',
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
    // Re-add fixed height
    // Keep border and padding styles
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant, 
    borderRadius: 16, 
    paddingVertical: 12, // Padding applied vertically
    paddingHorizontal: 8, // Reduced horizontal padding slightly
    backgroundColor: theme.colors.surface, 
    overflow: 'hidden', // Clip the inner scroll view
  },
  remindersList: {
    gap: 8,
    paddingBottom: 4, // Add a little padding at the bottom of the list itself
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
  emptyRemindersContainer: {
    // Adjust styles for fixed height container
    height: '100%', // Fill the fixed height container
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // Removed explicit background/border, inherits from container
    borderRadius: 12, 
  },
  emptyRemindersText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  // --- Styles for Modification Modal ---
  modifyModalContainer: {
      padding: 24,
      margin: 20,
      borderRadius: 16,
  },
  modifyModalTitle: {
      textAlign: 'center',
      marginBottom: 8,
      fontWeight: 'bold',
  },
  modifyModalSubTitle: {
      textAlign: 'center',
      marginBottom: 20,
      color: theme.colors.onSurfaceVariant,
  },
  // Style for the date picker touchable area
  datePickerButton: {
    borderWidth: 1.5,
    borderColor: theme.colors.outline, // Match input border
    borderRadius: 12, // Match input radius
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 20, // Match input margin
    backgroundColor: theme.colors.surface, // Match input background
  },
  datePickerButtonText: {
    fontSize: 16, // Match input text size
    color: theme.colors.onSurface, // Match input text color
  },
  modifyInput: {
      marginBottom: 20,
      backgroundColor: theme.colors.surface, // Ensure background is set
  },
  modifyModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
  },
  modifyModalButton: {
    // Add specific styling if needed, e.g., minWidth
  },
  // --- End Styles for Modification Modal ---
  // Style for the FAB group container (positioning)
  fabGroupContainer: {
    position: 'absolute',
    right: 16,
    // Bottom is set dynamically inline
  },
  // Style for the individual action buttons
  fabAction: {
    backgroundColor: theme.colors.surface, 
    borderRadius: 12, 
    elevation: 2, 
    // Add explicit padding if needed, though FAB.Group might control this
    // paddingHorizontal: 8, 
    // paddingVertical: 4,
  },
}); 