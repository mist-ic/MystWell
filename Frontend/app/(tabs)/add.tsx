import React, { useState, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Text, useTheme, Searchbar, Surface, Button, Portal, Modal, Chip, List, Divider, ProgressBar, FAB, Badge } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';

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

export default function MedicineScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [expandedMedicineId, setExpandedMedicineId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<Medicine[]>([]);
  const animationsMap = useRef<{ [key: string]: Animated.Value }>({});

  // Initialize animations for each medicine
  const getAnimation = (medicineId: string) => {
    if (!animationsMap.current[medicineId]) {
      animationsMap.current[medicineId] = new Animated.Value(0);
    }
    return animationsMap.current[medicineId];
  };

  // Mock data for current medications
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

  // Mock data for medicine database
  const allMedicines: Medicine[] = [
    ...currentMedications,
    {
      id: '3',
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      purpose: 'Control blood sugar levels in type 2 diabetes',
      composition: ['Metformin hydrochloride', 'Povidone', 'Magnesium stearate'],
      sideEffects: ['Nausea', 'Diarrhea', 'Loss of appetite'],
      substitutes: ['Glipizide', 'Glyburide', 'Sitagliptin'],
      isActive: false,
      quantity: {
        current: 0,
        total: 60,
        unit: 'tablets'
      }
    },
  ];

  const handleMedicinePress = (medicineId: string) => {
    const animation = getAnimation(medicineId);
    
    if (expandedMedicineId === medicineId) {
      // Collapse animation
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setExpandedMedicineId(null);
      });
    } else {
      // Expand animation
      setExpandedMedicineId(medicineId);
      Animated.timing(animation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleReorder = (medicineId: string) => {
    router.push(`/medicine/reorder?id=${medicineId}`);
  };

  const filteredMedicines = searchQuery
    ? allMedicines.filter(med => 
        med.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentMedications;

  const addToCart = (medicine: Medicine) => {
    if (!cartItems.some(item => item.id === medicine.id)) {
      setCartItems([...cartItems, medicine]);
    }
  };

  const goToCart = () => {
    router.push('/medicine/reorder');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppHeader 
        title="Medicines" 
        rightIcon="cart-outline"
        rightIconBadge={cartItems.length > 0 ? cartItems.length : undefined}
        onRightPress={goToCart}
      />
      
      <View style={styles.content}>
        <Searchbar
          placeholder="Search medicines..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {searchQuery ? 'Search Results' : 'Current Medications'}
            </Text>
            {filteredMedicines.map((medicine) => {
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
                          <MaterialCommunityIcons 
                            name="chevron-down"
                            size={24} 
                            color={theme.colors.primary} 
                          />
                        </Animated.View>
                      </View>
                    </TouchableOpacity>
                    {expandedMedicineId === medicine.id && (
                      <Animated.View style={[
                        styles.actionButtonsContainer,
                        {
                          opacity: animation,
                          transform: [{
                            translateY: animation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-20, 0]
                            })
                          }]
                        }
                      ]}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => setSelectedMedicine(medicine)}
                        >
                          <MaterialCommunityIcons 
                            name="eye-outline" 
                            size={24} 
                            color={theme.colors.primary} 
                            style={styles.actionIcon}
                          />
                          <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
                            View
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.buttonDivider} />
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => isInCart ? goToCart() : addToCart(medicine)}
                        >
                          <MaterialCommunityIcons 
                            name={isInCart ? "cart" : "cart-plus"} 
                            size={24} 
                            color={theme.colors.primary} 
                            style={styles.actionIcon}
                          />
                          <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
                            {isInCart ? 'View Cart' : 'Add to Cart'}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  </Surface>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Medicine Detail Modal */}
        <Portal>
          <Modal
            visible={selectedMedicine !== null}
            onDismiss={() => setSelectedMedicine(null)}
            contentContainerStyle={styles.modalContainer}
          >
            {selectedMedicine && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text variant="headlineSmall" style={styles.modalTitle}>
                    {selectedMedicine.name}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setSelectedMedicine(null)}
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Dosage Information
                  </Text>
                  <Text variant="bodyLarge">
                    {selectedMedicine.dosage} • {selectedMedicine.frequency}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Remaining Quantity
                  </Text>
                  <View style={styles.modalQuantityContainer}>
                    <ProgressBar 
                      progress={selectedMedicine.quantity.current / selectedMedicine.quantity.total} 
                      color={theme.colors.primary}
                      style={styles.modalProgressBar}
                    />
                    <Text variant="bodyLarge" style={styles.modalQuantityText}>
                      {selectedMedicine.quantity.current} of {selectedMedicine.quantity.total} {selectedMedicine.quantity.unit} remaining
                    </Text>
                    {selectedMedicine.quantity.current <= selectedMedicine.quantity.total * 0.2 && (
                      <Text variant="bodyMedium" style={[styles.lowQuantityWarning, { color: theme.colors.error }]}>
                        Low quantity - Consider reordering
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Purpose
                  </Text>
                  <Text variant="bodyLarge">{selectedMedicine.purpose}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Composition
                  </Text>
                  <View style={styles.chipContainer}>
                    {selectedMedicine.composition.map((comp, index) => (
                      <Chip key={index} style={styles.chip}>{comp}</Chip>
                    ))}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Side Effects
                  </Text>
                  <View style={styles.chipContainer}>
                    {selectedMedicine.sideEffects.map((effect, index) => (
                      <Chip key={index} style={styles.chip}>{effect}</Chip>
                    ))}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text variant="titleMedium" style={styles.modalSectionTitle}>
                    Possible Substitutes
                  </Text>
                  <View style={styles.chipContainer}>
                    {selectedMedicine.substitutes.map((sub, index) => (
                      <Chip key={index} style={styles.chip}>{sub}</Chip>
                    ))}
                  </View>
                </View>
              </ScrollView>
            )}
          </Modal>
        </Portal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  medicineCard: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 0,
    overflow: 'hidden',
  },
  medicineContent: {
    padding: 16,
    paddingBottom: 0,
  },
  medicineContentCollapsed: {
    paddingBottom: 16,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medicineInfo: {
    flex: 1,
    marginRight: 16,
  },
  medicineName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  medicineSubInfo: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  quantityContainer: {
    marginTop: 4,
    width: '100%',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  quantityText: {
    fontSize: 12,
    opacity: 0.7,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  actionIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    flex: 1,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  modalQuantityContainer: {
    width: '100%',
  },
  modalProgressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  modalQuantityText: {
    marginBottom: 4,
  },
  lowQuantityWarning: {
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 