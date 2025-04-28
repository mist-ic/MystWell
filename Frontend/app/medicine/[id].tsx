import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, useTheme, Surface, Button, IconButton, Divider, List, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getDrugDetailsByRxcui, ProcessedDrugProperties } from '@/services/medicineService'; // Adjust path if needed

// Remove mock data
// interface MedicineDetails { ... }
// const medicinesData: MedicineDetails[] = [ ... ];

export default function MedicineDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const rxcui = params.id as string; // ID from route is the RxCUI

  const [medicineDetails, setMedicineDetails] = useState<ProcessedDrugProperties | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!rxcui) {
        setError('Medicine ID not found.');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const details = await getDrugDetailsByRxcui(rxcui);
        if (details) {
          setMedicineDetails(details);
        } else {
          setError('Medicine details not found.');
        }
      } catch (err) {
        setError('Failed to load medicine details. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [rxcui]); // Re-fetch if rxcui changes

  // Optional: Reorder functionality (keep or remove based on requirements)
  const handleReorder = () => {
    // This might need adjustment - reordering based on RxCUI?
    // Or perhaps this button should be removed from this screen?
    router.push('/medicine/reorder');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" animating={true} />
        <Text style={styles.loadingText}>Loading Medicine Details...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Error' }} />
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  if (!medicineDetails) {
    // Should ideally be caught by error state, but as a fallback
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
         <Stack.Screen options={{ title: 'Not Found' }} />
        <Text style={styles.errorText}>Medicine details could not be loaded.</Text>
        <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  // Render the fetched details
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
       {/* Use Stack.Screen to dynamically set the title */}
      <Stack.Screen options={{ title: medicineDetails.name || 'Medicine Details' }} />
      {/* Keep header or remove if Stack.Screen handles title/back button */}
      {/* 
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="headlineSmall" style={styles.title}>{medicineDetails.name || 'Medicine Details'}</Text>
        <View style={{ width: 48 }} /> // Spacer for centering title 
      </View>
      */}

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContentContainer}>
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text variant="headlineMedium" style={styles.medicineName}>
            {medicineDetails.name}
          </Text>
          <View style={styles.headerInfo}> 
            <Text variant="bodySmall" style={styles.rxcuiText}>RxCUI: {medicineDetails.rxcui}</Text>
            {medicineDetails.tty && <Chip icon="tag" style={styles.chip} textStyle={styles.chipText}>{medicineDetails.tty}</Chip>}
            {medicineDetails.deaSchedule && <Chip icon="lock-outline" style={[styles.chip, styles.deaChip]} textStyle={styles.chipText}>DEA: {medicineDetails.deaSchedule}</Chip>}
          </View>
          
          {/* Consider if Reorder button makes sense here */}
          {/* 
          <Button
            mode="contained"
            onPress={handleReorder}
            style={styles.reorderButton}
          >
            Reorder
          </Button> 
          */}

          <Divider style={styles.divider} />

          {/* --- Brand Names Section --- */} 
          {medicineDetails.brandNames && (
             <View style={styles.infoSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Brand Name(s)</Text>
                {medicineDetails.brandNames.map((item, index) => (
                    <Text key={index} variant="bodyLarge" style={styles.listItem}>• {item}</Text>
                ))}
             </View>
          )}

          {/* --- Manufacturer Section --- */} 
          {medicineDetails.manufacturer && (
             <View style={styles.infoSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Manufacturer</Text>
                <Text variant="bodyLarge" style={styles.listItem}>{medicineDetails.manufacturer}</Text>
             </View>
          )}

          {/* --- Dosage & Strength Section --- */} 
          {(medicineDetails.dosageForms || medicineDetails.strengths) && (
              <View style={styles.infoSection}>
                 <Text variant="titleMedium" style={styles.sectionTitle}>Form & Strength</Text>
                 {medicineDetails.dosageForms && medicineDetails.dosageForms.map((item, index) => (
                    <Text key={`form-${index}`} variant="bodyLarge" style={styles.listItem}>• Form: {item}</Text>
                 ))}
                 {medicineDetails.strengths && medicineDetails.strengths.map((item, index) => (
                    <Text key={`strength-${index}`} variant="bodyLarge" style={styles.listItem}>• Strength: {item}</Text>
                 ))}
              </View>
          )}

          {/* --- Ingredients Section --- */} 
          {medicineDetails.ingredients && (
            <View style={styles.infoSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Active Ingredients</Text>
              {medicineDetails.ingredients.map((item, index) => (
                <Text key={`ing-${index}`} variant="bodyLarge" style={styles.listItem}>• {item}</Text>
              ))}
            </View>
          )}
          
          {/* --- Synonyms Section --- */} 
          {medicineDetails.synonyms && (
            <View style={styles.infoSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Synonyms</Text>
              {medicineDetails.synonyms.map((item, index) => (
                 <Text key={`syn-${index}`} variant="bodyLarge" style={styles.listItem}>• {item}</Text>
              ))}
            </View>
          )}
          
          {/* --- NDC Section --- */} 
          {medicineDetails.ndcs && (
             <View style={styles.infoSection}>
              <Text variant="titleMedium" style={styles.sectionTitle}>NDC Codes</Text>
              {medicineDetails.ndcs.map((item, index) => (
                <Text key={`ndc-${index}`} variant="bodyLarge" style={styles.listItem}>• {item}</Text>
              ))}
            </View>
          )}

          {/* TODO: Add other sections as needed (e.g., Interactions - requires different API calls) */}

        </Surface>
        
        {/* Section to display Raw Properties (Optional for debugging/completeness) */}
        {/* 
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface, marginTop: 15 }]}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Raw Properties (Debug):</Text>
             <List.Accordion title="Show Raw Data">
              {medicineDetails.rawProperties.map((prop, index) => (
                <List.Item 
                  key={index} 
                  title={`${prop.propName}: ${prop.propValue}`} 
                  titleNumberOfLines={3} 
                />
              ))}
            </List.Accordion>
        </Surface> 
        */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: { // Added style for centering loading/error states
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { // Added style
    marginTop: 10,
    fontSize: 16,
  },
  errorText: { // Added style
    color: 'red',
    textAlign: 'center',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    // Removed border bottom, Stack navigator usually handles this
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15, // Add space between sections if needed
    elevation: 3, // Add shadow for Surface
  },
  medicineName: {
    marginBottom: 5,
    fontWeight: 'bold',
  },
  rxcuiText: { // Added style
    marginBottom: 15,
    color: 'gray',
    fontSize: 12,
  },
  reorderButton: {
    marginTop: 10,
    marginBottom: 15,
  },
  divider: {
    marginVertical: 15,
  },
  infoSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  listItem: {
    marginLeft: 10, // Indent list items
    marginBottom: 3,
  },
  headerInfo: { // Added style for header details layout
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 5,
    gap: 8, // Gap between items
  },
  chip: { // Style for Chips
    height: 28, // Smaller chip
    alignItems: 'center',
  },
  chipText: { // Style for text inside Chip
     fontSize: 11, 
  },
   deaChip: { // Specific style for DEA chip
    backgroundColor: '#fdeded', // Light red background
  },
  scrollContentContainer: { // Added for padding at the bottom
    paddingBottom: 20, 
  },
}); 