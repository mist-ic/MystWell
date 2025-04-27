import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, ListRenderItem, ActivityIndicator, Alert, SectionList, ScrollView } from 'react-native';
import { Text, useTheme, TextInput, Button, Menu, Snackbar, Modal, Portal, Divider, Dialog, Searchbar, SegmentedButtons, Surface, Badge, IconButton, Chip } from 'react-native-paper';
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
const API_BASE_URL = 'https://mystwell.me';

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
  // Added for UI categorization
  category?: 'Appointment' | 'Reminder' | 'Other';
}

interface RecordingItemProps {
  recording: Recording;
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  showDeleteConfirmDialog: (id: string, title: string) => void;
  setSnackbarMessage: (message: string) => void;
  setSnackbarVisible: (visible: boolean) => void;
}

interface RecordingSection {
  title: string;
  data: Recording[];
}

// --- Utility Functions ---

// Format a date for display in recording items - updated for better readability
const formatItemDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
};

// Format a date for display in section headers - updated to show "Today"/"Yesterday"
const formatSectionDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch {
    return '';
  }
};

// Format duration for display
const formatDuration = (seconds: number): string => {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Group recordings by date
const groupRecordingsByDate = (recordings: Recording[]): RecordingSection[] => {
  // Sort recordings by date (newest first)
  const sortedRecordings = [...recordings].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // Group by date
  const groupedRecordings: { [key: string]: Recording[] } = {};
  
  sortedRecordings.forEach(recording => {
    try {
      const date = new Date(recording.created_at);
      const dateString = date.toDateString(); // Use date string as key
      
      if (!groupedRecordings[dateString]) {
        groupedRecordings[dateString] = [];
      }
      
      groupedRecordings[dateString].push(recording);
    } catch (error) {
      console.error('Error grouping recording by date:', error);
    }
  });
  
  // Convert to sections array
  return Object.entries(groupedRecordings).map(([dateString, recordings]) => ({
    title: formatSectionDate(dateString),
    data: recordings
  }));
};

// Categorize recordings (for demonstration purposes - replace with actual logic)
const categorizeRecording = (recording: Recording): Recording => {
  const title = recording.title?.toLowerCase() || '';
  const transcript = recording.transcription?.toLowerCase() || '';
  
  // Simple categorization logic based on title or transcript content
  // In a real app, this would use more sophisticated NLP or metadata
  if (title.includes('appointment') || title.includes('doctor') || transcript.includes('appointment')) {
    return { ...recording, category: 'Appointment' };
  } else if (title.includes('reminder') || transcript.includes('remind')) {
    return { ...recording, category: 'Reminder' };
  } else {
    return { ...recording, category: 'Other' };
  }
};

// Get status information for a recording - Update to use shorter display labels
const getRecordingStatus = (status: string): { color: string; icon: string; backgroundColor: string } => {
  switch (status) {
    case 'completed':
      return { 
        color: '#FFFFFF', 
        icon: 'check-circle', 
        backgroundColor: '#10B981' 
      };
    case 'processing':
    case 'transcribing_completed':
    case 'queued':
    case 'pending_upload':
    case 'uploaded':
      return { 
        color: '#FFFFFF', 
        icon: 'progress-clock', 
        backgroundColor: '#EAB308' // Changed to yellow
      };
    case 'failed':
    case 'transcription_failed':
    case 'analysis_failed':
    case 'download_failed':
      return { 
        color: '#FFFFFF', 
        icon: 'alert-circle', 
        backgroundColor: '#EF4444' 
      };
    default:
      return { 
        color: '#FFFFFF', 
        icon: 'clock-outline', 
        backgroundColor: '#6B7280' 
      };
  }
};

// --- Components ---

// Recording Item Component
const RecordingItem: React.FC<RecordingItemProps> = React.memo(({ 
    recording, 
    currentlyPlayingId, 
    setCurrentlyPlayingId,
    showDeleteConfirmDialog,
    setSnackbarMessage,
    setSnackbarVisible
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
  const [isReTranscribing, setIsReTranscribing] = useState(false);
  const menuRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const isPlaying = currentlyPlayingId === recording.id;
  const status = getRecordingStatus(recording.status);
  const category = recording.category || 'Other';

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
    // Navigate to detail screen
    router.push({
      pathname: `/recording/[id]`, 
      params: { id: recording.id }
    });
  }, [recording.id, router]);

  const handlePlayPause = useCallback(async () => {
    if (!session) {
      Alert.alert("Authentication Required", "Please log in to play recordings.");
      return;
    }

    if (isLoadingPlayback) return; // Prevent multiple clicks while loading

    // If this recording is already playing, stop it
    if (isPlaying) {
      // Cancel action
      setCurrentlyPlayingId(null);
      await unloadSound();
      return;
    }
    
    // Stop any other playing recording first
    setIsLoadingPlayback(true);
    setCurrentlyPlayingId(recording.id);

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
  }, [recording.id, session, isPlaying, currentlyPlayingId, setCurrentlyPlayingId, isLoadingPlayback, unloadSound]);

  // Delete Handler
  const handleDeleteRequest = useCallback(() => {
    setMenuVisible(false); 
    showDeleteConfirmDialog(recording.id, recording.title || 'this recording');
  }, [recording.id, recording.title, showDeleteConfirmDialog]);

  const openMenu = () => {
    if (menuRef.current) {
      menuRef.current.measureInWindow((x, y, width, height) => {
        setMenuPosition({ 
          x: x + width - 8, 
          y: y + height + 4 
        });
        setMenuVisible(true);
      });
    } else {
      setMenuVisible(true); // Fallback if ref not available
    }
  };
  
  const closeMenu = () => setMenuVisible(false);

  // Get the appropriate icon for the recording category
  const getCategoryIcon = () => {
    switch (category) {
      case 'Appointment':
        return 'calendar';
      case 'Reminder':
        return 'bell';
      default:
        return 'text-box-outline';
    }
  };

  // Get the appropriate background color for the icon container
  const getCategoryColor = () => {
    switch (category) {
      case 'Appointment':
        return '#EFF6FF';
      case 'Reminder':
        return '#FEF3C7';
      default:
        return '#F3F4F6';
    }
  };

  // Handle Re-transcribe function
  const handleReTranscribe = useCallback(async () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    
    setIsReTranscribing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/recordings/${recording.id}/retranscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to re-transcribe recording');
      }
      
      setSnackbarMessage('Re-transcription started. This may take a moment.');
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error re-transcribing:', error);
      setSnackbarMessage('Failed to re-transcribe recording.');
      setSnackbarVisible(true);
    } finally {
      setIsReTranscribing(false);
      closeMenu();
    }
  }, [recording.id, session, router, setSnackbarMessage, setSnackbarVisible, closeMenu]);

  // Extract just the time without date for display
  const timeOnly = formatItemDate(recording.created_at);
  const durationText = formatDuration(recording.duration || 0);
  
  return (
    <Surface 
      style={[styles.cardContainer, { backgroundColor: '#FFFFFF' }]} 
      elevation={1}
    >
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={handleRecordingPress}
        disabled={isUpdating}
        android_ripple={{ color: '#F3F4F6' }}
      >
        {/* Left Section (Icon and Play) */}
        <TouchableOpacity
          style={[styles.iconContainer, { backgroundColor: getCategoryColor() }]}
          onPress={handlePlayPause}
          disabled={isLoadingPlayback}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          {isLoadingPlayback ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <MaterialCommunityIcons 
                name={getCategoryIcon()} 
                size={16} 
                color="#4F46E5"
                style={styles.categoryIcon}
              />
              <MaterialCommunityIcons 
                name={isPlaying ? "pause" : "play"} 
                size={20} 
                color="#4F46E5"
                style={styles.playIcon}
              />
            </>
          )}
        </TouchableOpacity>
        
        {/* Middle Section (Text) */}
        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {recording.title || 'Untitled Recording'}
          </Text>
          <Text style={styles.metaText}>
            {timeOnly} • {durationText}
          </Text>
        </View>
        
        {/* Right Section (Status and Menu) */}
        <View style={styles.rightSection}>
          {isUpdating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
          ) : (
            <View style={[styles.statusIconContainer, { backgroundColor: status.backgroundColor }]}>
              <MaterialCommunityIcons 
                name={status.icon} 
                size={14} 
                color={status.color} 
              />
            </View>
          )}
          
          <View ref={menuRef}>
            <IconButton
              icon="dots-vertical"
              size={24}
              onPress={openMenu}
              iconColor="#6B7280"
              style={styles.menuButton}
            />
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Add Portal for Menu */}
      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={menuPosition}
          contentStyle={{ backgroundColor: 'white' }}
        >
          <Menu.Item 
            onPress={() => {
              closeMenu();
              setIsEditModalVisible(true);
            }} 
            title="Rename" 
            leadingIcon="pencil"
          />
          <Menu.Item 
            onPress={() => {
              closeMenu();
              handleReTranscribe();
            }} 
            title="Re-transcribe" 
            leadingIcon="refresh"
            disabled={isReTranscribing}
          />
          <Menu.Item 
            onPress={() => {
              closeMenu();
              handleDeleteRequest();
            }} 
            title="Delete" 
            leadingIcon="delete"
          />
        </Menu>
      </Portal>
      
      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={isEditModalVisible}
          onDismiss={() => setIsEditModalVisible(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Edit Recording Title</Text>
          <TextInput
            value={editedTitle}
            onChangeText={setEditedTitle}
            mode="outlined"
            style={styles.input}
            disabled={isUpdating}
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setIsEditModalVisible(false)} disabled={isUpdating}>Cancel</Button>
            <Button onPress={handleSaveTitle} mode="contained" loading={isUpdating} disabled={isUpdating}>Save</Button>
          </View>
        </Modal>
      </Portal>
    </Surface>
  );
});

// Section Header Component for Date Grouping
const SectionHeader: React.FC<{ title: string }> = ({ title }) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

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

  // --- Dialog State ---
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{id: string; title: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showDeleteConfirmDialog = useCallback((id: string, title: string) => {
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
      // Process recordings data - add categories for UI
      const processedRecordings = data.map(recording => 
        categorizeRecording({ ...recording, isPlaying: false })
      );
      setRecordings(processedRecordings);
      console.log("Recordings fetched:", processedRecordings.length);
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
      const titleToSend = searchQuery.trim() || recordingTitle.trim() || `Recording - ${new Date().toLocaleString()}`;

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
      // Clear the search query after successful recording
      setSearchQuery('');
      setRecordingTitle('');

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

  // Execute Delete from Dialog
  const executeDelete = useCallback(async () => {
    if (!recordingToDelete || !session?.access_token) {
      hideConfirmDialog();
      return;
    }
    
    const { id: recordingId } = recordingToDelete;
    hideConfirmDialog(); 
    setIsDeleting(true); 
    
    try {
      await deleteRecording(recordingId, session.access_token);
      setSnackbarMessage('Recording deleted successfully.');
      setSnackbarVisible(true);
      fetchRecordings(); 
    } catch (error: any) {
      console.error(`Error deleting recording ${recordingId}:`, error);
      setSnackbarMessage(error.message || "Failed to delete recording.");
      setSnackbarVisible(true);
    } finally {
      setIsDeleting(false); 
    }
  }, [recordingToDelete, session, fetchRecordings]);

  // Filter recordings based on search and active tab
  const filteredRecordings = useMemo(() => {
    // First filter by search query
    let filtered = recordings;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(recording => 
        recording.title?.toLowerCase().includes(query) || 
        recording.transcription?.toLowerCase().includes(query)
      );
    }
    
    // Then filter by active tab
    if (activeTab !== 'all') {
      const category = activeTab === 'appointments' 
        ? 'Appointment' 
        : activeTab === 'reminders' 
        ? 'Reminder' 
        : 'Other';
      
      filtered = filtered.filter(recording => recording.category === category);
    }
    
    return filtered;
  }, [recordings, searchQuery, activeTab]);

  // Group recordings by date for section list
  const groupedRecordings = useMemo(() => {
    return groupRecordingsByDate(filteredRecordings);
  }, [filteredRecordings]);

  // Count records by category for tab badges
  const counts = useMemo(() => {
    const all = recordings.length;
    const appointments = recordings.filter(r => r.category === 'Appointment').length;
    const reminders = recordings.filter(r => r.category === 'Reminder').length;
    const others = recordings.filter(r => r.category === 'Other').length;
    
    return { all, appointments, reminders, others };
  }, [recordings]);

  // Empty state for specific category
  const CategoryEmptyComponent = () => {
    let message = '';
    let icon = 'text-box-outline';
    
    switch (activeTab) {
      case 'appointments':
        message = 'No appointments yet';
        icon = 'calendar';
        break;
      case 'reminders':
        message = 'No reminders yet';
        icon = 'bell';
        break;
      case 'others':
        message = 'No other recordings yet';
        icon = 'text-box-outline';
        break;
      default:
        message = 'No recordings yet';
        icon = 'microphone-outline';
    }
    
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name={icon} size={48} color="#6B7280" />
        <Text style={styles.emptyText}>{message}</Text>
        <Text style={styles.emptySubText}>Tap the mic button to create one</Text>
      </View>
    );
  };

  // Combined empty state component
  const ListEmptyComponent = () => {
    return (
      <View style={styles.emptyContainer}>
        {isLoadingList ? (
          <ActivityIndicator size="large" color="#4F46E5"/>
        ) : listError ? (
          <>
            <Text style={styles.emptyText}>Error: {listError}</Text>
            <Button mode="outlined" onPress={fetchRecordings} style={{ marginTop: 12 }}>Retry</Button>
          </>
        ) : !session ? (
          <Text style={styles.emptyText}>Please log in to view recordings.</Text>
        ) : searchQuery.trim() ? (
          <>
            <MaterialCommunityIcons name="magnify-close" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubText}>Try different search terms</Text>
          </>
        ) : (
          <CategoryEmptyComponent />
        )}
      </View>
    );
  };

  // State for search input focus
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      
      <View style={styles.contentWrapper}>
        {/* Header & Search */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Recordings</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              placeholder="Search or add a title..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              style={styles.searchInput}
              outlineStyle={{ borderRadius: 8 }}
              disabled={isRecording}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              right={
                searchQuery ? 
                <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : 
                undefined
              }
            />
            <IconButton
              icon="tune"
              size={24}
              style={styles.filterButton}
              onPress={() => {}}
            />
          </View>
          
          {/* Segment Control / Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.tabScrollContainer}
          >
            <View style={styles.tabContainer}>
              <SegmentedButtons
                value={activeTab}
                onValueChange={setActiveTab}
                buttons={[
                  { value: 'all', label: `All (${counts.all})` },
                  { value: 'appointments', label: `Appointments (${counts.appointments})` },
                  { value: 'reminders', label: `Reminders (${counts.reminders})` },
                  { value: 'others', label: `Others (${counts.others})` }
                ]}
                style={styles.segmentButtons}
              />
            </View>
          </ScrollView>
        </View>
        
        {/* Recordings List */}
        <SectionList
          sections={groupedRecordings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecordingItem
              recording={item}
              currentlyPlayingId={currentlyPlayingId}
              setCurrentlyPlayingId={setCurrentlyPlayingId}
              showDeleteConfirmDialog={showDeleteConfirmDialog}
              setSnackbarMessage={setSnackbarMessage}
              setSnackbarVisible={setSnackbarVisible}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <SectionHeader title={title} />
          )}
          contentContainerStyle={styles.listContentContainer}
          ListEmptyComponent={ListEmptyComponent}
          refreshing={isLoadingList && recordings.length > 0}
          onRefresh={isDeleting ? undefined : fetchRecordings}
          stickySectionHeadersEnabled={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
        
        {/* Recording UI */}
        {isRecording && (
          <Surface style={styles.recordingOverlay} elevation={4}>
            <View style={styles.timerStatusContainer}>
              <Text style={styles.timerText}>{recordingTime}</Text>
              <Text style={styles.statusText}>Recording...</Text>
              <AudioWaveform isRecording={isRecording} audioLevel={audioLevel} />
            </View>
            <View style={styles.recordingButtonContainer}>
              <TouchableOpacity 
                style={[styles.cancelButton, { borderColor: theme.colors.error }]} 
                onPress={cancelRecording} 
                disabled={isSaving}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.error} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stopButton, { backgroundColor: theme.colors.error }]}
                onPress={stopRecording}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="stop" size={32} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </Surface>
        )}
        
        {/* Floating Action Button */}
        {!isRecording && (
          <TouchableOpacity
            style={styles.fabButton}
            onPress={startRecording}
            disabled={isLoadingList || isSaving || !session}
          >
            <MaterialCommunityIcons name="microphone" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={hideConfirmDialog}>
          <Dialog.Icon icon="alert-circle-outline" color="#EF4444" size={36} />
          <Dialog.Title style={styles.dialogTitle}>Confirm Deletion</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Are you sure you want to delete "{recordingToDelete?.title || 'this recording'}"?
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideConfirmDialog} disabled={isDeleting}>Cancel</Button>
            <Button 
              onPress={executeDelete} 
              textColor="#EF4444" 
              disabled={isDeleting} 
              loading={isDeleting}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
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
    backgroundColor: '#F9FAFB',
  },
  contentWrapper: {
    flex: 1,
    maxWidth: 768,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 44, // Increased height
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#374151',
  },
  filterButton: {
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabScrollContainer: {
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  segmentButtons: {
    height: 36,
    minWidth: 600, // Force horizontal scrolling
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 0,
    marginBottom: 0,
    zIndex: 1,
    elevation: 1,
  },
  sectionHeaderText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardContainer: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    flexWrap: 'nowrap',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  categoryIcon: {
    position: 'absolute',
    opacity: 0.7,
  },
  playIcon: {
    position: 'absolute',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    marginLeft: 8,
  },
  statusIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  menuButton: {
    margin: 0,
    padding: 8,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listContentContainer: {
    paddingBottom: 80,
    minHeight: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  recordingOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  timerStatusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 48,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#111827',
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  recordingButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  cancelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
  },
  input: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogText: {
    color: '#4B5563',
    lineHeight: 20,
  },
  snackbar: {
    bottom: 16,
  },
}); 