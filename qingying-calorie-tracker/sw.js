const CACHE = "qingying-v21";
const ASSETS = ["./", "./index.html", "./styles.css?v=21", "./water-controls.css?v=21", "./profile-wheels.css?v=21", "./mobile-form-fix.css?v=21", "./mcdonalds-cn-foods.js?v=21", "./china-chain-reference-foods.js?v=21", "./china-foods.js?v=21", "./usda-foods.js?v=21", "./fndds-foods.js?v=21", "./app.js?v=21", "./water-controls.js?v=21", "./optional-forms.js?v=21", "./calorie-animation.js?v=21", "./meal-icons.js?v=21", "./profile-wheels.js?v=21", "./weight-multi-log.js?v=21", "./cancel-dialog.js?v=21", "./force-refresh.js?v=21", "./update-worker.js?v=21", "./manifest.webmanifest", "./icon.svg"];
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
