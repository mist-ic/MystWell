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

interface ReminderFormState {
  medicineName: string;
  dosage: string; // e.g., "500mg", "1 tablet"
  frequency: 'daily' | 'specific_days' | 'as_needed';
  selectedDays: number[]; // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  times: Date[];
  startDate: Date;
  endDate: Date | null;
  notes: string;
}

const initialReminderFormState: ReminderFormState = {
  medicineName: '',
  dosage: '',
  frequency: 'daily',
  selectedDays: [],
  times: [new Date()], // Default to one time slot, current time
  startDate: new Date(),
  endDate: null,
  notes: '',
};

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
        padding: 16,
        backgroundColor: theme.colors.background,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 50,
        maxHeight: '90%',
        elevation: 4,
    },
    formTitle: {
        marginBottom: 16,
        textAlign: 'center',
    },
    inputField: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    frequencySelector: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    daySelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    dayChip: {
        margin: 2,
        minWidth: 45,
        justifyContent: 'center',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.outlineVariant,
    },
    timeText: {
        fontSize: 16,
    },
    addTimeButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.outline,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: theme.roundness,
    },
    dateText: {
        marginLeft: 8,
    },
    submitButton: {
        marginTop: 16,
    },
    fabContainer: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'flex-end',
        padding: 16,
        paddingBottom: 80,
    },
  });
  const styles = makeStyles(theme);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrugConcept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedMedicineId, setExpandedMedicineId] = useState<string | null>(null);

  // --- Reminder Form State ---
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderForm, setReminderForm] = useState<ReminderFormState>(initialReminderFormState);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [editingDateType, setEditingDateType] = useState<'start' | 'end' | 'time'>('start');
  const [editingTimeIndex, setEditingTimeIndex] = useState<number>(0);
  // --- End Reminder Form State ---

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
        medicineName: capitalizeFirstLetter(drug.name)
    }));
    setSearchQuery('');
    setSearchResults([]);
    setShowReminderForm(true);
    console.log(`Selected: ${drug.name} (${drug.rxcui})`);
  };

  const requestNotificationPermissions = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medicine-reminders', {
        name: 'Medicine Reminders',
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
        Alert.alert('Permissions Required', 'Failed to get push token for push notification! Please enable notifications in settings.');
        return false;
      }
      return true;
    } else {
      Alert.alert('Physical Device Required', 'Must use physical device for Push Notifications');
      return false;
    }
  }

  const handleReminderInputChange = (field: keyof ReminderFormState, value: any) => {
    setReminderForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFrequencyChange = (value: 'daily' | 'specific_days' | 'as_needed') => {
    handleReminderInputChange('frequency', value);
    if (value !== 'specific_days') {
        handleReminderInputChange('selectedDays', []); // Clear days if not specific
    }
  };

 const handleDayToggle = (dayIndex: number) => {
    setReminderForm(prev => {
        const currentDays = prev.selectedDays;
        const newDays = currentDays.includes(dayIndex)
            ? currentDays.filter(d => d !== dayIndex)
            : [...currentDays, dayIndex].sort(); // Keep sorted
        return { ...prev, selectedDays: newDays };
    });
 };

 const handleAddTime = () => {
    setReminderForm(prev => ({
        ...prev,
        times: [...prev.times, new Date()] // Add current time as default
    }));
 };

 const handleRemoveTime = (indexToRemove: number) => {
    // Prevent removing the last time slot if frequency requires it
    if (reminderForm.frequency !== 'as_needed' && reminderForm.times.length <= 1) {
         Alert.alert("Cannot Remove", "At least one reminder time is required for this frequency.");
         return;
     }
    setReminderForm(prev => ({
        ...prev,
        times: prev.times.filter((_, index) => index !== indexToRemove)
    }));
 };

 const showDateTimePicker = (mode: 'date' | 'time', type: 'start' | 'end' | 'time', index?: number) => {
    setDatePickerMode(mode);
    setEditingDateType(type);
    if (type === 'time' && index !== undefined) {
        setEditingTimeIndex(index);
    }
    setShowDatePicker(true);
 };

 const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || (editingDateType === 'time' ? reminderForm.times[editingTimeIndex] : reminderForm.startDate); // Use current value if undefined
    setShowDatePicker(Platform.OS === 'ios'); // Keep visible on iOS until dismissed

    if (event.type === 'set' && selectedDate) { // 'set' means user confirmed selection
      // Close picker on Android after selection
       if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
      const confirmedDate = selectedDate;
      if (editingDateType === 'start') {
        handleReminderInputChange('startDate', confirmedDate);
        if (reminderForm.endDate && confirmedDate > reminderForm.endDate) {
            handleReminderInputChange('endDate', confirmedDate);
        }
      } else if (editingDateType === 'end') {
        handleReminderInputChange('endDate', confirmedDate);
      } else if (editingDateType === 'time') {
        setReminderForm(prev => {
            const newTimes = [...prev.times];
            newTimes[editingTimeIndex] = confirmedDate;
            // Optional: Sort times after modification
            // newTimes.sort((a, b) => a.getTime() - b.getTime());
            return { ...prev, times: newTimes };
        });
      }
    } else {
        // Handle 'dismissed' on Android if needed
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
    }
 };

 const scheduleMedicineReminder = async (reminder: ReminderFormState) => {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const { medicineName, dosage, frequency, selectedDays, times, startDate, endDate, notes } = reminder;
    const reminderIdBase = `${medicineName.replace(/\\s+/g, '_')}_${Date.now()}`; // Create a base unique ID

    let scheduledNotificationIds: string[] = [];
    let notificationCount = 0;

    for (const [index, time] of times.entries()) {
        const hour = time.getHours();
        const minute = time.getMinutes();
        const notificationIdSuffix = `${hour}_${minute}`; // Suffix for time uniqueness

        let trigger: Notifications.NotificationTriggerInput | null = null;

        if (frequency === 'daily') {
            trigger = {
                hour,
                minute,
                repeats: true,
                channelId: 'medicine-reminders',
            };
        } else if (frequency === 'specific_days' && selectedDays.length > 0) {
            const expoWeekdays = selectedDays.map(day => day + 1); // JS Sunday=0 -> Expo Sunday=1
             for (const weekday of expoWeekdays) {
                 const specificTrigger: Notifications.NotificationTriggerInput = {
                    hour,
                    minute,
                    weekday,
                    repeats: true,
                    channelId: 'medicine-reminders',
                };
                const uniqueNotificationId = `${reminderIdBase}_weekly_${weekday}_${notificationIdSuffix}_${index}`;
                 try {
                    const notificationId = await Notifications.scheduleNotificationAsync({
                        identifier: uniqueNotificationId, // Assign unique identifier
                        content: {
                            title: `💊 Time for ${medicineName}!`,
                            body: `Take ${dosage}. ${notes ? `(${notes})` : ''}`,
                            data: { reminderId: reminderIdBase, type: 'medicine' }, // Add relevant data
                            sound: true,
                        },
                        trigger: specificTrigger,
                    });
                    if (notificationId) {
                        scheduledNotificationIds.push(notificationId);
                        notificationCount++;
                    }
                 } catch (error) {
                     console.error("Error scheduling weekly notification:", error);
                     Alert.alert("Scheduling Error", `Could not schedule reminder for ${medicineName} on day ${weekday} at ${hour}:${minute}.`);
                 }
            }
            continue; // Skip the single schedule logic below for weekly type
        } else if (frequency === 'as_needed') {
            continue; // 'as_needed' reminders are not scheduled
        }

        // Schedule for 'daily' frequency (if trigger is set)
        if (trigger) {
            const uniqueNotificationId = `${reminderIdBase}_daily_${notificationIdSuffix}_${index}`;
            try {
                const notificationId = await Notifications.scheduleNotificationAsync({
                    identifier: uniqueNotificationId, // Assign unique identifier
                    content: {
                        title: `💊 Time for ${medicineName}!`,
                        body: `Take ${dosage}. ${notes ? `(${notes})` : ''}`,
                        data: { reminderId: reminderIdBase, type: 'medicine' },
                        sound: true,
                    },
                    trigger,
                });
                 if (notificationId) {
                    scheduledNotificationIds.push(notificationId);
                    notificationCount++;
                }
            } catch (error) {
                console.error("Error scheduling daily notification:", error);
                Alert.alert("Scheduling Error", `Could not schedule daily reminder for ${medicineName} at ${hour}:${minute}.`);
            }
        }

        // TODO: Handle startDate and endDate for *all* frequencies.
        // This might involve calculating specific dates for non-repeating triggers
        // or adding checks within a notification handler. For simplicity, this example
        // schedules repeating notifications indefinitely starting immediately.
    }

    if (frequency !== 'as_needed' && notificationCount > 0) {
        Alert.alert('Reminder Set', `${notificationCount} notifications scheduled for ${medicineName}.`);
        // TODO: Save the reminder details AND the scheduledNotificationIds array
        // associated with this reminder for future cancellation/modification.
        console.log('Scheduled Notification IDs:', scheduledNotificationIds);
    } else if (frequency !== 'as_needed' && notificationCount === 0) {
         Alert.alert('Reminder Not Set', `Could not schedule any notifications for ${medicineName}. Check logs for errors.`);
    }
 };

 const handleSaveReminder = async () => {
    // Basic validation
    if (!reminderForm.medicineName || !reminderForm.dosage) {
      Alert.alert('Missing Information', 'Please enter medicine name and dosage.');
      return;
    }
    if (reminderForm.frequency === 'specific_days' && reminderForm.selectedDays.length === 0) {
        Alert.alert('Missing Information', 'Please select at least one day for specific day frequency.');
        return;
    }
     if (reminderForm.times.length === 0 && reminderForm.frequency !== 'as_needed') {
         Alert.alert('Missing Information', 'Please add at least one reminder time.');
         return;
     }
     // Optional: Validate start/end dates
     if (reminderForm.endDate && reminderForm.startDate > reminderForm.endDate) {
         Alert.alert('Invalid Dates', 'End date cannot be before the start date.');
         return;
     }

    console.log('Saving Reminder:', reminderForm);

    await scheduleMedicineReminder(reminderForm);

    // TODO: Persist reminder data (e.g., AsyncStorage, Supabase)
    // Example: Add to a local list for now
    // const newReminder = { ...reminderForm, id: reminderIdBase }; // Use the base ID generated during scheduling
    // setSavedReminders(prev => [...prev, newReminder]);

    // Reset form and hide
    setReminderForm(initialReminderFormState);
    setShowReminderForm(false);
 };

 const renderReminderForm = () => (
    <Portal>
        <Modal visible={showReminderForm} onDismiss={() => setShowReminderForm(false)} contentContainerStyle={styles.reminderFormContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text variant="headlineSmall" style={styles.formTitle}>Add Medicine Reminder</Text>

                <TextInput
                    label="Medicine Name"
                    value={reminderForm.medicineName}
                    onChangeText={(text) => handleReminderInputChange('medicineName', text)}
                    mode="outlined"
                    style={styles.inputField}
                    left={<TextInput.Icon icon="pill" />}
                />

                <TextInput
                    label="Dosage (e.g., 500mg, 1 tablet)"
                    value={reminderForm.dosage}
                    onChangeText={(text) => handleReminderInputChange('dosage', text)}
                    mode="outlined"
                    style={styles.inputField}
                    left={<TextInput.Icon icon="beaker-outline" />}
                />

                <Text variant="bodyLarge" style={{ marginBottom: 8, marginTop: 8 }}>Frequency</Text>
                <View style={styles.frequencySelector}>
                    <Chip
                        icon="calendar-today"
                        selected={reminderForm.frequency === 'daily'}
                        onPress={() => handleFrequencyChange('daily')}
                        mode="flat"
                        showSelectedCheck={true}
                    >
                        Daily
                    </Chip>
                    <Chip
                        icon="calendar-week"
                        selected={reminderForm.frequency === 'specific_days'}
                        onPress={() => handleFrequencyChange('specific_days')}
                        mode="flat"
                         showSelectedCheck={true}
                    >
                        Specific Days
                    </Chip>
                     <Chip
                        icon="calendar-question"
                        selected={reminderForm.frequency === 'as_needed'}
                        onPress={() => handleFrequencyChange('as_needed')}
                        mode="flat"
                         showSelectedCheck={true}
                    >
                        As Needed
                    </Chip>
                </View>

                {reminderForm.frequency === 'specific_days' && (
                    <>
                     <Text variant="bodyMedium" style={{ marginTop: 12, marginBottom: 4 }}>Select Days</Text>
                    <View style={styles.daySelector}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                            <Chip
                                key={index}
                                selected={reminderForm.selectedDays.includes(index)}
                                onPress={() => handleDayToggle(index)}
                                style={styles.dayChip}
                                mode="flat"
                                compact
                                showSelectedCheck={true}
                            >
                                {day}
                            </Chip>
                        ))}
                    </View>
                    <HelperText type="info" visible={reminderForm.selectedDays.length === 0}>
                        Please select at least one day.
                    </HelperText>
                    </>
                )}

                {/* Time Selector */}
                {reminderForm.frequency !== 'as_needed' && (
                 <>
                    <Text variant="bodyLarge" style={{ marginTop: 16, marginBottom: 8 }}>Reminder Times</Text>
                    {reminderForm.times.map((time, index) => (
                        <View key={index} style={styles.timeRow}>
                             {/* Conditionally render TouchableOpacity for picker on native only */}
                             {Platform.OS !== 'web' ? (
                                <TouchableOpacity onPress={() => showDateTimePicker('time', 'time', index)}>
                                    <Text style={styles.timeText}>
                                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>
                             ) : (
                                 // Fallback for web: Display time as text
                                 <Text style={styles.timeText}>
                                     {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </Text>
                             )}
                            {/* Only show remove button if more than one time exists */}
                            {reminderForm.times.length > 1 && (
                                <Button
                                    icon="close-circle-outline"
                                    onPress={() => handleRemoveTime(index)}
                                    textColor={theme.colors.error}
                                    compact
                                    mode="text" // Use text mode for less emphasis
                                >
                                    Remove
                                </Button>
                            )}
                        </View>
                    ))}
                     {/* Conditionally render Add Time button */}
                     {Platform.OS !== 'web' ? (
                        <Button
                            icon="plus-circle-outline"
                            onPress={handleAddTime}
                            mode="text"
                            style={styles.addTimeButton}
                        >
                            Add Time
                        </Button>
                     ) : (
                         <Text style={{fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 5}}>Add/Edit times on mobile app</Text>
                     )}
                 </>
                )}

                {/* Start/End Date */}
                 <Text variant="bodyLarge" style={{ marginTop: 16, marginBottom: 8 }}>Duration</Text>
                 <View style={styles.dateRow}>
                    <Text variant="bodyMedium">Start Date:</Text>
                     {/* Conditionally render TouchableOpacity for picker on native only */}
                     {Platform.OS !== 'web' ? (
                        <TouchableOpacity style={styles.datePickerButton} onPress={() => showDateTimePicker('date', 'start')}>
                             <MaterialCommunityIcons name="calendar-start" size={20} color={theme.colors.primary} />
                             <Text style={[styles.dateText, { color: theme.colors.primary }]}>
                                {reminderForm.startDate.toLocaleDateString()}
                             </Text>
                        </TouchableOpacity>
                     ) : (
                         <Text style={styles.dateText}>{reminderForm.startDate.toLocaleDateString()}</Text>
                     )}
                 </View>
                 <View style={styles.dateRow}>
                    <Text variant="bodyMedium">End Date (Optional):</Text>
                     {/* Conditionally render TouchableOpacity for picker on native only */}
                     {Platform.OS !== 'web' ? (
                        <TouchableOpacity style={styles.datePickerButton} onPress={() => showDateTimePicker('date', 'end')}>
                            <MaterialCommunityIcons name="calendar-end" size={20} color={reminderForm.endDate ? theme.colors.primary : theme.colors.onSurfaceVariant} />
                            <Text style={[styles.dateText, { color: reminderForm.endDate ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                                {reminderForm.endDate ? reminderForm.endDate.toLocaleDateString() : 'Set Date'}
                            </Text>
                         </TouchableOpacity>
                     ) : (
                        <Text style={styles.dateText}>{reminderForm.endDate ? reminderForm.endDate.toLocaleDateString() : 'Not Set'}</Text>
                     )}
                 </View>
                  {/* Conditionally render Clear End Date button */}
                  {reminderForm.endDate && Platform.OS !== 'web' && (
                      <Button
                          icon="calendar-remove-outline"
                          onPress={() => handleReminderInputChange('endDate', null)}
                          mode="text"
                          compact
                          style={{alignSelf: 'flex-end'}}
                          textColor={theme.colors.secondary} // Use a less prominent color
                      >
                          Clear End Date
                      </Button>
                  )}

                <TextInput
                    label="Notes (Optional)"
                    value={reminderForm.notes}
                    onChangeText={(text) => handleReminderInputChange('notes', text)}
                    mode="outlined"
                    style={styles.inputField}
                    multiline
                    numberOfLines={3}
                    left={<TextInput.Icon icon="note-text-outline" />}
                />

                <Button
                    mode="contained"
                    onPress={handleSaveReminder}
                    style={styles.submitButton}
                    icon="content-save-outline" // Changed icon name
                >
                    Save Reminder
                </Button>
                 <Button
                    mode="outlined"
                    onPress={() => setShowReminderForm(false)}
                    style={{marginTop: 8, marginBottom: 20}}
                >
                    Cancel
                </Button>
            </ScrollView>
        </Modal>
    </Portal>
  );

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader title="Add / Manage Medicine" />

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

       <View style={styles.fabContainer}>
           <FAB
                icon="plus"
                style={styles.fab}
                onPress={() => {
                    setReminderForm(initialReminderFormState);
                    setShowReminderForm(true);
                }}
                label="Add Reminder"
           />
       </View>

      {renderReminderForm()}

      {/* Date/Time Picker Modal - RENDERED CONDITIONALLY */}
      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          testID="dateTimePicker"
          value={
            editingDateType === 'start' ? reminderForm.startDate :
            editingDateType === 'end' ? (reminderForm.endDate || reminderForm.startDate) :
            reminderForm.times[editingTimeIndex]
          }
          mode={datePickerMode}
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={editingDateType === 'end' ? reminderForm.startDate : undefined}
        />
      )}

    </SafeAreaView>
  );
} 