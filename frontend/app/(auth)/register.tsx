// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton, Text as PaperText, ActivityIndicator, useTheme } from 'react-native-paper';
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
    if (password.length < 6) {
         Alert.alert('Error', 'Password must be at least 6 characters long');
         return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { email, password });
      if (response.status === 201) {
        Alert.alert(
          'Registration Successful',
          'You can now log in with your credentials.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Registration Failed', response.data?.message || 'An unexpected error occurred');
      }
    } catch (error: any) {
      console.error('Registration Error:', error.response?.data || error.message);
      Alert.alert('Registration Failed', error.response?.data?.message || 'An error occurred');
    } finally {
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
          <PaperText variant="headlineMedium" style={styles.title}>
            Create Account
          </PaperText>

          <PaperTextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
             left={<PaperTextInput.Icon icon="email" />}
          />

          <PaperTextInput
            label="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            mode="outlined"
            left={<PaperTextInput.Icon icon="lock" />}
          />

          <PaperTextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            secureTextEntry
            mode="outlined"
            left={<PaperTextInput.Icon icon="lock-check" />} // <<< เปลี่ยน Icon
          />

          <PaperButton
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            icon="account-plus" // <<< เปลี่ยน Icon
          >
            {loading ? 'Registering...' : 'Register'}
          </PaperButton>

          <PaperButton
            mode="text"
            onPress={() => router.back()}
            disabled={loading}
            style={styles.switchButton}
          >
            Already have an account? Login
          </PaperButton>
         </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ใช้ Styles เดียวกับ Login ได้ หรือปรับแก้ตามต้องการ
const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#f5f5f5',
  },
  title: {
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 10,
    paddingVertical: 8,
  },
  switchButton: {
    marginTop: 20,
  },
});