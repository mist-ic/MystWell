import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Animated, ActivityIndicator, FlatList } from 'react-native';
import { Text, useTheme, Searchbar, Surface, Button, Portal, Modal, Chip, List, Divider, ProgressBar, FAB, Badge, MD3Theme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import debounce from 'lodash.debounce';
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
});

// Helper function to capitalize the first letter
const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function MedicineScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DrugConcept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [expandedMedicineId, setExpandedMedicineId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<Medicine[]>([]);
  const animationsMap = useRef<{ [key: string]: Animated.Value }>({});

  const getAnimation = (medicineId: string) => {
    if (!animationsMap.current[medicineId]) {
      animationsMap.current[medicineId] = new Animated.Value(0);
    }
    return animationsMap.current[medicineId];
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
        debouncedApiSearch.cancel();
    }

    return () => {
      debouncedApiSearch.cancel();
    };
  }, [searchQuery, debouncedApiSearch]);
  
  const handleMedicinePress = (medicineId: string) => {
    const animation = getAnimation(medicineId);
    
    if (expandedMedicineId === medicineId) {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setExpandedMedicineId(null);
      });
    } else {
      setExpandedMedicineId(medicineId);
      Animated.timing(animation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleApiResultSelect = (drug: DrugConcept) => {
    router.push(`/medicine/${drug.rxcui}`);
  };

  const handleReorder = (medicineId: string) => {
    router.push(`/medicine/reorder?id=${medicineId}`);
  };

  const filteredMedicines = searchQuery
    ? searchResults
    : currentMedications;

  const addToCart = (medicine: Medicine) => {
    if (!cartItems.some(item => item.id === medicine.id)) {
      setCartItems([...cartItems, medicine]);
    }
  };

  const goToCart = () => {
    router.push('/medicine/reorder');
  };

  const renderCurrentMedicationItem = (medicine: Medicine) => {
    const animation = getAnimation(medicine.id);
    const isInCart = cartItems.some(item => item.id === medicine.id);
    return (
      <View key={medicine.id}>
        <Surface style={[styles.medicineCard, { backgroundColor: theme.colors.primaryContainer }]}>
          <TouchableOpacity 
            style={[styles.medicineContent, expandedMedicineId !== medicine.id && styles.medicineContentCollapsed]}
            onPress={() => handleMedicinePress(medicine.id)}
          >
            <View style={styles.medicineHeader}>
              <View style={styles.medicineInfo}>
                <Text variant="titleMedium" style={styles.medicineName}>
                  {medicine.name}
                </Text>
                <Text variant="bodyMedium" style={styles.medicineSubInfo}>
                  {medicine.dosage} • {medicine.frequency}
                </Text>
                <View style={styles.quantityContainer}>
                  <ProgressBar 
                    progress={medicine.quantity.current / medicine.quantity.total} 
                    color={theme.colors.primary}
                    style={styles.progressBar}
                  />
                  <Text variant="bodySmall" style={styles.quantityText}>
                    {medicine.quantity.current} of {medicine.quantity.total} {medicine.quantity.unit} left
                  </Text>
                </View>
              </View>
              <Animated.View style={{
                transform: [{
                  rotate: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg']
                  })
                }]
              }}>
                <MaterialCommunityIcons name="chevron-down" size={24} color={theme.colors.onSurface} />
              </Animated.View>
            </View>
          </TouchableOpacity>
          <Animated.View style={[styles.detailsContainer, {
            height: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 250]
            }),
            opacity: animation,
          }]}>
            {expandedMedicineId === medicine.id && (
              <View style={styles.detailsContent}>
                <Divider style={styles.divider}/>
                <Text variant="bodyMedium" style={styles.detailText}>Purpose: {medicine.purpose}</Text>
                <Text variant="bodyMedium" style={styles.detailTitle}>Composition:</Text>
                {medicine.composition.map((comp, idx) => <Text key={idx} style={styles.detailListItem}>• {comp}</Text>)}
                <Text variant="bodyMedium" style={styles.detailTitle}>Side Effects:</Text>
                {medicine.sideEffects.map((effect, idx) => <Text key={idx} style={styles.detailListItem}>• {effect}</Text>)}
                <Text variant="bodyMedium" style={styles.detailTitle}>Substitutes:</Text>
                {medicine.substitutes.map((sub, idx) => <Text key={idx} style={styles.detailListItem}>• {sub}</Text>)}
                <View style={styles.actionsContainer}>
                  <Button 
                    mode="contained-tonal" 
                    onPress={() => handleReorder(medicine.id)}
                    icon="repeat-variant"
                    style={styles.actionButton}
                    labelStyle={styles.actionButtonLabel}
                  >
                    Reorder
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={() => addToCart(medicine)}
                    icon={isInCart ? "check" : "cart-plus"}
                    style={styles.actionButton}
                    disabled={isInCart}
                    labelStyle={styles.actionButtonLabel}
                  >
                    {isInCart ? 'Added' : 'Add to Cart'}
                  </Button>
                </View>
              </View>
            )}
          </Animated.View>
        </Surface>
      </View>
    );
  };

  
  
  const renderApiResultItem = ({ item }: { item: DrugConcept }) => (
    <TouchableOpacity onPress={() => handleApiResultSelect(item)}>
      <List.Item
        title={capitalizeFirstLetter(item.name)}
        titleNumberOfLines={2}
        description={`RxCUI: ${item.rxcui}`}
        style={styles.apiResultItem}
      />
    </TouchableOpacity>
  );

  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppHeader 
        title="Medicines" 
        rightIcon="cart-outline"
        rightIconBadge={cartItems.length > 0 ? cartItems.length : undefined}
        onRightPress={goToCart}
      />
      
      <View style={styles.content}>
        <StyledSearchBar
          placeholder="Search RxNorm database..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          containerStyle={styles.searchContainerMargin}
        />

        {searchQuery.trim().length > 0 ? (
          <View style={styles.section}>
             <Text variant="titleMedium" style={styles.sectionTitle}>Search Results</Text>
            {isSearching && <ActivityIndicator style={styles.loader} />}
            {searchError && <Text style={styles.errorText}>{searchError}</Text>}
            {!isSearching && !searchError && searchResults.length === 0 && (
                <Text style={styles.infoText}>No results found for "{searchQuery}".</Text>
            )}
            {!isSearching && searchResults.length > 0 && (
                <FlatList 
                    data={searchResults}
                    renderItem={renderApiResultItem}
                    keyExtractor={(item, index) => item.rxcui + '-' + index}
                    style={styles.resultsList}
                />
            )}
          </View>
        ) : (
          <ScrollView style={styles.scrollView}>
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Current Medications
              </Text>
              {currentMedications.map(renderCurrentMedicationItem)}
            </View>
          </ScrollView>
        )}

      </View>

       {/* Keep FAB if needed, maybe for adding custom medication? */}
       {/* 
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => console.log('Add new medication')}
          color={theme.colors.onPrimary}
          label='Add New'
        /> 
       */}
    </SafeAreaView>
  );
} 