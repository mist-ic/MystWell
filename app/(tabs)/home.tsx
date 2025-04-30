import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Platform, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Text, useTheme, FAB, Avatar, Portal, Modal, TextInput, Button, MD3Theme, Chip, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// Removed StatusItem import as it wasn't used in old code
import { ReminderItem } from '@/components/ui/ReminderItem'; // Ensure correct import path
import { QuickActionCard } from '@/components/ui/Card/QuickActionCard';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import PlatformDateTimePicker from '@/components/ui/PlatformDateTimePicker';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useDocumentModal } from '@/context/DocumentModalContext';
import { useAuth } from '@/context/auth';
import { format, parseISO, isValid } from 'date-fns';

// --- Backend Reminder Type Definition ---
export enum FrequencyType {
  DAILY = 'daily',
  SPECIFIC_DAYS = 'specific_days',
  INTERVAL = 'interval',
  AS_NEEDED = 'as_needed',
}

interface BackendReminder {
  id: string; // UUID
  title: string;
  notes?: string | null;
  frequency_type: FrequencyType;
  times_of_day: string[]; // Array of HH:mm strings
  days_of_week?: number[] | null; // Array of 0-6, null if not applicable
  interval_days?: number | null; // Null if not applicable
  start_date: string; // YYYY-MM-DD string
  end_date?: string | null; // YYYY-MM-DD string, null if not set
  is_active: boolean;
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
  user_id: string; // UUID
}
// --- End Backend Reminder Type Definition ---

// --- Modification Form State ---
// NOTE: The old code used a simpler modification modal (only schedule/date)
// We keep the more detailed modification form state from the previous step
// as it aligns better with the backend capabilities, but the old modal UI is simpler.
interface ModifyReminderFormState {
  title: string;
  notes: string;
  frequency_type: FrequencyType;
  days_of_week: number[];
  times_of_day: Date[];
  interval_days: number | null;
  start_date: Date;
  end_date: Date | null;
}
// --- End Modification Form State ---

export default function HomeScreen() {
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, session } = useAuth();
  const [reminders, setReminders] = useState<BackendReminder[]>([]);
  const { showAddDocumentModal } = useDocumentModal();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Modification Modal State (More detailed form state, but use old modal UI for simplicity) ---
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false);
  const [reminderToModify, setReminderToModify] = useState<BackendReminder | null>(null);
  // Use simpler state from old code for the simple modal UI
  const [modifiedSchedule, setModifiedSchedule] = useState('');
  const [modifiedDate, setModifiedDate] = useState<Date | undefined>(undefined);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  // --- End Modification Modal State ---

  // --- FAB state from .old.home ---
  const [fabOpen, setFabOpen] = useState(false);
  // --- End FAB state ---

  const [greeting, setGreeting] = useState('Hello');

  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (e) {
    console.warn("Couldn't get bottom tab bar height. FAB might overlap.");
    tabBarHeight = 60; // Example fallback
  }

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const formattedDate = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }, []);

  const styles = React.useMemo(() => createStyles(theme, tabBarHeight), [theme, tabBarHeight]); // Pass tabBarHeight

  // --- API Call Helper ---
  const callApi = useCallback(async (endpoint: string, method: string, body?: any) => {
    const backendUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!backendUrl) throw new Error("Backend API URL is not configured.");
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("Authentication token is missing.");

    const response = await fetch(`${backendUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
    }
    return response.status === 204 ? null : await response.json();
  }, [session]);

  // --- Fetch Reminders Logic ---
  const fetchReminders = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const fetchedReminders = await callApi('/reminders', 'GET');
      setReminders(fetchedReminders || []);
    } catch (err: any) {
      console.error("Error fetching reminders:", err);
      setError(err.message || 'Failed to load reminders. Pull down to refresh.');
      setReminders([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [callApi]);

  useFocusEffect(useCallback(() => { fetchReminders(); }, [fetchReminders]));
  const onRefresh = useCallback(() => { setIsRefreshing(true); fetchReminders(); }, [fetchReminders]);
  // --- End Fetch Reminders Logic ---

  // --- Modification Modal Handlers (Simplified like .old.home) ---
   const openModifyModal = (reminder: BackendReminder) => {
     setReminderToModify(reminder);
     // Attempt to parse the schedule string for time, fall back otherwise
     // This is brittle, ideally backend provides structured time/date info
     const timeMatch = reminder.times_of_day[0]; // Just use first time for simplicity
     setModifiedSchedule(timeMatch || formatSchedule(reminder)); // Fallback to full schedule string

     // Use start_date as the initial date for the picker
     const initialDate = parseISO(reminder.start_date + 'T00:00:00');
     setModifiedDate(isValid(initialDate) ? initialDate : new Date());

     setIsModifyModalVisible(true);
   };

  const closeModifyModal = () => {
    setIsModifyModalVisible(false);
    setReminderToModify(null);
    setModifiedSchedule('');
    setModifiedDate(undefined);
  };

  const handleConfirmDate = (date: Date) => {
    setModifiedDate(date);
    setDatePickerVisibility(false);
  };

  const handleSaveChanges = async () => {
     if (!reminderToModify || !modifiedDate) return;

     // --- Prepare Update DTO (Simplified based on old modal) ---
     // This only updates title (kept same), start_date and the first time_of_day
     // Other fields like frequency, notes, end_date, days_of_week etc. remain unchanged
     // WARNING: This is a simplified PATCH based on the old UI.
     // For full updates, the more detailed modal from previous steps is needed.
     const updateDto = {
         // title: reminderToModify.title, // Title usually doesn't change in simple modify
         start_date: format(modifiedDate, 'yyyy-MM-dd'),
         // Attempt to update the first time slot based on modifiedSchedule
         // Assuming modifiedSchedule is HH:mm format, otherwise this will be wrong
         times_of_day: [modifiedSchedule || reminderToModify.times_of_day[0] || '09:00', ...reminderToModify.times_of_day.slice(1)],
         // Keep other fields potentially from the original reminder if PATCH needs them
         // notes: reminderToModify.notes,
         // frequency_type: reminderToModify.frequency_type,
         // days_of_week: reminderToModify.days_of_week,
         // interval_days: reminderToModify.interval_days,
         // end_date: reminderToModify.end_date,
     };
     // --- End Prepare DTO ---

     console.log('Submitting Simplified Update DTO:', JSON.stringify(updateDto, null, 2));
     setIsSubmittingUpdate(true);

     try {
         await callApi(`/reminders/${reminderToModify.id}`, 'PATCH', updateDto);
         Alert.alert('Success', 'Reminder updated (simplified).');
         closeModifyModal();
         fetchReminders(); // Refresh list
     } catch (err: any) {
         console.error("Error updating reminder (simplified):", err);
         Alert.alert('Error', `Failed to update reminder: ${err.message}`);
     } finally {
         setIsSubmittingUpdate(false);
     }
   };
  // --- End Simplified Modification Handlers ---


  // --- Delete Reminder Handler ---
  const handleDeleteReminder = (id: string, title: string) => {
    Alert.alert(
      "Confirm Deletion", `Are you sure you want to delete "${title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            setIsLoading(true);
            try {
              await callApi(`/reminders/${id}`, 'DELETE');
              Alert.alert('Success', 'Reminder deleted.');
              fetchReminders();
            } catch (err: any) {
              console.error("Error deleting reminder:", err);
              Alert.alert('Error', `Failed to delete reminder: ${err.message}`);
              setIsLoading(false);
            }
          },
          style: "destructive"
        }
      ]
    );
  };
  // --- End Delete Reminder Handler ---


  // --- Reminder Item Action Handler ---
  // Matches .old.home's handleUpdateReminderStatus structure
  const handleUpdateReminderStatus = useCallback((id: string, action: 'completed' | 'skipped' | 'modify' | 'refill') => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    console.log(`Action '${action}' triggered for reminder:`, reminder.title);

    if (action === 'modify') {
        openModifyModal(reminder); // Open the simplified modal
    } else if (action === 'skipped' || action === 'completed') {
        // Treat both as delete for now (like .old.home local logic)
        handleDeleteReminder(id, reminder.title);
    } else if (action === 'refill') {
        // This action was present in old item but doesn't fit backend model well
        console.log("Refill action triggered but not implemented for backend:", reminder.title);
        // Optionally navigate to cart or show message
        // For now, we might just delete it like skipped/completed
        handleDeleteReminder(id, reminder.title);
    }
  }, [reminders, callApi, fetchReminders]); // Dependencies
  // --- End Reminder Item Action Handler ---


  // --- Helper to format schedule string for display ---
  const formatSchedule = (reminder: BackendReminder): string => {
      // Keep the detailed formatter
      const timeString = reminder.times_of_day.join(', ');
      switch (reminder.frequency_type) {
          case FrequencyType.DAILY: return `Daily at ${timeString}`;
          case FrequencyType.SPECIFIC_DAYS:
              const days = reminder.days_of_week?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'days';
              return `On ${days} at ${timeString}`;
          case FrequencyType.INTERVAL: return `Every ${reminder.interval_days} days at ${timeString}`;
          case FrequencyType.AS_NEEDED: return 'As Needed';
          default: return `Scheduled: ${timeString}`; // Fallback
      }
  };
  // --- End Helper ---


  const progressPercent = 65; // Example value from old code
  const isHomeTab = pathname === '/(tabs)/home' || pathname === '/home';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {/* Top Bar - From .old.home */}
        <View style={styles.headerContainer}>
          <Text variant="headlineMedium" style={styles.appTitle}>MystWell</Text>
          <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/profile')} accessibilityLabel="Open profile">
            <Avatar.Icon size={40} icon="account" style={styles.avatar} color={theme.colors.onPrimaryContainer}/>
          </TouchableOpacity>
        </View>

        {/* Greeting - From .old.home */}
        <View style={styles.greetingContainer}>
          <Text variant="titleLarge" style={styles.greetingText}>
            {greeting}, {profile?.full_name || 'there'} 👋
          </Text>
        </View>

        {/* Progress Indicator - From .old.home */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelContainer}>
            <Text style={styles.progressLabel}>Last check: 2 days ago</Text>
            <Text style={styles.progressLabel}>Next: Today, 3 PM</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Reminders Section - Structure from .old.home */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleLarge" style={styles.sectionTitle}>Today's Reminders</Text>
            <Text variant="bodyMedium" style={styles.date}>{formattedDate}</Text>
          </View>

           {isLoading && <ActivityIndicator animating={true} size="large" style={{ marginVertical: 20 }} />}

           {!isLoading && error && (
               <View style={styles.errorContainer}>
                   <Text style={styles.errorText}>{error}</Text>
                   <Button mode="outlined" onPress={fetchReminders}>Try Again</Button>
               </View>
           )}

           {/* Reminder Container from .old.home */}
           {!isLoading && !error && (
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
                            schedule={formatSchedule(reminder)} // Use detailed schedule
                            // Determine type based on old logic (or default)
                            // This is heuristic, backend should ideally provide type
                            type={reminder.title.toLowerCase().includes('session') || reminder.title.toLowerCase().includes('appointment') ? 'appointment' : 'meal'}
                            isTopReminder={index === 0}
                            onUpdateStatus={handleUpdateReminderStatus} // Use the handler matching old prop
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
                           onPress={() => router.push('/(tabs)/add')} // Go to add screen
                         >
                           Add Reminder
                         </Button>
                     </View>
                  )}
                </View>
            )}
        </View>

        {/* Quick Actions Section - From .old.home */}
        {!isLoading && !error && (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <View style={styles.quickActionRow}>
                <QuickActionCard title="Record" description="Capture your health data" icon="microphone" onPress={() => router.push('/(tabs)/record')}/>
                <QuickActionCard title="Add/Manage" description="View & track items" icon="pill" onPress={() => router.push('/(tabs)/add')}/>
              </View>
              <View style={styles.quickActionRow}>
                <QuickActionCard title="Documents" description="Manage medical documents" icon="file-document-outline" onPress={() => router.push('/(tabs)/document')}/>
                <QuickActionCard title="Health Buddy" description="Get medical assistance" icon="chat-question-outline" onPress={() => router.push('/(tabs)/chat')}/>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* --- Simplified Modification Modal (like .old.home) --- */}
      <Portal>
        <Modal
          visible={isModifyModalVisible}
          onDismiss={closeModifyModal}
          contentContainerStyle={[styles.modifyModalContainerStyle, { backgroundColor: theme.colors.surface }]} // Use specific style name
        >
          {reminderToModify && (
            <>
              <Text variant="titleLarge" style={styles.modifyModalTitle}>Modify Reminder</Text>
              <Text variant="titleMedium" style={styles.modifyModalSubTitle}>{reminderToModify.title}</Text>

              <TouchableOpacity onPress={() => setDatePickerVisibility(true)} style={styles.datePickerButton}>
                <Text style={styles.datePickerButtonText}>
                  {modifiedDate ? modifiedDate.toLocaleDateString() : 'Select Date'}
                </Text>
              </TouchableOpacity>

              <TextInput
                label="New Time/Schedule (e.g., HH:mm)" // Guide user
                value={modifiedSchedule}
                onChangeText={setModifiedSchedule}
                mode="outlined"
                style={styles.modifyInput}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} // Adjust keyboard
              />
              <View style={styles.modifyModalActions}>
                <Button onPress={closeModifyModal} style={styles.modifyModalButton} disabled={isSubmittingUpdate}>Cancel</Button>
                <Button mode="contained" onPress={handleSaveChanges} style={styles.modifyModalButton} loading={isSubmittingUpdate} disabled={isSubmittingUpdate}>
                  {isSubmittingUpdate ? 'Saving...' : 'Save Changes'}
                </Button>
              </View>
            </>
          )}
        </Modal>

         {/* --- Date Picker Modal (from .old.home) --- */}
         <PlatformDateTimePicker
           isVisible={isDatePickerVisible}
           mode="date" // Old modal only modified date
           onConfirm={handleConfirmDate}
           onCancel={() => setDatePickerVisibility(false)}
           date={modifiedDate || new Date()} // Use state date
         />
      </Portal>
      {/* --- End Simplified Modification Modal --- */}


      {/* --- Restore FAB Group from .old.home (Adapted Actions) --- */}
      <Portal>
          <FAB.Group
             open={fabOpen}
             visible={isHomeTab} // Only show on home tab
             icon={fabOpen ? 'close' : 'plus'}
             color="white"
             actions={[
               { 
                 icon: 'microphone', 
                 label: 'Record', 
                 onPress: () => router.push('/(tabs)/record'),
                 size: 'small',
                 // Add style to prevent button nesting
                 containerStyle: { pointerEvents: 'auto' }
               },
               { 
                 icon: 'bell-plus-outline', 
                 label: 'Add Reminder', 
                 onPress: () => router.push('/(tabs)/add'),
                 size: 'small',
                 // Add style to prevent button nesting
                 containerStyle: { pointerEvents: 'auto' }
               },
               { 
                 icon: 'file-plus-outline', 
                 label: 'Add Document', 
                 onPress: showAddDocumentModal,
                 size: 'small',
                 // Add style to prevent button nesting
                 containerStyle: { pointerEvents: 'auto' }
               },
             ]}
             onStateChange={({ open }) => setFabOpen(open)}
             onPress={() => {}}
             style={styles.fabGroupStyle} // Use specific style name
             fabStyle={styles.fabStyle} // Use specific style name
           />
      </Portal>
      {/* --- End Restore FAB Group --- */}

    </SafeAreaView>
  );
}

// Helper function to capitalize (if not imported from elsewhere)
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Define the styles factory function outside the component
// Merge styles from .old.home and previous steps
const createStyles = (theme: MD3Theme, tabBarHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
  },
  // Use scrollContent padding from .old.home
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: tabBarHeight, // Minimal padding, just enough for the tab bar
  },
  // Use header styles from .old.home
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    marginBottom: 8,
  },
  appTitle: {
    fontWeight: '600',
    color: '#111827', // Consider using theme.colors.onBackground
    fontSize: 20, // Match old style
  },
  avatarButton: {
    borderRadius: 20,
  },
  avatar: {
    backgroundColor: theme.colors.primaryContainer,
  },
  // Use greeting styles from .old.home
  greetingContainer: {
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#111827', // Consider using theme.colors.onBackground
  },
  // Use progress styles from .old.home
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
    color: '#6B7280', // Consider theme.colors.onSurfaceVariant
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB', // Consider theme.colors.surfaceVariant or outline
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5', // Consider theme.colors.primary
    borderRadius: 4,
  },
  // Use section styles from .old.home
  section: {
    marginBottom: 16,
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
    color: '#111827', // Consider theme.colors.onBackground
  },
  // Use date style from .old.home
  date: {
    fontSize: 14,
    color: '#6B7280', // Consider theme.colors.onSurfaceVariant
  },
  // Use reminder container styles from .old.home
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
  // Use empty reminder styles from .old.home
  emptyRemindersContainer: {
    height: '100%', // Fill the container
    minHeight: 150, // Ensure it's not too small
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyRemindersText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 16,
    textAlign: 'center',
  },
  addReminderButton: {
    borderRadius: 8,
  },
  // Use quick actions styles from .old.home
  quickActionsGrid: {
    gap: 16,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 16,
  },
   // Error container styles (keep from previous step)
   errorContainer: {
     alignItems: 'center',
     marginHorizontal: 20,
     marginTop: 30,
     padding: 20,
     backgroundColor: theme.colors.errorContainer,
     borderRadius: theme.roundness,
   },
   errorText: {
     color: theme.colors.onErrorContainer,
     marginBottom: 15,
     textAlign: 'center',
   },

   // Styles for the simplified modification modal (from .old.home)
   modifyModalContainerStyle: { // Use distinct name
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
   datePickerButton: { // For the touchable opacity triggering the date picker
     borderWidth: 1.5,
     borderColor: theme.colors.outline,
     borderRadius: 12,
     paddingVertical: 16,
     paddingHorizontal: 12,
     marginBottom: 20,
     backgroundColor: theme.colors.surface, // Ensure contrast
   },
   datePickerButtonText: {
     fontSize: 16,
     color: theme.colors.onSurface, // Ensure contrast
     textAlign: 'center',
   },
   modifyInput: {
     marginBottom: 20,
     backgroundColor: theme.colors.surface, // Ensure contrast
   },
   modifyModalActions: {
     flexDirection: 'row',
     justifyContent: 'flex-end',
     gap: 8,
   },
   modifyModalButton: {
     // Style if needed
   },

  // FAB Group styles based on .old.home
  fabGroupStyle: { // Style for the FAB.Group container
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    paddingBottom: tabBarHeight, // Dynamic padding
  },
  fabStyle: { // Style for the main FAB itself
    backgroundColor: '#4F46E5', // Use color from old style or theme.colors.primary
    borderRadius: 28,
  },
});