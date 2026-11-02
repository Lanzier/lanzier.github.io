const CACHE = "qingying-v7";
const ASSETS = ["./", "./index.html", "./styles.css?v=3", "./water-controls.css?v=3", "./usda-foods.js?v=7", "./app.js?v=7", "./water-controls.js?v=7", "./optional-forms.js?v=7", "./cancel-dialog.js?v=7", "./force-refresh.js?v=7", "./update-worker.js?v=7", "./manifest.webmanifest", "./icon.svg"];
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
