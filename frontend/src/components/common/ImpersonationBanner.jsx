import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { stopImpersonation } from '../../features/auth/services/authService';

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonator, user, stopImpersonationSession, showNotification } =
    useAppStore();
  const [loading, setLoading] = useState(false);

  if (!isImpersonating) return null;

  const handleStopImpersonation = async () => {
    try {
      setLoading(true);
      const res = await stopImpersonation();
      stopImpersonationSession({ user: res.user, token: res.token });
      showNotification({
        message: 'Impersonation session ended. Switched back to Superadmin.',
        severity: 'success',
      });
      window.location.href = '/';
    } catch (err) {
      showNotification({
        message: err.response?.data?.message || 'Failed to stop impersonation',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#b91c1c',
        color: '#ffffff',
        padding: '0.625rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        fontWeight: 600,
        fontSize: '0.875rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }}
      data-testid="impersonation-banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
        <span>
          <strong>IMPERSONATION ACTIVE:</strong> Logged in as{' '}
          <em>{user?.fullName || user?.email || 'User'}</em>. Actions logged under Superadmin:{' '}
          <strong>{impersonator?.fullName || impersonator?.email || 'Superadmin'}</strong>.
        </span>
      </div>
      <button
        onClick={handleStopImpersonation}
        disabled={loading}
        style={{
          backgroundColor: '#ffffff',
          color: '#b91c1c',
          border: 'none',
          padding: '0.35rem 0.85rem',
          borderRadius: '4px',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {loading ? 'Exiting...' : 'Exit Impersonation'}
      </button>
    </div>
  );
};

export default ImpersonationBanner;
