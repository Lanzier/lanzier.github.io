const CACHE = "qingying-v16";
const ASSETS = ["./", "./index.html", "./styles.css?v=16", "./water-controls.css?v=16", "./mcdonalds-cn-foods.js?v=16", "./china-chain-reference-foods.js?v=16", "./china-foods.js?v=16", "./usda-foods.js?v=16", "./fndds-foods.js?v=16", "./app.js?v=16", "./water-controls.js?v=16", "./optional-forms.js?v=16", "./cancel-dialog.js?v=16", "./force-refresh.js?v=16", "./update-worker.js?v=16", "./manifest.webmanifest", "./icon.svg"];
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
