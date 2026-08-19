import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const removeToast = useCallback((id) => {
    toast.dismiss(id);
  }, []);

  const addToast = useCallback((toastInput) => {
    if (typeof toastInput === 'string') {
      return toast(toastInput);
    }
    const { message, type, severity, title, duration } = toastInput || {};
    const toastType = type || severity || 'info';
    const content = title ? `${title}: ${message}` : message;
    const opts = duration !== undefined ? { duration } : {};

    switch (toastType) {
      case 'success':
        return toast.success(content, opts);
      case 'error':
        return toast.error(content, opts);
      case 'warning':
        return toast(content, { icon: '⚠️', ...opts });
      case 'info':
      default:
        return toast(content, { icon: 'ℹ️', ...opts });
    }
  }, []);

  // Handle global window "toast:show" events (e.g. from axios background interceptors)
  useEffect(() => {
    const handleGlobalToast = (e) => {
      if (e.detail) {
        addToast({
          message: e.detail.message,
          type: e.detail.type || e.detail.severity || 'info',
          title: e.detail.title,
          duration: e.detail.duration,
        });
      }
    };

    window.addEventListener('toast:show', handleGlobalToast);
    return () => window.removeEventListener('toast:show', handleGlobalToast);
  }, [addToast]);

  const toastHelpers = useMemo(() => {
    const fn = (message, options = {}) => {
      if (typeof options === 'object' && options !== null) {
        return addToast({ message, ...options });
      }
      return toast(message);
    };
    fn.success = (message, options = {}) => addToast({ message, type: 'success', ...options });
    fn.error = (message, options = {}) => addToast({ message, type: 'error', ...options });
    fn.warning = (message, options = {}) => addToast({ message, type: 'warning', ...options });
    fn.info = (message, options = {}) => addToast({ message, type: 'info', ...options });
    fn.remove = (id) => removeToast(id);
    fn.dismiss = (id) => removeToast(id);
    return fn;
  }, [addToast, removeToast]);

  const value = useMemo(
    () => ({
      addToast,
      removeToast,
      toast: toastHelpers,
    }),
    [addToast, removeToast, toastHelpers],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0f172a',
            },
          },
          error: {
            iconTheme: {
              primary: '#f43f5e',
              secondary: '#0f172a',
            },
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;

