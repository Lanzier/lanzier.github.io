const CACHE = "qingying-v9";
const ASSETS = ["./", "./index.html", "./styles.css?v=9", "./water-controls.css?v=9", "./china-foods.js?v=9", "./usda-foods.js?v=9", "./fndds-foods.js?v=9", "./app.js?v=9", "./water-controls.js?v=9", "./optional-forms.js?v=9", "./cancel-dialog.js?v=9", "./force-refresh.js?v=9", "./update-worker.js?v=9", "./manifest.webmanifest", "./icon.svg"];
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
