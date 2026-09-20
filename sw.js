// تحديد اسم لنسخة الذاكرة المؤقتة (تم التحديث إلى v3.6.2)
const CACHE_NAME = 'national-calculator-v3.6.2';

// قائمة الملفات التي نريد حفظها في ذاكرة هاتف المستخدم لتعمل بدون إنترنت
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './favicon.png'
];

// الحدث الأول: التثبيت (Install)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('تم خزن ملفات الحاسبة بنجاح في الهاتف - الإصدار:', CACHE_NAME);
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// الحدث الثاني: التفعيل (Activate) - تنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('تم مسح الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// الحدث الثالث: الجلب (Fetch) - استراتيجية "الشبكة أولاً" (Network First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // إذا كان هناك إنترنت وتم جلب الملف بنجاح من جيت هب، نحدث الكاش بالنسخة الجديدة
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // إذا لم يكن هناك إنترنت، نجلب الملف من الذاكرة المخبأة (الكاش)
        return caches.match(event.request);
      })
  );
});