/**
 * World-class Service Worker
 * Offline-first with intelligent caching strategies
 */

const CACHE_NAME = 'mangalm-sales-v1';
const DYNAMIC_CACHE_NAME = 'mangalm-sales-dynamic-v1';
const API_CACHE_NAME = 'mangalm-sales-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html',
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/users\/profile/,
  /\/api\/v1\/products/,
  /\/api\/v1\/territories/,
  /\/api\/v1\/customers\/list/,
];

// Network timeout in milliseconds
const NETWORK_TIMEOUT = 5000;

// Cache size limits
const MAX_CACHE_SIZE = 50;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && 
                     cacheName !== DYNAMIC_CACHE_NAME && 
                     cacheName !== API_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - Network First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Static assets - Cache First with Network Fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // HTML pages - Network First with Offline Page Fallback
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default - Network First with Cache Fallback
  event.respondWith(handleDefaultRequest(request));
});

// Handle API requests with intelligent caching
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  // Check if this API endpoint should be cached
  const shouldCache = CACHEABLE_API_PATTERNS.some(pattern => 
    pattern.test(request.url)
  );

  try {
    // Try network first with timeout
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT);
    
    // Cache successful responses
    if (networkResponse.ok && shouldCache) {
      // Clone response before caching
      cache.put(request, networkResponse.clone());
      
      // Clean up old cache entries
      cleanupCache(API_CACHE_NAME, MAX_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] API request failed, trying cache:', error);
    
    // Try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Check if cached response is not too old
      const cachedDate = cachedResponse.headers.get('date');
      if (cachedDate && !isExpired(cachedDate, MAX_AGE)) {
        console.log('[ServiceWorker] Serving from API cache');
        return cachedResponse;
      }
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: 'Network error', 
        offline: true,
        message: 'Unable to fetch data. Please check your connection.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static asset requests
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[ServiceWorker] Serving static asset from cache');
    return cachedResponse;
  }

  // Try network
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Failed to fetch static asset:', error);
    // Return 404 for missing static assets
    return new Response('Not Found', { status: 404 });
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first with timeout
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT);
    
    if (networkResponse.ok) {
      // Update dynamic cache
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      cleanupCache(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Navigation failed, trying cache');
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Final fallback
    return new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle default requests
async function handleDefaultRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses in dynamic cache
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      cleanupCache(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error
    return new Response('Network error', { status: 503 });
  }
}

// Fetch with timeout
function fetchWithTimeout(request, timeout) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

// Check if resource is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.ico', '.webp'
  ];
  
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Check if cached response is expired
function isExpired(dateString, maxAge) {
  const cachedDate = new Date(dateString);
  const now = new Date();
  return (now - cachedDate) > maxAge;
}

// Clean up cache to maintain size limit
async function cleanupCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  
  if (requests.length > maxSize) {
    // Sort by date (oldest first) and remove excess
    const sortedRequests = requests.sort((a, b) => {
      // This is simplified - in production, you'd track access times
      return 0;
    });
    
    const toDelete = sortedRequests.slice(0, requests.length - maxSize);
    for (const request of toDelete) {
      await cache.delete(request);
    }
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered');
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    // Get all clients
    const clients = await self.clients.matchAll();
    
    // Send message to all clients about sync
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED',
        timestamp: Date.now()
      });
    });
    
    // Perform sync operations here
    // This would sync any queued offline actions
    
    // Notify clients of completion
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      timestamp: Date.now(),
      url: '/'
    },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Mangalm Sales', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Message handling for client communication
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});