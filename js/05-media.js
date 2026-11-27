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

