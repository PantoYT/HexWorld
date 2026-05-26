import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// web: localhost, Android emulator: 10.0.2.2, physical device: LAN IP
const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8000/api/v1'
  : 'http://10.0.2.2:8000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  timeout: 10000,
});

const getStoredToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') return localStorage.getItem('auth_token');
  return SecureStore.getItemAsync('auth_token');
};

api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (e) => Promise.reject(e?.response?.data ?? e)
);
