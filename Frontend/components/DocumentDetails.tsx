import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, BackHandler, TouchableOpacity, Animated, Pressable, Image, Alert } from 'react-native';
import { Text, useTheme, Card, Button, Portal, Modal, Avatar, IconButton, ActivityIndicator, MD3Theme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentInfo } from '../app/(tabs)/document';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import { useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/auth';
import { WebView } from 'react-native-webview';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mystwell.me';

interface DocumentDetailsProps {
  document: DocumentInfo;
  onBack: () => void;
  onRefresh?: () => void;
}

const BASE_GRID = 8;
const PAGE_PADDING_HORIZONTAL = 16;
const PAGE_PADDING_BOTTOM = 16;

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
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1,
  },
  loader: {
    padding: BASE_GRID * 2,
  },
  pressedCard: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  errorSection: {
    marginTop: BASE_GRID * 2,
    padding: BASE_GRID * 1.5,
    backgroundColor: theme.colors.errorContainer,
    borderRadius: BASE_GRID,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    marginRight: BASE_GRID,
  },
  retryButton: {
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

const renderStructuredData = (data: any, theme: MD3Theme, styles: ReturnType<typeof createStyles>) => {
  if (!data || typeof data !== 'object') {
    return <Text style={styles.summaryBodyText}>No structured data available.</Text>;
  }

  const renderValue = (value: any, key: string, indentLevel = 0): React.ReactNode => {
    const indentStyle = { paddingLeft: indentLevel * BASE_GRID * 2 };

    if (value === null || value === undefined) {
      return <Text style={[styles.summaryBodyText, indentStyle, { color: theme.colors.onSurfaceVariant }]}>N/A</Text>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <Text style={[styles.summaryBodyText, indentStyle, { color: theme.colors.onSurfaceVariant }]}>None</Text>;
      }
      return value.map((item, index) => (
        <View key={`${key}-${index}`} style={[styles.bulletPoint, indentStyle]}>
          <Text style={styles.bullet}>•</Text>
          {typeof item === 'object' ? (
            renderValue(item, `${key}-${index}`, 0)
          ) : (
            <Text style={styles.bulletText}>{String(item)}</Text>
          )}
        </View>
      ));
    }
    if (typeof value === 'object') {
      return Object.entries(value).map(([subKey, subValue]) => (
        <View key={subKey} style={[{ marginTop: indentLevel > 0 ? 4 : 0 }, indentStyle]}>
          <Text style={[styles.sectionLabel, { fontSize: 13, textTransform: 'capitalize' }]}>{subKey.replace(/_/g, ' ')}:</Text>
          {renderValue(subValue, subKey, indentLevel + 1)}
        </View>
      ));
    }
    return <Text style={[styles.summaryBodyText, indentStyle]}>{String(value)}</Text>;
  };

  const keyOrder = [
    'detected_document_type',
    'patient_name',
    'provider_name',
    'date_of_service',
    'summary',
    'key_information',
    'medications_mentioned',
    'follow_up_instructions',
  ];

  const stringKeys = Object.keys(data).filter(k => typeof k === 'string');
  const orderedKeys = keyOrder.filter(k => stringKeys.includes(k));
  const otherKeys = stringKeys.filter(k => !keyOrder.includes(k));

  return [...orderedKeys, ...otherKeys].map((key: string) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    return (
      <View key={key} style={styles.summarySection}>
        <Text style={styles.sectionLabel}>{label}:</Text>
        {renderValue(data[key], key)}
      </View>
    );
  });
};

interface StatusDisplay {
    text: string;
    color: string;
    loading?: boolean;
}

const getStatusDisplayDetails = (status: DocumentInfo['status']): StatusDisplay => {
    const cardStatus = getStatusDisplay(status);
    if (!cardStatus) return { text: status, color: '#6B7280' }; 
    return {
        ...cardStatus,
        text: status === 'processing_failed' ? 'Processing Failed' : cardStatus.text,
        loading: cardStatus.loading ?? false,
    };
};

export function DocumentDetails({ document, onBack, onRefresh }: DocumentDetailsProps) {
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const statusDisplay = getStatusDisplayDetails(document.status);
  const isReady = document.status === 'processed';
  const isFailed = document.status === 'processing_failed';
  const isProcessing = statusDisplay.loading;

  const fetchPreviewDetails = useCallback(async () => {
    if (!session?.access_token || !document.id) return;
    console.log(`Fetching preview details for ${document.id}`);
    setIsLoadingImage(true);
    setImageUrl(null);
    setMimeType(null);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${document.id}/view-url`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
          let errorMsg = 'Failed to fetch preview URL';
          try { errorMsg = (await response.json()).message || errorMsg; } catch(e){}
          throw new Error(errorMsg);
      }
      const data = await response.json();
      console.log(`Preview details received: URL=${data.downloadUrl}, MimeType=${data.mimeType}`);
      setImageUrl(data.downloadUrl);
      setMimeType(data.mimeType);
    } catch (error: any) {
      console.error("Error fetching preview details:", error);
      Alert.alert("Error", `Could not load document preview. ${error.message}`);
    } finally {
      setIsLoadingImage(false);
    }
  }, [document.id, session]);

  useEffect(() => {
    if (isReady) {
      fetchPreviewDetails();
    }
    return () => {
        setImageUrl(null);
        setMimeType(null);
        setIsLoadingImage(false);
    }
  }, [document.id, isReady, fetchPreviewDetails]);

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
        documentTitle: document.display_name || 'Document',
        returnTo: 'document'
      }
    });
  };

  const handlePreviewPress = () => {
    if (imageUrl && mimeType?.startsWith('image/')) {
      triggerHaptic();
      setShowFullDocument(true);
    } else if (imageUrl && mimeType === 'application/pdf') {
        Alert.alert("Open PDF", "Opening PDF previews directly in the app is not fully supported yet. You can download it.");
        triggerHaptic();
    } else if (isReady && !isLoadingImage) {
        fetchPreviewDetails(); 
    } else if (!isReady) {
        Alert.alert("Preview Not Available", "Document is still processing.")
    } else {
        Alert.alert("Preview Error", "Could not load document preview.")
    }
  };

  const handleBackPress = () => {
    triggerHaptic();
    onBack();
  };

  const handleRetry = async () => {
    if (!session?.access_token) {
      Alert.alert("Error", "Authentication session not found.");
      return;
    }
    setIsRetrying(true);
    triggerHaptic();
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${document.id}/retry-processing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to retry processing.' }));
        throw new Error(errorData.message || 'Failed to retry processing.');
      }
      Alert.alert("Success", "Document has been re-queued for processing.");
      onRefresh?.();
    } catch (error: any) {
      console.error("Retry failed:", error);
      Alert.alert("Retry Failed", error.message || "An unknown error occurred.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <SafeAreaView style={styles.pageContainer} edges={['top', 'left', 'right']}>
      <AppHeader title={document.display_name || "Document Details"} onBackPress={handleBackPress} />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
        <View style={[styles.aiHeaderLeft, { marginBottom: BASE_GRID }]}>
          <MaterialCommunityIcons 
            name="text-box-search-outline"
            size={24} 
            color={theme.colors.primary}
            style={styles.aiIcon}
          />
          <View style={styles.aiSummaryTitle}>
            <Text style={styles.aiTitleText}>Extracted Information</Text>
            <Text style={styles.aiSubtitleText}>
              {document.detected_document_type || 'Details from document'}
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

        <View style={styles.aiSummaryContent}>
          {renderStructuredData(document.structured_data, theme, styles)}
        </View>

        {document.status === 'processing_failed' && (
          <View style={styles.errorSection}>
              <MaterialCommunityIcons name="alert-circle-outline" color={theme.colors.error} size={20} style={{ marginRight: BASE_GRID }} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  Processing failed: {document.error_message || 'Unknown error'}
              </Text>
              <Button 
                  mode="contained" 
                  onPress={handleRetry}
                  style={styles.retryButton}
                  labelStyle={{ marginHorizontal: 0}}
                  compact
                  loading={isRetrying}
                  disabled={isRetrying}
              >
                  Retry Processing
              </Button>
          </View>
        )}

        <View style={styles.previewSectionOuter}>
          <Text style={[styles.previewSectionTitle, { color: theme.colors.secondary }]}>Original Document</Text>
          <Pressable 
            onPress={handlePreviewPress} 
            style={({ pressed }) => [
              styles.previewCardContainer,
              pressed && styles.pressedCard,
            ]}
            disabled={isLoadingImage}
           >
            {isLoadingImage ? (
                <ActivityIndicator style={styles.loader} size="large" />
            ) : imageUrl && mimeType?.startsWith('image/') ? (
                <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : imageUrl && mimeType === 'application/pdf' ? (
                 <View style={[styles.previewCard, styles.previewPlaceholder]}>
                    <MaterialCommunityIcons name="file-pdf-box" size={48} color={theme.colors.primary} style={styles.pdfIcon} />
                   <Text style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>PDF Document</Text>
                   <Text style={[styles.aiSubtitleText, { textAlign: 'center' }]}>Tap to view (may open externally)</Text>
                </View>
            ) : (
                <View style={[styles.previewCard, styles.previewPlaceholder]}>
                    <MaterialCommunityIcons name="file-alert-outline" size={48} color={theme.colors.onSurfaceVariant} style={styles.pdfIcon} />
                   <Text style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>
                     {isProcessing ? "Processing..." : isReady ? "Preview Unavailable" : "Preview Error"}
                   </Text>
                </View>
            )}
          </Pressable>
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
          >
            Share
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={showFullDocument && mimeType?.startsWith('image/')}
          onDismiss={() => setShowFullDocument(false)}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background }
          ]}
        >
          <Image 
                source={{ uri: imageUrl || undefined }} 
                style={styles.fullImage} 
                resizeMode="contain" 
            />
             <IconButton
                icon="close"
                size={30}
                onPress={() => setShowFullDocument(false)}
                style={styles.closeButton}
                iconColor={theme.colors.onPrimary}
                containerColor={theme.colors.backdrop}
             />
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const getStatusDisplay = (status: DocumentInfo['status']): StatusDisplay => {
  switch (status) {
    case 'pending_upload': return { text: 'Uploading', color: '#9CA3AF' };
    case 'uploaded':
    case 'queued': return { text: 'Queued', color: '#F59E0B' };
    case 'processing':
    case 'processing_retried': return { text: 'Processing...', color: '#3B82F6', loading: true };
    case 'processed': return { text: 'Ready', color: '#10B981' };
    case 'processing_failed': return { text: 'Processing Failed', color: '#EF4444' };
    default: return { text: status, color: '#6B7280' };
  }
}; 