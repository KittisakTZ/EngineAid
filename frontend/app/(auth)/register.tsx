// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Image } from 'react-native';
import { TextInput as PaperTextInput, Text as PaperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Assuming Expo Icons is available
import api from '../../services/api';
import { CustomButton } from '../../components/CustomButton'; // Import CustomButton

export default function RegisterScreen() {
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

  // Create a register icon for the button
  const registerIcon = <Ionicons name="person-add" size={18} color="#FFFFFF" />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        <View style={styles.container}>
          <Image
                      source={require('../../assets/images/engine-aid-logo.png')}
                      style={styles.logo}
                      resizeMode="contain"
                      accessibilityLabel="EngineAID logo"
          />

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
            left={<PaperTextInput.Icon icon="lock-check" />}
          />

          {/* Replace PaperButton with CustomButton */}
          <CustomButton
            onPress={handleRegister}
            title={loading ? "Registering..." : "Register"}
            variant="success" // Using success green color for register
            size="large"
            loading={loading}
            disabled={loading}
            style={styles.button}
            icon={registerIcon}
            iconPosition="left"
          />

          {/* Replace the second button too */}
          <CustomButton
            onPress={() => router.back()}
            title="Already have an account? Login"
            variant="text"
            size="medium"
            disabled={loading}
            style={styles.switchButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  },
  switchButton: {
    marginTop: 20,
  },
  logo: {
    width: 180,
    height: 120, 
    alignSelf: 'center', 
    marginBottom: 20, 
  },
});