import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  ListRenderItem,
  KeyboardAvoidingView,
  InputAccessoryView,
  Animated,
  EmitterSubscription,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme, Portal, Snackbar, Button } from 'react-native-paper';
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

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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
      backgroundColor: theme.colors.background,
    },
    content: {
      backgroundColor: theme.colors.background,
    },
    aiAvatar: {
      backgroundColor: theme.colors.primary,
    },
    aiAvatarText: {
      color: theme.colors.onPrimary,
    },
    messageContent: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    userMessageContent: {
      backgroundColor: theme.colors.primary,
    },
    aiMessageContent: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    messageText: {
      color: theme.colors.onSurfaceVariant,
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
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
    },
    input: {
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 20,
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
    const tempId = Date.now().toString();
    const newMessage: ChatMessage = {
      id: tempId,
      text,
      isUser: true,
      status: 'sending',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);

    try {
      // Send message implementation
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
    } catch (err) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
      setError('Failed to send message. Tap to retry.');
    }
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

  const renderMessage = ({ item: message }: { item: ChatMessage }) => (
    <View style={[styles.messageContainer, message.isUser ? styles.userMessageContainer : styles.aiMessageContainer]}>
      <TouchableOpacity
        onPress={() => message.status === 'error' && handleRetry(message.id)}
        disabled={message.status !== 'error'}
        style={styles.messageBubble}
      >
        <Text style={[
          styles.messageText,
          message.status === 'error' && styles.errorText
        ]}>
          {message.text}
        </Text>
        {message.status === 'error' && (
          <Text style={styles.retryText}>Tap to retry</Text>
        )}
        {(message.status === 'sending' || retryingMessageId === message.id) && (
          <ActivityIndicator size="small" style={styles.sendingIndicator} />
        )}
      </TouchableOpacity>
    </View>
  );

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
        <View style={styles.inputAccessory}>
          <TouchableOpacity onPress={() => Keyboard.dismiss()}>
            <Text style={styles.doneButton}>Done</Text>
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
        <StatusBar style="dark" />
        <View style={[styles.header, themedStyles.header]}>
          <TouchableOpacity 
            style={styles.headerButton}
            accessible={true}
            accessibilityLabel="Menu"
            accessibilityHint="Opens the navigation menu"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="menu" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text 
            style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            accessibilityRole="header"
          >
            MystBuddy
          </Text>
          <TouchableOpacity 
            style={styles.headerButton}
            accessible={true}
            accessibilityLabel="Edit preferences"
            accessibilityHint="Opens chat preferences"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="square-edit-outline" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
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
        
        <FlatList
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
            ) : null
          )}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadMessages}
            />
          }
        />
        
        <Animated.View style={[
          styles.bottomContainer,
          themedStyles.bottomContainer,
          { height: inputHeightRef.current }
        ]}>
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => inputRef.current?.focus()}
                accessible={true}
                accessibilityLabel="Search messages"
                accessibilityHint="Search through chat history"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="magnify" size={24} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={[styles.input, themedStyles.input]}
                value={input}
                onChangeText={setInput}
                placeholder="Ask anything"
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
              <TouchableOpacity 
                style={styles.actionButton}
                accessible={true}
                accessibilityLabel="Start voice input"
                accessibilityHint="Record your message using voice"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="microphone" size={24} color={theme.colors.onSurfaceVariant} />
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
                  size={24} 
                  color={input.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    width: '100%',
  },
  userBubble: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiBubble: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageContent: {
    maxWidth: '70%',
    borderRadius: 20,
    padding: 12,
  },
  userMessageContent: {
    alignSelf: 'flex-end',
    marginRight: 0,
  },
  aiMessageContent: {
    alignSelf: 'flex-start',
    marginLeft: 0,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageStatus: {
    marginTop: 4,
  },
  errorMessage: {
    borderWidth: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  retryText: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
  },
  bottomContainer: {
    width: '100%',
    borderTopWidth: 1,
  },
  inputContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  actionButton: {
    padding: 8,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: INPUT_HEIGHT * 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
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
  errorText: {
    color: 'red',
  },
  sendingIndicator: {
    marginLeft: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    width: '100%',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 32,
  },
}); 