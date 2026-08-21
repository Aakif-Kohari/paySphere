import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: 'http://api.test' } },
  login: vi.fn(),
  io: vi.fn(),
  queryClient: { invalidateQueries: vi.fn() },
  getQueue: vi.fn(),
  removeQueue: vi.fn(),
}));

vi.mock('../../services/api', () => ({ default: mocks.api }));
vi.mock('../../features/auth/services/authService', () => ({ login: mocks.login }));
vi.mock('socket.io-client', () => ({ io: mocks.io }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options) => ({ queryKey: options.queryKey, queryFn: options.queryFn })),
  useQueryClient: vi.fn(() => mocks.queryClient),
}));
vi.mock('../../db/payrollDB', () => ({
  getSyncQueue: mocks.getQueue,
  removeFromSyncQueue: mocks.removeQueue,
}));
vi.mock('react-hot-toast', () => {
  const toast = vi.fn(() => 'toast-id');
  toast.success = vi.fn(() => 'success-id');
  toast.error = vi.fn(() => 'error-id');
  toast.dismiss = vi.fn();
  return { default: toast, Toaster: () => null };
});

import useAuth from '../../features/auth/hooks/useAuth';
import {
  dashboardKeys,
  useDashboardSummary,
  useRecentActivity,
  usePayrollTrend,
  useInvalidateDashboard,
} from '../useDashboardData';
import { useFocusTrap } from '../useFocusTrap';
import { useIsMobile } from '../useIsMobile';
import { useJobProgress } from '../useJobProgress';
import useLocalStorage from '../useLocalStorage';
import { useNetworkStatus } from '../useNetworkStatus';
import { usePushNotifications } from '../usePushNotifications';
import { useCtrlEnterSubmit } from '../useCtrlEnterSubmit';
import useVirtual from '../useVirtual';
import { useToast, ToastProvider } from '../../context/ToastContext';
import { useAppStore } from '../../store/useAppStore';

const ToastWrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});


describe('useAppStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      themeMode: 'light',
      notification: { open: false, message: '', severity: 'info' },
    });
  });

  test('updates credentials and authentication state', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => result.current.setCredentials({ user: { id: 'u1' }, token: 'token-1' }));
    expect(result.current.user).toEqual({ id: 'u1' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('token')).toBe('token-1');
  });

  test('toggles theme and persists the selected mode', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => result.current.toggleTheme());
    expect(result.current.themeMode).toBe('dark');
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });
});

describe('useAuth', () => {
  beforeEach(() => useAppStore.setState({ user: null, authLoading: false, authError: null }));

  test('stores credentials after a successful login', async () => {
    mocks.login.mockResolvedValue({ user: { id: 'u1' }, token: 'token-1' });
    const { result } = renderHook(() => useAuth());

    await act(async () => result.current.login({ email: 'user@example.com', password: 'secret' }));

    expect(result.current.user).toEqual({ id: 'u1' });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(localStorage.getItem('token')).toBe('token-1');
  });

  test('exposes login errors and clears loading state', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid credentials'));
    const { result } = renderHook(() => useAuth());

    await act(async () => result.current.login({ email: 'bad@example.com', password: 'bad' }));

    expect(result.current.error).toBe('Invalid credentials');
    expect(result.current.loading).toBe(false);
  });
});

describe('useDashboardData', () => {
  test('builds stable query keys', () => {
    expect(dashboardKeys.summary()).toEqual(['dashboard', 'summary']);
    expect(dashboardKeys.recentActivity()).toEqual(['dashboard', 'recent-activity']);
    expect(dashboardKeys.payrollTrend(6)).toEqual(['dashboard', 'payroll-trend', 6]);
  });

  test('uses expected API endpoints and defaults', async () => {
    mocks.api.get.mockResolvedValue({ data: { ok: true } });
    const summary = useDashboardSummary();
    const activity = useRecentActivity();
    const trend = usePayrollTrend();

    expect(summary.queryKey).toEqual(['dashboard', 'summary']);
    expect(activity.queryKey).toEqual(['dashboard', 'recent-activity', 10]);
    expect(trend.queryKey).toEqual(['dashboard', 'payroll-trend', 6]);

    await summary.queryFn();
    await activity.queryFn();
    await trend.queryFn();

    expect(mocks.api.get).toHaveBeenNthCalledWith(1, '/api/dashboard/summary');
    expect(mocks.api.get).toHaveBeenNthCalledWith(2, '/api/dashboard/recent-activity?limit=10');
    expect(mocks.api.get).toHaveBeenNthCalledWith(3, '/api/reports/analytics?months=6');
  });

  test('invalidates dashboard queries', () => {
    const { result } = renderHook(() => useInvalidateDashboard());
    act(() => result.current());
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });
});

describe('useFocusTrap', () => {
  test('returns a container ref and does not activate when closed', () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current.current).toBeNull();
  });

  test('locks body scrolling while open and restores it on unmount', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = renderHook(() => useFocusTrap(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});

describe('useIsMobile', () => {
  test('responds to media-query changes and resize events', () => {
    let changeHandler;
    window.innerWidth = 500;
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => changeHandler({ matches: false }));
    expect(result.current).toBe(false);

    window.innerWidth = 700;
    act(() => window.dispatchEvent(new Event('resize')));
    expect(result.current).toBe(true);
  });
});

describe('useJobProgress', () => {
  test('starts a job and handles matching completion events', () => {
    const socket = { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), emit: vi.fn() };
    mocks.io.mockReturnValue(socket);
    const { result } = renderHook(() => useJobProgress('payroll'));

    act(() => result.current.startJob({ employeeId: 'e1' }));
    expect(socket.connect).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('startJob', {
      jobType: 'payroll',
      data: { employeeId: 'e1' },
    });

    const onProgress = socket.on.mock.calls[0][1];
    act(() => onProgress({ jobType: 'other', percent: 10, status: 'running', message: 'ignore' }));
    expect(result.current.progress.status).toBe('starting');

    act(() => onProgress({ jobType: 'payroll', percent: 100, status: 'completed', message: 'done' }));
    expect(result.current.progress).toEqual({ percent: 100, status: 'completed', message: 'done' });
    expect(socket.disconnect).toHaveBeenCalled();
  });
});

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  test('reads persisted values and supports functional updates', () => {
    localStorage.setItem('count', JSON.stringify(2));
    const { result } = renderHook(() => useLocalStorage('count', 0));
    expect(result.current[0]).toBe(2);

    act(() => result.current[1]((value) => value + 3));
    expect(result.current[0]).toBe(5);
    expect(JSON.parse(localStorage.getItem('count'))).toBe(5);
  });
});

describe('useNetworkStatus', () => {
  test('loads queue length and responds to online/offline events', async () => {
    mocks.getQueue.mockResolvedValue([{ id: 1 }]);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {});
    expect(result.current.isOnline).toBe(true);
    expect(result.current.queueLength).toBe(1);

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.isOnline).toBe(false);
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current.isOnline).toBe(true);
  });
});

describe('usePushNotifications', () => {
  test('reports unsupported environments without making API calls', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: { permission: 'denied', requestPermission: vi.fn() },
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {});
    expect(result.current.isSupported).toBe(false);
    await act(async () => result.current.subscribeToPush());
    expect(mocks.api.get).not.toHaveBeenCalled();
  });
});

describe('useCtrlEnterSubmit', () => {
  test('submits on Ctrl+Enter', () => {
    const form = { requestSubmit: vi.fn() };
    renderHook(() => useCtrlEnterSubmit({ current: form }));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })));
    expect(form.requestSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('useVirtual', () => {
  test('calculates virtual item indexes using item height and overscan', () => {
    const { result } = renderHook(() => useVirtual({ itemCount: 20, itemHeight: 50, overscan: 2 }));
    expect(result.current.virtualItems[0].index).toBe(0);
    expect(result.current.virtualItems.at(-1).index).toBeGreaterThan(9);
    expect(result.current.containerRef.current).toBeNull();
  });
});

describe('useToast', () => {
  test('exposes toast helpers inside ToastProvider', () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastWrapper });
    expect(result.current.addToast).toEqual(expect.any(Function));
    expect(result.current.removeToast).toEqual(expect.any(Function));
    expect(result.current.toast.success).toEqual(expect.any(Function));
    expect(result.current.toast.error).toEqual(expect.any(Function));
  });

  test('throws when used outside ToastProvider', () => {
    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within a ToastProvider');
  });
});
