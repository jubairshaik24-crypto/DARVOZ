const CACHE_NAME = "darvoz-v4";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/style.css",
  "/script.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];


// ==========================================
// INSTALL
// ==========================================

self.addEventListener("install", (event) => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then((cache) => {

        console.log(
          "DARVOZ: Caching files..."
        );

        return cache.addAll(urlsToCache);

      })

  );

  self.skipWaiting();

});


// ==========================================
// ACTIVATE
// ==========================================

self.addEventListener("activate", (event) => {

  event.waitUntil(

    caches.keys().then((keys) => {

      return Promise.all(

        keys.map((key) => {

          if (key !== CACHE_NAME) {

            console.log(
              "DARVOZ: Removing old cache:",
              key
            );

            return caches.delete(key);

          }

        })

      );

    })

  );

  self.clients.claim();

});


// ==========================================
// FETCH
// ==========================================

self.addEventListener("fetch", (event) => {

  const request = event.request;
  const url = new URL(request.url);


  // ========================================
  // ONLY GET
  // ========================================

  if (request.method !== "GET") {
    return;
  }


  // ========================================
  // SOCKET.IO
  // ========================================

  if (
    url.pathname.startsWith("/socket.io/")
  ) {
    return;
  }


  // ========================================
  // GOOGLE MAPS
  // ========================================

  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("maps.google.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }


  // ========================================
  // EXTERNAL SERVICES
  // ========================================

  if (

    url.hostname.includes("razorpay.com") ||
    url.hostname.includes("sentry.io") ||
    url.hostname.includes("sardine.ai") ||
    url.hostname.includes("px-cloud.net") ||
    url.hostname.includes("px-cdn.net") ||
    url.hostname.includes("pxchk.net")

  ) {

    return;

  }


  // ========================================
  // DARVOZ API
  // ========================================

  if (

    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/restaurants/") ||
    url.pathname.startsWith("/partner/")

  ) {

    return;

  }


  // ========================================
  // CACHE STATIC FILES
  // ========================================

  event.respondWith(

    caches.match(request)

      .then((cachedResponse) => {

        if (cachedResponse) {
          return cachedResponse;
        }


        return fetch(request)

          .then((networkResponse) => {

            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {

              const responseClone =
                networkResponse.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {

                  cache.put(
                    request,
                    responseClone
                  );

                });

            }

            return networkResponse;

          });

      })

      .catch((error) => {

        console.warn(
          "DARVOZ SW request failed:",
          request.url,
          error
        );


        return caches.match(request)

          .then((fallback) => {

            if (fallback) {
              return fallback;
            }


            return new Response(
              "Offline",
              {
                status: 503,
                statusText: "Offline",
                headers: {
                  "Content-Type":
                    "text/plain"
                }
              }
            );

          });

      })

  );

});