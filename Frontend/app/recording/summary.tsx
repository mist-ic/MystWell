import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Surface, Button, IconButton, Chip, Card, Divider } from 'react-native-paper';
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

  // Function to get appropriate color for an instruction chip
  const getInstructionChipColor = (instruction: string) => {
    if (instruction.includes('meal')) return '#4CAF50'; // Green
    if (instruction.includes('empty') || instruction.includes('stomach')) return '#FFA000'; // Amber
    if (instruction.includes('ear') || instruction.includes('eye')) return '#2196F3'; // Blue
    return theme.colors.primary; // Default
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.headerCard} mode="outlined">
        <Card.Content style={styles.headerContent}>
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="microphone" 
                size={32} 
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.headerText}>
              <Text variant="titleLarge" style={styles.headerTitle}>Recording Summary</Text>
              <Text variant="bodyMedium" style={[styles.dateTime, { color: theme.colors.onSurfaceVariant }]}>
                Duration: 00:00:00 • {formattedDate}, {formattedTime}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.mainCard} mode="outlined">
        <Card.Content style={styles.mainCardContent}>
          <Text variant="titleLarge" style={styles.recordingTitle}>Recording 6</Text>
          <Divider style={styles.divider} />

          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            MEDICINES MENTIONED
          </Text>

          <ScrollView style={styles.medicinesList}>
            {medicinesMentioned.map((medicine, index) => (
              <Card key={index} style={styles.medicineCard} mode="outlined">
                <Card.Content style={styles.medicineCardContent}>
                  <View style={styles.medicineHeader}>
                    <Text variant="titleLarge" style={[styles.medicineName, { color: theme.colors.onSurface }]}>
                      {medicine.name}
                    </Text>
                    <IconButton
                      icon="pencil"
                      size={20}
                      iconColor={theme.colors.primary}
                      style={styles.editButton}
                      onPress={() => {}}
                    />
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text variant="labelLarge" style={styles.infoLabel}>
                      TIMING
                    </Text>
                    <Text variant="bodyLarge" style={styles.infoValue}>
                      {medicine.timing}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text variant="labelLarge" style={styles.infoLabel}>
                      DOSAGE
                    </Text>
                    <Text variant="bodyLarge" style={styles.infoValue}>
                      {medicine.dosage}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text variant="labelLarge" style={styles.infoLabel}>
                      FREQUENCY
                    </Text>
                    <Text variant="bodyLarge" style={styles.infoValue}>
                      {medicine.frequency}
                    </Text>
                  </View>

                  {medicine.instructions && (
                    <Chip 
                      mode="flat" 
                      style={[
                        styles.instructionChip, 
                        { backgroundColor: getInstructionChipColor(medicine.instructions) + '20' }
                      ]}
                      textStyle={{ 
                        color: getInstructionChipColor(medicine.instructions),
                        fontWeight: '600' 
                      }}
                    >
                      {medicine.instructions}
                    </Chip>
                  )}
                </Card.Content>
              </Card>
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
        </Card.Content>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerContent: {
    padding: 16,
  },
  mainCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mainCardContent: {
    padding: 16,
    flex: 1,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF', // Light blue background for icon
  },
  headerText: {
    marginLeft: 16,
  },
  headerTitle: {
    fontWeight: '600',
    color: '#1F2937', // Darker text for better contrast
  },
  dateTime: {
    marginTop: 4,
  },
  recordingTitle: {
    marginBottom: 16,
    fontWeight: '600',
    color: '#111827', // Dark text for better readability
  },
  divider: {
    marginBottom: 16,
    height: 1,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  medicinesList: {
    flex: 1,
  },
  medicineCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  medicineCardContent: {
    padding: 16,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  medicineName: {
    flex: 1,
    fontWeight: '600',
  },
  editButton: {
    margin: -8,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
    color: '#4B5563', // Gray color for labels
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827', // Dark color for better readability
    fontWeight: '400',
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
    borderRadius: 8,
    padding: 4,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    marginRight: 8,
  },
  saveButton: {
    marginLeft: 8,
  },
}); 