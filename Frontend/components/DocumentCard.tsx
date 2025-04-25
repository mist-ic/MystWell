import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, GestureResponderEvent, Platform } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface DocumentInfo {
  id: string;
  title: string;
  type: string;
  size: string;
  isPinned?: boolean;
  icon?: string;
}

interface DocumentCardProps {
  document: DocumentInfo;
  isPinned?: boolean;
  onPin?: (id: string) => void;
  onPress?: (document: DocumentInfo) => void;
  onMorePress?: (event: GestureResponderEvent) => void;
}

const BASE_GRID = 8;

export function DocumentCard({ document, isPinned, onPin, onPress, onMorePress }: DocumentCardProps) {
  const theme = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const cardBackgroundColor = isPinned
    ? theme.colors.primaryContainer
    : isPressed
      ? '#F3F4F6'
      : theme.colors.surface;

  const cardBorderColor = isPinned
    ? theme.colors.outline
    : isPressed
      ? '#D1D5DB'
      : theme.colors.outline;

  const iconStrokeColor = '#1F2937';

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
    >
      <View style={[styles.innerContainer, isPinned && styles.innerContainerPinned]}>
        {isPinned && <View style={[styles.accentBar, { backgroundColor: theme.colors.primary }]} />}

        <MaterialCommunityIcons
          name="file-document-outline"
          size={20}
          color={iconStrokeColor}
          style={styles.fileIcon}
        />

        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={1}>{document.title}</Text>
          <View style={styles.metadataGroup}>
            <Text style={[styles.metadataText, styles.metadataTypeText]}>{document.type.toUpperCase()}</Text>
            <Text style={styles.metadataText}>{document.size}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.actionsContainer}>
          {onPin && (
            <IconButton
              icon="pin"
              size={20}
              onPress={() => onPin(document.id)}
              iconColor={isPinned ? theme.colors.primary : '#6B7280'}
              style={styles.actionButton}
              accessibilityLabel={isPinned ? "Unpin document" : "Pin document"}
            />
          )}
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={onMorePress}
            iconColor={'#6B7280'}
            style={styles.actionButton}
            accessibilityLabel="More options"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 64,
    borderRadius: BASE_GRID,
    borderWidth: 1,
    overflow: 'hidden',
  },
  innerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BASE_GRID * 2,
    gap: BASE_GRID * 1.5,
  },
  innerContainerPinned: {
    paddingLeft: BASE_GRID * 1.5,
  },
  accentBar: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  fileIcon: {
    // Size/Color set via props
    // No margin needed if gap used correctly
  },
  textContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    flexShrink: 1,
  },
  titleText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
    color: '#111827',
    lineHeight: 24,
  },
  metadataGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
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
    marginRight: 0,
  },
  spacer: {
    flexGrow: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    margin: -BASE_GRID,
  },
}); 