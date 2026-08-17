import { create } from 'zustand';
import api from '../services/api';

const getInitialThemeMode = () =>
  typeof window === 'undefined' ? 'light' : window.localStorage.getItem('themeMode') || 'light';

/** Central application state. Actions live beside their state, so no provider,
 * action creators, reducers, or dispatch calls are required. */
export const useAppStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: Boolean(localStorage.getItem('token')),
  authLoading: false,
  authError: null,
  profile: null,
  userLoading: false,
  userError: null,
  themeMode: getInitialThemeMode(),
  isGlobalLoading: false,
  notification: { open: false, message: '', severity: 'info' },

  setCredentials: ({ user, token }) => {
    if (token) localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true, authError: null });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, authError: null });
  },
  logoutUser: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Logging out locally must still succeed when the server is unavailable.
    } finally {
      get().logout();
    }
  },
  setAuthLoading: (authLoading) => set({ authLoading }),
  setAuthError: (authError) => set({ authError, authLoading: false }),
  clearAuthError: () => set({ authError: null }),

  setProfile: (profile) => set({ profile, userLoading: false, userError: null }),
  updateProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
  clearUser: () => set({ profile: null, userError: null }),
  setUserLoading: (userLoading) => set({ userLoading }),
  setUserError: (userError) => set({ userError, userLoading: false }),

  toggleTheme: () => set((state) => {
    const themeMode = state.themeMode === 'light' ? 'dark' : 'light';
    localStorage.setItem('themeMode', themeMode);
    return { themeMode };
  }),
  setThemeMode: (themeMode) => {
    localStorage.setItem('themeMode', themeMode);
    set({ themeMode });
  },
  setGlobalLoading: (isGlobalLoading) => set({ isGlobalLoading }),
  showNotification: ({ message, severity = 'info' }) =>
    set({ notification: { open: true, message, severity } }),
  hideNotification: () => set((state) => ({ notification: { ...state.notification, open: false } })),
}));
