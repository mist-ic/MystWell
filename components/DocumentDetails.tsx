import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, BackHandler, TouchableOpacity, Animated, Pressable, Image, Alert, Linking, Share } from 'react-native';
import { Text, useTheme, Card, Button, Portal, Modal, Avatar, IconButton, ActivityIndicator, MD3Theme, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentInfo } from '../app/(tabs)/document';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import { useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/auth';
import { WebView } from 'react-native-webview';

const API_BASE_URL = 'REDACTED_API_URL'; // Hardcoded production URL

interface DocumentDetailsProps {
  document: DocumentInfo;
  onBack: () => void;
  onRefresh?: () => void;
}

// Define tab types for better organization
type TabType = 'summary' | 'details' | 'preview' | 'actions';

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
  // Tab navigation styles
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceVariant,
  },
  tabItem: {
    paddingVertical: BASE_GRID * 1.5,
    paddingHorizontal: BASE_GRID * 2.5,
    marginRight: BASE_GRID,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  infoSection: {
    marginBottom: BASE_GRID * 3,
  },
  // Document cards styling
  documentCard: {
    marginBottom: BASE_GRID * 2,
    borderRadius: BASE_GRID,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    overflow: 'hidden',
  },
  cardContent: {
    padding: BASE_GRID * 2,
  },
  // Header styling
  cardHeader: {
    marginBottom: BASE_GRID,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.onSurfaceVariant,
  },
  // Content rows styling
  infoRow: {
    marginBottom: BASE_GRID * 2,
    paddingBottom: BASE_GRID,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    color: theme.colors.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.onSurface,
    lineHeight: 22,
  },
  // Test results styling
  testResultsContainer: {
    marginTop: BASE_GRID,
  },
  testResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: BASE_GRID,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceVariant,
  },
  testNameContainer: {
    flex: 2,
  },
  testName: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  testValueContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  testValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  testStatusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  testStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  // Status chip styling
  statusChip: {
    height: 32,
    borderRadius: 16,
  },
  statusChipText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginVertical: 0,
    marginHorizontal: 8,
  },
  // Actions section styling
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BASE_GRID,
    marginTop: BASE_GRID,
  },
  actionButton: {
    borderRadius: 8,
    flex: 1,
    minWidth: 150,
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

// Helper function to determine abnormal test values and their status
const getTestValueStatus = (value: string, refRange: string) => {
  if (!value || !refRange) return { status: 'normal', color: '#10B981' };
  
  try {
    // Extract numeric value
    const numericValue = parseFloat(value.split(' ')[0]);
    if (isNaN(numericValue)) return { status: 'normal', color: '#10B981' };

    // Check if reference range specifies high/low
    if (refRange.includes('High')) return { status: 'high', color: '#EF4444' };
    if (refRange.includes('Low')) return { status: 'low', color: '#F59E0B' };

    // Parse reference range as min-max
    const rangeParts = refRange.match(/[\d.]+/g);
    if (!rangeParts || rangeParts.length < 2) return { status: 'normal', color: '#10B981' };
    
    const min = parseFloat(rangeParts[0]);
    const max = parseFloat(rangeParts[1]);
    
    if (numericValue < min) return { status: 'low', color: '#F59E0B' };
    if (numericValue > max) return { status: 'high', color: '#EF4444' };
    
    return { status: 'normal', color: '#10B981' };
  } catch (e) {
    return { status: 'normal', color: '#10B981' };
  }
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
  // State for active tab
  const [activeTab, setActiveTab] = useState<TabType>('summary');

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
      console.log(`Preview details received:`, data);
      
      if (data && data.downloadUrl) {
        setImageUrl(data.downloadUrl);
        setMimeType(data.mimeType || 'application/octet-stream');
        console.log(`Preview URL set: ${data.downloadUrl}, MimeType: ${data.mimeType}`);
      } else {
        console.warn("No preview URL received from backend");
      }
    } catch (error: any) {
      console.error("Error fetching preview details:", error);
      // Don't show alert as this disrupts UX, just log the error
    } finally {
      setIsLoadingImage(false);
    }
  }, [document.id, session]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    if (isReady && !imageUrl && !isLoadingImage) {
      // Try again after a brief delay if the first attempt didn't work
      retryTimeout = setTimeout(() => {
        console.log("Retrying preview fetch automatically");
        fetchPreviewDetails();
      }, 2000);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [isReady, imageUrl, isLoadingImage, fetchPreviewDetails]);

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

  // Render the summary tab content
  const renderSummaryTab = () => {
    if (!document.structured_data) {
      return (
        <Card style={styles.documentCard}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.summaryBodyText}>No summary information available.</Text>
          </Card.Content>
        </Card>
      );
    }

    const data = document.structured_data;
    
    return (
      <View>
        <Card style={[styles.documentCard, { elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 }]}>
          <Card.Content style={[styles.cardContent, { paddingVertical: BASE_GRID * 3 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Document Overview</Text>
            </View>
            
            <View style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant }]}>
              <Text style={styles.infoLabel}>Document Type</Text>
              <Text style={styles.infoValue}>{data.detected_document_type || "Lab Report"}</Text>
            </View>
            
            <View style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant }]}>
              <Text style={styles.infoLabel}>Patient</Text>
              <Text style={styles.infoValue}>{data.patient_name || "Not specified"}</Text>
            </View>
            
            <View style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant }]}>
              <Text style={styles.infoLabel}>Provider</Text>
              <Text style={styles.infoValue}>{data.provider_name || "Not specified"}</Text>
            </View>
            
            <View style={[styles.infoRow, { borderBottomWidth: data.summary ? 1 : 0, borderBottomColor: theme.colors.surfaceVariant }]}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{data.date_of_service || "Not specified"}</Text>
            </View>
            
            {data.summary && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Summary</Text>
                <Text style={styles.infoValue}>{data.summary}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
        
        <Button
          mode="contained-tonal"
          icon={({ size, color }) => (
            <MaterialCommunityIcons 
              name="message-processing" 
              size={18}
              color={color}
              style={styles.buttonIcon}
            />
          )}
          onPress={handleTalkToAI}
          style={[{ 
            marginTop: BASE_GRID * 2,
            borderRadius: 8,
            height: 48,
          }]}
          contentStyle={{ height: 48 }}
        >
          Talk to AI
        </Button>
      </View>
    );
  };
  
  // Render the details tab content with test results
  const renderDetailsTab = () => {
    if (!document.structured_data) {
      return (
        <Card style={styles.documentCard}>
          <Card.Content style={styles.cardContent}>
            <Text style={[styles.summaryBodyText, { fontFamily: 'Inter-Regular' }]}>No detailed information available.</Text>
          </Card.Content>
        </Card>
      );
    }
    
    const data = document.structured_data;
    let testResults = [];
    
    // Check if key_information exists and is an array
    if (data.key_information && Array.isArray(data.key_information)) {
      testResults = data.key_information;
    } else if (typeof data.key_information === 'string') {
      // Split string by newlines if it's a string
      testResults = data.key_information.split('\n').filter(line => line.trim());
    }
    
    return (
      <View>
        <Card style={[styles.documentCard, { elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 }]}>
          <Card.Content style={[styles.cardContent, { paddingVertical: BASE_GRID * 3 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Key Information</Text>
            </View>
            
            <View style={styles.testResultsContainer}>
              {testResults.length > 0 ? (
                testResults.map((item, index) => {
                  let testName = '';
                  let testValue = '';
                  let reference = '';
                  
                  if (typeof item === 'string') {
                    // Parse string format like "Urea: 15.93 mg/dL (Low - Bio Ref Interval: 17.00 - 43.00)"
                    const parts = item.split(':');
                    if (parts.length >= 2) {
                      testName = parts[0].trim();
                      // Extract value and reference range
                      const valueParts = parts.slice(1).join(':').split('(');
                      testValue = valueParts[0].trim();
                      reference = valueParts.length > 1 ? `(${valueParts[1]}` : '';
                    } else {
                      testName = item;
                    }
                  } else if (typeof item === 'object') {
                    // Handle object format if API returns structured data
                    testName = item.name || '';
                    testValue = item.value || '';
                    reference = item.reference || '';
                  }
                  
                  const valueStatus = getTestValueStatus(testValue, reference);
                  
                  return (
                    <View key={`test-${index}`} style={[styles.testResultItem, { paddingVertical: BASE_GRID * 1.5 }]}>
                      <View style={styles.testNameContainer}>
                        <Text style={styles.testName}>{testName}</Text>
                        {reference && (
                          <Text style={{ 
                            fontFamily: 'Inter-Regular',
                            fontSize: 12,
                            color: theme.colors.onSurfaceVariant,
                            lineHeight: 16
                          }}>
                            {reference}
                          </Text>
                        )}
                      </View>
                      <View style={styles.testValueContainer}>
                        <Text 
                          style={[
                            styles.testValue, 
                            { color: valueStatus.color }
                          ]}
                        >
                          {testValue}
                        </Text>
                        {valueStatus.status !== 'normal' && (
                          <View style={[styles.testStatusContainer, { backgroundColor: `${valueStatus.color}15` }]}>
                            <Text style={[styles.testStatusText, { color: valueStatus.color }]}>
                              {valueStatus.status === 'high' ? 'HIGH' : 'LOW'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={[styles.summaryBodyText, { 
                  fontFamily: 'Inter-Regular'
                }]}>No test results available.</Text>
              )}
            </View>
          </Card.Content>
        </Card>
        
        {data.medications_mentioned && (
          <Card style={[styles.documentCard, { marginTop: BASE_GRID * 2, elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 }]}>
            <Card.Content style={[styles.cardContent, { paddingVertical: BASE_GRID * 2 }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Medications Mentioned</Text>
              </View>
              <Text style={styles.infoValue}>
                {typeof data.medications_mentioned === 'string' 
                  ? data.medications_mentioned 
                  : 'None'}
              </Text>
            </Card.Content>
          </Card>
        )}
        
        {data.follow_up_instructions && (
          <Card style={[styles.documentCard, { marginTop: BASE_GRID * 2, elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 }]}>
            <Card.Content style={[styles.cardContent, { paddingVertical: BASE_GRID * 2 }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Follow Up Instructions</Text>
              </View>
              <Text style={styles.infoValue}>
                {typeof data.follow_up_instructions === 'string' 
                  ? data.follow_up_instructions 
                  : 'No follow-up instructions provided.'}
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    );
  };
  
  // Render the preview tab content
  const renderPreviewTab = () => {
    console.log("Rendering preview tab, imageUrl:", imageUrl, "mimeType:", mimeType, "isReady:", isReady);
    
    return (
      <View style={styles.previewSectionOuter}>
        <TouchableOpacity 
          onPress={handlePreviewPress}
          style={styles.previewCardContainer}
          disabled={isLoadingImage}
        >
          {isLoadingImage ? (
            <View style={styles.previewCard}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.previewLabel, { marginTop: 12 }]}>Loading preview...</Text>
            </View>
          ) : imageUrl ? (
            mimeType?.startsWith('image/') ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                onError={(e) => {
                  console.error("Image loading error:", e.nativeEvent.error);
                  // Clear image URL on error to show fallback
                  setImageUrl(null);
                }}
              />
            ) : mimeType === 'application/pdf' ? (
              <View style={styles.previewCard}>
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={48}
                  color={theme.colors.primary}
                  style={styles.pdfIcon}
                />
                <Text style={styles.previewLabel}>Tap to view PDF</Text>
              </View>
            ) : (
              <View style={styles.previewCard}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                  style={styles.pdfIcon}
                />
                <Text style={styles.previewLabel}>Preview available</Text>
                <Text style={styles.aiSubtitleText}>Tap to open document</Text>
              </View>
            )
          ) : isReady ? (
            <View style={styles.previewCard}>
              <MaterialCommunityIcons
                name="refresh"
                size={48}
                color={theme.colors.onSurfaceVariant}
                style={styles.pdfIcon}
              />
              <Text style={styles.previewLabel}>Unable to load preview</Text>
              <Button
                mode="text"
                onPress={fetchPreviewDetails}
                style={{ marginTop: 8 }}
                labelStyle={{ fontSize: 14 }}
              >
                Retry
              </Button>
            </View>
          ) : (
            <View style={styles.previewCard}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
                style={styles.pdfIcon}
              />
              <Text style={styles.previewLabel}>Preview not available</Text>
              {!isReady && <Text style={styles.aiSubtitleText}>{statusDisplay.text}</Text>}
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.actionsSection}>
          {isReady && (
            <Button
              mode="contained"
              icon="download"
              onPress={() => {
                if (imageUrl) {
                  // Try to download the document
                  Alert.alert(
                    "Download Document",
                    "Would you like to download this document?",
                    [
                      {
                        text: "Cancel",
                        style: "cancel"
                      },
                      {
                        text: "Download",
                        onPress: () => {
                          // Here you'd implement the actual download
                          // For now, we'll just open the URL which may trigger download
                          if (Platform.OS === 'web') {
                            window.open(imageUrl, '_blank');
                          } else {
                            Linking.openURL(imageUrl).catch(err => 
                              console.error("Failed to open URL:", err)
                            );
                          }
                        }
                      }
                    ]
                  );
                } else {
                  // Try to fetch the preview URL first
                  fetchPreviewDetails().then(() => {
                    if (imageUrl) {
                      Alert.alert("Ready to download", "The document is now ready to download.");
                    } else {
                      Alert.alert("Download Error", "Unable to prepare document for download.");
                    }
                  });
                }
              }}
              style={styles.actionButtonPrimary}
              contentStyle={styles.actionButtonContent}
              labelStyle={styles.actionButtonLabel}
            >
              Download
            </Button>
          )}
          
          {isReady && (
            <Button
              mode="outlined"
              icon="share-variant"
              onPress={() => {
                // Share functionality
                if (imageUrl) {
                  // Try to share the document URL
                  if (Platform.OS !== 'web') {
                    Share.share({
                      url: imageUrl,
                      title: document.display_name || 'Document',
                      message: `Check out this document: ${document.display_name || 'Document'}`
                    }).catch(error => console.error("Share error:", error));
                  } else {
                    // Web fallback
                    Alert.alert("Share", "Sharing is not available on web.");
                  }
                } else {
                  // Try to fetch the preview URL first
                  fetchPreviewDetails().then(() => {
                    if (imageUrl) {
                      if (Platform.OS !== 'web') {
                        Share.share({
                          url: imageUrl,
                          title: document.display_name || 'Document',
                          message: `Check out this document: ${document.display_name || 'Document'}`
                        }).catch(error => console.error("Share error:", error));
                      } else {
                        Alert.alert("Share", "Sharing is not available on web.");
                      }
                    } else {
                      Alert.alert("Share Error", "Unable to prepare document for sharing.");
                    }
                  });
                }
              }}
              style={styles.actionButtonSecondary}
              contentStyle={styles.actionButtonContent}
              labelStyle={styles.actionButtonLabel}
            >
              Share
            </Button>
          )}
        </View>
      </View>
    );
  };
  
  // Render the actions tab content
  const renderActionsTab = () => {
    return (
      <View>
        <Card style={styles.documentCard}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Document Actions</Text>
            </View>
            
            <View style={styles.actionsContainer}>
              <Button
                mode="contained"
                icon="chat-processing"
                onPress={handleTalkToAI}
                style={styles.actionButton}
              >
                Chat with AI
              </Button>
              
              <Button
                mode="contained-tonal"
                icon="calendar"
                onPress={() => {
                  Alert.alert("Schedule", "Schedule doctor visit based on results.");
                }}
                style={styles.actionButton}
              >
                Schedule Visit
              </Button>
              
              <Button
                mode="contained-tonal"
                icon="bell-plus"
                onPress={() => {
                  Alert.alert("Reminder", "Set reminder for follow-up.");
                }}
                style={styles.actionButton}
              >
                Set Reminder
              </Button>
              
              <Button
                mode="contained-tonal"
                icon="file-edit"
                onPress={() => {
                  Alert.alert("Edit", "Edit document information.");
                }}
                style={styles.actionButton}
              >
                Edit Details
              </Button>
            </View>
          </Card.Content>
        </Card>
        
        {isFailed && (
          <Card style={[styles.documentCard, { marginTop: BASE_GRID * 2, backgroundColor: theme.colors.errorContainer }]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.colors.error }]}>Processing Failed</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.colors.onErrorContainer, marginBottom: BASE_GRID * 2 }]}>
                Document processing failed. You can try processing again.
              </Text>
              <Button
                mode="contained"
                icon="refresh"
                onPress={handleRetry}
                loading={isRetrying}
                disabled={isRetrying}
                buttonColor={theme.colors.error}
              >
                Try Again
              </Button>
            </Card.Content>
          </Card>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.pageContainer} edges={['top', 'left', 'right']}>
      <AppHeader title={document.display_name || "Document Details"} onBackPress={handleBackPress} />
      
      {/* Tab Navigation */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'summary' && styles.activeTabText
          ]}>
            Summary
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'details' && styles.activeTabText
          ]}>
            Details
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'preview' && styles.activeTab]}
          onPress={() => setActiveTab('preview')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'preview' && styles.activeTabText
          ]}>
            Preview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'actions' && styles.activeTab]}
          onPress={() => setActiveTab('actions')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'actions' && styles.activeTabText
          ]}>
            Actions
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Status Chip */}
      <View style={{ paddingHorizontal: PAGE_PADDING_HORIZONTAL, marginBottom: BASE_GRID * 2, marginTop: BASE_GRID }}>
        {isReady ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            <Text style={{ 
              fontFamily: 'Inter-Medium', 
              fontSize: 14, 
              color: '#10B981',
              marginLeft: 6
            }}>
              Ready
            </Text>
          </View>
        ) : (
          <Chip 
            icon={() => (
              isProcessing ? 
                <ActivityIndicator size={16} color={statusDisplay.color} /> : 
                <MaterialCommunityIcons name={
                  isFailed ? "alert-circle" : 
                  "clock-outline"
                } size={16} color={statusDisplay.color} />
            )}
            style={[styles.statusChip, { backgroundColor: `${statusDisplay.color}15` }]}
            textStyle={[styles.statusChipText, { color: statusDisplay.color }]}
          >
            {statusDisplay.text}
          </Chip>
        )}
      </View>
      
      {/* Tab Content */}
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
        {activeTab === 'summary' && renderSummaryTab()}
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'preview' && renderPreviewTab()}
        {activeTab === 'actions' && renderActionsTab()}
      </ScrollView>
      
      {/* Full Document Preview Modal */}
      {showFullDocument && (
        <Portal>
          <Modal visible={showFullDocument} onDismiss={() => setShowFullDocument(false)} contentContainerStyle={styles.modalContainer}>
            <IconButton
              icon="close"
              iconColor="white"
              size={24}
              onPress={() => setShowFullDocument(false)}
              style={styles.closeButton}
            />
            {imageUrl && (
              <Image
                source={{ uri: imageUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </Modal>
        </Portal>
      )}
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