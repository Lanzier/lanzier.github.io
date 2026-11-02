const CACHE = "qingying-v22";
const ASSETS = ["./", "./index.html", "./styles.css?v=22", "./water-controls.css?v=22", "./profile-wheels.css?v=22", "./mobile-form-fix.css?v=22", "./mcdonalds-cn-foods.js?v=22", "./china-chain-reference-foods.js?v=22", "./china-foods.js?v=22", "./usda-foods.js?v=22", "./fndds-foods.js?v=22", "./app.js?v=22", "./water-controls.js?v=22", "./optional-forms.js?v=22", "./calorie-animation.js?v=22", "./meal-icons.js?v=22", "./profile-wheels.js?v=22", "./weight-multi-log.js?v=22", "./water-goal.js?v=22", "./cancel-dialog.js?v=22", "./force-refresh.js?v=22", "./update-worker.js?v=22", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => event.waitUntil(
  Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim()
  ])
));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))));
});
