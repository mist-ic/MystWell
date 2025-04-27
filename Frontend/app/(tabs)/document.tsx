import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, useTheme, Portal, Dialog, Button, Menu, IconButton, TextInput as PaperTextInput, Modal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentCard } from '@/components/DocumentCard';
import { DocumentDetails } from '@/components/DocumentDetails';
import { StyledSearchBar } from '@/components/ui/StyledSearchBar';
import { TextInput } from 'react-native';
// @ts-ignore - Suppress incorrect type definition error for default import
import scanDocument from 'react-native-document-scanner-plugin';
import { useAuth } from '@/context/auth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { checkShouldShowDocumentModal } from '@/context/DocumentModalContext';

// Define API Base URL (TODO: Move to central config/env)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mystwell.me';

// --- Constants based on Spec ---
const PAGE_PADDING_HORIZONTAL = 24;
const PAGE_PADDING_VERTICAL = 32;
const CONTENT_MAX_WIDTH = 1200; // May not be strictly necessary in RN
const BASE_GRID = 8;

// Define type based on backend schema
export interface DocumentInfo {
  id: string;
  profile_id: string;
  storage_path: string;
  display_name: string | null;
  status: 'pending_upload' | 'uploaded' | 'queued' | 'processing' | 'processed' | 'processing_failed' | 'processing_retried';
  detected_document_type: string | null;
  structured_data: any | null; // Or a more specific type if known
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // --- UI specific additions (optional) ---
  // isPinned?: boolean;
  // icon?: string; // Derive icon from detected_document_type?
}

export default function DocumentScreen() {
  const theme = useTheme();
  // Extract currentProfileId from the session and user data
  const { session, user } = useAuth();
  const profile = user ? { id: user.id } : null; // Create profile object from user
  const profileLoading = false; // Since we're using user directly
  const profileError = null; // Since we're using user directly
  const currentProfileId = user?.id || '';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocumentMenu, setSelectedDocumentMenu] = useState<DocumentInfo | null>(null);
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<DocumentInfo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [addDocumentModalVisible, setAddDocumentModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null); // Added error state

  // --- Data Fetching --- 
  const fetchDocuments = useCallback(async (checkPolling = false): Promise<DocumentInfo[] | null> => {
    if (!session || !currentProfileId) return null;
    if (!checkPolling) setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/documents`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setDocuments(currentDocs => {
          if (JSON.stringify(currentDocs) !== JSON.stringify(data)) {
              return data as DocumentInfo[];
          }
          return currentDocs;
      });
      return data as DocumentInfo[];
    } catch (error) {
      if (!checkPolling) {
          console.error("Error fetching documents:", error);
          Alert.alert("Error", "Could not fetch documents.");
          setDocuments([]);
      } else {
          console.warn("Polling fetch failed:", error);
      }
      return null;
    } finally {
      if (!checkPolling) setIsLoading(false);
    }
  }, [session, currentProfileId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Check if we should open the add document modal (triggered from another screen)
  useEffect(() => {
    const shouldShowModal = checkShouldShowDocumentModal();
    if (shouldShowModal) {
      setAddDocumentModalVisible(true);
    }
  }, []);

  // --- Polling for status updates (Revised Logic) ---
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Function to start polling if needed
    const startPolling = async () => {
      console.log('Polling started for document status updates...');
      pollingIntervalRef.current = setInterval(async () => {
        console.log('Polling: fetching documents...');
        const fetchedData = await fetchDocuments(true);

        if (fetchedData) {
          // Check if any documents in the fetched data are still processing
          const stillProcessing = fetchedData.some(doc => 
            ['queued', 'processing', 'processing_retried'].includes(doc.status)
          );

          if (!stillProcessing) {
            console.log('Polling: No more documents processing, stopping poll.');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          } else {
            console.log('Polling: Documents still processing, poll continues.');
          }
        } else {
          // Handle fetch error during polling - maybe stop polling?
          console.warn('Polling: Fetch failed, stopping poll for now.');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
        }
      }, 10000); // Poll every 10 seconds
    };

    // Check current documents state to decide IF polling should START
    const needsPolling = documents.some(doc => 
        ['queued', 'processing', 'processing_retried'].includes(doc.status)
    );

    // If needs polling AND not already polling, start it
    if (needsPolling && !pollingIntervalRef.current) {
        startPolling();
    }
    // If no longer needs polling based on current state AND is polling, stop it 
    // (This handles cases where status updated outside polling, e.g. after retry)
    else if (!needsPolling && pollingIntervalRef.current) {
        console.log('Polling: Stopping poll based on current state (no processing docs).');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
    }

    // Cleanup function: stop polling when component unmounts or session changes
    return () => {
      if (pollingIntervalRef.current) {
        console.log('Clearing polling interval on cleanup.');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [session, documents, fetchDocuments]);

  // Setup realtime subscription for document status updates
  useEffect(() => {
    // Ensure we have a profile ID and supabase instance before subscribing
    if (!profile?.id || !supabase) {
      if (!profileLoading && profileError) {
        console.error("[Realtime] Cannot subscribe to documents: Profile error or not loaded", profileError);
      } else if (!profile?.id && !profileLoading) {
        console.warn("[Realtime] Cannot subscribe to documents: Profile not loaded yet.");
      }
      return;
    }

    // Local polling function for fallback
    const startLocalPolling = () => {
      console.log('Starting polling fallback for documents...');
      // Start a new interval only if one isn't already running
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          console.log('Polling: Checking for document updates...');
          fetchDocuments();
        }, 5000); // Check every 5 seconds
      }
    };

    console.log(`[Realtime] Setting up document subscription for profile: ${profile.id}`);

    // Define the handler for receiving document updates
    const handleDocumentUpdate = (payload: any) => {
      console.log('[Realtime] Received document update:', payload);
      const updatedDocument = payload.new as DocumentInfo;

      if (!updatedDocument || !updatedDocument.id) {
        console.warn('[Realtime] Received invalid document update payload:', payload);
        return;
      }

      setDocuments(currentDocuments => {
        const index = currentDocuments.findIndex(doc => doc.id === updatedDocument.id);
        if (index !== -1) {
          console.log(`[Realtime] Updating document ${updatedDocument.id} in state.`);
          // Update existing document
          const updatedList = [...currentDocuments];
          updatedList[index] = {
            ...currentDocuments[index],
            ...updatedDocument
          };
          return updatedList;
        } else {
          // If the document isn't in the list (e.g., created after initial fetch)
          console.log(`[Realtime] Adding new document ${updatedDocument.id} to state.`);
          return [updatedDocument, ...currentDocuments];
        }
      });
    };

    // Create and manage the subscription channel
    const channelKey = `documents:profile_id=eq.${profile.id}`;
    const documentUpdateChannel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `profile_id=eq.${profile.id}`
        },
        handleDocumentUpdate
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Successfully subscribed to ${channelKey}`);
          
          // If subscription is working, we can stop polling
          if (pollingIntervalRef.current) {
            console.log('Realtime subscription active, stopping polling.');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Realtime] Subscription error on ${channelKey}:`, status, err);
          setError(`Realtime connection issue: ${status}. Falling back to polling.`);
          
          // If subscription fails, start polling as fallback
          if (!pollingIntervalRef.current) {
            console.log('Realtime subscription failed, starting polling as fallback.');
            startLocalPolling();
          }
        } else if (status === 'CLOSED') {
          console.log(`[Realtime] Subscription closed for ${channelKey}`);
        }
      });

    // Cleanup function
    return () => {
      console.log(`[Realtime] Cleaning up document subscription for ${channelKey}`);
      supabase.removeChannel(documentUpdateChannel)
        .then(() => {
          console.log(`[Realtime] Successfully removed document channel ${channelKey}`);
        })
        .catch(error => {
          console.error(`[Realtime] Error removing document channel ${channelKey}:`, error);
        });
    };
  }, [profile?.id, profileLoading, profileError, supabase, fetchDocuments]);

  // TODO: Implement real-time subscription for status updates (Alternative to polling)
  // Similar to Recording feature

  // --- Placeholder actions (will be implemented) ---
  const handlePin = useCallback((id: string) => {
    console.log("Pin action TBD", id);
    // setDocuments(prev => prev.map(doc =>
    //   doc.id === id ? { ...doc, isPinned: !doc.isPinned } : doc
    // ));
  }, []);

  const handleMorePress = useCallback((document: DocumentInfo, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX - 150, y: pageY + 10 });
    setSelectedDocumentMenu(document);
    setMenuVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (selectedDocumentMenu && session) {
      const originalDocuments = documents;
      setDocuments(prev => prev.filter(doc => doc.id !== selectedDocumentMenu.id));
    setDeleteDialogVisible(false);
    setMenuVisible(false);
      try {
        const response = await fetch(`${API_BASE_URL}/documents/${selectedDocumentMenu.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        });
        if (!response.ok) {
            let errorMsg = 'Failed to delete document';
            try { errorMsg = (await response.json()).message || errorMsg; } catch(e){} 
            throw new Error(errorMsg);
        }
        setSelectedDocumentMenu(null);
      } catch (error: any) {
        console.error("Error deleting document:", error);
        Alert.alert("Error", error.message || "Could not delete document.");
        setDocuments(originalDocuments); 
      }
    }
  }, [selectedDocumentMenu, documents, session]);

  const handleDocumentPress = useCallback((document: DocumentInfo) => {
    // Only allow viewing processed documents for now
    if (document.status === 'processed') {
    setSelectedDocumentForView(document);
    } else {
       Alert.alert("Processing", `Document is currently ${document.status}. Please wait.`);
    }
  }, []);

  const openRenameDialog = () => {
    if (selectedDocumentMenu) {
      setNewDocumentName(selectedDocumentMenu.display_name || ''); // Use display_name
      setRenameDialogVisible(true);
      setMenuVisible(false);
    }
  };

  const closeRenameDialog = () => {
    setRenameDialogVisible(false);
    setSelectedDocumentMenu(null);
    setNewDocumentName('');
  };

  const handleRenameSave = async () => {
    if (selectedDocumentMenu && newDocumentName.trim() && session) {
      const newName = newDocumentName.trim();
      const originalDocuments = documents;
      const originalName = selectedDocumentMenu.display_name;
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === selectedDocumentMenu.id ? { ...doc, display_name: newName } : doc
        )
      );
      closeRenameDialog();

      try {
         const response = await fetch(`${API_BASE_URL}/documents/${selectedDocumentMenu.id}/rename`, {
           method: 'PUT',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${session.access_token}`,
           },
           body: JSON.stringify({ displayName: newName }),
         });
         if (!response.ok) {
             let errorMsg = 'Failed to rename document';
             try { errorMsg = (await response.json()).message || errorMsg; } catch(e){} 
             throw new Error(errorMsg);
         }
      } catch (error: any) {
         console.error("Error renaming document:", error);
         Alert.alert("Error", error.message || "Could not rename document.");
         setDocuments(prevDocs => 
            prevDocs.map(doc => 
              doc.id === selectedDocumentMenu.id ? { ...doc, display_name: originalName } : doc
            )
          );
      }
    }
  };
  
  const handleRetryProcessing = useCallback(async () => {
    if (!selectedDocumentMenu || selectedDocumentMenu.status !== 'processing_failed' || !session) {
        return;
    }
    const docIdToRetry = selectedDocumentMenu.id;
    setMenuVisible(false); // Close menu immediately

    // Optimistically update status locally?
    // setDocuments(prev => 
    //     prev.map(doc => doc.id === docIdToRetry ? { ...doc, status: 'queued' } : doc)
    // );
    // Maybe better to wait for polling to update status after successful retry call

    try {
        console.log(`Requesting retry for document ${docIdToRetry}`);
        const response = await fetch(`${API_BASE_URL}/documents/${docIdToRetry}/retry-processing`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            let errorMsg = 'Failed to retry processing';
            try { errorMsg = (await response.json()).message || errorMsg; } catch(e){} 
            throw new Error(errorMsg);
        }

        Alert.alert("Retry Initiated", "Document has been queued for processing again.");
        // Trigger a manual refresh or rely on polling
        fetchDocuments(); 

    } catch (error: any) {
        console.error("Error retrying processing:", error);
        Alert.alert("Retry Failed", error.message || "Could not retry document processing.");
        // Revert optimistic update if implemented
    } finally {
        setSelectedDocumentMenu(null); // Clear selection after action
    }
  }, [selectedDocumentMenu, session, fetchDocuments]);

  // --- Upload Helper ---
  const uploadFile = async (filePath: string, uploadUrl: string): Promise<boolean> => {
      // Use fetch API for upload
      const response = await fetch(filePath);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          // Supabase signed URL upload often requires specific content-type
          // If the server doesn't require it, this might be optional
          // For images, blob.type should be correct (e.g., 'image/jpeg')
          'Content-Type': blob.type, 
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        console.error("Upload failed:", uploadResponse.status, await uploadResponse.text());
        throw new Error('Failed to upload image to storage.');
      }
      
      console.log("File uploaded successfully to:", uploadUrl);
      return true;
  };

  // --- Scan Document Logic ---
  const handleScanDocument = async () => {
     if (isScanning || isUploading) return; 

     let documentId: string | null = null; 
     let storagePath: string | null = null; // Also declare storagePath outside

     setIsScanning(true);
     try {
        // Note: The type definition for scanDocument might be inaccurate in the plugin's types
        // We might need to cast the result or use // @ts-ignore if linter complains here
        // @ts-ignore - Type definition issue with react-native-document-scanner-plugin
        const result: { scannedImages?: string[] } = await scanDocument({
            croppedImageQuality: 100, 
            responseType: 'imageFilePath', 
            maxNumDocuments: 1 
        });

        if (result.scannedImages && result.scannedImages.length > 0) {
            const filePath = result.scannedImages[0];
            console.log('Scanned image path:', filePath);

            setIsScanning(false);
            setIsUploading(true);

            try {
                 if (!session || !currentProfileId) {
                    throw new Error("User not authenticated");
                 }

                // Create a descriptive name for the scanned document with date
                const now = new Date();
                const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                const scanTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                const displayName = `Scanned Document ${formattedDate} ${scanTime}`;

                console.log("Requesting upload URL...");
                const uploadReqResponse = await fetch(`${API_BASE_URL}/documents/upload-request`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (!uploadReqResponse.ok) { throw new Error('Failed to get upload details'); }
                const uploadData = await uploadReqResponse.json();
                documentId = uploadData.documentId;
                storagePath = uploadData.storagePath;
                const { uploadUrl } = uploadData;
                console.log(`Received upload URL for document ${documentId}`);

                if (!documentId || !storagePath) { throw new Error('Invalid upload details received.'); }

                const optimisticDoc: DocumentInfo = {
                    id: documentId,
                    profile_id: currentProfileId,
                    storage_path: storagePath, 
                    display_name: displayName,
                    status: 'pending_upload',
                    detected_document_type: null,
                    structured_data: null,
                    error_message: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                setDocuments(prev => [optimisticDoc, ...prev]);

                await uploadFile(filePath, uploadUrl);

                console.log(`Notifying backend of upload completion for ${documentId}`);
                const completeResponse = await fetch(`${API_BASE_URL}/documents/upload-complete`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ 
                    documentId, 
                    storagePath,
                    displayName 
                  }),
                });
                if (!completeResponse.ok) { throw new Error('Failed to notify backend of upload completion'); }

                setDocuments(prev => 
                    prev.map(doc => doc.id === documentId ? { ...doc, status: 'uploaded' } : doc)
                );
                Alert.alert("Success", "Document uploaded and queued for processing.");

            } catch (uploadError: any) { 
                console.error("Upload process failed:", uploadError);
                Alert.alert("Upload Failed", uploadError?.message || "Could not upload the document.");
                if (documentId) {
                   setDocuments(prev => prev.filter(doc => doc.id !== documentId));
                }
            } finally {
                setIsUploading(false);
            }
            
        } else {
            console.log('Scan cancelled or no images returned.');
        }
     } catch (error: any) { 
         console.error("Scan failed:", error);
         Alert.alert("Scan Failed", error?.message || "Could not scan the document. Please check permissions or try again.");
     } finally {
         setIsScanning(false); 
     }
  };

  // --- Placeholder for Upload Document --- 
  const handleUploadDocument = async () => {
    if (isUploading || isScanning) return;

    let documentId: string | null = null;
    let storagePath: string | null = null;

    try {
      setIsUploading(true);
      
      // Use DocumentPicker to select a file
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log('Document picking cancelled');
        return;
      }
      
      const fileUri = result.assets[0].uri;
      const fileName = result.assets[0].name || 'Untitled Document';
      
      console.log('Selected document:', fileUri);
      
      if (!session || !currentProfileId) {
        throw new Error("User not authenticated");
      }

      console.log("Requesting upload URL...");
      const uploadReqResponse = await fetch(`${API_BASE_URL}/documents/upload-request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!uploadReqResponse.ok) { 
        throw new Error('Failed to get upload details'); 
      }
      
      const uploadData = await uploadReqResponse.json();
      documentId = uploadData.documentId;
      storagePath = uploadData.storagePath;
      const { uploadUrl } = uploadData;
      
      console.log(`Received upload URL for document ${documentId}`);

      if (!documentId || !storagePath) { 
        throw new Error('Invalid upload details received.'); 
      }

      // Create an optimistic document entry
      const optimisticDoc: DocumentInfo = {
        id: documentId,
        profile_id: currentProfileId,
        storage_path: storagePath,
        display_name: fileName,
        status: 'pending_upload',
        detected_document_type: null,
        structured_data: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setDocuments(prev => [optimisticDoc, ...prev]);

      // Upload the file
      await uploadFile(fileUri, uploadUrl);

      console.log(`Notifying backend of upload completion for ${documentId}`);
      const completeResponse = await fetch(`${API_BASE_URL}/documents/upload-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          documentId, 
          storagePath,
          displayName: fileName
        }),
      });
      
      if (!completeResponse.ok) { 
        throw new Error('Failed to notify backend of upload completion'); 
      }

      // Update document status
      setDocuments(prev => 
        prev.map(doc => doc.id === documentId ? { ...doc, status: 'uploaded' } : doc)
      );
      
      Alert.alert("Success", "Document uploaded and queued for processing.");
    } catch (error: any) {
      console.error("Upload process failed:", error);
      Alert.alert("Upload Failed", error?.message || "Could not upload the document.");
      
      if (documentId) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      }
    } finally {
      setIsUploading(false);
      setAddDocumentModalVisible(false);
    }
  };

  // --- Filtering logic (Update to use display_name) ---
  const filteredDocuments = documents.filter(doc =>
    (doc.display_name || 'Untitled Document').toLowerCase().includes(searchQuery.toLowerCase())
  );
  // Remove pinning logic for now unless re-implemented with backend data
  // const pinnedDocuments = filteredDocuments.filter(doc => doc.isPinned);
  // const unpinnedDocuments = filteredDocuments.filter(doc => !doc.isPinned);

  // --- Render Loading Skeleton ---
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={styles.skeletonCard} />
      ))}
    </View>
  );

  // --- Render Empty State ---
  const renderEmptySearch = () => (
     <View style={styles.emptyContainer}>
       <MaterialCommunityIcons name="file-search-outline" size={100} color={theme.colors.onSurfaceVariant} style={{marginBottom: BASE_GRID * 2}}/>
       <Text style={styles.emptyText}>No documents match your search</Text>
     </View>
  );

   const renderEmptyState = () => (
     <View style={styles.emptyContainer}>
       <MaterialCommunityIcons name="file-multiple-outline" size={100} color={theme.colors.onSurfaceVariant} style={{marginBottom: BASE_GRID * 2}}/>
       <Text style={styles.emptyText}>No documents yet</Text>
       <Text style={styles.emptySubText}>Add your first document to get started.</Text>
       <Button 
         mode="contained" 
         onPress={() => setAddDocumentModalVisible(true)}
         style={styles.emptyStateButton}
         icon="plus"
         contentStyle={{paddingHorizontal: BASE_GRID * 2, paddingVertical: BASE_GRID}}
       >
         Add Document
       </Button>
     </View>
  );


  // --- Main Render ---
  if (selectedDocumentForView) {
    return (
      <DocumentDetails
        document={selectedDocumentForView}
        onBack={() => {
            console.log('[DocumentScreen] Closing DocumentDetails view.');
            setSelectedDocumentForView(null);
        }}
        onRefresh={fetchDocuments}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.pageContainer, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* 2. Header row */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>
          Documents
        </Text>
        <IconButton
            icon="plus"
            iconColor={theme.colors.onPrimary}
            containerColor={theme.colors.primary}
            size={20}
            style={styles.createButton}
            onPress={() => setAddDocumentModalVisible(true)} // Open modal instead of menu
            disabled={isScanning || isUploading}
            accessibilityLabel="Add new document"
        />
      </View>

      {/* 3. Search bar - Use new component */}
      <StyledSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search documents"
        containerStyle={styles.searchContainerMargin}
        accessibilityLabel="Search documents input"
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          renderSkeleton()
        ) : documents.length === 0 && !searchQuery ? (
          renderEmptyState()
        ) : filteredDocuments.length === 0 && searchQuery ? (
           renderEmptySearch()
        ) : (
                <View style={styles.cardList}>
              {filteredDocuments.map(document => (
                    <DocumentCard
                      key={document.id}
                      document={document}
                  onPress={() => handleDocumentPress(document)}
                        onMorePress={(event) => handleMorePress(document, event)}
                      />
                    ))}
                </View>
        )}
      </ScrollView>

      {/* Portals for Menu/Dialog remain similar, styling might need tweaks */}
      <Portal>
         <Menu
           visible={menuVisible}
           onDismiss={() => setMenuVisible(false)}
           anchor={menuPosition}
           contentStyle={{ 
             borderRadius: BASE_GRID, 
             backgroundColor: theme.colors.surface
           }}
         >
           <Menu.Item
             leadingIcon="pencil"
             onPress={openRenameDialog}
             title="Rename"
             disabled={!selectedDocumentMenu || selectedDocumentMenu.status === 'pending_upload'}
           />
           {selectedDocumentMenu?.status === 'processing_failed' && (
           <Menu.Item
                leadingIcon="reload"
                onPress={handleRetryProcessing}
                title="Retry Processing"
           />
           )}
           <Menu.Item
             leadingIcon="trash-can-outline"
             onPress={() => {
               setMenuVisible(false);
               setDeleteDialogVisible(true);
             }}
             title="Delete"
             titleStyle={{ color: theme.colors.error }}
             disabled={!selectedDocumentMenu}
           />
         </Menu>

         <Modal
            visible={addDocumentModalVisible}
            onDismiss={() => setAddDocumentModalVisible(false)}
            contentContainerStyle={{
                margin: 20,
                borderRadius: BASE_GRID * 2,
                padding: 20,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
            }}
         >
            <Text variant="titleLarge" style={{marginBottom: 24, textAlign: 'center'}}>Add Document</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-around', width: '100%'}}>
                <Button 
                    mode="outlined"
                    icon="camera-outline"
                    onPress={() => {
                        handleScanDocument();
                        setAddDocumentModalVisible(false);
                    }}
                    style={{margin: 8, flexGrow: 1}}
                    contentStyle={{paddingVertical: 8}}
                    disabled={isScanning || isUploading}
                >
                    Scan Document
                </Button>
                
                <Button 
                    mode="outlined"
                    icon="upload-outline"
                    onPress={() => {
                        handleUploadDocument();
                        setAddDocumentModalVisible(false);
                    }}
                    style={{margin: 8, flexGrow: 1}}
                    contentStyle={{paddingVertical: 8}}
                    disabled={isScanning || isUploading}
                >
                    Upload Document
                </Button>
            </View>
            
            <Button 
                onPress={() => setAddDocumentModalVisible(false)}
                style={{marginTop: 16}}
            >
                Cancel
            </Button>
         </Modal>

         <Dialog
            visible={deleteDialogVisible}
            onDismiss={() => setDeleteDialogVisible(false)}
            style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: BASE_GRID * 2 }}
          >
           <Dialog.Icon icon="alert-circle-outline" color={theme.colors.error} size={30}/>
           <Dialog.Title style={styles.dialogTitle}>Delete Document?</Dialog.Title>
            <Dialog.Content>
             <Text variant="bodyMedium" style={{color: theme.colors.onSurfaceVariant}}>
                Are you sure you want to delete "{selectedDocumentMenu?.display_name || 'this document'}"? This action cannot be undone.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
             <Button onPress={() => setDeleteDialogVisible(false)} labelStyle={{color: theme.colors.primary}}>Cancel</Button>
             <Button onPress={handleDeleteConfirm} labelStyle={{color: theme.colors.error}}>Delete</Button>
            </Dialog.Actions>
         </Dialog>

          <Dialog
             visible={renameDialogVisible}
             onDismiss={closeRenameDialog}
            style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: BASE_GRID * 2 }}
           >
            <Dialog.Title style={styles.dialogTitle}>Rename Document</Dialog.Title>
             <Dialog.Content>
               <PaperTextInput
                  label="New Name"
                 value={newDocumentName}
                 onChangeText={setNewDocumentName}
                 mode="outlined"
                  style={{backgroundColor: theme.colors.surface}}
                 autoFocus
               />
             </Dialog.Content>
             <Dialog.Actions>
              <Button onPress={closeRenameDialog} labelStyle={{color: theme.colors.primary}}>Cancel</Button>
              <Button onPress={handleRenameSave} disabled={!newDocumentName.trim()} labelStyle={{color: theme.colors.primary}}>Save</Button>
             </Dialog.Actions>
           </Dialog>

      </Portal>
    </SafeAreaView>
  );
}

// --- Styles based on Spec ---
const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL, // 24px
    paddingTop: 0, // Remove initial top padding, handled by header container
    paddingBottom: 0, // Let SafeArea handle bottom
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BASE_GRID * 2, // 16px gap (applied between title and button if needed)
    paddingTop: PAGE_PADDING_VERTICAL, // 32px
    paddingBottom: 0, // Reduce bottom padding
    paddingHorizontal: 0, // Use page padding
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold', // Ensure font is applied
    fontSize: 32, 
    lineHeight: 40, 
    fontWeight: '600',
    color: '#111827', 
    margin: 0, // Point 1: Ensure no extra margin
  },
  createButton: {
    width: 40, // Size 40x40
    height: 40,
    borderRadius: 20, // Make it a circle
    margin: 0, // Remove default margins if any
    marginLeft: 'auto', // Add back marginLeft
  },
  searchContainerMargin: { 
     marginTop: BASE_GRID * 2, // Point 8: Header to search: 16px (Now handled by this margin)
     marginBottom: BASE_GRID * 3, // Point 8: Search to 'Pinned' heading: 24px
     // Max width and alignSelf handled inside component
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: PAGE_PADDING_VERTICAL, // Ensure space at the bottom
  },
  sectionContainerPinned: {
     // No top margin, comes after search bar margin
  },
  sectionContainerAll: {
     // Default top margin unless preceded by pinned section
     marginTop: BASE_GRID * 4, // 32px default top margin
  },
  sectionGap: {
      marginTop: BASE_GRID * 4, // Point 8: Section gap 32px (Applies to 'All Docs' when 'Pinned' exists)
  },
  sectionHeading: {
    fontFamily: 'Inter-Medium', // Ensure font
    fontSize: 20, 
    lineHeight: 28, 
    fontWeight: '500',
    color: '#374151', 
    marginBottom: BASE_GRID * 1.5, // 12px bottom margin
  },
  cardList: {
     gap: BASE_GRID * 1.5, // 12px vertical gap between cards
  },
  skeletonContainer: {
    gap: BASE_GRID * 1.5, // 12px gap
    marginTop: BASE_GRID * 1.5, // 12px margin below heading (if heading were shown)
  },
  skeletonCard: {
    height: 64,
    backgroundColor: '#F3F4F6', // Light grey base
    borderRadius: BASE_GRID, // 8px
  },
  emptyContainer: {
     flex: 1, // Take remaining space
     alignItems: 'center',
     justifyContent: 'center', // Center content
     marginTop: BASE_GRID * 3, // 24px
     paddingBottom: BASE_GRID * 8, // Add padding to push content up a bit
  },
  emptyText: {
     fontSize: 18,
     fontWeight: '600',
     color: '#6B7280', // Muted text
     marginTop: BASE_GRID * 2, // 16px
  },
  emptySubText: {
      fontSize: 14,
      color: 'gray', // Example color
      marginTop: BASE_GRID,
      marginBottom: BASE_GRID * 3,
      textAlign: 'center',
  },
  emptyStateButton: {
      marginTop: BASE_GRID * 2,
      borderRadius: BASE_GRID,
  },
  dialogTitle: {
     textAlign: 'center',
  },
}); 