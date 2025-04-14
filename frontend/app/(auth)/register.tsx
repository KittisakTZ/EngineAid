// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../services/api'; // ใช้ Axios instance ที่ตั้งค่าไว้

export default function RegisterScreen() { // <<< ต้องมี export default
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    // --- Input Validation ---
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    // เพิ่มการตรวจสอบความยาว Password หรือรูปแบบ Email ที่นี่ได้ถ้าต้องการ
    if (password.length < 6) {
         Alert.alert('Error', 'Password must be at least 6 characters long');
         return;
    }

    setLoading(true);
    try {
      // เรียก API /auth/register ของ Backend
      // ส่ง email และ password (Backend ควรจะ hash password ก่อนบันทึก)
      // เราไม่ส่ง Role จาก Frontend เพื่อความปลอดภัย (ควรตั้ง Default เป็น USER ที่ Backend)
      const response = await api.post('/auth/register', { email, password });

      // ตรวจสอบ Response จาก Backend (คาดว่าตอบ 201 Created)
      if (response.status === 201) {
        Alert.alert(
          'Registration Successful',
          'You can now log in with your credentials.',
          [{ text: 'OK', onPress: () => router.back() }] // กลับไปหน้า Login
        );
        // หรือจะ Navigate ไป Login โดยตรง: router.replace('/(auth)/login');
      } else {
        // กรณีที่ไม่คาดคิด (Backend ตอบ Status อื่นที่ไม่ใช่ 201 หรือ Error)
        Alert.alert('Registration Failed', response.data?.message || 'An unexpected error occurred');
      }
    } catch (error: any) {
      console.error('Registration Error:', error.response?.data || error.message);
      // แสดง Error message ที่ Backend ส่งกลับมา (ถ้ามี)
      Alert.alert('Registration Failed', error.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
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
        placeholder="Password (min 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button title={loading ? "Registering..." : "Register"} onPress={handleRegister} disabled={loading} />
      <Button title="Already have an account? Login" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 15, paddingHorizontal: 10 },
});