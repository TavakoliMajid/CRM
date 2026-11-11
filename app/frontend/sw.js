/**
 * CRM Hira - Service Worker for Offline Resilience & PWA Support
 */

const CACHE_NAME = 'crm-hira-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/css/vazirmatn.css',
  '/js/jalali.js',
  '/js/datepicker.js',
  '/js/i18n.js',
  '/js/api.js',
  '/js/components/auth.js',
  '/js/components/dashboard.js',
  '/js/components/patients.js',
  '/js/components/followups.js',
  '/js/components/leads.js',
  '/js/components/payments.js',
  '/js/components/referrals.js',
  '/js/components/sync_backup.js',
  '/js/components/users.js',
  '/js/app.js',
  '/assets/logo.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Pass API requests through network directly
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network first with cache fallback for static assets
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
