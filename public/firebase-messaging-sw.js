// =====================================================
// DARVOZ FIREBASE CLOUD MESSAGING SERVICE WORKER
// =====================================================

// Firebase 12.18.0
importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js"
);


// =====================================================
// FIREBASE CONFIG
// =====================================================

firebase.initializeApp({
  apiKey: "AIzaSyAQXMMUBjXHWkMlODTW6pn3V8ZCpvqCq1A",
  authDomain: "darvoz-a6c5d.firebaseapp.com",
  projectId: "darvoz-a6c5d",
  storageBucket: "darvoz-a6c5d.firebasestorage.app",
  messagingSenderId: "807478858598",
  appId: "1:807478858598:web:459ccdaf999d7b3ab16ea7",
  measurementId: "G-CDWZ9YXLEG"
});


// =====================================================
// FIREBASE MESSAGING
// =====================================================

const messaging = firebase.messaging();


// =====================================================
// BACKGROUND NOTIFICATION
// =====================================================

messaging.onBackgroundMessage((payload) => {

  console.log(
    "🔔 DARVOZ background notification:",
    payload
  );


  // ---------------------------------------------------
  // TITLE
  // ---------------------------------------------------

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    "DARVOZ";


  // ---------------------------------------------------
  // BODY
  // ---------------------------------------------------

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    "You have a new notification.";


  // ---------------------------------------------------
  // NOTIFICATION OPTIONS
  // ---------------------------------------------------

  const options = {

    body: body,

    icon: "/favicon.ico",

    badge: "/favicon.ico",

    data: payload.data || {},

    tag: "darvoz-notification",

    renotify: true,

    requireInteraction: false

  };


  // ---------------------------------------------------
  // SHOW NOTIFICATION
  // ---------------------------------------------------

  return self.registration.showNotification(
    title,
    options
  );

});


// =====================================================
// NOTIFICATION CLICK
// =====================================================

self.addEventListener(
  "notificationclick",
  (event) => {

    console.log(
      "🔔 DARVOZ notification clicked"
    );


    event.notification.close();


    // -------------------------------------------------
    // Get notification data
    // -------------------------------------------------

    const data =
      event.notification.data || {};


    // -------------------------------------------------
    // Optional URL from FCM data
    // -------------------------------------------------

    const targetUrl =
      data.url ||
      data.click_action ||
      "/";


    // -------------------------------------------------
    // Open / focus DARVOZ
    // -------------------------------------------------

    event.waitUntil(

      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then((clientList) => {

          // Try to find already-open DARVOZ tab
          for (const client of clientList) {

            if (
              client.url.includes(
                self.location.origin
              ) &&
              "focus" in client
            ) {

              client.navigate(targetUrl);

              return client.focus();

            }

          }


          // Otherwise open new tab
          if (clients.openWindow) {

            return clients.openWindow(
              new URL(
                targetUrl,
                self.location.origin
              ).href
            );

          }

        })

    );

  }
);


// =====================================================
// SERVICE WORKER INSTALL
// =====================================================

self.addEventListener(
  "install",
  () => {

    console.log(
      "✅ DARVOZ Firebase Service Worker installed"
    );

    self.skipWaiting();

  }
);


// =====================================================
// SERVICE WORKER ACTIVATE
// =====================================================

self.addEventListener(
  "activate",
  (event) => {

    console.log(
      "✅ DARVOZ Firebase Service Worker activated"
    );

    event.waitUntil(
      self.clients.claim()
    );

  }
);