// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, Alert, KeyboardAvoidingView, Platform, ScrollView,StyleSheet } from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton, Text as PaperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { storeToken, storeUser } from '../../services/auth';

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
      
      const response = await api.post(requestUrl, requestData);
      console.log("<<< API Call Completed - Status:", response.status);
      
      const { token, user } = response.data;
      console.log("<<< Token Received:", token ? "Yes" : "No");
      console.log("<<< User Received:", user ? "Yes" : "No");
      
      if (token && user) {
        // Store both token and user data
        await storeToken(token);
        await storeUser(user);
        console.log("<<< Token and User Stored, Replacing Route...");
        router.replace('/(app)/chat');
      } else {
        console.log("<<< No Token or User in Response");
        Alert.alert('Login Failed', 'Invalid response received from server.');
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
          <PaperText variant="headlineMedium" style={styles.title}>
            EngineAid Login
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
            label="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            mode="outlined"
            left={<PaperTextInput.Icon icon="lock" />}
          />

          <PaperButton
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            icon="login"
          >
            {loading ? 'Logging in...' : 'Login'}
          </PaperButton>

          <PaperButton
            mode="text"
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

// Styles are the same as before
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