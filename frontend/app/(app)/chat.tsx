import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, 
    FlatList, Modal, TouchableOpacity, ScrollView
} from 'react-native';
import { Button, Divider } from 'react-native-paper';
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

// Define a type for car models mapping
interface CarModelsMap {
  [make: string]: string[];
}

// Car information data
const carMakes = [
  'Toyota', 'Honda', 'Nissan', 'Mazda', 'Ford', 
  'Chevrolet', 'BMW', 'Mercedes-Benz', 'Audi',
  'Hyundai', 'Kia', 'Mitsubishi'
];

// Model mappings based on makes
const carModelsByMake: CarModelsMap = {
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Prius', 'Fortuner', 'Vios'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'Jazz', 'City'],
  'Nissan': ['Almera', 'Kicks', 'X-Trail', 'Navara', 'Sylphy', 'Note'],
  'Mazda': ['Mazda2', 'Mazda3', 'CX-3', 'CX-5', 'CX-30', 'BT-50'],
  'Ford': ['Ranger', 'Everest', 'Mustang', 'Focus', 'EcoSport'],
  'Chevrolet': ['Colorado', 'Captiva', 'Trailblazer', 'Corvette'],
  'BMW': ['3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC', 'GLE'],
  'Audi': ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7'],
  'Hyundai': ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta'],
  'Kia': ['Rio', 'Cerato', 'Sportage', 'Carnival', 'Seltos'],
  'Mitsubishi': ['Mirage', 'Attrage', 'Xpander', 'Pajero Sport', 'Triton']
};

// Generate years from current year back to 1990
const generateYears = () => {
  const currentYear = new Date().getFullYear() + 1; // Include next year's models
  const years = [];
  for (let year = currentYear; year >= 1990; year--) {
    years.push(year.toString());
  }
  return years;
};

const carYears = generateYears();

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
  
  // Car selection state
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  
  // Dropdown visibility state
  const [makeDropdownVisible, setMakeDropdownVisible] = useState(false);
  const [modelDropdownVisible, setModelDropdownVisible] = useState(false);
  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);
  
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

  // Reset model when make changes
  useEffect(() => {
    setSelectedModel('');
  }, [selectedMake]);

  // Function to hide all dropdowns
  const hideAllDropdowns = () => {
    setMakeDropdownVisible(false);
    setModelDropdownVisible(false);
    setYearDropdownVisible(false);
  };

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

    // Format the message with car details if they're selected
    let messageText = inputText.trim();
    if (selectedMake) {
      let carDetails = `รถ: ${selectedMake}`;
      if (selectedModel) carDetails += ` ${selectedModel}`;
      if (selectedYear) carDetails += ` (${selectedYear})`;
      messageText = `${carDetails}\n\nคำถาม: ${messageText}`;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
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
      Alert.alert("ข้อผิดพลาดการตรวจสอบสิทธิ์", "กรุณาเข้าสู่ระบบอีกครั้ง");
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
      let errorMessage = "[เกิดข้อผิดพลาดในการรับข้อมูล]";
      if(event && event.message) {
        errorMessage = `[ข้อผิดพลาด: ${event.message}]`;
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

  // Reset car selection
  const resetCarSelection = () => {
    setSelectedMake('');
    setSelectedModel('');
    setSelectedYear('');
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
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลได้ กรุณาลองอีกครั้ง');
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
          หน้าแรก
        </Button>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage === 1 || promptsLoading}
        >
          ก่อนหน้า
        </Button>
        <Text style={styles.pageInfo}>
          {pagination.currentPage} / {pagination.totalPages}
        </Text>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage === pagination.totalPages || promptsLoading}
        >
          ถัดไป
        </Button>
        <Button 
          mode="text" 
          onPress={() => handlePageChange(pagination.totalPages)}
          disabled={pagination.currentPage === pagination.totalPages || promptsLoading}
        >
          หน้าสุดท้าย
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
            <Text style={styles.modalTitle}>แผงควบคุมผู้ดูแลระบบ</Text>
            
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
                        {new Date(item.createdAt).toLocaleDateString('th-TH')}
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
              ปิด
            </Button>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
        {item.role === 'assistant' && item.content === '' && isLoading ? 'กำลังคิด...' : item.content}
      </Text>
    </View>
  );

  // Render custom dropdown option
  const renderDropdownItem = (item: string, onSelect: (value: string) => void) => {
    return (
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => onSelect(item)}
        key={item}
      >
        <Text style={styles.dropdownItemText}>{item}</Text>
      </TouchableOpacity>
    );
  };

  // Render car selection section with custom dropdowns
  const renderCarSelections = () => {
    return (
      <View style={styles.carSelectionContainer}>
        <Text style={styles.carSelectionTitle}>เลือกรถของคุณ:</Text>
        
        <View style={styles.carSelectionRow}>
          {/* Make Dropdown */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                hideAllDropdowns();
                setMakeDropdownVisible(!makeDropdownVisible);
              }}
            >
              <Text style={[styles.dropdownButtonText, !selectedMake && styles.placeholderText]}>
                {selectedMake || "ยี่ห้อรถ"}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
            
            {makeDropdownVisible && (
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled={true}>
                  {carMakes.map(make => renderDropdownItem(make, (selected) => {
                    setSelectedMake(selected);
                    setMakeDropdownVisible(false);
                  }))}
                </ScrollView>
              </View>
            )}
          </View>
          
          {/* Model Dropdown */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdownButton, !selectedMake && styles.disabledDropdown]}
              onPress={() => {
                if (selectedMake) {
                  hideAllDropdowns();
                  setModelDropdownVisible(!modelDropdownVisible);
                }
              }}
              disabled={!selectedMake}
            >
              <Text style={[
                styles.dropdownButtonText, 
                !selectedModel && styles.placeholderText,
                !selectedMake && styles.disabledText
              ]}>
                {selectedModel || "รุ่นรถ"}
              </Text>
              <Text style={[styles.dropdownIcon, !selectedMake && styles.disabledText]}>▼</Text>
            </TouchableOpacity>
            
            {modelDropdownVisible && selectedMake && (
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled={true}>
                  {carModelsByMake[selectedMake]?.map(model => renderDropdownItem(model, (selected) => {
                    setSelectedModel(selected);
                    setModelDropdownVisible(false);
                  }))}
                </ScrollView>
              </View>
            )}
          </View>
          
          {/* Year Dropdown */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => {
                hideAllDropdowns();
                setYearDropdownVisible(!yearDropdownVisible);
              }}
            >
              <Text style={[styles.dropdownButtonText, !selectedYear && styles.placeholderText]}>
                {selectedYear || "ปีรถ"}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
            
            {yearDropdownVisible && (
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled={true}>
                  {carYears.map(year => renderDropdownItem(year, (selected) => {
                    setSelectedYear(selected);
                    setYearDropdownVisible(false);
                  }))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
        
        {/* Show selected car details and reset button */}
        {(selectedMake || selectedModel || selectedYear) && (
          <View style={styles.selectedCarContainer}>
            <Text style={styles.selectedCarText}>
              {selectedMake} {selectedModel} {selectedYear ? `(${selectedYear})` : ''}
            </Text>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetCarSelection}
            >
              <Text style={styles.resetButtonText}>ล้างข้อมูลรถ</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <TouchableOpacity
        style={styles.outsideDropdownArea}
        activeOpacity={1}
        onPress={hideAllDropdowns}
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
                แผงผู้ดูแล
              </Button>
            )}
            <Button 
              mode="outlined" 
              onPress={handleLogout} 
              style={styles.logoutButton}
            >
              ออกจากระบบ
            </Button>
          </View>
        </View>

        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.userInfoText}>
              เข้าสู่ระบบเป็น: {user.email} ({user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้'})
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

        {renderCarSelections()}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="ถามเกี่ยวกับรถของคุณ..."
            editable={!isLoading}
            multiline={true}
          />
          <Button 
            mode="contained"
            onPress={handleSend} 
            disabled={isLoading || !inputText.trim()}
            loading={isLoading}
            style={styles.sendButton}
          >
            ส่ง
          </Button>
        </View>

        {renderAdminModal()}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f0f0' 
  },
  outsideDropdownArea: {
    flex: 1,
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
    borderColor: '#bbb',
    borderWidth: 1,
    marginRight: 10,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 20,
    paddingHorizontal: 5,
    justifyContent: 'center',
    backgroundColor: '#007AFF',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  assistantBubble: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  userText: { color: '#fff', fontSize: 15 },
  assistantText: { color: '#000', fontSize: 15 },
  
  // Improved car selection styles
  carSelectionContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  carSelectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  carSelectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dropdownContainer: {
    flex: 1,
    marginHorizontal: 3,
    position: 'relative',
    zIndex: 1, // Ensure dropdowns show above other elements
  },
  dropdownButton: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownIcon: {
    fontSize: 10,
    color: '#777',
    marginLeft: 5,
  },
  placeholderText: {
    color: '#888',
  },
  disabledDropdown: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
  },
  disabledText: {
    color: '#aaa',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 999,
  },
  dropdownScrollView: {
    maxHeight: 150,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 5,
  },
  selectedCarText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  resetButtonText: {
    color: '#FF6347',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Admin modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
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
    padding: 12,
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
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
});