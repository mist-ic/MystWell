import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Searchbar, Menu, Portal, Dialog, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';
import { DocumentCard, DocumentInfo } from '@/components/DocumentCard';
import { DocumentDetails } from '@/components/DocumentDetails';

export default function DocumentScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<DocumentInfo | null>(null);

  // Mock data
  const [documents, setDocuments] = useState<DocumentInfo[]>([
    {
      id: '1',
      title: 'Cover Letter',
      type: 'PDF',
      size: '1.232 MB',
      isPinned: true,
      icon: 'file-document'
    },
    {
      id: '2',
      title: 'Company Portfolio Template',
      type: 'PDF',
      size: '1.232 MB',
      isPinned: true,
      icon: 'file-presentation-box'
    },
    {
      id: '3',
      title: 'Curriculum Vitae',
      type: 'PDF',
      size: '1.232 MB',
      icon: 'file-account'
    },
    {
      id: '4',
      title: 'References',
      type: 'PDF',
      size: '1.232 MB',
      icon: 'file-certificate'
    },
    {
      id: '5',
      title: 'Letter of Recommendation',
      type: 'PDF',
      size: '1.232 MB',
      icon: 'file-document-edit'
    },
    {
      id: '6',
      title: 'Certificate',
      type: 'PDF',
      size: '1.232 MB',
      icon: 'certificate'
    }
  ]);

  const handlePin = useCallback((id: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, isPinned: !doc.isPinned } : doc
    ));
  }, []);

  const handleMorePress = useCallback((document: DocumentInfo, event: any) => {
    // Get the position of the pressed button and offset it slightly to show below
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ 
      x: pageX - 150, // Offset to the left to center the menu
      y: pageY + 10   // Offset down slightly to show below the button
    });
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

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedDocuments = filteredDocuments.filter(doc => doc.isPinned);
  const unpinnedDocuments = filteredDocuments.filter(doc => !doc.isPinned);

  if (selectedDocumentForView) {
    return (
      <DocumentDetails
        document={selectedDocumentForView}
        onBack={() => setSelectedDocumentForView(null)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <StatusBar style="dark" />
      <AppHeader title="Documents" rightIcon="plus" />

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search documents"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {pinnedDocuments.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Pinned</Text>
            {pinnedDocuments.map(document => (
              <DocumentCard
                key={document.id}
                document={document}
                onPin={handlePin}
                onPress={handleDocumentPress}
                onMorePress={(event) => handleMorePress(document, event)}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>All Documents</Text>
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
      </ScrollView>

      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={menuPosition}
        >
          <Menu.Item
            leadingIcon="pencil"
            onPress={() => {
              setMenuVisible(false);
              // Handle edit
            }}
            title="Rename"
          />
          <Menu.Item
            leadingIcon="share-variant"
            onPress={() => {
              setMenuVisible(false);
              // Handle share
            }}
            title="Share"
          />
          <Menu.Item
            leadingIcon="download"
            onPress={() => {
              setMenuVisible(false);
              // Handle download
            }}
            title="Download"
          />
          <Menu.Item
            leadingIcon="trash-can-outline"
            onPress={() => {
              setDeleteDialogVisible(true);
            }}
            title="Delete"
            titleStyle={{ color: theme.colors.error }}
          />
        </Menu>

        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
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
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingTop: 8,
  },
  searchBar: {
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    paddingHorizontal: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
}); 