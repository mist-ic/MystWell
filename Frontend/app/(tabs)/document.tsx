import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, useTheme, Portal, Dialog, Button, Menu, IconButton, TextInput as PaperTextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentCard, DocumentInfo } from '@/components/DocumentCard';
import { DocumentDetails } from '@/components/DocumentDetails';
import { StyledSearchBar } from '@/components/ui/StyledSearchBar';
import { TextInput } from 'react-native';

// --- Constants based on Spec ---
const PAGE_PADDING_HORIZONTAL = 24;
const PAGE_PADDING_VERTICAL = 32;
const CONTENT_MAX_WIDTH = 1200; // May not be strictly necessary in RN
const BASE_GRID = 8;

export default function DocumentScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<DocumentInfo | null>(null);

  // Mock data (Keep using existing data structure for now)
  const [documents, setDocuments] = useState<DocumentInfo[]>([
    { id: '1', title: 'Cover Letter', type: 'PDF', size: '1.232 MB', isPinned: true, icon: 'file-document' },
    { id: '2', title: 'Company Portfolio Template', type: 'PDF', size: '1.232 MB', isPinned: true, icon: 'file-presentation-box' },
    { id: '3', title: 'Curriculum Vitae', type: 'PDF', size: '1.232 MB', icon: 'file-account' },
    { id: '4', title: 'References', type: 'PDF', size: '1.232 MB', icon: 'file-certificate' },
    { id: '5', title: 'Letter of Recommendation', type: 'PDF', size: '1.232 MB', icon: 'file-document-edit' },
    { id: '6', title: 'Certificate', type: 'PDF', size: '1.232 MB', icon: 'certificate' }
  ]);
  const [isLoading, setIsLoading] = useState(false); // Add loading state example

  const handlePin = useCallback((id: string) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === id ? { ...doc, isPinned: !doc.isPinned } : doc
    ));
  }, []);

  const handleMorePress = useCallback((document: DocumentInfo, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX - 150, y: pageY + 10 });
    setSelectedDocument(document);
    setMenuVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (selectedDocument) {
      setDocuments(prev => prev.filter(doc => doc.id !== selectedDocument.id));
      setSelectedDocument(null);
    }
    setDeleteDialogVisible(false);
    setMenuVisible(false);
  }, [selectedDocument]);

  const handleDocumentPress = useCallback((document: DocumentInfo) => {
    setSelectedDocumentForView(document);
  }, []);

  const openRenameDialog = () => {
    if (selectedDocument) {
      setNewDocumentName(selectedDocument.title);
      setRenameDialogVisible(true);
      setMenuVisible(false);
    }
  };

  const closeRenameDialog = () => {
    setRenameDialogVisible(false);
    setSelectedDocument(null);
    setNewDocumentName('');
  };

  const handleRenameSave = () => {
    if (selectedDocument && newDocumentName.trim()) {
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === selectedDocument.id ? { ...doc, title: newDocumentName.trim() } : doc
        )
      );
      closeRenameDialog();
    }
  };

  // Filtering logic remains the same
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinnedDocuments = filteredDocuments.filter(doc => doc.isPinned);
  const unpinnedDocuments = filteredDocuments.filter(doc => !doc.isPinned);

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
       {/* Placeholder for illustration */}
       <MaterialCommunityIcons name="file-question-outline" size={100} color={theme.colors.onSurfaceVariant} style={{marginBottom: BASE_GRID * 2}}/>
       <Text style={styles.emptyText}>No documents found</Text>
     </View>
  );


  // --- Main Render ---
  if (selectedDocumentForView) {
    return (
      <DocumentDetails
        document={selectedDocumentForView}
        onBack={() => setSelectedDocumentForView(null)}
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
            size={20} // Icon size
            style={styles.createButton} // Button size/styling
            onPress={() => console.log('New Document')} // Replace with actual action
            accessibilityLabel="Create document"
        />
      </View>

      {/* 3. Search bar - Use new component */}
      <StyledSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search documents"
        containerStyle={styles.searchContainerMargin} // Apply margins here
        accessibilityLabel="Search documents input"
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled" // Dismiss keyboard on scroll tap
      >
        {isLoading ? (
          renderSkeleton()
        ) : filteredDocuments.length === 0 && searchQuery ? (
           renderEmptySearch()
        ) : (
          <>
            {/* 4. Section headings & 5/6/7. Document lists */}
            {pinnedDocuments.length > 0 && (
              <View style={styles.sectionContainerPinned}>
                <Text style={styles.sectionHeading}>
                  Pinned
                </Text>
                <View style={styles.cardList}>
                  {pinnedDocuments.map(document => (
                    <DocumentCard
                      key={document.id}
                      document={document}
                      isPinned // Pass isPinned prop
                      onPin={handlePin}
                      onPress={handleDocumentPress}
                      onMorePress={(event) => handleMorePress(document, event)}
                    />
                  ))}
                </View>
              </View>
            )}

            {unpinnedDocuments.length > 0 && (
              <View style={[styles.sectionContainerAll, pinnedDocuments.length > 0 && styles.sectionGap]}>
                 <Text style={styles.sectionHeading}>
                  All Documents
                </Text>
                 <View style={styles.cardList}>
                    {unpinnedDocuments.map(document => (
                      <DocumentCard
                        key={document.id}
                        document={document}
                        onPin={handlePin}
                        onPress={handleDocumentPress}
                        onMorePress={(event) => handleMorePress(document, event)}
                      />
                    ))}
                </View>
              </View>
            )}
          </>
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
           />
           <Menu.Item
             leadingIcon="share-variant"
             onPress={() => {/* TODO: Implement */ setMenuVisible(false);}}
             title="Share"
           />
           <Menu.Item
             leadingIcon="download"
             onPress={() => {/* TODO: Implement */ setMenuVisible(false);}}
             title="Download"
           />
           <Menu.Item
             leadingIcon="trash-can-outline"
             onPress={() => {
               setMenuVisible(false);
               setDeleteDialogVisible(true);
             }}
             title="Delete"
             titleStyle={{ color: theme.colors.error }}
           />
         </Menu>

         <Dialog
            visible={deleteDialogVisible}
            onDismiss={() => setDeleteDialogVisible(false)}
            style={{ 
              borderRadius: BASE_GRID, 
              backgroundColor: theme.colors.surface
            }}
          >
            <Dialog.Title>Delete Document</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                 Are you sure you want to delete "{selectedDocument?.title}"? This action cannot be undone.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
              <Button textColor={theme.colors.error} onPress={handleDeleteConfirm}>Delete</Button>
            </Dialog.Actions>
         </Dialog>

          <Dialog
             visible={renameDialogVisible}
             onDismiss={closeRenameDialog}
             style={{ 
               borderRadius: BASE_GRID, 
               backgroundColor: theme.colors.surface
             }}
           >
             <Dialog.Title>Rename Document</Dialog.Title>
             <Dialog.Content>
               <PaperTextInput
                 label="New name"
                 value={newDocumentName}
                 onChangeText={setNewDocumentName}
                 mode="outlined"
                 autoFocus
                 selectAllOnFocus
               />
             </Dialog.Content>
             <Dialog.Actions>
               <Button onPress={closeRenameDialog}>Cancel</Button>
               <Button 
                 onPress={handleRenameSave} 
                 disabled={!newDocumentName.trim() || newDocumentName.trim() === selectedDocument?.title}
               >
                 Save
               </Button>
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
    marginLeft: 'auto', // Point 1: Push button to the right
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
     fontWeight: '400',
     color: '#6B7280', // Muted text
     marginTop: BASE_GRID * 2, // 16px
  },
}); 