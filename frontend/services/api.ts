// services/api.ts
import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from './auth'; // Import getToken

const API_URL = Constants.expoConfig?.extra?.API_URL;
console.log("API_URL from Constants:", API_URL);

if (!API_URL) {
    console.error("API_URL is not defined in app.json extra config!");
    // อาจจะ throw error หรือตั้งค่า default ที่นี่
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Axios Interceptor: เพิ่ม Authorization header อัตโนมัติถ้ามี Token
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // console.log('Interceptor: Added Auth header'); // Log for debugging
    } else {
      // console.log('Interceptor: No token found'); // Log for debugging
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

// Helper สำหรับ SSE ที่อาจต้องใช้ URL เต็มและ Token แยกต่างหาก
export const getApiUrl = (): string | undefined => API_URL;