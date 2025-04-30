import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Animated, ActivityIndicator, FlatList, Platform, Alert } from 'react-native';
import { Text, useTheme, Searchbar, Surface, Button, Portal, Modal, Chip, List, Divider, ProgressBar, FAB, Badge, MD3Theme, TextInput, Switch, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import debounce from 'lodash.debounce';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AppHeader from '@/components/AppHeader';
import { StyledSearchBar } from '@/components/ui/StyledSearchBar';
import { searchDrugsApproximate, DrugConcept } from '@/services/medicineService';
import { useAuth } from '@/context/auth';
import { format } from 'date-fns';

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  purpose: string;
  composition: string[];
  sideEffects: string[];
  substitutes: string[];
  isActive: boolean;
  quantity: {
    current: number;
    total: number;
    unit: string;
  };
}

// --- Updated Reminder State to match Backend DTO ---
// Corresponds to Backend's FrequencyType enum
export enum FrequencyType {
  DAILY = 'daily',
  SPECIFIC_DAYS = 'specific_days',
  INTERVAL = 'interval',
  AS_NEEDED = 'as_needed',
}

interface ReminderFormState {
  title: string; // Changed from medicineName
  notes: string;
  frequency_type: FrequencyType; // Changed from frequency
  days_of_week: number[]; // Renamed from selectedDays, used when frequency_type is SPECIFIC_DAYS
  times_of_day: Date[]; // Renamed from times, stores Date objects for picker, will format before sending
  interval_days: number | null; // Added for INTERVAL frequency
  start_date: Date; // Renamed from startDate
  end_date: Date | null; // Renamed from endDate
  // is_active is managed by backend
}

const initialReminderFormState: ReminderFormState = {
  title: '',
  notes: '',
  frequency_type: FrequencyType.DAILY,
  days_of_week: [],
  times_of_day: [new Date()], // Default to one time slot, current time
  interval_days: null,
  start_date: new Date(),
  end_date: null,
};
// --- End Updated Reminder State ---

// --- Notification Handler Setup (Keep outside, as it's a side effect setup) ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
// --- End Notification Handler Setup ---

// Helper function to capitalize the first letter (Keep outside component)
const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function MedicineScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, session } = useAuth(); // Get user and session (contains token)

  const makeStyles = (theme: MD3Theme) => StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    searchContainerMargin: {
      marginTop: 8,
      marginBottom: 8,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      marginTop: 16,
      flex: 1,
    },
    sectionTitle: {
      marginBottom: 12,
      marginLeft: 8,
    },
    medicineCard: {
      marginBottom: 12,
      borderRadius: 12,
      elevation: 2,
    },
    medicineContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    medicineContentCollapsed: {
      // Styles when collapsed (if any)
    },
    medicineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    medicineInfo: {
      flex: 1,
      marginRight: 8,
    },
    medicineName: {
      fontWeight: '600',
      marginBottom: 4,
    },
    medicineSubInfo: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 8,
    },
    quantityContainer: {
      marginTop: 4,
    },
    progressBar: {
      height: 6,
      borderRadius: 3,
      marginBottom: 4,
    },
    quantityText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    detailsContainer: {
      overflow: 'hidden',
    },
    detailsContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    divider: {
      marginVertical: 12,
    },
    detailText: {
      marginBottom: 8,
      fontSize: 14,
      lineHeight: 20,
    },
    detailTitle: {
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 4,
      fontSize: 14,
    },
    detailListItem: {
      marginLeft: 16,
      fontSize: 14,
      lineHeight: 20,
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 4,
    },
    actionButtonLabel: {
      fontSize: 12,
    },
    fab: {
      position: 'absolute',
      margin: 16,
      right: 0,
      bottom: 0,
    },
    resultsList: {
        flex: 1,
    },
    apiResultItem: {
      backgroundColor: theme.colors.surface,
      marginBottom: 2,
      borderRadius: 4,
      elevation: 1,
    },
    loader: {
      marginTop: 20,
      marginBottom: 20,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 16,
    },
    infoText: {
      textAlign: 'center',
      marginTop: 20,
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
    },
      reminderFormContainer: {
          padding: 20, // Increased padding
          backgroundColor: theme.colors.background, // Or elevation overlay if preferred
          borderRadius: 12,
          marginHorizontal: 16,
          marginVertical: 40, // Adjust vertical margin
          maxHeight: '90%',
          elevation: 6, // Slightly more elevation for modal
          justifyContent: 'center', // Center content vertically if needed, depends on ScrollView
      },
      formTitle: {
          marginBottom: 20, // More space below title
          textAlign: 'center',
          color: theme.colors.primary, // Use primary color for title
      },
      inputField: {
          marginBottom: 16, // Consistent spacing
      },
      row: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16, // Consistent spacing
          justifyContent: 'space-between', // Space out elements in row
      },
      frequencySelector: {
          flexDirection: 'row',
          flexWrap: 'wrap', // Allow wrapping chips
          justifyContent: 'flex-start', // Align chips to start
          marginBottom: 16,
      },
      daySelector: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start', // Align chips to start
          marginBottom: 16,
      },
      dayChip: {
          margin: 4, // Slightly more margin
          // minWidth: 50, // Adjust as needed
          // justifyContent: 'center',
      },
      timeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingVertical: 6,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant,
      },
    });
  const styles = makeStyles(theme);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrugConcept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedMedicineId, setExpandedMedicineId] = useState<string | null>(null);

  // --- Reminder Modal State ---
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminderForm, setReminderForm] = useState<ReminderFormState>(initialReminderFormState);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [datePickerTarget, setDatePickerTarget] = useState<'start_date' | 'end_date' | 'time'>('start_date');
  const [timePickerIndex, setTimePickerIndex] = useState<number>(0); // To know which time in the array we are editing
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);
  // --- End Reminder Modal State ---

  const animationsMap = useRef<{ [key: string]: Animated.Value }>({});
  const getAnimation = (medicineId: string) => {
    if (!animationsMap.current[medicineId]) {
      animationsMap.current[medicineId] = new Animated.Value(expandedMedicineId === medicineId ? 1 : 0); // Initialize based on current state
    }
    // Ensure animation reflects current expanded state if it exists
     const animation = animationsMap.current[medicineId];
     if (expandedMedicineId === medicineId && (animation as any)._value !== 1) {
         animation.setValue(1);
     } else if (expandedMedicineId !== medicineId && (animation as any)._value !== 0) {
         animation.setValue(0);
     }
    return animation;
  };

  const currentMedications: Medicine[] = [
    {
      id: '1',
      name: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Twice daily',
      purpose: 'Antibiotic for treating bacterial infections',
      composition: ['Amoxicillin trihydrate', 'Sodium starch glycolate', 'Magnesium stearate'],
      sideEffects: ['Nausea', 'Diarrhea', 'Rash', 'Vomiting'],
      substitutes: ['Ampicillin', 'Cephalexin', 'Azithromycin'],
      isActive: true,
      quantity: {
        current: 14,
        total: 30,
        unit: 'tablets'
      }
    },
    {
      id: '2',
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      purpose: 'ACE inhibitor for blood pressure control',
      composition: ['Lisinopril dihydrate', 'Calcium phosphate', 'Mannitol'],
      sideEffects: ['Dry cough', 'Dizziness', 'Headache'],
      substitutes: ['Ramipril', 'Enalapril', 'Perindopril'],
      isActive: true,
      quantity: {
        current: 25,
        total: 30,
        unit: 'tablets'
      }
    }
  ];

  const debouncedApiSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 3) {
        setSearchResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }
      setIsSearching(true);
      setSearchError(null);
      try {
        console.log(`Searching RxNorm Approximate for: ${query}`);
        const results = await searchDrugsApproximate(query);
        setSearchResults(results);
        console.log(`Found ${results.length} approximate results.`);
      } catch (err) {
        setSearchError('Failed to fetch medicines. Please try again.');
        setSearchResults([]);
        console.error('RxNorm Approximate Search Error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 700),
    []
  );

  useEffect(() => {
    if (searchQuery.trim()) {
        debouncedApiSearch(searchQuery);
    } else {
        setSearchResults([]);
        setIsSearching(false);
        setSearchError(null);
        debouncedApiSearch.cancel(); // Cancel any pending search
    }
    return () => {
      debouncedApiSearch.cancel(); // Cleanup on unmount
    };
  }, [searchQuery, debouncedApiSearch]);
  
  const handleMedicinePress = (medicineId: string) => {
    const isCurrentlyExpanded = expandedMedicineId === medicineId;
    const animation = getAnimation(medicineId); // Get existing or create new animation value
    
    // Animate open/close
      Animated.timing(animation, {
        toValue: isCurrentlyExpanded ? 0 : 1,
        duration: 250, // Standard duration for expansion animations
        useNativeDriver: false, // height/opacity animations require this
      }).start(() => {
         // Update state AFTER animation completes
        setExpandedMedicineId(isCurrentlyExpanded ? null : medicineId);
    });
};

  const handleApiResultSelect = (drug: DrugConcept) => {
    setReminderForm(prev => ({
        ...initialReminderFormState,
        title: capitalizeFirstLetter(drug.name)
    }));
    setSearchQuery('');
    setSearchResults([]);
    setIsReminderModalVisible(true);
    console.log(`Selected: ${drug.name} (${drug.rxcui})`);
  };

  // --- Notification Permission Request ---
  const requestNotificationPermissions = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Required', 'Failed to get push token for push notification!');
        return false;
      }
      // Get the token that uniquely identifies this device
      // You might want to save this token to your backend later
      // const expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
      // console.log(expoPushToken);
      return true;
    } else {
      Alert.alert("Must use physical device for Push Notifications");
      return false;
    }
  };

  useEffect(() => {
    requestNotificationPermissions(); // Request permissions on mount
  }, []);
  // --- End Notification Permission Request ---

  // --- Reminder Form Handlers ---
  const handleReminderInputChange = (field: keyof ReminderFormState, value: any) => {
    setReminderForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFrequencyChange = (value: FrequencyType) => {
    setReminderForm(prev => ({
      ...prev,
      frequency_type: value,
      // Reset conditional fields when frequency changes
      days_of_week: value === FrequencyType.SPECIFIC_DAYS ? prev.days_of_week : [],
      interval_days: value === FrequencyType.INTERVAL ? prev.interval_days ?? 1 : null,
    }));
  };

  const handleDayToggle = (dayIndex: number) => {
    setReminderForm(prev => {
      const newDays = prev.days_of_week.includes(dayIndex)
        ? prev.days_of_week.filter(d => d !== dayIndex)
        : [...prev.days_of_week, dayIndex];
      return { ...prev, days_of_week: newDays.sort() };
    });
  };

  const handleAddTime = () => {
    setReminderForm(prev => ({
      ...prev,
      times_of_day: [...prev.times_of_day, new Date()],
    }));
  };

  const handleRemoveTime = (indexToRemove: number) => {
    setReminderForm(prev => ({
      ...prev,
      times_of_day: prev.times_of_day.filter((_, index) => index !== indexToRemove),
    }));
  };

  const showDateTimePickerModal = (mode: 'date' | 'time', type: 'start_date' | 'end_date' | 'time', index: number = 0) => {
    setDatePickerMode(mode);
    setDatePickerTarget(type);
    setTimePickerIndex(index);
    setShowDatePicker(true);
  };

  const onDateTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep visible on iOS until dismissed
    if (event.type === 'dismissed' || !selectedDate) {
        return; // User cancelled
    }

    setReminderForm(prev => {
      const newState = { ...prev };
      if (datePickerTarget === 'start_date') {
        newState.start_date = selectedDate;
      } else if (datePickerTarget === 'end_date') {
        newState.end_date = selectedDate;
      } else if (datePickerTarget === 'time') {
        const newTimes = [...newState.times_of_day];
        newTimes[timePickerIndex] = selectedDate;
        newState.times_of_day = newTimes;
      }
      return newState;
    });
  };

  // TODO: Refactor local notification scheduling based on the new reminder structure
  const scheduleLocalNotification = async (reminder: ReminderFormState) => {
    console.warn("Local notification scheduling needs to be refactored for the new reminder structure.", reminder);
    // Placeholder - Actual implementation needs logic for frequency_type, dates, times etc.
    /*
    const trigger: Notifications.NotificationTriggerInput = {
      // ... complex trigger logic based on reminderForm ...
      // daily, specific_days (weekday), interval (DateTriggerInput with repeats), time (hour, minute)
    };

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: reminder.title,
                body: reminder.notes || 'Time for your reminder!',
                sound: 'default', // Ensure you have a sound file or use default
            },
            trigger,
        });
        console.log("Notification scheduled successfully");
        Alert.alert("Reminder Set", `${reminder.title} reminder has been scheduled.`);
    } catch (error) {
        console.error("Error scheduling notification:", error);
        Alert.alert("Error", "Could not schedule the reminder notification.");
    }
    */
  };

  const handleSaveReminder = async () => {
    setIsSubmittingReminder(true);
    // --- Input Validation ---
    if (!reminderForm.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a title for the reminder.');
      setIsSubmittingReminder(false);
      return;
    }
    if (reminderForm.times_of_day.length === 0) {
       Alert.alert('Validation Error', 'Please add at least one time for the reminder.');
       setIsSubmittingReminder(false);
       return;
    }
     if (reminderForm.frequency_type === FrequencyType.SPECIFIC_DAYS && reminderForm.days_of_week.length === 0) {
        Alert.alert('Validation Error', 'Please select at least one day for weekly reminders.');
        setIsSubmittingReminder(false);
        return;
    }
    if (reminderForm.frequency_type === FrequencyType.INTERVAL && (!reminderForm.interval_days || reminderForm.interval_days < 1)) {
        Alert.alert('Validation Error', 'Please enter a valid interval (minimum 1 day).');
        setIsSubmittingReminder(false);
        return;
    }
    // --- End Validation ---

    // --- Prepare DTO for Backend ---
    const createReminderDto = {
        title: reminderForm.title.trim(),
        notes: reminderForm.notes.trim() || undefined, // Send undefined if empty, backend handles null/empty
        frequency_type: reminderForm.frequency_type,
        times_of_day: reminderForm.times_of_day.map(date => format(date, 'HH:mm')), // Format to HH:MM strings
        start_date: format(reminderForm.start_date, 'yyyy-MM-dd'), // Format to YYYY-MM-DD string
        end_date: reminderForm.end_date ? format(reminderForm.end_date, 'yyyy-MM-dd') : undefined,
        days_of_week: reminderForm.frequency_type === FrequencyType.SPECIFIC_DAYS ? reminderForm.days_of_week : undefined,
        interval_days: reminderForm.frequency_type === FrequencyType.INTERVAL ? reminderForm.interval_days : undefined,
        // is_active defaults to true in backend
    };
    // --- End Prepare DTO ---

    console.log('Submitting Reminder DTO:', JSON.stringify(createReminderDto, null, 2));

    try {
        // TODO: Replace with actual API call
        console.log("Attempting API call to POST /reminders");
        const backendUrl = process.env.EXPO_PUBLIC_API_URL; // Ensure this is configured
         if (!backendUrl) {
            throw new Error("Backend API URL is not configured in environment variables (EXPO_PUBLIC_API_URL).");
        }
        const accessToken = session?.access_token;
        if (!accessToken) {
             throw new Error("Authentication token is missing.");
        }

        const response = await fetch(`${backendUrl}/reminders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`, // Use access token from session
            },
            body: JSON.stringify(createReminderDto),
        });

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ message: response.statusText }));
             throw new Error(`Failed to create reminder: ${response.status} ${errorData.message || ''}`);
        }

        const createdReminder = await response.json(); // Assuming backend returns the created reminder
        console.log('Reminder created successfully:', createdReminder);
        Alert.alert('Success', 'Reminder created successfully!');

        // --- Schedule local notification (optional, needs rework) ---
        // await scheduleLocalNotification(reminderForm); // Call the placeholder/refactored function
        // --- End scheduling ---

        closeReminderModal(); // Close modal on success

    } catch (error: any) {
        console.error('Error saving reminder:', error);
        Alert.alert('Error', `Failed to save reminder: ${error.message || 'Please try again.'}`);
    } finally {
        setIsSubmittingReminder(false);
    }
  };

  const openReminderModal = () => {
    setReminderForm(initialReminderFormState); // Reset form when opening
    setIsReminderModalVisible(true);
  };

  const closeReminderModal = () => {
    setIsReminderModalVisible(false);
  };
  // --- End Reminder Form Handlers ---

  const renderReminderForm = () => {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
     <Portal>
      <Modal visible={isReminderModalVisible} onDismiss={closeReminderModal} contentContainerStyle={styles.reminderFormContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text variant="headlineSmall" style={styles.formTitle}>Add New Reminder</Text>

          <TextInput
            label="Reminder Title"
            value={reminderForm.title}
            onChangeText={(text) => handleReminderInputChange('title', text)}
            mode="outlined"
            style={styles.inputField}
            maxLength={100} // Add sensible max length
          />

          <TextInput
            label="Notes (Optional)"
            value={reminderForm.notes}
            onChangeText={(text) => handleReminderInputChange('notes', text)}
            mode="outlined"
            style={styles.inputField}
            multiline
            numberOfLines={3}
            maxLength={250}
          />

          <Text variant="labelLarge" style={styles.inputField}>Frequency</Text>
          <View style={styles.frequencySelector}>
             {Object.values(FrequencyType).map((freq) => (
                <Chip
                    key={freq}
                    mode="outlined" // Use 'flat' or 'outlined'
                    selected={reminderForm.frequency_type === freq}
                    onPress={() => handleFrequencyChange(freq)}
                    style={{ marginHorizontal: 2 }}
                >
                    {capitalizeFirstLetter(freq.replace('_', ' '))}
                </Chip>
             ))}
          </View>

          {reminderForm.frequency_type === FrequencyType.SPECIFIC_DAYS && (
             <View>
                <Text variant="labelLarge" style={styles.inputField}>Select Days</Text>
                <View style={styles.daySelector}>
                    {daysOfWeek.map((day, index) => (
                    <Chip
                        key={index}
                        mode="flat" // Use 'flat' or 'outlined'
                        selected={reminderForm.days_of_week.includes(index)}
                        onPress={() => handleDayToggle(index)}
                        style={styles.dayChip}
                        showSelectedCheck // Visually indicates selection
                    >
                        {day}
                    </Chip>
                    ))}
                </View>
            </View>
          )}

           {reminderForm.frequency_type === FrequencyType.INTERVAL && (
             <TextInput
                label="Repeat Every (Days)"
                value={reminderForm.interval_days?.toString() ?? ''}
                onChangeText={(text) => handleReminderInputChange('interval_days', text ? parseInt(text, 10) : null)}
                mode="outlined"
                style={styles.inputField}
                keyboardType="numeric"
             />
           )}

           <Text variant="labelLarge" style={styles.inputField}>Times per Day</Text>
           {reminderForm.times_of_day.map((time, index) => (
             <View key={index} style={styles.timeRow}>
                <Button mode="outlined" onPress={() => showDateTimePickerModal('time', 'time', index)}>
                    {format(time, 'HH:mm')}
                </Button>
                {reminderForm.times_of_day.length > 1 && ( // Only show remove button if more than one time
                    <Button icon="close-circle-outline" onPress={() => handleRemoveTime(index)} textColor={theme.colors.error}>
                        Remove
                    </Button>
                )}
             </View>
           ))}
           <Button icon="plus-circle-outline" onPress={handleAddTime} style={{ alignSelf: 'flex-start', marginTop: 8, marginBottom: 16 }}>
                Add Time
           </Button>

            <Divider style={{ marginVertical: 8 }}/>

           <View style={styles.row}>
                <Text variant="labelLarge" style={{ flex: 1 }}>Start Date</Text>
                <Button mode="outlined" onPress={() => showDateTimePickerModal('date', 'start_date')}>
                    {format(reminderForm.start_date, 'yyyy-MM-dd')}
                </Button>
           </View>

            <View style={styles.row}>
                <Text variant="labelLarge" style={{ flex: 1 }}>End Date (Optional)</Text>
                 <Button mode="outlined" onPress={() => showDateTimePickerModal('date', 'end_date')}>
                     {reminderForm.end_date ? format(reminderForm.end_date, 'yyyy-MM-dd') : 'Set End Date'}
                 </Button>
                 {reminderForm.end_date && (
                    <Button icon="close-circle-outline" onPress={() => handleReminderInputChange('end_date', null)} textColor={theme.colors.error} compact>Clear</Button>
                 )}
            </View>

          {showDatePicker && (
            <DateTimePicker
              value={
                 datePickerTarget === 'start_date' ? reminderForm.start_date :
                 datePickerTarget === 'end_date' ? reminderForm.end_date ?? new Date() : // Provide a default if null
                 reminderForm.times_of_day[timePickerIndex]
              }
              mode={datePickerMode}
              is24Hour={true}
              display="default"
              onChange={onDateTimeChange}
              minimumDate={datePickerTarget === 'end_date' ? reminderForm.start_date : undefined} // End date cannot be before start date
            />
          )}

          <Button
                mode="contained"
                onPress={handleSaveReminder}
                style={{ marginTop: 20, marginBottom: 10 }}
                loading={isSubmittingReminder}
                disabled={isSubmittingReminder}
            >
                {isSubmittingReminder ? 'Saving...' : 'Save Reminder'}
            </Button>
            <Button
                mode="outlined"
                onPress={closeReminderModal}
                disabled={isSubmittingReminder}
            >
                Cancel
            </Button>

        </ScrollView>
       </Modal>
      </Portal>
    );
  };

  const renderCurrentMedicationItem = (medicine: Medicine) => {
    const isExpanded = expandedMedicineId === medicine.id;
    const animation = getAnimation(medicine.id);

    const heightInterpolate = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 300],
        extrapolate: 'clamp',
    });
      const rotateInterpolate = animation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg']
    });

    const quantityPercentage = medicine.quantity.total > 0 ? (medicine.quantity.current / medicine.quantity.total) : 0;
    let progressColor = theme.colors.primary;
    if (quantityPercentage < 0.2) progressColor = theme.colors.error;
    else if (quantityPercentage < 0.5) progressColor = theme.colors.tertiary;

    return (
      <Surface key={medicine.id} style={styles.medicineCard} elevation={1}>
          <TouchableOpacity onPress={() => handleMedicinePress(medicine.id)} activeOpacity={0.8}>
              <View style={[styles.medicineContent]}>
            <View style={styles.medicineHeader}>
              <View style={styles.medicineInfo}>
                          <Text variant="titleMedium" style={styles.medicineName}>{medicine.name}</Text>
                          <Text style={styles.medicineSubInfo}>{medicine.dosage} - {medicine.frequency}</Text>
                      </View>
                       <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                           <MaterialCommunityIcons
                              name={'chevron-down'}
                              size={24}
                              color={theme.colors.onSurfaceVariant}
                           />
                       </Animated.View>
                  </View>
                <View style={styles.quantityContainer}>
                       <ProgressBar progress={quantityPercentage} color={progressColor} style={styles.progressBar} />
                       <Text style={styles.quantityText}>
                           {medicine.quantity.current} / {medicine.quantity.total} {medicine.quantity.unit} remaining
                  </Text>
                </View>
            </View>
          </TouchableOpacity>

          <Animated.View style={[styles.detailsContainer, { height: heightInterpolate }]}>
              {isExpanded && (
                  <ScrollView nestedScrollEnabled={true} style={{ flex: 1 }}>
              <View style={styles.detailsContent}>
                          <Text style={[styles.detailText, {fontStyle: 'italic'}]}>{medicine.purpose}</Text>
                          <Divider style={styles.divider} />

                          <Text style={styles.detailTitle}>Composition:</Text>
                          {medicine.composition.map((item, index) => (
                              <Text key={index} style={styles.detailListItem}>• {item}</Text>
                          ))}

                          <Text style={styles.detailTitle}>Common Side Effects:</Text>
                          {medicine.sideEffects.map((item, index) => (
                              <Text key={index} style={styles.detailListItem}>• {item}</Text>
                          ))}

                           <Text style={styles.detailTitle}>Possible Substitutes:</Text>
                          {medicine.substitutes.map((item, index) => (
                              <Text key={index} style={styles.detailListItem}>• {item}</Text>
                          ))}

                <View style={styles.actionsContainer}>
                  <Button 
                    mode="contained-tonal" 
                                    icon="pencil-outline"
                                    onPress={() => console.log('Edit Reminder:', medicine.id)}
                    style={styles.actionButton}
                    labelStyle={styles.actionButtonLabel}
                  >
                                   Edit
                  </Button>
                  <Button 
                                    mode="outlined"
                                    icon="delete-outline"
                                    onPress={() => console.log('Delete Reminder:', medicine.id)}
                    style={styles.actionButton}
                    labelStyle={styles.actionButtonLabel}
                                    textColor={theme.colors.error}
                  >
                                   Delete
                  </Button>
                </View>
              </View>
                  </ScrollView>
            )}
          </Animated.View>
        </Surface>
    );
  };
  
  const renderApiResultItem = ({ item }: { item: DrugConcept }) => (
    <TouchableOpacity onPress={() => handleApiResultSelect(item)}>
      <List.Item
        style={styles.apiResultItem}
        title={capitalizeFirstLetter(item.name)}
        description={`Type: ${item.tty}`}
        left={(props) => <List.Icon {...props} icon="pill" />}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <AppHeader title="Add / Manage Items" />
      
      <View style={styles.content}>
        <View style={styles.searchContainerMargin}>
        <StyledSearchBar
              placeholder="Search for medicine to add..."
          onChangeText={setSearchQuery}
          value={searchQuery}
        />
        </View>

        {searchQuery.length > 0 || isSearching || searchError ? (
          <View style={styles.section}>
             {isSearching && <ActivityIndicator animating={true} size="large" style={styles.loader} />}
             {searchError && !isSearching && <Text style={styles.errorText}>{searchError}</Text>}
             {!isSearching && !searchError && searchResults.length > 0 && (
                <FlatList 
                    data={searchResults}
                    renderItem={renderApiResultItem}
                  keyExtractor={(item) => item.rxcui + item.tty}
                    style={styles.resultsList}
                />
            )}
             {!isSearching && !searchError && searchQuery.length >= 3 && searchResults.length === 0 && (
                 <Text style={styles.infoText}>No results found for "{searchQuery}".</Text>
             )}
             {!isSearching && !searchError && searchQuery.length > 0 && searchQuery.length < 3 && (
                 <Text style={styles.infoText}>Enter at least 3 characters to search.</Text>
             )}
          </View>
        ) : (
          <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <Text variant="titleLarge" style={styles.sectionTitle}>Current Reminders</Text>
              {currentMedications.length === 0 ? (
                 <Text style={styles.infoText}>No reminders added yet. Use the '+' button to add one.</Text>
              ) : (
                currentMedications.map(renderCurrentMedicationItem)
              )}
              <View style={{ height: 120 }} />
            </View>
          </ScrollView>
        )}
      </View>

       <View style={styles.fab}>
        <FAB
          icon="plus"
          style={styles.fab}
                onPress={openReminderModal}
                label="Add Reminder"
           />
       </View>

      {renderReminderForm()}

    </SafeAreaView>
  );
} 