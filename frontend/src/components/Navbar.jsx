import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import api from '../services/api';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  // Check if user is authenticated (token or session exists)
  const isAuthenticated =
    !!localStorage.getItem('token') || !!localStorage.getItem('user');

  // Every call in this component was missing the `/api` prefix (#898). `api` is
  // created with `baseURL` set to the API *origin* — `http://localhost:5000` —
  // and every other caller in the app writes `/api/...`, so these resolved to
  // `/notifications`, `/notifications/:id/read` and `/notifications/read-all`,
  // and 404'd. The fetch swallows its errors, so the bell read "No
  // notifications yet" for that reason on top of there being nothing to fetch.
  //
  // Declared above the effect that calls it, and memoised, because it was
  // hoisted into the effect from below — which ESLint has been flagging as
  // `Cannot access variable before it is declared`. Harmless today only because
  // the function closes over nothing that changes.
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications');
      if (res.data && res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Ignore errors if unauthenticated or offline
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    // Optimistic. A notification the reader has dismissed should go at once;
    // the cost of being wrong is that the next poll brings it back.
    const previous = notifications;
    const removed = notifications.find((n) => n._id === id);
    setNotifications(notifications.filter((n) => n._id !== id));
    if (removed && !removed.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await api.delete(`/api/notifications/${id}`);
    } catch (err) {
      setNotifications(previous);
      if (removed && !removed.isRead) setUnreadCount((prev) => prev + 1);
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await api.patch('/api/notifications/read-all');
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      // Reconciled against what the server actually changed rather than
      // assumed. Falling back to 0 keeps the badge honest against a backend
      // that answers without a count.
      setUnreadCount((prev) =>
        typeof res.data?.modifiedCount === 'number'
          ? Math.max(0, prev - res.data.modifiedCount)
          : 0,
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/85 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-20 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <div className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900 dark:text-white">
            <img
              src="/logo.png"
              alt="PaySphere Logo"
              className="w-14 h-14 sm:w-20 sm:h-20 object-contain"
            />
            PaySphere
          </div>

          {/* Desktop Menu */}
          <ul className="hidden md:flex gap-6 lg:gap-8 text-[14px] lg:text-[15px] font-medium text-gray-600 dark:text-slate-300">
            <a
              href="#features"
              className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Features
            </a>
            <a
              href="#process"
              className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Process
            </a>
            <a
              href="#pricing"
              className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              FAQ
            </a>
          </ul>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-3 lg:gap-4">
          <ThemeToggle />

          {/* Notification Bell (Only if authenticated) */}
          {isAuthenticated && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                aria-label="Notifications"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl py-3 z-50">
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-gray-500 dark:text-slate-400 text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          className={`p-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50 flex gap-3 items-start ${
                            !notif.isRead
                              ? 'bg-blue-50/50 dark:bg-blue-950/20'
                              : ''
                          }`}
                        >
                          <div className="flex-1">
                            <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                              {notif.title}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                              {notif.message}
                            </p>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 block">
                              {new Date(notif.createdAt).toLocaleTimeString(
                                [],
                                { hour: '2-digit', minute: '2-digit' },
                              )}{' '}
                              - {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                            {/* `link` is a client-side path the service sets
                                alongside the message, so a notification about a
                                payroll run lands on payroll rather than leaving
                                the reader to go and find it. */}
                            {notif.link && (
                              <Link
                                to={notif.link}
                                onClick={() => {
                                  setShowNotifications(false);
                                  if (!notif.isRead)
                                    handleMarkAsRead(notif._id);
                                }}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1 inline-block"
                              >
                                View
                              </Link>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!notif.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(notif._id)}
                                className="w-2 h-2 rounded-full bg-blue-600 mt-1"
                                title="Mark as read"
                              />
                            )}
                            <button
                              onClick={() => handleDelete(notif._id)}
                              className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 text-xs leading-none px-1"
                              title="Dismiss"
                              aria-label={`Dismiss notification: ${notif.title}`}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <Link
            to="/auth?mode=login"
            className="text-[15px] font-semibold px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200 rounded-lg transition-colors"
          >
            Login
          </Link>
          <Link
            to="/auth?mode=signup"
            className="bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            className="flex flex-col gap-1 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            <span className="w-6 h-0.5 bg-black dark:bg-white transition-colors"></span>
            <span className="w-6 h-0.5 bg-black dark:bg-white transition-colors"></span>
            <span className="w-6 h-0.5 bg-black dark:bg-white transition-colors"></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-6 pb-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 transition-colors duration-200">
          <ul className="flex flex-col gap-4 text-[15px] font-medium text-gray-700 dark:text-slate-200 mt-4 mb-6">
            <a
              href="#features"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsOpen(false)}
            >
              Features
            </a>
            <a
              href="#process"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsOpen(false)}
            >
              Process
            </a>
            <a
              href="#pricing"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsOpen(false)}
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsOpen(false)}
            >
              FAQ
            </a>
          </ul>

          <div className="flex items-center gap-4">
            <Link
              to="/auth?mode=login"
              className="flex-1 text-center text-[15px] font-semibold px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-slate-200 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Login
            </Link>
            <Link
              to="/auth?mode=signup"
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              onClick={() => setIsOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
