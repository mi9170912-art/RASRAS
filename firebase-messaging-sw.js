/*
  Firebase Cloud Messaging Service Worker
  ده ملف منفصل عن sw.js بتاع الموقع - Firebase محتاجه بالاسم ده
  بالظبط عشان يقدر يستقبل إشعارات وهو شغال في الخلفية، حتى لو
  التطبيق نفسه مقفول تمامًا.
*/

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD0QLLhDWi6lmcekSaLU3dzQZflXHdYvxQ",
  authDomain: "rasras-notifications.firebaseapp.com",
  projectId: "rasras-notifications",
  storageBucket: "rasras-notifications.firebasestorage.app",
  messagingSenderId: "103068105680",
  appId: "1:103068105680:web:bece8b01990ccf694717d5",
  measurementId: "G-HJ41F4PBKF"
});

const messaging = firebase.messaging();

/*
  لو الإشعار جاي من نوع "data" بس (من غير notification payload)،
  بنبنيه إحنا يدويًا هنا عشان يظهر حتى والتطبيق مقفول.
*/
messaging.onBackgroundMessage((payload) => {

  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    "🔔 إشعار جديد - RASRAS PLASTIC";

  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    "";

  const options = {
    body: body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    dir: "rtl",
    lang: "ar",
    data: payload.data || {}
  };

  self.registration.showNotification(title, options);

});

/* لما المستخدم يدوس على الإشعار، نفتحله الموقع */
self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {

      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }

      if (clients.openWindow) return clients.openWindow("./");

    })
  );

});
