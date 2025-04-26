import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, BackHandler, TouchableOpacity, Animated, Pressable } from 'react-native';
import { Text, useTheme, Card, Button, Portal, Modal, Avatar, IconButton, ActivityIndicator, MD3Theme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentInfo } from './DocumentCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import { useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface DocumentDetailsProps {
  document: DocumentInfo;
  onBack: () => void;
}

const BASE_GRID = 8;
const PAGE_PADDING_HORIZONTAL = 16;
const PAGE_PADDING_BOTTOM = 16;

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

export function DocumentDetails({ document, onBack }: DocumentDetailsProps) {
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const navigation = useNavigation();
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const styles = React.useMemo(() => createStyles(theme), [theme]);

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

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

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
        returnTo: 'document'
      }
    });
  };

  const handlePreviewPress = () => {
    triggerHaptic();
    setShowFullDocument(true);
  };

  const handleBackPress = () => {
    triggerHaptic();
    if (onBack) onBack();
  };

  return (
    <SafeAreaView style={[styles.pageContainer, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
        <AppHeader 
          title={document.title} 
          leftIcon="arrow-left"
          onLeftPress={handleBackPress}
          onBackPress={handleBackPress}
          accessibilityLabelLeft="Go back to document list"
        />
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContentContainer}
      >
        <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
          {isLoading ? (
            <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
          ) : (
            <Pressable 
              style={({ pressed }) => [
                styles.summaryCardContent,
                pressed && styles.pressedCard
              ]}
              onPress={triggerHaptic}
            >
              <View style={styles.aiSummaryHeader}>
                <View style={styles.aiHeaderLeft}>
                  <MaterialCommunityIcons 
                    name="robot" 
                    size={24} 
                    color={theme.colors.primary}
                    style={styles.aiIcon}
                  />
                  <View style={styles.aiSummaryTitle}>
                    <Text style={styles.aiTitleText}>Document Analysis</Text>
                    <Text style={styles.aiSubtitleText}>
                      AI-powered summary
                    </Text>
                  </View>
                </View>
                <Button
                  mode="outlined"
                  icon={({ size, color }) => (
                    <MaterialCommunityIcons 
                      name="message-processing" 
                      size={16}
                      color={color}
                      style={styles.buttonIcon}
                    />
                  )}
                  onPress={handleTalkToAI}
                  style={[styles.talkAiButton, { borderColor: theme.colors.primary }]}
                  labelStyle={[styles.talkAiButtonLabel, { color: theme.colors.primary }]}
                  contentStyle={styles.talkAiButtonContent}
                >
                  Talk to AI
                </Button>
              </View>

              <View style={styles.aiSummaryContent}>
                <Text style={styles.summaryBodyText}>
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
                  <View style={styles.warningsSection}>
                    <Text style={styles.warningHeading}>
                      Important Warnings:
                    </Text>
                    {documentSummary.warnings.map((warning, index) => (
                      <View key={index} style={styles.warningItem}>
                        <MaterialCommunityIcons 
                          name="alert-circle" 
                          size={16}
                          color={'#991B1B'}
                          style={styles.warningIcon}
                        />
                        <Text style={styles.warningText}>
                          {warning}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
          )}
        </Animated.View>

        <View style={styles.previewSectionOuter}>
          <Text style={[styles.previewSectionTitle, { color: theme.colors.secondary }]}>Preview</Text>
          <Animated.View 
            style={[
              styles.previewCardContainer, 
              { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }
            ]}
          >
            {isLoading ? (
              <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.previewCard,
                  styles.previewPlaceholder,
                  pressed && styles.pressedCard
                ]}
                onPress={handlePreviewPress}
              >
                <MaterialCommunityIcons 
                  name="file-pdf-box" 
                  size={48}
                  color={theme.colors.primary}
                  style={styles.pdfIcon}
                />
                <Text style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Tap to view full document
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>

        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            icon="download"
            onPress={() => {/* Handle download */}}
            style={styles.actionButtonPrimary}
            labelStyle={styles.actionButtonLabel}
            contentStyle={styles.actionButtonContent}
            theme={{ roundness: BASE_GRID / theme.roundness }}
            accessibilityLabel="Download document"
          >
            Download
          </Button>
          <Button
            mode="outlined"
            icon="share-variant"
            onPress={() => {/* Handle share */}}
            style={[styles.actionButtonSecondary, { borderColor: theme.colors.primary }]}
            labelStyle={styles.actionButtonLabel}
            contentStyle={styles.actionButtonContent}
            theme={{ roundness: BASE_GRID / theme.roundness }}
            accessibilityLabel="Share document"
          >
            Share
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={showFullDocument}
          onDismiss={() => setShowFullDocument(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: theme.colors.background }
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.outline }]}>
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

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    height: 56,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceVariant,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingBottom: PAGE_PADDING_BOTTOM,
    gap: BASE_GRID * 3,
    paddingTop: BASE_GRID * 2,
  },
  summaryCard: {
    borderRadius: BASE_GRID,
    borderWidth: 1,
    borderColor: theme.colors.surfaceVariant,
    backgroundColor: theme.colors.surface,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  summaryCardContent: {
    padding: BASE_GRID * 2,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  aiSummaryTitle: {
  },
  aiTitleText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: theme.colors.onSurface,
  },
  aiSubtitleText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    color: theme.colors.onSurfaceVariant,
  },
  buttonIcon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  talkAiButton: {
    borderWidth: 1,
    height: 32,
    minWidth: 100,
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  talkAiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 4,
  },
  talkAiButtonLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    margin: 0,
    letterSpacing: 0.1,
  },
  aiSummaryContent: {
    gap: BASE_GRID * 1.5,
  },
  summaryBodyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
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
    backgroundColor: theme.colors.errorContainer,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    padding: BASE_GRID * 1.5,
    borderRadius: 4,
    gap: BASE_GRID,
  },
  warningHeading: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: theme.colors.error,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningIcon: {
  },
  warningText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.onErrorContainer,
    flex: 1,
  },
  previewSectionOuter: {
    gap: BASE_GRID * 1.5,
  },
  previewSectionTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 20,
    fontWeight: '500',
  },
  previewCardContainer: {
    height: 160,
    borderRadius: BASE_GRID,
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  previewCard: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
  },
  previewPlaceholder: {
    padding: 24,
    gap: 12,
  },
  pdfIcon: {
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: BASE_GRID * 1.5,
    justifyContent: 'flex-end',
  },
  actionButtonContent: {
    height: 40,
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonPrimary: {
    flex: 1,
    maxWidth: '48%',
  },
  actionButtonSecondary: {
    flex: 1,
    maxWidth: '48%',
    borderWidth: 1,
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
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    fontWeight: '600',
  },
  documentViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    padding: BASE_GRID * 2,
  },
  pressedCard: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
}); 