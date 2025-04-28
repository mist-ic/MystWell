import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  InputAccessoryView,
  Animated,
  EmitterSubscription,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme, Snackbar, Surface, Avatar, Button, Divider, List, IconButton, TextInput as PaperTextInput, Modal, Title } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MessageSkeleton } from '@/components/MessageSkeleton';
import { useChatWebSocket, ChatMessage as HookChatMessage, ChatSession } from '@/hooks/useChatWebSocket';

// --- Renamed local interface to avoid conflict with imported type ---
interface DisplayMessage extends HookChatMessage {
  // Add any UI-specific properties if needed later
  // For now, it matches the hook's type
  status?: 'sending' | 'error' | 'sent'; // Keep UI status for user messages
}

const INPUT_HEIGHT = 56;
const INPUT_CONTAINER_HEIGHT = Platform.OS === 'ios' ? 80 : 64;

// Typing Indicator component - can be enhanced to use hook state
const TypingIndicator = () => {
  const theme = useTheme();
  // For now, keep simple animation. Could connect to hook's loading state later.
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev < 3 ? prev + 1 : 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.typingContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        Mist is typing{dots === 1 ? '.' : dots === 2 ? '..' : '...'}
      </Text>
    </View>
  );
};

// Message Timestamp component
const MessageTime = ({ timestamp }: { timestamp: string }) => { // Expect ISO string now
  const theme = useTheme();
  // Use timestamp directly if it's already formatted, or parse if needed
  // Assuming ISO string, let's format it
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Text style={[styles.timeText, { color: theme.colors.onSurfaceVariant }]}>
      {time}
    </Text>
  );
};

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // --- Chat Hook ---
  const {
    sessions,           // List of available sessions
    activeSessionId,    // ID of the currently active session
    setActiveSession, // Function to switch active session
    createSession,      // Function to create a new session
    messages,           // Messages for the active session
    isConnected,
    isLoading: isLoadingChat, // Combined loading state from hook
    error: chatError,        // Error state from hook
    sendMessage,         // Renamed function from hook
  } = useChatWebSocket();

  // --- UI State ---
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [uiError, setUiError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const inputHeightRef = useRef(new Animated.Value(INPUT_HEIGHT));
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');

  // --- Reinstate themedStyles ---
  const themedStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.surfaceVariant,
    },
    content: {
      backgroundColor: theme.colors.background,
    },
    userMessageContent: {
      backgroundColor: theme.colors.primary,
    },
    aiMessageContent: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    userMessageText: {
      color: theme.colors.onPrimary,
    },
    aiMessageText: {
      color: theme.colors.onSurfaceVariant,
    },
    errorMessage: {
      borderColor: theme.colors.error,
    },
    retryText: {
      color: theme.colors.error,
    },
    bottomContainer: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.surfaceVariant,
    },
    input: {
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.surfaceVariant,
    },
    inputAccessory: {
      backgroundColor: theme.colors.surfaceVariant,
      borderTopColor: theme.colors.outlineVariant,
    },
    doneButton: {
      color: theme.colors.primary,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
    },
  };

  // --- Derived State ---
  const displayMessages: DisplayMessage[] = messages.map(msg => ({
      ...msg,
      status: 'sent' 
  }));
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // --- Effects ---

  // Handle chat hook errors
  useEffect(() => {
    if (chatError) {
      setUiError(chatError);
      setSnackbarVisible(true);
    } 
    // Don't clear uiError here automatically, let user dismiss snackbar
  }, [chatError]);

  // Mock Typing Indicator (remains the same)
  useEffect(() => {
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if(lastMessage.sender === 'user' && !isTyping) {
            setIsTyping(true);
            const timer = setTimeout(() => setIsTyping(false), 1500);
            return () => clearTimeout(timer);
        } else if (lastMessage.sender === 'bot' && isTyping) {
            setIsTyping(false);
        }
    }
  }, [messages, isTyping]);

  // Keyboard handling (remains the same)
  useEffect(() => {
    let keyboardWillShowListener: EmitterSubscription;
    let keyboardWillHideListener: EmitterSubscription;
    let keyboardDidShowListener: EmitterSubscription;
    let keyboardDidHideListener: EmitterSubscription;

    if (Platform.OS === 'ios') {
      keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
      });
    } else {
      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });
    }

    return () => {
      if (Platform.OS === 'ios') {
        keyboardWillShowListener?.remove();
        keyboardWillHideListener?.remove();
      } else {
        keyboardDidShowListener?.remove();
        keyboardDidHideListener?.remove();
      }
    };
  }, []);

  // Scroll to end (remains the same)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, keyboardHeight]);

  // --- Handlers ---

  const handleSendMessage = () => {
    const messageText = input.trim();
    if (!messageText) return;
    if (!isConnected || !activeSessionId) {
        setUiError(activeSessionId ? "Not connected to chat server." : "No chat session selected.");
        setSnackbarVisible(true);
        return;
    }
    setInput('');
    sendMessage(messageText); // Hook now sends to active session
    Animated.timing(inputHeightRef.current, { toValue: INPUT_HEIGHT, duration: 150, useNativeDriver: false }).start();
  };

  const handleSelectSession = (sessionId: string) => {
      setActiveSession(sessionId);
      setSessionModalVisible(false);
  };

  const handleCreateNewSession = () => {
      createSession(newSessionTitle.trim() || undefined); // Pass title or let backend default
      setNewSessionTitle('');
      setSessionModalVisible(false);
  };

  // --- Render Functions ---

  const renderMessage = ({ item: message }: { item: DisplayMessage }) => {
    const isUser = message.sender === 'user';
    const showAvatar = !isUser && (messages.findIndex(m => m.id === message.id) === 0 || messages[messages.findIndex(m => m.id === message.id) - 1]?.sender === 'user');

    return (
      <View style={[
        styles.messageRow,
        isUser ? styles.userMessageRow : styles.aiMessageRow
      ]}>
        {!isUser && (
            <Avatar.Image
              size={28}
              source={require('@/assets/images/icon.png')} // Replace with your Mist avatar path
              style={[styles.avatar, showAvatar ? {} : { opacity: 0 }]}
            />
        )}
        <Surface
          style={[
            styles.messageContent,
            isUser ? [styles.userMessageContent, themedStyles.userMessageContent] : [styles.aiMessageContent, themedStyles.aiMessageContent],
            message.status === 'error' ? themedStyles.errorMessage : {},
          ]}
          elevation={1}
        >
          <Text style={isUser ? themedStyles.userMessageText : themedStyles.aiMessageText}>
            {message.text}
          </Text>
          <View style={styles.timeContainer}>
            <MessageTime timestamp={message.timestamp} />
            {/* Add status icons if needed */}
          </View>
          {message.status === 'error' && (
            <TouchableOpacity onPress={() => console.warn("Retry not implemented yet with WS") /* handleRetry(message.id) */}>
              <Text style={[styles.retryText, themedStyles.retryText]}>Retry</Text>
            </TouchableOpacity>
          )}
        </Surface>
         {isUser && (
             <View style={{width: 28}} /> // Spacer to align user messages
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={[styles.emptyContainer, styles.centerAlign]}>
        {isLoadingChat ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : !activeSessionId ? (
            <View style={styles.centerAlign}>
                 <MaterialCommunityIcons name="chat-plus-outline" size={48} color={theme.colors.onSurfaceVariant} style={styles.marginBottom} />
                 <Text style={[styles.emptyText, themedStyles.emptyText, styles.marginBottom]}>
                    No chat selected.
                 </Text>
                 <Button mode="contained" onPress={() => setSessionModalVisible(true)}>Select or Start Chat</Button>
             </View>
        ) : (
            <Text style={[styles.emptyText, themedStyles.emptyText]}>
                Send a message to start chatting with Mist.
            </Text>
        )}
    </View>
  );

  const renderFooter = () => {
    if (isTyping) return <TypingIndicator />;
    if (!isConnected && !isLoadingChat && activeSessionId) {
        return <Text style={styles.connectionStatus}>Disconnected. Trying to reconnect...</Text>;
    }
    return null;
  };

  const renderSessionItem = ({ item }: { item: ChatSession }) => (
      <List.Item
          title={item.title || `Chat from ${new Date(item.created_at).toLocaleDateString()}`}
          description={`Started: ${new Date(item.created_at).toLocaleString()}`}
          left={props => <List.Icon {...props} icon="chat-outline" />}
          onPress={() => handleSelectSession(item.id)}
          style={item.id === activeSessionId ? styles.activeSessionItem : {}}
      />
  );

  const inputAccessoryViewID = 'chatInputAccessory';

  // --- Main Return ---
  return (
    <ErrorBoundary>
      <Surface style={[styles.container, themedStyles.container, { paddingBottom: Platform.OS === 'ios' ? keyboardHeight : 0 }]}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        
        {/* Header with Session Selection */}
        <Surface style={[styles.header, themedStyles.header, { paddingTop: insets.top }]} elevation={2}>
            <View style={styles.headerContent}>
                 <Text style={styles.headerTitle} numberOfLines={1}>
                    {activeSession ? (activeSession.title || 'Chat with Mist') : 'Select Chat'}
                 </Text>
                 <IconButton 
                    icon="chat-plus-outline"
                    size={24}
                    onPress={() => setSessionModalVisible(true)}
                    />
             </View>
        </Surface>

        {/* Chat Message List */}
        <FlatList
          ref={flatListRef}
          data={displayMessages} // Use derived state
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={[styles.content, themedStyles.content]}
          contentContainerStyle={styles.contentContainer}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        />

        {/* Input Area */} 
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} // Use undefined for android to avoid issues
          keyboardVerticalOffset={Platform.OS === 'ios' ? INPUT_CONTAINER_HEIGHT + insets.top + 60 : 0} // Adjust offset based on header
        >
            <Surface 
                style={[styles.bottomContainer, themedStyles.bottomContainer, { paddingBottom: insets.bottom }]} 
                elevation={4}
            >
                <Animated.View style={[styles.inputRow, { height: inputHeightRef.current }]}>
                    <TextInput
                        ref={inputRef}
                        style={[styles.input, themedStyles.input]}
                        value={input}
                        onChangeText={setInput}
                        placeholder={activeSessionId ? "Ask Mist anything..." : "Select a chat first"}
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        multiline
                        onContentSizeChange={(e) => {
                            const newHeight = Math.max(INPUT_HEIGHT, Math.min(e.nativeEvent.contentSize.height, 120)); 
                            Animated.timing(inputHeightRef.current, {
                                toValue: newHeight,
                                duration: 100,
                                useNativeDriver: false,
                            }).start();
                        }}
                        blurOnSubmit={false}
                        onSubmitEditing={handleSendMessage}
                        returnKeyType="send"
                        editable={isConnected && !!activeSessionId && !isLoadingChat} // Enable only if connected and session selected
                        inputAccessoryViewID={inputAccessoryViewID} 
                    />
                    <TouchableOpacity
                        onPress={handleSendMessage}
                        style={styles.sendButtonContainer}
                        disabled={!input.trim() || !isConnected || !activeSessionId || isLoadingChat}
                    >
                        <MaterialCommunityIcons
                        name="send"
                        size={24}
                        color={!input.trim() || !isConnected || !activeSessionId || isLoadingChat ? theme.colors.onSurfaceDisabled : theme.colors.primary}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </Surface>
        </KeyboardAvoidingView>
        
        {/* iOS Keyboard Done Button */}
        {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={inputAccessoryViewID}>
              <View style={[styles.inputAccessory, themedStyles.inputAccessory]}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()}>
                    <Text style={[styles.doneButton, themedStyles.doneButton]}>Done</Text>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
        )}

        {/* Session Selection Modal */}
        <Modal
          onDismiss={() => setSessionModalVisible(false)}
          visible={sessionModalVisible}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Title style={styles.modalTitle}>Chat Sessions</Title>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setSessionModalVisible(false)}
            style={{ position: 'absolute', top: 10, right: 10 }}
          />

          <Divider style={styles.divider} />

          <View style={styles.newSessionInputContainer}>
            <PaperTextInput 
              label="New Chat Title (Optional)"
              value={newSessionTitle}
              onChangeText={setNewSessionTitle}
              mode="outlined"
              dense
              style={styles.modalInput}
            />
            <Button mode="contained" onPress={handleCreateNewSession} style={styles.modalButton} labelStyle={styles.modalButtonLabel}>
              Start New Chat
            </Button>
          </View>
          
          <Text style={styles.modalSubtitle}>Existing Chats</Text>
          {isLoadingChat && !sessions.length ? (
            <ActivityIndicator style={styles.marginTop} />
          ) : sessions.length === 0 ? (
            <Text style={styles.modalEmptyText}>No previous chats found.</Text>
          ) : (
            <FlatList
              data={sessions}
              renderItem={renderSessionItem}
              keyExtractor={(item) => item.id}
              style={styles.sessionList}
            />
          )}
        </Modal>

        {/* Snackbar for Errors */}
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          action={{
            label: 'Dismiss',
            onPress: () => setSnackbarVisible(false),
          }}
          duration={Snackbar.DURATION_MEDIUM}
          style={{ backgroundColor: theme.colors.errorContainer, bottom: insets.bottom + (Platform.OS === 'ios' ? INPUT_CONTAINER_HEIGHT : 60) }} // Adjust bottom position
        >
          <Text style={{ color: theme.colors.onErrorContainer }}>{uiError || "An error occurred"}</Text>
        </Snackbar>
      </Surface>
    </ErrorBoundary>
  );
}

// --- Styles (MERGED and Cleaned) ---
const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginHorizontal: 10,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    marginRight: 8,
    marginBottom: 5,
  },
  messageContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    maxWidth: '80%',
  },
  userMessageContent: {
    borderBottomRightRadius: 4,
  },
  aiMessageContent: {
    borderBottomLeftRadius: 4,
  },
  timeContainer: {
      alignSelf: 'flex-end',
      marginTop: 4,
  },
  timeText: {
      fontSize: 10,
      opacity: 0.7,
  },
  errorMessage: {
    borderWidth: 1,
  },
  retryText: {
      fontSize: 12,
      marginTop: 4,
      fontWeight: 'bold',
      alignSelf: 'flex-end',
  },
  bottomContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 5,
    paddingTop: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: INPUT_HEIGHT,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    marginRight: 10,
  },
  sendButtonContainer: {
    padding: 8,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 18,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  typingAvatar: {
      marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
  },
  centerAlign: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  marginBottom: {
       marginBottom: 16,
  },
  marginTop: {
       marginTop: 16,
  },
  emptyText: {
      textAlign: 'center',
      fontSize: 16,
  },
  inputAccessory: {
      height: 44,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    fontWeight: '600',
    fontSize: 16,
  },
  connectionStatus: {
      textAlign: 'center',
      paddingVertical: 4,
      fontSize: 12,
      fontStyle: 'italic',
      opacity: 0.8,
  },
  modalContainer: {
      padding: 20,
      margin: 20, // Keep margin for spacing from screen edges
      borderRadius: 8,
      maxHeight: '80%',
      // Remove background color here, apply inline instead
      // backgroundColor: theme.colors.surface,
  },
  modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 15,
  },
  modalSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 15,
      marginBottom: 10,
  },
  newSessionInputContainer: {
      marginBottom: 15,
  },
  modalInput: {
      marginBottom: 10,
  },
  modalButton: {
      paddingVertical: 4,
  },
  modalButtonLabel: {
      fontSize: 14,
  },
  divider: {
      marginVertical: 10,
  },
  modalEmptyText: {
      textAlign: 'center',
      marginTop: 20,
      fontStyle: 'italic',
  },
  sessionList: {
      maxHeight: '50%',
  },
  activeSessionItem: {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
