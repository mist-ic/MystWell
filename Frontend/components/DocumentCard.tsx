import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, GestureResponderEvent, Platform } from 'react-native';
import { Text, useTheme, IconButton, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentInfo } from '../app/(tabs)/document';

interface DocumentCardProps {
  document: DocumentInfo;
  onPress?: (document: DocumentInfo) => void;
  onMorePress?: (event: GestureResponderEvent) => void;
}

const BASE_GRID = 8;

const getStatusDisplay = (status: DocumentInfo['status']) => {
    switch (status) {
        case 'pending_upload': return { text: 'Pending Upload', color: '#9CA3AF' };
        case 'uploaded': return { text: 'Uploaded', color: '#6B7280' };
        case 'queued': return { text: 'Queued for Processing', color: '#F59E0B' };
        case 'processing':
        case 'processing_retried': return { text: 'Processing...', color: '#3B82F6', loading: true };
        case 'processed': return { text: 'Processed', color: '#10B981' };
        case 'processing_failed': return { text: 'Processing Failed', color: '#EF4444' };
        default: return { text: status, color: '#6B7280' };
    }
};

export function DocumentCard({ document, onPress, onMorePress }: DocumentCardProps) {
  const theme = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const statusDisplay = getStatusDisplay(document.status);
  const isProcessing = statusDisplay.loading;

  const cardBackgroundColor = isPressed ? '#F9FAFB' : theme.colors.surface;
  const cardBorderColor = isPressed ? '#E5E7EB' : theme.colors.outline;

  const iconStrokeColor = '#1F2937';

  let fileIconName: keyof typeof MaterialCommunityIcons.glyphMap = "file-document-outline";
  if (document.detected_document_type) {
      const typeLower = document.detected_document_type.toLowerCase();
      if (typeLower.includes('prescription')) fileIconName = "medical-bag";
      else if (typeLower.includes('lab') || typeLower.includes('report')) fileIconName = "clipboard-text-outline";
      else if (typeLower.includes('note') || typeLower.includes('summary')) fileIconName = "note-text-outline";
      else if (typeLower.includes('invoice') || typeLower.includes('bill')) fileIconName = "receipt";
      else if (typeLower.includes('vaccination')) fileIconName = "needle";
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: cardBackgroundColor },
        { borderColor: cardBorderColor },
      ]}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={() => onPress?.(document)}
      activeOpacity={0.8}
      disabled={isProcessing}
    >
      <View style={styles.innerContainer}>
        <MaterialCommunityIcons
          name={fileIconName}
          size={20}
          color={iconStrokeColor}
          style={styles.fileIcon}
        />

        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={1}>{document.display_name || 'Untitled Document'}</Text>
          <View style={styles.metadataGroup}>
            {document.status === 'processed' && document.detected_document_type ? (
                 <Text style={[styles.metadataText, styles.metadataTypeText]}>{document.detected_document_type}</Text>
            ) : (
                <> 
                    {isProcessing && <ActivityIndicator size="small" color={statusDisplay.color} style={{ marginRight: 4 }}/>}
                    <Text style={[styles.metadataText, { color: statusDisplay.color }]}>{statusDisplay.text}</Text>
                </>
            )}
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.actionsContainer}>
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={onMorePress}
            iconColor={'#6B7280'}
            style={styles.actionButton}
            accessibilityLabel="More options"
            disabled={isProcessing}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 64,
    borderRadius: BASE_GRID,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BASE_GRID * 2,
    paddingVertical: BASE_GRID * 1.5,
    gap: BASE_GRID * 1.5,
  },
  fileIcon: {
    marginRight: BASE_GRID * 0.5,
  },
  textContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
    overflow: 'hidden',
  },
  titleText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color: '#111827',
    lineHeight: 24,
    marginBottom: 2,
  },
  metadataGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metadataText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 18,
    marginRight: BASE_GRID * 0.5,
  },
  metadataTypeText: {
    letterSpacing: 0.3,
    fontWeight: '500',
    color: '#4B5563',
  },
  spacer: {
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: BASE_GRID,
  },
  actionButton: {
    margin: -BASE_GRID,
  },
}); 