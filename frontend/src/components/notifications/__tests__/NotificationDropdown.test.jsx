import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationDropdown from '../NotificationDropdown';

describe('NotificationDropdown Component', () => {
  const sampleNotifications = [
    {
      id: 'notif-1',
      title: 'August Payroll Finalized',
      message: 'Monthly net salary disbursal batches generated successfully.',
      type: 'PAYROLL',
      isRead: false,
      createdAt: '10 mins ago',
      actionUrl: '/payroll/disbursements',
    },
    {
      id: 'notif-2',
      title: 'Leave Request Approved',
      message: 'Your 2-day compensatory off request was approved by your manager.',
      type: 'LEAVE',
      isRead: true,
      createdAt: '2 hours ago',
    },
  ];

  it('renders notifications list with unread counter', () => {
    render(<NotificationDropdown notifications={sampleNotifications} />);

    expect(screen.getByText('Notifications')).toBeDefined();
    expect(screen.getByText('1 new')).toBeDefined();
    expect(screen.getByText('August Payroll Finalized')).toBeDefined();
    expect(screen.getByText('Leave Request Approved')).toBeDefined();
  });

  it('filters to unread notifications when unread tab is selected', () => {
    render(<NotificationDropdown notifications={sampleNotifications} />);

    const unreadTab = screen.getByText('Unread (1)');
    fireEvent.click(unreadTab);

    expect(screen.getByText('August Payroll Finalized')).toBeDefined();
    expect(screen.queryByText('Leave Request Approved')).toBeNull();
  });

  it('calls onMarkAllAsRead when Mark all button is clicked', () => {
    const onMarkAllAsRead = vi.fn();
    render(
      <NotificationDropdown
        notifications={sampleNotifications}
        onMarkAllAsRead={onMarkAllAsRead}
      />,
    );

    const markAllBtn = screen.getByText('Mark all');
    fireEvent.click(markAllBtn);
    expect(onMarkAllAsRead).toHaveBeenCalled();
  });

  it('calls onNotificationClick when a notification item is clicked', () => {
    const onNotificationClick = vi.fn();
    const onMarkAsRead = vi.fn();

    render(
      <NotificationDropdown
        notifications={sampleNotifications}
        onNotificationClick={onNotificationClick}
        onMarkAsRead={onMarkAsRead}
      />,
    );

    fireEvent.click(screen.getByText('August Payroll Finalized'));
    expect(onMarkAsRead).toHaveBeenCalledWith('notif-1');
    expect(onNotificationClick).toHaveBeenCalledWith(sampleNotifications[0]);
  });
});
