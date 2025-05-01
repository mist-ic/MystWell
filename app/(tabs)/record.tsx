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
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/hooks/useUserProfile';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- Configuration ---
// TODO: Move this to a config file or environment variable
// const API_BASE_URL = 'http://172.31.231.222:3000'; // Use the provided IP and default port
const API_BASE_URL = 'REDACTED_API_URL'; // Hardcoded production URL

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

// Simple UUID generation
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
      // Update local state through the callbacks passed in props
      setSnackbarMessage(`Renamed recording to "${editedTitle}"`);
      setSnackbarVisible(true);
      // Close modal after success
      setIsEditModalVisible(false);
    } catch (error: any) {
      console.error("Error updating title:", error);
      Alert.alert("Error", error.message || "Failed to update recording name.");
    } finally {
      setIsUpdating(false);
    }
  }, [recording.id, recording.title, editedTitle, session, setSnackbarMessage, setSnackbarVisible]);

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
      const response = await fetch(`${API_BASE_URL}/recordings/${recording.id}/retry-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
                name={status.icon as keyof typeof MaterialCommunityIcons.glyphMap} 
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
  const router = useRouter();
  const { session } = useAuth(); // Keep using session for auth checks
  const { profile, loading: profileLoading, error: profileError } = useUserProfile(); // Get profile info

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Recording UI State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Recording Logic State/Refs
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<Audio.RecordingStatus | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  // Store upload info needed by stopRecording
  const activeUploadInfo = useRef<{ recordingId: string; storagePath: string; uploadUrl: string } | null>(null);
  
  // List State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // Re-add state for delete operation
  
  // Delete Confirmation State
  const [isConfirmDialogVisible, setIsConfirmDialogVisible] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{ id: string; title: string } | null>(null);

  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Refs
  const recordingUpdateChannel = useRef<RealtimeChannel | null>(null);

  // --- Handlers ---
  const showConfirmDialog = (id: string, title: string) => {
    setRecordingToDelete({ id, title });
    setIsConfirmDialogVisible(true);
  };

  const hideConfirmDialog = () => {
    setIsConfirmDialogVisible(false);
    setRecordingToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (recordingToDelete && session) {
      setIsDeleting(true); // Set deleting state
      try {
        await deleteRecording(recordingToDelete.id, session.access_token);
        setRecordings(prev => prev.filter(rec => rec.id !== recordingToDelete.id));
        setSnackbarMessage(`Deleted "${recordingToDelete.title}"`);
        setSnackbarVisible(true);
      } catch (err: any) {
        console.error("Error deleting recording:", err);
        setError(err.message || 'Failed to delete recording');
      } finally {
        setIsDeleting(false); // Unset deleting state
        hideConfirmDialog();
      }
    } else {
      setError('Authentication required to delete.');
      hideConfirmDialog();
    }
  };

  const onSnackbarDismiss = () => setSnackbarVisible(false);
  const updateTimer = useCallback(() => {
    if (!startTimeRef.current) return;
    const now = new Date();
    const diff = now.getTime() - startTimeRef.current.getTime();
    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setRecordingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }, []);

  // --- Data Fetching and Updates ---
  const fetchRecordings = useCallback(async () => {
    console.log("Fetching recordings...");
    if (!session) {
      setError("Authentication required.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/recordings`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch recordings: ${response.statusText}`);
      }
      const data: Recording[] = await response.json();
      console.log(`Recordings fetched: ${data.length}`);
      setRecordings(data.map(categorizeRecording)); // Apply categorization
    } catch (err: any) {
      console.error("Error fetching recordings:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchRecordings();
    }
  }, [session, fetchRecordings]);

  useEffect(() => {
    // Ensure we have a profile ID before subscribing
    if (!profile?.id || !supabase) {
      if (!profileLoading && profileError) {
        console.error("[Realtime] Cannot subscribe: Profile error or not loaded", profileError);
        // Optionally show an error to the user about profile loading failure
      } else if (!profile?.id && !profileLoading) {
        console.warn("[Realtime] Cannot subscribe: Profile not loaded yet.");
      }
      return;
    }

    console.log(`[Realtime] Setting up subscription for profile: ${profile.id}`);

    // --- Define the handler for receiving updates ---
    const handleRecordingUpdate = (payload: any) => {
        console.log('[Realtime] Received update:', payload);
        const updatedRecording = payload.new as Recording;

        if (!updatedRecording || !updatedRecording.id) {
            console.warn('[Realtime] Received invalid update payload:', payload);
            return;
        }

        setRecordings(currentRecordings => {
            const index = currentRecordings.findIndex(r => r.id === updatedRecording.id);
            if (index !== -1) {
                console.log(`[Realtime] Updating recording ${updatedRecording.id} in state.`);
                // Update existing recording - Merge to preserve non-DB fields
                const updatedList = [...currentRecordings];
                updatedList[index] = { 
                    ...currentRecordings[index], // Keep existing frontend state like isPlaying
                    ...categorizeRecording(updatedRecording) // Apply categorization to new data
                };
                return updatedList;
            } else {
                // If the recording isn't in the list (e.g., created after initial fetch),
                // Prepend it (or you could trigger a refetch)
                console.log(`[Realtime] Adding new recording ${updatedRecording.id} to state.`);
                return [categorizeRecording(updatedRecording), ...currentRecordings];
            }
        });
    };

    // --- Create and manage the subscription channel ---
    const channelKey = `recordings:profile_id=eq.${profile.id}`;
    recordingUpdateChannel.current = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'recordings',
          filter: `profile_id=eq.${profile.id}` 
        },
        handleRecordingUpdate
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Successfully subscribed to ${channelKey}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Realtime] Subscription error on ${channelKey}:`, status, err);
          setError(`Realtime connection issue: ${status}. Please refresh.`);
        } else if (status === 'CLOSED') {
            console.log(`[Realtime] Subscription closed for ${channelKey}`);
        }
      });

    // --- Cleanup function --- 
    return () => {
      if (recordingUpdateChannel.current) {
        console.log(`[Realtime] Unsubscribing from ${channelKey}`);
        supabase.removeChannel(recordingUpdateChannel.current)
          .then(() => {
            console.log(`[Realtime] Successfully removed channel ${channelKey}`);
            recordingUpdateChannel.current = null;
          })
          .catch(error => {
            console.error(`[Realtime] Error removing channel ${channelKey}:`, error);
          });
      } else {
          console.log("[Realtime] No active channel to remove on cleanup.");
      }
    };

  }, [profile?.id, profileLoading, profileError, supabase]); // Re-run if profile changes

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
  const startRecording = async () => {
    if (!session) {
      setError("Authentication required.");
      return;
    }
    if (isRecording || isLoading || isUploading) return;

    setIsLoading(true);
    setError(null);
    activeUploadInfo.current = null; // Reset active upload info
    
    try {
      // 1. Check Permissions
      console.log('Requesting audio recording permissions...');
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      
      if (audioStatus !== 'granted') {
        setError('Audio recording permission is required.');
        return;
      }
      
      console.log('Audio permissions granted.');

      // 2. Get upload URL from backend
      console.log('Requesting upload URL...');
      try {
        const response = await fetch(`${API_BASE_URL}/recordings/upload-url`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get upload URL: ${response.status} ${response.statusText}`);
        }
        
        const { uploadUrl, storagePath, recordingId } = await response.json();
        console.log('Got upload URL for recordingId:', recordingId);
        
        // Store the info for upload after recording
        activeUploadInfo.current = {
          recordingId,
          uploadUrl,
          storagePath
        };
      } catch (error: any) {
        console.error('Error getting upload URL:', error);
        throw new Error(`Failed to get upload URL: ${error.message}`);
      }
      
      // Define recording options for all platforms to avoid the error
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        }
      };

      // Set audio mode for iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        recordingOptions,
        (status) => {
          // Update audio level for visualization (optional)
          if (status.isRecording) {
            setAudioLevel(status.metering ?? 0); // Use metering if available
            setRecordingStatus(status);
          }
        },
        100 // Update interval in ms
      );
      setRecordingInstance(recording); // Set the new instance

      // 5. Start UI Timer
      startTimeRef.current = new Date();
      timerRef.current = setInterval(updateTimer, 1000);
      setIsRecording(true);
      console.log('Recording started.');

    } catch (error: any) {
      console.error('Error starting recording:', error);
      setError(error.message || 'Failed to start recording.');
      if (activeUploadInfo.current?.recordingId) { // Use stored ID if available
          await updateApiRecordingStatus(activeUploadInfo.current.recordingId, 'failed', `Start failed: ${error.message}`);
      }
      activeUploadInfo.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    // Use the info stored in the ref
    if (!recordingInstance || !activeUploadInfo.current || isUploading) return;
    
    const { recordingId, uploadUrl, storagePath } = activeUploadInfo.current;
    console.log(`Stopping recording ${recordingId}...`);

    setIsRecording(false);
    setIsUploading(true); 
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startTimeRef.current = null;
    setAudioLevel(0);

    let recordingUri: string | null = null;
    let durationSeconds: number = 0;

    try {
      // Stop recording and get URI/Status
      await recordingInstance.stopAndUnloadAsync();
      recordingUri = recordingInstance.getURI();
      const status = await recordingInstance.getStatusAsync();
      durationSeconds = Math.round((status.durationMillis || 0) / 1000);
      setRecordingInstance(null); 

      if (!recordingUri) {
        throw new Error('Failed to get recording URI after stopping.');
      }
      console.log(`Recording stopped. URI: ${recordingUri}, Duration: ${durationSeconds}s`);

      // Fetch the blob from the URI
      const blobResponse = await fetch(recordingUri);
      const blob = await blobResponse.blob();

      // Upload the blob to the signed URL (use the stored URL)
      console.log('Uploading to signed URL...');
      setUploadProgress(0);
      
      // Determine the correct content type based on platform
      const contentType = Platform.select({
        android: 'audio/wav',
        ios: 'audio/wav',
        web: blob.type || 'audio/webm',
        default: 'audio/wav',
      });
      
      console.log(`Using content type: ${contentType} for upload`);
      
      const uploadResponseS3 = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });

      if (!uploadResponseS3.ok) {
        const errorText = await uploadResponseS3.text();
        throw new Error(`Upload failed: ${uploadResponseS3.status} ${uploadResponseS3.statusText} - ${errorText}`);
      }
      console.log(`Upload successful for ${recordingId}. Updating status...`);
      setUploadProgress(100);

      // Update backend status to 'uploaded'
      await updateApiRecordingStatus(recordingId, 'uploaded', undefined, durationSeconds);

    } catch (error: any) {
      console.error(`Error stopping/uploading recording ${recordingId}:`, error);
      setError(error.message || 'Failed to stop or upload recording.');
      await updateApiRecordingStatus(recordingId, 'failed', `Stop/Upload failed: ${error.message}`, durationSeconds);
    } finally {
      setIsUploading(false);
      activeUploadInfo.current = null; // Clear the ref
      setRecordingTime('00:00');
      setRecordingInstance(null);
      setUploadProgress(0);
    }
  };

  const cancelRecording = async () => {
    if (isUploading) return;
    const recordingIdToCancel = activeUploadInfo.current?.recordingId;
    console.log(`Cancelling recording process ${recordingIdToCancel ? `for ${recordingIdToCancel}`: ''}...`);

    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startTimeRef.current = null;
    setRecordingTime('00:00');
    setAudioLevel(0);

    // Stop and unload the Expo recording instance first
    if (recordingInstance) {
      console.log('Cancelling Expo recording instance...');
      try {
        await recordingInstance.stopAndUnloadAsync();
      } catch (error) {
        console.error("Error stopping Expo recording on cancel:", error);
      }
      setRecordingInstance(null);
    }

    // If we had started the backend process (got an ID), mark the record as cancelled
    if (recordingIdToCancel) {
      console.log("Marking cancelled recording as cancelled in backend:", recordingIdToCancel);
      // Update status via API
      await updateApiRecordingStatus(recordingIdToCancel, 'cancelled'); 
    }
    
    activeUploadInfo.current = null; // Clear the ref
    setSnackbarMessage('Recording cancelled.');
    setSnackbarVisible(true);
  };

  // --- UI Filtering and Rendering ---
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
    if (activeFilter !== 'all') {
      const category = activeFilter === 'appointments' 
        ? 'Appointment' 
        : activeFilter === 'reminders' 
        ? 'Reminder' 
        : 'Other';
      
      filtered = filtered.filter(recording => recording.category === category);
    }
    
    return filtered;
  }, [recordings, searchQuery, activeFilter]);

  const groupedAndFilteredRecordings = useMemo(() => {
    return groupRecordingsByDate(filteredRecordings);
  }, [filteredRecordings]);

  // --- Empty List Components ---
  const CategoryEmptyComponent = () => {
    let message = '';
    let icon: keyof typeof MaterialCommunityIcons.glyphMap = 'text-box-outline'; 
    
    switch (activeFilter) {
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

  const ListEmptyComponent = () => {
    return (
      <View style={styles.emptyContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#4F46E5"/>
        ) : error ? (
          <>
            <Text style={styles.emptyText}>Error: {error}</Text>
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

  // --- Render Functions ---
  const renderRecordingItem: ListRenderItem<Recording> = useCallback(({ item }) => (
    <RecordingItem
      recording={item}
      currentlyPlayingId={currentlyPlayingId}
      setCurrentlyPlayingId={setCurrentlyPlayingId}
      showDeleteConfirmDialog={showConfirmDialog}
      setSnackbarMessage={setSnackbarMessage}
      setSnackbarVisible={setSnackbarVisible}
    />
  ), [currentlyPlayingId, showConfirmDialog, setSnackbarMessage, setSnackbarVisible]);

  const renderSectionHeader = ({ section: { title } }: { section: RecordingSection }) => (
    <SectionHeader title={title} />
  );

  // --- Main Render ---
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
                value={activeFilter}
                onValueChange={setActiveFilter}
                buttons={[
                  { value: 'all', label: `All (${recordings.length})` },
                  { value: 'appointments', label: `Appointments (${recordings.filter(r => r.category === 'Appointment').length})` },
                  { value: 'reminders', label: `Reminders (${recordings.filter(r => r.category === 'Reminder').length})` },
                  { value: 'others', label: `Others (${recordings.filter(r => r.category === 'Other').length})` }
                ]}
                style={styles.segmentButtons}
              />
            </View>
          </ScrollView>
        </View>
        
        {/* Recordings List */}
        <SectionList
          sections={groupedAndFilteredRecordings}
          keyExtractor={(item) => item.id}
          renderItem={renderRecordingItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContentContainer}
          ListEmptyComponent={ListEmptyComponent}
          refreshing={isLoading && recordings.length > 0}
          onRefresh={fetchRecordings}
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
                disabled={isUploading}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.error} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stopButton, { backgroundColor: theme.colors.error }]}
                onPress={stopRecording}
                disabled={isUploading}
              >
                {isUploading ? (
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
            disabled={isLoading || isUploading || !session}
          >
            <MaterialCommunityIcons name="microphone" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={isConfirmDialogVisible} onDismiss={hideConfirmDialog}>
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
              onPress={handleDeleteConfirm} 
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
        onDismiss={onSnackbarDismiss}
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
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
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
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    pointerEvents: 'auto'
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