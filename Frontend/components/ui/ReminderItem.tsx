import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ReminderItemProps {
  title: string;
  schedule: string;
  type: 'time' | 'meal';
}

export const ReminderItem: React.FC<ReminderItemProps> = ({ title, schedule, type }) => {
  const theme = useTheme();
  const [status, setStatus] = useState<'none' | 'taken' | 'not-taken'>('none');

  const handleTaken = () => {
    setStatus(status === 'taken' ? 'none' : 'taken');
    if (status === 'not-taken') setStatus('taken');
  };

  const handleNotTaken = () => {
    setStatus(status === 'not-taken' ? 'none' : 'not-taken');
    if (status === 'taken') setStatus('not-taken');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
        <MaterialCommunityIcons
          name={type === 'time' ? 'clock-outline' : 'food'}
          size={20}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.content}>
        <Text variant="bodyLarge" style={styles.title}>{title}</Text>
        <Text variant="bodyMedium" style={styles.time}>{schedule}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'taken' && styles.statusButtonActive,
            { backgroundColor: status === 'taken' ? theme.colors.primaryContainer : '#f0f0f0' }
          ]}
          onPress={handleTaken}
        >
          <MaterialCommunityIcons
            name="check"
            size={18}
            color={status === 'taken' ? theme.colors.primary : '#666'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'not-taken' && styles.statusButtonActive,
            { backgroundColor: status === 'not-taken' ? '#ffebee' : '#f0f0f0' }
          ]}
          onPress={handleNotTaken}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={status === 'not-taken' ? '#f44336' : '#666'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
    fontSize: 15,
  },
  time: {
    opacity: 0.6,
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusButtonActive: {
    elevation: 2,
  },
}); 