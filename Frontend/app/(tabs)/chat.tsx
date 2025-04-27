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
import { Text, useTheme, Snackbar, Surface, Avatar } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MessageSkeleton } from '@/components/MessageSkeleton';
import { useAuth } from '@/context/auth'; // Import useAuth hook
import { sendMessage as sendChatMessage } from '@/services/chatService'; // Import the API service

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  status?: 'sending' | 'error' | 'sent';
  timestamp: number;
}

const INPUT_HEIGHT = 56;
const INPUT_CONTAINER_HEIGHT = Platform.OS === 'ios' ? 80 : 64;

// Typing Indicator component
const TypingIndicator = () => {
  const theme = useTheme();
  const [dots, setDots] = useState(1);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev < 3 ? prev + 1 : 1);
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <View style={[styles.typingContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
       {/* Add MistWell logo/avatar if desired */}
      {/* <Avatar.Icon size={24} icon="robot" style={styles.typingAvatar} /> */}
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        Mist is typing{dots === 1 ? '.' : dots === 2 ? '..' : '...'}
      </Text>
    </View>
  );
};

// Message Timestamp component
const MessageTime = ({ timestamp }: { timestamp: number }) => {
  const theme = useTheme();
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
  const { session, user } = useAuth(); // Get session from auth context
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // For initial load/refresh
  const [isSending, setIsSending] = useState(false); // Separate state for sending
  const [isTyping, setIsTyping] = useState(false); // AI is typing
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const inputHeightRef = useRef(new Animated.Value(INPUT_HEIGHT));

  // Theme-dependent styles (assuming styles object exists below)
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

  // Load initial message (no history fetching for now)
  useEffect(() => {
    // Keep the initial greeting message
    setMessages([{
      id: "1",
      text: "Hello! I'm Mist, your health assistant. How can I help you today?",
      isUser: false,
      status: 'sent',
      timestamp: Date.now(),
    }]);
    setIsLoadingHistory(false); // No actual loading needed here yet
  }, []);

  // Handle keyboard events (keep existing logic)
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

  // Scroll to end when messages update or keyboard shows/hides
  useEffect(() => {
    if (messages.length > 0) {
      // Timeout ensures layout is complete before scrolling
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, keyboardHeight]);


  const handleSendMessage = async (textToRetry?: string) => {
    const messageText = textToRetry || input.trim();
    if (!messageText) return;

    const tempId = Date.now().toString();
    const newMessage: ChatMessage = {
      id: tempId,
      text: messageText,
      isUser: true,
      status: 'sending',
      timestamp: Date.now(),
    };

    // Clear input only if it wasn't a retry
    if (!textToRetry) {
      setInput('');
    }
    
    // Add user message optimistically
    setMessages(prev => [...prev, newMessage]);
    setIsSending(true);
    setIsTyping(true); // Show AI typing indicator immediately
    setError(null); // Clear previous errors

    try {
      const reply = await sendChatMessage(messageText, session);

      // Update user message status to sent
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, status: 'sent' } : msg
      ));

      // Add AI response
      const aiResponse: ChatMessage = {
        id: Date.now().toString(), // Use different ID for AI response
        text: reply,
        isUser: false,
        status: 'sent',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiResponse]);

    } catch (err: any) {
      console.error("Send message error:", err);
      setError(err.message || 'Failed to send message. Please try again.');
      setSnackbarVisible(true);
      // Update user message status to error
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, status: 'error' } : msg
      ));
    } finally {
      setIsSending(false);
      setIsTyping(false); // Hide AI typing indicator
    }
  };

  const handleRetry = async (messageId: string) => {
    const messageToRetry = messages.find(msg => msg.id === messageId);
    if (messageToRetry && messageToRetry.status === 'error') {
       // Remove the errored message temporarily to avoid duplicates during retry
       setMessages(prev => prev.filter(msg => msg.id !== messageId));
       // Resend the text
       await handleSendMessage(messageToRetry.text); 
    }
  };

  // --- Render Logic ---
  const renderMessage = ({ item: message }: { item: ChatMessage }) => {
    const isUser = message.isUser;
    const messageStyle = isUser ? styles.userMessage : styles.aiMessage;
    const contentStyle = isUser ? themedStyles.userMessageContent : themedStyles.aiMessageContent;
    const textStyle = isUser ? themedStyles.userMessageText : themedStyles.aiMessageText;

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <Avatar.Icon 
            size={32} 
            icon="robot-happy-outline" // Or use a custom Mist avatar
            style={styles.avatar} 
            color={theme.colors.onSurfaceVariant}
            theme={{ colors: { primary: theme.colors.surfaceVariant }}}
          />
        )}
        <Surface style={[styles.messageBubble, messageStyle, contentStyle, message.status === 'error' && themedStyles.errorMessage]} elevation={1}>
          <Text style={[styles.messageText, textStyle]}>{message.text}</Text>
          <View style={styles.messageInfoRow}>
              <MessageTime timestamp={message.timestamp} />
              {isUser && message.status === 'sending' && <ActivityIndicator size="small" color={theme.colors.onPrimary} style={styles.statusIndicator} />}
              {isUser && message.status === 'error' && (
                <TouchableOpacity onPress={() => handleRetry(message.id)} style={styles.retryButton}>
                   <MaterialCommunityIcons name="alert-circle-outline" size={14} color={theme.colors.error} style={styles.statusIndicator} />
                   <Text style={[styles.retryText, themedStyles.retryText]}>Retry</Text>
                </TouchableOpacity>
              )}
           </View>
        </Surface>
        {isUser && (
           <Avatar.Icon 
             size={32} 
             icon="account-circle-outline" // Placeholder user avatar
             style={styles.avatar} 
             color={theme.colors.onPrimary}
             theme={{ colors: { primary: theme.colors.primary }}}
          />
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="message-text-outline" size={64} color={theme.colors.onSurfaceVariant} />
      <Text style={[styles.emptyText, themedStyles.emptyText]}>No messages yet. Start the conversation!</Text>
    </View>
  );

  const renderFooter = () => {
     if (isTyping) {
       return <TypingIndicator />;
     }
     return null;
  };

  // Input Accessory View for iOS keyboard 'Done' button
  const inputAccessoryViewID = 'chatInputAccessory';

  return (
    <ErrorBoundary>
      <Surface style={[styles.container, themedStyles.container, { paddingBottom: Platform.OS === 'ios' ? keyboardHeight : 0 }]}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        {/* Header - Can add profile switching or clear chat later */}
        <Surface style={[styles.header, themedStyles.header, { paddingTop: insets.top }]}>
           <Text style={styles.headerTitle}>Chat with Mist</Text>
        </Surface>

        {isLoadingHistory ? (
          <MessageSkeleton />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={[styles.content, themedStyles.content]}
            contentContainerStyle={styles.contentContainer}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReachedThreshold={0.1}
            // Add RefreshControl if history loading is implemented
            // refreshControl={
            //   <RefreshControl refreshing={isLoadingHistory} onRefresh={loadMessages} />
            // }
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? INPUT_CONTAINER_HEIGHT + insets.bottom : 0}
          style={styles.keyboardAvoidingContainer}
        >
          <Surface 
             style={[styles.bottomContainer, themedStyles.bottomContainer, { paddingBottom: Platform.OS === 'ios' ? 0 : insets.bottom }]} 
             elevation={4}
          >
            <Animated.View style={[styles.inputContainer, { height: inputHeightRef.current }]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, themedStyles.input]}
                value={input}
                onChangeText={setInput}
                placeholder="Ask Mist anything..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline
                onContentSizeChange={(e) => {
                  const height = Math.max(INPUT_HEIGHT, Math.min(e.nativeEvent.contentSize.height, INPUT_HEIGHT * 2));
                  Animated.timing(inputHeightRef.current, {
                    toValue: height,
                    duration: 100,
                    useNativeDriver: false,
                  }).start();
                }}
                blurOnSubmit={false} // Keep keyboard open on send
                onSubmitEditing={() => handleSendMessage()} // Allow sending via keyboard return key
                returnKeyType="send"
                editable={!isSending && !isLoadingHistory} // Disable input while sending/loading
                inputAccessoryViewID={inputAccessoryViewID} // For iOS
              />
              <TouchableOpacity onPress={() => handleSendMessage()} disabled={isSending || !input.trim()} style={styles.sendButtonContainer}>
                {isSending ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <MaterialCommunityIcons 
                    name="send-circle" 
                    size={36} 
                    color={input.trim() ? theme.colors.primary : theme.colors.onSurfaceVariant} 
                   />
                )}
              </TouchableOpacity>
            </Animated.View>
          </Surface>
        </KeyboardAvoidingView>
        
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={inputAccessoryViewID} style={themedStyles.inputAccessory}>
            <View style={styles.accessoryContainer}>
              <TouchableOpacity onPress={Keyboard.dismiss} style={styles.doneButtonWrapper}>
                  <Text style={[styles.doneButton, themedStyles.doneButton]}>Done</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          action={{
            label: 'Dismiss',
            onPress: () => setSnackbarVisible(false),
          }}
          duration={Snackbar.DURATION_MEDIUM}
          style={{ bottom: INPUT_CONTAINER_HEIGHT + insets.bottom + (Platform.OS === 'ios' ? 0 : 10) }} 
        >
          {error}
        </Snackbar>
      </Surface>
    </ErrorBoundary>
  );
}

// --- Styles ---
// (Assuming a large styles object is defined below using StyleSheet.create)
// Make sure styles like typingContainer, typingAvatar, timeText, messageRow, 
// userRow, aiRow, avatar, messageBubble, userMessage, aiMessage,
// messageInfoRow, statusIndicator, retryButton, retryText, emptyContainer, emptyText,
// container, header, headerTitle, content, contentContainer, bottomContainer, 
// inputContainer, input, sendButtonContainer, keyboardAvoidingContainer, 
// accessoryContainer, doneButtonWrapper, doneButton exist.

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60, // Adjust as needed
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10, // Ensure header is above content
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 10,
    paddingBottom: 10, // Add padding to bottom
    paddingHorizontal: 10,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    marginHorizontal: 5,
    marginBottom: 5, // Align with bottom of bubble
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  userMessage: {
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end', // Align time/status to the right
  },
  timeText: {
    fontSize: 11,
    marginLeft: 8,
    opacity: 0.8,
  },
  statusIndicator: {
    marginLeft: 5,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
    padding: 2, // Make it easier to tap
  },
  retryText: {
    fontSize: 11,
    marginLeft: 3,
    fontWeight: 'bold',
  },
  keyboardAvoidingContainer: {
    // No specific styles needed here usually, it just wraps
  },
  bottomContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8, // Padding handled by SafeAreaInsets usually
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: INPUT_HEIGHT,
    maxHeight: INPUT_HEIGHT * 2,
    borderRadius: INPUT_HEIGHT / 2,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    marginRight: 10,
    textAlignVertical: 'top', // Align text top on Android multiline
    paddingTop: Platform.OS === 'ios' ? 10 : 12, // Adjust padding for vertical centering
  },
  sendButtonContainer: {
    padding: 5, // Add padding for easier tap target
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    marginHorizontal: 10,
    marginLeft: 10 + 32 + 5, // Align with AI message bubble (avatar + margin)
    marginBottom: 15,
    minWidth: 60, // Minimum width for the indicator
  },
  typingAvatar: {
      marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  // Styles for InputAccessoryView (iOS)
  accessoryContainer: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButtonWrapper: {
     padding: 5, // Easier tap target
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
  },
});
