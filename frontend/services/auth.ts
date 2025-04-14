// services/auth.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'authToken';

export async function storeToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    console.log('Token stored successfully');
  } catch (error) {
    console.error('Error storing token:', error);
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    // console.log('Retrieved token:', token ? 'Yes' : 'No'); // Log for debugging
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
}

export async function removeToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    console.log('Token removed successfully');
  } catch (error) {
    console.error('Error removing token:', error);
  }
}