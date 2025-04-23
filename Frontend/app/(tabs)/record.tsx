import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, Modal, ListRenderItem, ActivityIndicator } from 'react-native';
import { Text, useTheme, TextInput, Button, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import AppHeader from '@/components/AppHeader';
import { useRouter } from 'expo-router';
import { AudioWaveform } from '@/components/AudioWaveform';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { RecordingSummary, MedicineDetail } from '../../components/RecordingSummary';

interface Recording {
  id: number;
  title: string;
  date: string;
  duration: string;
  isPlaying?: boolean;
  medicines: MedicineDetail[];
}

interface RecordingItemProps {
  recording: Recording;
  onUpdateTitle: (id: number, newTitle: string) => void;
}

// Move RecordingItem outside of RecordScreen
const RecordingItem: React.FC<RecordingItemProps> = React.memo(({ recording, onUpdateTitle }) => {
  const theme = useTheme();
  const router = useRouter();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editedTitle, setEditedTitle] = useState(recording.title);
  const [menuVisible, setMenuVisible] = useState(false);

  const handleSave = useCallback(() => {
    onUpdateTitle(recording.id, editedTitle);
    setIsEditModalVisible(false);
  }, [recording.id, editedTitle, onUpdateTitle]);

  const handleRecordingPress = useCallback(() => {
    router.push({
      pathname: '/recording/[id]',
      params: { id: recording.id }
    });
  }, [recording.id, router]);

  return (
    <>
      <TouchableOpacity 
        style={[
          styles.recordingItem,
          recording.isPlaying && { backgroundColor: theme.colors.primaryContainer }
        ]}
        onPress={handleRecordingPress}
      >
        <View style={styles.recordingInfo}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent TouchableOpacity
            }}
          >
            <MaterialCommunityIcons
              name={recording.isPlaying ? "pause" : "play"}
              size={24}
              color={recording.isPlaying ? theme.colors.primary : "#666"}
            />
          </TouchableOpacity>
          <View>
            <Text style={styles.recordingTitle}>{recording.title}</Text>
            <Text style={styles.recordingDate}>{recording.date}</Text>
          </View>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent triggering the parent TouchableOpacity
                setMenuVisible(true);
              }}
            >
              <MaterialCommunityIcons name="dots-vertical" size={20} color="#666" />
            </TouchableOpacity>
          }
        >
          <Menu.Item 
            onPress={() => {
              setMenuVisible(false);
              setIsEditModalVisible(true);
            }} 
            title="Edit name" 
            leadingIcon="pencil"
          />
        </Menu>
      </TouchableOpacity>

      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Recording Name</Text>
            <TextInput
              mode="outlined"
              label="Recording Name"
              value={editedTitle}
              onChangeText={setEditedTitle}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Button 
                mode="text" 
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleSave}
                style={styles.modalButton}
              >
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default function RecordScreen() {
  return (
    <ErrorBoundary>
      <RecordScreenContent />
    </ErrorBoundary>
  );
}

function RecordScreenContent() {
  const theme = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00:00');
  const [audioLevel, setAudioLevel] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([
    {
      id: 8,
      title: 'Recording 8',
      date: '25 June 2021 - 00:45 am',
      duration: '01:23',
      isPlaying: true,
      medicines: []
    },
    {
      id: 7,
      title: 'Recording 7',
      date: '25 June 2021 - 08:45 pm',
      duration: '02:45',
      medicines: []
    },
    {
      id: 6,
      title: 'Recording 6',
      date: '23 June 2021 - 04:32 pm',
      duration: '00:45',
      medicines: []
    },
    {
      id: 5,
      title: 'Recording 5',
      date: '19 June 2021 - 11:30 am',
      duration: '03:21',
      medicines: []
    },
    {
      id: 4,
      title: 'Recording 4',
      date: '17 June 2021 - 09:14 am',
      duration: '01:15',
      medicines: []
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [currentRecordingDetails, setCurrentRecordingDetails] = useState<{
    title: string;
    duration: string;
    date: string;
    medicines: MedicineDetail[];
  } | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup timer on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Stop recording if active
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const updateTimer = useCallback(() => {
    if (!startTimeRef.current) return;

    const now = new Date();
    const diff = now.getTime() - startTimeRef.current.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    setRecordingTime(
      `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
  }, []);

  const startRecording = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required to record audio');
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.metering !== undefined) {
            const db = status.metering ?? -160;
            const normalized = Math.max(0, Math.min(1, (db + 160) / 160));
            setAudioLevel(normalized);
          }
        },
        100
      );

      recordingRef.current = recording;
      startTimeRef.current = new Date();
      setIsRecording(true);
      timerRef.current = setInterval(updateTimer, 1000);
    } catch (err) {
      setError('Failed to start recording. Please try again.');
      console.error('Failed to start recording', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);
      startTimeRef.current = null;

      if (uri) {
        // Mock medicine extraction - in a real app, this would come from speech-to-text and NLP processing
        const mockMedicines: MedicineDetail[] = [
          {
            name: "Aspirin",
            timing: "Morning 8 AM",
            mealRelation: "after",
            dosage: "500mg",
            frequency: "Once daily"
          }
        ];

        setCurrentRecordingDetails({
          title: `Recording ${recordings.length + 1}`,
          duration: recordingTime,
          date: new Date().toLocaleString(),
          medicines: mockMedicines
        });
        setShowSummary(true);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch (err) {
      setError('Failed to stop recording. Please try again.');
      console.error('Failed to stop recording', err);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelRecording = async () => {
    try {
      if (!recordingRef.current) return;

      // Stop and delete recording
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Reset state
      setIsRecording(false);
      startTimeRef.current = null;
      setRecordingTime('00:00:00');

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch (err) {
      console.error('Failed to cancel recording', err);
      alert('Failed to cancel recording');
    }
  };

  const handleUpdateTitle = useCallback((id: number, newTitle: string) => {
    setRecordings(prevRecordings =>
      prevRecordings.map(recording =>
        recording.id === id ? { ...recording, title: newTitle } : recording
      )
    );
  }, []);

  const handleSaveSummary = (updatedMedicines: MedicineDetail[]) => {
    if (currentRecordingDetails) {
      const newRecording = {
        id: Date.now(),
        title: currentRecordingDetails.title,
        date: currentRecordingDetails.date,
        duration: currentRecordingDetails.duration,
        medicines: updatedMedicines
      };
      setRecordings(prev => [newRecording, ...prev]);
      setShowSummary(false);
      setCurrentRecordingDetails(null);
    }
  };

  const handleCancelSummary = () => {
    setShowSummary(false);
    setCurrentRecordingDetails(null);
  };

  const renderItem: ListRenderItem<Recording> = useCallback(({ item }) => (
    <RecordingItem 
      recording={item}
      onUpdateTitle={handleUpdateTitle}
    />
  ), [handleUpdateTitle]);

  const keyExtractor = useCallback((item: Recording) => item.id.toString(), []);

  if (showSummary && currentRecordingDetails) {
    return (
      <RecordingSummary
        recordingTitle={currentRecordingDetails.title}
        duration={currentRecordingDetails.duration}
        date={currentRecordingDetails.date}
        medicines={currentRecordingDetails.medicines}
        onSave={handleSaveSummary}
        onCancel={handleCancelSummary}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <StatusBar style="dark" />
      <AppHeader title="Voice Recordings" rightIcon="cog" />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity 
            onPress={() => setError(null)}
            style={styles.dismissButton}
            accessible={true}
            accessibilityLabel="Dismiss error"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="close" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {isRecording ? (
        <View style={styles.recordingInterface}>
          <View style={[styles.micContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons 
              name="microphone" 
              size={64} 
              color={theme.colors.primary}
            />
          </View>
          <Text style={[styles.timer, { color: theme.colors.onSurface }]}>{recordingTime}</Text>
          <View style={[styles.waveform, { backgroundColor: theme.colors.surfaceVariant }]}>
            <AudioWaveform isRecording={isRecording} audioLevel={audioLevel} />
          </View>
          <View style={styles.recordingControls}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={cancelRecording}
              accessible={true}
              accessibilityLabel="Cancel recording"
              accessibilityHint="Discards the current recording"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons 
                name="delete" 
                size={28} 
                color={theme.colors.error}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.recordButton, { backgroundColor: theme.colors.primary }]}
              onPress={stopRecording}
              accessible={true}
              accessibilityLabel="Stop recording"
              accessibilityHint="Stops and saves the current recording"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="stop" size={32} color={theme.colors.onPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={stopRecording}
              accessible={true}
              accessibilityLabel="Save recording"
              accessibilityHint="Saves the current recording"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons 
                name="check" 
                size={28} 
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              <FlatList
                data={recordings}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                style={styles.recordingsList}
                contentContainerStyle={styles.recordingsListContent}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={5}
                removeClippedSubviews={Platform.OS !== 'web'}
              />
              <View style={[styles.bottomBar, { backgroundColor: theme.colors.background }]}>
                <TouchableOpacity 
                  style={[
                    styles.recordButton, 
                    { backgroundColor: theme.colors.primary },
                    isLoading && styles.disabledButton
                  ]}
                  onPress={startRecording}
                  disabled={isLoading}
                  accessible={true}
                  accessibilityLabel="Start recording"
                  accessibilityHint="Starts a new voice recording"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isLoading }}
                >
                  <MaterialCommunityIcons 
                    name="microphone" 
                    size={32} 
                    color={theme.colors.onPrimary}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  recordingsList: {
    flex: 1,
  },
  recordingsListContent: {
    padding: 16,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playButton: {
    marginRight: 12,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  recordingDate: {
    fontSize: 12,
    color: '#666',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: 'white',
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  controlButton: {
    padding: 8,
  },
  recordingInterface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  micContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  timer: {
    fontSize: 48,
    fontWeight: '600',
    marginBottom: 32,
  },
  waveform: {
    width: '100%',
    height: 64,
    backgroundColor: '#F5F5F5',
    borderRadius: 32,
    marginBottom: 32,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  dismissButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
}); 