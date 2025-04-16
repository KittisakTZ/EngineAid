// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton, Text as PaperText, ActivityIndicator, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import api from '../../services/api'; // ใช้ instance ที่ตั้งค่าแล้ว
import { storeToken } from '../../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const theme = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const requestUrl = '/auth/login';
      const requestData = { email, password };
      console.log(`Attempting POST to: ${api.defaults.baseURL}${requestUrl}`);
      console.log('Login data:', requestData);
      const response = await api.post(requestUrl, requestData);
      console.log("<<< API Call Completed - Status:", response.status);
      const token = response.data.token;
      console.log("<<< Token Received:", token ? "Yes" : "No");
      if (token) {
        await storeToken(token);
        console.log("<<< Token Stored, Replacing Route...");
        router.replace('/(app)/chat');
      } else {
        console.log("<<< No Token in Response");
        Alert.alert('Login Failed', 'No token received from server.');
      }
    } catch (error: any) {
      console.error("!!! LOGIN CATCH BLOCK ENTERED !!!");
      if (error.response) {
          console.error('Axios Error Response Data:', error.response.data);
          console.error('Axios Error Response Status:', error.response.status);
          Alert.alert('Login Failed', error.response.data?.message || `Server error: ${error.response.status}`);
      } else if (error.request) {
          console.error('Axios Error Request:', error.request);
          Alert.alert('Login Failed', 'No response received from server. Check connection or tunnel.');
      } else {
          console.error('Axios Error Message:', error.message);
          Alert.alert('Login Failed', `Request setup error: ${error.message}`);
      }
      console.error('Login Error Config:', error.config);
    } finally {
      console.log("--- LOGIN FINALLY BLOCK ---");
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        <View style={styles.container}>
          {/* ใช้ PaperText และ variant สำหรับ Title */}
          <PaperText variant="headlineMedium" style={styles.title}>
            EngineAid Login
          </PaperText>

          {/* ใช้ PaperTextInput */}
          <PaperTextInput
            label="Email" // <<< ใช้ label แทน placeholder
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined" // <<< เพิ่ม mode
            left={<PaperTextInput.Icon icon="email" />} // <<< เพิ่ม Icon (optional)
          />

          <PaperTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            mode="outlined"
            left={<PaperTextInput.Icon icon="lock" />}
          />

          {/* ใช้ PaperButton */}
          <PaperButton
            mode="contained" // <<< ปุ่มหลัก
            onPress={handleLogin}
            loading={loading} // <<< ใช้ loading prop
            disabled={loading}
            style={styles.button}
            icon="login" // <<< เพิ่ม Icon (optional)
          >
            {loading ? 'Logging in...' : 'Login'}
          </PaperButton>

          <PaperButton
            mode="text" // <<< ปุ่มรอง (Text button)
            onPress={() => router.push('/(auth)/register')}
            disabled={loading}
            style={styles.switchButton}
          >
            Don't have an account? Register
          </PaperButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles ที่ปรับปรุงสำหรับ React Native Paper
const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContainer: {
    flexGrow: 1, // <<< ทำให้ ScrollView ขยายเต็มพื้นที่ถ้าเนื้อหาน้อย
    justifyContent: 'center',
  },
  container: {
    flex: 1, // <<< ให้ View ภายใน ScrollView ขยายได้
    justifyContent: 'center',
    padding: 30, // <<< เพิ่ม padding
    backgroundColor: '#f5f5f5', // <<< สีพื้นหลังอ่อนๆ
  },
  title: {
    marginBottom: 30, // <<< เพิ่มระยะห่าง
    textAlign: 'center',
    // color: theme.colors.primary // <<< ใช้สีจาก Theme ได้
  },
  input: {
    marginBottom: 15, // <<< ลดระยะห่างเล็กน้อย
    backgroundColor: '#fff', // <<< ทำให้พื้นหลัง Input ขาว
  },
  button: {
    marginTop: 10, // <<< เพิ่มระยะห่างด้านบน
    paddingVertical: 8, // <<< ทำให้ปุ่มสูงขึ้น
  },
  switchButton: {
    marginTop: 20,
  },
});