import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const token = useAppStore((state) => state.token) || localStorage.getItem('token');
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    if (!token) return;

    fetchNotifications();

    // Setup Socket.io real-time listener for WebSocket notification events (#1278)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    socket.on('notification', (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/notifications?limit=25');
      const data = res.data;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id, link) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (link) {
        setIsOpen(false);
        navigate(link);
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/notifications/${id}`);
      const target = notifications.find((n) => n._id === id);
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const filteredNotifications =
    activeTab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  if (!token) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label="Notifications"
        className="relative p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex border-b border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-800/40">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2 text-center transition border-b-2 ${
                activeTab === 'all'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-900'
                  : 'border-transparent hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-2 text-center transition border-b-2 ${
                activeTab === 'unread'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-900'
                  : 'border-transparent hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60">
            {loading ? (
              <p className="p-6 text-center text-xs text-gray-400 dark:text-slate-500">
                Loading notifications…
              </p>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 dark:text-slate-500 space-y-1">
                <p className="font-semibold text-gray-600 dark:text-slate-300">All caught up!</p>
                <p>No notifications match this filter.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleMarkAsRead(notif._id, notif.link)}
                  className={`p-3.5 flex items-start justify-between gap-3 text-left cursor-pointer transition ${
                    !notif.isRead
                      ? 'bg-blue-50/50 dark:bg-blue-950/20'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                        !notif.isRead ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-transparent'
                      }`}
                    />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-xs text-gray-900 dark:text-white truncate">
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-gray-600 dark:text-slate-300 leading-snug line-clamp-2">
                        {notif.message}
                      </p>
                      <span className="block text-[10px] text-gray-400 dark:text-slate-500 pt-0.5">
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, notif._id)}
                    className="text-gray-400 hover:text-red-500 text-xs p-1 rounded opacity-60 hover:opacity-100 transition"
                    title="Delete notification"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
