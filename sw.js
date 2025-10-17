// Define un nombre y versión para el caché
const CACHE_NAME = 'inventario-pro-cache-v1';
// Lista de archivos que componen el "App Shell" y que queremos cachear
const urlsToCache = [
  '.', // Alias para index.html
  'index.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'logo.png', // Asumiendo que tu logo está local
  'logo-192.png', // Ícono PWA
  'logo-512.png', // Ícono PWA
  // Archivos externos (CDN) - Opcional, pero mejora la carga offline si se cachean
  // Nota: Cachear recursos de terceros puede ser complicado si cambian o tienen cabeceras CORS estrictas.
  // Es más seguro depender del caché del navegador para estos, a menos que sepas que son estables.
  // 'https://cdn.tailwindcss.com', // Tailwind es grande, cachearlo puede ser beneficioso pero riesgoso si cambia
  // 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  // 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  // 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  // 'https://unpkg.com/html5-qrcode',
  // 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  // Fuentes de Google Fonts - También complicado de cachear directamente, mejor dejar al navegador
  // 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Evento 'install': Se dispara cuando el SW se instala por primera vez.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  // Espera hasta que la promesa se resuelva
  event.waitUntil(
    // Abre el caché con el nombre definido
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierto, añadiendo App Shell');
        // Añade todas las URLs definidas al caché
        // 'addAll' es atómico: si falla un archivo, no se añade ninguno.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: App Shell cacheado exitosamente.');
        // Forzar la activación del nuevo SW inmediatamente (útil para desarrollo)
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Falló el cacheo del App Shell:', error);
      })
  );
});

// Evento 'activate': Se dispara después de la instalación, cuando el SW toma control.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    // Obtiene todos los nombres de caché existentes
    caches.keys().then(cacheNames => {
      // Devuelve una promesa que se resuelve cuando todos los cachés viejos se han eliminado
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si el nombre del caché no es el actual, elimínalo
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Limpiando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Cachés antiguos limpiados.');
      // Tomar control de las páginas abiertas inmediatamente
      return self.clients.claim();
    })
  );
});

// Evento 'fetch': Se dispara cada vez que la aplicación realiza una petición de red (fetch).
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no son GET (ej. POST)
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignorar peticiones a extensiones de Chrome (para evitar errores en consola)
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Estrategia: Cache First (Primero busca en caché, si no, va a la red)
  event.respondWith(
    caches.match(event.request) // Intenta encontrar la respuesta en el caché
      .then(response => {
        // Si se encuentra en caché, la devuelve
        if (response) {
          // console.log('Service Worker: Sirviendo desde caché:', event.request.url);
          return response;
        }

        // Si no está en caché, va a la red
        // console.log('Service Worker: Solicitando a la red:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Verifica si la respuesta es válida (status 200 OK)
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              // Si no es válida (ej. error 404, o recurso opaco de CDN), simplemente la devuelve sin cachear
              return networkResponse;
            }

            // Clona la respuesta porque tanto el caché como el navegador la necesitan consumir
            const responseToCache = networkResponse.clone();

            // Abre el caché y guarda la respuesta obtenida de la red
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            // Devuelve la respuesta original de la red a la aplicación
            return networkResponse;
          })
          .catch(error => {
            // Manejo de error si falla la red Y no estaba en caché
            console.error('Service Worker: Error en fetch, ni caché ni red disponible:', error);
            // Podrías devolver una página offline genérica aquí si quisieras
            // return new Response("Estás offline y este recurso no está cacheado.", { status: 404, statusText: "Offline" });
          });
      })
  );
});