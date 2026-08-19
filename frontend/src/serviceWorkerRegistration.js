/**
 * @fileoverview Service Worker Registration Logic
 * @description Handles the registration, update prompts, and lifecycle management 
 * of the custom service worker in a Vite/React environment.
 * 
 * Issue: #1022
 */

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

/**
 * Registers the service worker if supported by the browser.
 * @param {Object} config - Configuration callbacks
 * @param {Function} config.onUpdate - Called when a new SW is waiting to activate
 * @param {Function} config.onSuccess - Called when SW is successfully registered and cached
 */
export function register(config) {
    if ('serviceWorker' in navigator) {
        const publicUrl = new URL(import.meta.env.BASE_URL || '/', window.location.href);
        if (publicUrl.origin !== window.location.origin) {
            return;
        }

        window.addEventListener('load', () => {
            const swUrl = `${import.meta.env.BASE_URL || '/'}service-worker.js`;

            if (isLocalhost) {
                checkValidServiceWorker(swUrl, config);
                navigator.serviceWorker.ready.then(() => {
                    console.log('[SW] This web app is being served cache-first by a service worker.');
                });
            } else {
                registerValidSW(swUrl, config);
            }
        });
    }
}

/**
 * Registers a valid service worker and handles update prompts.
 */
function registerValidSW(swUrl, config) {
    navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker == null) return;

                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New content is available; inform the user
                            console.log('[SW] New content is available and will be used when all tabs are closed.');
                            if (config && config.onUpdate) {
                                config.onUpdate(registration);
                            }
                        } else {
                            // Content is cached for offline use
                            console.log('[SW] Content is cached for offline use.');
                            if (config && config.onSuccess) {
                                config.onSuccess(registration);
                            }
                        }
                    }
                };
            };
        })
        .catch((error) => {
            console.error('[SW] Error during service worker registration:', error);
        });
}

/**
 * Checks if the service worker file exists and is valid (for localhost dev).
 */
function checkValidServiceWorker(swUrl, config) {
    fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
        .then((response) => {
            const contentType = response.headers.get('content-type');
            if (response.status === 404 || (contentType != null && contentType.indexOf('javascript') === -1)) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.unregister().then(() => {
                        window.location.reload();
                    });
                });
            } else {
                registerValidSW(swUrl, config);
            }
        })
        .catch(() => {
            console.log('[SW] No internet connection found. App is running in offline mode.');
        });
}

/**
 * Unregisters the service worker (useful for development/debugging).
 */
export function unregister() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then((registration) => {
                registration.unregister();
            })
            .catch((error) => {
                console.error(error.message);
            });
    }
}