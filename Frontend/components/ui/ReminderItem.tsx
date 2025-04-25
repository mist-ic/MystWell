import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, useTheme, Portal, Modal, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MD3Theme } from 'react-native-paper';

// Define specific reminder types for clarity
export type ReminderType = 'time' | 'meal' | 'appointment' | 'check'; // Example expansion

interface ReminderItemProps {
  id: string; 
  title: string;
  schedule: string;
  type: ReminderType; // Use expanded type
  isTopReminder?: boolean; 
  // Renamed prop for clarity
  onUpdateStatus: (id: string, status: 'completed' | 'skipped' | 'modify' | 'refill') => void; 
}

export const ReminderItem: React.FC<ReminderItemProps> = ({ 
  id,
  title, 
  schedule, 
  type, 
  isTopReminder = false,
  onUpdateStatus
}) => {
  const theme = useTheme<MD3Theme>();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isTaken, setIsTaken] = useState(false); // Re-add isTaken state

  // Pass isTaken back to the style factory
  const styles = useMemo(() => createStyles(theme, isTaken, isTopReminder), [theme, isTaken, isTopReminder]);

  // Handler for checkmark press -> toggle taken state AND trigger completed status
  const handleToggleTaken = useCallback(() => {
    const newTakenState = !isTaken;
    setIsTaken(newTakenState);
    if (newTakenState) { // Only trigger complete when marking as taken
      onUpdateStatus(id, 'completed');
    } else {
      // Optionally handle un-taking if needed, 
      // otherwise clicking again just toggles visual state
      // Maybe trigger a different status like 'pending' if needed?
      // For now, let's just toggle visual state and let HomeScreen handle position.
    }
  }, [id, onUpdateStatus, isTaken]);

  // Handler for X press -> open modal
  const handleOpenModal = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  // Handler for actions within the modal
  const handleModalAction = useCallback((status: 'skipped' | 'modify' | 'refill') => {
    onUpdateStatus(id, status);
    handleCloseModal();
  }, [id, onUpdateStatus, handleCloseModal]);

  // Determine modal buttons based on type
  const renderModalButtons = () => {
    switch (type) {
      case 'meal':
        return (
          <>
            {/* Changed Taken to Refill */}
            <Button mode="contained" onPress={() => handleModalAction('refill')} style={styles.modalButton}>Refill</Button>
            <Button mode="outlined" onPress={() => handleModalAction('skipped')} style={styles.modalButton}>Skipped</Button>
          </>
        );
      case 'appointment': // Assuming 'appointment' is a possible type
        return (
          <>
            <Button mode="contained" onPress={() => handleModalAction('modify')} style={styles.modalButton}>Modify</Button>
            <Button mode="outlined" onPress={() => handleModalAction('skipped')} style={styles.modalButton}>Skipped</Button>
          </>
        );
      case 'time': // Treat generic 'time' as skippable (like checks)
      case 'check':
        return (
          <Button mode="outlined" onPress={() => handleModalAction('skipped')} style={styles.modalButton}>Skip</Button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={type === 'meal' ? 'food-variant' : (type === 'appointment' ? 'calendar-clock' : 'clock-outline')}
            size={20}
            // Update icon color based on isTaken
            color={isTaken ? theme.colors.onSurfaceDisabled : theme.colors.primary}
          />
        </View>
        <View style={styles.content}>
          <Text 
            variant="bodyLarge" 
            style={styles.title} 
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text variant="bodyMedium" style={styles.schedule}>{schedule}</Text>
        </View>
        <View style={styles.actionButtons}>
          {/* Check Button - Toggles local state and triggers 'completed' */}
          <TouchableOpacity
            style={styles.checkButton}
            onPress={handleToggleTaken} // Use updated handler
            accessibilityLabel={isTaken ? "Mark as not taken" : "Mark as completed"}
          >
            <MaterialCommunityIcons
              name="check"
              size={18}
              // Update check icon color based on isTaken
              color={isTaken ? theme.colors.primary : theme.colors.onSurfaceDisabled}
            />
          </TouchableOpacity>
          {/* Dismiss Button - Opens modal */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleOpenModal}
            accessibilityLabel="More options or dismiss"
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={theme.colors.onSurfaceDisabled}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal for dismiss options */}
      <Portal>
        <Modal 
          visible={isModalVisible} 
          onDismiss={handleCloseModal} 
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.elevation.level3 }]} // Use elevation for modal bg
        >
          <Text variant="titleMedium" style={styles.modalTitle}>{title}</Text>
          <Text variant="bodyMedium" style={styles.modalSchedule}>{schedule}</Text>
          <View style={styles.modalActionsContainer}>
            {renderModalButtons()}
          </View>
          <Button onPress={handleCloseModal} style={styles.modalCancelButton}>Cancel</Button>
        </Modal>
      </Portal>
    </>
  );
};

// Add isTaken back to factory function parameters
const createStyles = (theme: MD3Theme, isTaken: boolean, isTopReminder: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    // Use a slightly darker surface variant or elevation level for top reminder
    backgroundColor: isTopReminder 
      ? theme.colors.elevation.level2 // Example: using elevation level 2 for darker shade
      : theme.colors.surface, 
    borderRadius: 12,
    marginBottom: 8,
    opacity: isTaken ? 0.6 : 1, // Re-apply opacity based on isTaken
    borderWidth: isTopReminder ? 1 : 0, 
    borderColor: isTopReminder ? theme.colors.outline : undefined, 
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    // Update icon container background based on isTaken
    backgroundColor: isTaken 
      ? theme.colors.surfaceDisabled 
      : theme.colors.primaryContainer, 
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
    fontSize: 15,
    textDecorationLine: isTaken ? 'line-through' : 'none', // Re-apply strikethrough
    color: isTaken ? theme.colors.onSurfaceDisabled : theme.colors.onSurface,
  },
  schedule: {
    color: isTaken ? theme.colors.onSurfaceDisabled : theme.colors.onSurfaceVariant,
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, 
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    // Update check button background based on isTaken
    backgroundColor: isTaken ? theme.colors.primaryContainer : theme.colors.surfaceDisabled, 
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceDisabled,
  },
  // Modal Styles
  modalContainer: {
    padding: 20,
    margin: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSchedule: {
    marginBottom: 20,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  modalActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
    gap: 10, // Add gap between modal buttons
  },
  modalButton: {
    flex: 1, // Make buttons take equal space if needed
  },
  modalCancelButton: {
    marginTop: 10,
  }
}); 