// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../services/api'; // ใช้ instance ที่ตั้งค่าแล้ว
import { storeToken } from '../../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

      const response = await api.post(requestUrl, requestData); // <<< เรียก API

      // --- ใส่โค้ดจัดการ Token กลับเข้ามา ---
      console.log("<<< API Call Completed - Status:", response.status);

      const token = response.data.token; // <<< ดึง token จาก response ที่แก้แล้ว
      console.log("<<< Token Received:", token ? "Yes" : "No");

      if (token) { // <<< ตอนนี้ควรจะเป็น true ถ้าแก้ Backend แล้ว
        await storeToken(token);
        console.log("<<< Token Stored, Replacing Route...");
        router.replace('/(app)/chat'); // <<< ควรจะ Navigate แล้ว
      } else {
        // ควรจะเข้าที่นี่น้อยลง ถ้า Backend แก้แล้ว แต่เผื่อไว้
        console.log("<<< No Token in Response");
        Alert.alert('Login Failed', 'No token received from server.');
      }
      // --- สิ้นสุดส่วนที่ใส่กลับเข้ามา ---

    } catch (error: any) {
      console.error("!!! LOGIN CATCH BLOCK ENTERED !!!");
       if (error.response) {
           console.error('Axios Error Response Data:', error.response.data);
           console.error('Axios Error Response Status:', error.response.status);
           // แสดง message จาก backend ถ้ามี
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
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title={loading ? "Logging in..." : "Login"} onPress={handleLogin} disabled={loading} />
      <Button title="Don't have an account? Register" onPress={() => router.push('/(auth)/register')} />
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 15, paddingHorizontal: 10 },
});