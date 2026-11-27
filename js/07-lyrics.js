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

