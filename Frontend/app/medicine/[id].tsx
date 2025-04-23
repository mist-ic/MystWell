import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Surface, Button, IconButton, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface MedicineDetails {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  remaining: string;
  instructions: string;
  sideEffects: string[];
  substitutes: string[];
  composition: string;
}

// Mock data - replace with actual data fetching
const medicinesData: MedicineDetails[] = [
  {
    id: '1',
    name: 'Medicine 1 500mg',
    dosage: '500 mg',
    frequency: 'Once daily (Morning)',
    remaining: '30 tablets',
    instructions: 'Take on empty stomach in the morning',
    sideEffects: ['Nausea', 'Headache'],
    substitutes: ['Generic Medicine 1'],
    composition: 'Active ingredient 500 mg'
  },
  {
    id: '2',
    name: 'Crocin 500mg',
    dosage: '500 mg',
    frequency: 'Every 6 hours',
    remaining: '20 tablets',
    instructions: 'Take one tablet every 6 hours',
    sideEffects: ['Drowsiness', 'Upset stomach'],
    substitutes: ['Paracetamol', 'Acetaminophen'],
    composition: 'Paracetamol 500 mg'
  },
  {
    id: '3',
    name: 'Syrup 1',
    dosage: '1 cap',
    frequency: 'Twice daily (Morning and Evening)',
    remaining: '200 ml',
    instructions: 'Take one cap in morning and evening',
    sideEffects: ['Drowsiness'],
    substitutes: ['Alternative Syrup'],
    composition: 'Active ingredients in syrup form'
  },
  {
    id: '4',
    name: 'Medicine 2',
    dosage: '250 mg',
    frequency: 'Thrice daily',
    remaining: '45 tablets',
    instructions: 'Take one tablet in morning, afternoon, and evening',
    sideEffects: ['Dizziness'],
    substitutes: ['Generic Medicine 2'],
    composition: 'Active ingredient 250 mg'
  },
  {
    id: '5',
    name: 'Steam with Green Capsule',
    dosage: '1 capsule',
    frequency: 'Twice daily',
    remaining: '20 capsules',
    instructions: 'Use with steam inhalation morning and evening',
    sideEffects: ['Throat irritation'],
    substitutes: ['Alternative steam medicine'],
    composition: 'Green capsule contents'
  },
  {
    id: '6',
    name: 'Ear Drops',
    dosage: '5 drops',
    frequency: 'As needed',
    remaining: '15 ml',
    instructions: 'Apply 5 drops in left ear',
    sideEffects: ['Temporary hearing changes'],
    substitutes: ['Alternative ear drops'],
    composition: 'Active ingredients in solution'
  },
  {
    id: '7',
    name: 'Medicine 4',
    dosage: '300 mg',
    frequency: 'Once daily',
    remaining: '30 tablets',
    instructions: 'Take one tablet every night after meal',
    sideEffects: ['Sleepiness'],
    substitutes: ['Generic Medicine 4'],
    composition: 'Active ingredient 300 mg'
  },
  {
    id: '8',
    name: 'Lunch Medicine',
    dosage: '400 mg',
    frequency: 'Once daily',
    remaining: '30 tablets',
    instructions: 'Take during lunch time',
    sideEffects: ['Mild stomach pain'],
    substitutes: ['Alternative lunch medicine'],
    composition: 'Active ingredient 400 mg'
  },
  {
    id: '9',
    name: 'Medicine 10',
    dosage: '200 mg',
    frequency: 'Once daily',
    remaining: '30 tablets',
    instructions: 'Take 10 minutes after dinner',
    sideEffects: ['Drowsiness'],
    substitutes: ['Alternative night medicine'],
    composition: 'Active ingredient 200 mg'
  },
  {
    id: '10',
    name: 'Aspirin 500mg',
    dosage: '500 mg',
    frequency: 'Once daily',
    remaining: '30 tablets',
    instructions: 'Take after meal in the morning',
    sideEffects: ['Upset stomach', 'Heartburn'],
    substitutes: ['Generic Aspirin'],
    composition: 'Acetylsalicylic acid 500 mg'
  }
];

export default function MedicineDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const medicineId = params.id as string;
  
  // Find the medicine data based on the ID from the URL
  const medicineData = medicinesData.find(med => med.id === medicineId) || medicinesData[0];

  const handleReorder = () => {
    router.push('/medicine/reorder');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="headlineSmall" style={styles.title}>Medicine Details</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content}>
        <Surface style={styles.section}>
          <Text variant="headlineMedium" style={styles.medicineName}>
            {medicineData.name}
          </Text>
          
          <Button
            mode="contained"
            onPress={handleReorder}
            style={styles.reorderButton}
          >
            Reorder
          </Button>

          <Divider style={styles.divider} />

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Dosage:</Text>
            <Text variant="bodyLarge">{medicineData.dosage}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Frequency:</Text>
            <Text variant="bodyLarge">{medicineData.frequency}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Remaining:</Text>
            <Text variant="bodyLarge">{medicineData.remaining}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Instructions:</Text>
            <Text variant="bodyLarge">{medicineData.instructions}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Side Effects:</Text>
            {medicineData.sideEffects.map((effect, index) => (
              <Text key={index} variant="bodyLarge" style={styles.listItem}>
                • {effect}
              </Text>
            ))}
          </View>

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Substitutes:</Text>
            {medicineData.substitutes.map((substitute, index) => (
              <Text key={index} variant="bodyLarge" style={styles.listItem}>
                • {substitute}
              </Text>
            ))}
          </View>

          <View style={styles.infoSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Composition:</Text>
            <Text variant="bodyLarge">{medicineData.composition}</Text>
          </View>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  medicineName: {
    fontWeight: '600',
    marginBottom: 16,
  },
  reorderButton: {
    marginBottom: 16,
  },
  divider: {
    marginBottom: 16,
  },
  infoSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  listItem: {
    marginLeft: 8,
    marginBottom: 4,
  },
}); 