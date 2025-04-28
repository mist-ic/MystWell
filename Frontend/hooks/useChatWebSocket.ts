import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Alert, Platform } from 'react-native';

// Structure for a Chat Session (matching backend)
export interface ChatSession {
    id: string;
    profile_id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
}

// Frontend message structure (remains the same)
export interface ChatMessage {
  id: string; 
  sender: 'user' | 'bot';
  text: string;
  timestamp: string; 
}

// Type for message received from backend
interface ReceivedMessageData {
    sessionId: string;
    sender: string;
    text: string;
    timestamp: string;
}

// Type for history received from backend
interface ChatHistoryData {
    sessionId: string;
    history: { sender: string, text: string, timestamp: string }[];
}

// Hardcoded production WebSocket URL
const WEBSOCKET_URL = 'REDACTED_WS_URL';
const CHAT_HISTORY_STORAGE_KEY_PREFIX = 'chatHistory_'; // Prefix for session-specific history
const LAST_ACTIVE_SESSION_KEY = 'lastActiveSessionId';

export const useChatWebSocket = () => {
  const { session, profile } = useAuth(); // Assuming profile is also available in AuthContext
  
  // State for multiple sessions
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // State for the active session's messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Separate loading for history
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const appState = useRef(AppState.currentState);

  const getHistoryStorageKey = (sessionId: string | null) => sessionId ? `${CHAT_HISTORY_STORAGE_KEY_PREFIX}${sessionId}` : null;

  // --- History Management (Per Session) --- 
  const loadHistory = useCallback(async (sessionId: string | null) => {
      if (!sessionId) {
          setMessages([]);
          setIsLoadingHistory(false);
          return;
      }
      setIsLoadingHistory(true);
      const storageKey = getHistoryStorageKey(sessionId);
      if (!storageKey) return; // Should not happen if sessionId is valid

      try {
          const storedHistory = await AsyncStorage.getItem(storageKey);
          if (storedHistory) {
              const parsedHistory: ChatMessage[] = JSON.parse(storedHistory);
              setMessages(parsedHistory);
          } else {
              // History not found locally, request from backend
              console.log(`Requesting history for session ${sessionId} from backend...`);
              socketRef.current?.emit('getHistory', { sessionId });
              // Set messages to empty while waiting, loading state is already true
              setMessages([]); 
          }
          setError(null);
      } catch (e) {
          console.error(`Failed to load chat history for session ${sessionId}:`, e);
          setError(`Failed to load chat for session ${sessionId}.`);
          setMessages([]);
      } finally {
          // Loading state will be set to false when history arrives from backend or here if local
          // setIsLoadingHistory(false); 
      }
  }, []);

  const saveHistory = useCallback(async (sessionId: string | null, currentMessages: ChatMessage[]) => {
      if (!sessionId) return;
      const storageKey = getHistoryStorageKey(sessionId);
      if (!storageKey) return;

      try {
          const limitedHistory = currentMessages.slice(-50); 
          await AsyncStorage.setItem(storageKey, JSON.stringify(limitedHistory));
      } catch (e) {
          console.error(`Failed to save chat history for session ${sessionId}:`, e);
      }
  }, []);

  // --- Session Switching --- 
  const switchActiveSession = useCallback(async (sessionId: string | null) => {
      if (sessionId === activeSessionId) return; // No change

      console.log(`Switching active session to: ${sessionId}`);
      setActiveSessionId(sessionId);
      setMessages([]); // Clear messages when switching
      setIsLoadingHistory(true); // Show loading for new session history
      
      if (sessionId) {
        await AsyncStorage.setItem(LAST_ACTIVE_SESSION_KEY, sessionId);
        await loadHistory(sessionId); // Load history for the new session
      } else {
        await AsyncStorage.removeItem(LAST_ACTIVE_SESSION_KEY);
        setIsLoadingHistory(false);
      }
  }, [activeSessionId, loadHistory]);

  // --- WebSocket Connection & Session Setup --- 
  useEffect(() => {
    if (!session?.access_token || !profile?.id) { // Need profile ID for session management
      console.log('useChatWebSocket: No session or profile ID, skipping WebSocket connection.');
      if (socketRef.current) {
          socketRef.current.disconnect();
      }
      setIsLoadingSessions(false);
      setIsLoadingHistory(false);
      setMessages([]);
      setChatSessions([]);
      setActiveSessionId(null);
      return; 
    }

    // Prevent creating duplicate connections
    if (socketRef.current?.connected) {
      console.log('Socket already connected, skipping connection setup');
      return;
    }

    console.log('useChatWebSocket: Attempting WS connection...');
    setError(null);
    setIsLoadingSessions(true);

    const socket = io(WEBSOCKET_URL, {
      auth: { token: session.access_token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // On web, use a longer timeout to handle background/foreground transitions better
      timeout: Platform.OS === 'web' ? 20000 : 10000,
    });
    socketRef.current = socket;

    // Web-specific: Setup periodic connection check
    let connectionCheckInterval: NodeJS.Timeout | null = null;
    if (Platform.OS === 'web') {
      connectionCheckInterval = setInterval(() => {
        if (socketRef.current && !socketRef.current.connected && session?.access_token) {
          console.log('Web reconnection check: Socket disconnected, attempting to reconnect...');
          socketRef.current.connect();
        }
      }, 10000); // Check every 10 seconds
    }

    // --- Event Listeners ---
    socket.on('connect', async () => {
      console.log('useChatWebSocket: Connected! Socket ID:', socket.id);
      setIsConnected(true);
      setError(null);
      // Request session list upon connection
      console.log('Requesting session list...');
      socket.emit('listSessions'); 
      setIsLoadingSessions(true); // Indicate we are loading sessions

      // Load last active session ID
      const lastSessionId = await AsyncStorage.getItem(LAST_ACTIVE_SESSION_KEY);
      if (lastSessionId && lastSessionId !== activeSessionId) {
          console.log('Restoring last active session:', lastSessionId);
          // Setting activeSessionId here, history will be loaded via 'sessionList' or 'chatHistory' event
          setActiveSessionId(lastSessionId); 
          // Don't call switchActiveSession here to avoid duplicate history load if triggered by sessionList
      } else if (!activeSessionId) {
           // If no last session and no active session, set loading false (might auto-create later)
           setIsLoadingHistory(false); 
      } else if (activeSessionId) {
          // If we already have an active session ID (reconnection case), request history for it
          console.log('Reconnected with active session, requesting history:', activeSessionId);
          setIsLoadingHistory(true);
          socket.emit('getHistory', { sessionId: activeSessionId });
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log('useChatWebSocket: Disconnected. Reason:', reason);
      setIsConnected(false);
      setError(reason === 'io server disconnect' ? "Connection closed by server." : "Disconnected");
    });

    socket.on('connect_error', (err: Error) => {
      console.error('useChatWebSocket: Connection Error:', err.message);
      setIsConnected(false);
      setError(`Connection failed: ${err.message}.`);
      setIsLoadingSessions(false);
      setIsLoadingHistory(false);
    });

    socket.on('sessionList', (response: { sessions: ChatSession[] }) => {
      console.log('Received session list:', response.sessions.map(s => s.id));
      setIsLoadingSessions(false);
      
      // Save the sessions from server
      setChatSessions(response.sessions);
      
      // If we have an activeSessionId, check if it exists in the returned sessions
      if (activeSessionId) {
        const sessionExists = response.sessions.some(session => session.id === activeSessionId);
        if (sessionExists) {
          // Current active session still exists on server
          // On reconnect, we should always reload history to ensure consistency
          if (!messages.length || !isLoadingHistory) {
            console.log('Reconnection detected or no messages loaded, requesting history for active session:', activeSessionId);
            loadHistory(activeSessionId);
          }
        } else {
          // Active session doesn't exist on server anymore
          console.warn('Active session not found in session list:', activeSessionId);
          // Reset the active session and try to find an alternative
          setActiveSessionId('');
          
          // Try to restore last used session from storage
          AsyncStorage.getItem(LAST_ACTIVE_SESSION_KEY).then(id => {
            const lastSessionExists = id && response.sessions.some(s => s.id === id);
            if (lastSessionExists && id) {
              console.log('Setting active session from storage:', id);
              switchActiveSession(id);
            } else if (response.sessions.length > 0) {
              // Fallback to the most recent session
              const mostRecentSession = response.sessions[0];
              console.log('Setting active session to most recent:', mostRecentSession.id);
              switchActiveSession(mostRecentSession.id);
            }
          });
        }
      } else if (response.sessions.length > 0) {
        // No active session but we have sessions, try to restore from storage
        AsyncStorage.getItem(LAST_ACTIVE_SESSION_KEY).then(id => {
          const lastSessionExists = id && response.sessions.some(s => s.id === id);
          if (lastSessionExists && id) {
            console.log('Setting active session from storage:', id);
            switchActiveSession(id);
          } else {
            // Fallback to the most recent session
            const mostRecentSession = response.sessions[0];
            console.log('Setting active session to most recent:', mostRecentSession.id);
            switchActiveSession(mostRecentSession.id);
          }
        });
      } else {
        // No sessions at all, ensure we're not loading anything
        setIsLoadingHistory(false);
      }
    });

    socket.on('sessionCreated', (data: { session: ChatSession }) => {
        console.log('New session created:', data.session.id);
        setChatSessions(prev => [data.session, ...prev]); // Add to list (assuming sort order)
        switchActiveSession(data.session.id); // Switch to the new session immediately
    });

    socket.on('receiveMessage', (message: ReceivedMessageData) => {
        // Only add message if it belongs to the currently active session
        if (message.sessionId === activeSessionId) {
            console.log('useChatWebSocket: Message received for active session:', message.text);
            const newMessage: ChatMessage = {
                id: `bot-${message.timestamp}-${Math.random()}`,
                sender: 'bot', // Always set as bot since this is the message from the server
                text: message.text,
                timestamp: message.timestamp,
            };
            setMessages((prevMessages) => {
                const updatedMessages = [...prevMessages, newMessage];
                saveHistory(activeSessionId, updatedMessages); // Save history for the active session
                return updatedMessages;
            });
        } else {
             console.log(`Received message for inactive session ${message.sessionId}, ignoring for UI.`);
             // Optional: update history for inactive session in background?
             // saveHistory(message.sessionId, [newMessage]); // This needs fetching existing history first
        }
    });

    socket.on('chatHistory', (data: ChatHistoryData) => {
        // Only update messages if the history belongs to the active session
        if (data.sessionId === activeSessionId) {
            console.log(`Received ${data.history.length} history messages for active session ${data.sessionId}.`);
            const formattedHistory: ChatMessage[] = data.history.map((msg, index) => {
                // Fix message sender identification - ensure 'model', 'bot', 'assistant' or 'ai' are all recognized as bot messages
                const isBotMessage = ['model', 'bot', 'assistant', 'ai'].includes(msg.sender.toLowerCase());
                return {
                    id: `${msg.sender}-${msg.timestamp}-${index}`,
                    sender: isBotMessage ? 'bot' : 'user',
                    text: msg.text,
                    timestamp: msg.timestamp,
                };
            });
            setMessages(formattedHistory);
            saveHistory(activeSessionId, formattedHistory);
            setIsLoadingHistory(false); // Stop loading history for the active session
        } else {
             console.log(`Received history for inactive session ${data.sessionId}, storing locally.`);
             // Save history for inactive session locally without updating UI
             const formattedHistory: ChatMessage[] = data.history.map((msg, index) => {
                // Fix message sender identification - ensure 'model', 'bot', 'assistant' or 'ai' are all recognized as bot messages
                const isBotMessage = ['model', 'bot', 'assistant', 'ai'].includes(msg.sender.toLowerCase());
                return {
                    id: `${msg.sender}-${msg.timestamp}-${index}`,
                    sender: isBotMessage ? 'bot' : 'user',
                    text: msg.text,
                    timestamp: msg.timestamp,
                };
            });
             saveHistory(data.sessionId, formattedHistory);
        }
    });

    socket.on('error', (errorData: { message: string }) => {
        console.error('useChatWebSocket: Server Error:', errorData.message);
        setError(`Server error: ${errorData.message}`);
        // Potentially stop loading states on critical errors
        // setIsLoadingSessions(false);
        // setIsLoadingHistory(false);
    });

    // --- App State Handling --- 
    const subscription = AppState.addEventListener('change', nextAppState => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            console.log('App has come to the foreground!');
            // Reconnect if disconnected when coming to foreground
            if (!socketRef.current?.connected && session?.access_token) {
                console.log('Attempting to reconnect socket...');
                socketRef.current?.connect();
                
                // After reconnection, request sessions list again to ensure we're up to date
                socketRef.current?.emit('listSessions');
            }
        }
        if (nextAppState.match(/inactive|background/)){
            console.log('App has gone to the background!');
            // Don't disconnect on background - this prevents reconnection issues on web
            // socketRef.current?.disconnect(); 
        }
        appState.current = nextAppState;
    });

    // --- Cleanup --- 
    return () => {
      console.log('useChatWebSocket: Cleaning up WebSocket connection.');
      
      // Check if socket still exists before cleaning up
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.off('sessionList');
        socketRef.current.off('sessionCreated');
        socketRef.current.off('receiveMessage');
        socketRef.current.off('chatHistory');
        socketRef.current.off('error');
        socketRef.current.disconnect();
      }
      
      // Clear web connection check interval if it exists
      if (Platform.OS === 'web' && connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      
      socketRef.current = null;
      subscription.remove();
    };
  // Rerun effect if session or profile ID changes - removing activeSessionId to prevent unnecessary reconnects
  }, [session, profile?.id, loadHistory, saveHistory, switchActiveSession]); 

  // --- Actions --- 

  const sendMessageToActiveSession = useCallback((messageText: string) => {
    if (!socketRef.current || !isConnected) {
      setError('Not connected to chat server.');
      Alert.alert("Error", "Not connected to chat server.");
      return;
    }
    if (!activeSessionId) {
        setError('No active chat session selected.');
        Alert.alert("Error", "No active chat session selected.");
        return;
    }
    if (!messageText.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${new Date().toISOString()}-${Math.random()}`, 
      sender: 'user',
      text: messageText,
      timestamp: new Date().toISOString(),
    };

    // Add user message immediately to the active session's UI
    setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, userMessage];
        saveHistory(activeSessionId, updatedMessages); // Save history for the active session
        return updatedMessages;
    });

    // Emit the message to the backend with the active session ID
    socketRef.current.emit('sendMessage', { sessionId: activeSessionId, message: messageText });
    console.log(`useChatWebSocket: Message sent to server for session ${activeSessionId}:`, messageText);
    
  }, [isConnected, activeSessionId, saveHistory]);

  const createNewSession = useCallback((title?: string) => {
       if (!socketRef.current || !isConnected) {
            setError('Not connected to chat server.');
            Alert.alert("Error", "Not connected to chat server.");
            return;
        }
        console.log("Requesting new session creation...");
        socketRef.current.emit('createSession', { title });
  }, [isConnected]);

  // Expose session state and actions
  return {
    sessions: chatSessions,
    activeSessionId,
    setActiveSession: switchActiveSession, // Renamed for clarity
    createSession: createNewSession,
    messages, // Messages for the active session
    isConnected,
    isLoading: isLoadingSessions || isLoadingHistory, // Combined loading state
    error,
    sendMessage: sendMessageToActiveSession, // Renamed for clarity
  };
}; 