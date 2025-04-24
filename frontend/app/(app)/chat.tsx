
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
    FlatList, Modal, TouchableOpacity, ScrollView, ListRenderItemInfo
} from 'react-native';
import { Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import EventSource, { MessageEvent } from 'react-native-sse';
import { getToken, removeToken, getUser } from '../../services/auth';
import { getApiUrl } from '../../services/api';
import api from '../../services/api';
import { CustomButton } from '../../components/CustomButton';
import { Pagination } from '../../components/Pagination';
import { Dropdown } from '../../components/Dropdown';

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

interface EnginePrompt {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
  userId: string;
}

interface Pagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface CarModelsMap {
  [make: string]: string[];
}

const carMakes = [
  'Toyota', 'Honda', 'Nissan', 'Mazda', 'Ford',
  'Chevrolet', 'BMW', 'Mercedes-Benz', 'Audi',
  'Hyundai', 'Kia', 'Mitsubishi'
];

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

const generateYears = () => {
  const currentYear = new Date().getFullYear() + 1;
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

  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  const [makeDropdownVisible, setMakeDropdownVisible] = useState(false);
  const [modelDropdownVisible, setModelDropdownVisible] = useState(false);
  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);

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

  useEffect(() => {
    setSelectedModel('');
  }, [selectedMake]);

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

  const resetCarSelection = () => {
    setSelectedMake('');
    setSelectedModel('');
    setSelectedYear('');
  };

  const fetchPromptData = async (page = 1, limit = 15) => {
    try {
      setPromptsLoading(true);
      setPromptData([]);

      const token = await getToken();
      if (!token) {
        Alert.alert("ข้อผิดพลาดการตรวจสอบสิทธิ์", "กรุณาเข้าสู่ระบบอีกครั้ง");
        router.replace('/(auth)/login');
        setPromptsLoading(false); 
        return;
      }

      console.log(`Fetching prompts data: page=${page}, limit=${limit}`);

      const apiUrl = getApiUrl();
      const url = `${apiUrl}/engine/prompts?page=${page}&limit=${limit}`;

      const fetchResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!fetchResponse.ok) {
        console.error('API error status:', fetchResponse.status);
        const errorText = await fetchResponse.text(); 
        console.error('API error body:', errorText);
        throw new Error(`API error: ${fetchResponse.status} - ${errorText}`);
      }

      const responseData = await fetchResponse.json();
      console.log('Raw API Response:', JSON.stringify(responseData, null, 2));

      let prompts: EnginePrompt[] = [];
      let receivedPagination: Pagination | null = null;

      if (responseData && typeof responseData === 'object') {
        console.log('Response data keys:', Object.keys(responseData));

        if (responseData.pagination && typeof responseData.pagination === 'object') {
            receivedPagination = {
                currentPage: responseData.pagination.currentPage ?? page,
                pageSize: responseData.pagination.pageSize ?? limit,
                totalItems: responseData.pagination.totalItems ?? 0,
                totalPages: responseData.pagination.totalPages ?? 1,
            };
            console.log('Received pagination data:', receivedPagination);
        }

        const mapItem = (item: any, index: number): EnginePrompt => ({
          id: item.id || `item-${page}-${index}`, 
          prompt: item.prompt || item.question || item.text || 'ไม่มีข้อมูล',
          response: item.response || item.answer || item.reply || 'ไม่มีข้อมูล',
          createdAt: item.createdAt || item.created_at || new Date().toISOString(),
          userId: item.userId || item.user_id || 'ไม่ระบุ',
        });

        if (responseData.data && Array.isArray(responseData.data)) {
          console.log('Response has data array with', responseData.data.length, 'items');
          prompts = responseData.data.map(mapItem);
        } else if (responseData.items && Array.isArray(responseData.items)) {
          console.log('Response has items array with', responseData.items.length, 'items');
          prompts = responseData.items.map(mapItem);
        } else if (responseData.prompts && Array.isArray(responseData.prompts)) {
            console.log('Response has prompts array with', responseData.prompts.length, 'items');
            prompts = responseData.prompts.map(mapItem);
        } else if (Array.isArray(responseData)) {
          console.log('Response is a direct array with', responseData.length, 'items');
          prompts = responseData.map(mapItem);
        } else {
           console.log('Response format is unexpected, trying to find an array property');
           const arrayKey = Object.keys(responseData).find(key => Array.isArray(responseData[key]));
           if (arrayKey) {
               console.log(`Found array in key '${arrayKey}' with ${responseData[arrayKey].length} items`);
               prompts = responseData[arrayKey].map(mapItem);
           } else {
               console.log('Could not find a suitable array property for prompt data.');
           }
        }

        if (prompts.length > 0) {
          console.log(`Created ${prompts.length} formatted prompt items`);
          setPromptData(prompts);

          if (receivedPagination) {
             const calculatedTotalPages = Math.ceil(receivedPagination.totalItems / receivedPagination.pageSize);
             setPagination({
                 ...receivedPagination,
                 totalPages: calculatedTotalPages > 0 ? calculatedTotalPages : 1,
             });
          } else {
            console.warn('Pagination data missing in API response, creating fallback.');
            const isLikelyLastPage = prompts.length < limit;
            setPagination({
              currentPage: page,
              pageSize: limit,
              totalItems: (page - 1) * limit + prompts.length + (isLikelyLastPage ? 0 : 1),
              totalPages: page + (isLikelyLastPage ? 0 : 1),
            });
          }
        } else {
          console.log('No data could be extracted or array was empty.');
          setPromptData([]);
          setPagination({
            currentPage: 1,
            pageSize: limit,
            totalItems: 0,
            totalPages: 1 
          });
        }

      } else {
        console.error('Invalid response format, not an object:', responseData);
        setPromptData([]);
         setPagination({ currentPage: 1, pageSize: limit, totalItems: 0, totalPages: 1 });
        Alert.alert('ข้อผิดพลาด', 'ข้อมูลที่ได้รับมีรูปแบบไม่ถูกต้อง');
      }
    } catch (error: unknown) {
      console.error('Error fetching prompt data:', error);
      setPromptData([]);
      setPagination({ currentPage: 1, pageSize: limit, totalItems: 0, totalPages: 1 });

      const errorMessage = error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ';
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถดึงข้อมูลได้: ${errorMessage}`);
    } finally {
      setPromptsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
      fetchPromptData(newPage, pagination.pageSize);
    } else {
        console.log(`Page change ignored: newPage=${newPage}, current=${pagination.currentPage}, total=${pagination.totalPages}`);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    console.log(`Attempting to delete prompt: ${promptId}`);

    Alert.alert(
      "ยืนยันการลบ",
      `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูล Prompt ID: ${promptId}? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      [
        {
          text: "ยกเลิก",
          style: "cancel",
        },
        {
          text: "ลบ",
          style: "destructive",
          onPress: async () => {
            try {
              setPromptsLoading(true);

              const token = await getToken();
              if (!token) {
                Alert.alert("ข้อผิดพลาด", "ไม่พบ Token กรุณาเข้าสู่ระบบใหม่");
                setPromptsLoading(false);
                router.replace('/(auth)/login');
                return;
              }

              const apiUrl = getApiUrl();
              const url = `${apiUrl}/engine/prompts/${promptId}`;

              const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
              });

              if (response.ok) {
                console.log(`Prompt ${promptId} deleted successfully.`);
                Alert.alert("สำเร็จ", "ลบข้อมูลเรียบร้อยแล้ว");

                if (promptData.length === 1 && pagination.currentPage > 1) {
                  fetchPromptData(pagination.currentPage - 1, pagination.pageSize);
                } else {
                  fetchPromptData(pagination.currentPage, pagination.pageSize);
                }
              } else {
                const errorData = await response.json();
                console.error(`Failed to delete prompt ${promptId}. Status: ${response.status}`, errorData);
                Alert.alert("เกิดข้อผิดพลาด", `ไม่สามารถลบข้อมูลได้: ${errorData.message || `Status ${response.status}`}`);
              }
            } catch (error: any) {
              console.error('Error during delete request:', error);
              Alert.alert("เกิดข้อผิดพลาด", `เกิดปัญหาในการเชื่อมต่อ: ${error.message}`);
            } finally {
               setPromptsLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
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
              <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
            ) : (
              <>
                <Text style={styles.debugText}>
                  สถานะ: {pagination.currentPage}/{pagination.totalPages} | รายการ: {promptData.length} / {pagination.totalItems}
                </Text>

                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 0.3 }]}>ID</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.35 }]}>คำถาม</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.35 }]}>คำตอบ</Text>
                  </View>

                  {Array.isArray(promptData) && promptData.length > 0 ? (
                    <FlatList
                      data={promptData}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          style={styles.tableRow}
                          onPress={() => {
                            Alert.alert(
                              'รายละเอียดข้อมูล',
                              `ID: ${item.id}\nUser: ${item.userId}\nCreated: ${new Date(item.createdAt).toLocaleString()}\n\nคำถาม:\n${item.prompt}\n\nคำตอบ:\n${item.response}`,
                              [
                                {
                                  text: 'ลบ',
                                  onPress: () => handleDeletePrompt(item.id),
                                  style: 'destructive'
                                },
                                {
                                  text: 'ปิด',
                                  style: 'cancel'
                                },
                              ],
                               { cancelable: true }
                            );
                          }}
                        >
                          <Text
                            style={[styles.tableCell, { flex: 0.3 }]}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                          >
                            {item.id ? item.id.substring(item.id.length - 8) : `N/A-${index}`}
                          </Text>
                          <Text
                            style={[styles.tableCell, { flex: 0.35 }]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {item.prompt || 'ไม่มีข้อมูล'}
                          </Text>
                          <Text
                            style={[styles.tableCell, { flex: 0.35 }]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {item.response || 'ไม่มีข้อมูล'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      style={styles.tableBody}
                    />
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Text style={styles.noDataText}>
                          {pagination.totalItems === 0 ? 'ไม่มีข้อมูลในระบบ' : 'ไม่พบข้อมูลในหน้านี้'}
                      </Text>
                      <Text style={styles.noDataSubText}>
                        กรุณาลองรีเฟรช หรือตรวจสอบ API
                      </Text>
                    </View>
                  )}
                </View>

                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                  loading={promptsLoading}
                  style={styles.paginationContainer}
                />
              </>
            )}

            <CustomButton
              title="รีเฟรชข้อมูล"
              variant="success"
              onPress={() => {
                fetchPromptData(1, pagination.pageSize);
              }}
              disabled={promptsLoading}
              style={styles.refreshButton}
            />

            <CustomButton
              title="ปิด"
              variant="danger"
              onPress={() => setAdminModalVisible(false)}
              style={styles.closeButton}
            />
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

  const renderCarSelections = () => {
    return (
      <View style={styles.carSelectionContainer}>
        <Text style={styles.carSelectionTitle}>เลือกรถของคุณ (Optional):</Text>

        <View style={styles.carSelectionRow}>
          <Dropdown
            placeholder="ยี่ห้อรถ"
            items={carMakes}
            selectedValue={selectedMake}
            onSelect={(value) => setSelectedMake(value)}
            visible={makeDropdownVisible}
            onToggle={() => {
              hideAllDropdowns();
              setMakeDropdownVisible(!makeDropdownVisible);
            }}
            style={styles.dropdownContainer}
          />

          <Dropdown
            placeholder="รุ่นรถ"
            items={selectedMake ? carModelsByMake[selectedMake] || [] : []}
            selectedValue={selectedModel}
            onSelect={(value) => setSelectedModel(value)}
            disabled={!selectedMake}
            visible={modelDropdownVisible}
            onToggle={() => {
              if (selectedMake) {
                hideAllDropdowns();
                setModelDropdownVisible(!modelDropdownVisible);
              }
            }}
            style={styles.dropdownContainer}
          />

          <Dropdown
            placeholder="ปีรถ"
            items={carYears}
            selectedValue={selectedYear}
            onSelect={(value) => setSelectedYear(value)}
            visible={yearDropdownVisible}
            onToggle={() => {
              hideAllDropdowns();
              setYearDropdownVisible(!yearDropdownVisible);
            }}
            style={styles.dropdownContainer}
          />
        </View>

        {(selectedMake || selectedModel || selectedYear) && (
          <View style={styles.selectedCarContainer}>
            <Text style={styles.selectedCarText}>
              {selectedMake} {selectedModel} {selectedYear ? `(${selectedYear})` : ''}
            </Text>
            <CustomButton
              title="ล้างข้อมูลรถ"
              variant="outline"
              size="small"
              onPress={resetCarSelection}
              style={styles.resetButton}
              textStyle={styles.resetButtonText}
            />
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
      <View style={styles.flexContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>EngineAid Chat</Text>
          <View style={styles.headerButtons}>
            {isAdmin && (
              <CustomButton
                title="แผงผู้ดูแล"
                variant="primary"
                onPress={() => {
                  setAdminModalVisible(true);
                  fetchPromptData(1, pagination.pageSize);
                }}
                style={styles.adminButton}
              />
            )}
            <CustomButton
              title="ออกจากระบบ"
              variant="outline"
              onPress={handleLogout}
              style={styles.logoutButton}
              textStyle={styles.logoutButtonText}
            />
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
          onScrollBeginDrag={hideAllDropdowns}
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
            onFocus={hideAllDropdowns}
          />
          <CustomButton
            title="ส่ง"
            variant="primary"
            onPress={handleSend}
            disabled={isLoading || !inputText.trim()}
            loading={isLoading}
            style={styles.sendButton}
          />
        </View>

        {isAdmin && renderAdminModal()}
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0'
  },
  flexContainer: {
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
  },
  logoutButton: {
    borderColor: '#FF6347',
  },
  logoutButtonText: {
    color: '#FF6347',
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
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#bbb',
    borderWidth: 1,
    marginRight: 10,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    borderRadius: 20,
    height: 40,
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

  // Car selection styles
  carSelectionContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    zIndex: 10,
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
    marginBottom: 5,
  },
  dropdownContainer: {
    flex: 1,
    marginHorizontal: 3,
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
    backgroundColor: 'transparent',
  },
  resetButtonText: {
    color: '#FF6347',
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
    width: '95%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  loadingIndicator: {
    marginVertical: 40,
  },
  paginationContainer: {
    marginVertical: 10,
  },
  closeButton: {
    marginTop: 10,
  },
  refreshButton: {
    marginTop: 10,
    marginBottom: 5,
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  noDataText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  noDataSubText: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 5,
    textAlign: 'center',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 10,
    flexShrink: 1,
    flexGrow: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    textAlign: 'left',
    paddingHorizontal: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  tableCell: {
    fontSize: 13,
    color: '#444',
    paddingHorizontal: 5,
    textAlignVertical: 'center',
  },
  tableBody: {
    maxHeight: 400,
  },
  debugText: {
    fontSize: 12,
    color: '#555',
    padding: 5,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    marginBottom: 10,
    textAlign: 'center',
  },
});