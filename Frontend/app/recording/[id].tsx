import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Text, useTheme, Surface, Button, List, Portal, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';

interface Medicine {
  id: number;
  name: string;
  purpose: string;
  sideEffects: string[];
  dosage: string;
  timing: string;
}

export default function RecordingDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMedsModalVisible, setIsMedsModalVisible] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);

  // Mock medicines data
  const medicines: Medicine[] = [
    {
      id: 1,
      name: "Amoxicillin",
      purpose: "Prescribed for treating bacterial infection causing headaches",
      sideEffects: [
        "Nausea",
        "Diarrhea",
        "Rash",
        "Loss of appetite"
      ],
      dosage: "500mg",
      timing: "Twice daily with meals"
    },
    {
      id: 2,
      name: "Melatonin",
      purpose: "Recommended for improving sleep pattern irregularities",
      sideEffects: [
        "Drowsiness",
        "Headache",
        "Dizziness",
        "Nausea"
      ],
      dosage: "5mg",
      timing: "Once daily, 30 minutes before bedtime"
    }
  ];

  // Mock data - In a real app, fetch this based on the id
  const recording = {
    id: parseInt(id),
    title: 'Recording ' + id,
    date: '25 June 2021 - 00:45 am',
    duration: '01:23',
    summary: 'This recording contains a discussion about health symptoms and medication schedule. The main topics covered include headache frequency, sleep patterns, and daily medication timing.',
    transcription: `
Doctor: How have you been feeling since our last appointment?

Patient: I've been experiencing some headaches, mostly in the afternoon.

Doctor: How often do these headaches occur?

Patient: About 2-3 times per week, usually after lunch.

Doctor: And how's your sleep pattern?

Patient: It's been irregular. I sometimes wake up in the middle of the night.

Doctor: I see. Let's adjust your medication schedule to help with these symptoms...
    `.trim()
  };

  const handleAskBot = () => {
    router.push('/chat');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.headerContainer}>
        <AppHeader 
          title={recording.title} 
          showBack 
          rightIcon="dots-vertical"
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Player Section */}
        <Surface style={styles.playerCard}>
          <View style={styles.playerInfo}>
            <Text style={styles.date}>{recording.date}</Text>
            <Text style={styles.duration}>{recording.duration}</Text>
          </View>
          
          <View style={styles.playerControls}>
            <TouchableOpacity style={styles.seekButton}>
              <MaterialCommunityIcons name="rewind-30" size={28} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <MaterialCommunityIcons 
                name={isPlaying ? "pause" : "play"} 
                size={32} 
                color="white" 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.seekButton}>
              <MaterialCommunityIcons name="fast-forward-30" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progress, 
                { 
                  backgroundColor: theme.colors.primary,
                  width: '45%' // This would be dynamic based on actual progress
                }
              ]} 
            />
          </View>
        </Surface>

        {/* Summary Section */}
        <Surface style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.sectionContent}>{recording.summary}</Text>
          
          <View style={styles.actionButtons}>
            <Button 
              mode="contained" 
              onPress={handleAskBot}
              icon="chat-question"
              style={styles.actionButton}
            >
              Ask Bot
            </Button>
            <Button 
              mode="contained-tonal"
              onPress={() => setIsMedsModalVisible(true)}
              icon="pill"
              style={styles.actionButton}
            >
              View Meds
            </Button>
          </View>
        </Surface>

        {/* Transcription Section */}
        <Surface style={styles.section}>
          <Text style={styles.sectionTitle}>Transcription</Text>
          <Text style={styles.sectionContent}>{recording.transcription}</Text>
        </Surface>
      </ScrollView>

      {/* Medicines Modal */}
      <Portal>
        <Modal
          visible={isMedsModalVisible}
          onRequestClose={() => {
            setIsMedsModalVisible(false);
            setSelectedMed(null);
          }}
          transparent
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <Surface style={styles.modalContent}>
              {!selectedMed ? (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Medications Discussed</Text>
                    <TouchableOpacity 
                      onPress={() => setIsMedsModalVisible(false)}
                      style={styles.closeButton}
                    >
                      <MaterialCommunityIcons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                  {medicines.map((med) => (
                    <List.Item
                      key={med.id}
                      title={med.name}
                      description={med.timing}
                      left={props => <List.Icon {...props} icon="pill" />}
                      right={props => <List.Icon {...props} icon="chevron-right" />}
                      onPress={() => setSelectedMed(med)}
                      style={styles.medicineItem}
                    />
                  ))}
                </>
              ) : (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity 
                      onPress={() => setSelectedMed(null)}
                      style={styles.backButton}
                    >
                      <MaterialCommunityIcons name="arrow-left" size={24} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{selectedMed.name}</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedMed(null);
                        setIsMedsModalVisible(false);
                      }}
                      style={styles.closeButton}
                    >
                      <MaterialCommunityIcons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.medDetailScroll}>
                    <Card style={styles.medDetailCard}>
                      <Card.Content>
                        <Text style={styles.medDetailSection}>
                          <Text style={styles.medDetailLabel}>Dosage: </Text>
                          {selectedMed.dosage}
                        </Text>
                        <Text style={styles.medDetailSection}>
                          <Text style={styles.medDetailLabel}>Timing: </Text>
                          {selectedMed.timing}
                        </Text>
                        <Text style={styles.medDetailSection}>
                          <Text style={styles.medDetailLabel}>Purpose:</Text>
                          {'\n'}{selectedMed.purpose}
                        </Text>
                        <Text style={styles.medDetailLabel}>Common Side Effects:</Text>
                        {selectedMed.sideEffects.map((effect, index) => (
                          <Text key={index} style={styles.sideEffect}>• {effect}</Text>
                        ))}
                      </Card.Content>
                    </Card>
                  </ScrollView>
                </>
              )}
            </Surface>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  playerCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  playerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  duration: {
    fontSize: 14,
    color: '#666',
  },
  playerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 24,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  seekButton: {
    padding: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  progress: {
    height: '100%',
    borderRadius: 2,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '90%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  medicineItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  medDetailScroll: {
    flex: 1,
  },
  medDetailCard: {
    marginBottom: 16,
  },
  medDetailSection: {
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 24,
  },
  medDetailLabel: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  sideEffect: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 8,
    marginTop: 4,
  },
}); 