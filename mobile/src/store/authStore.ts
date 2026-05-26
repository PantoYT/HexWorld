import { create } from 'zustand';
import { User, getMe, saveToken, clearToken, getToken } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  setAuth: async (user, token) => {
    await saveToken(token);
    set({ user, token });
  },

  hydrate: async () => {
    const token = await getToken();
    if (token) {
      try {
        const user = await getMe();
        set({ user, token, hydrated: true });
      } catch {
        await clearToken();
        set({ hydrated: true });
      }
    } else {
      set({ hydrated: true });
    }
  },

  logout: async () => {
    await clearToken();
    set({ user: null, token: null });
  },
}));
