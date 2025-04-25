import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, BackHandler } from 'react-native';
import { Text, useTheme, Card, Button, Portal, Modal, Avatar, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentInfo } from './DocumentCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import { useRouter, useNavigation } from 'expo-router';

interface DocumentDetailsProps {
  document: DocumentInfo;
  onBack: () => void;
}

export function DocumentDetails({ document, onBack }: DocumentDetailsProps) {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [showFullDocument, setShowFullDocument] = useState(false);

  // Handle hardware back button (Android) and gesture-based navigation
  useEffect(() => {
    const handleBack = () => {
      if (showFullDocument) {
        setShowFullDocument(false);
        return true;
      }
      onBack();
      return true;
    };

    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', handleBack);
    }

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      handleBack();
    });

    return () => {
      if (Platform.OS === 'android') {
        BackHandler.removeEventListener('hardwareBackPress', handleBack);
      }
      unsubscribe();
    };
  }, [navigation, onBack, showFullDocument]);

  // Mock AI summary - In a real app, this would come from actual document analysis
  const documentSummary = {
    summary: "This document appears to be a medical prescription with the following details:",
    keyPoints: [
      "Medication: Amoxicillin 500mg",
      "Dosage: 1 tablet three times daily",
      "Duration: 7 days",
      "Special Instructions: Take after meals",
      "Next Follow-up: In 2 weeks"
    ],
    warnings: [
      "Contains penicillin - check for allergies",
      "Complete the full course even if feeling better"
    ]
  };

  const handleTalkToAI = () => {
    router.push({
      pathname: "/chat",
      params: {
        context: 'document',
        documentId: document.id,
        documentTitle: document.title,
        returnTo: 'document'  // Add return path information
      }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <AppHeader 
        title={document.title} 
        leftIcon="arrow-left"
        onLeftPress={onBack}
        onBackPress={onBack}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* AI Summary Section */}
        <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.aiSummaryHeader}>
              <View style={styles.aiHeaderLeft}>
                <Avatar.Icon 
                  size={40} 
                  icon="robot" 
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <View style={styles.aiSummaryTitle}>
                  <Text variant="titleMedium">Document Analysis</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    AI-powered summary
                  </Text>
                </View>
              </View>
              <Button
                mode="contained-tonal"
                icon="message-processing"
                onPress={handleTalkToAI}
              >
                Talk to AI
              </Button>
            </View>

            <View style={styles.aiSummaryContent}>
              <Text variant="bodyMedium" style={styles.summaryText}>
                {documentSummary.summary}
              </Text>

              <View style={styles.summarySection}>
                <Text variant="titleSmall" style={styles.sectionLabel}>Key Information:</Text>
                {documentSummary.keyPoints.map((point, index) => (
                  <View key={index} style={styles.bulletPoint}>
                    <Text style={styles.bullet}>•</Text>
                    <Text variant="bodyMedium" style={styles.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>

              {documentSummary.warnings.length > 0 && (
                <View style={[styles.warningsSection, { backgroundColor: theme.colors.errorContainer }]}>
                  <Text variant="titleSmall" style={[styles.sectionLabel, { color: theme.colors.onErrorContainer }]}>
                    Important Warnings:
                  </Text>
                  {documentSummary.warnings.map((warning, index) => (
                    <View key={index} style={styles.bulletPoint}>
                      <MaterialCommunityIcons 
                        name="alert-circle" 
                        size={16} 
                        color={theme.colors.onErrorContainer}
                        style={styles.warningIcon}
                      />
                      <Text variant="bodyMedium" style={[styles.bulletText, { color: theme.colors.onErrorContainer }]}>
                        {warning}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Document Preview Section */}
        <View style={styles.previewSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Preview</Text>
          <Card style={styles.previewCard} onPress={() => setShowFullDocument(true)}>
            <Card.Content>
              {/* Mock PDF Preview - Replace with actual PDF preview component */}
              <View style={[styles.previewPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="file-pdf-box" size={48} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                  Tap to view full document
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            icon="download"
            onPress={() => {/* Handle download */}}
            style={styles.actionButton}
          >
            Download
          </Button>
          <Button
            mode="outlined"
            icon="share-variant"
            onPress={() => {/* Handle share */}}
            style={styles.actionButton}
          >
            Share
          </Button>
        </View>
      </ScrollView>

      {/* Full Document Modal */}
      <Portal>
        <Modal
          visible={showFullDocument}
          onDismiss={() => setShowFullDocument(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: theme.colors.background }
          ]}
        >
          <View style={styles.modalHeader}>
            <Button
              icon="close"
              onPress={() => setShowFullDocument(false)}
              mode="text"
            >
              Close
            </Button>
            <Text variant="titleMedium" numberOfLines={1} style={styles.modalTitle}>
              {document.title}
            </Text>
            <Button
              icon="download"
              onPress={() => {/* Handle download */}}
              mode="text"
            />
          </View>
          {/* Replace with actual PDF viewer component */}
          <View style={[styles.documentViewer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons name="file-pdf-box" size={64} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
              PDF Viewer will be implemented here
            </Text>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 24,
  },
  summaryCard: {
    elevation: 2,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiSummaryTitle: {
    marginLeft: 12,
  },
  aiSummaryContent: {
    gap: 16,
  },
  summaryText: {
    lineHeight: 20,
  },
  summarySection: {
    gap: 8,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  bullet: {
    marginRight: 8,
    fontSize: 16,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
  warningsSection: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  warningIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  previewSection: {
    gap: 12,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  previewCard: {
    elevation: 1,
  },
  previewPlaceholder: {
    height: 200,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    marginTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  documentViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 