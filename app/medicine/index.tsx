import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { TextInput, List, PaperProvider, DefaultTheme } from 'react-native-paper';
import { router } from 'expo-router';
import debounce from 'lodash.debounce';

import { searchDrugsByName, DrugConcept } from '@/services/medicineService'; // Adjust path if needed

// Define the theme (optional, customize as needed)
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6200ee',
    accent: '#03dac4',
  },
};

export default function MedicineSearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrugConcept[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 3) {
        setSearchResults([]);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchDrugsByName(query);
        setSearchResults(results);
      } catch (err) {
        setError('Failed to fetch medicines. Please try again.');
        setSearchResults([]); // Clear results on error
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 500), // 500ms delay
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    // Cleanup function to cancel debounce on unmount
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const handleSelectDrug = (drug: DrugConcept) => {
    // Navigate to the details page, passing the RxCUI
    // Ensure the route exists and handles the parameter
    router.push(`/medicine/${drug.rxcui}`);
  };

  const renderItem = ({ item }: { item: DrugConcept }) => (
    <TouchableOpacity onPress={() => handleSelectDrug(item)}>
      <List.Item
        title={item.name}
        description={`RxCUI: ${item.rxcui} (${item.tty})`}
        // Add left icon or customize as needed
      />
    </TouchableOpacity>
  );

  return (
    <PaperProvider theme={theme}>
      <View style={styles.container}>
        <TextInput
          label="Search Medicines (e.g., Aspirin)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          style={styles.input}
          // Add clear button or other enhancements if desired
        />

        {isLoading && <ActivityIndicator animating={true} style={styles.loader} size="large" />}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!isLoading && !error && searchQuery.length > 0 && searchResults.length === 0 && (
          <Text style={styles.infoText}>No results found for "{searchQuery}".</Text>
        )}

        <FlatList
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={(item) => item.rxcui + item.tty} // Combine rxcui and tty for a more unique key
          style={styles.list}
          // Add optimizations like initialNumToRender if needed
        />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5', // Example background color
  },
  input: {
    marginBottom: 15,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  infoText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#555',
  },
  list: {
    flex: 1,
  },
}); 