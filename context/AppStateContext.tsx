import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// Define types for the context
type AppStateContextType = {
  isActive: boolean;
  currentState: string;
  lastActiveTimestamp: number;
};

// Create the context with default values
const AppStateContext = createContext<AppStateContextType>({
  isActive: true,
  currentState: AppState.currentState,
  lastActiveTimestamp: Date.now(),
});

// Provider component
export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appState = useRef(AppState.currentState);
  const [isActive, setIsActive] = useState<boolean>(appState.current === 'active');
  const [currentState, setCurrentState] = useState<string>(appState.current);
  const [lastActiveTimestamp, setLastActiveTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const isGoingActive = appState.current.match(/inactive|background/) && nextAppState === 'active';
      const isGoingBackground = nextAppState.match(/inactive|background/);

      if (isGoingActive) {
        console.log('[AppState] App has come to the foreground!');
        setIsActive(true);
        setLastActiveTimestamp(Date.now());
        
        // Additional Android-specific handling
        if (Platform.OS === 'android') {
          // Force any UI updates or reconnections needed
          console.log('[AppState] Android app activated - triggering refresh');
        }
      } else if (isGoingBackground) {
        console.log('[AppState] App has gone to the background!');
        setIsActive(false);
      }

      // Update refs and state
      appState.current = nextAppState;
      setCurrentState(nextAppState);
    });

    // Web-specific fix for blur/focus events
    if (Platform.OS === 'web') {
      window.addEventListener('focus', () => {
        console.log('[AppState] Window focus event');
        setIsActive(true);
        appState.current = 'active';
        setCurrentState('active');
        setLastActiveTimestamp(Date.now());
      });

      window.addEventListener('blur', () => {
        console.log('[AppState] Window blur event');
        setIsActive(false);
        appState.current = 'background';
        setCurrentState('background');
      });
    }

    return () => {
      subscription.remove();
      
      // Clean up web event listeners
      if (Platform.OS === 'web') {
        window.removeEventListener('focus', () => {});
        window.removeEventListener('blur', () => {});
      }
    };
  }, []);

  return (
    <AppStateContext.Provider value={{ isActive, currentState, lastActiveTimestamp }}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook for consuming the context
export const useAppState = () => useContext(AppStateContext); 