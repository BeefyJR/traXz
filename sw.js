const C='trax-v40';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const NAV_TIMEOUT=3000;/* on a slow or flaky connection, open the cached app after this long instead of waiting for the network */
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){
    const net=fetch(r);
    /* refresh the cached page whenever the network answers, even if we already served the cache; waitUntil keeps this alive */
    e.waitUntil(net.then(res=>res.ok?caches.open(C).then(c=>c.put('./index.html',res.clone())):0).catch(()=>{}));
    e.respondWith((async()=>{
      try{
        return await Promise.race([net,new Promise((_,rej)=>setTimeout(()=>rej(new Error('slow')),NAV_TIMEOUT))]);
      }catch(_){
        const hit=await caches.match('./index.html');
        return hit||net;/* nothing cached yet (first visit): keep waiting for the network, as before */
      }
    })());
    return;
  }
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{
    const net=fetch(r).then(res=>{
      if(res.status===200){const cp=res.clone();e.waitUntil(caches.open(C).then(c=>c.put(r,cp)))}
      return res;
    }).catch(()=>null);
    return hit||net.then(res=>res||Response.error());
  }));
});
