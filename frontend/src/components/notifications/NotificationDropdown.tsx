import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  DollarSign,
  Calendar,
  Receipt,
  ShieldAlert,
  Info,
  ExternalLink,
  X,
} from 'lucide-react';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'PAYROLL' | 'LEAVE' | 'EXPENSE' | 'COMPLIANCE' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDropdownProps {
  notifications: AppNotification[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notification: AppNotification) => void;
  onViewAll?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications = [],
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  onViewAll,
  isOpen = true,
  onClose,
}) => {
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  if (!isOpen) return null;

  const countUnread = unreadCount !== undefined
    ? unreadCount
    : notifications.filter((n) => !n.isRead).length;

  const displayedNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const getTypeIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'PAYROLL':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'LEAVE':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'EXPENSE':
        return <Receipt className="w-4 h-4 text-purple-400" />;
      case 'COMPLIANCE':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeBadgeColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'PAYROLL':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'LEAVE':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'EXPENSE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'COMPLIANCE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-700';
    }
  };

  return (
    <div
      data-testid="notification-dropdown"
      className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-slate-100 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">Notifications</h3>
          {countUnread > 0 && (
            <span className="bg-indigo-500/20 text-indigo-400 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
              {countUnread} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {countUnread > 0 && onMarkAllAsRead && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[11px] font-mono text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/50 flex items-center gap-2 text-xs font-mono">
        <button
          type="button"
          onClick={() => setFilterUnreadOnly(false)}
          className={`px-2.5 py-1 rounded-lg transition ${
            !filterUnreadOnly
              ? 'bg-slate-800 text-slate-100 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterUnreadOnly(true)}
          className={`px-2.5 py-1 rounded-lg transition ${
            filterUnreadOnly
              ? 'bg-slate-800 text-slate-100 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Unread ({countUnread})
        </button>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
        {displayedNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No notifications to display
          </div>
        ) : (
          displayedNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                onMarkAsRead?.(notif.id);
                onNotificationClick?.(notif);
              }}
              className={`p-3.5 transition flex items-start gap-3 cursor-pointer ${
                notif.isRead
                  ? 'hover:bg-slate-800/40 bg-transparent'
                  : 'bg-indigo-950/20 hover:bg-indigo-950/30'
              }`}
            >
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                {getTypeIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold border ${getTypeBadgeColor(notif.type)}`}>
                    {notif.type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{notif.createdAt}</span>
                </div>

                <h4 className={`text-xs font-semibold leading-snug mb-0.5 ${notif.isRead ? 'text-slate-300' : 'text-white'}`}>
                  {notif.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>

                {notif.actionUrl && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:underline">
                    <span>View details</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                )}
              </div>

              {!notif.isRead && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {onViewAll && (
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-950 text-center">
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition py-1"
          >
            View all notification activity
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
