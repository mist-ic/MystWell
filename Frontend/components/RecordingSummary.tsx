import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput, useTheme, Card, IconButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface MedicineDetail {
  name: string;
  timing: string;
  mealRelation: 'before' | 'after' | 'with';
  dosage: string;
  frequency: string;
}

interface RecordingSummaryProps {
  recordingTitle: string;
  duration: string;
  date: string;
  medicines: MedicineDetail[];
  onSave: (medicines: MedicineDetail[]) => void;
  onCancel: () => void;
}

export function RecordingSummary({
  recordingTitle,
  duration,
  date,
  medicines: initialMedicines,
  onSave,
  onCancel,
}: RecordingSummaryProps) {
  const theme = useTheme();
  const [medicines, setMedicines] = useState<MedicineDetail[]>(initialMedicines);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleEditMedicine = (index: number) => {
    setEditingIndex(index);
  };

  const handleUpdateMedicine = (index: number, field: keyof MedicineDetail, value: string) => {
    const updatedMedicines = [...medicines];
    updatedMedicines[index] = {
      ...updatedMedicines[index],
      [field]: value,
    };
    setMedicines(updatedMedicines);
  };

  const handleSaveMedicine = (index: number) => {
    setEditingIndex(null);
  };

  const getMealRelationChip = (relation: string) => {
    const colors = {
      before: '#4CAF50',
      after: '#2196F3',
      with: theme.colors.primary,
    };
    return (
      <Chip
        style={[styles.chip, { backgroundColor: colors[relation as keyof typeof colors] }]}
        textStyle={{ color: 'white' }}
      >
        {relation} meal
      </Chip>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title
          title="Recording Summary"
          subtitle={`Duration: ${duration} • ${date}`}
          left={(props) => <MaterialCommunityIcons name="microphone" size={24} color={theme.colors.primary} />}
        />
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>{recordingTitle}</Text>

          <Text variant="titleMedium" style={styles.sectionTitle}>Medicines Mentioned</Text>
          {medicines.map((medicine, index) => (
            <View key={index} style={styles.medicineItem}>
              {editingIndex === index ? (
                <View style={styles.editForm}>
                  <TextInput
                    label="Medicine Name"
                    value={medicine.name}
                    onChangeText={(value) => handleUpdateMedicine(index, 'name', value)}
                    style={styles.input}
                  />
                  <TextInput
                    label="Timing"
                    value={medicine.timing}
                    onChangeText={(value) => handleUpdateMedicine(index, 'timing', value)}
                    style={styles.input}
                  />
                  <TextInput
                    label="Dosage"
                    value={medicine.dosage}
                    onChangeText={(value) => handleUpdateMedicine(index, 'dosage', value)}
                    style={styles.input}
                  />
                  <TextInput
                    label="Frequency"
                    value={medicine.frequency}
                    onChangeText={(value) => handleUpdateMedicine(index, 'frequency', value)}
                    style={styles.input}
                  />
                  <View style={styles.mealRelationButtons}>
                    {['before', 'after', 'with'].map((relation) => (
                      <Button
                        key={relation}
                        mode={medicine.mealRelation === relation ? 'contained' : 'outlined'}
                        onPress={() => handleUpdateMedicine(index, 'mealRelation', relation)}
                        style={styles.mealButton}
                      >
                        {relation}
                      </Button>
                    ))}
                  </View>
                  <Button
                    mode="contained"
                    onPress={() => handleSaveMedicine(index)}
                    style={styles.saveButton}
                  >
                    Save Changes
                  </Button>
                </View>
              ) : (
                <View style={styles.medicineDetails}>
                  <View style={styles.medicineHeader}>
                    <Text variant="titleMedium" style={styles.medicineName}>{medicine.name}</Text>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => handleEditMedicine(index)}
                    />
                  </View>
                  <Text variant="bodyMedium">Timing: {medicine.timing}</Text>
                  <Text variant="bodyMedium">Dosage: {medicine.dosage}</Text>
                  <Text variant="bodyMedium">Frequency: {medicine.frequency}</Text>
                  {getMealRelationChip(medicine.mealRelation)}
                </View>
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={onCancel}
          style={styles.button}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={() => onSave(medicines)}
          style={styles.button}
        >
          Save
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  medicineItem: {
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicineName: {
    fontWeight: '600',
  },
  medicineDetails: {
    gap: 4,
  },
  editForm: {
    gap: 8,
  },
  input: {
    marginBottom: 8,
  },
  mealRelationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  mealButton: {
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
}); 