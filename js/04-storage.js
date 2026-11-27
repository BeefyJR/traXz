/* storage */
function openDB(){return new Promise((res,rej)=>{try{const r=indexedDB.open('tracks-app',4);
  r.onupgradeneeded=()=>{const d=r.result;['songs','albums','folders','playlists','pfolders','lyrics'].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'})})};
  r.onblocked=()=>{try{toast('Close other traXz tabs to finish updating')}catch(_){}};
  r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>{try{d.close()}catch(_){}if(db===d)db=null;try{toast('traXz was updated in another tab. Reload this page.',true)}catch(_){}};d.onclose=()=>{if(db===d)db=null};res(d)};r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
/* a failed write (storage full, evicted, aborted at commit) used to leave callers waiting forever with no message */
let _dbT=0;
function dbFail(e,mode){console.warn('IndexedDB '+mode+' failed',e);if(mode==='readwrite'&&Date.now()-_dbT>8000){_dbT=Date.now();try{toast('Could not save to this device. Storage may be full.')}catch(_){}}}
function tx(st,mode,fn){return new Promise(res=>{if(!db)return res([]);try{const t=db.transaction(st,mode),q=fn(t.objectStore(st));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>res([]);t.onabort=()=>{dbFail(t.error,mode);res([])}}catch(e){dbFail(e,mode);res([])}})}
const put=(st,v)=>{if(v&&typeof v==='object')v.mod=Date.now();cloudDirty();return tx(st,'readwrite',s=>s.put(v))};
const del=(st,id)=>{const t=tomb();t[st+':'+id]=Date.now();LS('tracks-tomb',JSON.stringify(t));cloudDirty();return tx(st,'readwrite',s=>s.delete(id))};

/* google drive sync */
const GCID=''; /* optional: paste your OAuth client ID here instead of in the app */
const GKEY='AIzaSyCeTST7GKZuNgFZjJb3KVpBOqRS8DU5E-Y'; /* needed for share links: a Google API key limited to the Drive API (see Share song > setup). It is public by design, so restrict it to your site addresses */
ICON.cloud='M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z';
const CL={tok:null,exp:0,fid:null,idx:{},busy:false,again:false,tc:null,st:'',t:null};
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
var NP={q:0,on:LS('tracks-np')==='1',ly:LS('tracks-npl')!=='0',w:Math.min(900,Math.max(280,+LS('tracks-npw')||360)),sig:null,id:null,T:[],I:-1,user:0,raf:0};
const cid=()=>GCID||LS('tracks-cid')||'';
const tomb=()=>{try{return JSON.parse(LS('tracks-tomb')||'{}')}catch(e){return{}}};
const DV='https://www.googleapis.com/drive/v3/files',DU='https://www.googleapis.com/upload/drive/v3/files';
function cloudDirty(){LS('tracks-dirty','1');if(LS('tracks-cloud')){clearTimeout(CL.t);CL.t=setTimeout(()=>cloudSync(false),4000)}}
function cloudSt(m){CL.st=m;const b=$('#cb');if(b)b.style.color=LS('tracks-cloud')?(/^(Sync failed|Tap)/.test(m)?'#e5484d':'rgb(var(--ac))'):'';const e=$('#cst');if(e)e.textContent=m}
const gis=()=>window.google&&google.accounts?Promise.resolve():new Promise((r,j)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=r;s.onerror=()=>j(new Error('Could not load Google sign-in'));document.head.appendChild(s)});
const redir=()=>location.origin+location.pathname.replace(/index\.html$/,'');
function parseTok(){
  const m=/access_token=([^&]+)/.exec(location.hash),e=/expires_in=(\d+)/.exec(location.hash),st=/[#&]state=([^&]+)/.exec(location.hash);
  let want=null;if(m){try{want=sessionStorage.getItem('tracks-gstate');sessionStorage.removeItem('tracks-gstate')}catch(_){}}
  const ok=!!(m&&want&&st&&st[1]===want);/* a token in the address only counts if it answers a sign-in this tab started */
  if(m&&!ok)history.replaceState(null,'',location.pathname+location.search);
  if(ok){CL.tok=m[1];CL.exp=Date.now()+(+(e&&e[1])||3600)*1000;LS('tracks-tok',JSON.stringify({t:CL.tok,e:CL.exp}));LS('tracks-cloud','1');history.replaceState(null,'',location.pathname+location.search)}
  else{try{const j=JSON.parse(LS('tracks-tok')||'null');if(j&&j.e>Date.now()+60000){CL.tok=j.t;CL.exp=j.e}}catch(x){}}
}
async function token(inter){
  if(CL.tok&&Date.now()<CL.exp-60000)return CL.tok;
  if(!cid())throw new Error('Session expired. Paste a new token or add your client ID');
  if(!inter)throw new Error('reconnect');
  const gst=b64u(crypto.getRandomValues(new Uint8Array(18)));try{sessionStorage.setItem('tracks-gstate',gst)}catch(_){throw new Error('Cannot sign in: browser storage is blocked')}
  location.href='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:cid(),redirect_uri:redir(),response_type:'token',scope:'https://www.googleapis.com/auth/drive.file',state:gst});
  return new Promise(()=>{});
}
async function gapi(url,o={}){const t=await token(false);const r=await fetch(url,{...o,headers:{...(o.headers||{}),Authorization:'Bearer '+t}});if(r.status===401){CL.tok=null;LS('tracks-tok',null);throw new Error('Token expired. Paste a new one')}if(!r.ok)throw new Error('Drive '+r.status);return r}
async function dUp(name,blob,type,id){
  type=type||'application/octet-stream';
  const r=await gapi(DU+(id?'/'+id:'')+'?uploadType=resumable&fields=id',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':type},body:JSON.stringify(id?{}:{name,parents:[CL.fid]})});
  const p=await fetch(r.headers.get('Location'),{method:'PUT',headers:{'Content-Type':type},body:blob});
  if(!p.ok)throw new Error('Upload '+p.status);return (await p.json()).id;
}
async function dIdx(){
  CL.fid=CL.fid||LS('tracks-fid');
  if(CL.fid){try{const j=await (await gapi(DV+'/'+CL.fid+'?fields=trashed')).json();if(j.trashed)CL.fid=null}catch(e){CL.fid=null}}
  if(!CL.fid){
    const q=encodeURIComponent("name='Tracks' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const j=await (await gapi(DV+'?q='+q+'&fields=files(id)')).json();
    CL.fid=j.files[0]?j.files[0].id:(await (await gapi(DV,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Tracks',mimeType:'application/vnd.google-apps.folder'})})).json()).id;
    LS('tracks-fid',CL.fid);
  }
  CL.idx={};let pt='';
  do{const q=encodeURIComponent("'"+CL.fid+"' in parents and trashed=false");
    const j=await (await gapi(DV+'?q='+q+'&fields=nextPageToken,files(id,name)&pageSize=1000'+(pt?'&pageToken='+pt:''))).json();
    j.files.forEach(f=>CL.idx[f.name]=f.id);pt=j.nextPageToken||''}while(pt);
}
const strip=s=>{const {blob,orig,...m}=s;return m};
async function cloudSync(inter){
  if(CL.busy){CL.again=true;return}
  CL.busy=true;
  try{
    cloudSt('Syncing…');await token(inter);await dIdx();
    let rem={};
    if(CL.idx['library.json'])rem=await (await gapi(DV+'/'+CL.idx['library.json']+'?alt=media')).json();
    const tb=tomb();for(const k in rem.tomb||{})tb[k]=Math.max(tb[k]||0,rem.tomb[k]);
    LS('tracks-tomb',JSON.stringify(tb));
    const L={songs,albums,folders,playlists,pfolders},nx={};let ch=false;
    for(const st of ['songs','albums','folders','playlists','pfolders']){
      const lm=new Map(L[st].map(o=>[o.id,o])),m=new Map(lm);
      for(const r of (rem[st]||[])){const l=m.get(r.id);if(!l||(r.mod||0)>(l.mod||0))m.set(r.id,l&&l.blob&&(r.fv||0)<=(l.fv||0)?{...r,blob:l.blob,orig:l.orig}:r)}
      const out=[];
      for(const [id,o] of m){
        const t=tb[st+':'+id];
        if(t&&t>=(o.mod||0)){if(lm.has(id)){await tx(st,'readwrite',s=>s.delete(id));ch=true}continue}
        if(lm.get(id)!==o){await tx(st,'readwrite',s=>s.put(o));ch=true}
        out.push(o);
      }
      nx[st]=out;
    }
    songs=nx.songs.sort((a,b)=>a.added-b.added);albums=nx.albums;folders=nx.folders;playlists=nx.playlists;pfolders=nx.pfolders;
    /* manual lyrics: newest edit wins, same as the other stores */
    {const rl=new Map((rem.lyrics||[]).map(r=>[r.id,r])),sid=new Set(songs.map(x=>x.id));
     for(const r of rl.values()){const l=LYM.get(r.id);
       if(sid.has(r.id)&&(!l||!l.m||(r.mod||0)>(l.mod||0))){LYM.set(r.id,r);await tx('lyrics','readwrite',x=>x.put(r));lyBadge(r.id);if(r.id===lyFor)lyPaint(r);ch=true}}
     for(const l of LYM.values()){if(!l.m)continue;const r=rl.get(l.id);if(!r||(l.mod||0)>(r.mod||0))ch=true}}
    {
      let ru=[];try{ru=JSON.parse(LS('tracks-reup')||'[]')}catch(e){}
      for(const s of songs){
        if(!s.blob)continue;const n='a_'+s.id;
        if(!CL.idx[n]){cloudSt('Uploading '+s.name);CL.idx[n]=await dUp(n,s.blob,s.blob.type);ch=true;ru=ru.filter(x=>x!==s.id)}
        else if(ru.includes(s.id)){cloudSt('Uploading '+s.name);await dUp(n,s.blob,s.blob.type,CL.idx[n]);ch=true;ru=ru.filter(x=>x!==s.id);LS('tracks-reup',JSON.stringify(ru))}   /* replaced file: overwrite the copy in Drive */
      }
      LS('tracks-reup',JSON.stringify(ru));
    }
    for(const k in tb)if(k.startsWith('songs:')){const n='a_'+k.slice(6);if(CL.idx[n]){await gapi(DV+'/'+CL.idx[n],{method:'DELETE'});delete CL.idx[n]}}
    if(LS('tracks-dirty')||ch||!CL.idx['library.json']){
      LS('tracks-dirty',null);
      const lib=JSON.stringify({v:1,songs:songs.map(strip),albums,folders,playlists,pfolders,lyrics:[...LYM.values()].filter(x=>x.m),tomb:tb});
      CL.idx['library.json']=await dUp('library.json',new Blob([lib],{type:'application/json'}),'application/json',CL.idx['library.json']);
    }
    LS('tracks-cloud','1');render();
    cloudSt('Synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  }catch(e){cloudSt(inter||CL.tok?'Sync failed: '+e.message:'Tap to reconnect')}
  CL.busy=false;if(CL.again){CL.again=false;setTimeout(()=>cloudSync(false),500)}
}
async function cloudFetch(s,inter=true){
  await token(inter);
  if(!CL.idx['a_'+s.id])await dIdx();
  if(!CL.idx['a_'+s.id])throw new Error('Song not found in Drive');
  s.blob=await (await gapi(DV+'/'+CL.idx['a_'+s.id]+'?alt=media')).blob();
  await tx('songs','readwrite',x=>x.put(s));
}
async function cloudDownloadAll(){
  if(CL.dl)return;CL.dl=true;const set=m=>{const e=$('#cdl');if(e)e.textContent=m};
  try{
    await token(false);await dIdx();
    const todo=songs.filter(s=>!s.blob);let n=0,bad=0;
    for(const s of todo){set('Downloading '+(++n)+' of '+todo.length+'…');try{await cloudFetch(s,false)}catch(e){if(e.message==='reconnect')throw e;bad++}}
    set(bad?'Done, '+bad+' song(s) could not be downloaded':'All songs are saved for offline play');
  }catch(e){set(e.message==='reconnect'?'Session expired. Press Sync now, then try again':'Download stopped: '+e.message)}
  CL.dl=false;
}
function cloudSheet(){
  const on=LS('tracks-cloud'),miss=songs.filter(s=>!s.blob).length;
  openOv(`<h3>Google Drive</h3><p id="cst" style="margin:0 0 12px;color:var(--mute);font-size:14px">${esc(CL.st||(on?'Connected':'Not connected'))}</p>${on?`<p id="cdl" style="margin:0 0 12px;color:var(--mute);font-size:14px">${songs.length-miss} of ${songs.length} songs saved on this device</p>`:''}${GCID?'':`<input type="text" id="cidi" placeholder="Google OAuth client ID" value="${esc(cid())}" style="margin-bottom:12px">`}<div style="margin:0 0 12px"><p style="margin:0 0 8px;color:var(--mute);font-size:13px">Inside a wrapper app Google blocks sign-in. Sign in at your site in a browser, tap Copy token, and paste it here.</p><input type="text" id="ctk" placeholder="Paste access token" style="margin-bottom:8px"><button class="pill" id="cuse">Use token</button></div><div class="bt">${CL.tok&&Date.now()<CL.exp-60000?'<button class="pill" id="cct">Copy token</button>':''}${on?'<button class="pill" id="cx">Disconnect</button>':''}${on&&miss?`<button class="pill" id="cdb">Download all (${miss})</button>`:''}<button class="pill acc" id="cg">${on?'Sync now':'Connect'}</button></div>`);
  $('#cg').onclick=()=>{const i=$('#cidi');if(i)LS('tracks-cid',i.value.trim());cloudSync(true)};
  const d=$('#cdb');if(d)d.onclick=cloudDownloadAll;
  const cc=$('#cct');if(cc)cc.onclick=()=>navigator.clipboard.writeText(CL.tok).then(()=>cloudSt('Token copied, valid for about 1 hour'),()=>cloudSt('Could not copy'));
  $('#cuse').onclick=()=>{const v=$('#ctk').value.trim().replace(/^Bearer\s+/i,'');if(v.length<20)return cloudSt('Paste the token first');CL.tok=v;CL.exp=Date.now()+55*60000;LS('tracks-tok',JSON.stringify({t:v,e:CL.exp}));cloudSync(false)};
  const x=$('#cx');if(x)x.onclick=()=>{LS('tracks-cloud',null);CL.tok=null;closeOv();cloudSt('Not connected')};
}

/* app updates: a new version waits until the person taps Install in Settings > Backup */
var SWU={reg:null,w:null,asked:false,t:0,check:null};
function swuBadge(){const g=document.getElementById('gear');if(g)g.classList.toggle('swu',!!SWU.w)}
function swuReady(w){SWU.w=w;swuBadge();try{toast('Update available. Open Settings > Backup to install it.')}catch(_){}}
/* No manual stamping: the page hashes its own latest files (fetched past the cache) and registers the worker as sw.js?v=<hash>.
   A new hash = a new worker URL = the browser installs it, and it waits until the person taps Install. */
async function swuHash(){
  const bufs=[];
  for(const u of ['index.html','style.css','splash.js','manifest.webmanifest','js/01-core.js','js/02-state.js','js/03-effects.js','js/04-storage.js','js/05-media.js','js/06-ui.js','js/07-lyrics.js','js/08-playback.js','js/09-import.js','js/10-actions.js','js/11-gestures.js','js/12-placement.js','js/13-controls.js','js/14-transitions.js','js/15-trim.js','js/16-library.js','js/17-covermaker.js','js/18-init.js']){
    const r=await fetch(u+'?nosw=1',{cache:'no-cache'});/* revalidates: a 304 costs almost nothing */
    if(!r.ok)throw new Error(u+' '+r.status);
    bufs.push(new Uint8Array(await r.arrayBuffer()));
  }
  const all=new Uint8Array(bufs.reduce((a,b)=>a+b.length,0));let o=0;
  for(const b of bufs){all.set(b,o);o+=b.length}
  const d=new Uint8Array(await crypto.subtle.digest('SHA-1',all));
  return Array.from(d.slice(0,4),x=>x.toString(16).padStart(2,'0')).join('');
}
async function swuRegister(){
  let v='';
  try{v=await swuHash();try{localStorage.setItem('tracks-swv',v)}catch(_){}}
  catch(_){try{v=localStorage.getItem('tracks-swv')||''}catch(__){}}/* offline: keep whatever version we last knew */
  if(!v){if(SWU.reg)return;v='0'}
  const r=await navigator.serviceWorker.register('sw.js?v='+v,{updateViaCache:'none'});
  if(!SWU.reg){
    SWU.reg=r;
    r.addEventListener('updatefound',()=>{const n=r.installing;if(n)n.addEventListener('statechange',()=>{if(n.state==='installed'&&navigator.serviceWorker.controller)swuReady(n)})});
  }
  if(r.waiting&&navigator.serviceWorker.controller)swuReady(r.waiting);
}
SWU.check=swuRegister;
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(SWU.asked){SWU.asked=false;location.reload()}});
  addEventListener('load',()=>setTimeout(()=>swuRegister().catch(e=>console.warn('Service worker registration failed',e)),1500));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&SWU.reg&&Date.now()-SWU.t>1800000){SWU.t=Date.now();swuRegister().catch(()=>{})}});
}
