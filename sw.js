const CACHE='lldb-v19';
const CORE=['/manifest.webmanifest','/api/radio-config.json','/api/content-config.json','/api/media-config.json','/api/social-config.json','/api/donations-config.json','/api/forms-config.json'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  if(url.pathname==='/privacidad-contacto'||url.pathname==='/privacidad-contacto.html') return;
  if(url.pathname==='/recuperar-acceso'||url.pathname==='/recuperar-acceso.html') return;

  if(event.request.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'){
    event.respondWith(
      fetch(new Request(event.request,{cache:'no-store'}))
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put('/index.html',copy));
          }
          return response;
        })
        .catch(()=>caches.match('/index.html'))
    );
    return;
  }

  if((url.pathname==='/api/bible'||url.pathname==='/api/content-config.json'||(url.pathname==='/api/site-config'&&url.searchParams.get('name')==='content-config'))) return;

  if(url.pathname.startsWith('/api/')){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached=>cached||fetch(event.request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      }))
  );
});
