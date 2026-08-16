import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { logout } from '../features/auth/authSlice';
import api from '../services/api';

const UserIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const LockIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const BellIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function ProfileSettings() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  const localCompanyName = localStorage.getItem('companyName') || 'PaySphere';
  const role = localStorage.getItem('userRole') || 'User';

  const [userProfile, setUserProfile] = useState({
    fullName: '',
    email: '',
    companyName: localCompanyName,
    avatar: '',
    isGoogleLinked: false,
    isTwoFactorEnabled: false,
    payrollId: '',
  });

  const fileInputRef = useRef(null);

  const [settings, setSettings] = useState({
    notifications: {
      emailReminders: true,
      systemAlerts: true,
      payrollCompletion: true,
      featureAnnouncements: false,
    },
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [profileErrors, setProfileErrors] = useState({
    fullName: '',
    email: '',
  });

  // ── 2FA state ──
  const [qrCodeData, setQrCodeData] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  useEffect(() => {
    api
      .get('/api/auth/settings')
      .then((res) => {
        setUserProfile((prev) => ({
          ...prev,
          fullName: res.data.fullName || '',
          email: res.data.email || '',
          companyName: res.data.companyName || localCompanyName,
          avatar: res.data.avatar || '',
          isGoogleLinked: res.data.isGoogleLinked || false,
          isTwoFactorEnabled: res.data.isTwoFactorEnabled || false,
          payrollId: res.data.payrollId || '',
        }));

        if (res.data.settings) {
          setSettings((prev) => ({
            ...prev,
            notifications:
              res.data.settings.notifications || prev.notifications,
          }));
        }
      })
      .catch((err) => console.error('Failed to fetch settings', err))
      .finally(() => setLoading(false));
  }, [localCompanyName]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSaveSettings = async () => {
    const errors = { fullName: '', email: '' };

    if (!userProfile.fullName || !userProfile.fullName.trim()) {
      errors.fullName = 'Full name cannot be empty.';
    }

    if (!userProfile.email || !emailRegex.test(userProfile.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (errors.fullName || errors.email) {
      setProfileErrors(errors);
      return;
    }

    setProfileErrors({ fullName: '', email: '' });

    try {
      await api.patch('/api/auth/settings', {
        settings, // partial updates work with the backend
        fullName: userProfile.fullName.trim(),
        email: userProfile.email.trim(),
        avatar: userProfile.avatar,
      });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error saving profile.');
    }
  };

  const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Please select an image file (JPEG, PNG, WebP, or GIF).');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      alert('File size must be less than 2 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUserProfile((prev) => ({ ...prev, avatar: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordUpdate = async () => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!currentPassword || !newPassword) {
      return alert('Both current and new password are required.');
    }
    if (!passwordRegex.test(newPassword)) {
      return alert(
        'New password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character.',
      );
    }
    try {
      await api.patch('/api/auth/security/password', {
        currentPassword,
        newPassword,
      });
      alert('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating password.');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (
      !window.confirm(
        'Are you sure you want to disconnect your Google account? You will need a password to log in.',
      )
    )
      return;
    try {
      await api.patch('/api/auth/security/disconnect-google');
      alert('Google account disconnected successfully!');
      setUserProfile((prev) => ({ ...prev, isGoogleLinked: false }));
    } catch (err) {
      alert(
        err.response?.data?.message || 'Error disconnecting Google account.',
      );
    }
  };

  const handleSetup2FA = async () => {
    try {
      const res = await api.post('/api/auth/security/2fa/setup');
      setQrCodeData(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error starting 2FA setup.');
    }
  };

  const handleConfirm2FA = async () => {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      return alert('Enter the 6-digit code from your authenticator app.');
    }
    try {
      await api.post('/api/auth/security/2fa/verify', { code: twoFactorCode });
      setUserProfile((prev) => ({ ...prev, isTwoFactorEnabled: true }));
      setQrCodeData(null);
      setTwoFactorCode('');
      alert('Two-factor authentication enabled!');
    } catch (err) {
      alert(err.response?.data?.message || 'Invalid code. Try again.');
    }
  };

  const updateNotificationField = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value },
    }));
  };

  const profileTabs = [
    { id: 'profile', label: 'Profile', icon: <UserIcon /> },
    { id: 'account', label: 'Account Security', icon: <LockIcon /> },
    { id: 'notifications', label: 'Notifications', icon: <BellIcon /> },
  ];

  const getInitials = (name) =>
    (name || '')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Personal Profile
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                Manage your personal information and how it appears.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-800">
              <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg overflow-hidden border-2 border-white dark:border-slate-800">
                {userProfile.avatar ? (
                  <img
                    src={userProfile.avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(userProfile.fullName || 'User')
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {userProfile.fullName || 'Your Name'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-500 mb-4">
                  {role} at {userProfile.companyName}
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Change profile picture"
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                  >
                    Change Picture
                  </button>
                  <button
                    onClick={() =>
                      setUserProfile({ ...userProfile, avatar: '' })
                    }
                    aria-label="Remove profile picture"
                    className="px-4 py-2 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={userProfile.fullName}
                  onChange={(e) =>
                    setUserProfile({ ...userProfile, fullName: e.target.value })
                  }
                  className={`w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-900 border focus:ring-2 outline-none text-sm text-gray-900 dark:text-white transition ${profileErrors.fullName
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-transparent dark:border-slate-800 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                />
                {profileErrors.fullName && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">
                    {profileErrors.fullName}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
                  Email Address
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  onChange={(e) =>
                    setUserProfile({ ...userProfile, email: e.target.value })
                  }
                  className={`w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-900 border focus:ring-2 outline-none text-sm text-gray-900 dark:text-white transition ${profileErrors.email
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-transparent dark:border-slate-800 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                />
                {profileErrors.email && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">
                    {profileErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
                  Payroll ID
                </label>
                <input
                  type="text"
                  value={userProfile.payrollId || 'N/A'}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-800 text-sm text-gray-500 dark:text-slate-500 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
                  Role / Designation
                </label>
                <input
                  type="text"
                  value={role}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-800 text-sm text-gray-500 dark:text-slate-500 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                Save Changes
              </button>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Account Security
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                Manage your password and connected accounts.
              </p>
            </div>

            <div className="p-5 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Change Password
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current Password"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-transparent dark:border-slate-800 outline-none text-sm text-gray-900 dark:text-white"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-transparent dark:border-slate-800 outline-none text-sm text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={handlePasswordUpdate}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                Update Password
              </button>
            </div>

            <div className="p-5 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Two-Factor Authentication (2FA)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Protect your account with TOTP apps like Google
                    Authenticator or Authy.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${userProfile.isTwoFactorEnabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                    }`}
                >
                  {userProfile.isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {!userProfile.isTwoFactorEnabled ? (
                <div>
                  {!qrCodeData ? (
                    <button
                      onClick={handleSetup2FA}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      Setup Two-Factor Authentication
                    </button>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-slate-950 rounded-xl space-y-3">
                      <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                        1. Scan this QR code in Google Authenticator or Authy:
                      </p>
                      <img
                        src={qrCodeData.qrCode}
                        alt="2FA QR Code"
                        className="w-36 h-36 bg-white p-2 rounded-lg border"
                      />
                      <p className="text-xs text-gray-500 font-mono">
                        Secret Key: {qrCodeData.secret}
                      </p>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="6-digit code"
                          aria-label="6-digit two-factor authentication code"
                          className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border text-xs text-center font-bold tracking-widest"
                        />
                        <button
                          onClick={handleConfirm2FA}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                        >
                          Verify & Enable
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓ Two-factor authentication is active on your account.
                </p>
              )}
            </div>

            {userProfile.isGoogleLinked && (
              <div className="p-5 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">
                  Connected Accounts
                </h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-950 rounded-xl">
                  <div className="flex items-center gap-3">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">
                        Google Account
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-500">
                        {userProfile.email || 'No email linked'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectGoogle}
                    aria-label="Disconnect Google Account"
                    className="text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Notifications
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                Manage what events trigger email or push notifications.
              </p>
            </div>

            <div className="border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
              <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Payroll Completion
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    Get alerted when a payroll run is successfully finalized.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    checked={settings.notifications.payrollCompletion}
                    onChange={() =>
                      updateNotificationField(
                        'payrollCompletion',
                        !settings.notifications.payrollCompletion,
                      )
                    }
                    aria-label="Payroll completion notifications"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    System Alerts
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    Alerts for new updates and system changes.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    checked={settings.notifications.systemAlerts}
                    onChange={() =>
                      updateNotificationField(
                        'systemAlerts',
                        !settings.notifications.systemAlerts,
                      )
                    }
                    aria-label="System alert notifications"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Email Reminders
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    Important reminders regarding your account.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    checked={settings.notifications.emailReminders}
                    onChange={() =>
                      updateNotificationField(
                        'emailReminders',
                        !settings.notifications.emailReminders,
                      )
                    }
                    aria-label="Email reminder notifications"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Feature Announcements
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    News on new features and product updates.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    checked={settings.notifications.featureAnnouncements}
                    onChange={() =>
                      updateNotificationField(
                        'featureAnnouncements',
                        !settings.notifications.featureAnnouncements,
                      )
                    }
                    aria-label="Feature announcement notifications"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="p-5 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  Save Notifications
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>Profile Settings | PaySphere</title>
        <meta
          name="description"
          content="Manage your personal profile and preferences."
        />
      </Helmet>
      {loading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 z-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <div className="flex-1 flex flex-col transition-all duration-300">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">
              Profile Settings
            </span>
          </div>

          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-500">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm overflow-hidden">
              {userProfile.avatar ? (
                <img
                  src={userProfile.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(userProfile.fullName || 'User')
              )}
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                localStorage.removeItem('companyName');
                localStorage.removeItem('currency');
                navigate('/auth');
              }}
              className="px-3 py-1.5 text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 flex flex-col items-center">
          <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="sticky top-24 space-y-1">
                {profileTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === tab.id
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-slate-800'
                        : 'text-gray-500 dark:text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/50 hover:text-gray-900 dark:hover:text-white border border-transparent'
                      }`}
                  >
                    <span
                      className={
                        activeTab === tab.id
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-slate-500'
                      }
                    >
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 pb-20">{renderContent()}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
