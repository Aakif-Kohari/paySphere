/**
 * @fileoverview Custom Service Worker for Offline Caching
 * @description Implements caching strategies for static assets and API routes.
 * Provides a fallback offline page for navigation requests when the network is unavailable.
 * 
 * Issue: #1022
 */

const CACHE_NAME = 'paysphere-cache-v1';
const OFFLINE_URL = '/offline.html';

/**
 * Assets to precache during the install phase.
 * Includes the offline fallback page and core shell assets.
 */
const PRECACHE_ASSETS = [
    OFFLINE_URL,
    '/manifest.json',
    '/favicon.ico'
];

/**
 * Install Event: Precache essential assets.
 */
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install event triggered');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Precaching app shell and offline page');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
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
        }).then(() => {
            // Take control of all open pages immediately
            return self.clients.claim();
        })
    );
});

/**
 * Fetch Event: Intercept network requests and apply caching strategies.
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only handle GET requests
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Strategy 1: API Requests (Network First, Fallback to Cache)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response because it's a stream and can only be consumed once
                    const responseToCache = response.clone();

                    // Cache successful GET responses for offline access
                    if (response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }

                    return response;
                })
                .catch(() => {
                    // Network failed, try to serve from cache
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // If not in cache and network is down, return a generic offline JSON response
                        return new Response(
                            JSON.stringify({ message: 'You are offline and this data is not cached.' }),
                            {
                                headers: { 'Content-Type': 'application/json' },
                                status: 503
                            }
                        );
                    });
                })
        );
        return;
    }

    // Strategy 2: Navigation Requests (Network First, Fallback to Offline Page)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return caches.match(OFFLINE_URL).then((offlineResponse) => {
                        return offlineResponse || new Response('Offline - PaySphere', {
                            headers: { 'Content-Type': 'text/html' },
                            status: 503
                        });
                    });
                })
        );
        return;
    }

    // Strategy 3: Static Assets (Stale While Revalidate)
    // Serve from cache immediately, but update cache in background for next visit
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
