/*
  Service Worker - RASRAS PLASTIC
  بيخزن نسخة من الموقع عشان يفتح حتى لو النت مقطوع.
  بيانات النظام نفسها (الأوامر، المخزون...) بتتخزن في localStorage
  وبتتزامن مع السحابة بشكل منفصل تمامًا عن الملف ده.
*/

const CACHE_NAME = "rasras-shell-v2";

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

  /*
    مهم جدًا: أي طلب رايح لدومين تاني غير دومين الموقع نفسه (زي طلبات
    Appwrite API - getDocument/updateDocument..) لازم يروح للنت مباشرة
    دايمًا، من غير ما نلمسه أو نخزنه في الكاش خالص. لو خزّناه، أي طلب
    تاني لنفس الرابط (زي مستند البيانات اللي بيتقرا كتير) هيرجع نسخة
    قديمة تايهة من الكاش بدل ما يجيب آخر نسخة فعلية من السحابة - وده
    كان سبب مشاكل "mismatch" واختفاء بيانات اتحفظت فعلاً.
  */

  if (new URL(req.url).origin !== self.location.origin) {

    return; // سيب المتصفح يبعته عادي للنت، من غير أي تدخل من الـ Service Worker

  }

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

  /* لباقي الملفات الثابتة بتاعة الموقع نفسه (أيقونات، manifest): من الكاش الأول، وبعدين النت */
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
