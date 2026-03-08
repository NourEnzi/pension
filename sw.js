// تحديد اسم لنسخة الذاكرة المؤقتة (تفيدنا لاحقاً إذا أردنا تحديث التطبيق)
const CACHE_NAME = 'national-calculator-v1';

// قائمة الملفات التي نريد حفظها في ذاكرة هاتف المستخدم لتعمل بدون إنترنت
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png'
];

// الحدث الأول: التثبيت (Install) - تنزيل الملفات وتخزينها
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('تم خزن ملفات الحاسبة بنجاح في الهاتف');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// الحدث الثاني: الجلب (Fetch) - اعتراض الطلبات وتشغيل التطبيق من الذاكرة
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إذا وجدنا الملف في الذاكرة (بدون إنترنت) نعطيه للمستخدم، وإلا نجلبه من الإنترنت
        return response || fetch(event.request);
      })
  );
});
