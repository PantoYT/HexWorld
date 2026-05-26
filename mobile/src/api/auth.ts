import { Platform } from 'react-native';
import { api } from './client';
import * as SecureStore from 'expo-secure-store';

export interface User {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  discovered_count: number;
  followers_count: number;
  following_count: number;
}

export const register = (data: { username: string; email: string; password: string; display_name?: string }) =>
  api.post<{ user: User; token: string }>('/auth/register', data).then(r => r.data);

export const login = (email: string, password: string) =>
  api.post<{ user: User; token: string }>('/auth/login', { email, password }).then(r => r.data);

export const logout = () => api.post('/auth/logout');

export const getMe = () => api.get<User>('/auth/me').then(r => r.data);

export const saveToken = async (token: string) => {
  if (Platform.OS === 'web') { localStorage.setItem('auth_token', token); return; }
  return SecureStore.setItemAsync('auth_token', token);
};

export const clearToken = async () => {
  if (Platform.OS === 'web') { localStorage.removeItem('auth_token'); return; }
  return SecureStore.deleteItemAsync('auth_token');
};

export const getToken = async () => {
  if (Platform.OS === 'web') return localStorage.getItem('auth_token');
  return SecureStore.getItemAsync('auth_token');
};
