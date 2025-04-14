// app/(app)/chat.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, Button, FlatList, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import EventSource, { MessageEvent } from 'react-native-sse';
import { getToken, removeToken } from '../../services/auth';
import { getApiUrl } from '../../services/api';

// ... (interface Message เหมือนเดิม) ...
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}


export default function ChatScreen() {
  // ... (useState, useRef, useRouter, apiUrl เหมือนเดิม) ...
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const apiUrl = getApiUrl();

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
      Alert.alert("Authentication Error", "Please log in again."); // <<< ใช้ Alert ที่ import มา
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
      // react-native-sse อาจมี options เพิ่มเติม เช่น timeout, debug
    };

    console.log('Starting EventSource connection to:', url);
    eventSourceRef.current = new EventSource(url, options);
    eventSourceRef.current.addEventListener('open', () => {
      console.log('SSE Connection Opened');
    });
    eventSourceRef.current.addEventListener('message', (event: MessageEvent) => {
      // console.log('SSE Message Received raw:', event);
      if (event && event.data) { // ตรวจสอบว่ามี data ก่อน parse
         // console.log('SSE Message Data:', event.data);
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

    // จัดการ Error event
    eventSourceRef.current.addEventListener('error', (event: any) => { // Type ของ error event อาจซับซ้อน ใช้ any ไปก่อนได้
        console.error('SSE Error Event:', event); // Log ตัว event ดูว่ามี message อะไรบ้าง
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
        console.log('SSE Done event received:', event?.data); // ลอง log data ดูด้วย
         closeEventSource();
     });
  };

  const handleLogout = async () => {
    closeEventSource();
    await removeToken();
    router.replace('/(auth)/login');
  };

  // ... (renderMessage และ return UI เหมือนเดิม) ...
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
          <Button title="Logout" onPress={handleLogout} color="#FF6347" />
      </View>

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
        <Button title="Send" onPress={handleSend} disabled={isLoading || !inputText.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f0f0' },
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
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    messageList: { flex: 1, paddingHorizontal: 10, paddingTop: 10 },
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
});