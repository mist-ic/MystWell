import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { Text, useTheme, Surface, Button, List, Portal, Card, Snackbar, Menu, Divider, Dialog } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { getRecordingById, deleteRecording, retryTranscription } from '@/services/recordingService';
import { Recording } from '@/services/recordingService';
import { useAuth } from '@/context/auth';
import { Audio } from 'expo-av';

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
  const { session } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMedsModalVisible, setIsMedsModalVisible] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);

  const [recordingData, setRecordingData] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'info' | 'error' | 'success'>('info');

  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);
  const showConfirmDialog = () => setConfirmDialogVisible(true);
  const hideConfirmDialog = () => setConfirmDialogVisible(false);

  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    const fetchRecording = async () => {
      if (!id) {
        setError('Recording ID not provided.');
        setSnackbarVisible(true);
        setIsLoading(false);
        return;
      }

      const token = session?.access_token;
      if (!token) {
        setError('Authentication required.');
        setSnackbarVisible(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const recordingId = Array.isArray(id) ? id[0] : id;
        if (!recordingId) {
           throw new Error("Recording ID is missing.");
        }
        const data = await getRecordingById(recordingId, token);
        setRecordingData(data);
      } catch (err: any) {
        console.error("Error fetching recording:", err);
        if (err.message?.includes('401')) {
            setError('Authentication failed or session expired. Please log in again.');
        } else {
            setError(err.message || 'Failed to load recording details.');
        }
        setSnackbarVisible(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (id && session !== undefined) {
        fetchRecording();
    }
    
    if (session === null && !useAuth().loading) {
        setError('Please log in to view recordings.');
        setSnackbarVisible(true);
        setIsLoading(false);
    }

  }, [id, session]);

  const handleAskBot = () => {
    router.push({ pathname: '/chat', params: { recordingId: id } });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatDuration = (seconds?: number | null) => {
     if (seconds === undefined || seconds === null) return 'N/A';
     const minutes = Math.floor(seconds / 60);
     const remainingSeconds = Math.round(seconds % 60);
     return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const handleDeleteRecording = () => {
    closeMenu(); 
    if (!id || !session?.access_token || !recordingData) {
        return;
    }
    showConfirmDialog(); 
  };

  const executeDelete = async () => {
    hideConfirmDialog();
    if (!id || !session?.access_token || !recordingData) return;

    const recordingId = Array.isArray(id) ? id[0] : id;
    setIsDeleting(true);
    setError(null); 
    try {
      await deleteRecording(recordingId, session.access_token);
      
      const targetRoute = '/record'; 
      console.log(`[Detail Screen] Deletion successful, navigating to: ${targetRoute}`);
      router.replace(targetRoute as any);

    } catch (err: any) {
      console.error("[Detail Screen] Error during deleteRecording service call:", err);
      setError(err.message || 'Failed to delete recording.');
      setSnackbarVisible(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const showSnackbar = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  const fetchLatestRecordingData = async () => {
    if (!id || !session?.access_token) return;
    
    try {
      const recordingId = Array.isArray(id) ? id[0] : id;
      const data = await getRecordingById(recordingId, session.access_token);
      setRecordingData(data);
      
      if (!['queued', 'processing', 'transcribing_completed'].includes(data.status)) {
        stopPolling();
      }
    } catch (error) {
      console.error('Error polling recording data:', error);
      stopPolling();
    }
  };

  const startPolling = () => {
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(fetchLatestRecordingData, 3000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleRetryTranscription = async () => {
    if (!session?.access_token || !recordingData) return;
    
    try {
      setIsLoading(true);
      const updatedRecording = await retryTranscription(id, session.access_token);
      setRecordingData(updatedRecording);
      showSnackbar('Transcription retry initiated successfully', 'success');
      
      startPolling();
    } catch (error) {
      console.error('Error retrying transcription:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to retry transcription', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || isDeleting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" animating={true} color={theme.colors.primary} />
        <Text style={{ marginTop: 10 }}>{isDeleting ? 'Deleting Recording...' : 'Loading Recording...'}</Text>
      </SafeAreaView>
    );
  }

  if (!recordingData && !isLoading) {
     return (
       <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
         <MaterialCommunityIcons name="help-circle-outline" size={48} color={theme.colors.outline} />
         <Text style={{ marginTop: 10 }}>Recording not found.</Text>
         <Button onPress={() => router.back()}>Go Back</Button>
       </SafeAreaView>
     );
  }

  if (!recordingData) {
     return <SafeAreaView style={styles.container}><Text>Something went wrong.</Text></SafeAreaView>;
  }

  let transcriptionContent: string | React.ReactNode;
  if (recordingData.raw_transcript) {
    transcriptionContent = recordingData.raw_transcript;
  } else if (['queued', 'processing', 'transcribing_completed', 'analysis_failed'].includes(recordingData.status)) {
    transcriptionContent = (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }}/>
        <Text style={{ fontStyle: 'italic', color: theme.colors.outline }}>
          Transcription in progress (Status: {recordingData.status})...
        </Text>
      </View>
    );
  } else if (recordingData.status === 'transcription_failed') {
    transcriptionContent = (
      <View>
        <Text style={{ fontStyle: 'italic', color: theme.colors.error, marginBottom: 10 }}>
          Transcription failed. {recordingData.error ? `Error: ${recordingData.error}` : ''}
        </Text>
        <Button 
          mode="contained" 
          onPress={handleRetryTranscription} 
          icon="refresh"
          loading={isLoading}
          disabled={isLoading}
        >
          Retry Transcription
        </Button>
      </View>
    );
  } else if (recordingData.status === 'completed' && !recordingData.raw_transcript) {
    transcriptionContent = (
      <Text style={{ fontStyle: 'italic', color: theme.colors.outline }}>
        Processing completed, but no transcription was generated.
      </Text>
    );
  } else {
    transcriptionContent = (
      <Text style={{ fontStyle: 'italic', color: theme.colors.outline }}>
        Transcription not available (Status: {recordingData.status}).
      </Text>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.headerContainer}>
        <AppHeader 
          title={recordingData.title || 'Recording Detail'} 
          leftIcon="arrow-left" 
          onBackPress={() => {
            if (router.canGoBack()) {
              console.log("[Detail Screen Header] Navigating back.");
              router.back();
            } else {
              const targetRoute = '/record';
              console.log(`[Detail Screen Header] Cannot go back, replacing route with: ${targetRoute}`);
              router.replace(targetRoute);
            }
          }}
          rightIcon="dots-vertical"
          rightIconComponent={(props) => (
            <Menu
              visible={menuVisible}
              onDismiss={closeMenu}
              anchor={
                <TouchableOpacity onPress={openMenu} style={props.style}>
                  <MaterialCommunityIcons name="dots-vertical" size={props.size} color={props.color} />
                </TouchableOpacity>
              }
              anchorPosition="bottom"
            >
              <Menu.Item onPress={() => { closeMenu(); }} title="Edit Title" leadingIcon="pencil" />
              <Divider />
              <Menu.Item 
                onPress={handleDeleteRecording}
                title="Delete Recording" 
                leadingIcon="delete-outline" 
                titleStyle={{ color: theme.colors.error }} 
              />
            </Menu>
          )}
        />
      </View>

      <ScrollView style={styles.content}>
        <Surface style={styles.playerCard}>
          <View style={styles.playerInfo}>
            <Text style={styles.date}>{formatDate(recordingData.created_at)}</Text> 
            <Text style={styles.duration}>{formatDuration(recordingData.duration)}</Text>
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
                  width: '45%'
                }
              ]} 
            />
          </View>
        </Surface>

        <Surface style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {recordingData.summary ? (
            <Text style={styles.sectionContent}>{recordingData.summary}</Text>
          ) : (
             <Text style={{ fontStyle: 'italic', color: theme.colors.outline }}>Summary not yet available.</Text>
          )}
          
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

        <Card style={styles.card}>
          <Card.Title title="Analysis Results" titleVariant="headlineSmall" />
          <Card.Content>
            {recordingData.status === 'completed' && recordingData.structured_details ? (
              <View>
                {recordingData.structured_details.diagnosis && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>Diagnosis:</Text>
                    <Text style={styles.analysisValue}>{recordingData.structured_details.diagnosis}</Text>
                  </View>
                )}
                
                {recordingData.structured_details.symptoms && recordingData.structured_details.symptoms.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>Symptoms:</Text>
                    {recordingData.structured_details.symptoms.map((symptom: string, index: number) => (
                      <Text key={index} style={styles.bulletItem}>• {symptom}</Text>
                    ))}
                  </View>
                )}
                
                {recordingData.structured_details.prescribedMedicines && recordingData.structured_details.prescribedMedicines.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>Prescribed Medicines:</Text>
                    {recordingData.structured_details.prescribedMedicines.map((medicine: string, index: number) => (
                      <Text key={index} style={styles.bulletItem}>• {medicine}</Text>
                    ))}
                  </View>
                )}
                
                {recordingData.structured_details.importantPoints && recordingData.structured_details.importantPoints.length > 0 && (
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>Important Points:</Text>
                    {recordingData.structured_details.importantPoints.map((point: string, index: number) => (
                      <Text key={index} style={styles.bulletItem}>• {point}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.showTranscriptContainer}>
                  <Text style={styles.analysisLabel}>Transcription:</Text>
                  <Text selectable style={styles.transcriptText}>{recordingData.raw_transcript}</Text>
                </View>
              </View>
            ) : typeof transcriptionContent === 'string' ? (
              <Text selectable>{transcriptionContent}</Text>
            ) : (
              transcriptionContent
            )}
          </Card.Content>
        </Card>
      </ScrollView>

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

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{
          backgroundColor: 
            snackbarType === 'error' ? theme.colors.errorContainer : 
            snackbarType === 'success' ? theme.colors.primaryContainer : 
            theme.colors.surface
        }}
      >
        <Text style={{ 
          color: 
            snackbarType === 'error' ? theme.colors.error : 
            snackbarType === 'success' ? theme.colors.primary : 
            theme.colors.onSurface
        }}>
          {snackbarMessage}
        </Text>
      </Snackbar>

      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={hideConfirmDialog}>
          <Dialog.Icon icon="alert-circle-outline" color={theme.colors.error} size={36} />
          <Dialog.Title style={styles.dialogTitle}>Confirm Deletion</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to delete "{recordingData?.title || 'this recording'}"? 
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideConfirmDialog}>Cancel</Button>
            <Button onPress={executeDelete} textColor={theme.colors.error}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
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
  card: {
    marginBottom: 16,
  },
  analysisSection: {
    marginBottom: 16,
  },
  analysisLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  analysisValue: {
    fontSize: 16,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: 16,
    marginLeft: 16,
    marginBottom: 4,
  },
  showTranscriptContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  transcriptText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  dialogTitle: {
    textAlign: 'center',
  },
}); 