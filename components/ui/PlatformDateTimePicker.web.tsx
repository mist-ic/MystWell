import React from 'react';

interface PlatformDateTimePickerProps {
  isVisible: boolean;
  mode: 'date' | 'time' | 'datetime';
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  date?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
}

// Web-specific implementation
const PlatformDateTimePicker: React.FC<PlatformDateTimePickerProps> = ({
  isVisible,
  mode,
  onConfirm,
  onCancel,
  date = new Date(),
  minimumDate,
  maximumDate,
}) => {
  if (!isVisible) return null;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) {
      onCancel();
      return;
    }
    
    // Handle different mode formats
    let selectedDate: Date;
    if (mode === 'date') {
      selectedDate = new Date(value);
    } else if (mode === 'time') {
      // Create a date with today's date and selected time
      const today = new Date();
      const [hours, minutes] = value.split(':');
      selectedDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        parseInt(hours),
        parseInt(minutes)
      );
    } else {
      // datetime mode - this is simplified, might need more handling
      selectedDate = new Date(value);
    }
    
    onConfirm(selectedDate);
  };
  
  // Web styles
  const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  } as React.CSSProperties;
  
  const contentStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    width: '80%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  } as React.CSSProperties;
  
  const inputStyle = {
    fontSize: '16px',
    padding: '8px',
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginBottom: '16px',
  } as React.CSSProperties;
  
  const buttonContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties;
  
  const cancelButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties;
  
  const confirmButtonStyle = {
    padding: '8px 16px',
    backgroundColor: '#4F46E5',
    color: 'white',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties;
  
  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        {mode === 'date' && (
          <input
            type="date"
            className="web-date-picker"
            style={inputStyle}
            onChange={handleChange}
            defaultValue={date ? date.toISOString().split('T')[0] : undefined}
            min={minimumDate ? minimumDate.toISOString().split('T')[0] : undefined}
            max={maximumDate ? maximumDate.toISOString().split('T')[0] : undefined}
            autoFocus
          />
        )}
        
        {mode === 'time' && (
          <input
            type="time"
            className="web-time-picker"
            style={inputStyle}
            onChange={handleChange}
            defaultValue={
              date 
                ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                : undefined
            }
            autoFocus
          />
        )}
        
        {mode === 'datetime' && (
          <input
            type="datetime-local"
            className="web-datetime-picker"
            style={inputStyle}
            onChange={handleChange}
            defaultValue={date ? date.toISOString().slice(0, 16) : undefined}
            min={minimumDate ? minimumDate.toISOString().slice(0, 16) : undefined}
            max={maximumDate ? maximumDate.toISOString().slice(0, 16) : undefined}
            autoFocus
          />
        )}
        
        <div style={buttonContainerStyle}>
          <button style={cancelButtonStyle} onClick={onCancel}>
            Cancel
          </button>
          <button style={confirmButtonStyle} onClick={() => onConfirm(date)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlatformDateTimePicker; 