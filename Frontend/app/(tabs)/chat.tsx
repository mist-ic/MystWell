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
import { MessageSkeleton } from '../../components/MessageSkeleton';

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

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    // Clear input and scroll to bottom
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });
    
    const tempId = Date.now().toString();
    const newMessage: ChatMessage = {
      id: tempId,
      text,
      isUser: true,
      status: 'sent', // Optimistic update
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Show typing indicator
    setIsTyping(true);
    
    // Simulate AI response delay (2-3 seconds)
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: Date.now().toString(),
        text: "I understand your query. Let me help you with that. This is a simulated response from the AI assistant.",
        isUser: false,
        status: 'sent',
        timestamp: Date.now(),
      };
      
      setIsTyping(false);
      setMessages(prev => [...prev, aiResponse]);
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 2000 + Math.random() * 1000);

    // This would be the actual API implementation
    /*
    try {
      setIsTyping(true);
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, id: data.id, status: 'sent' }
            : msg
        )
      );
      
      // Add AI response
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: data.response,
        isUser: false,
        status: 'sent',
        timestamp: Date.now(),
      }]);
      
    } catch (err) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
      setError('Failed to send message. Tap to retry.');
    } finally {
      setIsTyping(false);
    }
    */
  };

  const handleRetry = async (messageId: string) => {
    const messageToRetry = messages.find(msg => msg.id === messageId);
    if (!messageToRetry) return;

    setRetryingMessageId(messageId);
    try {
      await handleSendMessage(messageToRetry.text);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } finally {
      setRetryingMessageId(null);
    }
  };

  // Render individual message
  const renderMessage = ({ item: message }: { item: ChatMessage }) => {
    const isUser = message.isUser;
    
    return (
      <View style={[
        styles.messageRow, 
        isUser ? styles.userMessageRow : styles.aiMessageRow
      ]}>
        {/* AI Avatar (only for AI messages) */}
        {!isUser && (
          <Avatar.Icon 
            size={36} 
            icon="robot" 
            color={theme.colors.onPrimary} 
            style={{ backgroundColor: theme.colors.primary, marginRight: 8 }} 
          />
        )}
        
        <View style={styles.messageContainer}>
          {/* Message bubble */}
          <Surface 
            style={[
              styles.messageBubble,
              isUser ? [styles.userMessageBubble, themedStyles.userMessageContent] : [styles.aiMessageBubble, themedStyles.aiMessageContent],
              message.status === 'error' && [styles.errorMessage, { borderColor: theme.colors.error }]
            ]}
            elevation={1}
          >
            <Text 
              style={[
                styles.messageText,
                isUser ? themedStyles.userMessageText : themedStyles.aiMessageText
              ]}
            >
              {message.text}
            </Text>
            
            {/* Error and sending indicators */}
            {message.status === 'error' && (
              <Text style={[styles.retryText, { color: theme.colors.error }]}>
                Tap to retry
              </Text>
            )}
            
            {(message.status === 'sending' || retryingMessageId === message.id) && (
              <ActivityIndicator size="small" style={styles.sendingIndicator} color={isUser ? theme.colors.onPrimary : theme.colors.primary} />
            )}
            
            {/* Timestamp */}
            <MessageTime timestamp={message.timestamp} />
          </Surface>
        </View>
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

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView 
        style={[styles.container, themedStyles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
          ListEmptyComponent={() => (
            isLoading ? (
              <>
                <MessageSkeleton />
                <MessageSkeleton isUser />
                <MessageSkeleton />
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons 
                  name="chat-question-outline" 
                  size={48} 
                  color={theme.colors.primary} 
                  style={{ marginBottom: 16 }}
                />
                <Text style={[styles.emptyText, themedStyles.emptyText]}>
                  Ask MystBuddy anything about your health
                </Text>
              </View>
            )
          )}
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
        />
        
        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingIndicatorContainer}>
            <Avatar.Icon 
              size={32} 
              icon="robot" 
              color={theme.colors.onPrimary}
              style={{ backgroundColor: theme.colors.primary, marginRight: 8 }} 
            />
            <TypingIndicator />
          </View>
        )}
        
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
                accessibilityRole="textbox"
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
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 16,
    width: '100%',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  messageContainer: {
    maxWidth: '80%',
  },
  messageBubble: {
    borderRadius: 20,
    padding: 12,
    minWidth: 80,
  },
  userMessageBubble: {
    borderBottomRightRadius: 4,
  },
  aiMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
    opacity: 0.7,
  },
  errorMessage: {
    borderWidth: 1,
  },
  retryText: {
    fontSize: 12,
    marginTop: 4,
  },
  sendingIndicator: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  typingIndicatorContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingContainer: {
    padding: 10,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: INPUT_HEIGHT * 3,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  inputAccessory: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 16,
  },
  doneButton: {
    fontSize: 17,
  },
}); 