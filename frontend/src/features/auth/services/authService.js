import api from '../../../services/api';

export const login = async (credentials) => {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
};

export const register = async (userData) => {
  const response = await api.post('/api/auth/signup', userData);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('impersonator');
  localStorage.removeItem('isImpersonating');
};

export const impersonateUser = async (targetUserId) => {
  const response = await api.post('/api/auth/impersonate', { targetUserId });
  return response.data;
};

export const stopImpersonation = async () => {
  const response = await api.post('/api/auth/stop-impersonation');
  return response.data;
};
