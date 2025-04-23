import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Surface, Button, IconButton, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface MedicineMentioned {
  name: string;
  timing: string;
  dosage: string;
  frequency: string;
  instructions?: string;
}

// Mock data for medicines mentioned in recording
const medicinesMentioned: MedicineMentioned[] = [
  {
    name: 'Aspirin',
    timing: 'Morning 8 AM',
    dosage: '500mg',
    frequency: 'Once daily',
    instructions: 'after meal'
  },
  {
    name: 'Medicine 1',
    timing: 'Morning',
    dosage: '500mg',
    frequency: 'Once daily',
    instructions: 'empty stomach'
  },
  {
    name: 'Crocin',
    timing: 'Every 6 hrs',
    dosage: '500mg',
    frequency: 'Four times daily'
  },
  {
    name: 'Syrup 1',
    timing: 'Morning and Evening',
    dosage: '1 cap',
    frequency: 'Twice daily'
  },
  {
    name: 'Medicine 2',
    timing: 'Morning, Afternoon, Evening',
    dosage: '250mg',
    frequency: 'Thrice daily'
  },
  {
    name: 'Steam with Green Capsule',
    timing: 'Morning and Evening',
    dosage: '1 capsule',
    frequency: 'Twice daily'
  },
  {
    name: 'Ear Drops',
    timing: 'As needed',
    dosage: '5 drops',
    frequency: 'As needed',
    instructions: 'left ear'
  },
  {
    name: 'Medicine 4',
    timing: 'Night',
    dosage: '300mg',
    frequency: 'Once daily',
    instructions: 'after meal'
  },
  {
    name: 'Medicine',
    timing: 'Lunch time',
    dosage: '400mg',
    frequency: 'Once daily'
  },
  {
    name: 'Medicine',
    timing: 'After dinner',
    dosage: '200mg',
    frequency: 'Once daily',
    instructions: '10 min after dinner'
  }
];

export default function RecordingSummaryScreen() {
  const theme = useTheme();
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const handleSave = () => {
    router.push('/medicine');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.card}>
        <View style={styles.headerSection}>
          <MaterialCommunityIcons 
            name="microphone" 
            size={32} 
            color={theme.colors.primary}
          />
          <View style={styles.headerText}>
            <Text variant="headlineMedium">Recording Summary</Text>
            <Text variant="bodyMedium" style={styles.dateTime}>
              Duration: 00:00:00 • {formattedDate}, {formattedTime}
            </Text>
          </View>
        </View>

        <Text variant="titleLarge" style={styles.recordingTitle}>Recording 6</Text>

        <Text variant="titleLarge" style={styles.sectionTitle}>Medicines Mentioned</Text>

        <ScrollView style={styles.medicinesList}>
          {medicinesMentioned.map((medicine, index) => (
            <Surface key={index} style={styles.medicineCard}>
              <View style={styles.medicineHeader}>
                <Text variant="headlineMedium" style={styles.medicineName}>
                  {medicine.name}
                </Text>
                <IconButton
                  icon="pencil"
                  size={24}
                  onPress={() => {}}
                />
              </View>
              
              <Text variant="titleMedium" style={styles.infoText}>
                Timing: {medicine.timing}
              </Text>
              
              <Text variant="titleMedium" style={styles.infoText}>
                Dosage: {medicine.dosage}
              </Text>

              <Text variant="titleMedium" style={styles.infoText}>
                Frequency: {medicine.frequency}
              </Text>

              {medicine.instructions && (
                <Chip 
                  mode="flat" 
                  style={[styles.instructionChip, { backgroundColor: theme.colors.primary }]}
                  textStyle={{ color: 'white' }}
                >
                  {medicine.instructions}
                </Chip>
              )}
            </Surface>
          ))}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Button 
            mode="outlined" 
            onPress={handleCancel}
            style={[styles.button, styles.cancelButton]}
            labelStyle={styles.buttonLabel}
          >
            Cancel
          </Button>
          <Button 
            mode="contained" 
            onPress={handleSave}
            style={[styles.button, styles.saveButton]}
            labelStyle={styles.buttonLabel}
          >
            Save
          </Button>
        </View>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerText: {
    marginLeft: 16,
  },
  dateTime: {
    opacity: 0.7,
    marginTop: 4,
  },
  recordingTitle: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  medicinesList: {
    flex: 1,
  },
  medicineCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  medicineName: {
    flex: 1,
    fontWeight: '600',
  },
  infoText: {
    marginBottom: 8,
    fontSize: 18,
  },
  instructionChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 36,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 24,
    height: 48,
  },
  buttonLabel: {
    fontSize: 16,
    letterSpacing: 0,
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
  },
}); 