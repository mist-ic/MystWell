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
import { sendMessageToMist } from '@/services/chatService';

// Define Interfaces
interface ApiChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  status?: 'sending' | 'error' | 'sent';
  timestamp: number;
}

// Constants
const INPUT_HEIGHT = 56;
const INPUT_CONTAINER_HEIGHT = Platform.OS === 'ios' ? 80 : 64;

// Styles (Moved before the component function)
const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    width: '100%',
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    marginHorizontal: 4,
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sendingMessage: {
    opacity: 0.7,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    marginRight: 8,
    textAlignVertical: 'center',
    maxHeight: 120,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginBottom: 4,
  },
  sendButton: {
    padding: 4,
  },
  sendButtonDisabled: {
    opacity: 0.7,
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
    fontSize: 17,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  typingContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  bottomContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  userMessage: {
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  aiMessage: {
    borderBottomLeftRadius: 4,
    marginRight: 'auto',
  },
  timeText: {
    fontSize: 10,
    marginLeft: 'auto',
  },
  retryText: {
    fontSize: 10,
    textDecorationLine: 'underline',
  },
  listContentContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
});

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
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {dots === 1 ? '.' : dots === 2 ? '..' : '...'}
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

// Main Component
export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const inputHeightRef = useRef(new Animated.Value(INPUT_HEIGHT));

  // Theme-dependent styles
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

  // Load initial messages
  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setMessages([{
          id: "1",
          text: "Hello! I'm MystBuddy, your health assistant. How can I help you today?",
          isUser: false,
          status: 'sent',
          timestamp: Date.now(),
        }]);
      } catch (err) {
        setError('Failed to load messages. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialMessages();
  }, []);

  // Handle keyboard events
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

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fetch messages implementation
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Failed to load messages');
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      setError('Failed to load messages. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to format UI messages for the backend API
  const formatHistoryForApi = (history: ChatMessage[]): ApiChatMessage[] => {
    return history
      // Filter out any messages that failed or are currently sending/retrying
      .filter(msg => msg.status === 'sent')
      // Map to the API format
      .map(msg => ({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));
  };

  const handleSendMessage = async (text: string, isRetry = false, messageToRetry?: ChatMessage) => {
    const messageText = isRetry && messageToRetry ? messageToRetry.text : text;
    if (!messageText.trim()) return;

    let userMessage: ChatMessage;
    let historyForApi: ApiChatMessage[];

    if (isRetry && messageToRetry) {
      // If retrying, update the status of the existing message
      userMessage = { ...messageToRetry, status: 'sending' };
      setMessages(prev =>
        prev.map(msg => (msg.id === messageToRetry.id ? userMessage : msg))
      );
      setRetryingMessageId(messageToRetry.id); // Indicate retry in progress

      // Prepare history *up to* the message being retried
      const retryIndex = messages.findIndex(msg => msg.id === messageToRetry.id);
      // Ensure index is valid before slicing
      historyForApi = retryIndex > -1 ? formatHistoryForApi(messages.slice(0, retryIndex)) : [];

    } else {
      // If sending a new message
      setInput(''); // Clear input only for new messages
      const tempId = Date.now().toString();
      userMessage = {
        id: tempId,
        text: messageText,
        isUser: true,
        status: 'sending', // Start as sending
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Prepare history including all previous messages *before* this new one
      historyForApi = formatHistoryForApi(messages);
    }

    // Scroll immediately after adding user message or setting retry status
    flatListRef.current?.scrollToEnd({ animated: true });
    setIsTyping(true); // Show AI thinking indicator
    setError(null); // Clear previous errors

    try {
      // Call the backend service
      const aiResponseText = await sendMessageToMist(messageText, historyForApi);

      // Update user message status to 'sent' on success
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
        )
      );

      // Add the AI response
      const aiResponse: ChatMessage = {
        id: Date.now().toString() + '-ai',
        text: aiResponseText,
        isUser: false,
        status: 'sent',
        timestamp: Date.now(),
      };
      // Use functional update to ensure we add to the latest state
      setMessages(prev => [...prev, aiResponse]);

    } catch (err: any) {
      console.error("Error sending/receiving chat message:", err);
      setError(err.message || 'Failed to get response from Mist.');
      // Update user message status to 'error' on failure
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
        )
      );
    } finally {
      setIsTyping(false); // Hide AI thinking indicator
      if (isRetry) {
        setRetryingMessageId(null); // Clear retry indicator
      }
      // Ensure scroll to end after potential state updates and AI response
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleRetry = (messageId: string) => {
    const messageToRetry = messages.find(msg => msg.id === messageId);
    if (messageToRetry && retryingMessageId !== messageId) { // Prevent double retry
      handleSendMessage('', true, messageToRetry); // Pass retry flag and message
    }
  };

  // Render individual message
  const renderMessage = ({ item: message }: { item: ChatMessage }) => {
    const isUser = message.isUser;
    const messageStyle = isUser ? styles.userMessage : styles.aiMessage;
    const contentStyle = isUser
      ? themedStyles.userMessageContent
      : themedStyles.aiMessageContent;
    const textStyle = isUser ? themedStyles.userMessageText : themedStyles.aiMessageText;

    const isSending = message.status === 'sending';
    const isError = message.status === 'error';
    const isRetrying = isSending && retryingMessageId === message.id;

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
         {!isUser && <Avatar.Icon size={32} icon="robot-happy-outline" style={styles.avatar} />}
        <Surface
          style={[
            styles.messageBubble,
            messageStyle,
            contentStyle,
            isError && themedStyles.errorMessage,
            // Dim slightly if sending, more if retrying *another* message
            isSending && styles.sendingMessage,
          ]}
          elevation={1}
        >
          <Text style={[styles.messageText, textStyle]}>{message.text}</Text>
          <View style={styles.messageInfo}>
             {/* Show spinner only if this specific message is sending/retrying */}
             {(isSending) && (
                 <ActivityIndicator
                   size="small"
                   color={isUser ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                   style={styles.statusIndicator}
                 />
             )}
             {/* Show retry button only if error and not currently retrying */}
             {isError && retryingMessageId !== message.id && (
                <TouchableOpacity onPress={() => handleRetry(message.id)} style={styles.retryButton}>
                     <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} style={styles.statusIndicator} />
                     <Text style={[styles.retryText, themedStyles.retryText]}>Retry</Text>
                 </TouchableOpacity>
             )}
             {/* Show timestamp only if sent successfully */}
             {message.status === 'sent' && <MessageTime timestamp={message.timestamp} />}
           </View>
        </Surface>
         {isUser && <Avatar.Icon size={32} icon="account-circle-outline" style={styles.avatar} />}
      </View>
    );
  };

  const handleInputSizeChange = useCallback((event: { nativeEvent: { contentSize: { height: number } } }) => {
    const { height } = event.nativeEvent.contentSize;
    const newHeight = Math.min(Math.max(INPUT_HEIGHT, height), INPUT_HEIGHT * 3);
    Animated.timing(inputHeightRef.current, {
      toValue: newHeight,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, []);

  const inputAccessoryViewID = 'uniqueID';

  const renderInputAccessory = useCallback(() => {
    if (Platform.OS !== 'ios') return null;

    return (
      <InputAccessoryView nativeID={inputAccessoryViewID}>
        <View style={[styles.inputAccessory, themedStyles.inputAccessory]}>
          <TouchableOpacity onPress={() => Keyboard.dismiss()}>
            <Text style={themedStyles.doneButton}>Done</Text>
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    );
  }, []);

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    return (
      <View style={[styles.messageRow, styles.aiRow]}>
        <Avatar.Icon size={32} icon="robot-happy-outline" style={styles.avatar} />
        <Surface style={[styles.messageBubble, styles.aiMessage, themedStyles.aiMessageContent]} elevation={1}>
            <TypingIndicator />
        </Surface>
      </View>
    );
  };

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <MessageSkeleton />
          <MessageSkeleton isUser />
        </View>
      );
    }
    // Check if only the initial greeting message exists
    if (messages.length <= 1 && messages[0]?.id === 'initial-greeting') {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chat-question-outline" size={64} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, themedStyles.emptyText]}>Ask Mist anything health-related!</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <ErrorBoundary>
      <View style={[styles.flexOne, themedStyles.container]}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        
        {/* Header */}
        <Surface style={[styles.header, themedStyles.header]} elevation={2}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.headerButton}
              accessible={true}
              accessibilityLabel="Menu"
              accessibilityHint="Opens the navigation menu"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="menu" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
            
            <View style={styles.headerTitleContainer}>
              <Avatar.Icon 
                size={32} 
                icon="robot" 
                color={theme.colors.onPrimary}
                style={{ backgroundColor: theme.colors.primary, marginRight: 8 }} 
              />
              <Text 
                style={[styles.headerTitle, { color: theme.colors.onSurface }]}
                accessibilityRole="header"
              >
                MystBuddy
              </Text>
              <View style={[styles.statusIndicator, { backgroundColor: theme.colors.primary }]} />
            </View>
            
            <TouchableOpacity 
              style={styles.headerButton}
              accessible={true}
              accessibilityLabel="More options"
              accessibilityHint="Shows additional chat options"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
        </Surface>
        
        {/* Error Snackbar */}
        {error && (
          <Snackbar
            visible={!!error}
            onDismiss={() => setError(null)}
            action={{
              label: 'Retry',
              onPress: loadMessages,
            }}
          >
            {error}
          </Snackbar>
        )}
        
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadMessages}
              colors={[theme.colors.primary]}
            />
          }
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          style={[styles.flexOne, themedStyles.content]}
          contentContainerStyle={styles.listContentContainer}
        />
        
        {renderTypingIndicator()}
        
        {/* Input Area */}
        <Surface style={[styles.bottomContainer, themedStyles.bottomContainer]} elevation={4}>
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={[styles.input, themedStyles.input]}
                value={input}
                onChangeText={setInput}
                placeholder="Ask MystBuddy..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage(input)}
                blurOnSubmit={false}
                onContentSizeChange={handleInputSizeChange}
                inputAccessoryViewID={inputAccessoryViewID}
                editable={!isLoading}
                accessible={true}
                accessibilityLabel="Message input"
                accessibilityHint="Type your message here"
                accessibilityRole="search"
              />
              
              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  accessible={true}
                  accessibilityLabel="Start voice input"
                  accessibilityHint="Record your message using voice"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons 
                    name="microphone" 
                    size={24} 
                    color={theme.colors.onSurfaceVariant} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sendButton,
                    !input.trim() && styles.sendButtonDisabled,
                    { backgroundColor: input.trim() ? theme.colors.primary : theme.colors.surfaceVariant }
                  ]}
                  onPress={() => handleSendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  accessible={true}
                  accessibilityLabel="Send message"
                  accessibilityHint={!input.trim() ? "Type a message first" : "Send your message"}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !input.trim() || isLoading }}
                >
                  <MaterialCommunityIcons 
                    name="send" 
                    size={20} 
                    color={input.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Surface>
        
        {renderInputAccessory()}
      </View>
    </ErrorBoundary>
  );
} 