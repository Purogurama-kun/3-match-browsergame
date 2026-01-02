/// <reference lib="webworker" />

import { PRECACHE_URLS } from './precache-manifest.js';

const CACHE_NAME = 'explosive-candy-cache-v1';
const RUNTIME_CACHE = 'explosive-candy-runtime-v1';
const FALLBACK_URL = '/index.html';
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(Array.from(PRECACHE_URLS));
            await sw.skipWaiting();
        })()
    );
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME && name !== RUNTIME_CACHE) {
                        return caches.delete(name);
                    }
                    return Promise.resolve();
                })
            );
            await sw.clients.claim();
        })()
    );
});

sw.addEventListener('fetch', (event: FetchEvent) => {
    if (event.request.method !== 'GET') {
        return;
    }
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    if (requestUrl.pathname.startsWith('/backend')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request)
                .then((networkResponse) => {
                    if (!networkResponse || networkResponse.status >= 400) {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    void caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match(FALLBACK_URL).then((fallback) => {
                            return (
                                fallback ??
                                new Response('Offline', {
                                    status: 503,
                                    statusText: 'Offline'
                                })
                            );
                        });
                    }
                    return new Response('Offline', { status: 503, statusText: 'Offline' });
                });
        })
    );
});
