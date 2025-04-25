import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, ListRenderItem, ActivityIndicator, Alert } from 'react-native';
import { Text, useTheme, TextInput, Button, Menu, Snackbar, Modal, Portal, Divider, Dialog, Searchbar, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import AppHeader from '@/components/AppHeader';
import { useRouter } from 'expo-router';
import { AudioWaveform } from '@/components/AudioWaveform';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '../../context/auth';
import { deleteRecording } from '../../services/recordingService';

// --- Configuration ---
// TODO: Move this to a config file or environment variable
// const API_BASE_URL = 'http://172.31.231.222:3000'; // Use the provided IP and default port
const API_BASE_URL = 'http://localhost:3000'; // Changed to localhost

// --- Types ---
// Define Recording type based on backend structure
export interface Recording {
  id: string; // UUID
  profile_id: string;
  title: string;
  duration: number; // in seconds
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  transcription?: string;
  summary?: string;
  storage_path: string;
  status: string; // e.g., 'pending_upload', 'uploaded', 'processing', 'completed', 'failed', 'cancelled'
  error?: string;
  metadata?: any;
  // Frontend-specific temporary state
  isPlaying?: boolean;
}

interface RecordingItemProps {
  recording: Recording;
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  showDeleteConfirmDialog: (id: string, title: string) => void;
}

// --- Components ---

// Recording Item Component (Adapted for backend data)
const RecordingItem: React.FC<RecordingItemProps> = React.memo(({ 
    recording, 
    currentlyPlayingId, 
    setCurrentlyPlayingId,
    showDeleteConfirmDialog
}) => {
  const theme = useTheme();
  const router = useRouter();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editedTitle, setEditedTitle] = useState(recording.title);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false);
  const { session } = useAuth();
  const soundRef = useRef<Audio.Sound | null>(null);

  const isPlaying = currentlyPlayingId === recording.id;

  // Function to unload the sound safely
  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      console.log(`Unloading sound for ${recording.id}`);
      try {
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.warn(`Error unloading sound for ${recording.id}:`, error);
      }
      soundRef.current = null;
    }
  }, [recording.id]);

  // Cleanup sound on unmount or if ID changes
  useEffect(() => {
    return () => {
      unloadSound();
    };
  }, [unloadSound]);

  // Update Title Handler
  const handleSaveTitle = useCallback(async () => {
    if (!session || !editedTitle || editedTitle === recording.title) {
        setIsEditModalVisible(false);
        return; // No changes or not authenticated
    }
    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/recordings/${recording.id}`, { 
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: editedTitle }),
      });
      if (!response.ok) {
          let errorMsg = 'Failed to update title';
          try {
              const errorData = await response.json();
              errorMsg = errorData.message || errorMsg;
          } catch(e) {}
          throw new Error(errorMsg);
      }
      
      console.log("Title updated successfully for:", recording.id);
    setIsEditModalVisible(false);
    } catch (error: any) {
      console.error("Error updating title:", error);
      Alert.alert("Error", error.message || "Failed to update recording name.");
    } finally {
      setIsUpdating(false);
    }
  }, [recording.id, recording.title, editedTitle, session]);

  const handleRecordingPress = useCallback(() => {
    // Navigate to detail screen, passing only the ID
    // The detail screen will fetch full details using the ID
    router.push({
      pathname: `/recording/[id]`, 
      params: { id: recording.id } // Pass only ID
    });
  }, [recording.id, router]);

  // Playback Handler
  const handlePlayPause = useCallback(async () => {
    if (!session) {
      Alert.alert("Authentication Required", "Please log in to play recordings.");
      return;
    }

    if (isLoadingPlayback) return; // Prevent double taps while loading

    // If this item is already playing, stop it
    if (isPlaying) {
      console.log("Stopping playback for:", recording.id);
      setIsLoadingPlayback(true);
      await unloadSound();
      setCurrentlyPlayingId(null);
      setIsLoadingPlayback(false);
      return;
    }

    // Stop any other currently playing sound before starting new one
    if (currentlyPlayingId && currentlyPlayingId !== recording.id) {
         console.log("Stopping previous sound before playing new one.");
         // We rely on the main component to handle stopping the *other* sound instance
         setCurrentlyPlayingId(recording.id); // Signal intent to play this one
         // Ideally, the parent component would have a way to directly stop the other soundRef
         // For now, setting the ID will cause the other item to stop in its own effect/logic
    } else {
        setCurrentlyPlayingId(recording.id);
    }

    setIsLoadingPlayback(true);

    try {
      console.log("Requesting playback URL for:", recording.id);
      const response = await fetch(`${API_BASE_URL}/recordings/${recording.id}/playback-url`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to get playback URL: ${response.status}`);
      }

      const { playbackUrl } = await response.json();
      console.log("Playback URL received, loading sound...");

      // Ensure previous sound is unloaded before loading new one
      await unloadSound(); 

      // Load and play the new sound
      const { sound } = await Audio.Sound.createAsync(
         { uri: playbackUrl },
         { shouldPlay: true } // Start playing immediately
      );
      soundRef.current = sound;

      // Set up listener for when playback finishes
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log("Playback finished for:", recording.id);
          unloadSound();
          setCurrentlyPlayingId(null); // Clear playing state
        }
      });

      console.log("Playback started for:", recording.id);

    } catch (error: any) {
      console.error("Error during playback setup:", error);
      Alert.alert("Playback Error", error.message || "Could not play recording.");
      setCurrentlyPlayingId(null); // Clear playing state on error
      unloadSound();
    } finally {
      setIsLoadingPlayback(false);
    }
  }, [recording.id, session, isPlaying, currentlyPlayingId, setCurrentlyPlayingId, isLoadingPlayback]);

  // --- Modified Delete Handler: Trigger Parent Dialog --- 
  const handleDeleteRequest = useCallback(() => {
    // console.log(`[List Item ${recording.id}] handleDeleteRequest called`);
    setMenuVisible(false); 
    showDeleteConfirmDialog(recording.id, recording.title || 'this recording');
  }, [recording.id, recording.title, showDeleteConfirmDialog]);
  // --- End Modified Delete Handler ---

  const formatDate = (dateString: string) => {
    try {
        // Use more user-friendly formatting
        return new Date(dateString).toLocaleDateString(undefined, { 
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    } catch {
        return dateString; // Fallback
    }
  }
  
  const formatDuration = (seconds: number) => {
      if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  return (
    <TouchableOpacity 
      style={[styles.itemContainer, { backgroundColor: theme.colors.surfaceVariant }]}
      onPress={handleRecordingPress}
      disabled={isUpdating}
    >
      <View style={styles.itemContentContainer}>
        <TouchableOpacity onPress={handlePlayPause} disabled={isLoadingPlayback} style={styles.playButton}>
          {isLoadingPlayback ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <MaterialCommunityIcons 
              name={isPlaying ? "pause-circle" : "play-circle"} 
              size={36} 
              color={theme.colors.primary}
            />
          )}
        </TouchableOpacity>

        <View style={styles.itemTextContainer}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.itemTitle}>
            {recording.title || 'Untitled Recording'}
          </Text>
          <Text variant="bodySmall" style={styles.itemDetail}>
            {formatDate(recording.created_at)} • {formatDuration(recording.duration ?? 0)} • {recording.status}
          </Text>
        </View>

        {isUpdating && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.itemLoadingIndicator || { marginLeft: 8 }} />
        )}

        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={
            <TouchableOpacity onPress={openMenu} style={styles.menuButton} disabled={isUpdating}>
              <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          }
          anchorPosition="bottom"
        >
          <Menu.Item 
            onPress={() => { closeMenu(); setIsEditModalVisible(true); }} 
            title="Rename" 
            leadingIcon="pencil-outline"
          />
          <Divider />
          <Menu.Item 
            onPress={handleDeleteRequest} 
            title="Delete" 
            leadingIcon="delete-outline" 
            titleStyle={{ color: theme.colors.error }}
          />
        </Menu>
      </View>

      <Portal>
        <Modal visible={isEditModalVisible} onDismiss={() => setIsEditModalVisible(false)} contentContainerStyle={[styles.modalContainer, {backgroundColor: theme.colors.background}]}>
          <Text variant="headlineSmall" style={styles.modalTitle}>Rename Recording</Text>
          <TextInput
            label="New Title"
            value={editedTitle}
            onChangeText={setEditedTitle}
            mode="outlined"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setIsEditModalVisible(false)}>Cancel</Button>
            <Button 
              mode="contained" 
              onPress={handleSaveTitle} 
              loading={isUpdating} 
              disabled={isUpdating || !editedTitle || editedTitle === recording.title}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </TouchableOpacity>
  );
});

// Main Screen Component
export default function RecordScreen() {
  return (
    <ErrorBoundary fallback={<Text>Something went wrong loading the recording screen.</Text>}>
      <RecordScreenContent />
    </ErrorBoundary>
  );
}

function RecordScreenContent() {
  const theme = useTheme();
  const { session } = useAuth(); // Get session for auth token

  // Input State
  const [recordingTitle, setRecordingTitle] = useState(''); // State for title input

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [audioLevel, setAudioLevel] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const activeUploadInfo = useRef<{ recordingId: string; storagePath: string; uploadUrl: string } | null>(null);

  // List State
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  
  // Snackbar State
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Playback State
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  // --- Dialog State (New) ---
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{id: string; title: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // Add deleting state here

  const showDeleteConfirmDialog = useCallback((id: string, title: string) => {
    // console.log(`[RecordScreen] showDeleteConfirmDialog called for ID: ${id}, Title: ${title}`);
    setRecordingToDelete({ id, title });
    setConfirmDialogVisible(true);
  }, []);

  const hideConfirmDialog = () => {
    setConfirmDialogVisible(false);
    setRecordingToDelete(null);
  };

  // --- API Interaction ---

  const fetchRecordings = useCallback(async () => {
    if (!session) {
      // Don't show error if simply not logged in, just show empty state
      // setListError("Not authenticated"); 
      setIsLoadingList(false);
      setRecordings([]); 
      return;
    }
    
    setIsLoadingList(true);
    setListError(null);
    console.log("Fetching recordings...");

    try {
      const response = await fetch(`${API_BASE_URL}/recordings`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
        } catch (e) { /* ignore json parse error */ }
        throw new Error(errorMsg);
      }

      const data: Recording[] = await response.json();
      // Add isPlaying state locally if needed for UI
      console.log("Raw API response:", JSON.stringify(data));
      setRecordings(data.map(r => ({ ...r, isPlaying: false }))); 
      console.log("Recordings fetched:", data.length);
    } catch (error: any) {
      console.error("Error fetching recordings:", error);
      setListError(error.message || "Failed to fetch recordings.");
      setRecordings([]); // Clear recordings on error
    } finally {
      setIsLoadingList(false);
    }
  }, [session]);

  // Fetch recordings on mount or when session changes
  useEffect(() => {
    fetchRecordings();

    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Stop and unload recording if component unmounts while recording
      if (recordingRef.current) {
         console.log("Unloading active recording on unmount...");
         recordingRef.current.stopAndUnloadAsync().catch(err => console.error("Error unloading recording on unmount:", err));
         recordingRef.current = null;
      }
    };
  }, [fetchRecordings]); // Re-fetch when fetchRecordings dependency (session) changes

  // Update recording status via API
  const updateApiRecordingStatus = async (recordingId: string, status: string, errorMsg?: string, duration?: number) => {
      if (!session) return;
      console.log(`Updating API status for ${recordingId} to ${status}${duration ? ` with duration ${duration}s` : ''}`);
      try {
          const response = await fetch(`${API_BASE_URL}/recordings/${recordingId}/status`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ status, error: errorMsg, duration }),
          });
          if (!response.ok) {
              let errorDetail = `Status update failed: ${response.status}`;
              try {
                  const errorData = await response.json();
                  errorDetail = errorData.message || errorDetail;
              } catch (e) {} 
              throw new Error(errorDetail);
          }
          console.log(`Status updated successfully for ${recordingId}`);
          // Refresh list after status update
          fetchRecordings(); 
      } catch (error: any) {
          console.error(`Failed to update status to ${status} for ${recordingId}:`, error);
          setSnackbarMessage(`Error updating status: ${error.message}`);
          setSnackbarVisible(true);
      }
  };

  // --- Recording Logic ---

  // Timer Update
  const updateTimer = useCallback(() => {
    if (!startTimeRef.current) return;
    const now = new Date();
    const diff = now.getTime() - startTimeRef.current.getTime();
    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setRecordingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }, []);

  // Start Recording Process
  const startRecording = async () => {
    if (!session) {
      setSnackbarMessage('Please log in to record.');
      setSnackbarVisible(true);
      return;
    }
    if (isRecording || isLoadingList || isSaving) return; // Prevent starting if busy

    setIsLoadingList(true); // Use list loading indicator for setup phase
    setListError(null);
    activeUploadInfo.current = null; // Reset previous upload info
    let createdRecordingId: string | null = null;

    try {
      // 1. Request Mic Permissions (Platform Specific)
      console.log('Requesting permissions...');
      let permissionGranted = false;
      if (Platform.OS === 'web') {
          try {
              // Use standard Web API for permissions
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              // We don't need the stream itself for Expo AV, just need the permission grant.
              // Important: Stop the tracks immediately to release the microphone indicator if Expo AV doesn't handle it.
              stream.getTracks().forEach(track => track.stop());
              permissionGranted = true;
              console.log('Web microphone permission granted.');
          } catch (err) {
              console.error("Web microphone permission denied:", err);
              throw new Error('Microphone permission is required');
          }
      } else {
          // Use Expo API for native
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
              throw new Error('Microphone permission is required');
          }
          permissionGranted = true;
           console.log('Native microphone permission granted.');
      }

      if (!permissionGranted) {
        // This case should theoretically not be reached due to throws above, but belts and suspenders
        throw new Error('Microphone permission was not granted.');
      }

      // 2. Get Upload URL and create metadata entry
      console.log("Requesting upload URL...");
      // Use state for title, provide a default if empty
      const titleToSend = recordingTitle.trim() || `Recording - ${new Date().toLocaleString()}`;

      const uploadResponse = await fetch(`${API_BASE_URL}/recordings/upload-url`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
          },
          // Send the actual title, keep duration 0 initially
          body: JSON.stringify({ title: titleToSend, duration: 0 }), 
      });

      if (!uploadResponse.ok) {
          let errorMsg = 'Failed to prepare recording session';
          try {
              const errorData = await uploadResponse.json();
              errorMsg = errorData.message || errorMsg;
          } catch(e) {}
          throw new Error(errorMsg);
      }

      const uploadData = await uploadResponse.json();
      activeUploadInfo.current = uploadData;
      createdRecordingId = uploadData.recordingId; // Keep track in case of later errors
      console.log("Upload URL received for recording ID:", createdRecordingId);

      // 3. Configure Audio Mode (If needed, might be redundant after web getUserMedia)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 4. Start Expo Audio Recording
      console.log('Starting Expo AV recording...');
      // Ensure any previous recording instance is unloaded
      if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          recordingRef.current = null;
      }
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
           if (status.isRecording && status.metering) {
             const normalizedLevel = Math.max(0, 1 + status.metering / 50);
             setAudioLevel(normalizedLevel);
          }
        },
        100
      );
      recordingRef.current = recording;

      // 5. Start UI Timer
      startTimeRef.current = new Date();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(updateTimer, 1000);

      setIsRecording(true);
      console.log('Recording started.');

    } catch (error: any) {
      console.error('Error starting recording:', error);
      setListError(error.message || 'Failed to start recording.');
      // If metadata record was created but something failed after, mark it as failed
      if (createdRecordingId) {
          await updateApiRecordingStatus(createdRecordingId, 'start_failed', error.message);
      }
      activeUploadInfo.current = null;
    } finally {
        setIsLoadingList(false);
    }
  };

  // Stop Recording Process
  const stopRecording = async () => {
    if (!recordingRef.current || !activeUploadInfo.current || isSaving) return;
    
    setIsRecording(false);
    setIsSaving(true); 
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setAudioLevel(0); 

    const { recordingId, uploadUrl } = activeUploadInfo.current;
    let recordingUri: string | null = null;
    let durationSeconds: number = 0;
    
    console.log(`Stopping recording ${recordingId}...`);

    try {
      // Stop recording and get URI/Status
      await recordingRef.current.stopAndUnloadAsync();
      recordingUri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      durationSeconds = Math.round((status.durationMillis || 0) / 1000);
      recordingRef.current = null;

      if (!recordingUri) {
        throw new Error('Recording URI is missing after stop.');
      }

      console.log(`Recording stopped. URI: ${recordingUri}, Duration: ${durationSeconds}s`);
      
      // Don't need a separate PUT call now
      /*
      // Update final duration in metadata *before* upload attempt
      // Note: This PUT endpoint doesn't exist yet, add it or combine with status update
      // await fetch(`${API_BASE_URL}/recordings/${recordingId}`, { 
      //    method: 'PUT', body: JSON.stringify({ duration: durationSeconds }) ... });
      */

      console.log(`Uploading to signed URL...`);
      
      // Fetch the recording file as a blob
      const fileResponse = await fetch(recordingUri);
      const blob = await fileResponse.blob();

      // Upload the blob to the signed URL
      const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
              'Content-Type': blob.type || 'audio/m4a', 
          },
          body: blob,
      });

      if (!uploadResponse.ok) {
          let errorDetail = `Upload failed: ${uploadResponse.status}`;
          try {
              const errorXml = await uploadResponse.text();
              console.error("Storage Upload Error Response:", errorXml);
              const messageMatch = errorXml.match(/<Message>(.*?)<\/Message>/);
              if (messageMatch && messageMatch[1]) {
                  errorDetail = messageMatch[1];
              }
          } catch (parseError) { /* Ignore parsing error */ }
          throw new Error(errorDetail);
      }

      console.log(`Upload successful for ${recordingId}. Updating status...`);
      // Update status to 'uploaded' AND include the final duration
      await updateApiRecordingStatus(recordingId, 'uploaded', undefined, durationSeconds); 

      setSnackbarMessage('Recording saved successfully!');

    } catch (error: any) {
      console.error('Error stopping or uploading recording:', error);
      setSnackbarMessage(`Error saving recording: ${error.message}`);
      // Update status to 'upload_failed' via backend
      // Optionally send duration here too, though maybe less critical on failure
      await updateApiRecordingStatus(recordingId, 'upload_failed', error.message, durationSeconds); 
    } finally {
      setIsSaving(false);
      activeUploadInfo.current = null; 
      setRecordingTime('00:00'); 
      // List refresh is handled by updateApiRecordingStatus
      setSnackbarVisible(true);
    }
  };

  // Cancel Recording
  const cancelRecording = async () => {
    if (isSaving) return; // Don't cancel if already saving
    
    setIsRecording(false);
    setAudioLevel(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecordingTime('00:00');

    // Stop and unload the Expo recording instance first
    if (recordingRef.current) {
      console.log('Cancelling Expo recording instance...');
      try {
      await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.error("Error stopping Expo recording on cancel:", error);
      }
      recordingRef.current = null;
    }

    // If we had started the backend process, mark the record as cancelled
    if (activeUploadInfo.current) {
      const cancelledId = activeUploadInfo.current.recordingId;
      console.log("Marking cancelled recording as cancelled in backend:", cancelledId);
      // Update status via API
      await updateApiRecordingStatus(cancelledId, 'cancelled'); 
    }
    
    activeUploadInfo.current = null; // Clear upload info
    setSnackbarMessage('Recording cancelled.');
    setSnackbarVisible(true);
  };
  
  // --- UI Rendering ---

  const renderRecordingItem: ListRenderItem<Recording> = useCallback(({ item }) => (
    <RecordingItem 
      recording={item}
      currentlyPlayingId={currentlyPlayingId}
      setCurrentlyPlayingId={setCurrentlyPlayingId}
      showDeleteConfirmDialog={showDeleteConfirmDialog} 
    />
  ), [currentlyPlayingId, showDeleteConfirmDialog]);

  const ListEmptyComponent = () => {
    console.log("ListEmptyComponent rendering with state:", { isLoadingList, listError, sessionExists: !!session }); 
    return (
      <View style={styles.emptyContainer}>
          {isLoadingList ? (
              <ActivityIndicator size="large" color={theme.colors.primary}/>
          ) : listError ? (
              <>
                <Text style={[styles.emptyText, {color: theme.colors.error}]}>Error: {listError}</Text>
                <Button onPress={fetchRecordings} mode="outlined">Retry</Button>
              </>
          ) : !session ? (
               <Text style={styles.emptyText}>Please log in to view recordings.</Text>
          ) : (
               <Text style={styles.emptyText}>No recordings yet. Press the mic to start!</Text>
          )}
      </View>
    );
  };

  // --- Execute Delete from Dialog --- 
  const executeDelete = useCallback(async () => {
    if (!recordingToDelete || !session?.access_token) {
      // console.log("[RecordScreen] Execute delete called without target or token.");
      hideConfirmDialog();
      return;
    }
    
    const { id: recordingId } = recordingToDelete;
    hideConfirmDialog(); 
    // console.log(`[RecordScreen] Confirmed delete via Dialog for ${recordingId}, proceeding...`);
    setIsDeleting(true); 
    
    try {
      // console.log(`[RecordScreen] Calling deleteRecording service for ${recordingId}...`);
      await deleteRecording(recordingId, session.access_token);
      // console.log(`[RecordScreen] Delete service call successful for ${recordingId}.`);
      setSnackbarMessage('Recording deleted successfully.');
      setSnackbarVisible(true);
      fetchRecordings(); 
    } catch (error: any) {
      console.error(`[RecordScreen] Error deleting recording ${recordingId}:`, error); // Keep error log
      setSnackbarMessage(error.message || "Failed to delete recording.");
      setSnackbarVisible(true);
    } finally {
      setIsDeleting(false); 
    }
  }, [recordingToDelete, session, fetchRecordings]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : theme.dark ? 'light' : 'dark'} />
      <AppHeader title="Recordings" />

      {/* Add Title Input Field Here */}
      {!isRecording && (
          <View style={styles.titleInputContainer}>
              <TextInput
                  label="Recording Title (Optional)"
                  value={recordingTitle}
                  onChangeText={setRecordingTitle}
                  mode="outlined"
                  style={styles.titleInput}
                  disabled={isRecording || isLoadingList || isSaving}
              />
          </View>
      )}

      <FlatList
        data={recordings}
        renderItem={renderRecordingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ListEmptyComponent}
        // Only show refresh control when not loading initially
        refreshing={isLoadingList && recordings.length > 0} 
        onRefresh={isDeleting ? undefined : fetchRecordings} 
        // Add extraData to ensure re-render when currentlyPlayingId changes
        extraData={currentlyPlayingId} 
        scrollEnabled={!isDeleting}
      />

      {/* Recording Control Area */}
      <View style={[styles.controlsContainer, { backgroundColor: theme.colors.background }]}>
        {isRecording && (
          <View style={styles.timerStatusContainer}>
            <Text style={[styles.timerText, { color: theme.colors.onSurface }]}>{recordingTime}</Text>
            <Text style={[styles.statusText, { color: theme.colors.onSurfaceVariant }]}>Recording...</Text>
        </View>
      )}

        <AudioWaveform isRecording={isRecording} audioLevel={audioLevel} />

      {isRecording ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.controlButton} onPress={cancelRecording} disabled={isSaving}>
              <MaterialCommunityIcons name="close" size={30} color={theme.colors.error} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.controlButton, {backgroundColor: theme.colors.error}] } 
              onPress={stopRecording}
              disabled={isSaving}
            >
                {isSaving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="stop" size={40} color="#fff" />}
            </TouchableOpacity>
            </View>
          ) : (
                <TouchableOpacity 
             style={[styles.recordButton, { backgroundColor: theme.colors.primary }]} 
                  onPress={startRecording}
             disabled={isLoadingList || isSaving || !session}
                >
            <MaterialCommunityIcons name="microphone" size={40} color="#fff" />
                </TouchableOpacity>
        )}
              </View>

      {/* --- Add Confirmation Dialog --- */}
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={hideConfirmDialog}>
          <Dialog.Icon icon="alert-circle-outline" color={theme.colors.error} size={36} />
          <Dialog.Title style={styles.dialogTitle}>Confirm Deletion</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to delete "{recordingToDelete?.title || 'this recording'}"?
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideConfirmDialog} disabled={isDeleting}>Cancel</Button>
            <Button onPress={executeDelete} textColor={theme.colors.error} disabled={isDeleting} loading={isDeleting}>
                Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {/* --- End Confirmation Dialog --- */}
      
      <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000} // 3 seconds
          style={{ bottom: 80 }} // Adjust position if needed
      >
          {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 48,
  },
  searchInput: {
    fontSize: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButtons: {
    backgroundColor: 'transparent',
  },
  filterButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  timerText: {
    fontSize: 48,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 32,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptionContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    marginTop: 0,
  },
  transcriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  summaryContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    marginTop: 0,
  },
  flex: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 180, // Ensure space for controls
  },
  itemOuterContainer: { // New outer container for touchable opacity
    marginBottom: 8,
    borderRadius: 8,
    // Add other styling like background if needed for highlighting
    overflow: 'hidden', // Clip modal if absolutely positioned somehow
  },
  itemContainer: { // Assuming this style exists
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    // backgroundColor will be set dynamically
  },
  itemContentContainer: { // Added this (or similar name might exist)
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemTextContainer: { // Assuming this style exists
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: { // Assuming this style exists
    marginBottom: 2,
  },
  itemDetail: { // Assuming this style exists
    opacity: 0.7,
  },
  playButton: { // Assuming this style exists
    marginRight: 12,
    padding: 4, // Add padding for easier touch
  },
  menuButton: { // Assuming this style exists
    padding: 8, // Increase touchable area
    marginLeft: 8,
  },
  modalContainer: { // Assuming this style exists for the modal
     padding: 20,
     margin: 20,
     borderRadius: 8,
  },
  modalTitle: { // Assuming this style exists
     marginBottom: 16,
     textAlign: 'center',
  },
  input: { // Assuming this style exists for modal input
     marginBottom: 16,
  },
  modalActions: { // Assuming this style exists
     flexDirection: 'row',
     justifyContent: 'flex-end',
     gap: 8, // Add gap between buttons
  },
  // Controls Styles
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent white
    paddingBottom: Platform.OS === 'ios' ? 25 : 15, // More padding for iOS bottom bar
    paddingTop: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  waveform: {
    height: 50,
    width: '100%',
    marginBottom: 10,
  },
  timerStatusContainer: {
      alignItems: 'center',
      marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
  },
  controlButton: {
    padding: 10,
  },
  // Empty List Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 50, // Add margin bottom
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubText: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  titleInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8, // Add some top padding
    paddingBottom: 8, // Add some bottom padding
  },
  titleInput: {
    // Add styling if needed
  },
  itemLoadingIndicator: {
    marginLeft: 12, 
    // Add other styling as needed
  },
  dialogTitle: {
    textAlign: 'center',
  },
  loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.1)', // Slight overlay
      zIndex: 10, // Ensure it's above the list
  },
}); 