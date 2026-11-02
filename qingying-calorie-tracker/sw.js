const CACHE = "qingying-v17";
const ASSETS = ["./", "./index.html", "./styles.css?v=17", "./water-controls.css?v=17", "./mcdonalds-cn-foods.js?v=17", "./china-chain-reference-foods.js?v=17", "./china-foods.js?v=17", "./usda-foods.js?v=17", "./fndds-foods.js?v=17", "./app.js?v=17", "./water-controls.js?v=17", "./optional-forms.js?v=17", "./calorie-animation.js?v=17", "./cancel-dialog.js?v=17", "./force-refresh.js?v=17", "./update-worker.js?v=17", "./manifest.webmanifest", "./icon.svg"];
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
