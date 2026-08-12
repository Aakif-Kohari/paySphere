/**
 * @fileoverview Network Status Hook
 * @description Monitors the browser's online/offline status and triggers
 * background sync when connection is restored.
 * 
 * Issue: #815
 */

import { useState, useEffect, useCallback } from 'react';
import { getSyncQueue, removeFromSyncQueue } from '../db/payrollDB';
import api from '../services/api';

/**
 * Hook to track network status and manage background sync
 * @returns {Object} { isOnline, isSyncing, queueLength, forceSync }
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [queueLength, setQueueLength] = useState(0);

    // Update queue length on mount and after sync
    const updateQueueLength = useCallback(async () => {
        const queue = await getSyncQueue();
        setQueueLength(queue.length);
    }, []);

    useEffect(() => {
        updateQueueLength();
    }, [updateQueueLength]);

    /**
     * Processes the sync queue, retrying failed API calls
     */
    const processSyncQueue = useCallback(async () => {
        if (isSyncing) return; // Prevent concurrent syncs

        const queue = await getSyncQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        console.log(`[Sync] Processing ${queue.length} queued items...`);

        for (const item of queue) {
            try {
                // Retry the API call
                await api({
                    url: item.endpoint,
                    method: item.method,
                    data: item.payload,
                });

                // Success: remove from queue
                await removeFromSyncQueue(item.id);
                console.log(`[Sync] Successfully synced: ${item.endpoint}`);
            } catch (error) {
                console.error(`[Sync] Failed to sync ${item.endpoint}:`, error);
                // If it's a 4xx error (client error), remove it to prevent infinite loops
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    await removeFromSyncQueue(item.id);
                }
                // If 5xx or network error, leave in queue for next retry
                break; // Stop processing on first failure to preserve order
            }
        }

        setIsSyncing(false);
        updateQueueLength();
    }, [isSyncing, updateQueueLength]);

    useEffect(() => {
        const handleOnline = () => {
            console.log('[Network] Back online. Triggering sync...');
            setIsOnline(true);
            processSyncQueue();
        };

        const handleOffline = () => {
            console.log('[Network] Gone offline.');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [processSyncQueue]);

    return {
        isOnline,
        isSyncing,
        queueLength,
        forceSync: processSyncQueue,
    };
}
