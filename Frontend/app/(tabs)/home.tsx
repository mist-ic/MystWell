import React, { useState, useCallback, useMemo, useEffect, createContext, useContext } from 'react';
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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useDocumentModal } from '@/context/DocumentModalContext';

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
    title: "Take MB Multivitamin",
    schedule: "Morning",
    type: "meal",
    medicineIdentifier: "MB Multivitamin",
  },
  {
    id: '2',
    title: "Take Creatine",
    schedule: "After gym",
    type: "meal",
    medicineIdentifier: "Creatine 5g",
  },
  {
    id: '3',
    title: "Take Dolo 650mg",
    schedule: "After dinner",
    type: "meal",
    medicineIdentifier: "Dolo 650mg",
  },
  {
    id: '4',
    title: "Drink Protein Shake",
    schedule: "Post workout",
    type: "meal",
    medicineIdentifier: "Whey Protein",
  },
  {
    id: '5',
    title: "Take Fish Oil",
    schedule: "With breakfast",
    type: "meal",
    medicineIdentifier: "Omega 3 Fish Oil",
  },
  {
    id: '6',
    title: "Gym Session",
    schedule: "5:30 PM",
    type: "appointment",
  },
];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname(); // Get current route path
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const { showAddDocumentModal } = useDocumentModal();
  
  // --- State for Modification Modal ---
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false);
  const [reminderToModify, setReminderToModify] = useState<Reminder | null>(null);
  const [modifiedSchedule, setModifiedSchedule] = useState('');
  const [modifiedDate, setModifiedDate] = useState<Date | undefined>(undefined); // Use Date object
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false); // State for date picker modal
  
  // --- State for Add Reminder Modal ---
  const [isAddReminderModalVisible, setIsAddReminderModalVisible] = useState(false);
  
  // --- Simplified Cart State (Example) ---
  const [cartItems, setCartItems] = useState<string[]>([]); // Store medicine identifiers
  
  // --- State for FAB Group ---
  const [fabOpen, setFabOpen] = useState(false);
  
  // --- State for greeting ---
  const [greeting, setGreeting] = useState('Hello');
  
  // Get the bottom tab bar height
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (e) {
    console.warn("Couldn't get bottom tab bar height. FAB might overlap.");
    tabBarHeight = 60; // Example fallback
  }

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good morning');
    } else if (hour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  // Format current date to display in header
  const formattedDate = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }, []);

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
  }, [router]);

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

  // Calculate the percent elapsed between last check and next check
  const progressPercent = 65; // Example value - replace with actual calculation

  // Ensure this FAB only appears on the home tab
  const isHomeTab = pathname === '/(tabs)/home' || pathname === '/home';
  console.log('Current pathname:', pathname, 'isHomeTab:', isHomeTab);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Bar */}
        <View style={styles.headerContainer}>
          {/* App Name */}
          <Text variant="headlineMedium" style={styles.appTitle}>MystWell</Text>
          {/* User Avatar */}
          <TouchableOpacity 
            style={styles.avatarButton}
            onPress={() => router.push('/profile')}
            accessibilityLabel="Open profile"
          >
            <Avatar.Icon 
              size={40} 
              icon="account" 
              style={styles.avatar}
              color={theme.colors.onPrimaryContainer}
            />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={styles.greetingContainer}>
          <Text variant="titleLarge" style={styles.greetingText}>
            {greeting}, Poorav 👋
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelContainer}>
            <Text style={styles.progressLabel}>Last check: 2 days ago</Text>
            <Text style={styles.progressLabel}>Next: Today, 3 PM</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Reminders Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Today's Reminders
            </Text>
            <Text variant="bodyMedium" style={styles.date}>{formattedDate}</Text>
          </View>

          {/* Container with reminders */}
          <View style={styles.remindersContainer}>
            {reminders.length > 0 ? (
              <ScrollView 
                nestedScrollEnabled={true}
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
              <View style={styles.emptyRemindersContainer}>
                <Text style={styles.emptyRemindersText}>No reminders for today!</Text>
                <Button 
                  mode="contained" 
                  icon="plus" 
                  style={styles.addReminderButton}
                  onPress={() => console.log('Add Reminder pressed')}
                >
                  Add Reminder
                </Button>
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
                onPress={() => showAddDocumentModal()}
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
        
        {/* Add Reminder Options Modal */}
        <Modal
          visible={isAddReminderModalVisible}
          onDismiss={() => setIsAddReminderModalVisible(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Add Reminder</Text>
          <Text variant="bodyMedium" style={styles.modalSubtitle}>Choose how you want to add a reminder</Text>
          
          <View style={styles.modalOptionsContainer}>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsAddReminderModalVisible(false);
                // Add logic for manual reminder entry here
                console.log("Add manually selected");
              }}
            >
              <View style={styles.modalOptionIconContainer}>
                <MaterialCommunityIcons name="pencil" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.modalOptionContent}>
                <Text variant="titleMedium" style={styles.modalOptionTitle}>Add Manually</Text>
                <Text variant="bodySmall" style={styles.modalOptionDescription}>
                  Create a reminder by entering details yourself
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setIsAddReminderModalVisible(false);
                // Navigate to recording screen
                router.push('/record');
              }}
            >
              <View style={styles.modalOptionIconContainer}>
                <MaterialCommunityIcons name="microphone" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.modalOptionContent}>
                <Text variant="titleMedium" style={styles.modalOptionTitle}>Record</Text>
                <Text variant="bodySmall" style={styles.modalOptionDescription}>
                  Create a reminder by recording your voice
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <Button 
            onPress={() => setIsAddReminderModalVisible(false)}
            style={styles.modalCancelButton}
          >
            Cancel
          </Button>
        </Modal>

        {/* --- Date Picker Modal --- */}
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={hideDatePicker}
          date={modifiedDate || new Date()}
        />
      </Portal>

      {/* FAB for adding items - Using direct positioning instead of Portal */}
      {isHomeTab && (
        <>
          <View style={[styles.fabContainer, { bottom: tabBarHeight + 16 }]}>
            <FAB
              icon="plus"
              style={styles.fab}
              onPress={() => setFabOpen(!fabOpen)} 
              color={theme.colors.onPrimary}
            />
          </View>
          
          {fabOpen && (
            <View style={[styles.fabMenu, { bottom: tabBarHeight + 16 + 56 }]}>
              <TouchableOpacity 
                style={styles.fabMenuItem}
                onPress={() => {
                  setFabOpen(false);
                  router.push('/record');
                }}
              >
                <View style={styles.fabMenuItemIcon}>
                  <MaterialCommunityIcons name="microphone" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.fabMenuItemText}>Record</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.fabMenuItem}
                onPress={() => {
                  setFabOpen(false);
                  setIsAddReminderModalVisible(true);
                }}
              >
                <View style={styles.fabMenuItemIcon}>
                  <MaterialCommunityIcons name="bell-plus" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.fabMenuItemText}>Add Reminder</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.fabMenuItem}
                onPress={() => {
                  setFabOpen(false);
                  showAddDocumentModal();
                }}
              >
                <View style={styles.fabMenuItemIcon}>
                  <MaterialCommunityIcons name="file-plus" size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.fabMenuItemText}>Add Document</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {fabOpen && (
            <View style={styles.fabBackdrop}>
              <TouchableOpacity 
                style={{width: '100%', height: '100%'}}
                onPress={() => setFabOpen(false)}
              />
            </View>
          )}
        </>
      )}
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
    paddingBottom: 80 + 16 + 30,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    marginBottom: 8,
  },
  appTitle: {
    fontWeight: '600',
    color: '#111827',
  },
  avatarButton: {
    borderRadius: 20,
  },
  avatar: {
    backgroundColor: theme.colors.primaryContainer,
  },
  greetingContainer: {
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#111827',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
  },
  remindersContainer: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    minHeight: 200,
    maxHeight: 300,
    overflow: 'hidden',
  },
  remindersList: {
    gap: 12,
    paddingBottom: 4,
  },
  emptyRemindersContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyRemindersText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 16,
  },
  addReminderButton: {
    borderRadius: 8,
  },
  quickActionsGrid: {
    gap: 16,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 16,
  },
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
  datePickerButton: {
    borderWidth: 1.5,
    borderColor: theme.colors.outline,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 20,
    backgroundColor: theme.colors.surface,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  modifyInput: {
    marginBottom: 20,
    backgroundColor: theme.colors.surface,
  },
  modifyModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modifyModalButton: {
    // Add specific styling if needed
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    zIndex: 3,
  },
  fab: {
    backgroundColor: '#4F46E5',
    borderRadius: 28,
  },
  fabMenu: {
    position: 'absolute',
    right: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 2,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  fabMenuItemIcon: {
    marginRight: 12,
  },
  fabMenuItemText: {
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  modalContainer: {
    padding: 24,
    margin: 20,
    borderRadius: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.onSurfaceVariant,
  },
  modalOptionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalOptionIconContainer: {
    width: 48, 
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalOptionDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  modalCancelButton: {
    marginTop: 8,
  },
}); 