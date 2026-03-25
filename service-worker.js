const CACHE_NAME = 'fail-peribadi-v1.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './firebase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Pasang Service Worker dan simpan fail ke dalam Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Menyimpan fail ke dalam cache...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Bersihkan cache lama jika ada kemas kini
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Memadam cache lama:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Pintas permintaan rangkaian (Network Request) untuk kelajuan
self.addEventListener('fetch', (event) => {
  // Hanya proses permintaan GET dari domain aplikasi sendiri (jangan ganggu Firebase API)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Pulangkan fail dari cache jika ada, jika tidak, muat turun dari internet
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
  );
});
