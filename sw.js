/* Tracks service worker.
   Model: the app page and this worker always update together. A new worker precaches the new page, waits,
   and the app offers it in Settings > Backup; tapping Install swaps both at once. Nothing rewrites the cached
   page behind the worker's back, so the page can never be newer than the worker that serves it.
   VERSION is stamped by stamp-sw.js (a hash of the shell files): run it before every deploy. */
const VERSION='d13a3ddc';
const PFX='trax-',C=PFX+VERSION,SHARE=PFX+'share';
const SHELL='./index.html';
const ASSETS=['./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const RT_MAX=40;                  /* other same-origin files kept at most */
const SHARE_TTL=24*3600*1000;     /* shared songs nobody imported are dropped after a day */
const PRE=new Set([SHELL,...ASSETS].map(u=>new URL(u,self.location).pathname));
const SCOPE=new URL(self.registration.scope);
const isShell=u=>u.origin===SCOPE.origin&&(u.pathname===SCOPE.pathname||u.pathname===SCOPE.pathname+'index.html');

self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const c=await caches.open(C);
  await c.add(new Request(SHELL,{cache:'reload'}));/* required: if the page cannot be fetched the install fails and the current version keeps running */
  await Promise.allSettled(ASSETS.map(u=>c.add(new Request(u,{cache:'reload'}))));/* a missing icon must not block an update */
})())});/* no skipWaiting: the app offers the update in Settings > Backup */
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  /* only touch our own caches: other apps on the same origin keep theirs */
  for(const k of await caches.keys())if(k.startsWith(PFX)&&k!==C&&k!==SHARE)await caches.delete(k);
  await sweepShare();
  await self.clients.claim();
})())});

/* songs that were shared to the app but never imported (app not opened, import failed) */
async function sweepShare(){
  try{
    if(!(await caches.has(SHARE)))return;
    const c=await caches.open(SHARE),now=Date.now();
    for(const r of await c.keys()){const m=/\/shared\/(\d+)-/.exec(r.url);if(!m||now-(+m[1])>SHARE_TTL)await c.delete(r)}
  }catch(_){}
}
/* Web Share Target: songs shared from another app arrive as a POST; park them in a cache and open the app to import them */
async function shareIn(r){
  let n=0;
  try{
    await sweepShare();
    const fd=await r.formData(),c=await caches.open(SHARE),t=Date.now();
    for(const f of fd.getAll('audio')){
      if(!f||!f.size)continue;
      try{await c.put('./shared/'+t+'-'+n,new Response(f,{headers:{'Content-Type':f.type||'audio/mpeg','X-Name':encodeURIComponent(f.name||'shared')}}));n++}catch(_){}
    }
  }catch(_){}
  return Response.redirect(new URL('./?shared='+n,self.registration.scope).href,303);
}

async function shellResponse(r){
  const hit=await caches.match(SHELL,{cacheName:C});
  return hit||fetch(r);/* nothing cached yet (cache cleared by the browser): go to the network */
}
async function assetResponse(e,r){
  const c=await caches.open(C),hit=await c.match(r,{ignoreSearch:true});
  if(hit&&PRE.has(new URL(r.url).pathname))return hit;/* shell files only change together with this worker */
  const net=fetch(r).then(res=>{
    if(res.status===200){const cp=res.clone();e.waitUntil(c.put(r,cp).then(()=>trim(c)).catch(()=>{}))}
    return res;
  }).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}/* stale-while-revalidate for everything else */
  return (await net)||Response.error();
}
/* keep the runtime part of the cache small: drop the oldest non-shell entries */
async function trim(c){
  const extra=(await c.keys()).filter(k=>!PRE.has(new URL(k.url).pathname));
  for(let i=0;i<extra.length-RT_MAX;i++)await c.delete(extra[i]);
}

self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method==='POST'&&u.origin===location.origin&&u.pathname.endsWith('/share-target')){e.respondWith(shareIn(r));return}
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(r.mode==='navigate'){if(isShell(u))e.respondWith(shellResponse(r));return}/* the app opens from the cache at once, online or not */
  e.respondWith(assetResponse(e,r));
});
