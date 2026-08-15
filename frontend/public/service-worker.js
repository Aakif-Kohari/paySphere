/**
 * @fileoverview Custom Service Worker for Offline Caching & Push Notifications
 * @description Implements caching strategies for static assets, provides a fallback 
 * offline page, and handles Web Push API events for payroll notifications.
 * 
 * Issues: #1022, #1027
 */

const CACHE_NAME = 'paysphere-cache-v1';
const OFFLINE_URL = '/offline.html';

/**
 * Assets to precache during the install phase.
 * Note: If offline.html doesn't exist yet, remove it from this array to prevent SW install failure.
 */
const PRECACHE_ASSETS = [
    '/manifest.json',
    '/favicon.ico'
    // Add OFFLINE_URL here once you create frontend/public/offline.html
];

/**
 * Install Event: Precache essential assets.
 */
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install event triggered');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Precaching app shell');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[ServiceWorker] Precaching failed:', error);
            })
    );
});

/**
 * Activate Event: Clean up old caches.
 */
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate event triggered');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * Fetch Event: Intercept network requests and apply caching strategies.
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Strategy 1: API Requests (Network First, Fallback to Cache)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseToCache = response.clone();
                    if (response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        return new Response(
                            JSON.stringify({ message: 'You are offline and this data is not cached.' }),
                            { headers: { 'Content-Type': 'application/json' }, status: 503 }
                        );
                    });
                })
        );
        return;
    }

    // Strategy 2: Navigation Requests (Network First, Fallback to basic offline response)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Try to serve offline.html if it exists, otherwise return a basic fallback
                    return caches.match(OFFLINE_URL).then((offlineResponse) => {
                        return offlineResponse || new Response('Offline - PaySphere. Please check your internet connection.', {
                            headers: { 'Content-Type': 'text/html' }, status: 503
                        });
                    });
                })
        );
        return;
    }

    // Strategy 3: Static Assets (Stale While Revalidate)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});

/**
 * Listen for messages from the main thread (e.g., to force skip waiting)
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * Push Event: Display notification when a push message is received.
 * Issue: #1027
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        payload = { title: 'PaySphere', body: event.data.text() };
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        data: payload.data || {},
        actions: payload.actions || [],
        vibrate: [100, 50, 100],
        tag: payload.data?.type || 'default' // Group notifications of the same type
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

/**
 * Notification Click: Handle user interaction with the notification.
 * Issue: #1027
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/dashboard';
    const action = event.action;

    if (action === 'dismiss') {
        return; // User clicked dismiss
    }

    // Open the target URL in a new tab or focus existing tab
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
