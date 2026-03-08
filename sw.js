// تحديد اسم لنسخة الذاكرة المؤقتة (هذا هو السر: قم بتغيير الرقم v2 إلى v3 مستقبلاً عند أي تحديث)
const CACHE_NAME = 'national-calculator-v3.4.0';

// قائمة الملفات التي نريد حفظها في ذاكرة هاتف المستخدم لتعمل بدون إنترنت
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png'
];

// الحدث الأول: التثبيت (Install) - تنزيل الملفات وتخزينها
self.addEventListener('install', (event) => {
  // إجبار عامل الخدمة الجديد على التثبيت فوراً وعدم الانتظار
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('تم خزن ملفات الحاسبة بنجاح في الهاتف - الإصدار:', CACHE_NAME);
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// الحدث الثاني: التفعيل (Activate) - التنظيف الذكي للكاش القديم
self.addEventListener('activate', (event) => {
  // السيطرة على جميع النوافذ المفتوحة للتطبيق فوراً
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // إذا كان اسم الكاش القديم لا يطابق الاسم الجديد، قم بحذفه فوراً
          if (cacheName !== CACHE_NAME) {
            console.log('تم مسح الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// الحدث الثالث: الجلب (Fetch) - تشغيل التطبيق من الذاكرة أو من الإنترنت
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إذا وجدنا الملف في الذاكرة (بدون إنترنت) نعطيه للمستخدم، وإلا نجلبه من الإنترنت
        return response || fetch(event.request);
      })
  );
});
