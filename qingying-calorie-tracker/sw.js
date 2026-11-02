const CACHE = "qingying-v23";
const ASSETS = ["./", "./index.html", "./styles.css?v=23", "./water-controls.css?v=23", "./profile-wheels.css?v=23", "./mobile-form-fix.css?v=23", "./mcdonalds-cn-foods.js?v=23", "./china-chain-reference-foods.js?v=23", "./china-foods.js?v=23", "./usda-foods.js?v=23", "./fndds-foods.js?v=23", "./app.js?v=23", "./water-controls.js?v=23", "./optional-forms.js?v=23", "./calorie-animation.js?v=23", "./meal-icons.js?v=23", "./profile-wheels.js?v=23", "./weight-multi-log.js?v=23", "./water-goal.js?v=23", "./cancel-dialog.js?v=23", "./force-refresh.js?v=23", "./update-worker.js?v=23", "./manifest.webmanifest", "./icon.svg"];
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
