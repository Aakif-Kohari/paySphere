import * as authService from '../services/authService';
import { useAppStore } from '../../../store/useAppStore';

const useAuth = () => {
  const user = useAppStore((state) => state.user);
  const loading = useAppStore((state) => state.authLoading);
  const error = useAppStore((state) => state.authError);
  const setCredentials = useAppStore((state) => state.setCredentials);
  const setAuthLoading = useAppStore((state) => state.setAuthLoading);
  const setAuthError = useAppStore((state) => state.setAuthError);

  const login = async (credentials) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await authService.login(credentials);
      setCredentials({ user: data.user || null, token: data.token });
    } catch (err) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return { user, loading, error, login };
};

export default useAuth;
