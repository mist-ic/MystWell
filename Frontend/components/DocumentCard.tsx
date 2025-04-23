import React from 'react';
import { View, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
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
  onPin?: (id: string) => void;
  onPress?: (document: DocumentInfo) => void;
  onMorePress?: (event: GestureResponderEvent) => void;
}

export function DocumentCard({ document, onPin, onPress, onMorePress }: DocumentCardProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      onPress={() => onPress?.(document)}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons
            name={document.icon || "file-document-outline"}
            size={24}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.details}>
          <Text variant="titleMedium" numberOfLines={1}>{document.title}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {document.type} • {document.size}
          </Text>
        </View>
        <View style={styles.actions}>
          {onPin && (
            <IconButton
              icon={document.isPinned ? "pin" : "pin-outline"}
              size={20}
              onPress={() => onPin(document.id)}
              iconColor={document.isPinned ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          )}
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={onMorePress}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  details: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}); 