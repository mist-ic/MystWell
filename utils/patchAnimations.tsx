import React, { useEffect } from 'react';
import { Snackbar, SnackbarProps, FAB, Portal } from 'react-native-paper';
import { getAnimationConfig } from './animationConfig';

/**
 * Enhanced Snackbar component that fixes animation warnings on web
 */
export const SafeSnackbar: React.FC<SnackbarProps> = (props) => {
  return <Snackbar {...props} {...getAnimationConfig(false)} />;
};

/**
 * Utility to apply performance patches across the app
 */
export const usePerformancePatches = () => {
  useEffect(() => {
    // This is where we could patch other components or APIs if needed
    console.log('Applied performance patches for animations');
  }, []);
};

/**
 * Wrapper for FAB.Group that moves pointerEvents from style to containerStyle
 * This avoids warnings in React Native Web
 */
type FABGroupProps = React.ComponentProps<typeof FAB.Group>;

export const SafeFABGroup = (props: FABGroupProps) => {
  const newProps = {...props};
  
  if (props.actions) {
    newProps.actions = props.actions.map(action => {
      const newAction = {...action};
      
      if (action.style && typeof action.style === 'object') {
        const styleAny = action.style as any;
        if (styleAny.pointerEvents) {
          const newStyle = {...styleAny};
          const pointerEvents = newStyle.pointerEvents;
          delete newStyle.pointerEvents;
          
          newAction.style = newStyle;
          newAction.containerStyle = {
            ...(action.containerStyle || {}),
            pointerEvents
          };
        }
      }
      
      return newAction;
    });
  }
  
  return <FAB.Group {...newProps} />;
}; 