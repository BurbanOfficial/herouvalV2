// Hérouval Control - Service Worker
const CACHE_NAME = 'herouval-control-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './agent.html',
    './caisse.html',
    './operateurs.html',
    './bureaux.html',
    './styles.css',
    './app.js',
    './manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Firebase and external API requests
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis') ||
        url.hostname.includes('cdnjs') ||
        url.hostname.includes('unpkg')) {
        return;
    }

    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // Return cached response if available
            if (cachedResponse) {
                return cachedResponse;
            }

            // Otherwise fetch from network
            return fetch(request)
                .then(response => {
                    // Cache successful responses
                    if (response.status === 200 && response.type === 'basic') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(error => {
                    console.log('Fetch failed:', error);
                    // Return offline fallback if available
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    throw error;
                });
        })
    );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-groups') {
        event.waitUntil(syncGroups());
    }
});

// Push notifications (optional)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: './icon-192x192.png',
                badge: './icon-72x72.png',
                tag: data.tag || 'herouval-notification'
            })
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('./bureaux.html')
    );
});

async function syncGroups() {
    // Implement offline sync logic here
    console.log('Background sync executed');
}
