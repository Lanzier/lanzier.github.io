const CACHE = "qingying-v13";
const ASSETS = ["./", "./index.html", "./styles.css?v=9", "./water-controls.css?v=9", "./mcdonalds-cn-foods.js?v=13", "./china-chain-reference-foods.js?v=13", "./china-foods.js?v=13", "./usda-foods.js?v=13", "./fndds-foods.js?v=13", "./app.js?v=13", "./water-controls.js?v=13", "./optional-forms.js?v=13", "./cancel-dialog.js?v=13", "./force-refresh.js?v=13", "./update-worker.js?v=13", "./manifest.webmanifest", "./icon.svg"];
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
