/**
 * @fileoverview Push Notifications Hook
 * @description Manages notification permissions, service worker subscriptions, 
 * and syncing subscription state with the backend.
 * 
 * Issue: #1027
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Converts a base64 string to a Uint8Array for the applicationServerKey.
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState(Notification.permission);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setIsSupported(supported);

        if (supported && Notification.permission === 'granted') {
            checkSubscriptionStatus();
        }
    }, []);

    const checkSubscriptionStatus = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        } catch (err) {
            console.error('Failed to check subscription status:', err);
        }
    };

    const subscribeToPush = useCallback(async () => {
        if (!isSupported) return;
        setLoading(true);

        try {
            // 1. Request permission
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== 'granted') {
                throw new Error('Permission denied');
            }

            // 2. Get VAPID public key from backend
            const { data } = await api.get('/api/notifications/vapid-public-key');
            const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

            // 3. Subscribe via Service Worker
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            // 4. Send subscription to backend
            await api.post('/api/notifications/subscribe', {
                subscription: subscription.toJSON()
            });

            setIsSubscribed(true);
        } catch (error) {
            console.error('Push subscription failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [isSupported]);

    const unsubscribeFromPush = useCallback(async () => {
        setLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // 1. Unsubscribe from browser
                await subscription.unsubscribe();

                // 2. Notify backend
                await api.post('/api/notifications/unsubscribe', {
                    endpoint: subscription.endpoint
                });
            }

            setIsSubscribed(false);
        } catch (error) {
            console.error('Push unsubscription failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        isSupported,
        permission,
        isSubscribed,
        loading,
        subscribeToPush,
        unsubscribeFromPush
    };
}
