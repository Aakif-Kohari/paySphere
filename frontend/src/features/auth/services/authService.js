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
};
