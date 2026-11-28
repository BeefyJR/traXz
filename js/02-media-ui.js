

/* ===== BEGIN 05-media.js ===== */
/* helpers */
/* ===== animated media: GIF, animated WebP/APNG and video =====
   The still poster stays in the normal cover / background fields, so every older code path (accent colour, lock-screen art, mosaics, backups) keeps working unchanged.
   The animation itself lives in its own small IndexedDB ("tracks-media"): the main library database, its version and Drive sync are not touched. */
const MED=new Map();let mdb=null,MEDERR='';
const MED_LIM={gif:20*1048576,video:60*1048576};
const ANIM={m:'all'};{const v=LS('tracks-anim');if(v==='all'||v==='big'||v==='off')ANIM.m=v}
/* live = the big player, mini player and album / playlist page; everywhere else follows the "Animated media" setting */
const animM=()=>PERF.f.media?'off':ANIM.m;/* performance mode keeps GIF and video covers still */
const animOn=live=>{const a=animM();return !RM.matches&&a!=='off'&&(live===true||a==='all')};
function medOpen(){return new Promise(res=>{try{const r=indexedDB.open('tracks-media',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('m'))d.createObjectStore('m',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=r.onblocked=()=>res(null)}catch(e){res(null)}})}
async function medLoad(){
  mdb=await medOpen();if(!mdb)return;
  const all=await new Promise(res=>{try{const q=mdb.transaction('m','readonly').objectStore('m').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])}catch(e){res([])}});
  for(const r of all)if(r&&r.id&&r.blob)MED.set(r.id,{blob:r.blob,t:r.t,poster:r.poster||''});
}
const medPut=r=>new Promise(res=>{if(!mdb)return res(false);try{const t=mdb.transaction('m','readwrite');t.objectStore('m').put(r);t.oncomplete=()=>res(true);t.onerror=t.onabort=()=>res(false)}catch(e){res(false)}});
const medDel=id=>new Promise(res=>{if(!mdb)return res(false);try{const t=mdb.transaction('m','readwrite');t.objectStore('m').delete(id);t.oncomplete=()=>res(true);t.onerror=t.onabort=()=>res(false)}catch(e){res(false)}});
/* ref = {id,t} saved in a record, or {url,t} for a not-yet-saved draft preview. Returns {url,t} or null when the file is not on this device (then the still poster is shown) */
function medSrc(ref){if(!ref)return null;if(ref.url&&ref.t)return ref;const m=MED.get(ref.id);if(!m)return null;if(!m.url)m.url=URL.createObjectURL(m.blob);return m}
async function medSave(m){
  const id='m'+uid();MED.set(id,{blob:m.blob,t:m.t});
  if(!(await medPut({id,blob:m.blob,t:m.t,mod:Date.now()}))){MED.delete(id);toast('Could not save the animation on this device');return null}
  const ref={id,t:m.t};if(m.p)ref.p=m.p;return ref;
}
function medRefs(){const s=new Set(),add=o=>{if(!o)return;if(o.cmedia&&o.cmedia.id)s.add(o.cmedia.id);if(o.crig&&o.crig.id)s.add(o.crig.id);if(o.bg&&o.bg.mid&&o.bg.mid.id)s.add(o.bg.mid.id)};songs.forEach(add);albums.forEach(add);folders.forEach(add);playlists.forEach(add);pfolders.forEach(add);if(bgMed)s.add(bgMed.id);return s}
/* delete files nothing points to any more */
async function medGC(ids){
  const used=medRefs();
  for(const id of ids){if(!id||id==='theme'||used.has(id)||!MED.has(id))continue;const m=MED.get(id);MED.delete(id);if(m.url)try{URL.revokeObjectURL(m.url)}catch(e){}await medDel(id)}
}
/* safety net for deleted songs / albums: a file must be unused on two app starts in a row before it is removed */
function medBootGC(){
  if(!db||!mdb)return;
  setTimeout(()=>{try{
    if(!songs.length&&!albums.length&&!playlists.length)return;
    const used=medRefs(),orph=[...MED.keys()].filter(id=>id!=='theme'&&!used.has(id));
    let prev=[];try{prev=JSON.parse(LS('tracks-medorph')||'[]')}catch(e){}
    LS('tracks-medorph',JSON.stringify(orph.filter(id=>!prev.includes(id))));
    const kill=orph.filter(id=>prev.includes(id));if(kill.length)medGC(kill);
  }catch(e){}},6000);
}
const VID_RE=/\.(mp4|m4v|mov|webm|ogv|mkv)$/i;
/* 'video' | 'gif' (any animated image) | 'img' */
async function mediaKind(f){
  const t=(f.type||'').toLowerCase();
  if(t.startsWith('video/')||(!t&&VID_RE.test(f.name||'')))return 'video';
  if(t==='image/gif')return 'gif';
  if(t==='image/webp'||t==='image/png'||t==='image/apng'){
    try{
      const b=new Uint8Array(await f.slice(0,t==='image/webp'?32:2048).arrayBuffer());
      if(t==='image/webp')return(b[12]===0x56&&b[13]===0x50&&b[14]===0x38&&b[15]===0x58&&(b[20]&2))?'gif':'img';
      for(let i=8;i<b.length-4;i++){
        if(b[i]===0x61&&b[i+1]===0x63&&b[i+2]===0x54&&b[i+3]===0x4c)return 'gif';   /* acTL chunk = APNG */
        if(b[i]===0x49&&b[i+1]===0x44&&b[i+2]===0x41&&b[i+3]===0x54)break;          /* IDAT reached first = plain PNG */
      }
    }catch(e){}
  }
  return 'img';
}
/* one still frame of a video as a JPEG blob */
function videoFrame(file){return new Promise(res=>{
  const v=document.createElement('video'),u=URL.createObjectURL(file);let done=false,tm=0;
  const fin=b=>{if(done)return;done=true;clearTimeout(tm);v.onerror=v.onloadeddata=v.onseeked=null;v.removeAttribute('src');try{v.load()}catch(e){}URL.revokeObjectURL(u);res(b)};
  tm=setTimeout(()=>fin(null),9000);
  v.muted=true;v.playsInline=true;v.preload='auto';
  v.onerror=()=>fin(null);
  v.onloadeddata=()=>{
    if(!v.videoWidth)return fin(null);
    const d=v.duration,t=isFinite(d)&&d>2?Math.min(1,d/4):0;
    const draw=()=>{try{const k=Math.min(1,800/Math.max(v.videoWidth,v.videoHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(v.videoWidth*k));c.height=Math.max(1,Math.round(v.videoHeight*k));c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(b=>fin(b),'image/jpeg',.85)}catch(e){fin(null)}};
    if(t>0){v.onseeked=draw;try{v.currentTime=t}catch(e){draw()}}else draw();
  };
  v.src=u;
})}
const imgScale=(file,max,q,asData)=>new Promise(res=>{const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);asData?res(c.toDataURL('image/jpeg',q)):c.toBlob(b=>res(b),'image/jpeg',q)};
  im.onerror=()=>{URL.revokeObjectURL(u);res(null)};im.src=u});
function medTooBig(file,kind){const k=kind==='video'?'video':'gif';if(file.size>MED_LIM[k]){MEDERR='That '+(k==='video'?'video':'animation')+' is too large (max '+Math.round(MED_LIM[k]/1048576)+' MB)';return true}return false}
/* cover import: still images behave exactly as before; a GIF or video also returns .media, with the still frame as the cover */
const cvFail=m=>{if(MEDERR!=='cancel')toast(MEDERR||m||'Could not read that image')};
const scrAr=()=>Math.min(1.8,Math.max(.55,innerWidth/innerHeight));
const posStyle=r=>{const p=r&&r.p;return Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)?'transform:translate('+p[0]+'%,'+p[1]+'%) scale('+p[2]+')':''};
/* ---- crop model: c={x,y,z,ia}. (x,y) is the spot of the picture (0..1) that sits in the middle of the frame, z the zoom (1 = just fills the frame), ia the picture's aspect.
   It does not depend on the frame's shape, so one crop frames correctly on every screen. The editor and the app use this same function (cropGeo). ---- */
const cropOk=c=>!!c&&[c.x,c.y,c.z,c.ia].every(Number.isFinite)&&c.ia>0;
const cropPack=cr=>cr.def?null:{x:+cr.x.toFixed(4),y:+cr.y.toFixed(4),z:+cr.z.toFixed(3),ia:+cr.ia.toFixed(4)};
function cropGeo(c,W,H,zmin){
  const ia=c.ia,z=Math.min(8,Math.max(zmin||.1,c.z)),wide=ia>=W/H,dw=wide?H*ia:W,dh=wide?H:W/ia;
  const lim=(d,f)=>Math.abs(d*z-f)/2,cl=(v,l)=>Math.max(-l,Math.min(l,v));
  return{z,dw,dh,tx:cl(-z*(c.x-.5)*dw,lim(dw,W)),ty:cl(-z*(c.y-.5)*dh,lim(dh,H))};
}
const cropTf=(c,W,H)=>{const g=cropGeo(c,W,H);return'translate('+g.tx+'px,'+g.ty+'px) scale('+g.z+')'};
/* crop / position editor. Drag to move, pinch / wheel / slider to zoom (zooms around your fingers or cursor), double-tap to zoom, arrow keys nudge.
   init: a crop {x,y,z,ia} or an old [tx,ty,z] array. prev: optional frame shapes to preview. Resolves {x,y,z,ia,tx,ty,p,def} (tx,ty,p = old frame-percent form) or null when cancelled */
function cropSheet(file,kind,aspect,init,fit,prev){
  return new Promise(res=>{
    const url=URL.createObjectURL(file),S={x:.5,y:.5,z:1,ia:1},ar0=Math.min(3,Math.max(.4,aspect||1));
    let nw=0,nh=0,zm=1,done=false,lt=0,mv=0;const hasInit=cropOk(init)||(Array.isArray(init)&&init.length===3&&init.every(Number.isFinite));
    if(cropOk(init)){S.x=init.x;S.y=init.y;S.z=init.z}
    const o=document.createElement('div');o.id='crop';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Crop and position');
    o.innerHTML='<div class="crp"><h3>Crop and position</h3><p class="dupn">Drag to move. Pinch, scroll or use the slider to zoom. Double-tap to zoom in.'+(fit?' Zoom out to fit the whole picture.':'')+'</p>'+(prev?'<div class="cpa">'+prev.map(r=>'<button type="button" class="chip" data-r="'+r+'">'+(r<.9?'Tall':r<1.2?'Square':'Wide')+'</button>').join('')+'</div>':'')+'<div class="cpst" tabindex="0" style="--ar:'+ar0+'"><i class="cpg"></i></div><div class="fop"><span>Zoom</span><input type="range" class="rng" id="cpz" min="10" max="400" value="100" aria-label="Zoom"><b>1.0\u00d7</b></div><div class="fop"><span>X</span><input type="range" class="rng" id="cpx" min="0" max="1000" value="500" aria-label="Horizontal position"><b>50</b></div><div class="fop"><span>Y</span><input type="range" class="rng" id="cpy" min="0" max="1000" value="500" aria-label="Vertical position"><b>50</b></div><div class="bt"><button type="button" class="pill mr" id="cpr">Reset</button><button type="button" class="pill" id="cpc">Cancel</button><button type="button" class="pill acc" id="cpd">Use</button></div></div>';
    const st=o.querySelector('.cpst'),zs=o.querySelector('#cpz'),zb=o.querySelector('.fop b'),xs=o.querySelector('#cpx'),ys=o.querySelector('#cpy');
    const el=document.createElement(kind==='video'?'video':'img');el.className='cpel';
    if(kind==='video'){el.muted=true;el.loop=true;el.playsInline=true;el.autoplay=true}else el.alt='';
    st.insertBefore(el,st.firstChild);
    const kd=e=>{if(e.key==='Escape'){e.stopPropagation();fin(null)}};
    const fin=v=>{if(done)return;done=true;document.removeEventListener('keydown',kd,true);if(kind==='video'){try{el.pause()}catch(e){}el.removeAttribute('src')}o.remove();URL.revokeObjectURL(url);res(v)};
    /* keep the picture covering the frame and the zoom in range; returns the frame + displayed picture size */
    const fix=()=>{const r=st.getBoundingClientRect(),W=r.width,H=r.height;if(!nw||!W||!H)return null;
      const ia=nw/nh,wide=ia>=W/H,dw=wide?H*ia:W,dh=wide?H:W/ia;S.ia=ia;zm=.1;S.z=Math.min(4,Math.max(.1,S.z));
      const hx=Math.abs(1-W/(dw*S.z))/2,hy=Math.abs(1-H/(dh*S.z))/2;S.x=Math.min(.5+hx,Math.max(.5-hx,S.x));S.y=Math.min(.5+hy,Math.max(.5-hy,S.y));return{W,H,dw,dh,r,hx,hy}};
    const paint=()=>{const g=fix();if(!g)return;const c=cropGeo(S,g.W,g.H,zm);el.style.transform='translate('+c.tx+'px,'+c.ty+'px) scale('+c.z+')';
      zs.value=Math.round(S.z*100);zs.style.setProperty('--p',((S.z-.1)/3.9*100)+'%');zb.textContent=S.z.toFixed(S.z<1?2:1)+'\u00d7';
      const sl=(i,v,h)=>{const on=h>.0005;i.disabled=!on;i.value=on?Math.round((v-.5+h)/(2*h)*1000):500;i.style.setProperty('--p',i.value/10+'%');i.nextElementSibling.textContent=on?Math.round(i.value/10):'\u2013'};sl(xs,S.x,g.hx);sl(ys,S.y,g.hy)};
    /* zoom keeping the picture point under (px,py) (offset from the frame centre) where it is */
    const zoomAt=(nz,px,py)=>{const g=fix();if(!g)return;nz=Math.min(4,Math.max(.1,nz));S.x+=px/g.dw*(1/S.z-1/nz);S.y+=py/g.dh*(1/S.z-1/nz);S.z=nz};
    const pan=(dx,dy)=>{const g=fix();if(!g)return;S.x-=dx/(g.dw*S.z);S.y-=dy/(g.dh*S.z)};
    const meta=()=>{nw=kind==='video'?el.videoWidth:el.naturalWidth;nh=kind==='video'?el.videoHeight:el.naturalHeight;if(!nw||!nh)return fin(null);
      const g=fix();
      if(g&&Array.isArray(init)&&!cropOk(init)){const z=init[2],ia=nw/nh;S.z=z;S.x=.5-init[0]/100*g.W/(z*g.dw);S.y=.5-init[1]/100*g.H/(z*g.dh)}
      else if(g&&fit&&!hasInit)S.z=Math.min(1,g.W/g.dw,g.H/g.dh);
      paint()};
    if(kind==='video')el.onloadedmetadata=meta;else el.onload=meta;
    el.onerror=()=>fin({x:.5,y:.5,z:1,ia:1,tx:0,ty:0,p:[0,0,1],def:true});
    const P=new Map(),dbl=e=>{const g=fix();if(!g)return;if(S.z>1.05){S.z=1;S.x=S.y=.5}else zoomAt(2.5,e.clientX-g.r.left-g.W/2,e.clientY-g.r.top-g.H/2);paint()};
    st.onpointerdown=e=>{try{st.setPointerCapture(e.pointerId)}catch(_){}P.set(e.pointerId,[e.clientX,e.clientY]);mv=0};
    st.onpointermove=e=>{
      const q=P.get(e.pointerId);if(!q)return;
      if(P.size===1){mv+=Math.abs(e.clientX-q[0])+Math.abs(e.clientY-q[1]);pan(e.clientX-q[0],e.clientY-q[1]);P.set(e.pointerId,[e.clientX,e.clientY])}
      else if(P.size===2){
        const a=[...P.values()];P.set(e.pointerId,[e.clientX,e.clientY]);const b=[...P.values()],g=fix();mv+=9;
        if(g){const d0=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])||1,d1=Math.hypot(b[0][0]-b[1][0],b[0][1]-b[1][1]),m0=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],m1=[(b[0][0]+b[1][0])/2,(b[0][1]+b[1][1])/2];
          zoomAt(S.z*d1/d0,m0[0]-g.r.left-g.W/2,m0[1]-g.r.top-g.H/2);pan(m1[0]-m0[0],m1[1]-m0[1])}
      }else P.set(e.pointerId,[e.clientX,e.clientY]);
      paint();
    };
    st.onpointerup=st.onpointercancel=e=>{
      if(e.type==='pointerup'&&P.size===1&&mv<7){const t=Date.now();if(t-lt<320){lt=0;dbl(e)}else lt=t}
      P.delete(e.pointerId)};
    st.onwheel=e=>{e.preventDefault();const g=fix();if(!g)return;zoomAt(S.z*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0018)),e.clientX-g.r.left-g.W/2,e.clientY-g.r.top-g.H/2);paint()};
    st.onkeydown=e=>{const k=e.key,d=e.shiftKey?40:10;
      if(k==='ArrowLeft')pan(d,0);else if(k==='ArrowRight')pan(-d,0);else if(k==='ArrowUp')pan(0,d);else if(k==='ArrowDown')pan(0,-d);
      else if(k==='+'||k==='=')zoomAt(S.z*1.1,0,0);else if(k==='-'||k==='_')zoomAt(S.z/1.1,0,0);else return;
      e.preventDefault();paint()};
    zs.oninput=()=>{zoomAt(zs.value/100,0,0);paint()};
    xs.oninput=()=>{const g=fix();if(!g)return;S.x=.5-g.hx+xs.value/1000*2*g.hx;paint()};
    ys.oninput=()=>{const g=fix();if(!g)return;S.y=.5-g.hy+ys.value/1000*2*g.hy;paint()};
    const pa=o.querySelector('.cpa');
    if(pa){const mark=()=>pa.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',Math.abs(+c.dataset.r-(+st.style.getPropertyValue('--ar')))<.01));mark();
      pa.onclick=e=>{const c=e.target.closest('.chip');if(!c)return;st.style.setProperty('--ar',c.dataset.r);mark();paint()}}
    o.querySelector('#cpr').onclick=()=>{S.x=S.y=.5;S.z=1;paint()};
    o.querySelector('#cpc').onclick=()=>fin(null);
    o.querySelector('#cpd').onclick=()=>{const g=fix();if(!g)return fin(null);const c=cropGeo(S,g.W,g.H,zm),tx=+(c.tx/g.W*100).toFixed(2),ty=+(c.ty/g.H*100).toFixed(2);
      fin({x:S.x,y:S.y,z:S.z,ia:S.ia,tx,ty,p:[tx,ty,+S.z.toFixed(3)],def:Math.abs(S.x-.5)<.0005&&Math.abs(S.y-.5)<.0005&&Math.abs(S.z-1)<.0005})};
    o.addEventListener('pointerdown',e=>{if(e.target===o)fin(null)});
    addEventListener('resize',paint);
    document.addEventListener('keydown',kd,true);
    document.body.appendChild(o);
    el.src=url;if(kind==='video')el.play().catch(()=>{});
    paint();o.querySelector('#cpd').focus();
  });
}
/* bakes a crop into a new picture of the given shape: the very same maths (cropGeo) the editor and the app use */
const cropBake=(file,ar,maxSide,cr)=>new Promise(res=>{const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const ow=ar>=1?maxSide:Math.round(maxSide*ar),oh=ar>=1?Math.round(maxSide/ar):maxSide,c=document.createElement('canvas');c.width=ow;c.height=oh;
    const x=c.getContext('2d'),g=cropGeo({x:cr.x,y:cr.y,z:cr.z,ia:im.width/im.height},ow,oh,.1);
    x.fillStyle='#000';x.fillRect(0,0,ow,oh);x.translate(ow/2+g.tx,oh/2+g.ty);x.scale(g.z,g.z);x.drawImage(im,-g.dw/2,-g.dh/2,g.dw,g.dh);
    URL.revokeObjectURL(u);c.toBlob(b=>res(b),'image/jpeg',.9)};
  im.onerror=()=>{URL.revokeObjectURL(u);res(null)};im.src=u});
/* cover import: crop first. The uncropped original comes back as .orig (so the crop can be redone later) and the crop as .c; a GIF or video also returns .media (the still frame is the cover) */
async function makeCoverX(file){
  MEDERR='';const kind=await mediaKind(file);
  if(kind!=='img'&&medTooBig(file,kind))return null;
  const cr=await cropSheet(file,kind,1);
  if(!cr){MEDERR='cancel';return null}
  let still=file;
  if(kind==='video'){still=await videoFrame(file);if(!still){MEDERR='Could not read that video';return null}}
  const orig=await imgScale(still,1600,.9);
  if(!cr.def){const b=await cropBake(still,1,1024,cr);if(b)still=b}
  const r=await makeCover(still);if(!r)return null;
  if(orig)r.orig=orig;r.c=cropPack(cr);
  if(kind!=='img'){r.media={blob:file,t:kind==='video'?'video':'gif'};if(!cr.def)r.media.p=cr.p}
  return r;
}
/* player background import: nothing is baked, the picture keeps its own shape and the crop (c) is applied for whichever screen it is shown on */
async function makeBgMedia(file){
  MEDERR='';const kind=await mediaKind(file);
  if(kind!=='img'&&medTooBig(file,kind))return null;
  const cr=await cropSheet(file,kind,scrAr(),null,false,[.5625,1,1.7778]);if(!cr){MEDERR='cancel';return null}
  let still=file;
  if(kind==='video'){still=await videoFrame(file);if(!still){MEDERR='Could not read that video';return null}}
  const d=await makeBgImage(still);if(!d)return null;
  return{data:d,media:kind==='img'?null:{blob:file,t:kind==='video'?'video':'gif'},c:cropPack(cr)};
}
async function makeThemeMedia(file){
  MEDERR='';const kind=await mediaKind(file);
  if(kind==='img'){
    const ar=scrAr(),cr=await cropSheet(file,'img',ar,null,true);if(!cr){MEDERR='cancel';return null}
    const b=cr.def?await imgScale(file,1920,.86):await cropBake(file,ar,1920,cr);return b?{blob:b,t:'img',poster:''}:null;
  }
  if(medTooBig(file,kind))return null;
  const cr=await cropSheet(file,kind,scrAr(),null,true);if(!cr){MEDERR='cancel';return null}
  let still=file;
  if(kind==='video'){still=await videoFrame(file);if(!still){MEDERR='Could not read that video';return null}}
  const poster=await imgScale(still,1280,.8,true);if(!poster)return null;
  return {blob:file,t:kind==='video'?'video':'gif',poster,p:cr.def?null:[+cr.tx.toFixed(2),+cr.ty.toFixed(2),+cr.z.toFixed(3)]};
}
/* a pending (not yet saved) draft: {blob,t,url} for the preview */
const mdPrev=r=>r&&r.media?{blob:r.media.blob,t:r.media.t,p:r.media.p,url:URL.createObjectURL(r.media.blob),pend:1}:null;
/* on Save: write a pending draft to storage (or keep the existing reference) */
async function medCommit(d){
  if(d.cm){const r=await medSave(d.cm);try{URL.revokeObjectURL(d.cm.url)}catch(e){}d.cm=null;return r}
  return d.cmedia||null;
}
/* ---- play only what can be seen: few decoders running, less battery ---- */
const MV={io:null,vis:new Map(),flag:false,cap:matchMedia('(pointer:coarse)').matches?3:6};
const mvKeep='#full,#mini,#tbg,#np,#npb';
function mvOk(v){
  if(document.hidden||RM.matches||animM()==='off'||!v.dataset.v)return false;
  if($('#full').classList.contains('open')&&!v.closest('#full'))return false;
  return true;
}
function mvEval(){
  let n=0;
  for(const [v,vis] of MV.vis){
    if(!v.isConnected){MV.vis.delete(v);if(MV.io)MV.io.unobserve(v);continue}
    const keep=!!v.closest(mvKeep),u=v.dataset.v||'',want=vis&&mvOk(v)&&(keep||n<MV.cap);
    if(want){
      if(v.getAttribute('src')!==u)v.setAttribute('src',u);
      v.muted=true;v.loop=true;
      if(v.paused){const p=v.play();if(p&&p.catch)p.catch(()=>{})}
      if(!keep)n++;
    }else{
      if(!v.paused)v.pause();
      if((!u||(!vis&&!keep))&&v.hasAttribute('src')){v.removeAttribute('src');v.classList.remove('on');try{v.load()}catch(e){}}   /* back to the poster, frees the decoder */
    }
  }
}
let mvT=0;const mvSoon=()=>{if(!mvT)mvT=requestAnimationFrame(()=>{mvT=0;mvEval()})};
function mvInit(){
  const add=v=>{if(!MV.vis.has(v)){MV.vis.set(v,!MV.io);if(MV.io)MV.io.observe(v)}};
  if('IntersectionObserver' in window)MV.io=new IntersectionObserver(es=>{for(const e of es)MV.vis.set(e.target,e.isIntersecting);mvEval()},{rootMargin:'80px'});
  new MutationObserver(()=>{if(MV.flag){MV.flag=false;document.querySelectorAll('video.mv').forEach(add)}if(MV.vis.size)mvSoon()}).observe(document.body,{childList:true,subtree:true});
  document.querySelectorAll('video.mv').forEach(add);
  document.addEventListener('visibilitychange',mvEval);
  /* belt and braces: even if a browser ignores the loop attribute, a finished cover / background video starts again */
  document.addEventListener('ended',e=>{const v=e.target;if(v&&v.tagName==='VIDEO'&&v.classList.contains('mv')&&v.dataset.v){try{v.currentTime=0;const p=v.play();if(p&&p.catch)p.catch(()=>{})}catch(_){}}},true);
  document.addEventListener('playing',e=>{const v=e.target;if(v&&v.tagName==='VIDEO'&&(v.classList.contains('lay')||v.classList.contains('cmv')))v.classList.add('on')},true);
  new MutationObserver(mvEval).observe($('#full'),{attributes:true,attributeFilter:['class']});
  try{RM.addEventListener('change',()=>{tbgApply();mvEval()})}catch(e){}
  mvEval();
}
/* a copy of a cover (used by the cover transition) must not carry a running video */
function mvGhost(el){el.querySelectorAll('video').forEach(v=>{v.removeAttribute('src');v.removeAttribute('data-v');v.classList.remove('mv','on')});return el}
const VATTR='muted loop playsinline preload="none" disablepictureinpicture tabindex="-1" aria-hidden="true"';
/* folder tile cover (opacity is part of the look) */
function fcov(f){
  if(!f.cover)return '';
  const o=f.copac==null?1:f.copac,m=f.cmedia&&animOn(false)?medSrc(f.cmedia):null;
  const ps=m?posStyle(f.cmedia):'';
  if(m&&m.t==='video'){MV.flag=true;return ps?`<img class="fcov" src="${safeImg(f.cover)}" alt="" style="opacity:${o}"><video class="fcov cmv mv" data-v="${m.url}" ${VATTR} style="--o:${o};${ps}"></video>`:`<video class="fcov mv" data-v="${m.url}" poster="${safeImg(f.cover)}" ${VATTR} style="opacity:${o}"></video>`}
  return `<img class="fcov" src="${m?m.url:safeImg(f.cover)}" alt="" style="opacity:${o}${ps?';'+ps:''}">`;
}
/* mini player background: your own image / GIF / video when one is set for this album or song, the cover otherwise */
function miniBg(s){
  const m=$('#mini');if(!m||!s)return;
  let st=null,img=null,med=null;
  if(bgKey===bgKeyOf(s)){st=bgS.st;img=bgImg;med=bgMed}
  else{const b=bgTarget(s).bg;if(b&&typeof b==='object'){st=b.st;img=typeof b.img==='string'&&b.img?b.img:null;med=img&&b.mid?b.mid:null}}
  const use=(st==='img'||st==='mix')&&img,ms=use&&med?medSrc(med):null,cc=songCover(s),cm=!use&&cc.cover&&cc.cmedia&&animOn(true)?medSrc(cc.cmedia):null,
    vid=(ms&&ms.t==='video'&&animOn(true)?ms.url:null)||(cm&&cm.t==='video'?cm.url:null);
  const still=use?((ms&&ms.t==='gif'&&animOn(true))?ms.url:img):(cm&&cm.t==='gif'?cm.url:(cc.cover||''));
  const key=(vid?'v'+vid:'')+'|'+still.length+'|'+still.slice(-40);
  if(m._bk===key)return;m._bk=key;
  m.style.setProperty('--mcv',(still&&!vid)?'url("'+still+'")':'none');
  const vd=m.querySelector('.mbv');
  if(vd){
    m.classList.toggle('hasmv',!!vid);
    if(vid){vd.dataset.v=vid;vd.poster=(use?img:cc.cover)||''}else{delete vd.dataset.v;vd.removeAttribute('poster')}
    mvEval();
  }
}
/* theme background media */
const TBG={on:false,t:'img',dim:55,blur:0,p:null};
try{const j=JSON.parse(LS('tracks-tbg')||'null');if(j&&typeof j==='object'){TBG.on=!!j.on;if(j.t==='img'||j.t==='gif'||j.t==='video')TBG.t=j.t;if(typeof j.dim==='number'&&isFinite(j.dim))TBG.dim=Math.min(90,Math.max(0,j.dim));if(typeof j.blur==='number'&&isFinite(j.blur))TBG.blur=Math.min(30,Math.max(0,j.blur));if(Array.isArray(j.p)&&j.p.length===3&&j.p.every(Number.isFinite))TBG.p=j.p}}catch(e){}
const tbgSave=()=>LS('tracks-tbg',JSON.stringify(TBG));
function tbgApply(){
  const r=document.documentElement,el=$('#tbg');if(!el)return;
  const m=MED.get('theme'),on=TBG.on&&!!m,img=el.querySelector('img'),vd=el.querySelector('video');
  if(!on){
    r.removeAttribute('data-tbg');
    if(img._s){img._s='';img.removeAttribute('src')}
    if(vd._u){vd._u='';delete vd.dataset.v;vd.removeAttribute('poster')}
    mvEval();return;
  }
  r.setAttribute('data-tbg','1');
  el.style.setProperty('--tbd',TBG.dim/100);{const p=m.t!=='img'?TBG.p:null;el.style.setProperty('--tbx',p?p[0]+'%':'0%');el.style.setProperty('--tby',p?p[1]+'%':'0%');el.style.setProperty('--tbz',p?p[2]:1)}el.style.setProperty('--tbb',TBG.blur+'px');el.classList.toggle('tbl',TBG.blur>0);
  const anim=!RM.matches&&animM()!=='off',full=medSrc({id:'theme'}).url,poster=m.poster||'';
  const isrc=m.t==='img'?full:(m.t==='gif'&&anim?full:poster),vurl=m.t==='video'&&anim?full:'';
  if(img._s!==isrc){img._s=isrc;if(isrc)img.src=isrc;else img.removeAttribute('src')}
  if(vd._u!==vurl){vd._u=vurl;if(vurl){vd.dataset.v=vurl;vd.poster=poster}else{delete vd.dataset.v;vd.removeAttribute('poster')}}
  mvEval();
}
/* "Animated media" setting: everywhere / big players and album pages only / off */
function setAnim(v){
  ANIM.m=v;LS('tracks-anim',v);
  try{render()}catch(e){}
  miniSig=null;try{renderMini()}catch(e){}
  if($('#full').classList.contains('open')){fullSig=null;try{renderFull()}catch(e){}}
  applyBg();tbgApply();mvEval();
}
let _aIx=new Map(),_aSrc=null,_aLen=-1;
const _aBuild=()=>{_aIx=new Map();albums.forEach((a,i)=>_aIx.set(a.id,i));_aSrc=albums;_aLen=albums.length};
/* id -> index map, verified on every hit and rebuilt when the albums array changes, so it can never return a stale album */
const albumOf=s=>{const id=s&&s.album;if(!id)return undefined;
  if(_aSrc!==albums||_aLen!==albums.length)_aBuild();
  let i=_aIx.get(id),a=i!=null?albums[i]:undefined;
  if(a&&a.id===id)return a;
  _aBuild();i=_aIx.get(id);return i!=null?albums[i]:undefined};
/* a song's own cover only shows when the song has no album cover to follow, or when "keep my own cover" is on for it */
const ownCov=s=>{const a=albumOf(s);return !!s.cover&&(!!s.keepcov||!(a&&a.cover))};
const songCover=s=>{if(ownCov(s))return {cover:s.cover,name:s.name,cmedia:s.cmedia};const a=albumOf(s);if(s.color&&!(a&&a.cover))return {name:(a&&a.name)||s.name,color:s.color};return a||{name:s.name}};
const featOf=s=>Array.isArray(s.feat)?s.feat.filter(Boolean):[];
const featTxt=s=>{const f=featOf(s);return f.length?'feat. '+f.join(', '):''};
const artLine=s=>[s.artist||(albumOf(s)||{}).artist,featTxt(s)].filter(Boolean).join(' ');
const mArtist=s=>[s.artist,featTxt(s)].filter(Boolean).join(' ')||(albumOf(s)||{}).name||'Tracks';
const sub=s=>[artLine(s),(albumOf(s)||{}).name].filter(Boolean).join(' \u00b7 ');
const byOrd=(a,b)=>(a.ord??1e15)-(b.ord??1e15);
const isMainArt=(s,n)=>sameArt(artOf(s),n);
const hasFeat=(s,n)=>featOf(s).some(f=>sameArt(f,n));
const knownArts=()=>{const m=new Map(),add=x=>{x=(x||'').trim();if(x&&!m.has(x.toLowerCase()))m.set(x.toLowerCase(),x)};songs.forEach(s=>{add(s.artist);featOf(s).forEach(add)});albums.forEach(a=>{add(a.artist);albFeat(a).forEach(add)});return [...m.values()].sort(cmp)};
const albumSongs=id=>songs.filter(s=>s.album===id).sort((a,b)=>(a.pos??a.added)-(b.pos??b.added));
const artOf=s=>(s.artist||(albumOf(s)||{}).artist||'').trim();
const sameArt=(a,b)=>a.toLowerCase()===b.toLowerCase();
/* Record: a free-text group on a song (like an album, but separate). Songs with the same record name (any capitals) belong together. */
const recOf=s=>(s.rec||'').trim();
const sameRec=(a,b)=>a.toLowerCase()===b.toLowerCase();
const knownRecs=()=>{const m=new Map();songs.forEach(s=>{const r=recOf(s);if(r&&!m.has(r.toLowerCase()))m.set(r.toLowerCase(),r)});return [...m.values()].sort(cmp)};
const normRec=v=>{v=(v||'').replace(/\s+/g,' ').trim();if(!v)return '';const k=knownRecs().find(x=>sameRec(x,v));return k||v};
const recLink=(n,link=true)=>link?`<span class="alink" data-act="gotorec" data-rec="${esc(n)}">${esc(n)}</span>`:esc(n);
const artLink=(n,link=true)=>link?`<span class="alink" data-act="gotoart" data-art="${esc(n)}">${esc(n)}</span>`:esc(n);
const subHtml=(s,link=true)=>{const al=albumOf(s),ar=artOf(s),ft=featOf(s);const nm=al?(link?`<span class="alink" data-act="gotoalb" data-alb="${al.id}">${esc(al.name)}</span>`:esc(al.name)):'';const who=[ar?artLink(ar,link):'',ft.length?'feat. '+ft.map(x=>artLink(x,link)).join(', '):''].filter(Boolean).join(' ');const rc=recOf(s);return [who,nm,rc?recLink(rc,link):''].filter(Boolean).join(' \u00b7 ')};
const fullKey=s=>s.id+'|'+s.name+'|'+sub(s)+'|'+recOf(s)+'|'+((songCover(s).cover||'').length)+'|'+(s.color||'')+'|'+((songCover(s).cmedia||{}).id||'')+'|'+animM()+(PERF.f.media?'|p':'');
function accent(s){
  if(s.color)return hexRgb(s.color).split(',').map(Number);
  if(ownCov(s)&&s.ccol)return s.ccol;
  const a=albumOf(s);if(a&&a.cover&&a.ccol&&!ownCov(s))return a.ccol;
  return hsl2rgb(hue((a&&a.name)||s.name),.6,.5);
}
const CVU=new Map();
/* a cover is stored as a data URI (tens of KB of text). Pasting it into every row made the page HTML huge; a blob URL is shared by every row with the same cover */
function lurl(d){
  if(typeof d!=='string'||!d.startsWith('data:'))return d;
  let u=CVU.get(d);if(u)return u;
  if(CVU.size>=600)return d;
  try{const i=d.indexOf(','),h=d.slice(5,i);if(i<0||!/;base64$/.test(h))return d;
    const b=atob(d.slice(i+1)),a=new Uint8Array(b.length);for(let k=0;k<b.length;k++)a[k]=b.charCodeAt(k);
    u=URL.createObjectURL(new Blob([a],{type:h.split(';')[0]||'image/jpeg'}));CVU.set(d,u);return u}catch(e){return d}
}
function cover(a,fallback,live){
  if(a&&a.cover){
    const m=a.cmedia&&animOn(live)?medSrc(a.cmedia):null;
    if(m){
      const ps=posStyle(a.cmedia);
      if(m.t==='video'){MV.flag=true;return ps?`<div class="cov cm"><img src="${safeImg(a.cover)}" alt="" decoding="async"><video class="cmv lay mv" data-v="${m.url}" ${VATTR} style="${ps}"></video></div>`:`<div class="cov cm"><video class="cmv mv" data-v="${m.url}" poster="${safeImg(a.cover)}" ${VATTR}></video></div>`}
      return `<div class="cov cm"><img src="${m.url}" alt="" loading="lazy" decoding="async"${ps?` style="${ps}"`:''}></div>`;
    }
    return `<div class="cov"><img src="${lurl(safeImg(a.cover))}" alt="" loading="lazy" decoding="async"></div>`;
  }
  const n=(a&&a.name)||fallback||'?',h=hue(n);
  if(a&&a.color)return `<div class="cov" style="background:linear-gradient(160deg,rgba(255,255,255,.2),rgba(0,0,0,.3)),${a.color}">${esc(n.trim().charAt(0).toUpperCase())}</div>`;
  return `<div class="cov" style="background:linear-gradient(135deg,hsl(${h} 60% 45%),hsl(${(h+50)%360} 65% 30%))">${esc(n.trim().charAt(0).toUpperCase())}</div>`;
}
const hexRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');return m?[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)).join(','):'255,90,54'};
const folderTile=(f,P)=>{const k=(P?playlists:albums).filter(a=>a.folderId===f.id).slice(0,4);return `<div class="fold" style="--fa:${hexRgb(f.color)}">${fcov(f)}${k.length?k.map(a=>`<div class="fc">${P?plCover(a):cover(a)}</div>`).join(''):`<div class="fe">${ic('folder',48)}</div>`}</div>`};
const foldCard=f=>{const n=(foldCard.m||(foldCard.m=new Map())).get(f.id)||0;return `<div class="fcard" data-fid="${f.id}"><button class="card" data-act="openf" data-id="${f.id}">${folderTile(f)}<b>${esc(f.name)}</b><span>${n} ${n===1?'item':'items'}</span></button><button class="fm" data-act="foldermenu" data-id="${f.id}" aria-label="Folder options">${ic('dots',22)}</button></div>`};
/* screen-reader announcements: one persistent live region (a node that is created and filled in the same moment is often not read) */
let _sayT=0;
function say(m,urgent){const e=document.getElementById(urgent?'livea':'live');if(!e)return;clearTimeout(_sayT);e.textContent='';_sayT=setTimeout(()=>{e.textContent=String(m)},60)}
function toast(m,urgent){
  document.querySelectorAll('.toast').forEach(x=>x.remove());say(m,urgent);
  const t=document.createElement('div');t.className='toast';t.setAttribute('aria-hidden','true');t.textContent=m;t.style.bottom=(($('#app').classList.contains('hm')?($('#app').classList.contains('mh')?84:232):40)+(document.documentElement.dataset.dock==='bottom'?66:0))+'px';document.body.appendChild(t);
  an(t,[{opacity:0,transform:'translate(-50%,16px) scale(.96)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],{duration:340,easing:EASE_OUT});
  setTimeout(()=>{const a=an(t,[{opacity:1,transform:'translate(-50%,0)'},{opacity:0,transform:'translate(-50%,10px)'}],{duration:240,easing:EASE,fill:'forwards'});setTimeout(()=>t.remove(),a?250:0)},2000);
}


/* ===== END 05-media.js ===== */


/* ===== BEGIN 06-ui.js ===== */
/* sheets */
/* gives every popup the settings structure: sticky header with a large title and close button, then a padded body where menu items sit in one card */
function ovLook(sh){
  const h=sh.firstElementChild;
  if(!h||h.tagName!=='H3')return;
  const hd=document.createElement('div');hd.className='sthd';
  const row=document.createElement('div');row.className='sth';
  sh.insertBefore(hd,h);hd.appendChild(row);row.appendChild(h);
  const x=document.createElement('button');x.type='button';x.className='ovx';x.setAttribute('aria-label','Close');x.innerHTML=ic('close',16);
  x.onclick=()=>$('#ov').click();
  row.appendChild(x);
  const body=document.createElement('div');body.className='ovb';
  while(hd.nextSibling)body.appendChild(hd.nextSibling);
  sh.appendChild(body);
  let run=null;
  [...body.children].forEach(n=>{
    if(n.classList.contains('it')){if(!run){run=document.createElement('div');run.className='scd mnu';body.insertBefore(run,n)}run.appendChild(n)}
    else run=null;
  });
}
let ovFrom=null;
/* sheets announce themselves as dialogs, take focus, and give it back to what opened them */
function ovA11y(sh,was){
  if(!was)ovFrom=document.activeElement;
  sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.tabIndex=-1;
  const h=sh.querySelector('h3');if(h){h.id='ovt';sh.setAttribute('aria-labelledby','ovt')}else sh.setAttribute('aria-label','Dialog');
  try{sh.focus({preventScroll:true})}catch(_){}
}
document.addEventListener('keydown',e=>{
  const ov=document.getElementById('ov');if(!ov||!ov.classList.contains('open'))return;
  if(document.querySelector('#crop,#cmk'))return;
  const sh=ov.firstElementChild;if(!sh)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();ov.dispatchEvent(new MouseEvent('click',{bubbles:true}));return}
  if(e.key!=='Tab')return;
  const f=[...sh.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length),a=document.activeElement;
  if(!f.length){e.preventDefault();return}
  if(!sh.contains(a)||a===sh){e.preventDefault();(e.shiftKey?f[f.length-1]:f[0]).focus();return}
  if(e.shiftKey&&a===f[0]){e.preventDefault();f[f.length-1].focus()}
  else if(!e.shiftKey&&a===f[f.length-1]){e.preventDefault();f[0].focus()}
},true);
function openOv(html){
  const ov=$('#ov'),was=ov.classList.contains('open');
  ov.classList.remove('ctx');ov.oncontextmenu=null;
  ov.innerHTML=`<div class="sheet">${html}</div>`;ov.classList.add('open');
  const sh=ov.firstElementChild;
  ovLook(sh);ovA11y(sh,was);
  if(!was)an(ov,[{opacity:0},{opacity:1}],{duration:220,easing:'linear'});
  an(sh,was?[{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'none'}]:[{transform:'translateY(100%)'},{transform:'none'}],{duration:was?200:380,easing:EASE_OUT});
  if(!PERF.f.ui)sh.querySelectorAll('.it').forEach((b,i)=>an(b,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:300,delay:90+Math.min(i,8)*22,easing:EASE_OUT,fill:'backwards'}));
}
function closeOv(){
  const ov=$('#ov');if(!ov.classList.contains('open'))return;
  const ctx=ov.classList.contains('ctx');
  const g=ctx||PERF.f.ui||RM.matches?null:ov.cloneNode(true);if(g){g.className='ovg';g.removeAttribute('id');g.removeAttribute('style');g.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'))}
  ov.classList.remove('open','ctx');ov.innerHTML='';ov.oncontextmenu=null;
  {const f=ovFrom;ovFrom=null;if(f&&f.isConnected&&f.focus)try{f.focus({preventScroll:true})}catch(_){}}
  if(RM.matches||PERF.f.ui)return;
  document.body.appendChild(g);
  an(g.firstElementChild,[{transform:'none'},{transform:'translateY(100%)'}],{duration:260,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  an(g,[{opacity:1},{opacity:0}],{duration:260,easing:'linear',fill:'forwards'});
  setTimeout(()=>g.remove(),280);
}
$('#ov').addEventListener('click',e=>{if(e.target.id==='ov')closeOv()});
function autoIc(it,t){const l=it.label||'';
  if(/^New album/i.test(l))return 'album';if(/^New playlist/i.test(l))return 'plist';if(/^New folder/i.test(l))return 'folderplus';
  if(/^Import folder as album/i.test(l))return 'impalb';if(/^Import folder as playlist/i.test(l))return 'imppl';if(/^Import Spotify/i.test(l))return 'spotify';if(/^Add files/i.test(l))return 'filep';if(/^Import folder$/i.test(l))return 'impfld';
  if(/^Delete/i.test(l))return 'trash';if(/^Customize/i.test(l))return 'palette';if(/^Edit/i.test(l))return 'pencil';
  if(/cover/i.test(l))return 'image';if(/^No folder/i.test(l))return 'minus';if(/^New /i.test(l))return 'plus';
  if(/folder/i.test(l)||/^Move to folder/i.test(t))return 'folder';if(/^Add songs/i.test(l))return 'addpl';
  if(/^Sort/i.test(t))return 'filter';return 'folder'}
function choose(title,items){return new Promise(res=>{
  items.forEach(it=>{if(!it.ic&&!it.noic&&!(it.cov||it.plus||it.pl))it.ic=autoIc(it,title)});
  openOv(`<h3>${esc(title)}</h3>`+items.map((it,i)=>{const hc=it.cov||it.plus||it.pl;return `<button class="it ${hc?'hc':''} ${it.ic?'hi':''} ${it.gap?'gap':''} ${it.danger?'dg':''} ${it.sel?'sel':''}" data-i="${i}"${it.sel?' aria-current="true"':''}>${it.ic?ic(it.ic,20):''}${it.cov?`<span class="mc">${cover(it.cov)}</span>`:it.pl?`<span class="mc">${plCover(it.pl)}</span>`:it.plus?`<span class="mc"><div class="cov" style="background:var(--surf2);color:var(--mute)">+</div></span>`:''}${hc||it.ic?`<span class="lb">${esc(it.label)}</span>`:esc(it.label)}</button>`}).join(''));
  if(ctxAt){const at=ctxAt;ctxAt=null;const ov=$('#ov'),sh=ov.firstElementChild;ov.classList.add('ctx');sh.getAnimations().forEach(x=>x.cancel());
    const w=sh.offsetWidth,h=sh.offsetHeight,m=8;
    sh.style.left=Math.max(m,Math.min(at.x,innerWidth-w-m))+'px';sh.style.top=Math.max(m,Math.min(at.y,innerHeight-h-m))+'px';
    an(sh,[{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],{duration:140,easing:EASE_OUT})}
  $('#ov .sheet').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;closeOv();res(items[b.dataset.i].value)};
  $('#ov').onclick=e=>{if(e.target.id==='ov'){closeOv();res(null)}};
  $('#ov').oncontextmenu=e=>{if($('#ov').classList.contains('ctx')){e.preventDefault();closeOv();res(null)}};
})}
function ask(title,val,ok){return new Promise(res=>{
  openOv(`<h3>${esc(title)}</h3><input type="text" id="qi" maxlength="80"><div class="bt"><button class="pill" id="qc">Cancel</button><button class="pill acc" id="qo">${ok||'Save'}</button></div>`);
  const i=$('#qi');i.value=val||'';setTimeout(()=>{i.focus();i.select()},60);
  const done=v=>{closeOv();res(v)};
  $('#qc').onclick=()=>done(null);$('#qo').onclick=()=>done(i.value.trim()||null);
  i.onkeydown=e=>{if(e.key==='Enter')done(i.value.trim()||null)};
  $('#ov').onclick=e=>{if(e.target.id==='ov')done(null)};
})}

/* rendering */
function rowHtml(s,i,withCover){
  return `<div class="row${withCover?' hc':''} ${cur===s.id?'on':''}" data-act="${selMode?'selrow':'play'}" data-id="${s.id}"><div class="n">${selMode?`<span class="ck ${selSet.has(s.id)?'on':''}">${selSet.has(s.id)?ic('check',14):''}</span>`:i+1}</div>${withCover?`<div class="th">${cover(songCover(s),s.name)}</div>`:''}<div class="t"><b>${esc(s.name)}</b><span>${view.album&&!withCover?fmtDate(s.added):subHtml(s,!(selMode))||'No album'}</span></div><span class="d">${likeBadgeHtml(s)}${lyBadgeHtml(s.id)}<span class="tm">${fmt(effDur(s))}</span></span><button class="k" data-act="menu" data-id="${s.id}" aria-label="More options">${ic('dots',22)}</button></div>`;
}
function songsList(){
  const q=fold(view.q.trim());
  const l=q?songs.filter(s=>fold(s.name+' '+(s.artist||'')+' '+featOf(s).join(' ')+' '+((albumOf(s)||{}).name||'')+' '+recOf(s)+' '+artOf(s)).includes(q)):songs.slice();
  const S=SORTS[sortKey][1],A=view.artist;
  if(view.rec)return l.filter(s=>sameRec(recOf(s),view.rec)).sort(S);
  if(A)return l.filter(s=>isMainArt(s,A)).sort(S).concat(l.filter(s=>!isMainArt(s,A)&&hasFeat(s,A)).sort(S));
  return l.sort(S);
}
const fbar=(back,title,subt,extra)=>`<div class="abar fbr${extra?' fx':''}"><button class="back" data-act="back" aria-label="Back to ${back}">${ic('arrow',24)}</button><div class="ft"><h2>${esc(title)}</h2><span>${subt}</span></div><div class="abtns">${extra}</div></div>`;
const FSZ_LAB={s:'Small',m:'Medium',l:'Large',c:'Custom'},FSZ_IC={s:'szs',m:'szm',l:'szl',c:'tune'};
const fszBtns=()=>{const k=FSZ_LAB[fsz]?fsz:'m';return `<button class="ab" data-act="fszmenu" aria-haspopup="dialog" aria-label="Cover size: ${FSZ_LAB[k]}" title="Cover size: ${FSZ_LAB[k]}">${ic(FSZ_IC[k],21)}</button>`}
const FC={mn:64,mx:420,v:Math.min(420,Math.max(64,+LS('tracks-fcw')||160))};
const gridOpen=()=>`<div class="grid ${({s:'g3',l:'g1',c:'gc'}[fsz]||'')}${gMode?' gsm':''}"${fsz==='c'?` style="--gcw:${FC.v}px"`:''}>`;
function fcApply(){const g=document.querySelector('#main .grid');if(!g)return;g.classList.remove('g3','g1');g.classList.add('gc');g.style.setProperty('--gcw',FC.v+'px')}
function fcSheet(){
  openOv(`<h3>Custom size</h3><div class="fcs"><div class="bgs"><div class="fop"><span>Size</span><input type="range" class="rng" id="fcr" min="${FC.mn}" max="${FC.mx}" step="1" aria-label="Cover size"><b></b></div></div><div class="bt"><button type="button" class="pill" id="fcrs">Reset</button><button type="button" class="pill acc" id="fcok">Done</button></div></div>`);
  const r=$('#fcr'),ov=$('#ov'),val=r.parentNode.querySelector('b'),H=document.documentElement;
  let tgt=FC.v,raf=0;
  const clamp=v=>Math.min(FC.mx,Math.max(FC.mn,Math.round(v)));
  const save=()=>{LS('tracks-fsize','c');LS('tracks-fcw',String(tgt))};
  /* everything visual happens once per animation frame: one CSS variable on the grid, a few on the preview, no HTML rebuilt while sliding */
  const frame=()=>{
    raf=0;FC.v=tgt;fsz='c';fcApply();
    if(+r.value!==FC.v)r.value=FC.v;
    r.style.setProperty('--p',((FC.v-FC.mn)/(FC.mx-FC.mn)*100)+'%');val.textContent=FC.v+'px';
  };
  const flush=()=>{if(raf)cancelAnimationFrame(raf);frame()};
  const set=v=>{tgt=clamp(v);if(!raf)raf=requestAnimationFrame(frame)};
  const off=()=>{H.classList.remove('fcdrag');save()};
  r.addEventListener('pointerdown',()=>{H.classList.add('fcdrag');addEventListener('pointerup',off,{once:true});addEventListener('pointercancel',off,{once:true})});
  r.addEventListener('input',()=>set(+r.value));
  r.addEventListener('change',save);
  $('#fcrs').onclick=()=>{tgt=160;flush();save()};
  const end=e=>{if(e.target.id==='ov'||e.target.closest('#fcok')){ov.removeEventListener('click',end);if(raf){cancelAnimationFrame(raf);frame()}off();setTimeout(()=>{if(e.target.closest&&e.target.closest('#fcok'))closeOv();render()},0)}};
  ov.addEventListener('click',end);
  frame();
}
let _rsTok=0,_rsPend=null,sqT=0;
/* finish a chunked song list right now (drag-select needs every row in the page) */
function flushRows(){if(_rsPend){const f=_rsPend;_rsPend=null;f()}}
function renderSongs(m){
  const l=songsList(),A=view.artist,nf=A?l.filter(s=>!isMainArt(s,A)).length:0,keep=m.scrollTop;
  const mk=(s,i)=>(A&&nf&&i===0&&isMainArt(s,A)?'<div class="qs">Songs</div>':'')+(A&&nf&&!isMainArt(s,A)&&(i===0||isMainArt(l[i-1],A))?'<div class="qs">Featured on</div>':'')+rowHtml(s,i,true);
  if(view.rec)$('#fb').innerHTML=fbar('Songs',view.rec,`${l.length} ${l.length===1?'song':'songs'}`,'');
  if(view.artist)$('#fb').innerHTML=fbar('Songs',view.artist,`${l.length} ${l.length===1?'song':'songs'}${nf?' \u00b7 '+nf+' featured':''}`,'');
  if(!l.length){m.innerHTML=`<div class="empty">${view.artist||view.rec?'No songs found.':songs.length?'No matches.':'No songs yet.<br>Tap the + button to import mp3, wav, flac, m4a and more from your phone.'}</div>`;return}
  const N=l.length,first=Math.max(120,Math.ceil((keep+innerHeight)/56)+30);
  if(N<=first+60){m.innerHTML=l.map(mk).join('');return}
  /* big library: paint enough rows to cover the scroll position, then add the rest a few at a time so the page stays responsive */
  let i=first,tm=0;const tok=_rsTok;
  m.innerHTML=l.slice(0,i).map(mk).join('');
  const done=()=>{clearTimeout(tm);if(tok!==_rsTok)return;if(i<N){m.insertAdjacentHTML('beforeend',l.slice(i).map((s,k)=>mk(s,i+k)).join(''));i=N}_rsPend=null};
  const step=()=>{if(tok!==_rsTok)return;const j=Math.min(N,i+160);m.insertAdjacentHTML('beforeend',l.slice(i,j).map((s,k)=>mk(s,i+k)).join(''));i=j;if(i<N)tm=setTimeout(step,12);else _rsPend=null};
  _rsPend=done;tm=setTimeout(step,0);
}
const szBar=(n)=>`<div class="abar fbr szr">${fszBtns()}${gBtn(n)}${n>1?`<button class="ab" data-act="reorder" aria-label="Reorder" title="Reorder">${ic('reorder',21)}</button>`:''}</div>`;
var fsz='m';try{fsz=localStorage.getItem('tracks-fsize')||'m'}catch(e){}
function renderAlbums(m){
  const inF=view.folder?folders.find(f=>f.id===view.folder):null;
  const list=albums.filter(a=>(a.folderId||null)===(inF?inF.id:null)).sort(byOrd);
  foldCard.m=new Map();for(const x of albums)if(x.folderId)foldCard.m.set(x.folderId,(foldCard.m.get(x.folderId)||0)+1);
  const cnt=new Map();for(const x of songs)if(x.album)cnt.set(x.album,(cnt.get(x.album)||0)+1);
  let h='';
  if(!inF)$('#fb').innerHTML=szBar(list.length);
  if(inF)$('#fb').innerHTML=fbar('Albums',inF.name,`${list.length} ${list.length===1?'album':'albums'}`,fszBtns()+`<span class="ftl">`+gBtn(list.length)+`<button class="ab" data-act="fmore" aria-haspopup="dialog" aria-label="More folder options" title="More">${ic('dots',22)}</button></span>`);
  h+=gridOpen()+(inF?'':folders.map(foldCard).join(''))+
    list.map(a=>{const n=cnt.get(a.id)||0;return `<div class="acard${gMode&&gSet.has(a.id)?' gon':''}" data-gid="${a.id}">${gMode?`<span class="gck">${gSet.has(a.id)?ic('check',15):''}</span>`:''}<button class="card" data-act="open" data-id="${a.id}">${cover(a)}<b>${esc(a.name)}</b><span>${(a.artist||albFeat(a).length)?esc((a.artist||'')+(albFeat(a).length?(a.artist?' ':'')+'feat. '+albFeat(a).join(', '):''))+' \u00b7 ':''}${n} ${n===1?'song':'songs'}</span></button><button class="alm" data-act="almenu" data-id="${a.id}" aria-label="Album options">${ic('dots',20)}</button></div>`}).join('')+'</div>';
  if(!list.length&&(inF||!folders.length))h+=`<div class="empty">${inF?'This folder is empty.<br>Tap + to create an album here.':'No albums yet.<br>Tap + to create an album or a folder.'}</div>`;
  m.innerHTML=h;
}
function renderAlbum(m){
  const a=albums.find(x=>x.id===view.album),list=albumSongs(a.id);
  const arts=[...new Set(list.map(s=>(s.artist||'').trim()).filter(Boolean))];
  const artTxt=arts.length>2?arts.slice(0,2).join(' & ')+' & more':arts.join(' & ');
  const tot=list.reduce((n,s)=>n+effDur(s),0);
  const afl=albFeat(a),artHtml=(a.artist?artLink(a.artist):arts.slice(0,2).map(x=>artLink(x)).join(' &amp; ')+(arts.length>2?' &amp; more':''))+(afl.length?' feat. '+afl.map(x=>artLink(x)).join(', '):'');
  const meta=[a.artist||artTxt,list.length+(list.length===1?' track':' tracks'),tot?Math.max(1,Math.round(tot/60))+' min':''].filter(Boolean).join(' \u00b7 ');
  $('#fb').innerHTML=`<div class="abar"><button class="back" data-act="back" aria-label="Back">${ic('arrow',26)}</button><div class="abtns"><button class="ab" data-act="addsongs" data-id="${a.id}" aria-label="Add songs" title="Add songs">${ic('addpl',22)}</button><button class="ab" data-act="albqueue" data-id="${a.id}" aria-label="Add album to queue" title="Add album to queue">${ic('qm',21)}</button><button class="ab${selMode?' acc':''}" data-act="select" aria-label="Select songs" title="Select songs">${ic('sel',21)}</button><button class="ab" data-act="albmenu" data-id="${a.id}" aria-label="More options" title="More">${ic('dots',22)}</button></div></div>`;
  m.innerHTML=`<div class="acv">${cover(a,undefined,true)}</div>
  <div class="at"><h2>${esc(a.name)}</h2><button class="ib sh" data-act="playshuf" data-id="${a.id}" aria-label="Shuffle play">${ic('shuffle',22)}</button><button class="pbig" data-act="playall" data-id="${a.id}" aria-label="Play">${ic('play',26)}</button></div>
  <p class="am">${[artHtml,list.length+(list.length===1?' track':' tracks'),tot?Math.max(1,Math.round(tot/60))+' min':''].filter(Boolean).join(' \u00b7 ')}</p>`+
    '<div class="rl">'+(list.length?list.map((s,i)=>rowHtml(s,i,false)).join(''):'<div class="empty">This album is empty.<br>Use the add songs button to pick from your library.</div>')+'</div>';
}
function render(){
  _rsTok++;_rsPend=null;
  const m=$('#main'),keep=m.scrollTop;
  if(view.album&&!albums.find(a=>a.id===view.album))view.album=null;
  if(view.folder&&!folders.find(f=>f.id===view.folder))view.folder=null;
  if(view.artist&&!songs.some(x=>isMainArt(x,view.artist)||hasFeat(x,view.artist)))view.artist=null;
  if(view.rec&&!songs.some(x=>sameRec(recOf(x),view.rec)))view.rec=null;
  if(view.pl&&!plGet(view.pl))view.pl=null;
  if(view.pf&&!pfolders.find(f=>f.id===view.pf))view.pf=null;
  const PT=view.tab==='playlists',depth=PT?(view.pl?2:view.pf?1:0):(view.album?2:(view.folder||view.artist||view.rec)?1:0),key=view.tab+':'+(PT?(view.pl||view.pf||''):(view.album||view.folder||view.artist||view.rec||'')),navd=key!==lastKey;
  let dir=depth>lastDepth?1:depth<lastDepth?-1:0;if(view.tab!==lastTab)dir=TABS.indexOf(view.tab)>TABS.indexOf(lastTab)?1:-1;else if(dir===0)dir=view.tab==='songs'?1:-1;
  if(navd&&selMode){selMode=false;selSet.clear()}if(gMode&&(navd||!gOk()))gOff();$('#app').classList.toggle('gmode',gMode);$('#t1').classList.toggle('on',view.tab==='albums');$('#t2').classList.toggle('on',view.tab==='songs');$('#t3').classList.toggle('on',PT);
  $('#tb').classList.toggle('show',view.tab==='songs');
  $('#app').classList.toggle('selmode',selMode&&canSel());{const rm=$('#selrm');if(rm)rm.style.display=(view.tab==='albums'&&view.album)||(view.tab==='playlists'&&view.pl)?'':'none'}$('#selbtn').classList.toggle('on',selMode);
  $('#app').classList.toggle('inalb',!!(view.album&&view.tab==='albums'));
  {const pb=$('#plus'),off=!!((view.tab==='albums'&&view.album)||(PT&&view.pl));pb.style.visibility='visible';pb.classList.toggle('off',off);pb.setAttribute('aria-disabled',off?'true':'false')}
  $('#plus').setAttribute('aria-label',view.tab==='songs'?'Import songs':'Create');
  const fl=$('#fl');if(fl)fl.textContent=SORTS[sortKey][0];{const ft=$('#flt');if(ft){ft.setAttribute('aria-label','Sort songs: '+SORTS[sortKey][0]);ft.title='Sort: '+SORTS[sortKey][0];ft.classList.toggle('chg',sortKey!=='added')}}
  $('#fb').innerHTML='';
  if(view.tab==='songs')renderSongs(m);else if(PT)renderPlaylists(m);else if(view.album)renderAlbum(m);else renderAlbums(m);
  m.scrollTop=navd?0:keep;
  if(navd)enterAnim(m,lastKey===null?0:dir);
  lastKey=key;lastDepth=depth;lastTab=view.tab;
  renderMini();
}
function syncCtl(){
  document.querySelectorAll('[data-act=shuffle]').forEach(b=>{b.classList.toggle('on',shuffle);if(!b.firstChild)b.innerHTML=ic('shuffle',22)});
  paintVol();
  document.querySelectorAll('[data-act=repeat]').forEach(b=>{b.classList.toggle('on',!!repeat);const k=repeat===2?'repeat1':'repeat';if(b.dataset.k!==k){b.dataset.k=k;b.innerHTML=ic(k,22)}});
}
function renderMini(){
  const s=songById(cur),mini=$('#mini'),was=mini.style.display==='flex';
  mini.style.display=s?'flex':'none';$('#app').classList.toggle('hm',!!s);
  if(!s)return;
  if(!was)an(mini,[{transform:'translateY(130%)',opacity:0},{transform:'none',opacity:1}],{duration:460,easing:EASE_OUT});
  mini.style.setProperty('--ac',accent(s).join(','));
  miniBg(s);{const lc=accent(s).join(',');$('#logo').style.setProperty('--lac',lc);document.documentElement.style.setProperty('--lac',lc)}
  const sig=fullKey(s);
  if(sig!==miniSig){
    miniSig=sig;setSession(s);$('#mc').innerHTML=cover(songCover(s),s.name,true);$('#mt').textContent=s.name;$('#ms').innerHTML=subHtml(s)||'No album';
    {const k0=$('#msk');k0.value=0;k0.style.setProperty('--p','0%');$('#mct').textContent='0:00';$('#mdt').textContent=fmt(effDur(s))}
    if(miniFor!==s.id){miniFor=s.id;an($('#mc'),[{opacity:0,transform:'scale(.82)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE_OUT});an($('#mini .t'),[{opacity:0,transform:'translateX(10px)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE_OUT})}
  }
  const k=au.paused?'play':'pause',mp=$('#mp');
  if(mp.dataset.k!==k){mp.dataset.k=k;mp.innerHTML=ic(k,24);pop(mp.firstChild)}
  syncCtl();
  npRender(s);
  if($('#full').classList.contains('open'))syncFull();
  if(qOpen)renderQueue();
}
function updateBg(s){
  if(bgKey!==bgKeyOf(s))loadBg(s);
  const [r,g,b]=bgS.col?hexRgb(bgS.col).split(',').map(Number):accent(s),[h,sat]=rgb2hsl(r,g,b),c=[[r,g,b],hsl2rgb(h+38,sat,.46),hsl2rgb(h-32,sat*.9,.36)];
  ['.b1','.b2','.b3'].forEach((q,i)=>{$('#fbg '+q).style.backgroundColor='rgb('+c[i].join(',')+')'});
  {const f=$('#fbg').style;f.setProperty('--c0',c[0].join(','));f.setProperty('--c1',c[1].join(','));f.setProperty('--c2',c[2].join(','));f.setProperty('--c3',hsl2rgb(h,Math.min(sat,.8),.24).join(','))}
  {const bi=$('#fbg .bimg'),c=songCover(s),cv=c.cover||'',gm=c.cmedia&&cv&&animOn(true)?medSrc(c.cmedia):null,u=gm&&gm.t==='gif'?gm.url:cv;if(bi._cv!==u){bi._cv=u;bi.style.backgroundImage=u?'url("'+u+'")':'none';bi.classList.toggle('on',!!u)}$('#fbg').classList.toggle('hascov',!!cv)}
  applyBg();
}
function renderFull(){
  const s=songById(cur);if(!s)return closeFull();
  const p=vD()?vT()/vD():0;
  const oc=$('#fc .cov'),ghost=(oc&&fullFor!==null&&fullFor!==s.id)?mvGhost(oc.cloneNode(true)):null;
  $('#fc').innerHTML=`<div class="ftop"><button class="ib" data-act="closefull" aria-label="Close player">${ic('down',30)}</button><div class="tbm"><button class="ib tbmb" data-act="tbmenu" aria-haspopup="menu" aria-expanded="false" aria-label="Player options" title="Player options">${ic('tune',22)}</button><div class="tbmp" role="menu" aria-hidden="true"><button class="tbmi" role="menuitem" data-act="bgopts">${ic('image',24)}<span>Background</span></button><button class="tbmi" role="menuitem" data-act="tropts">${ic('trans',24)}<span>Transition</span></button><button class="tbmi" role="menuitem" data-act="fxopts">${ic('fxi',24)}<span>Beat effects</span></button><button class="tbmi" role="menuitem" data-act="outdev">${ic('out',24)}<span>Output device</span></button><button class="tbmi" role="menuitem" data-act="lyedit">${ic('mic',24)}<span>Sync lyrics</span></button></div></div><button class="ib nmb fnm" data-act="norm" aria-pressed="false" aria-label="Normalize volume" title="Normalize volume">${ic('norm',22)}</button><button class="ib fedit" data-act="editfull" aria-label="Edit song details" title="Edit song details">${ic('edit',22)}</button><button class="ib flyb${lyOn?' on':''}" data-act="lyrics" aria-pressed="${lyOn}" aria-label="Lyrics" title="Lyrics (L)">${ic('mic',22)}</button></div><div class="fcv${lyOn?' ly':''}">${cover(songCover(s),s.name,true)}<div class="lyp" aria-hidden="${lyOn?'false':'true'}"><div class="lys" id="lys"></div></div></div><div class="fti"><h2>${esc(s.name)}</h2><p>${subHtml(s)}</p></div>
  <div class="fsk"><input type="range" class="rng seek" id="sk" min="0" max="1000" value="${Math.round(p*1000)}" style="--p:${p*100}%" aria-label="Seek"><div class="tm"><span id="ct">${fmt(vT())}</span><span id="dt2">${fmt(vD()||effDur(s))}</span></div></div>
  <div class="ctl"><button class="ib tg" data-act="shuffle" aria-label="Shuffle"></button><button class="ib" data-act="prev" aria-label="Previous">${ic('prev',28)}</button><button class="ib big" id="fp" data-k="${au.paused?'play':'pause'}" data-act="toggle" aria-label="Play or pause">${ic(au.paused?'play':'pause',34)}</button><button class="ib" data-act="next" aria-label="Next">${ic('next',28)}</button><button class="ib tg" data-act="repeat" aria-label="Repeat"></button></div>
  <div class="fbot"><div class="fg">${likeBtn(s)}${oneBtn()}<button class="ib" data-act="minialbum" aria-label="Add to album">${ic('album',22)}</button><button class="ib" data-act="miniplaylist" aria-label="Add to playlist">${ic('plist',22)}</button></div><div class="fvol"><button class="ib mt" data-act="mute" data-vi data-s="20" aria-label="Mute or unmute">${ic('vol',20)}</button><input type="range" class="rng" id="fvol" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%;--f:#fff;--t:rgba(255,255,255,.28)" aria-label="Volume"></div><div class="fr"><button class="ib" data-act="qopen" aria-label="Queue">${ic('qm',24)}</button><button class="ib pcx" data-act="editfull" aria-label="Edit song details" title="Edit song details">${ic('edit',22)}</button></div></div>`;
  const sk=$('#sk');
  sk.oninput=()=>{if(vD())vSeek(sk.value/1000*vD());sk.style.setProperty('--p',(sk.value/10)+'%');$('#ct').textContent=fmt(vT())};
  sk.onpointerdown=()=>{seeking=true};
  $('#fvol').oninput=e=>setVol(e.target.value/100);nmPaint();
  const changed=fullFor!==null&&fullFor!==s.id,fresh=fullFor!==s.id;fullFor=s.id;fullSig=fullKey(s);
  syncCtl();updateBg(s);lyInit(s,fresh);
  if(changed)coverChange(ghost,trDir);
  fxKick();
  try{fpApply()}catch(_){}/* free placement: the full player is rebuilt per song */
}
function syncFull(){
  const s=songById(cur);if(!s)return;
  if(fullSig!==fullKey(s))return renderFull();
  updateBg(s);
  const p=$('#fp');if(p){const k=au.paused?'play':'pause';if(p.dataset.k!==k){p.dataset.k=k;p.innerHTML=ic(k,34);pop(p.firstChild)}}
}
function openFull(){
  const f=$('#full');f.getAnimations().forEach(x=>x.cancel());
  f.classList.remove('closing');f.classList.add('open');fullSig=null;fullFor=null;renderFull();
  an(f,[{transform:'translateY(100%)'},{transform:'none'}],{duration:430,easing:EASE_OUT});
  [...$('#fc').children].forEach((c,i)=>an(c,[{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'none'}],{duration:420,delay:130+i*40,easing:EASE_OUT,fill:'backwards'}));
}
function closeFull(){
  const f=$('#full');if(!f.classList.contains('open'))return;
  f.classList.add('closing');   /* lets the logo start gliding back at once */
  const a=an(f,[{transform:'none'},{transform:'translateY(100%)'}],{duration:320,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  if(a)a.onfinish=()=>{f.classList.remove('open','closing');a.cancel()};else f.classList.remove('open','closing');
}


/* ===== END 06-ui.js ===== */


/* ===== BEGIN 07-lyrics.js ===== */
/* ===== Lyrics =====
   Sources, best first: ID3 SYLT (synced) -> LRC text inside USLT -> .lrc file next to the song or added by hand -> plain USLT (shown unsynced).
   Results live in their own IndexedDB store ("lyrics"), so scanning never rewrites a song's audio blob. */
const LYR_V=1;/* bump to make every song get rescanned */
const LY_LEAD=.2;/* seconds: light a line a hair early so it feels on the beat */
const LYM=new Map(),lyTmp=new Map(),lyBusy=new Map();
const lyKey=n=>String(n).replace(/\.[^.]+$/,'').trim().toLowerCase();
/*LYPURE*/
/* "[mm:ss.xx] text" -> [[ms,text],...]; handles several stamps per line, [offset:], and <mm:ss.xx> word stamps */
function parseLrc(txt){
  const out=[],tag=/^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;let off=0;
  for(const raw of String(txt||'').replace(/^\uFEFF/,'').split(/\r\n|\r|\n/)){
    let rest=raw,m;const ts=[];
    while((m=tag.exec(rest))){ts.push((Number(m[1])*60+Number(m[2]))*1000+(m[3]?Math.round(parseFloat('0.'+m[3])*1000):0));rest=rest.slice(m[0].length)}
    if(!ts.length){const o=/^\s*\[offset:\s*([+-]?\d+)\s*\]/i.exec(raw);if(o)off=Number(o[1]);continue}
    const text=rest.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g,'').replace(/\s+/g,' ').trim();
    ts.forEach(t=>out.push([t,text]));
  }
  out.sort((a,b)=>a[0]-b[0]);
  if(off)out.forEach(x=>{x[0]=Math.max(0,x[0]-off)});
  return out;
}
const lyPlain=t=>String(t||'').replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).map(x=>x.replace(/\s+$/,''));
/* -> {s:true,l:[[ms,text]...]} synced | {s:false,l:[text...]} plain | 0 none */
function lyMake(sylt,uslt){
  if(sylt&&sylt.length>=2)return {s:true,l:sylt};
  if(uslt){
    if(/^\s*\[\d{1,3}:\d{1,2}/m.test(uslt)){const l=parseLrc(uslt);if(l.filter(x=>x[1]).length>=2)return {s:true,l}}
    const l=lyPlain(uslt);while(l.length&&!l[0].trim())l.shift();while(l.length&&!l[l.length-1].trim())l.pop();
    if(l.length)return {s:false,l};
  }
  return 0;
}
function _unsync(u){const o=[];for(let i=0;i<u.length;i++){o.push(u[i]);if(u[i]===255&&u[i+1]===0)i++}return Uint8Array.from(o)}
/* frame flags: v2.3 0x80 compressed / 0x40 encrypted (skipped); v2.4 0x08 / 0x04 (skipped), 0x01 length indicator, 0x02 unsynchronised */
function _lyBody(b,ver,fl,tf){
  if(ver===3&&(fl&0xC0))return null;
  if(ver===4){if(fl&0x0C)return null;if(fl&1)b=b.subarray(4);if((fl&2)||(tf&0x80))b=_unsync(b)}
  return b;
}
function _lyDec(x,enc){try{return new TextDecoder(enc===0?'iso-8859-1':enc===3?'utf-8':enc===1&&x[0]===254&&x[1]===255?'utf-16be':enc===1?'utf-16le':'utf-16be').decode(x).replace(/^\uFEFF/,'')}catch(_){return ''}}
/* string ended by the encoding's terminator -> [text, position after it] */
function _lyStr(b,p,enc){
  const w=(enc===1||enc===2)?2:1;let e=p;
  if(w===1){while(e<b.length&&b[e])e++}else{while(e+1<b.length&&(b[e]||b[e+1]))e+=2}
  return [_lyDec(b.subarray(p,Math.min(e,b.length)),enc),Math.min(e+w,b.length)];
}
/* SYLT entries can be whole lines or single words with "\n" marking line breaks: fold both into lines */
function _lyLines(E){
  if(!E.length)return [];
  let L=[];
  if(!E.some(e=>/[\r\n]/.test(e.text)))L=E.map(e=>[e.ms,e.text]);
  else{
    let c=null;
    for(const e of E)e.text.split(/\r\n|\r|\n/).forEach((part,i)=>{
      if(i>0&&c){L.push(c);c=null}
      if(part){if(!c)c=[e.ms,''];c[1]+=part}
    });
    if(c)L.push(c);
  }
  L=L.map(x=>[x[0],x[1].replace(/\s+/g,' ').trim()]);
  L.sort((a,b)=>a[0]-b[0]);
  return L;
}
function _lyFrame(id,b,r){
  if(!b||b.length<6)return;
  const enc=b[0];
  if(id==='USLT'||id==='ULT'){
    const d=_lyStr(b,4,enc),t=_lyDec(b.subarray(d[1]),enc).replace(/\0+$/,'');
    if(t.trim()&&(!r.uslt||t.length>r.uslt.length))r.uslt=t;
    return;
  }
  const tf=b[4],ct=b[5];/* timestamp format (1 = MPEG frames, 2 = ms), content type (0 other, 1 lyrics) */
  if(ct>1)return;
  let p=_lyStr(b,6,enc)[1];const E=[];
  while(p<b.length){
    const s=_lyStr(b,p,enc);p=s[1];
    if(p+4>b.length)break;
    let ms=_be32(b,p);p+=4;
    if(tf===1)ms=Math.round(ms*1152/44.1);/* MPEG frames, assuming 44.1 kHz */
    E.push({ms,text:s[0]});
  }
  const L=_lyLines(E);
  if(L.length>(r.sylt?r.sylt.length:0))r.sylt=L;
}
/*ENDLYPURE*/
/* read lyrics out of an mp3's ID3 tag (only the tag bytes are read, never the audio) */
async function lyRead(blob){
  const h=new Uint8Array(await blob.slice(0,10).arrayBuffer());
  if(h[0]!==73||h[1]!==68||h[2]!==51)return 0;
  const t=id3(await blob.slice(0,((h[6]<<21)|(h[7]<<14)|(h[8]<<7)|h[9])+10).arrayBuffer());
  return t.lyr||0;
}
/* ---- library: which songs have lyrics ---- */
async function lyDbLoad(){
  try{
    const all=(await tx('lyrics','readonly',s=>s.getAll()))||[],ids=new Set(songs.map(s=>s.id));
    for(const r of all){if(ids.has(r.id))LYM.set(r.id,r);else tx('lyrics','readwrite',s=>s.delete(r.id))}
  }catch(e){}
}
function lySet(id,r,old,manual){
  if(old&&old.m&&!manual)return old;
  const rec={id,v:LYR_V,s:r?r.s:null,l:r?r.l:null};if(manual){rec.m=1;rec.mod=Date.now()}
  LYM.set(id,rec);tx('lyrics','readwrite',st=>st.put(rec));lyBadge(id);npLyRefresh(id);if(manual)cloudDirty();
  return rec;
}
function lyEnsure(s){
  const c=LYM.get(s.id);
  if(c&&c.v===LYR_V)return Promise.resolve(c);
  if(!s.blob)return Promise.resolve(c||null);
  if(lyBusy.has(s.id))return lyBusy.get(s.id);
  const p=(async()=>{
    let r;try{r=await lyRead(s.blob)}catch(e){return c||null}
    return lySet(s.id,r,c);
  })().finally(()=>lyBusy.delete(s.id));
  lyBusy.set(s.id,p);return p;
}
const lyBadgeHtml=id=>{const r=LYM.get(id);return r&&r.s?`<i class="lyb" title="Synced lyrics">${ic('mic',13)}</i>`:''};
function lyBadge(id){document.querySelectorAll(`.row[data-id="${id}"] .d`).forEach(d=>{if(!d.querySelector('.lyb'))d.insertAdjacentHTML('afterbegin',lyBadgeHtml(id))})}
let lyScanning=false;
async function lyScanAll(manual){
  if(lyScanning)return;lyScanning=true;
  try{
    const todo=songs.filter(s=>s.blob&&!(LYM.get(s.id)&&LYM.get(s.id).v===LYR_V));
    if(manual)toast(todo.length?'Scanning '+todo.length+' songs for lyrics\u2026':'Every song has already been scanned');
    let i=0;
    for(const s of todo){
      await lyEnsure(s);i++;
      if(manual&&todo.length>40&&i%40===0)toast('Scanned '+i+' of '+todo.length+'\u2026');
      await new Promise(r=>setTimeout(r,manual?0:60));
    }
    if(manual&&todo.length){const n=[...LYM.values()].filter(r=>r.s&&songs.some(s=>s.id===r.id)).length;toast(n?'Synced lyrics found in '+n+(n===1?' song':' songs'):'No synced lyrics found')}
  }finally{lyScanning=false}
}
function lyBoot(){let tries=0;const go=()=>{if(!songs.length&&tries++<6)return setTimeout(go,3000);lyScanAll(false)};setTimeout(go,4000)}
/* ===== LRCLIB: free online synced lyrics (https://lrclib.net) =====
   Used only for songs that have no lyrics yet (or only unsynced ones), and only while you look at lyrics. It sends that song's title, artist, album and length to lrclib.net.
   Found lyrics are stored locally like scanned ones. A miss is remembered for a week so the same song is not asked again and again. Switch: Settings > Library > Lyrics. */
const LRL={on:LS('tracks-lrclib')!=='0'},LRL_RETRY=7*864e5,lrBusy=new Map();
const lrTitle=n=>String(n||'').replace(/^\s*\d{1,3}\s*[-._)]\s*(?=\D)/,'').replace(/\s*[(\[][^)\]]*\b(lyrics?|lyric video|official|audio|video|hd|hq|remaster(ed)?)\b[^)\]]*[)\]]\s*/gi,' ').replace(/\s+/g,' ').trim();
async function lrGet(u){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  try{const r=await fetch(u,{signal:c.signal});if(r.status===404)return null;if(!r.ok)throw new Error('http '+r.status);return await r.json()}
  finally{clearTimeout(t)}
}
/* -> {s,l} (same shape as lyMake) | null when LRCLIB has nothing; throws when LRCLIB cannot be reached */
async function lrFind(s){
  const title=lrTitle(s.name),artist=artOf(s),al=albumOf(s),album=al?al.name:'',dur=Math.round(s.dur||0);
  if(!title||(!artist&&!dur))return null;/* a bare title is too vague to trust a match */
  const B='https://lrclib.net/api/',q=o=>Object.entries(o).filter(e=>e[1]).map(e=>e[0]+'='+encodeURIComponent(e[1])).join('&');
  const artOk=x=>{if(!artist)return true;const a=nkey(artist),b=nkey(x.artistName);return !!b&&(a.includes(b)||b.includes(a))};
  const pick=arr=>{
    let best=null;
    for(const x of Array.isArray(arr)?arr:[arr]){
      if(!x||x.instrumental||!artOk(x))continue;
      const sy=!!(x.syncedLyrics&&x.syncedLyrics.trim()),pl=!!(x.plainLyrics&&x.plainLyrics.trim());
      if(!sy&&!pl)continue;
      const dd=dur&&x.duration?Math.abs(x.duration-dur):0;
      if(dur&&x.duration&&dd>4)continue;/* different recording or edit: its timings would not line up */
      const sc=(sy?0:100)+dd;
      if(!best||sc<best.sc)best={x,sc};
    }
    return best&&best.x;
  };
  let x=null;
  if(artist&&album&&dur)x=pick(await lrGet(B+'get?'+q({track_name:title,artist_name:artist,album_name:album,duration:dur})));
  if(!x)x=pick(await lrGet(B+'search?'+q({track_name:title,artist_name:artist})));
  if(!x)return null;
  return lyMake(null,x.syncedLyrics)||lyMake(null,x.plainLyrics)||null;
}
/* does this song's lyrics record call for an online look? 1 = no lyrics at all, 2 = only unsynced lyrics, 0 = no */
function lyNeed(rec){
  if(rec&&rec.m)return 0;/* added by hand: never overridden */
  if(rec&&rec.o&&Date.now()-rec.o<LRL_RETRY)return 0;
  if(!rec||!rec.l||!rec.l.length)return 1;
  return rec.s?0:2;
}
const lyWant=(s,rec)=>LRL.on&&navigator.onLine!==false?lyNeed(rec):0;
/* -> {rec,ok} found and stored | {rec,miss} nothing better | {rec,err} LRCLIB unreachable (nothing is remembered, so it is tried again later) */
function lyOnline(s,force){
  if(lrBusy.has(s.id))return lrBusy.get(s.id);
  const p=(async()=>{
    const old=LYM.get(s.id);let hit;
    try{hit=await lrFind(s)}catch(e){return {rec:old||null,err:1}}
    const stamp=Date.now();
    if(hit&&(!old||!old.l||!old.l.length||(hit.s&&!old.s))){
      const rec={id:s.id,v:LYR_V,s:hit.s,l:hit.l,o:stamp,src:'lrclib'};
      if(force){rec.m=1;rec.mod=stamp}/* asked for by hand: keep it like a manual add */
      LYM.set(s.id,rec);tx('lyrics','readwrite',st=>st.put(rec));lyBadge(s.id);npLyRefresh(s.id);
      if(force)cloudDirty();
      if(s.id===lyFor)lyPaint(rec);
      return {rec,ok:1};
    }
    const rec={...(old||{id:s.id,v:LYR_V,s:null,l:null}),o:stamp};
    LYM.set(s.id,rec);tx('lyrics','readwrite',st=>st.put(rec));
    return {rec,miss:1};
  })().finally(()=>lrBusy.delete(s.id));
  lrBusy.set(s.id,p);return p;
}
const lyResolve=s=>lyEnsure(s).then(r=>lyWant(s,r)===1?lyOnline(s).then(o=>(o&&o.rec)||r):r);
async function lyFind(id){
  const s=songById(id);if(!s)return;
  if(navigator.onLine===false)return toast('You are offline');
  toast('Searching LRCLIB\u2026');
  await lyEnsure(s);
  const o=await lyOnline(s,true);
  if(o.err)return toast('Could not reach LRCLIB');
  toast(o.ok?(o.rec.s?'Synced lyrics found':'Lyrics found (not time-synced)'):'LRCLIB has nothing better for this song');
}
let lrBulk=false;
async function lyFindAll(){
  if(lrBulk)return;
  if(navigator.onLine===false)return toast('You are offline');
  const todo=songs.filter(s=>lyNeed(LYM.get(s.id)));
  if(!todo.length)return toast('Every song already has synced lyrics or was checked recently');
  lrBulk=true;let n=0,i=0,fail=0;
  toast('Searching LRCLIB for '+todo.length+(todo.length===1?' song':' songs')+'\u2026');
  try{
    for(const s of todo){
      i++;
      const r=await lyEnsure(s);if(!lyNeed(r))continue;/* the file itself had lyrics */
      const o=await lyOnline(s);
      if(o.err){if(++fail>=3)return toast('Could not reach LRCLIB')}else{fail=0;if(o.ok)n++}
      if(i%25===0)toast('Checked '+i+' of '+todo.length+'\u2026');
      await new Promise(r=>setTimeout(r,350));/* be gentle with a free service */
    }
    toast(n?'Lyrics found for '+n+(n===1?' song':' songs'):'No new lyrics found');
  }finally{lrBulk=false}
}
/* ---- big player ---- */
let lyT=[],lyI=-1,lyRaf=0,lyUser=0,lyFor=null;
lyOn=LS('tracks-lyrics')==='1';
/* lyAuto: a new song was just shown while lyrics mode was on; if that song turns out to have no lyrics, lyrics mode switches itself off */
let lyAuto=false;
function lyInit(s,fresh){
  lyFor=s.id;lyT=[];lyI=-1;lyAuto=!!fresh&&lyOn;
  const rec=LYM.get(s.id),ok=!!(rec&&rec.v===LYR_V),need=ok?lyWant(s,rec):0;
  if(ok&&need!==1)lyPaint(rec);
  else{lyPaint(null,true);lyResolve(s).then(r=>{if(lyFor===s.id)lyPaint(r||0,false,true)})}
  if(ok&&need===2)lyOnline(s);/* has unsynced lyrics: quietly look for a synced version */
  lyKick();
}
function lyPaint(rec,loading,late){
  const sc=$('#lys');if(!sc)return;
  lyT=[];lyI=-1;
  const has=!!(rec&&rec.l&&rec.l.length),b=$('#fc .flyb');if(b&&!loading)b.classList.toggle('has',has);
  if(loading){sc.className='lys';sc.innerHTML='';return}
  if(!has&&lyAuto&&lyOn){lyAuto=false;lyToggle(false,!late)}/* answer known right away = instant, answer found after scanning = animated */
  lyAuto=false;
  if(!has){
    sc.className='lys none';
    sc.innerHTML='<div class="lyx"><b>No lyrics for this song</b><span>Import an MP3 with synced lyrics (SYLT), keep an .lrc file next to it, or add one now.</span><button type="button" data-act="lyedit">Create synced lyrics</button><button type="button" data-act="lyfind">Find on LRCLIB</button><button type="button" data-act="lyload">Add .lrc file</button></div>';
    return;
  }
  if(rec.s){
    sc.className='lys sync';lyT=rec.l.map(x=>x[0]);
    sc.innerHTML=rec.l.map((x,i)=>`<p class="ll${x[1]?'':' gap'}" data-act="lyseek" data-i="${i}">${x[1]?esc(x[1]):'\u266A'}</p>`).join('')+'<div class="lyed"><button type="button" class="lsopen" data-act="lyedit">Edit timing</button></div>';
  }else{
    sc.className='lys plain';
    sc.innerHTML='<div class="lynw"><p class="lyn">Not time-synced</p><button type="button" class="lyswap" data-act="lyfind">Find synced online</button><button type="button" class="lyswap" data-act="lyedit">Sync these lyrics</button><button type="button" class="lyswap" data-act="lyload">Swap in .lrc file</button></div>'+rec.l.map(t=>`<p class="ll">${t.trim()?esc(t):'&nbsp;'}</p>`).join('');
  }
  sc.scrollTop=0;lySync(true);
}
/* highlight the line that is being sung and keep it near the top third; a manual scroll pauses the follow for a few seconds */
function lySync(force){
  if(!lyOn||!lyT.length)return;
  const sc=$('#lys'),f=$('#full');if(!sc||!f||!f.classList.contains('open'))return;
  const t=(vT()+LY_LEAD)*1000;
  let lo=0,hi=lyT.length-1,i=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(lyT[m]<=t){i=m;lo=m+1}else hi=m-1}
  if(i===lyI&&!force)return;
  const prev=lyI,L=sc.children;lyI=i;
  for(let k=0;k<L.length;k++){const on=k===i;if(L[k].classList.contains('on')!==on)L[k].classList.toggle('on',on)}
  if(!force&&Date.now()-lyUser<3500)return;
  const e=i>=0?L[i]:null,top=e?e.offsetTop-sc.clientHeight*.38+e.offsetHeight/2:0;
  sc.scrollTo({top:Math.max(0,top),behavior:(RM.matches||(force&&prev<0)||Math.abs(i-prev)>6)?'auto':'smooth'});
}
function lyTick(){lyRaf=0;lySync();if(lyOn&&lyT.length&&!au.paused&&!document.hidden&&$('#full').classList.contains('open'))lyRaf=requestAnimationFrame(lyTick)}
function lyKick(){if(!lyRaf&&lyOn)lyRaf=requestAnimationFrame(lyTick)}
/* v25: lyrics mode switch. Layout changes in one step; everything that moved is then animated from where it was (FLIP) with transform/opacity only,
   so the compositor does the work and nothing re-flows while it plays. The lyrics panel fades in, or leaves as a lightweight copy when switching off. */
let lyAnims=[],lyGhost=null;
function lyToggle(want,instant){
  const h=$('#fc .fcv'),fc=$('#fc');if(!h||!cur)return;
  lyAuto=false;
  const on=typeof want==='boolean'?want:!lyOn;if(on===lyOn)return;
  const go=!instant&&!RM.matches&&$('#full').classList.contains('open');
  const mv=go?[...fc.children].filter(e=>e!==h&&e!==lyGhost&&e.matches('.fti,.fsk,.ctl,.fbot')).concat([...fc.querySelectorAll(':scope>.ftop>.ib:not([data-act=closefull]),:scope>.ftop>.tbm')]):[],
        cv=h.querySelector('.cov'),lp=h.querySelector('.lyp'),sc=$('#lys');
  let f0=null,c0=null,l0=null,g=null;
  if(go){
    /* first positions (taken mid-flight too, so a quick double tap continues smoothly) */
    f0=mv.map(e=>e.getBoundingClientRect());c0=cv&&cv.getBoundingClientRect();l0=lp&&lp.getBoundingClientRect();
    const fr=fc.getBoundingClientRect();
    lyAnims.forEach(a=>a.cancel());lyAnims=[];if(lyGhost){lyGhost.remove();lyGhost=null}
    if(!on&&lp&&l0.width&&l0.height&&sc&&sc.children.length){
      g=lp.cloneNode(true);g.removeAttribute('aria-hidden');g.setAttribute('inert','');
      const gs=g.querySelector('.lys');if(gs)gs.removeAttribute('id');
      Object.assign(g.style,{position:'absolute',left:(l0.left-fr.left)+'px',top:(l0.top-fr.top)+'px',width:l0.width+'px',height:l0.height+'px',right:'auto',bottom:'auto',margin:'0',opacity:'1',visibility:'visible',transform:'none',pointerEvents:'none',zIndex:'0'});
      fc.insertBefore(g,fc.firstChild);if(gs&&sc)gs.scrollTop=sc.scrollTop;
      lyGhost=g;
    }
  }
  lyOn=on;LS('tracks-lyrics',on?'1':'0');
  h.classList.toggle('ly',on);
  if(lp)lp.setAttribute('aria-hidden',on?'false':'true');
  const b=$('#fc .flyb');if(b){b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))}
  if(on){lyI=-1;lyUser=0;lySync(true);lyKick()}/* layout is already final, one sync is enough */
  if(go){
    const add=a=>{if(a)lyAnims.push(a);return a};
    const T=620;
    /* cover: slides and scales from its old box to its new one */
    if(cv&&c0&&c0.width){
      const c1=cv.getBoundingClientRect();
      if(c1.width)add(an(cv,[{transformOrigin:'0 0',transform:`translate(${c0.left-c1.left}px,${c0.top-c1.top}px) scale(${c0.width/c1.width})`},{transformOrigin:'0 0',transform:'none'}],{duration:T,easing:EASE_OUT}));
    }
    /* title, seek bar and buttons: slide to wherever the new layout puts them */
    mv.forEach((e,i)=>{
      const r1=e.getBoundingClientRect(),dx=f0[i].left-r1.left,dy=f0[i].top-r1.top;
      if(Math.abs(dx)>.5||Math.abs(dy)>.5)add(an(e,[{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:T,easing:EASE_OUT}));
    });
    if(on&&lp)add(an(lp,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{duration:560,delay:150,easing:EASE_OUT,fill:'backwards'}));
    if(g){const a=an(g,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(14px)'}],{duration:340,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
      const done=()=>{g.remove();if(lyGhost===g)lyGhost=null};if(a)a.onfinish=a.oncancel=done;else done()}
  }
  fxKick();
}
addEventListener('resize',()=>{if(lyOn){lyI=-1;lySync(true)}});
function lySeek(b){
  const t=lyT[Number(b.dataset.i)];if(!(t>=0))return;
  vSeek(t/1000);
  lyUser=0;lySync(true);
}
/* read a lyrics file and store it as the song's lyrics (manual = beats anything found by scanning) */
async function lyApplyFile(f,s,quiet){
  try{
    const r=lyMake(null,await f.text());if(!r){if(!quiet)toast('That file has no lyrics');return false}
    const had=LYM.get(s.id),swap=!!(had&&had.l&&had.s===false),rec=lySet(s.id,r,null,true);
    if(s.id===lyFor)lyPaint(rec);
    if(!quiet)toast(r.s?(swap?'Swapped for synced lyrics':'Synced lyrics added'):(swap?'Lyrics replaced (still not time-synced)':'Lyrics added (not time-synced)'));
    return true;
  }catch(err){if(!quiet)toast('Could not read that file');return false}
}
$('#li').onchange=async e=>{
  const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
  if(fs.length>1)return lyMassApply(fs);   /* several files picked: each one goes to the song it is named after */
  const s=songById(cur);if(!s)return;
  await lyApplyFile(fs[0],s);
};
/* ===== Lyrics sync editor =====
   A timed-lyrics maker: paste the words, play the song, tap to stamp each line as it is sung.
   Fine-tune with nudges, undo, a slower playback speed, then save. It is stored exactly like any other manual synced lyrics
   (so the player, side panel, backup and Drive sync all pick it up) and can also be exported as an .lrc file. */
const LSE={on:false,sid:null,lines:[],sel:0,mode:'sync',hist:[],dirty:false,edit:-1,rate:1,rate0:1,raf:0,drag:0,I:-1,pl:null,txt:'',oth:null};
const lsPad=n=>String(n).padStart(2,'0');
const lsMs=t=>{t=Math.max(0,Math.round(t/10)*10);return Math.floor(t/60000)+':'+lsPad(Math.floor(t%60000/1000))+'.'+lsPad(Math.floor(t%1000/10))};
const lsStamp=t=>{t=Math.max(0,Math.round(t/10)*10);return '['+lsPad(Math.floor(t/60000))+':'+lsPad(Math.floor(t%60000/1000))+'.'+lsPad(Math.floor(t%1000/10))+']'};
/* stored record -> editor lines [{t:ms|null, x:text}] */
function lsFromRec(rec){
  if(rec&&rec.l&&rec.l.length){
    if(rec.s)return rec.l.map(x=>({t:x[0],x:x[1]||''}));
    return rec.l.filter(t=>String(t).trim()).map(t=>({t:null,x:String(t).trim()}));
  }
  return [];
}
/* pasted text or a file: LRC with stamps keeps its times, plain text becomes untimed lines (blank lines are dropped) */
function lsFromText(txt){
  txt=String(txt||'');
  if(/^\s*\[\d{1,3}:\d{1,2}/m.test(txt)){const l=parseLrc(txt);if(l.length)return l.map(x=>({t:x[0],x:x[1]}))}
  return txt.replace(/^\uFEFF/,'').split(/\r\n|\r|\n/).map(x=>x.trim()).filter(Boolean).map(x=>({t:null,x}));
}
const lsToText=lines=>lines.filter(l=>l.x).map(l=>l.x).join('\n');
/* text was edited: lines that still read the same keep their time */
function lsMerge(old,neu){
  const used=new Set();let pos=0;
  return neu.map(n=>{
    if(n.t!=null)return n;
    let k=-1;for(let j=pos;j<old.length;j++){if(!used.has(j)&&old[j].t!=null&&old[j].x===n.x){k=j;break}}
    if(k>=0){used.add(k);pos=k+1;return {t:old[k].t,x:n.x}}
    return {t:null,x:n.x};
  });
}
const lsPush=()=>{LSE.hist.push(JSON.stringify(LSE.lines));if(LSE.hist.length>80)LSE.hist.shift();LSE.dirty=true};
function lsUndo(){
  if(!LSE.hist.length)return toast('Nothing to undo');
  if(LSE.mode==='text')return toast('Switch to Sync to undo');
  LSE.lines=JSON.parse(LSE.hist.pop());LSE.edit=-1;LSE.sel=Math.min(LSE.sel,Math.max(0,LSE.lines.length-1));lsUpd(true);
}
function lsRow(l,i){
  return `<div class="lsr${i===LSE.sel?' cur':''}${l.t==null?' un':''}" data-i="${i}"><button type="button" class="lstm" data-ls="seekl" data-i="${i}" aria-label="Jump to this line">${l.t==null?'--:--.--':lsMs(l.t)}</button>${LSE.edit===i?`<input class="lsi" id="lsin" value="${esc(l.x)}" maxlength="300" aria-label="Line text">`:`<span class="lstx${l.x?'':' gp'}">${l.x?esc(l.x):'\u266A instrumental'}</span>`}</div>`;
}
function lsBody(){
  const b=$('#lsb');if(!b)return;
  const st=b.scrollTop;LSE.I=-1;
  if(LSE.mode==='text'){
    b.innerHTML='<textarea id="lsta" class="lsta" spellcheck="false" aria-label="Lyrics text" placeholder="Paste or type the lyrics here, one line per row.\nBlank lines are ignored.\n\nThen switch to Sync, press play and tap along with the song."></textarea>';
    const t=$('#lsta');t.value=LSE.txt;t.oninput=()=>{LSE.txt=t.value;LSE.dirty=true};
    return;
  }
  b.innerHTML=LSE.lines.length?'<div class="lsl">'+LSE.lines.map(lsRow).join('')+'</div>':'<div class="lse0"><span>No lyrics yet. Paste the words first, then tap them in time with the song.</span><button type="button" class="pill acc" data-ls="m-text">Add lyrics</button></div>';
  b.scrollTop=st;
  if(LSE.edit>=0){const i=$('#lsin');if(i){i.focus();i.select()}}
}
function lsCount(){
  const c=$('#lsc'),n=LSE.lines.length,t=LSE.lines.filter(l=>l.t!=null).length;
  if(c)c.textContent=LSE.mode==='text'?'':(n?t+' / '+n+' timed':'');
  const u=$('#lse [data-ls="undo"]');if(u)u.disabled=!LSE.hist.length;
}
function lsUpd(reveal){lsBody();lsCount();if(reveal)lsReveal()}
function lsReveal(){
  const b=$('#lsb'),r=b&&b.querySelector('.lsr.cur');if(!r)return;
  const rb=r.getBoundingClientRect(),cb=b.getBoundingClientRect();
  if(rb.top<cb.top+30||rb.bottom>cb.bottom-30)b.scrollTo({top:b.scrollTop+(rb.top-cb.top)-cb.height*.35,behavior:RM.matches?'auto':'smooth'});
}
function lsMark(){
  const b=$('#lsb');if(!b)return;
  b.querySelectorAll('.lsr.cur').forEach(r=>r.classList.remove('cur'));
  const r=b.querySelector(`.lsr[data-i="${LSE.sel}"]`);if(r)r.classList.add('cur');
  lsReveal();
}
function lsShell(){
  const s=songById(LSE.sid);
  $('#lse').innerHTML=`<div class="lsw">
<div class="lsh"><button type="button" class="ib" data-ls="close" aria-label="Close editor">${ic('close',22)}</button><div class="lst"><b>Sync lyrics</b><span>${esc(s?s.name:'')}</span></div><button type="button" class="ib" data-ls="undo" aria-label="Undo" title="Undo (Ctrl+Z)">${ic('rst',22)}</button><button type="button" class="ib" data-ls="menu" aria-label="More tools">${ic('dots',22)}</button><button type="button" class="pill acc" data-ls="save">Save</button></div>
<div class="lsm"><div class="lsg" role="group" aria-label="Editor mode"><button type="button" data-ls="m-text" id="lsmt">Text</button><button type="button" data-ls="m-sync" id="lsms">Sync</button></div><span class="lsc" id="lsc"></span></div>
<div class="lsb" id="lsb"></div>
<div class="lsf" id="lsf">
<div class="lsk"><span id="lst1">0:00.00</span><input type="range" id="lsrg" min="0" max="1" step="0.01" value="0" aria-label="Seek"><span id="lst2">0:00</span></div>
<div class="lsp"><button type="button" class="ib" data-ls="back5" aria-label="Back 5 seconds"><b>-5</b></button><button type="button" class="ib lspp" data-ls="pp" id="lspp" aria-label="Play or pause">${ic('play',28)}</button><button type="button" class="ib" data-ls="fwd5" aria-label="Forward 5 seconds"><b>+5</b></button><button type="button" class="pill" data-ls="rate" id="lsrate" aria-label="Playback speed">1\u00d7</button><button type="button" class="lstap" data-ls="tap" id="lstap">TAP<small>stamp this line</small></button></div>
<div class="lstl" role="toolbar" aria-label="Line tools"><button type="button" class="pill" data-ls="prev">Prev line</button><button type="button" class="pill" data-ls="nm">\u22120.1s</button><button type="button" class="pill" data-ls="np">+0.1s</button><button type="button" class="pill" data-ls="now">Set to now</button><button type="button" class="pill" data-ls="edit">Edit text</button><button type="button" class="pill" data-ls="gap">+ \u266A gap</button><button type="button" class="pill" data-ls="clr">Clear time</button><button type="button" class="pill" data-ls="del">Delete</button></div>
<p class="lshint">Space/Enter stamp \u00b7 P play/pause \u00b7 \u2190 \u2192 seek 3s \u00b7 \u2191 \u2193 line \u00b7 [ ] nudge 0.1s \u00b7 Del clear time \u00b7 E edit \u00b7 Ctrl+Z undo \u00b7 Ctrl+S save</p>
</div></div>`;
}
function lsRender(){
  const t=LSE.mode==='text';
  $('#lsmt').classList.toggle('on',t);$('#lsms').classList.toggle('on',!t);
  $('#lsmt').setAttribute('aria-pressed',t);$('#lsms').setAttribute('aria-pressed',!t);
  $('#lsf').classList.toggle('tx',t);
  lsUpd(!t);
}
function lsOpen(id){
  const s=songById(id);if(!s||LSE.on)return;
  LSE.on=true;LSE.sid=id;LSE.hist=[];LSE.dirty=false;LSE.edit=-1;LSE.I=-1;LSE.pl=null;LSE.oth=null;LSE.rate=1;LSE.rate0=au.playbackRate||1;
  LSE.lines=lsFromRec(LYM.get(id));
  LSE.sel=Math.max(0,LSE.lines.findIndex(l=>l.t==null));
  LSE.mode=LSE.lines.length?'sync':'text';LSE.txt=lsToText(LSE.lines);
  if(cur!==id)playSong(id,null,true);
  lsShell();lsRender();
  $('#lse').classList.add('open');
  addEventListener('keydown',lsKey,true);
  LSE.raf=requestAnimationFrame(lsTick);
}
async function lsClose(force){
  if(!LSE.on)return;
  if(!force&&LSE.dirty){
    const v=await choose('Unsaved changes',[{label:'Save and close',value:'s',ic:'check'},{label:'Discard changes',value:'d',ic:'trash',danger:true},{label:'Keep editing',value:'k',ic:'pencil'}]);
    if(!v||v==='k')return;
    if(v==='s'&&!(await lsSave()))return;
  }
  LSE.on=false;cancelAnimationFrame(LSE.raf);removeEventListener('keydown',lsKey,true);
  try{au.playbackRate=LSE.rate0}catch(_){}
  const e=$('#lse');e.classList.remove('open');e.innerHTML='';
}
function lsApplyText(){
  if(LSE.txt===lsToText(LSE.lines))return;
  const neu=lsFromText(LSE.txt);
  lsPush();LSE.lines=lsMerge(LSE.lines,neu);
  LSE.sel=Math.max(0,LSE.lines.findIndex(l=>l.t==null));
}
function lsMode(m){
  if(m===LSE.mode)return;
  if(LSE.mode==='text')lsApplyText();else LSE.txt=lsToText(LSE.lines);
  LSE.edit=-1;LSE.mode=m;
  if(m==='sync')LSE.sel=Math.min(LSE.sel,Math.max(0,LSE.lines.length-1));
  lsRender();
}
async function lsSave(){
  if(LSE.mode==='text')lsApplyText();
  const timed=LSE.lines.filter(l=>l.t!=null);
  if(timed.length<2){toast('Stamp at least 2 lines first');return false}
  const skip=LSE.lines.length-timed.length;
  if(skip){
    const v=await choose(skip+(skip===1?' line has':' lines have')+' no time yet',[{label:'Save without '+(skip===1?'it':'them'),value:'y',ic:'check'},{label:'Keep editing',value:'n',ic:'pencil'}]);
    if(v!=='y')return false;
  }
  const l=timed.map(x=>[x.t,x.x]).sort((a,b)=>a[0]-b[0]);
  const rec=lySet(LSE.sid,{s:true,l},null,true);
  if(LSE.sid===lyFor)lyPaint(rec);
  LSE.dirty=false;lsCount();toast('Synced lyrics saved');return true;
}
function lsTap(){
  if(!LSE.lines.length||LSE.mode!=='sync')return;
  if(cur!==LSE.sid)return toast('Another song is playing');
  const i=LSE.sel;if(i<0||i>=LSE.lines.length)return;
  lsPush();LSE.lines[i].t=Math.round(vT()*100)*10;
  if(i<LSE.lines.length-1)LSE.sel=i+1;
  lsUpd(true);
}
function lsNudge(d){
  const l=LSE.lines[LSE.sel];if(!l)return;
  if(l.t==null)return toast('Stamp this line first');
  lsPush();l.t=Math.max(0,l.t+d);lsUpd();
}
function lsPP(){
  if(cur!==LSE.sid){playSong(LSE.sid,null,true);return}
  if(au.paused)au.play().catch(()=>{});else au.pause();
  renderMini();
}
function lsPrev(){
  if(LSE.sel<=0)return;
  LSE.sel--;
  let t=null;for(let j=LSE.sel;j>=0&&t==null;j--)t=LSE.lines[j].t;
  if(t!=null)vSeek(Math.max(0,t/1000-2));
  lsMark();
}
function lsCommit(v){
  const i=LSE.edit;if(i<0)return;
  LSE.edit=-1;v=String(v).trim();
  if(LSE.lines[i]&&v!==LSE.lines[i].x){lsPush();LSE.lines[i].x=v}
  lsUpd();
}
function lsLrc(){
  const s=songById(LSE.sid)||{},h=[],a=artOf(s);
  if(s.name)h.push('[ti:'+s.name+']');if(a)h.push('[ar:'+a+']');
  return h.concat(LSE.lines.filter(l=>l.t!=null).slice().sort((p,q)=>p.t-q.t).map(l=>lsStamp(l.t)+l.x)).join('\n')+'\n';
}
function lsLoadFile(){
  const i=document.createElement('input');i.type='file';i.accept='.lrc,.txt,text/plain';
  i.onchange=async()=>{
    const f=i.files[0];if(!f)return;
    try{
      const l=lsFromText(await f.text());if(!l.length)return toast('That file has no lyrics');
      if(LSE.mode==='text')LSE.mode='sync';
      lsPush();LSE.lines=l;LSE.edit=-1;LSE.sel=Math.max(0,l.findIndex(x=>x.t==null));
      lsRender();toast('Loaded '+l.length+(l.length===1?' line':' lines'));
    }catch(_){toast('Could not read that file')}
  };
  i.click();
}
async function lsMenu(){
  if(LSE.mode==='text')lsApplyText();
  const v=await choose('Lyrics tools',[
    {label:'Load .lrc or .txt file',value:'file',ic:'filep'},
    {label:'Shift all times\u2026',value:'shift',ic:'clock'},
    {label:'Export .lrc file',value:'exp',ic:'plist',gap:1},
    {label:'Copy as .lrc text',value:'copy',ic:'plist'},
    {label:'Clear all times',value:'clrall',ic:'minus',danger:true,gap:1}]);
  if(!v)return;
  if(v==='file')return lsLoadFile();
  if(v==='shift'){
    if(!LSE.lines.some(l=>l.t!=null))return toast('No times to shift yet');
    const r=await ask('Shift all times by (seconds)','0.5','Shift');if(!r)return;
    const d=Math.round(parseFloat(String(r).replace(',','.'))*1000);
    if(!isFinite(d)||!d)return toast('Enter a number like 0.5 or -1.2');
    lsPush();LSE.lines.forEach(l=>{if(l.t!=null)l.t=Math.max(0,l.t+d)});lsUpd();
    return toast('Shifted by '+(d>0?'+':'')+(d/1000).toFixed(2)+'s');
  }
  if(v==='exp'||v==='copy'){
    if(!LSE.lines.some(l=>l.t!=null))return toast('Stamp some lines first');
    const txt=lsLrc();
    if(v==='copy'){try{await navigator.clipboard.writeText(txt);toast('Copied')}catch(_){toast('Could not copy')}return}
    const s=songById(LSE.sid)||{};
    return dlBlob(new Blob([txt],{type:'text/plain'}),(s.name||'lyrics').replace(/[\\/:*?"<>|]+/g,'_')+'.lrc');
  }
  if(v==='clrall'){lsPush();LSE.lines.forEach(l=>{l.t=null});LSE.sel=0;lsUpd(true)}
}
function lsClick(e){
  if(!LSE.on)return;
  const b=e.target.closest('[data-ls]');
  if(!b){const r=e.target.closest('.lsr');if(r&&LSE.edit<0){LSE.sel=+r.dataset.i;lsMark()}return}
  if(b.tagName==='BUTTON')b.blur();
  const a=b.dataset.ls,L=LSE.lines;
  if(a==='close')return lsClose();
  if(a==='save')return lsSave();
  if(a==='undo')return lsUndo();
  if(a==='menu')return lsMenu();
  if(a==='m-text')return lsMode('text');
  if(a==='m-sync')return lsMode('sync');
  if(a==='pp')return lsPP();
  if(a==='back5')return vSeek(vT()-5);
  if(a==='fwd5')return vSeek(vT()+5);
  if(a==='rate'){const R=[1,.75,.5];LSE.rate=R[(R.indexOf(LSE.rate)+1)%R.length];au.playbackRate=LSE.rate;return}
  if(LSE.mode!=='sync')return;
  if(a==='seekl'){const i=+b.dataset.i;LSE.sel=i;if(L[i]&&L[i].t!=null)vSeek(L[i].t/1000);return lsMark()}
  if(a==='tap')return lsTap();
  if(a==='prev')return lsPrev();
  if(a==='nm')return lsNudge(-100);
  if(a==='np')return lsNudge(100);
  if(!L.length)return;
  const l=L[LSE.sel];
  if(a==='now'){if(cur!==LSE.sid)return toast('Another song is playing');lsPush();l.t=Math.round(vT()*100)*10;return lsUpd(true)}
  if(a==='edit'){LSE.edit=LSE.sel;return lsBody()}
  if(a==='gap'){lsPush();L.splice(LSE.sel+1,0,{t:null,x:''});LSE.sel++;return lsUpd(true)}
  if(a==='clr'){if(l.t==null)return;lsPush();l.t=null;return lsUpd()}
  if(a==='del'){lsPush();L.splice(LSE.sel,1);LSE.sel=Math.min(LSE.sel,Math.max(0,L.length-1));return lsUpd(true)}
}
function lsKey(e){
  if(!LSE.on||$('#ov').classList.contains('open'))return;
  const t=e.target,tag=t&&t.tagName,typing=tag==='TEXTAREA'||(tag==='INPUT'&&t.type!=='range');
  const stop=()=>{e.preventDefault();e.stopPropagation()};
  if(e.key==='Escape'){stop();if(LSE.edit>=0){LSE.edit=-1;lsUpd()}else if(typing)t.blur();else lsClose();return}
  if(e.ctrlKey||e.metaKey){
    if(e.key==='s'||e.key==='S'){stop();lsSave()}
    else if((e.key==='z'||e.key==='Z')&&!typing){stop();lsUndo()}
    return;
  }
  if(typing||e.altKey||LSE.mode!=='sync')return;
  const k=e.key,L=LSE.lines,mv=d=>{if(!L.length)return;LSE.sel=Math.max(0,Math.min(L.length-1,LSE.sel+d));lsMark()};
  if(k===' '||k==='Enter'){stop();lsTap()}
  else if(k==='p'||k==='P'||k==='k'||k==='K'){stop();lsPP()}
  else if(k==='ArrowLeft'){stop();vSeek(vT()-3)}
  else if(k==='ArrowRight'){stop();vSeek(vT()+3)}
  else if(k==='ArrowUp'){stop();mv(-1)}
  else if(k==='ArrowDown'){stop();mv(1)}
  else if(k==='['){stop();lsNudge(-100)}
  else if(k===']'){stop();lsNudge(100)}
  else if(k==='Backspace'||k==='Delete'){stop();const l=L[LSE.sel];if(l&&l.t!=null){lsPush();l.t=null;lsUpd()}}
  else if(k==='e'||k==='E'){stop();if(L.length){LSE.edit=LSE.sel;lsBody()}}
}
function lsTick(){
  LSE.raf=0;if(!LSE.on)return;
  const t=vT(),D=vD(),g=$('#lsrg');
  if(g&&!LSE.drag){g.max=D||1;g.value=t;g.style.setProperty('--p',D?Math.min(100,t/D*100):0)}
  const a=$('#lst1'),b=$('#lst2'),sa=lsMs(t*1000),sb=D?fmt(D):'0:00';
  if(a&&a.textContent!==sa)a.textContent=sa;
  if(b&&b.textContent!==sb)b.textContent=sb;
  const pl=cur===LSE.sid&&!au.paused;
  if(pl!==LSE.pl){LSE.pl=pl;const pp=$('#lspp');if(pp)pp.innerHTML=ic(pl?'pause':'play',28)}
  const oth=cur!==LSE.sid;
  if(oth!==LSE.oth){LSE.oth=oth;const tp=$('#lstap');if(tp)tp.classList.toggle('off',oth);if(oth)toast('Another song is playing. Press play to return to this one')}
  if(!oth&&Math.abs(au.playbackRate-LSE.rate)>.001)au.playbackRate=LSE.rate;
  const rt=$('#lsrate'),rs=LSE.rate+'\u00d7';if(rt&&rt.textContent!==rs)rt.textContent=rs;
  if(LSE.mode==='sync'&&!oth){
    const ms=t*1000;let k=-1,best=-1;
    for(let i=0;i<LSE.lines.length;i++){const x=LSE.lines[i].t;if(x!=null&&x<=ms&&x>=best){best=x;k=i}}
    if(k!==LSE.I){
      const R=$('#lsb').querySelectorAll('.lsr');
      if(LSE.I>=0&&R[LSE.I])R[LSE.I].classList.remove('now');
      if(k>=0&&R[k])R[k].classList.add('now');
      LSE.I=k;
    }
  }
  LSE.raf=requestAnimationFrame(lsTick);
}
{const e=$('#lse');
  e.addEventListener('click',lsClick);
  e.addEventListener('input',ev=>{if(ev.target.id==='lsrg'){LSE.drag=Date.now();vSeek(+ev.target.value);clearTimeout(LSE.dt);LSE.dt=setTimeout(()=>{LSE.drag=0},250)}});
  e.addEventListener('keydown',ev=>{if(ev.target.id==='lsin'&&ev.key==='Enter'){ev.preventDefault();lsCommit(ev.target.value)}});
  e.addEventListener('focusout',ev=>{if(ev.target.id==='lsin'&&LSE.edit>=0)lsCommit(ev.target.value)});
}

/* ===== mass lyrics: any number of .lrc / .txt files, each applied to the song it is named after =====
   Matching ignores case, accents, punctuation, track numbers ("01 - "), "(feat. ...)", "(Lyrics)" and the extension.
   A file can be named "Title", "Artist - Title" or "Title - Artist". When nothing matches exactly, a unique close name (one contains the other) is accepted and flagged for you to check. */
const LY_EXT=/\.(lrc|txt)$/i,lyStem=n=>String(n).replace(/\.(lrc|txt)$/i,'');
const lyFk=n=>tkey(String(n).replace(/^\s*\d{1,3}\s*[-._)]\s*(?=\D)/,'').replace(/\b(lyrics?|lrc|synced|karaoke)\b/gi,' '));
function lyCands(s){
  const ks=new Set(),k=lyFk(s.name),a=artOf(s);
  if(k)ks.add(k);
  if(k&&a){ks.add(lyFk(a+' '+s.name));ks.add(lyFk(s.name+' '+a))}
  return ks;
}
function lyMatch(files){
  const idx=new Map(),all=[];
  for(const s of songs){const ks=lyCands(s);all.push({s,k:lyFk(s.name)});for(const k of ks){if(!idx.has(k))idx.set(k,[]);idx.get(k).push(s)}}
  const taken=new Set(),res={ok:[],none:[],dup:[]};
  const fl=files.slice().sort((a,b)=>(/\.lrc$/i.test(b.name)?1:0)-(/\.lrc$/i.test(a.name)?1:0));   /* .lrc (synced) wins over .txt */
  for(const f of fl){
    const fk=lyFk(lyStem(f.name));let s=null,fz=false;
    if(fk){
      const ex=idx.get(fk);
      if(ex){s=ex.find(x=>!taken.has(x.id))||ex[0];if(ex.length>1)fz=true}   /* several songs share this name: pick one and ask you to check */
      else if(fk.length>=6){
        let best=null,tie=false;
        for(const o of all){
          const k=o.k;if(k.length<6)continue;
          if(k.includes(fk)||fk.includes(k)){
            const d=Math.abs(k.length-fk.length);
            if(!best||d<best.d){best={s:o.s,d};tie=false}else if(d===best.d&&o.s!==best.s)tie=true;
          }
        }
        if(best&&!tie){s=best.s;fz=true}
      }
    }
    if(!s)res.none.push(f);else if(taken.has(s.id))res.dup.push({f,s});else{taken.add(s.id);res.ok.push({f,s,fz})}
  }
  return res;
}
async function lyMassPick(){
  const v=await choose('Add lyric files',[{label:'Pick .lrc or .txt files',value:'f',ic:'filep'},{label:'Pick a folder',value:'d',ic:'impfld'}]);if(!v)return;
  if(v==='f')return $('#lmi').click();
  const i=document.createElement('input');i.type='file';i.multiple=true;i.webkitdirectory=true;
  i.onchange=()=>{const fs=[...i.files];if(fs.length)lyMassApply(fs)};i.click();
}
async function lyMassApply(files){
  files=[...files].filter(f=>LY_EXT.test(f.name)&&!/^\._/.test(f.name));
  if(!files.length)return toast('No lyric files found (.lrc or .txt)');
  if(!songs.length)return toast('Add songs first');
  if(files.length>2)toast('Reading '+files.length+' files\u2026');
  const r=lyMatch(files),rows=[],mk=async f=>{try{const t=await f.text();return {t,m:lyMake(null,t)}}catch(e){return {t:'',m:0}}};
  for(const m of r.ok){const x=await mk(m.f);rows.push({f:m.f,s:m.s,fz:m.fz,m:x.m})}
  const used=new Set(rows.map(z=>z.s.id));
  /* files the name did not match: try the [ti:] and [ar:] tags written inside the .lrc */
  for(const f of r.none.concat(r.dup.map(o=>o.f))){
    const x=await mk(f),z={f,s:null,m:x.m,fz:false},ti=/\[ti:([^\]]+)\]/i.exec(x.t),ar=/\[ar:([^\]]+)\]/i.exec(x.t);
    if(ti){const k=lyFk(ti[1]),c=songs.filter(s=>!used.has(s.id)&&lyCands(s).has(k)),a=ar?nkey(ar[1]):'',p=c.find(s=>!a||nkey(artOf(s)).includes(a)||a.includes(nkey(artOf(s))))||c[0];if(p){z.s=p;z.fz=true;z.hdr=true;used.add(p.id)}}
    rows.push(z);
  }
  const had=id=>{const h=LYM.get(id);return h&&h.l&&h.l.length?(h.s?'synced':'plain'):''};
  rows.forEach(z=>{z.had=z.s?had(z.s.id):'';z.on=!!(z.s&&z.m&&!(z.had==='synced'&&!z.m.s))});   /* never swap synced lyrics for plain text unless ticked by hand */
  const lab=s=>s.name+(artOf(s)?' \u2014 '+artOf(s):'');
  const rowH=(z,i)=>`<div class="rbr ${z.s?'':'no'}" data-i="${i}"><input type="checkbox" ${z.on?'checked':''} ${z.s&&z.m?'':'disabled'} aria-label="Add these lyrics"><div class="rbt"><b>${z.s?esc(z.s.name):(z.m?'No matching song':'No lyrics inside')}</b><span>${z.s?esc(artOf(z.s)||'No artist'):''}</span><small>${esc(z.f.name)}${z.m?' \u00b7 '+(z.m.s?'synced':'plain text'):''}${z.s&&z.had?' \u00b7 replaces '+z.had+' lyrics':''}${z.hdr?' \u00b7 matched by file tags':(z.fz?' \u00b7 check this match':'')}</small></div>${z.m?`<button type="button" class="pill" data-c="${i}">${z.s?'Change':'Pick'}</button>`:''}</div>`;
  const pick=async i=>{
    const z=rows[i],q=await ask('Search songs',z.s?z.s.name:'');if(!q)return show();
    const k=nkey(q),hits=songs.filter(s=>nkey(s.name).includes(k)||nkey(artOf(s)).includes(k)).slice(0,12);
    if(!hits.length){toast('No songs found');return show()}
    const id=await choose('Pick a song',hits.map(s=>({label:lab(s),value:s.id,noic:true})));
    if(id){rows.forEach(y=>{if(y!==z&&y.s&&y.s.id===id){y.s=null;y.on=false;y.had=''}});z.s=songById(id);z.fz=false;z.hdr=false;z.had=had(id);z.on=true}
    show();
  };
  const show=()=>{
    openOv(`<h3>Add lyrics</h3><p class="dupn" id="lm-n"></p><div class="rbl" id="lm-l">${rows.map(rowH).join('')}</div><div class="bt"><button type="button" class="pill" id="lm-c">Cancel</button><button type="button" class="pill acc" id="lm-g"></button></div>`);
    const upd=()=>{const n=rows.filter(z=>z.on&&z.s&&z.m).length,m=rows.filter(z=>z.s&&z.m).length,g=$('#lm-g');
      $('#lm-n').textContent=m+' of '+rows.length+(rows.length===1?' file matches':' files match')+' a song. Untick any you do not want, or tap Change to pick another song.';
      g.textContent=n?'Add to '+n+(n===1?' song':' songs'):'Add lyrics';g.disabled=!n};
    $('#lm-l').onchange=e=>{const rw=e.target.closest('.rbr');if(rw){rows[+rw.dataset.i].on=e.target.checked;upd()}};
    $('#lm-l').onclick=e=>{const b=e.target.closest('[data-c]');if(b)pick(+b.dataset.c)};
    $('#lm-c').onclick=()=>closeOv();$('#ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
    $('#lm-g').onclick=()=>{const sel=rows.filter(z=>z.on&&z.s&&z.m);closeOv();for(const z of sel){const rec=lySet(z.s.id,z.m,null,true);if(z.s.id===lyFor)lyPaint(rec)}toast('Lyrics added to '+sel.length+(sel.length===1?' song':' songs'))};
    upd();
  };
  show();
}
['wheel','touchstart','touchmove','pointerdown'].forEach(ev=>$('#fc').addEventListener(ev,e=>{if(e.target.closest&&e.target.closest('#lys'))lyUser=Date.now()},{passive:true}));
['play'].forEach(ev=>au.addEventListener(ev,lyKick));
['pause','timeupdate'].forEach(ev=>au.addEventListener(ev,()=>lySync()));
au.addEventListener('seeked',()=>lySync(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lySync(true);lyKick()}});


/* ===== END 07-lyrics.js ===== */
