import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, BackHandler, TouchableOpacity, Animated, Pressable, Image, Alert } from 'react-native';
import { Text, useTheme, Card, Button, Portal, Modal, Avatar, IconButton, ActivityIndicator, MD3Theme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentInfo } from '../app/(tabs)/document';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import { useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/auth';

const API_BASE_URL = 'https://mystwell.me';

interface DocumentDetailsProps {
  document: DocumentInfo;
  onBack: () => void;
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
        return <Text style={{ fontStyle: 'italic', color: theme.colors.onSurfaceVariant }}>No details extracted.</Text>;
    }

    const renderValue = (value: any, keyPrefix: string = 'val') => {
        if (value === null || value === undefined) return 'N/A';
        if (Array.isArray(value)) {
            if (value.length === 0) return 'None';
            return value.map((item, index) => (
                <View key={`${keyPrefix}-${index}`} style={{ marginBottom: 4 }}>
                    {typeof item === 'object' ? (
                        Object.entries(item).map(([k, v]) => (
                            <Text key={k} style={styles.bulletText}>{`${k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}: ${v ?? 'N/A'}`}</Text>
                        ))
                    ) : (
                        <Text style={styles.bulletText}>- {String(item)}</Text>
                    )}
                </View>
            ));
        }
        if (typeof value === 'object') {
            return <Text>Object details not displayed</Text>;
        }
        return String(value);
    };

    return Object.entries(data)
        .filter(([key]) => key !== 'detected_document_type')
        .map(([key, value]) => (
            <View key={key} style={styles.summarySection}>
                <Text variant="titleSmall" style={styles.sectionLabel}>
                    {key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}:
                </Text>
                <View style={styles.dataValueContainer}>
                  {renderValue(value, key)}
                </View>
            </View>
        ));
};

export function DocumentDetails({ document, onBack }: DocumentDetailsProps) {
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    const fetchImageUrl = async () => {
      if (!document || !session) return;
      setIsLoadingImage(true);
      try {
        const response = await fetch(`${API_BASE_URL}/documents/${document.id}/view-url`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch image URL');
        }
        const data = await response.json();
        setImageUrl(data.downloadUrl);
      } catch (error: any) {
        console.error("Error fetching image URL:", error);
        Alert.alert("Error", "Could not load document preview image.");
        setImageUrl(null);
      } finally {
        setIsLoadingImage(false);
      }
    };
    fetchImageUrl();
  }, [document, session]);

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
        documentTitle: document.display_name || 'Document',
        returnTo: 'document'
      }
    });
  };

  const handlePreviewPress = () => {
    if (!imageUrl) {
        Alert.alert("Image Unavailable", "The document preview could not be loaded.");
        return;
    }
    triggerHaptic();
    setShowFullDocument(true);
  };

  const handleBackPress = () => {
    triggerHaptic();
    onBack();
  };

  const handleRetry = async () => {
       if (!document || !session || document.status !== 'processing_failed') return;
       try {
           const response = await fetch(`${API_BASE_URL}/documents/${document.id}/retry-processing`, {
               method: 'POST',
               headers: { 'Authorization': `Bearer ${session.access_token}` },
           });
           if (!response.ok) throw new Error('Failed to retry processing');
           Alert.alert("Retry Initiated", "Document queued for processing again. Return to the list to see updates.");
           onBack();
       } catch (error: any) {
           Alert.alert("Retry Failed", error.message || "Could not retry processing.");
       }
   };

  return (
    <SafeAreaView style={[styles.pageContainer, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
        <AppHeader 
          title={document.display_name || 'Document Details'}
          leftIcon="arrow-left"
          onLeftPress={handleBackPress}
          accessibilityLabelLeft="Go back to document list"
        />
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContentContainer}
      >
        <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
          {isLoadingImage ? (
            <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
          ) : (
            <Pressable 
              style={({ pressed }) => [
                styles.summaryCardContent,
                pressed && styles.pressedCard
              ]}
              onPress={handlePreviewPress}
            >
              <View style={styles.aiSummaryHeader}>
                <View style={styles.aiHeaderLeft}>
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
              </View>

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
                    >
                        Retry
                    </Button>
                </View>
              )}
            </Pressable>
          )}
        </Animated.View>

        <View style={styles.previewSectionOuter}>
          <Text style={[styles.previewSectionTitle, { color: theme.colors.secondary }]}>Original Document</Text>
          <Animated.View 
            style={[
              styles.previewCardContainer, 
              { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }
            ]}
          >
            {isLoadingImage ? (
              <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
            ) : imageUrl ? (
              <Pressable
                style={({ pressed }) => [
                  styles.previewCard,
                  pressed && styles.pressedCard
                ]}
                onPress={handlePreviewPress}
              >
                 <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="contain" />
              </Pressable>
            ) : (
              <View style={[styles.previewCard, styles.previewPlaceholder]}>
                  <MaterialCommunityIcons name="image-off-outline" size={48} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Preview unavailable
                  </Text>
              </View>
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