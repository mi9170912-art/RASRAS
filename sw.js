/*
  Service Worker - RASRAS PLASTIC
  بيخزن نسخة من الموقع عشان يفتح حتى لو النت مقطوع.
  بيانات النظام نفسها (الأوامر، المخزون...) بتتخزن في localStorage
  وبتتزامن مع السحابة بشكل منفصل تمامًا عن الملف ده.
*/

const CACHE_NAME = "rasras-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        /* لو أحد الملفات مش موجود، منوقفش تسجيل الـ service worker بسببه */
      });
    })
  );

  self.skipWaiting();

});

self.addEventListener("activate", (event) => {

  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );

  self.clients.claim();

});

self.addEventListener("fetch", (event) => {

  const req = event.request;

  if (req.method !== "GET") return;

  /* لطلبات فتح الصفحة نفسها: جرب الإنترنت الأول عشان تجيب آخر نسخة،
     ولو النت مقطوع رجّع النسخة المخزنة */
  if (req.mode === "navigate") {

    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", resClone));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );

    return;

  }

  /* لباقي الملفات الثابتة (أيقونات، manifest): من الكاش الأول، وبعدين النت */
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => cached);
    })
  );

});
