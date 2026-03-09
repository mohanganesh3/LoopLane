const CACHE_NAME = 'looplane-cache-v3';
const APP_SHELL_URLS = ['/', '/index.html', '/manifest.json', '/favicon.ico'];

const cacheResponse = async (request, response) => {
    if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
    }

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) =>
                cache.addAll(
                    APP_SHELL_URLS.map((url) => new Request(url, { cache: 'reload' }))
                )
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => cacheResponse('/index.html', response))
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    if (requestUrl.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request).then((response) => cacheResponse(event.request, response));
            })
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => cacheResponse(event.request, response))
            .catch(() => caches.match(event.request))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('looplane-cache')) {
                        return caches.delete(cacheName);
                    }

                    return Promise.resolve();
                })
            )
        ).then(() => self.clients.claim())
    );
});
