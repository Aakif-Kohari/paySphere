/**
 * @fileoverview Notification Settings Component
 * @description UI toggle for enabling/disabling push notifications for payroll updates.
 * Issue: #1027
 */
import { usePushNotifications } from '../hooks/usePushNotifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';

export default function NotificationSettings() {
    const { isSupported, permission, isSubscribed, loading, subscribeToPush, unsubscribeFromPush } = usePushNotifications();

    if (!isSupported) {
        return (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                Your browser does not support push notifications.
            </div>
        );
    }

    const handleToggle = async () => {
        try {
            if (isSubscribed) {
                await unsubscribeFromPush();
            } else {
                await subscribeToPush();
            }
        } catch (err) {
            // Error handling is done in the hook
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${isSubscribed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-slate-700'}`}>
                    {isSubscribed ? (
                        <NotificationsActiveIcon className="text-green-600 dark:text-green-400" />
                    ) : (
                        <NotificationsOffIcon className="text-gray-500 dark:text-slate-400" />
                    )}
                </div>

                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Push Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Receive instant alerts on your device when your monthly payslip is generated or payroll is finalized.
                    </p>

                    {permission === 'denied' && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                            Notifications are blocked. Please enable them in your browser settings to use this feature.
                        </p>
                    )}
                </div>

                <button
                    onClick={handleToggle}
                    disabled={loading || permission === 'denied'}
                    className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
            disabled:cursor-not-allowed disabled:opacity-50
            ${isSubscribed ? 'bg-brand-600' : 'bg-gray-200 dark:bg-slate-600'}
          `}
                    role="switch"
                    aria-checked={isSubscribed}
                    aria-label="Toggle push notifications"
                >
                    <span
                        className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
              ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}
            `}
                    />
                </button>
            </div>
        </div>
    );
}
