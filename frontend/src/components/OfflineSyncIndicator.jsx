/**
 * @fileoverview Offline Sync Indicator Component
 * @description Displays a persistent banner when the app is offline or 
 * syncing queued mutations. Shows the number of pending changes.
 * 
 * Issue: #815
 */

import { useNetworkStatus } from '../hooks/useNetworkStatus';
import SyncIcon from '@mui/icons-material/Sync';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import WifiOffIcon from '@mui/icons-material/WifiOff';

export default function OfflineSyncIndicator() {
    const { isOnline, isSyncing, queueLength, forceSync } = useNetworkStatus();

    // Don't render if online and queue is empty
    if (isOnline && queueLength === 0 && !isSyncing) {
        return null;
    }

    return (
        <div
            className={`
        fixed bottom-4 right-4 z-50 
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg 
        transition-all duration-300 ease-in-out
        ${isOnline
                    ? 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                    : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                }
      `}
            role="status"
            aria-live="polite"
        >
            {isOnline ? (
                <SyncIcon className={`${isSyncing ? 'animate-spin' : ''} text-amber-600 dark:text-amber-400`} />
            ) : (
                <WifiOffIcon className="text-red-600 dark:text-red-400" />
            )}

            <div className="flex flex-col">
                <span className="text-sm font-semibold">
                    {isOnline
                        ? (isSyncing ? 'Syncing changes...' : 'Back online')
                        : 'You are offline'}
                </span>
                {queueLength > 0 && (
                    <span className="text-xs opacity-80">
                        {queueLength} pending change{queueLength !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {isOnline && queueLength > 0 && !isSyncing && (
                <button
                    onClick={forceSync}
                    className="ml-2 px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
                >
                    Sync Now
                </button>
            )}
        </div>
    );
}
