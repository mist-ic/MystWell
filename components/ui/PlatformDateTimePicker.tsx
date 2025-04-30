import React from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

interface PlatformDateTimePickerProps {
  isVisible: boolean;
  mode: 'date' | 'time' | 'datetime';
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  date?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
}

// Native implementation for iOS/Android
const PlatformDateTimePicker: React.FC<PlatformDateTimePickerProps> = ({
  isVisible,
  mode,
  onConfirm,
  onCancel,
  date = new Date(),
  minimumDate,
  maximumDate,
}) => {
  return (
    <DateTimePickerModal
      isVisible={isVisible}
      mode={mode}
      onConfirm={onConfirm}
      onCancel={onCancel}
      date={date}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
};

export default PlatformDateTimePicker; 