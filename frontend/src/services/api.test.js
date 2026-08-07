import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Regressions for #562.
 *
 * The interceptor treated every 403 as a dead session, so an RBAC permission
 * denial — or a misconfigured CORS origin — cleared the token and bounced the
 * user to /auth. These tests drive the interceptor directly: it is registered
 * on the axios instance at import time, so the handler is pulled off the mocked
 * `use()` call rather than reached through a real request.
 */

let rejectedHandler;

vi.mock('axios', () => {
  const instance = {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: {
        use: vi.fn((_fulfilled, rejected) => {
          rejectedHandler = rejected;
        }),
      },
    },
  };

  return {
    default: {
      create: vi.fn(() => instance),
      post: vi.fn(),
    },
  };
});

const loadInterceptor = async () => {
  vi.resetModules();
  await import('./api');
  return rejectedHandler;
};

const failureWith = (status, url = '/api/payroll/approvals') => ({
  config: { url, headers: {} },
  response: { status, data: { message: 'denied' } },
});

let handler;

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('token', 'a-valid-token');
  handler = await loadInterceptor();
});

describe('403 does not end the session (#562)', () => {
  test('keeps the token when a permission check refuses the request', async () => {
    await expect(handler(failureWith(403))).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBe('a-valid-token');
  });

  // Note: there is deliberately no assertion on `window.location` here. jsdom
  // does not implement navigation, so a `location.href = …` assignment would
  // pass whether or not the redirect was removed — the token and the
  // `auth:logout` event are what actually distinguish the two behaviours.

  test('does not fire auth:logout, so Redux keeps the session', async () => {
    const onLogout = vi.fn();
    window.addEventListener('auth:logout', onLogout);

    await expect(handler(failureWith(403))).rejects.toBeDefined();

    window.removeEventListener('auth:logout', onLogout);
    expect(onLogout).not.toHaveBeenCalled();
  });

  test('rejects with the original error so the caller can show the message', async () => {
    const failure = failureWith(403);

    await expect(handler(failure)).rejects.toBe(failure);
  });

  test('a CORS rejection is treated the same way', async () => {
    // app.js answers 403 { message: "CORS not allowed" } for a blocked origin.
    // That is a server misconfiguration, not an expired login.
    const failure = {
      config: { url: '/api/employees', headers: {} },
      response: { status: 403, data: { message: 'CORS not allowed' } },
    };

    await expect(handler(failure)).rejects.toBe(failure);
    expect(localStorage.getItem('token')).toBe('a-valid-token');
  });
});

describe('401 still ends the session', () => {
  test('a failed refresh clears the token', async () => {
    const axios = (await import('axios')).default;
    axios.post.mockRejectedValueOnce(new Error('refresh rejected'));

    await expect(handler(failureWith(401))).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBeNull();
  });

  test('a failed refresh on a background request does not clear token, triggers toast event, and resolves successfully to prevent unhandled rejection', async () => {
    const axios = (await import('axios')).default;
    axios.post.mockRejectedValueOnce(new Error('refresh rejected'));

    const onToast = vi.fn();
    window.addEventListener('toast:show', onToast);

    const bgFailure = {
      config: { url: '/api/notes/autosave', headers: { 'X-Background-Request': 'true' } },
      response: { status: 401, data: { message: 'unauthorized' } },
    };

    const result = await handler(bgFailure);

    window.removeEventListener('toast:show', onToast);

    expect(localStorage.getItem('token')).toBe('a-valid-token');
    expect(onToast).toHaveBeenCalled();
    expect(result.data.success).toBe(false);
    expect(result.data.error).toBe('Session expired');
  });

  test('a 401 on the refresh endpoint itself clears the token', async () => {
    await expect(
      handler(failureWith(401, '/api/auth/refresh')),
    ).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBeNull();
  });

  test('a 403 on the refresh endpoint still clears the token', async () => {
    // This one genuinely is a dead session: the refresh cookie was refused.
    await expect(
      handler(failureWith(403, '/api/auth/refresh')),
    ).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBeNull();
  });

  test('a 401 on login is passed through without clearing anything', async () => {
    // A wrong password must not look like an expired session.
    await expect(
      handler(failureWith(401, '/api/auth/login')),
    ).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBe('a-valid-token');
  });
});

describe('other failures', () => {
  test('a network error with no response is passed straight through', async () => {
    const failure = { config: { url: '/api/employees', headers: {} } };

    await expect(handler(failure)).rejects.toBe(failure);
    expect(localStorage.getItem('token')).toBe('a-valid-token');
  });

  test('a 500 does not touch the session', async () => {
    await expect(handler(failureWith(500))).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBe('a-valid-token');
  });
});
