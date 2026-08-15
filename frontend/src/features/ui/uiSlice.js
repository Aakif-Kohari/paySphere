import { createSlice } from '@reduxjs/toolkit';

const getInitialThemeMode = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.localStorage.getItem('themeMode') || 'light';
};

const initialState = {
  themeMode: getInitialThemeMode(),
  isLoading: false,
  notification: {
    open: false,
    message: '',
    severity: 'info', // 'error' | 'warning' | 'info' | 'success'
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', state.themeMode);
    },
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
      localStorage.setItem('themeMode', state.themeMode);
    },
    setGlobalLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    showNotification: (state, action) => {
      state.notification = {
        open: true,
        message: action.payload.message,
        severity: action.payload.severity || 'info',
      };
    },
    hideNotification: (state) => {
      state.notification.open = false;
    },
  },
});

export const {
  toggleTheme,
  setThemeMode,
  setGlobalLoading,
  showNotification,
  hideNotification,
} = uiSlice.actions;

export default uiSlice.reducer;
