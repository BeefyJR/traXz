const C='trax-v83',SHARE='trax-share';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const NAV_TIMEOUT=3000;/* on a slow or flaky connection, open the cached app after this long instead of waiting for the network */
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))))});/* no skipWaiting: the app offers the update in Settings > Backup */
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==SHARE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
/* Web Share Target: songs shared from another app arrive as a POST; park them in a cache and open the app to import them */
async function shareIn(r){
  let n=0;
  try{const fd=await r.formData(),c=await caches.open(SHARE);
    for(const f of fd.getAll('audio')){if(!f||!f.size)continue;await c.put('./shared/'+Date.now()+'-'+(n++),new Response(f,{headers:{'Content-Type':f.type||'audio/mpeg','X-Name':encodeURIComponent(f.name||'shared')}}))}
  }catch(_){}
  return Response.redirect(new URL('./?shared='+n,self.registration.scope).href,303);
}
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method==='POST'&&new URL(r.url).origin===location.origin&&new URL(r.url).pathname.endsWith('/share-target')){e.respondWith(shareIn(r));return}
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
