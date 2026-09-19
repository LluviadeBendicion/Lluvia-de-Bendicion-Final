const CACHE="lluvia-bendicion-test-v3";
const ASSETS=["/","/index.html","/approved-home.css","/approved-radio.css","/intro-official.css","/approved-home.js","/config.js","/manifest.webmanifest","/assets/logo-official.jpg","/assets/audio/rain-intro.ogg","/assets/audio/logo-impact.ogg"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(async()=>{const cached=await caches.match(e.request);if(cached)return cached;if(e.request.mode==="navigate")return caches.match("/index.html");return Response.error()}))});
