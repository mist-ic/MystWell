import React, { createContext, useContext, useState, useEffect } from 'react';

type DocumentModalContextType = {
  showAddDocumentModal: () => void;
};

const DocumentModalContext = createContext<DocumentModalContextType | undefined>(undefined);

export function DocumentModalProvider({ children }: { children: React.ReactNode }) {
  const [shouldShowModal, setShouldShowModal] = useState(false);
  
  // Global function to show the document modal
  const showAddDocumentModal = () => {
    setShouldShowModal(true);
  };
  
  // Function to listen for the modal state
  const getModalState = () => {
    const state = shouldShowModal;
    // Reset the flag once consumed
    if (state) {
      setShouldShowModal(false);
    }
    return state;
  };

  // Use useEffect to set up the global state instead of inline JSX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore - Adding property to window
      window.__documentModalState = { getModalState };
    }
    
    return () => {
      // Clean up on unmount
      if (typeof window !== 'undefined') {
        // @ts-ignore - Removing property from window
        delete window.__documentModalState;
      }
    };
  }, [shouldShowModal]); // Re-run when the modal state changes

  return (
    <DocumentModalContext.Provider value={{ showAddDocumentModal }}>
      {children}
    </DocumentModalContext.Provider>
  );
}

export function useDocumentModal() {
  const context = useContext(DocumentModalContext);
  if (context === undefined) {
    throw new Error('useDocumentModal must be used within a DocumentModalProvider');
  }
  return context;
}

// Helper function to check modal state from any component
export function checkShouldShowDocumentModal() {
  if (typeof window !== 'undefined' && 
      // @ts-ignore - Accessing property from window
      window.__documentModalState && 
      // @ts-ignore - Accessing property from window
      typeof window.__documentModalState.getModalState === 'function') {
    // @ts-ignore - Accessing property from window
    return window.__documentModalState.getModalState();
  }
  return false;
} 