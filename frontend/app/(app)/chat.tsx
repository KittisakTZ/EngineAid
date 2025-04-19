// app/(app)/chat.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, 
    FlatList, Modal, TouchableOpacity
} from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import EventSource, { MessageEvent } from 'react-native-sse';
import { getToken, removeToken, getUser } from '../../services/auth';
import { getApiUrl } from '../../services/api';
import api from '../../services/api';

// Add interface for user
interface User {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Add interface for API prompt data
interface EnginePrompt {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
  userId: string;
}

// Add interface for pagination
interface Pagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const apiUrl = getApiUrl();
  
  // Admin related state
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [promptData, setPromptData] = useState<EnginePrompt[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    pageSize: 15,
    totalItems: 0,
    totalPages: 0
  });
  const [promptsLoading, setPromptsLoading] = useState(false);

  useEffect(() => {
    // Get user data on component mount
    const getUserData = async () => {
      try {
        const userData = await getUser();
        if (userData) {
          setUser(userData);
          setIsAdmin(userData.role === 'ADMIN');
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };
    getUserData();
  }, []);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('Closing existing EventSource connection.');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      closeEventSource();
    };
  }, [closeEventSource]);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || !apiUrl) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
    };

    setMessages(prev => [
      ...prev,
      userMessage,
      { id: `assistant-${Date.now()}`, role: 'assistant', content: '' }
    ]);
    setInputText('');
    setIsLoading(true);

    closeEventSource();

    const token = await getToken();
    if (!token) {
      Alert.alert("Authentication Error", "Please log in again.");
      router.replace('/(auth)/login');
      setIsLoading(false);
      return;
    }

    const url = `${apiUrl}/engine/prompts`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({ prompt: userMessage.content }),
    };

    console.log('Starting EventSource connection to:', url);
    eventSourceRef.current = new EventSource(url, options);
    eventSourceRef.current.addEventListener('open', () => {
      console.log('SSE Connection Opened');
    });
    eventSourceRef.current.addEventListener('message', (event: MessageEvent) => {
      if (event && event.data) {
        try {
          const parsedData = JSON.parse(event.data);
          if (parsedData.response) {
            setMessages(prev => {
              const lastMsgIndex = prev.length - 1;
              if (lastMsgIndex >= 0 && prev[lastMsgIndex].role === 'assistant') {
                const updatedMessages = [...prev];
                updatedMessages[lastMsgIndex] = {
                  ...updatedMessages[lastMsgIndex],
                  content: updatedMessages[lastMsgIndex].content + parsedData.response,
                };
                return updatedMessages;
              }
              return prev;
            });
          }
        } catch (e) {
          console.error('Error parsing SSE message:', e, 'Data:', event.data);
        }
      } else {
        console.warn('Received SSE message event without data:', event);
      }
    });

    eventSourceRef.current.addEventListener('error', (event: any) => {
      console.error('SSE Error Event:', event);
      let errorMessage = "[Error receiving response]";
      if(event && event.message) {
        errorMessage = `[Error: ${event.message}]`;
      }
      setMessages(prev => {
        const lastMsgIndex = prev.length - 1;
        if(lastMsgIndex >= 0 && prev[lastMsgIndex].role === 'assistant' && prev[lastMsgIndex].content === ''){
          const updatedMessages = [...prev];
          updatedMessages[lastMsgIndex] = {...updatedMessages[lastMsgIndex], content: errorMessage};
          return updatedMessages;
        }
        return prev;
      });
      closeEventSource();
    });

    eventSourceRef.current.addEventListener('done' as any, (event: any) => {
      console.log('SSE Done event received:', event?.data);
      closeEventSource();
    });
  };

  const handleLogout = async () => {
    closeEventSource();
    await removeToken();
    router.replace('/(auth)/login');
  };

  // Function to fetch prompt data with pagination
  const fetchPromptData = async (page = 1, limit = 15) => {
    try {
      setPromptsLoading(true);
      const response = await api.get(`/engine/prompts?page=${page}&limit=${limit}`);
      console.log('Fetch prompts response:', response.data);
      
      setPromptData(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching prompt data:', error);
      Alert.alert('Error', 'Failed to fetch data. Please try again.');
    } finally {
      setPromptsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      fetchPromptData(newPage, pagination.pageSize);
    }
  };

  const renderPaginationControls = () => {
    return (
      <View style={styles.paginationControls}>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(1)}
          disabled={pagination.currentPage === 1 || promptsLoading}
        >
          First
        </Button>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage === 1 || promptsLoading}
        >
          Prev
        </Button>
        <Text style={styles.pageInfo}>
          {pagination.currentPage} / {pagination.totalPages}
        </Text>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage === pagination.totalPages || promptsLoading}
        >
          Next
        </Button>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(pagination.totalPages)}
          disabled={pagination.currentPage === pagination.totalPages || promptsLoading}
        >
          Last
        </Button>
      </View>
    );
  };

  const renderAdminModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={adminModalVisible}
        onRequestClose={() => setAdminModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Admin Dashboard</Text>
            
            {promptsLoading ? (
              <ActivityIndicator size="large" color="#0000ff" />
            ) : (
              <>
                <FlatList
                  data={promptData}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.promptItem}>
                      <Text style={styles.promptDate}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                      <Text style={styles.promptText}>{item.prompt}</Text>
                      <Text numberOfLines={2} style={styles.responseText}>
                        {item.response}
                      </Text>
                    </View>
                  )}
                  style={styles.promptList}
                />
                
                {renderPaginationControls()}
              </>
            )}
            
            <Button 
              mode="contained"
              onPress={() => setAdminModalVisible(false)}
              style={styles.closeButton}
            >
              Close
            </Button>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
        {item.role === 'assistant' && item.content === '' && isLoading ? 'Thinking...' : item.content}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EngineAid Chat</Text>
        <View style={styles.headerButtons}>
          {isAdmin && (
            <Button 
              mode="contained" 
              onPress={() => {
                setAdminModalVisible(true);
                fetchPromptData(1, 15);
              }}
              style={styles.adminButton}
            >
              Admin Panel
            </Button>
          )}
          <Button 
            mode="outlined" 
            onPress={handleLogout} 
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </View>
      </View>

      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.userInfoText}>
            Logged in as: {user.email} ({user.role})
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={{ paddingBottom: 10 }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your car..."
          editable={!isLoading}
        />
        <Button 
          mode="contained"
          onPress={handleSend} 
          disabled={isLoading || !inputText.trim()}
          loading={isLoading}
        >
          Send
        </Button>
      </View>

      {renderAdminModal()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f0f0' 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminButton: {
    marginRight: 8,
    backgroundColor: '#4a90e2',
  },
  logoutButton: {
    borderColor: '#FF6347',
  },
  userInfo: {
    backgroundColor: '#e6f7ff',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  userInfoText: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
  },
  messageList: { 
    flex: 1, 
    paddingHorizontal: 10, 
    paddingTop: 10 
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderColor: 'gray',
    borderWidth: 1,
    marginRight: 10,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#ffffff'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  assistantBubble: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  userText: { color: '#fff' },
  assistantText: { color: '#000' },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  promptList: {
    flex: 1,
    marginVertical: 10,
  },
  promptItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  promptDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  promptText: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#555',
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pageInfo: {
    marginHorizontal: 10,
  },
  closeButton: {
    marginTop: 10,
  },
});