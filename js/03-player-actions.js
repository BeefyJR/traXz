

/* ===== BEGIN 08-playback.js ===== */
/* remember the last song, position and queue across launches */
let lastSave=0,restoring=false;
function saveLast(force,t0){if(!cur||restoring)return;const n=Date.now();if(!force&&n-lastSave<(PERF.on?10000:4000))return;/* pause, hiding the page and leaving always save at once */lastSave=n;LS('tracks-last',JSON.stringify({id:cur,t:t0!=null?t0:(au.currentTime||0),q:queue,u:upNext,sh:shuffle,o:shOrig,rp:repeat}))}
function restoreLast(){
  let j=null;try{j=JSON.parse(LS('tracks-last')||'null')}catch(e){}
  const s=j&&songById(j.id);if(!s||!s.blob)return;
  const ok=a=>Array.isArray(a)?a.filter(i=>songs.some(x=>x.id===i)):[];
  queue=ok(j.q);if(!queue.includes(s.id))queue=[s.id];upNext=ok(j.u);ctxCur=s.id;shuffle=!!j.sh;shOrig=ok(j.o);repeat=+j.rp||0;
  cur=s.id;restoring=true;curUrl=URL.createObjectURL(s.blob);au.src=curUrl;trRefresh();
  const t=+j.t||0;au.addEventListener('loadedmetadata',()=>{if(t>0&&t<au.duration)au.currentTime=t;restoring=false},{once:true});
  if(nm.on){nmGet(s,false).catch(()=>{});nmWarm()}   /* measured before you press play */
}
/* playback */
/* shuffle state: shPlayed = songs already heard this round, shHist = play order (for Previous) */
let shPlayed=new Set(),shHist=[],shBack=false;
/* Spotify-style shuffle: one shuffled order is built up front (the queue itself), so Next, Previous and the queue list all agree.
   Songs by the same artist are spread out instead of landing back to back. Turning shuffle off restores the original order (shOrig). */
function smartShuffle(ids){
  const by=new Map(songs.map(x=>[x.id,x])),g=new Map();
  for(const id of ids){const x=by.get(id),k=x&&nkey(artOf(x))||'#'+id;if(!g.has(k))g.set(k,[]);g.get(k).push(id)}
  const out=[];
  for(const a of g.values()){shuf(a);const n=a.length,off=Math.random()/n;a.forEach((id,i)=>out.push({id,p:i/n+off+(Math.random()-.5)*.6/n}))}
  return out.sort((a,b)=>a.p-b.p).map(o=>o.id);
}
function applyShuffle(){
  const piv=queue.includes(ctxCur)?ctxCur:null;
  if(shuffle){shOrig=queue.slice();queue=piv?[piv].concat(smartShuffle(queue.filter(x=>x!==piv))):smartShuffle(queue)}
  else{if(shOrig.length){const have=new Set(queue);queue=shOrig.filter(x=>have.has(x));if(piv&&!queue.includes(piv))queue.unshift(piv)}shOrig=[]}
}
/* ===== Trim: a start and an end point per song. The file itself is never touched.
   The seek bar, the time, the lyrics and the lock screen all use the trimmed timeline (0 = the trimmed start). ===== */
function effDur(s){
  if(!s)return 0;const D=s.dur||0;if(!s.trim)return D;
  const a=Math.max(0,+s.trim.a||0),b=s.trim.b!=null?Math.min(+s.trim.b,D||1e9):D;
  return b-a>=1?b-a:D;
}
function trRefresh(){
  TR=null;const s=songById(cur);if(!s||!s.trim)return;
  const D=(au.readyState>0&&isFinite(au.duration)&&au.duration>0)?au.duration:(s.dur||0);
  const a=Math.max(0,+s.trim.a||0);let b=s.trim.b!=null?+s.trim.b:D;if(D&&b>D)b=D;
  if(b-a>=1&&(a>=.05||(D&&b<D-.05)))TR={a,b};
}
function vA(){return TR?TR.a:0}
function vD(){const D=au.duration;if(!isFinite(D)||D<=0)return 0;return TR?Math.max(0,Math.min(TR.b,D)-TR.a):D}
function vT(){const t=au.currentTime||0;return TR?Math.max(0,Math.min(t-TR.a,vD())):t}
function vSeek(t){t=Math.max(0,+t||0);const d=vD();if(d)t=Math.min(t,d);try{au.currentTime=vA()+t}catch(_){}}
function playSong(id,list,keep){
  const s=songById(id);if(!s)return;
  if(!s.blob){toast('Downloading from Drive…');cloudFetch(s).then(()=>playSong(id,list,keep)).catch(e=>toast(e.message));return}
  if(list){shOrig=shuffle?list.slice():[];queue=shuffle?[id].concat(smartShuffle(list.filter(x=>x!==id))):list.slice();ctxCur=id;shPlayed=new Set();shHist=[]}else if(!keep){if(!queue.includes(id))queue=[id];ctxCur=id}
  if(!shBack){shHist.push(id);if(shHist.length>500)shHist.shift()}
  shPlayed.add(id);
  cur=id;restoring=false;saveLast(true,0);
  if(curUrl)URL.revokeObjectURL(curUrl);
  curUrl=URL.createObjectURL(s.blob);au.src=curUrl;
  trRefresh();if(TR&&TR.a>0)try{au.currentTime=TR.a}catch(_){}
  nm.hold=null;nmEnsure(false,true);xfStart();au.play().catch(()=>{});   /* level is set (or the song is held silent) before play starts */
  setSession(s);render();
}
function step(d,auto){trDir=d>0?1:-1;try{return step0(d,auto)}finally{trDir=0}}
/* offline: a song that is not saved on this device cannot play, so Next / Previous / auto-advance pass over it */
function offSkip(id){const x=songById(id);return navigator.onLine===false&&!!x&&!x.blob}
function offNone(){au.pause();render();toast('You are offline and none of the next songs are downloaded')}
function step0(d,auto){
  if(!queue.length)return;
  let i=queue.indexOf(ctxCur),skipped=0;
  const told=()=>{if(skipped)toast('Skipped '+skipped+(skipped===1?' song':' songs')+' not downloaded for offline play')};
  if(auto&&repeat===2&&!offSkip(cur))return playSong(cur,null,true);
  if(d>0&&upNext.length){
    while(upNext.length&&offSkip(upNext[0])){upNext.shift();skipped++}
    if(upNext.length){told();return playSong(upNext.shift(),null,true)}
  }
  if(shuffle&&queue.length>1){
    if(d<0){
      for(let j=i-1;j>=0;j--){if(offSkip(queue[j])){skipped++;continue}told();return playSong(queue[j])}
      vSeek(0);return   /* nothing playable before this song: restart it */
    }
    for(let j=i+1;j<queue.length;j++){if(offSkip(queue[j])){skipped++;continue}told();return playSong(queue[j])}
    if(auto&&repeat!==1){au.pause();return render()}
    /* end of the round: reshuffle everything, and never open with the song that just played */
    const nq=smartShuffle(queue.slice());if(nq.length>1&&nq[0]===queue[queue.length-1])nq.push(nq.shift());
    const k=nq.findIndex(x=>!offSkip(x));
    if(k<0)return offNone();
    shOrig=queue.slice();queue=nq;skipped+=k;told();return playSong(queue[k]);
  }
  /* in order: walk in the chosen direction, wrapping round at most once, until a playable song turns up */
  for(let tries=0;tries<queue.length;tries++){
    i+=d;
    if(i>=queue.length){if(repeat===1||!auto)i=0;else return render()}
    if(i<0)i=queue.length-1;
    if(offSkip(queue[i])){skipped++;continue}
    told();return playSong(queue[i]);
  }
  offNone();
}
/* system media notification (Android lock screen / notification shade) */
function fallbackArt(s){
  try{
    const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
    const col=accent(s),g=x.createLinearGradient(0,0,512,512);
    g.addColorStop(0,'rgb('+col.join(',')+')');g.addColorStop(1,'rgb('+col.map(v=>Math.round(v*.55)).join(',')+')');
    x.fillStyle=g;x.fillRect(0,0,512,512);
    x.fillStyle='#fff';x.font='700 240px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';
    x.fillText((s.name||'?').trim().charAt(0).toUpperCase(),256,276);
    return c.toDataURL('image/png');
  }catch(e){return null}
}
/* Android wrapper bridge: window.AndroidMedia is injected by the native app (see MainActivity.kt) */
let nbKey=null;
function nativeMeta(s){
  const NB=window.AndroidMedia;if(!NB||!s)return;
  try{
    const a=albumOf(s),c=s.cover||(a&&a.cover),k=s.id+'|'+s.name+'|'+(s.artist||'')+featTxt(s)+'|'+(c?c.length:0)+'|'+(s.color||'');
    if(k===nbKey)return;nbKey=k;
    NB.setMeta(s.name,mArtist(s),a?a.name:'',c||fallbackArt(s)||'');
  }catch(e){}
}
function nativeState(){
  const NB=window.AndroidMedia;if(!NB)return;
  try{
    if(!cur)nbKey=null;
    NB.setState(!!cur,!au.paused,Math.round(vT()*1000),vD()?Math.round(vD()*1000):0);
  }catch(e){}
}
/* called by the native notification buttons */
window.nativeMedia=(a,v)=>{
  if(a==='play')au.play().catch(()=>{});
  else if(a==='pause'||a==='stop')au.pause();
  else if(a==='next')step(1);
  else if(a==='prev'){if(vT()>3)vSeek(0);else step(-1)}
  else if(a==='seek'&&isFinite(v)){vSeek(v/1000);nativeState()}
};
function setSession(s){
  nativeMeta(s);
  if(!('mediaSession' in navigator)||!s)return;
  try{
    const a=albumOf(s),c=s.cover||(a&&a.cover),src=c||fallbackArt(s);
    navigator.mediaSession.metadata=new MediaMetadata({
      title:s.name,
      artist:mArtist(s),
      album:a?a.name:'',
      artwork:src?[{src,sizes:c?'400x400':'512x512',type:c?'image/jpeg':'image/png'}]:[]
    });
    syncSessionState();
  }catch(e){}
}
function syncSessionState(){
  nativeState();
  if(!('mediaSession' in navigator))return;
  try{navigator.mediaSession.playbackState=cur?(au.paused?'paused':'playing'):'none'}catch(e){}
  if(!cur||!isFinite(au.duration)||au.duration<=0)return;
  try{navigator.mediaSession.setPositionState({duration:vD()||au.duration,playbackRate:au.playbackRate||1,position:Math.min(vT(),vD()||au.duration)})}catch(e){}
}
['play','pause','seeked','durationchange','loadedmetadata','ended'].forEach(ev=>au.addEventListener(ev,nativeState));
(function(){
  if(!('mediaSession' in navigator))return;
  const ms=navigator.mediaSession,on=(n,f)=>{try{ms.setActionHandler(n,f)}catch(e){}};
  on('play',()=>{au.play().catch(()=>{})});
  on('pause',()=>au.pause());
  on('stop',()=>{au.pause();vSeek(0)});
  on('previoustrack',()=>{if(vT()>3)vSeek(0);else step(-1)});
  on('nexttrack',()=>step(1));
  on('seekbackward',d=>{vSeek(vT()-((d&&d.seekOffset)||10))});
  on('seekforward',d=>{vSeek(vT()+((d&&d.seekOffset)||10))});
  on('seekto',d=>{if(d&&d.seekTime!=null&&isFinite(d.seekTime)){vSeek(d.seekTime);syncSessionState()}});
  ['play','pause','seeked','durationchange','ratechange','loadedmetadata','ended'].forEach(ev=>au.addEventListener(ev,syncSessionState));
})();
au.addEventListener('play',()=>{if(fxAC&&fxAC.state==='suspended')fxAC.resume().catch(()=>{});fxKick()});au.addEventListener('play',renderMini);au.addEventListener('pause',renderMini);au.addEventListener('pause',()=>saveLast(true));
addEventListener('pagehide',()=>saveLast(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)saveLast(true)});
au.addEventListener('ended',()=>step(1,true));
au.addEventListener('loadedmetadata',()=>{trRefresh();if(TR&&au.currentTime<TR.a-.05)try{au.currentTime=TR.a}catch(_){}const d=$('#dt2');if(d)d.textContent=fmt(vD());const m=$('#mdt');if(m)m.textContent=fmt(vD())});
au.addEventListener('timeupdate',()=>{
  saveLast();
  const vd=vD(),vt=vT(),p=vd?vt/vd:0;
  const msk=$('#msk');if(msk&&!seeking&&vd){msk.value=Math.round(p*1000);msk.style.setProperty('--p',(p*100)+'%');$('#mct').textContent=fmt(vt)}
  const sk=$('#sk');if(sk&&!seeking&&vd){sk.value=Math.round(p*1000);sk.style.setProperty('--p',(p*100)+'%');$('#ct').textContent=fmt(vt)}
});
window.addEventListener('pointerup',()=>{seeking=false});

/* ===== v30: Spotify style side player (PC only). Right panel: cover, title and synced lyrics. Bottom bar: controls. Turn it on in Settings > Layout ===== */
ICON.npx='M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';
function npOn(){return NP.on&&document.documentElement.dataset.layout==='pc'}
/* widest the side panel may be: the header keeps enough room (create/sync/search on the left, select/filter/settings on the right) so its buttons never run into each other */
function npMax(){
  const d=document.documentElement,p=$('#np'),t=$('#top'),cap=Math.max(280,Math.min(900,Math.round(innerWidth*.55)));
  if(!npOn()||!p||!t||!p.offsetWidth)return cap;
  const hx=Math.min(72,Math.max(28,innerWidth*.04)),docked=/^(left|right|bottom)$/.test(d.dataset.dock||'');
  const need=innerWidth<900?(docked?560:440):(docked?820+2*(hx+100):640);/* 820px centred content + the buttons on both sides */
  const avail=t.getBoundingClientRect().width+p.getBoundingClientRect().width+20;/* header + panel (with its gaps) stays constant while the panel is resized */
  return Math.max(280,Math.min(cap,Math.floor(avail-need)));
}
function npApply(){
  const r=document.documentElement,on=npOn(),was=r.dataset.np==='on';
  r.dataset.np=on?'on':'off';
  r.style.setProperty('--npw',NP.w+'px');
  if(on&&NP.w>280){const m=npMax();if(NP.w>m)r.style.setProperty('--npw',m+'px')}/* saved width is kept; only the shown width is limited */
  const p=$('#np');if(p)p.classList.toggle('nol',!NP.ly);
  const lb=$('#npb [data-npa=ly]');if(lb)lb.classList.toggle('on',NP.ly);
  if(on&&!was&&p){NP.sig=null;renderMini()}
}
function npRender(s){
  if(!npOn()||!$('#np'))return;
  const ac=accent(s).join(',');
  $('#np').style.setProperty('--ac',ac);$('#npb').style.setProperty('--ac',ac);
  const sig=fullKey(s);
  if(NP.sig!==sig){
    const fresh=NP.id!==s.id;NP.sig=sig;NP.id=s.id;
    $('#npc').innerHTML=cover(songCover(s),s.name,true);
    $('#nbc').innerHTML=cover(songCover(s),s.name,true);
    $('#npt').textContent=s.name;$('#nps').innerHTML=subHtml(s)||'No album';
    $('#nbt').textContent=s.name;$('#nbs').innerHTML=subHtml(s)||'No album';
    const k=$('#nbsk');k.value=0;k.style.setProperty('--p','0%');$('#nbct').textContent='0:00';$('#nbdt').textContent=fmt(effDur(s));
    if(fresh){an($('#npc'),[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE_OUT});an($('#nbc'),[{opacity:0,transform:'scale(.84)'},{opacity:1,transform:'none'}],{duration:300,easing:EASE_OUT})}
    npLy(s);
  }
  const k2=au.paused?'play':'pause',b=$('#nbp');
  if(b.dataset.k!==k2){b.dataset.k=k2;b.innerHTML=ic(k2,24);pop(b.firstChild)}
  npKick();
}
function npLy(s){
  const rec=LYM.get(s.id),ok=!!(rec&&rec.v===LYR_V),need=ok?lyWant(s,rec):0;
  if(ok&&need!==1)npLyPaint(rec);
  else{npLyPaint(null,true);lyResolve(s).then(r=>{if(NP.id===s.id)npLyPaint(r||0)})}
  if(ok&&need===2)lyOnline(s);
}
/* no lyrics for this song: the queue takes the lyrics' place in the panel */
function npQPaint(){
  const sc=$('#npl');if(!sc||!sc.classList.contains('npq'))return;
  const keep=sc.scrollTop,s=songById(cur);
  const ci=queue.indexOf(ctxCur),ctx=ci<0?[]:queue.slice(ci+1).map((id,j)=>({id,i:ci+1+j}));
  let h=NP.q?'<div class="npqh"><span>Queue</span><span style="display:flex;gap:6px"><button type="button" class="pill" data-act="qundo" aria-label="Undo last queue change" title="Undo" disabled>'+ic('undo',16)+'Undo</button><button type="button" class="pill" data-act="qclear">Clear all</button></span></div>':'<div class="npqh"><span>No lyrics for this song</span><span style="display:flex;gap:6px"><button type="button" class="pill" data-npa="lyfind">Find on LRCLIB</button><button type="button" class="pill" data-npa="lyload">Add .lrc file</button></span></div>';
  h+='<div class="qs">Now playing</div>'+(s?qrow(s,'now',0):'<div class="empty">Nothing is playing.</div>');
  if(upNext.length)h+=`<div class="qs">Next in queue<span class="qcl"><i>${upNext.length}</i><button type="button" class="pill" data-act="qclearnext" aria-label="Clear the songs I added">Clear</button></span></div>`+upNext.map((id,i)=>{const x=songById(id);return x?qrow(x,'up',i):''}).join('');
  if(ctx.length)h+=`<div class="qs">Next up<span>${ctx.length}</span></div>`+ctx.map(o=>{const x=songById(o.id);return x?qrow(x,'ctx',o.i):''}).join('');
  if(!upNext.length&&!ctx.length)h+='<div class="empty">The queue is empty.<br>Use Play next or Add to queue on any song.</div>';
  sc.innerHTML=h;sc.scrollTop=keep;qUndoPaint();
}
function npQToggle(){NP.q=NP.q?0:1;npQApply()}
function npQApply(){
  const p=$('#np');if(!p)return;
  p.classList.toggle('nq',!!NP.q);
  document.querySelectorAll('#npb [data-act=qopen]').forEach(b=>b.classList.toggle('on',!!NP.q));
  const sc=$('#npl'),s=songById(cur);
  if(NP.q){if(sc){sc.className='npl npq';NP.T=[];NP.I=-1;npQPaint()}}
  else if(s)npLy(s);else if(sc){sc.className='npl';sc.innerHTML=''}
}
function npQRefresh(){if(npOn())npQPaint()}
function npLyRefresh(id){if(NP.id===id&&$('#npl'))npLyPaint(LYM.get(id)||0)}
function npLyPaint(rec,loading){
  const sc=$('#npl');if(!sc)return;
  NP.T=[];NP.I=-1;
  if(NP.q){sc.className='npl npq';npQPaint();return}
  if(loading){sc.className='npl';sc.innerHTML='';return}
  const has=!!(rec&&rec.l&&rec.l.length);
  if(!has){sc.className='npl npq';npQPaint();return}
  if(rec.s){
    sc.className='npl sync';NP.T=rec.l.map(x=>x[0]);
    sc.innerHTML=rec.l.map((x,i)=>`<p class="${x[1]?'':'gap'}" data-npa="seek" data-i="${i}">${x[1]?esc(x[1]):'\u266A'}</p>`).join('');
  }else{
    sc.className='npl plain';
    sc.innerHTML=rec.l.map(t=>`<p>${t.trim()?esc(t):'&nbsp;'}</p>`).join('');
  }
  sc.scrollTop=0;npSync(true);
}
/* highlight the line that is being sung and keep it near the top third; a manual scroll pauses the follow for a few seconds */
function npSync(force){
  if(!npOn()||!NP.T.length)return;
  const sc=$('#npl');if(!sc||!sc.offsetParent)return;
  const t=(vT()+LY_LEAD)*1000;
  let lo=0,hi=NP.T.length-1,i=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(NP.T[m]<=t){i=m;lo=m+1}else hi=m-1}
  if(i===NP.I&&!force)return;
  const prev=NP.I,L=sc.children;NP.I=i;
  for(let k=0;k<L.length;k++){const on=k===i;if(L[k].classList.contains('on')!==on)L[k].classList.toggle('on',on)}
  if(!force&&Date.now()-NP.user<3500)return;
  const e=i>=0?L[i]:null,top=e?e.offsetTop-sc.clientHeight*.38+e.offsetHeight/2:0;
  sc.scrollTo({top:Math.max(0,top),behavior:(RM.matches||(force&&prev<0)||Math.abs(i-prev)>6)?'auto':'smooth'});
}
function npTick(){NP.raf=0;npSync();if(npOn()&&NP.T.length&&!au.paused&&!document.hidden)NP.raf=requestAnimationFrame(npTick)}
function npKick(){if(!NP.raf&&npOn()&&NP.T.length)NP.raf=requestAnimationFrame(npTick)}
function npTime(){
  if(!npOn())return;
  const vd=vD(),vt=vT(),p=vd?vt/vd:0,k=$('#nbsk');
  if(k&&!seeking&&vd){k.value=Math.round(p*1000);k.style.setProperty('--p',(p*100)+'%');$('#nbct').textContent=fmt(vt)}
  const d=$('#nbdt');if(d&&vd)d.textContent=fmt(vd);
}
/* drag the top-left corner (or the left edge) of the panel to make it wider or narrower */
(function(){
  let sx=0,sw=0,on=false,id=null;
  const max=npMax;
  const set=w=>{NP.w=Math.round(Math.min(max(),Math.max(280,w)));document.documentElement.style.setProperty('--npw',NP.w+'px')};
  document.addEventListener('pointerdown',e=>{
    const g=e.target.closest&&e.target.closest('#npg,#npge');if(!g||!npOn()||e.button>0)return;
    on=true;id=e.pointerId;sx=e.clientX;sw=$('#np').getBoundingClientRect().width+20;/* --npe is the panel plus its 10px gaps */
    try{g.setPointerCapture(id)}catch(_){}
    document.documentElement.classList.add('npdrag');e.preventDefault();
  });
  document.addEventListener('pointermove',e=>{if(!on||e.pointerId!==id)return;set(sw+(sx-e.clientX))});
  const end=e=>{if(!on||(e&&e.pointerId!==id))return;on=false;document.documentElement.classList.remove('npdrag');LS('tracks-npw',String(NP.w));NP.I=-1;npSync(true);const w=$('#npwr');if(w){const mx=npMax();w.max=mx;w.value=NP.w;w.style.setProperty('--p',(mx>280?Math.min(100,(NP.w-280)/(mx-280)*100):100)+'%');const b=w.parentNode.querySelector('b');if(b)b.textContent=NP.w+'px'}};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
  document.addEventListener('dblclick',e=>{if(e.target.closest&&e.target.closest('#npg,#npge')){set(360);LS('tracks-npw','360');NP.I=-1;npSync(true)}});
  addEventListener('resize',()=>{if(npOn())npApply()});
})();
function npClick(e){
  const b=e.target.closest('[data-npa]');if(!b||e.target.closest('[data-act]'))return;
  const a=b.dataset.npa;
  if(a==='full')openFull();
  else if(a==='ly'){const wq=NP.q;if(wq){NP.q=0;NP.ly=true}else NP.ly=!NP.ly;LS('tracks-npl',NP.ly?'1':'0');npApply();if(wq)npQApply()}
  else if(a==='lyload')$('#li').click();
  else if(a==='lyfind'){if(cur)lyFind(cur)}
  else if(a==='seek'){const t=NP.T[Number(b.dataset.i)];if(t>=0){vSeek(t/1000);NP.user=0;npSync(true)}}
}
au.addEventListener('timeupdate',()=>{npTime();npSync()});
au.addEventListener('loadedmetadata',npTime);
['play','seeked','pause'].forEach(ev=>au.addEventListener(ev,()=>{npKick();npSync()}));
document.addEventListener('visibilitychange',npKick);
addEventListener('resize',()=>{if(npOn()){NP.I=-1;npSync(true)}});


/* ===== END 08-playback.js ===== */


/* ===== BEGIN 09-import.js ===== */
/* importing */
const getDur=b=>new Promise(r=>{const a=new Audio(),u=URL.createObjectURL(b);a.preload='metadata';a.onloadedmetadata=()=>{r(a.duration);URL.revokeObjectURL(u)};a.onerror=()=>{r(0);URL.revokeObjectURL(u)};a.src=u});
/* duplicate detection: same title (ignoring case, accents, punctuation) or an identical file */
const nkey=t=>String(t||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[øłđðßæœþı]/g,c=>({'ø':'o','ł':'l','đ':'d','ð':'d','ß':'ss','æ':'ae','œ':'oe','þ':'th','ı':'i'})[c]).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const tkey=t=>nkey(String(t||'').replace(/[(\[][^)\]]*\b(feat|ft|featuring|remaster(ed)?|official|video|audio|lyrics?|hd|hq|explicit|clean|bonus|deluxe)\b[^)\]]*[)\]]/gi,' ').replace(/\b(feat|ft|featuring)\b\.?.*$/i,' '))||nkey(t);
const fmtSize=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
function findDup(s){
  const k=tkey(s.name),sa=nkey(artOf(s));let best=null;
  for(const e of songs){
    if(e.id===s.id)continue;
    if(e.blob&&s.blob&&e.blob.size>0&&e.blob.size===s.blob.size&&Math.abs((e.dur||0)-(s.dur||0))<1)return {song:e,why:'file'};
    const ek=tkey(e.name),ea=nkey(artOf(e));
    if(!best&&k&&((k===ek&&(!ea||!sa||ea===sa))||(ea&&k===ea+' '+ek)))best={song:e,why:'title'};
  }
  return best;
}
const freeName=n=>{let i=2,t;do{t=n+' ('+i+')';i++}while(songs.some(x=>nkey(x.name)===nkey(t)));return t};
/* Replace: the new file takes over the old song's name, artist, album, cover and playlist spots */
async function replaceSong(old,nw){
  const n={...old,id:nw.id,blob:nw.blob,dur:nw.dur};delete n.mod;
  songs=songs.filter(x=>x.id!==old.id);songs.push(n);
  await put('songs',n);await del('songs',old.id);
  for(const p of playlists)if((p.songs||[]).includes(old.id)){p.songs=p.songs.map(i=>i===old.id?n.id:i);await put('playlists',p)}
  const swap=a=>a.map(i=>i===old.id?n.id:i);queue=swap(queue);upNext=swap(upNext);if(ctxCur===old.id)ctxCur=n.id;
  if(cur===old.id){au.pause();au.removeAttribute('src');cur=null;closeFull()}
}
/* Replace audio file: the song keeps its id, so name, artist, album, cover, colour, playlists, queue spots, lyrics and play counts all stay. Only the sound changes. */
let rfTarget=null;
function replaceAudio(s){if(!s)return;rfTarget=s.id;const i=$('#rfi');i.value='';i.click()}
function rfConfirm(s,f,dur){return new Promise(res=>{
  const was=s.blob?fmt(s.dur)+' \u00b7 '+fmtSize(s.blob.size)+' \u00b7 '+qInfo(s.blob,s.dur):'Not on this device',dd=dur-(s.dur||0);
  const warn=s.dur&&Math.abs(dd)>=2?` The new file is ${fmt(Math.abs(dd))} ${dd>0?'longer':'shorter'}${LYM.get(s.id)&&LYM.get(s.id).s?', so synced lyrics may no longer line up':''}.`:'';
  openOv(`<h3>Replace audio file</h3><p class="dupn">${esc(s.name)} keeps its name, artist, album, cover, playlists and lyrics. Only the sound changes.${esc(warn)}</p>
  <div class="dtag">Current file</div><p class="dupn" style="margin:0 0 10px">${esc(was)}</p>
  <div class="dtag">New file</div><p class="dupn" style="margin:0 0 4px">${esc(f.name)}<br>${esc(fmt(dur)+' \u00b7 '+fmtSize(f.size)+' \u00b7 '+qInfo(f,dur))}</p>
  <div class="bt"><button class="pill" id="rfn">Cancel</button>${Math.abs(dd)>=1?'<button class="pill" id="rft">Replace and trim\u2026</button>':''}<button class="pill acc" id="rfy">Replace</button></div>`);
  const fin=v=>{closeOv();res(v)};
  $('#rfn').onclick=()=>fin(false);$('#rfy').onclick=()=>fin(true);{const rt=$('#rft');if(rt)rt.onclick=()=>fin('trim')}$('#ov').onclick=e=>{if(e.target.id==='ov')fin(false)};
})}
async function rfApply(s,f,dur,o){
  o=o||{};const prevLen=effDur(s);
  const wasCur=cur===s.id,t=wasCur?au.currentTime:0,wasPlaying=wasCur&&!au.paused;
  s.blob=f;s.dur=dur;s.fv=(s.fv||0)+1;
  /* remember how long the old version was, so Trim can bring the new file back in line (and lyrics keep matching) */
  {const ref=s.refDur>0?+s.refDur:prevLen;if(o.bake)delete s.refDur;else if(ref>0&&Math.abs(dur-ref)>=.5)s.refDur=+ref.toFixed(2);else delete s.refDur;delete s.trim;delete s.loop;
   if(o.trim&&s.refDur&&dur>s.refDur&&dur-s.refDur<=30)s.trim={a:0,b:+s.refDur.toFixed(2)}}   /* fv = file version: other devices drop their old copy and the next sync uploads the new one */
  delete nmCache[s.id];nmSave();
  await put('songs',s);
  try{const a=JSON.parse(LS('tracks-reup')||'[]');if(!a.includes(s.id))a.push(s.id);LS('tracks-reup',JSON.stringify(a))}catch(e){}
  /* lyrics read from the old file's tag are read again; lyrics you added yourself stay */
  if(!o.bake){const c=LYM.get(s.id);if(c&&!c.m){LYM.delete(s.id);tx('lyrics','readwrite',x=>x.delete(s.id));lyEnsure(s).then(r=>{if(lyFor===s.id)lyPaint(r||0,false,true)}).catch(()=>{})}}
  if(wasCur){
    au.pause();restoring=true;if(curUrl)URL.revokeObjectURL(curUrl);curUrl=URL.createObjectURL(f);au.src=curUrl;trRefresh();
    nm.key=null;nm.hold=null;nm.busy=0;nm.tk++;
    au.addEventListener('loadedmetadata',()=>{
      try{if(t>0&&t<au.duration)au.currentTime=t}catch(_){}
      restoring=false;
      if(wasPlaying){nmEnsure(false,true);au.play().catch(()=>{})}else nmEnsure();
    },{once:true});
    setSession(s);
  }
  if(!o.quiet){toast('Audio file replaced');render()}
}
$('#rfi').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';const s=songById(rfTarget);rfTarget=null;
  if(!f||!s)return;
  if(!(f.type.startsWith('audio/')||/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i.test(f.name)))return toast('Pick an audio file');
  let dur=await getDur(f);if(!isFinite(dur)||dur<=0)return toast('Could not read that audio file');
  {const r=await rfConfirm(s,f,dur);if(r){await rfApply(s,f,dur);if(r==='trim')trimSheet(s)}}
};
function dupDialog(dup,ns,file,left){return new Promise(res=>{
  const e=dup.song,pv=new Audio();let url=null,pvT=null,pvA=null;
  const sb=(b,on)=>{b.classList.toggle('go',on);b.innerHTML=ic(on?'pause':'play',16)+'<span>'+(on?'Stop':'10s preview')+'</span><i></i>'};
  const stopPv=()=>{clearTimeout(pvT);pv.onplaying=null;pv.onended=null;pv.pause();if(pvA){pvA.cancel();pvA=null}document.querySelectorAll('#ov .pvb:not(:disabled)').forEach(b=>sb(b,false))};
  const fin=r=>{stopPv();pv.removeAttribute('src');if(url)URL.revokeObjectURL(url);closeOv();res(r)};
  const play=b=>{
    const was=b.classList.contains('go');stopPv();if(was)return;
    const blob=b.dataset.w==='old'?e.blob:file;if(!blob)return;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);pv.src=url;sb(b,true);
    pv.onplaying=()=>{pv.onplaying=null;clearTimeout(pvT);pvT=setTimeout(stopPv,10000);const f=b.querySelector('i');if(f&&f.animate&&!RM.matches)pvA=f.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:10000,easing:'linear',fill:'forwards'})};
    pv.onended=stopPv;
    pv.play().catch(()=>{stopPv();toast('Could not play this file')});
  };
  const meta=(d,b)=>fmt(d)+' \u00b7 '+(b==null?'Not on this device':fmtSize(b));
  const diff=[];
  if(e.blob){const d=file.size-e.blob.size;if(Math.abs(d)>=10240)diff.push(fmtSize(Math.abs(d))+(d>0?' larger':' smaller'))}
  const dd=(ns.dur||0)-(e.dur||0);if(e.dur&&ns.dur&&Math.abs(dd)>=1)diff.push(fmt(Math.abs(dd))+(dd>0?' longer':' shorter'));
  const main=`${left?`<label class="pk dall"><input type="checkbox" id="dalc"><span class="t"><b>Do this for the other duplicates too</b><small>Applies to Replace, Keep both and Don't import</small></span></label>`:''}<button class="it dg" data-d="replace">Replace existing song</button><button class="it" data-d="both">Keep both</button><button class="it" data-d="rename">Rename new song\u2026</button><button class="it" data-d="skip">Don't import</button>`;
  const ren=`<label for="dnm">New name for the incoming song</label><input type="text" id="dnm" maxlength="120"><div class="bt"><button class="pill" data-d="back">Back</button><button class="pill acc" data-d="ok">Add song</button></div>`;
  openOv(`<h3>Duplicate song</h3><p class="dupn">${dup.why==='file'?'This file looks identical to a song already in your library (same size and length).':'A song with the same title is already in your library.'}</p>
  <div class="dtag">In your library</div><div class="dupc"><div class="th">${cover(songCover(e),e.name)}</div><div class="t"><b>${esc(e.name)}</b><span>${esc(sub(e)||'No album')}</span><span>${esc(meta(e.dur,e.blob?e.blob.size:null))}</span></div><button type="button" class="pvb" data-w="old" ${e.blob?'':'disabled'}>${e.blob?ic('play',16)+'<span>10s preview</span><i></i>':'<span>No file</span>'}</button></div>
  <div class="dtag">New file</div><div class="dupc"><div class="th">${cover({name:ns.name})}</div><div class="t"><b>${esc(ns.name)}</b><span>${esc(file.name)}</span><span>${esc(meta(ns.dur,file.size))}</span></div><button type="button" class="pvb" data-w="new">${ic('play',16)}<span>10s preview</span><i></i></button></div>
  <p class="dsum">${diff.length?'New file is '+diff.join(' and ')+'. ':''}Replace keeps the existing song's name, artist, album and playlists, and swaps in the new file.</p><div id="dact">${main}</div>`);
  $('#ov .sheet').onclick=ev=>{
    const p=ev.target.closest('.pvb');if(p){if(!p.disabled)play(p);return}
    const d=ev.target.closest('[data-d]');if(!d)return;
    const a=d.dataset.d,all=!!($('#dalc')&&$('#dalc').checked);
    if(a==='rename'){stopPv();$('#dact').innerHTML=ren;const i=$('#dnm');i.value=freeName(ns.name);i.onkeydown=k=>{if(k.key==='Enter')fin({act:'rename',name:i.value.trim()||ns.name})};i.focus();i.select();return}
    if(a==='back'){$('#dact').innerHTML=main;return}
    if(a==='ok')return fin({act:'rename',name:$('#dnm').value.trim()||ns.name});
    fin({act:a,all});
  };
  $('#ov').onclick=ev=>{if(ev.target.id==='ov')fin({act:'skip'})};
})}
async function addFiles(files){
  const aud=[...files].filter(f=>!/^\._/.test(f.name)&&(f.type.startsWith('audio/')||/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i.test(f.name)));
  let n=0,rep=0,skip=0,all=null,paused=false;const got=[],dupIds=[];
  const lrcMap=new Map();[...files].forEach(x=>{if(/\.lrc$/i.test(x.name))lrcMap.set(lyFk(lyStem(x.name)),x)});
  for(let i=0;i<aud.length;i++){
    const f=aud[i];
    if(aud.length>5&&i&&i%5===0)toast('Importing '+i+' of '+aud.length+'\u2026');
    const s={id:uid(),name:f.name.replace(/\.[^.]+$/,''),artist:'',blob:f,album:null,dur:await getDur(f),added:Date.now()+n};
    if(READ_TAGS_ON_IMPORT)await applyTags(s,f);
    let lyR=lyTmp.has(s.id)?lyTmp.get(s.id):undefined;lyTmp.delete(s.id);
    {const lf=lrcMap.get(lyFk(f.name.replace(/\.[^.]+$/,'')));if(lf&&!(lyR&&lyR.s)){try{const r=lyMake(null,await lf.text());if(r)lyR=r}catch(_){}}}
    const dup=findDup(s);
    if(dup){
      let r;
      if(all)r={act:all};
      else{
        if(!paused&&cur&&!au.paused){au.pause();paused=true}
        r=await dupDialog(dup,s,f,aud.length-1-i);
        if(r.all&&r.act!=='rename')all=r.act;
      }
      if(r.act==='skip'){skip++;dupIds.push(dup.song.id);continue}
      if(r.act==='replace'){await replaceSong(dup.song,s);if(lyR!==undefined)lySet(s.id,lyR);rep++;got.push(s.id);continue}
      if(r.act==='rename')s.name=r.name;
    }
    songs.push(s);await put('songs',s);if(lyR!==undefined)lySet(s.id,lyR);n++;got.push(s.id);
  }
  if(paused&&cur)au.play().catch(()=>{});
  const bits=[];if(n)bits.push(`Added ${n} ${n===1?'song':'songs'}`);if(rep)bits.push(`replaced ${rep}`);if(skip)bits.push(`skipped ${skip}`);
  toast(bits.length?bits.join(' \u00b7 ').replace(/^./,c=>c.toUpperCase()):'No audio files found');render();return {ids:got,dups:dupIds};
}
/* ===== Spotify zip import: reads the zip in place (no library), tags songs from ID3, builds an ordered playlist ===== */
const zU16=(d,o)=>d.getUint16(o,true),zU32=(d,o)=>d.getUint32(o,true),zU64=(d,o)=>Number(d.getBigUint64(o,true));
async function zipEntries(file){
  const tail=Math.min(file.size,65557),tb=new DataView(await file.slice(file.size-tail).arrayBuffer());
  let e=-1;for(let i=tail-22;i>=0;i--)if(zU32(tb,i)===0x06054b50){e=i;break}
  if(e<0)throw new Error('not a zip');
  let n=zU16(tb,e+10),sz=zU32(tb,e+12),off=zU32(tb,e+16);
  if((n===0xffff||off===0xffffffff)&&e>=20&&zU32(tb,e-20)===0x07064b50){
    const r=zU64(tb,e-12),z=new DataView(await file.slice(r,r+56).arrayBuffer());n=zU64(z,32);sz=zU64(z,40);off=zU64(z,48);
  }
  const cd=new DataView(await file.slice(off,off+sz).arrayBuffer()),u8=new Uint8Array(cd.buffer),out=[];
  for(let p=0,i=0;i<n&&p+46<=cd.byteLength;i++){
    const meth=zU16(cd,p+10),nl=zU16(cd,p+28),el=zU16(cd,p+30),cl=zU16(cd,p+32);
    let csz=zU32(cd,p+20),usz=zU32(cd,p+24),lo=zU32(cd,p+42);
    const name=new TextDecoder().decode(u8.subarray(p+46,p+46+nl));
    if(csz===0xffffffff||usz===0xffffffff||lo===0xffffffff){
      for(let q=p+46+nl,end=q+el;q+4<=end;q+=4+zU16(cd,q+2))if(zU16(cd,q)===1){
        let r=q+4;if(usz===0xffffffff){usz=zU64(cd,r);r+=8}if(csz===0xffffffff){csz=zU64(cd,r);r+=8}if(lo===0xffffffff)lo=zU64(cd,r);
      }
    }
    out.push({name,meth,csz,usz,lo,dir:name.endsWith('/')});
    p+=46+nl+el+cl;
  }
  return out;
}
async function zipRead(file,en,type){
  const h=new DataView(await file.slice(en.lo,en.lo+30).arrayBuffer()),s=en.lo+30+zU16(h,26)+zU16(h,28),raw=file.slice(s,s+en.csz,type);
  if(en.meth===0)return raw;
  if(en.meth!==8)throw new Error('unsupported compression');
  return new Blob([await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob()],{type});
}
/* ID3v2.2 / 2.3 / 2.4: title, artist, album artist, cover picture */
function id3(buf){
  let d=new Uint8Array(buf);const r={};
  if(d.length<10||d[0]!==73||d[1]!==68||d[2]!==51)return r;
  const ver=d[3],ss=o=>(d[o]<<21)|(d[o+1]<<14)|(d[o+2]<<7)|d[o+3];
  if(d[5]&0x80&&ver<4){const o=[];for(let i=0;i<d.length;i++){o.push(d[i]);if(d[i]===255&&d[i+1]===0)i++}d=Uint8Array.from(o)}
  const end=Math.min(10+ss(6),d.length),v22=ver===2,hl=v22?6:10;let p=10;
  if(d[5]&0x40)p+=ver===4?ss(p):((d[p]<<24)|(d[p+1]<<16)|(d[p+2]<<8)|d[p+3])+4;
  const txt=b=>{const e=b[0],x=b.subarray(1);try{return new TextDecoder(e===0?'iso-8859-1':e===3?'utf-8':e===1&&x[0]===255&&x[1]===254?'utf-16le':e===1&&x[0]===254&&x[1]===255?'utf-16be':e===1?'utf-16le':'utf-16be').decode(x).replace(/\0+$/,'')}catch(_){return ''}};
  while(p+hl<=end){
    const id=String.fromCharCode(...d.subarray(p,p+(v22?3:4)));
    if(!/^[A-Z0-9]{3,4}$/.test(id))break;
    const fs=v22?((d[p+3]<<16)|(d[p+4]<<8)|d[p+5]):ver===4?ss(p+4):(d[p+4]*16777216+((d[p+5]<<16)|(d[p+6]<<8)|d[p+7]));
    const b=d.subarray(p+hl,p+hl+fs);p+=hl+fs;
    if(!b.length)continue;
    if(id==='TIT2'||id==='TT2')r.title=txt(b);
    else if(id==='TPE1'||id==='TP1')r.artist=txt(b);
    else if(id==='TPE2'||id==='TP2')r.aartist=txt(b);
    else if(id==='SYLT'||id==='SLT'||id==='USLT'||id==='ULT'){try{_lyFrame(id,_lyBody(b,ver,v22?0:d[p-hl-fs+9],d[5]),r)}catch(_){}}
    else if(id==='APIC'||id==='PIC'){
      let q=1;
      if(v22)q=4;else{while(q<b.length&&b[q])q++;q++}
      const front=b[q]===3;q++;
      if(b[0]===1||b[0]===2){while(q+1<b.length&&(b[q]||b[q+1]))q+=2;q+=2}else{while(q<b.length&&b[q])q++;q++}
      if((!r.img||front)&&q<b.length)r.img=new Blob([b.slice(q)],{type:b[q]===0x89?'image/png':'image/jpeg'});
    }
  }
  if(r.sylt||r.uslt)r.lyr=lyMake(r.sylt,r.uslt);
  delete r.sylt;delete r.uslt;
  return r;
}
/* ---- extra tag readers: M4A/MP4, FLAC, Ogg Vorbis/Opus (each returns {title,artist,artists,aartist,img} or {}) ---- */
const _u8=b=>new Uint8Array(b),_dec=(b,l='utf-8')=>{try{return new TextDecoder(l).decode(b)}catch(_){return ''}};
const _be32=(d,o)=>d[o]*16777216+((d[o+1]<<16)|(d[o+2]<<8)|d[o+3]),_le32=(d,o)=>d[o]+(d[o+1]<<8)+(d[o+2]<<16)+d[o+3]*16777216;
const _s4=(d,o)=>String.fromCharCode(d[o],d[o+1],d[o+2],d[o+3]);
/* MP4: find moov at top level, then moov > udta > meta > ilst */
async function mp4Tags(blob){
  const r={};let pos=0;
  while(pos+8<=blob.size){
    const h=_u8(await blob.slice(pos,pos+16).arrayBuffer());let sz=_be32(h,0),hl=8;const t=_s4(h,4);
    if(sz===1){if(h.length<16)break;sz=_be32(h,8)*4294967296+_be32(h,12);hl=16}else if(sz===0)sz=blob.size-pos;
    if(sz<hl)break;
    if(t==='moov'){
      if(sz>48*1048576)return r;
      const d=_u8(await blob.slice(pos+hl,pos+sz).arrayBuffer());
      const kids=(s,e,f)=>{for(let p=s;p+8<=e;){let z=_be32(d,p),q=p+8;if(z===1){z=_be32(d,p+12);q=p+16}else if(z===0)z=e-p;if(z<8||p+z>e)break;if(f(_s4(d,p+4),q,p+z)===false)return;p+=z}};
      kids(0,d.length,(t1,s1,e1)=>{if(t1!=='udta')return;
        kids(s1,e1,(t2,s2,e2)=>{if(t2!=='meta')return;
          kids(s2+4,e2,(t3,s3,e3)=>{if(t3!=='ilst')return;
            kids(s3,e3,(k,s4,e4)=>{
              kids(s4,e4,(dt,s5,e5)=>{if(dt!=='data')return;
                const fl=_be32(d,s5)&0xffffff,v=d.subarray(s5+8,e5);
                if(k==='\u00a9nam')r.title=_dec(v);
                else if(k==='\u00a9ART')r.artist=_dec(v);
                else if(k==='aART')r.aartist=_dec(v);
                else if(k==='covr'&&!r.img&&v.length)r.img=new Blob([v.slice()],{type:fl===14||v[0]===0x89?'image/png':'image/jpeg'});
                return false})})})})});
      return r;
    }
    pos+=sz;
  }
  return r;
}
/* Vorbis comment block (shared by FLAC and Ogg) -> fields, picture blobs */
function vorbisComments(d,r){
  if(d.length<8)return r;
  let p=4+_le32(d,0);if(p+4>d.length)return r;
  const n=_le32(d,p);p+=4;const arts=[];
  for(let i=0;i<n&&p+4<=d.length;i++){
    const l=_le32(d,p);p+=4;if(p+l>d.length)break;
    const s=_dec(d.subarray(p,p+l));p+=l;const q=s.indexOf('=');if(q<1)continue;
    const k=s.slice(0,q).toUpperCase(),v=s.slice(q+1);
    if(k==='TITLE'&&!r.title)r.title=v;
    else if(k==='ARTIST'&&v.trim())arts.push(v);
    else if(k==='ALBUMARTIST'&&!r.aartist)r.aartist=v;
    else if(k==='METADATA_BLOCK_PICTURE'){try{const bin=atob(v),u=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)u[j]=bin.charCodeAt(j);flacPicture(u,r)}catch(_){}}
  }
  if(arts.length){r.artist=arts[0];if(arts.length>1)r.artists=arts}
  return r;
}
function flacPicture(d,r){
  if(d.length<32)return;
  const ty=_be32(d,0),ml=_be32(d,4);let p=8+ml;if(p+4>d.length)return;
  const dl=_be32(d,p);p+=4+dl+16;if(p+4>d.length)return;
  const n=_be32(d,p);p+=4;if(!n||p+n>d.length)return;
  const m=_dec(d.subarray(8,8+ml),'ascii').toLowerCase(),b=d.subarray(p,p+n);
  if(!r.img||ty===3)r.img=new Blob([b.slice()],{type:m.indexOf('png')>=0||b[0]===0x89?'image/png':'image/jpeg'});
}
async function flacTags(blob){
  const r={};let pos=4;
  while(pos+4<=blob.size){
    const h=_u8(await blob.slice(pos,pos+4).arrayBuffer()),last=h[0]&128,ty=h[0]&127,len=(h[1]<<16)|(h[2]<<8)|h[3];
    if(len>32*1048576)break;
    if(ty===4||ty===6){const d=_u8(await blob.slice(pos+4,pos+4+len).arrayBuffer());if(ty===4)vorbisComments(d,r);else flacPicture(d,r)}
    pos+=4+len;if(last)break;
  }
  return r;
}
/* Ogg: reassemble the first two packets (id header, comment header) across pages */
async function oggTags(blob){
  const d=_u8(await blob.slice(0,Math.min(blob.size,12*1048576)).arrayBuffer()),pk=[];let cur=[],p=0,ser=null;
  while(p+27<=d.length&&pk.length<2){
    if(_s4(d,p)!=='OggS')break;
    const ns=d[p+26],sn=_le32(d,p+14);if(ser===null)ser=sn;
    let q=p+27+ns,tot=0;if(q>d.length)break;
    for(let i=0;i<ns;i++)tot+=d[p+27+i];
    if(q+tot>d.length)break;
    if(sn===ser){let o=q;for(let i=0;i<ns;i++){const l=d[p+27+i];cur.push(d.subarray(o,o+l));o+=l;if(l<255){const a=new Uint8Array(cur.reduce((s,x)=>s+x.length,0));let w=0;cur.forEach(x=>{a.set(x,w);w+=x.length});pk.push(a);cur=[];if(pk.length>=2)break}}}
    p=q+tot;
  }
  const c=pk[1];if(!c)return {};
  const r={};
  if(c[0]===3&&_dec(c.subarray(1,7),'ascii')==='vorbis')return vorbisComments(c.subarray(7),r);
  if(_dec(c.subarray(0,8),'ascii')==='OpusTags')return vorbisComments(c.subarray(8),r);
  return r;
}
async function readTags(blob){
  const h=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  if(h[0]===73&&h[1]===68&&h[2]===51)return id3(await blob.slice(0,((h[6]<<21)|(h[7]<<14)|(h[8]<<7)|h[9])+10).arrayBuffer());
  if(h[0]===0x66&&h[1]===0x4c&&h[2]===0x61&&h[3]===0x43)return flacTags(blob);
  if(h[0]===0x4f&&h[1]===0x67&&h[2]===0x67&&h[3]===0x53)return oggTags(blob);
  if(h[4]===0x66&&h[5]===0x74&&h[6]===0x79&&h[7]===0x70)return mp4Tags(blob);
  return {};
}
/* fill a freshly imported song from its embedded tags; leaves it exactly as before when the file has none */
const READ_TAGS_ON_IMPORT=true;
async function applyTags(s,f){
  try{
    const t=await readTags(f);
    lyTmp.set(s.id,(t&&t.lyr)||0);
    if(!t||!(t.title||t.artist||t.artists||t.aartist||t.img))return;
    const m=songMeta(s.name,t);
    if(m.title)s.name=m.title;
    s.artist=m.artist||'';
    if(m.feat&&m.feat.length)s.feat=m.feat;
    if(t.img){const c=await makeCover(t.img);if(c){s.cover=c.data;s.ccol=c.color}}
  }catch(e){console.warn('tag read failed',e)}
}
/* tags first, file name ("Artist, Artist - Title") as fallback, "(feat. X)" moved out of the title into featuring */
const FEAT_RE=/\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^\)\]]+?)\s*[\)\]]|\s+(?:-\s*)?(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
function songMeta(base,t){
  const clean=a=>a.map(x=>x.trim()).filter(Boolean);
  let title=(t.title||'').trim(),arts=t.artists?clean(t.artists):clean((t.artist||'').split(/\0|;|(?<!AC)\/(?!DC)/));
  if(!title||!arts.length){
    const i=base.indexOf(' - ');
    if(i>0){if(!arts.length)arts=clean(base.slice(0,i).split(','));if(!title)title=base.slice(i+3).trim()}
    else if(!title)title=base.trim();
  }
  if(!arts.length&&t.aartist)arts=[t.aartist.trim()];
  const feat=arts.slice(1);
  title=title.replace(FEAT_RE,(m,a,b)=>{feat.push(...clean((a||b).split(/,|&|\band\b/i)));return ''}).trim()||base;
  const artist=arts[0]||'';
  return {title,artist,feat:feat.filter((x,i)=>!sameArt(x,artist)&&feat.findIndex(y=>sameArt(x,y))===i)};
}
const Z_MIME={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',ogg:'audio/ogg',opus:'audio/ogg',wav:'audio/wav'};
const zBase=n=>n.split('/').pop();
/* ---- Spotify connection (PKCE, no secret; token stays in this browser) ---- */
const SP_ID='';/* optional: paste your Client ID here, otherwise the app asks once */
const SP_SCOPE='playlist-read-private playlist-read-collaborative';
const SP_REDIRECTS=['https://super-peony-8c59ba.netlify.app/','https://beefyjr.github.io/traXz/'];/* add both as Redirect URIs in your Spotify dashboard, exactly like this */
const spRedirect=()=>SP_REDIRECTS.find(u=>location.href.startsWith(u))||SP_REDIRECTS[0];
const spLS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null};
const spCid=()=>SP_ID||spLS('sp-id');
const spConnected=()=>!!(spLS('sp-ref')||(Number(spLS('sp-exp'))>Date.now()&&spLS('sp-tok')));
const spDisconnect=()=>['sp-tok','sp-exp','sp-ref'].forEach(k=>spLS(k,null));
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function spAskId(){return new Promise(res=>{
  openOv(`<h3>Connect Spotify</h3><p class="dupn">In your Spotify developer dashboard, add this Redirect URI to your app, then paste its Client ID.</p>
  <label for="sru">Redirect URI</label><input type="text" id="sru" readonly>
  <label for="sid">Client ID</label><input type="text" id="sid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Client ID">
  <div class="bt"><button class="pill" id="sx">Cancel</button><button class="pill acc" id="sg">Connect</button></div>`);
  $('#sru').value=spRedirect();$('#sru').onfocus=e=>e.target.select();
  const close=v=>{closeOv();res(v)};
  $('#sx').onclick=()=>close(null);
  $('#sg').onclick=()=>{const v=$('#sid').value.trim();if(!v){$('#sid').focus();return}close(v)};
  $('#ov').onclick=ev=>{if(ev.target.id==='ov')close(null)};
})}
async function spConnect(){
  let id=spCid();if(!id){id=await spAskId();if(!id)return;spLS('sp-id',id)}
  const ver=b64u(crypto.getRandomValues(new Uint8Array(48))),st=b64u(crypto.getRandomValues(new Uint8Array(12)));
  const chal=b64u(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ver)));
  spLS('sp-ver',ver);spLS('sp-state',st);
  location.href='https://accounts.spotify.com/authorize?'+new URLSearchParams({client_id:id,response_type:'code',redirect_uri:spRedirect(),scope:SP_SCOPE,code_challenge_method:'S256',code_challenge:chal,state:st});
}
async function spToken(body){
  try{
    const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:spCid(),...body})});
    const j=await r.json();if(!r.ok||!j.access_token)return false;
    spLS('sp-tok',j.access_token);spLS('sp-exp',String(Date.now()+j.expires_in*1000-60000));if(j.refresh_token)spLS('sp-ref',j.refresh_token);
    return true;
  }catch(e){return false}
}
async function spCallback(){
  const q=new URLSearchParams(location.search);if(!q.has('code')&&!q.has('error'))return;
  const code=q.get('code'),ok=q.get('state')&&q.get('state')===spLS('sp-state');
  history.replaceState(null,'',location.pathname);
  if(!code||!ok)return toast('Spotify connection cancelled');
  toast(await spToken({grant_type:'authorization_code',code,redirect_uri:spRedirect(),code_verifier:spLS('sp-ver')})?'Spotify connected. Choose your zip again.':'Could not connect Spotify');
}
async function spGet(url,n=0){
  let t=Number(spLS('sp-exp'))>Date.now()&&spLS('sp-tok');
  if(!t){const ref=spLS('sp-ref');if(ref&&await spToken({grant_type:'refresh_token',refresh_token:ref}))t=spLS('sp-tok')}
  if(!t)throw new Error('auth');
  const r=await fetch(url.startsWith('http')?url:'https://api.spotify.com/v1'+url,{headers:{Authorization:'Bearer '+t}});
  if(r.status===429&&n<2){await new Promise(s=>setTimeout(s,(+r.headers.get('Retry-After')||1)*1000));return spGet(url,n+1)}
  if(!r.ok)throw new Error(r.status);
  return r.json();
}
async function spTracks(id){
  const out=[];let u=`/playlists/${id}/items?limit=100`;
  while(u){
    const j=await spGet(u);
    for(const e of j.items||[]){
      const t=e&&(e.item||e.track);if(!t||!t.name||t.type==='episode'||!Array.isArray(t.artists))continue;
      const im=(t.album&&t.album.images)||[];out.push({name:t.name,artists:t.artists.map(a=>a.name),img:(im[1]||im[0]||{}).url});
    }
    u=j.next;
  }
  return out;
}
const spImgC=new Map();
async function spImg(url){
  if(spImgC.has(url))return spImgC.get(url);
  let c=null;try{const r=await fetch(url);if(r.ok)c=await makeCover(await r.blob())}catch(e){}
  spImgC.set(url,c);return c;
}
/* match a file to the Spotify track it came from: title (exact, or found in the file name) plus artist */
function spMatch(T,used,base,m){
  const bk=nkey(base),mt=nkey(m.title),ma=nkey(m.artist);let best=-1,bs=0;
  T.forEach((t,i)=>{
    if(used.has(i))return;
    const tk=nkey(t.name);if(!tk)return;
    let s=0;
    if(tk===mt||(tk.length>3&&bk.includes(tk)))s=4;
    else if(tk.length>3&&mt.length>3&&(tk.includes(mt)||mt.includes(tk)))s=2;
    if(!s)return;
    if(t.artists.some(a=>{a=nkey(a);return a&&(a===ma||bk.includes(a))}))s+=3;
    if(s>bs){bs=s;best=i}
  });
  return bs>=4?best:-1;
}
/* ---- import dialog ---- */
function zipDialog(dflt,n,numbered,sp){return new Promise(res=>{
  openOv(`<h3>Import Spotify zip</h3><p class="dupn">${n} ${n===1?'song':'songs'} found${numbered?'. Numbered file names set the order':''}.</p>
  <label for="zn">Playlist name</label><input type="text" id="zn" maxlength="80" autocomplete="off">
  ${sp?`<div id="zspw"><label>Match with your Spotify playlist</label><div class="zsp" id="zsp"><div class="zmsg">Loading your playlists\u2026</div></div><button type="button" class="zdis" id="zdc">Disconnect Spotify</button></div>`:''}
  <label class="pk dall" id="zrl"><input type="checkbox" id="zr"><span class="t"><b>Reverse order</b><small>Use this if the playlist comes out upside down</small></span></label>
  <div class="bt"><button class="pill" id="zx">Cancel</button><button class="pill acc" id="zg">Import</button></div>`);
  let sel=null,touched=false;const nm=$('#zn');nm.value=dflt;nm.oninput=()=>{touched=true};
  const close=v=>{closeOv();res(v)};
  $('#zx').onclick=()=>close(null);
  $('#zg').onclick=()=>close({name:nm.value.trim()||dflt,rev:$('#zr').checked&&!(sel&&sel.rd),sp:sel});
  $('#ov').onclick=ev=>{if(ev.target.id==='ov')close(null)};
  if(!sp)return;
  $('#zdc').onclick=()=>{spDisconnect();sel=null;$('#zspw').remove();$('#zrl').style.display='';toast('Spotify disconnected')};
  (async()=>{
    let L=[];
    try{
      let me=null;try{me=await spGet('/me')}catch(e){}
      for(let u='/me/playlists?limit=50',i=0;u&&i<4;i++){const j=await spGet(u);L=L.concat((j.items||[]).filter(Boolean));u=j.next}
      L.forEach(p=>p.rd=!me||!!p.collaborative||!!(p.owner&&p.owner.id===me.id));
    }catch(e){const b=$('#zsp');if(b)b.innerHTML='<div class="zmsg">Could not load your Spotify playlists.</div>';return}
    const box=$('#zsp');if(!box)return;
    if(!L.length){box.innerHTML='<div class="zmsg">No playlists found.</div>';return}
    const paint=()=>{
      box.innerHTML=L.map((p,i)=>{const im=p.images&&p.images[p.images.length-1];return `<button type="button" class="zr${p===sel?' on':''}" data-i="${i}"><span class="zt">${im?`<img src="${esc(im.url)}" alt="">`:''}</span><span class="zn"><b>${esc(p.name)}</b><small>${p.rd?'Order, covers and artists':'Cover only'}</small></span></button>`}).join('');
      const r=$('#zrl');if(r)r.style.display=sel&&sel.rd?'none':'';
    };
    const k=nkey(dflt);
    sel=L.find(p=>nkey(p.name)===k)||L.find(p=>k.length>3&&nkey(p.name).length>3&&(nkey(p.name).includes(k)||k.includes(nkey(p.name))))||null;
    if(sel&&!touched)nm.value=sel.name;
    paint();
    box.onclick=ev=>{const b=ev.target.closest('[data-i]');if(!b)return;const p=L[+b.dataset.i];sel=sel===p?null:p;if(!touched)nm.value=sel?sel.name:dflt;paint()};
  })();
})}
async function importZip(file){
  let ents;try{ents=await zipEntries(file)}catch(e){return toast('Could not read that zip')}
  const ok=x=>!x.dir&&!/(^|\/)(__MACOSX\/|\._)/.test(x.name);
  let aud=ents.filter(x=>ok(x)&&/\.(mp3|m4a|aac|flac|ogg|opus|wav)$/i.test(x.name));
  if(!aud.length)return toast('No audio files in that zip');
  /* fallback order (no Spotify): a leading number in the file name wins ("01 - ...", "002. ..."), otherwise the order inside the zip */
  const numRe=/^\s*(\d{1,4})\s*[-._)]\s*\S/,nums=aud.map(x=>{const m=numRe.exec(zBase(x.name));return m?+m[1]:null});
  const numbered=nums.filter(x=>x!=null).length>=aud.length*.8;
  if(numbered)aud=aud.map((x,i)=>({x,k:nums[i]??1e9,i})).sort((a,b)=>a.k-b.k||a.i-b.i).map(o=>o.x);
  const dflt=zBase(file.name).replace(/\.zip$/i,'').trim()||'Spotify playlist';
  const o=await zipDialog(dflt,aud.length,numbered,spConnected());if(!o)return;
  if(o.rev)aud.reverse();
  $('#ov').onclick=null;openOv('<h3>Importing playlist</h3><p class="dupn" id="zp">Starting\u2026</p>');
  /* playlist cover + track list: Spotify first, then a cover/folder image inside the zip */
  const name=o.name;let cov=null,T=null;
  if(o.sp){
    $('#zp').textContent='Reading your Spotify playlist\u2026';
    if(o.sp.images&&o.sp.images[0])cov=await spImg(o.sp.images[0].url);
    if(o.sp.rd){try{T=await spTracks(o.sp.id)}catch(e){toast('Spotify did not share this playlist\u2019s tracks')}}
  }
  if(!cov){
    const im=ents.filter(x=>ok(x)&&/\.(jpe?g|png|webp)$/i.test(x.name)),pick=im.find(x=>/cover|folder|playlist|front|artwork/i.test(zBase(x.name)))||(im.length===1?im[0]:null);
    if(pick){try{cov=await makeCover(await zipRead(file,pick,'image/jpeg'))}catch(e){}}
  }
  const items=[],used=new Set();let added=0,reused=0,failed=0,matched=0;
  for(let i=0;i<aud.length;i++){
    const en=aud[i],bn=zBase(en.name),ext=bn.split('.').pop().toLowerCase();
    const zp=$('#zp');if(zp)zp.textContent=`${i+1} / ${aud.length} \u00b7 ${bn}`;
    try{
      const blob=await zipRead(file,en,Z_MIME[ext]||'audio/mpeg');
      const t=await readTags(blob).catch(()=>({}));
      const b0=bn.replace(/\.[^.]+$/,''),b1=numbered?b0.replace(/^\s*\d{1,4}\s*[-._)]\s*/,''):b0,m0=songMeta(b1,t);
      let ti=-1;if(T){ti=spMatch(T,used,b1,m0);if(ti>=0){used.add(ti);matched++}}
      const tr=ti>=0?T[ti]:null,m=tr?songMeta(b1,{title:tr.name,artists:tr.artists}):m0;
      const s={id:uid(),name:m.title,artist:m.artist,feat:m.feat,blob,album:null,dur:await getDur(blob),added:Date.now()+i};
      const k=ti>=0?ti:1e9+i;
      const ex=songs.find(e=>e.blob&&e.blob.size===blob.size&&Math.abs((e.dur||0)-s.dur)<1)||songs.find(e=>nkey(e.name)===nkey(s.name)&&nkey(e.artist)===nkey(s.artist));
      if(ex){if(!items.some(x=>x.id===ex.id))items.push({id:ex.id,k});reused++;continue}
      let c=null;
      if(t.img)c=await makeCover(t.img);
      if(!c&&tr&&tr.img)c=await spImg(tr.img);
      if(c){s.cover=c.data;s.ccol=c.color}
      songs.push(s);await put('songs',s);lySet(s.id,t.lyr||0);items.push({id:s.id,k});added++;
    }catch(e){failed++}
  }
  items.sort((a,b)=>a.k-b.k);const ids=items.map(x=>x.id);
  const pl={id:uid(),name,desc:'',color:null,cover:cov?cov.data:null,folderId:view.pf||null,songs:ids,added:Date.now()};
  playlists.push(pl);await put('playlists',pl);
  closeOv();view.pl=pl.id;render();
  toast([`Imported ${ids.length} ${ids.length===1?'song':'songs'}`,T?`${matched} matched to Spotify`:'',reused?`${reused} already in library`:'',failed?`${failed} failed`:''].filter(Boolean).join(' \u00b7 '));
}
async function startZipImport(){
  if(spConnected())return $('#zi').click();
  const r=await choose('Import Spotify zip',[{label:'Connect Spotify for order and covers',value:'c'},{label:'Continue without Spotify',value:'n'}]);
  if(r==='c')return spConnect();
  if(r==='n')$('#zi').click();
}
$('#zi').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await importZip(f)};
setTimeout(spCallback,400);
$('#fi').onchange=async e=>{
  const fs=[...e.target.files];e.target.value='';
  const isAud=f=>f.type.startsWith('audio/')||/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i.test(f.name);
  if(fs.length&&!fs.some(isAud)&&fs.some(f=>LY_EXT.test(f.name)))return lyMassApply(fs);   /* only lyric files chosen */
  await addFiles(fs);
};
$('#lmi').onchange=e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)lyMassApply(fs)};

/* ===== END 09-import.js ===== */


/* ===== BEGIN 10-actions.js ===== */
/* ===== drag & drop (desktop): audio files, whole folders, and .lrc files ===== */
(()=>{
  const AUD=/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i,LRC=/\.(lrc|txt)$/i;
  const dz=document.createElement('div');dz.id='dz';dz.setAttribute('aria-hidden','true');
  dz.innerHTML='<div data-z="add">Add to library<span>Songs, folders or .lrc lyric files</span></div><div data-z="rep">Replace audio<span>Each file is matched to a song by name and artist</span></div>';document.body.appendChild(dz);
  let depth=0;
  const hasFiles=e=>!!(e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files'));
  const zoneAt=e=>songs.length&&(innerWidth<=640?e.clientY>innerHeight/2:e.clientX>innerWidth/2)?'rep':'add';
  const hot=e=>{const z=zoneAt(e);dz.querySelectorAll('[data-z]').forEach(d=>d.classList.toggle('hot',d.dataset.z===z))};
  const hide=()=>{depth=0;dz.classList.remove('on')};
  const readDir=d=>new Promise(res=>{const r=d.createReader(),out=[];const go=()=>r.readEntries(b=>{if(!b.length)return res(out);out.push(...b);go()},()=>res(out));go()});
  async function walk(en,out,path){
    if(en.isFile){await new Promise(r=>en.file(f=>{try{Object.defineProperty(f,'webkitRelativePath',{value:path+f.name})}catch(_){}out.push(f);r()},()=>r()))}
    else if(en.isDirectory){for(const c of await readDir(en))await walk(c,out,path+en.name+'/')}
  }
  /* only lyric files were dropped: one file with the player open goes to that song; any other drop is matched to songs by file name */
  async function dropLyrics(files){
    if(files.length===1&&$('#full').classList.contains('open')){
      const s=songById(cur);
      if(s)return void await lyApplyFile(files[0],s);
    }
    return lyMassApply(files);
  }
  addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();depth++;dz.classList.toggle('one',!songs.length);dz.classList.add('on');hot(e)});
  addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';hot(e)});
  addEventListener('dragleave',e=>{if(!hasFiles(e))return;if(--depth<=0)hide()});
  addEventListener('dragend',hide);addEventListener('blur',hide);
  addEventListener('drop',async e=>{
    if(!hasFiles(e))return;
    e.preventDefault();hide();const zone=zoneAt(e);
    /* entries and files must be grabbed before the first await, the browser clears them afterwards */
    const ents=[...(e.dataTransfer.items||[])].map(i=>i.kind==='file'&&i.webkitGetAsEntry?i.webkitGetAsEntry():null);
    const flat=[...e.dataTransfer.files];
    if($('#ov').classList.contains('open'))return toast('Close the open dialog first');
    let fs=[];
    if(ents.length&&ents.every(Boolean)){toast('Reading files\u2026');for(const en of ents)await walk(en,fs,'')}else fs=flat;
    fs=fs.filter(f=>!/^\._/.test(f.name));
    const aud=fs.filter(f=>f.type.startsWith('audio/')||AUD.test(f.name)),lrc=fs.filter(f=>LRC.test(f.name));
    if(!aud.length){
      if(lrc.length)return dropLyrics(lrc);
      return toast(fs.length?'Drop audio files, a folder of songs or an .lrc file':'Nothing to add');
    }
    if(zone==='rep')return rfBulk(aud);
    fs.sort((a,b)=>cmp(a.webkitRelativePath||a.name,b.webkitRelativePath||b.name));
    await addFiles(fs);
  });
})();
let dirMode='songs';
$('#di').onchange=async e=>{const fs=[...e.target.files],mode=dirMode;dirMode='songs';e.target.value='';if(!fs.length)return toast('That folder is empty');
  fs.sort((a,b)=>cmp(a.webkitRelativePath||a.name,b.webkitRelativePath||b.name));
  const w=fs.find(f=>f.webkitRelativePath),root=w?w.webkitRelativePath.split('/')[0]:'';
  toast('Scanning folder\u2026');const r=await addFiles(fs);
  if(mode!=='songs'&&root&&r)await folderTarget(mode,root,r)};
/* import folder as album / playlist: the folder name becomes the title; an existing one with the same name is reused */
async function folderTarget(mode,name,r){
  const key=nkey(name);
  if(mode==='album'){
    const ids=[...new Set(r.ids)];if(!ids.length)return;
    let a=albums.find(x=>nkey(x.name)===key);if(!a)a=newAlbum(name,view.folder);
    for(const id of ids){const s=songById(id);if(s){s.album=a.id;await put('songs',s)}}
    view.album=a.id;toast('Album "'+a.name+'" \u00b7 '+ids.length+(ids.length===1?' song':' songs'));render();
  }else{
    const ids=[...new Set(r.ids.concat(r.dups))];if(!ids.length)return;
    let p=playlists.find(x=>nkey(x.name)===key);
    if(!p){p={id:uid(),name,desc:'',color:null,cover:null,folderId:view.pf||null,songs:[],added:Date.now()};playlists.push(p)}
    const have=new Set(p.songs||[]);p.songs=(p.songs||[]).concat(ids.filter(id=>!have.has(id)));await put('playlists',p);
    view.pl=p.id;toast('Playlist "'+p.name+'" \u00b7 '+p.songs.length+(p.songs.length===1?' song':' songs'));render();
  }
}
/* redo the crop of an album cover from its saved original (or from the cover itself when there is none); animated covers only move the animation */
async function albumRecrop(a){
  const mm=a.cmedia&&MED.get(a.cmedia.id);
  if(mm){const cr=await cropSheet(mm.blob,mm.t==='video'?'video':'gif',1,a.cmedia.p||null);if(!cr)return;
    if(cr.def)delete a.cmedia.p;else a.cmedia.p=cr.p;await put('albums',a);render();return}
  const og=a.crig&&MED.get(a.crig.id);let src=og&&og.blob;
  if(!src){try{src=await(await fetch(a.cover)).blob()}catch(e){return toast('Could not open that cover')}}
  const cr=await cropSheet(src,'img',1,og&&cropOk(a.cc)?a.cc:null);if(!cr)return;
  const b=cr.def?src:await cropBake(src,1,1024,cr),r=b&&await makeCover(b);if(!r)return cvFail('Could not crop that cover');
  a.cover=r.data;a.ccol=r.color;if(og){const c=cropPack(cr);if(c)a.cc=c;else delete a.cc}
  await put('albums',a);render();toast('Cover updated');
}
function makeCover(file){return new Promise(res=>{
  const img=new Image(),u=URL.createObjectURL(file);
  img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=400;const x=c.getContext('2d'),m=Math.min(img.width,img.height);
    x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,400,400);URL.revokeObjectURL(u);
    let col=null;try{col=dominant(c)}catch(e){}
    res({data:c.toDataURL('image/jpeg',.82),color:col})};
  img.onerror=()=>res(null);img.src=u})}
$('#ci').onchange=async e=>{
  const f=e.target.files[0],a=albums.find(x=>x.id===coverFor);e.target.value='';
  if(!f||!a)return;const r=await makeCoverX(f);if(!r)return cvFail('Could not read that image');
  const ref=r.media?await medSave(r.media):null,old=a.cmedia&&a.cmedia.id,oo=a.crig&&a.crig.id,nr=r.orig?await medSave({blob:r.orig,t:'img'}):null;
  a.cover=r.data;a.ccol=r.color;if(ref)a.cmedia=ref;else delete a.cmedia;if(nr)a.crig=nr;else delete a.crig;if(r.c)a.cc=r.c;else delete a.cc;await put('albums',a);render();medGC([old,oo]);
  an($('#main .ah .cov'),[{opacity:.2,transform:'scale(.94)'},{opacity:1,transform:'none'}],{duration:380,easing:EASE_OUT});
};

/* actions: songs */
const albFeat=a=>Array.isArray(a.feat)?a.feat.filter(Boolean):[];
const newAlbum=(n,f,artist,feat)=>{const a={id:uid(),name:n,artist:artist||'',feat:(feat||[]).slice(),cover:null,folderId:f||null};albums.push(a);put('albums',a);return a};
function albumForm(title,a,ok){return new Promise(res=>{
  const arts=knownArts(),KA=knownArts(),d={feat:a?albFeat(a).slice():[]};
  openOv(`<h3>${esc(title)}</h3><label for="an">Album name</label><input type="text" id="an" maxlength="80" placeholder="Album name" autocomplete="off"><label for="aa">Artist (optional)</label><input type="text" id="aa" maxlength="80" placeholder="Artist name" list="arl" autocomplete="off"><datalist id="arl">${arts.slice(0,80).map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
  <label for="afi">Featuring (optional)</label><div class="chips wrap" id="afts"></div><div class="ftrow"><input type="text" id="afi" maxlength="120" placeholder="Add a featuring artist" autocomplete="off"><button type="button" class="pill" id="afa">Add</button></div><div class="chips sgl" id="afs"></div>
  <div class="bt"><button class="pill" id="ax">Cancel</button><button class="pill acc" id="as">${ok||'Save'}</button></div>`);
  $('#an').value=a?a.name:'';$('#aa').value=a&&a.artist||'';
  setTimeout(()=>$('#an').focus(),60);
  const fl=()=>{
    $('#afts').style.display=d.feat.length?'':'none';
    $('#afts').innerHTML=d.feat.map((x,i)=>`<button type="button" class="chip on fx" data-r="${i}" aria-label="Remove ${esc(x)}">${esc(x)}${ic('close',12)}</button>`).join('');
    const q=fold($('#afi').value.trim()),ma=$('#aa').value.trim();
    const sg=KA.filter(x=>!sameArt(x,ma)&&!d.feat.some(f=>sameArt(f,x))&&(!q||fold(x).includes(q))).slice(0,300);
    $('#afs').innerHTML=sg.map(x=>`<button type="button" class="chip" data-n="${esc(x)}">${esc(x)}</button>`).join('');
    $('#afs').style.display=sg.length?'':'none';
  };
  const addF=v=>{v=(v||'').replace(/\s+/g,' ').trim();if(v&&!d.feat.some(f=>sameArt(f,v))&&!sameArt(v,$('#aa').value.trim()))d.feat.push(v);$('#afi').value='';fl()};
  $('#afa').onclick=()=>addF($('#afi').value);
  $('#afi').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addF($('#afi').value)}};
  $('#afi').oninput=fl;$('#aa').oninput=fl;
  $('#afts').onclick=e=>{const c=e.target.closest('[data-r]');if(!c)return;d.feat.splice(+c.dataset.r,1);fl()};
  $('#afs').onclick=e=>{const c=e.target.closest('[data-n]');if(c)addF(c.dataset.n)};
  fl();
  const done=v=>{closeOv();res(v)};
  const go=()=>{const n=$('#an').value.trim();if(!n){$('#an').focus();return}
    const pend=($('#afi').value||'').replace(/\s+/g,' ').trim();if(pend&&!d.feat.some(f=>sameArt(f,pend)))d.feat.push(pend);
    const ar=$('#aa').value.trim();done({name:n,artist:ar,feat:d.feat.filter(x=>!sameArt(x,ar))})};
  $('#ax').onclick=()=>done(null);$('#as').onclick=go;
  $('#an').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#aa').focus()}};
  $('#aa').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#afi').focus()}};
  $('#ov').onclick=e=>{if(e.target.id==='ov')done(null)};
})}
async function moveSong(s){
  const opts=albums.map(a=>({label:a.name,value:a.id,sel:a.id===s.album,cov:a}));opts.push({label:'New album',value:'__new',plus:true});
  const t=await choose('Add to album',opts);
  if(t==='__new'){const f=await albumForm('New album',null,'Create');if(f){const a=newAlbum(f.name,null,f.artist,f.feat);s.album=a.id;s.pos=Date.now();await put('songs',s)}}
  else if(t){s.album=t;s.pos=Date.now();await put('songs',s)}
}
function editSong(s){return new Promise(res=>{
  const d={keep:!!s.keepcov,cover:s.cover||null,ccol:s.ccol||null,color:s.color||null,feat:featOf(s).slice(),cmedia:s.cmedia||null,cm:null},cur0=albumOf(s);
  const thumb=()=>{const w=$('#dkw');if(w){w.style.display=d.cover?'':'none';$('#dkp').classList.toggle('on',!!d.keep)}return cover({cover:d.cover,name:s.name||'?',cmedia:d.cm||d.cmedia},undefined,true)};
  openOv(`<h3>Song details</h3><div class="cvrow"><div class="thumb" id="dt">${thumb()}</div><div class="cvb"><button class="pill" id="dp">Import cover</button><button class="pill" id="dmk">Make cover</button><button class="pill" id="dr">Remove cover</button></div></div>
  <div id="dkw" style="display:none;margin:2px 0 6px"><button type="button" class="chip" id="dkp">Keep this cover when the song is in an album</button></div>
  <label for="dn">Name</label><input type="text" id="dn" maxlength="120"><label for="da">Artist</label><input type="text" id="da" maxlength="120">
  <label for="dfi">Featuring (optional)</label><div class="chips wrap" id="fts"></div><div class="ftrow"><input type="text" id="dfi" maxlength="120" placeholder="Add a featuring artist" autocomplete="off"><button type="button" class="pill" id="dfa">Add</button></div><div class="chips sgl" id="fsg"></div>
  <label for="dl">Album (type your own or pick one)</label><input type="text" id="dl" maxlength="80" placeholder="No album"><div class="chips" id="chips">${albums.map(a=>`<button type="button" class="chip" data-n="${esc(a.name)}">${esc(a.name)}</button>`).join('')}</div>
  <label for="drc">Record (optional, type your own or pick one)</label><input type="text" id="drc" maxlength="80" placeholder="No record"><div class="chips" id="rchips">${knownRecs().map(r=>`<button type="button" class="chip" data-n="${esc(r)}">${esc(r)}</button>`).join('')}</div>
  <label>Color</label><div class="sw" id="scw"><button type="button" class="swb auto" data-c="" aria-label="Automatic color">${ic('close',14)}</button>${PAL.map(c=>`<button type="button" class="swb" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="swc" aria-label="Custom color"><input type="color" id="scc">${ic('palette',16)}</label></div>
  <label>Audio</label><div class="dact"><button type="button" id="drf"><span class="dai">${ic('swaph',20)}</span><span class="dtx"><b>Replace audio</b><small>Swap in a better file</small></span></button><button type="button" id="dtm"><span class="dai">${ic('cut',20)}</span><span class="dtx"><b>Trim &amp; loop</b><small>Cut, repeat or join parts</small></span></button></div>
  <div class="bt"><button class="pill" id="dc">Cancel</button><button class="pill acc" id="ds">Save</button></div>`);
  $('#dn').value=s.name;$('#da').value=s.artist||'';$('#dl').value=cur0?cur0.name:'';$('#drc').value=recOf(s);
  {const rm=()=>{const v=$('#drc').value.trim().toLowerCase();document.querySelectorAll('#rchips .chip').forEach(c=>c.classList.toggle('on',c.dataset.n.toLowerCase()===v))};rm();$('#drc').oninput=rm;$('#rchips').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;$('#drc').value=c.dataset.n;rm()}}
  const KA=knownArts();
  const fl=()=>{
    $('#fts').style.display=d.feat.length?'':'none';
    $('#fts').innerHTML=d.feat.map((x,i)=>`<button type="button" class="chip on fx" data-r="${i}" aria-label="Remove ${esc(x)}">${esc(x)}${ic('close',12)}</button>`).join('');
    const q=fold($('#dfi').value.trim()),ma=$('#da').value.trim();
    const sg=KA.filter(x=>!sameArt(x,ma)&&!d.feat.some(f=>sameArt(f,x))&&(!q||fold(x).includes(q))).slice(0,300);
    $('#fsg').innerHTML=sg.map(x=>`<button type="button" class="chip" data-n="${esc(x)}">${esc(x)}</button>`).join('');
    $('#fsg').style.display=sg.length?'':'none';
  };
  const addF=v=>{v=(v||'').replace(/\s+/g,' ').trim();if(v&&!d.feat.some(f=>sameArt(f,v))&&!sameArt(v,$('#da').value.trim()))d.feat.push(v);$('#dfi').value='';fl()};
  $('#dfa').onclick=()=>addF($('#dfi').value);
  $('#dfi').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addF($('#dfi').value)}};
  $('#dfi').oninput=fl;$('#da').oninput=fl;
  $('#fts').onclick=e=>{const c=e.target.closest('[data-r]');if(!c)return;d.feat.splice(+c.dataset.r,1);fl()};
  $('#fsg').onclick=e=>{const c=e.target.closest('[data-n]');if(c)addF(c.dataset.n)};
  fl();
  const mark=()=>{const v=$('#dl').value.trim().toLowerCase();document.querySelectorAll('#chips .chip').forEach(c=>c.classList.toggle('on',c.dataset.n.toLowerCase()===v))};mark();
  $('#dl').oninput=mark;
  $('#scc').value=/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff5a36';
  const smark=()=>{document.querySelectorAll('#scw .swb').forEach(b=>b.classList.toggle('on',(b.dataset.c||'').toLowerCase()===(d.color||'').toLowerCase()));$('#scw .swc').classList.toggle('on',!!d.color&&!PAL.some(c=>c.toLowerCase()===d.color.toLowerCase()))};smark();
  $('#scw').onclick=e=>{const b=e.target.closest('.swb');if(!b)return;d.color=b.dataset.c||null;smark()};
  $('#scc').oninput=e=>{d.color=e.target.value;smark()};
  $('#chips').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;$('#dl').value=c.dataset.n;mark()};
  const close=v=>{closeOv();res(v)};
  $('#dp').onclick=()=>$('#si').click();
  $('#dmk').onclick=async()=>{const f=await covMaker({title:$('#dn').value,sub:$('#da').value,color:d.color});if(!f)return;const r=await makeCover(f);if(!r)return cvFail('Could not make the cover');d.cover=r.data;d.ccol=r.color;d.keep=true;d.cm=null;d.cmedia=null;$('#dt').innerHTML=thumb()};
  $('#dr').onclick=()=>{d.cover=null;d.ccol=null;d.cm=null;d.cmedia=null;$('#dt').innerHTML=thumb()};
  $('#si').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=await makeCoverX(f);if(!r)return cvFail('Could not read that image');d.cover=r.data;d.ccol=r.color;d.keep=true;d.cm=mdPrev(r);d.cmedia=null;$('#dt').innerHTML=thumb()};
  $('#dkp').onclick=()=>{d.keep=!d.keep;$('#dt').innerHTML=thumb()};
  $('#dc').onclick=()=>close();
  $('#drf').onclick=()=>{close();replaceAudio(s)};
  $('#dtm').onclick=()=>{close();trimSheet(s)};
  $('#ds').onclick=async()=>{
    s.name=$('#dn').value.trim()||s.name;s.artist=$('#da').value.trim();
    {const pend=($('#dfi').value||'').replace(/\s+/g,' ').trim();if(pend&&!d.feat.some(f=>sameArt(f,pend)))d.feat.push(pend)}
    s.feat=d.feat.filter(x=>!sameArt(x,s.artist));
    const an_=$('#dl').value.trim();let nb=null;
    if(an_){const ex=albums.find(a=>a.name.toLowerCase()===an_.toLowerCase());nb=ex?ex.id:newAlbum(an_).id}
    if(nb!==(s.album||null)){s.album=nb;s.pos=Date.now()}
    {const rc=normRec($('#drc').value);if(rc)s.rec=rc;else delete s.rec}
    const old=s.cmedia&&s.cmedia.id,ref=await medCommit(d);s.cover=d.cover;s.ccol=d.ccol;s.color=d.color;if(d.keep&&d.cover)s.keepcov=true;else delete s.keepcov;if(ref)s.cmedia=ref;else delete s.cmedia;await put('songs',s);if(cur===s.id)setSession(s);close();medGC([old]);
  };
  $('#ov').onclick=e=>{if(e.target.id==='ov')close()};
})}
async function songMenu(id,plId){
  const s=songById(id);if(!s)return;
  const pl0=plId?plGet(plId):null;
  const items=[{label:'Play next',value:'next',ic:'next'},{label:'Add to queue',value:'queue',ic:'qm'},
    {label:'Add to playlist',value:'toplaylist',ic:'addpl',gap:1},{label:'Add to album',value:'move',ic:'album'}];
  if(LIKE.on){items[0].gap=1;items.unshift({label:s.liked?'Remove from Liked Songs':'Add to Liked Songs',value:'like',ic:s.liked?'likeOn':'likeOff',gap:0})}
  if(pl0&&!pl0.sys)items.push({label:'Remove from this playlist',value:'plrm',ic:'minus'});
  if(s.album)items.push({label:'Remove from album',value:'unalbum',ic:'unalb'});
  const cvT=!s.cover?null:pl0&&!pl0.sys?{o:pl0,st:'playlists',w:'playlist'}:(view.tab==='albums'&&view.album&&albums.find(x=>x.id===view.album)?{o:albums.find(x=>x.id===view.album),st:'albums',w:'album'}:null);
  if(cvT)items.push({label:'Use as '+cvT.w+' cover',value:'usecover',ic:'album',gap:1});
  items.push({label:'Share song',value:'sharelink',ic:'share',gap:cvT?0:1});items.push({label:'Export song',value:'share',ic:'plist',gap:0});items.push({label:'Edit details',value:'edit',ic:'pencil',gap:0});items.push({label:'Replace audio file',value:'replacefile',ic:'swaph',gap:0});items.push({label:'Trim & loop',value:'trim',ic:'cut',gap:0});items.push({label:'Sync lyrics',value:'lyedit',ic:'mic',gap:0});
  items.push({label:pl0?'Delete from library':'Delete song',value:'delete',danger:true,ic:'trash',gap:1});
  const r=await choose(s.name,items);
  if(r==='like')await toggleLike(id);
  if(r==='next')qadd(id,true);
  if(r==='queue')qadd(id,false);
  if(r==='usecover'&&cvT){const old=cvT.o.cmedia&&cvT.o.cmedia.id;cvT.o.cover=s.cover;if(cvT.st==='albums')cvT.o.ccol=s.ccol||null;if(s.cmedia)cvT.o.cmedia=Object.assign({},s.cmedia);else delete cvT.o.cmedia;await put(cvT.st,cvT.o);toast('Updated '+cvT.w+' cover');medGC([old])}
  if(r==='edit')await editSong(s);
  if(r==='replacefile')replaceAudio(s);
  if(r==='trim')trimSheet(s);
  if(r==='lyedit')lsOpen(id);
  if(r==='share')exportSong(s);
  if(r==='sharelink')shareSong(s);
  if(r==='move')await moveSong(s);
  if(r==='unalbum'){
    const ab=albums.find(x=>x.id===s.album);
    if(!await confirmBox('Remove from album?','\u201c'+esc(s.name)+'\u201d will be taken out of '+(ab?'\u201c'+esc(ab.name)+'\u201d':'its album')+'. The song stays in your library.','Remove'))return;
    const prev=s.album;s.album=null;await put('songs',s);
    uPush('Removed "'+s.name+'" from its album',async()=>{const x=songById(id);if(x){x.album=prev;await put('songs',x)}});toast('Removed from album. Undo is in Settings')}
  if(r==='toplaylist')await addToPlaylist([id]);
  if(r==='plrm'&&pl0){
    if(!await confirmBox('Remove from playlist?','\u201c'+esc(s.name)+'\u201d will be taken out of \u201c'+esc(pl0.name)+'\u201d. The song stays in your library.','Remove'))return;
    await rowOut(id);const old=(pl0.songs||[]).slice(),pid=pl0.id;pl0.songs=old.filter(x=>x!==id);await put('playlists',pl0);
    uPush('Removed "'+s.name+'" from "'+pl0.name+'"',async()=>{const p=playlists.find(x=>x.id===pid);if(p){p.songs=old;await put('playlists',p)}});toast('Removed from '+pl0.name+'. Undo is in Settings')}
  if(r==='delete'){
    if(!await confirmBox('Delete \u201c'+esc(s.name)+'\u201d?','It will be removed from your library, playlists and the queue. You can undo it from Settings until you close the app.','Delete'))return;
    await rowOut(id);
    const sn=snapSongs([id]);await dropSongs([id]);
    uPush('Deleted song "'+s.name+'"',()=>restoreSongs(sn));toast('Deleted. Undo is in Settings');
  }
  render();
}
function pickSheet(title,cand,onAdd){
  const sel=new Set();
  openOv(`<h3>${esc(title)}</h3><div class="pkh"><input type="text" id="pks" placeholder="Search songs" autocomplete="off"><button class="pill" id="pka">All</button></div><div class="pl pc" id="pkl"></div><div class="bt"><button class="pill" id="pkc">Cancel</button><button class="pill acc" id="pko" disabled>Add</button></div>`);
  const L=$('#pkl'),B=$('#pko'),F=()=>{const q=fold($('#pks').value.trim());return q?cand.filter(s=>fold(s.name+' '+artOf(s)).includes(q)):cand};
  const cnt=()=>{B.disabled=!sel.size;B.textContent=sel.size?'Add '+sel.size:'Add'};
  const draw=()=>{const l=F();L.innerHTML=l.length?l.map(s=>`<div class="pr" data-id="${s.id}"><span class="ck ${sel.has(s.id)?'on':''}">${sel.has(s.id)?ic('check',14):''}</span><span class="pn">${esc(s.name)}</span><small>${esc(artOf(s))}</small></div>`).join(''):'<div class="dupn">No matches</div>';cnt()};
  draw();
  L.onclick=e=>{const r=e.target.closest('.pr');if(!r)return;const id=r.dataset.id;sel.has(id)?sel.delete(id):sel.add(id);const on=sel.has(id),ck=r.querySelector('.ck');ck.classList.toggle('on',on);ck.innerHTML=on?ic('check',14):'';cnt()};
  $('#pks').oninput=draw;
  $('#pka').onclick=()=>{const l=F();l.every(s=>sel.has(s.id))?l.forEach(s=>sel.delete(s.id)):l.forEach(s=>sel.add(s.id));draw()};
  $('#pkc').onclick=()=>closeOv();
  $('#pko').onclick=()=>{const ids=[...sel];closeOv();if(ids.length)onAdd(ids)};
}
function pickSongs(albumId){
  const cand=songs.filter(s=>s.album!==albumId),a=albums.find(x=>x.id===albumId);
  if(!cand.length)return toast('No other songs in your library');
  pickSheet('Add to '+(a?a.name:'album'),cand,async ids=>{let t=Date.now();for(const id of ids){const s=songById(id);if(s){s.album=albumId;s.pos=t++;await put('songs',s)}}toast(`Added ${ids.length} ${ids.length===1?'song':'songs'}`);render()});
}
async function addAllElsewhere(ids){
  if(!ids.length)return toast('No songs to add');
  const n=ids.length,t=await choose('Add '+n+(n===1?' song':' songs')+' to',[{label:'A playlist',value:'pl',ic:'plist'},{label:'Another album',value:'al',ic:'album'},{label:'Queue',value:'q',ic:'qm'}]);
  if(t==='pl')await addToPlaylist(ids);
  else if(t==='al')await bulkAlbum(ids);
  else if(t==='q')qaddMany(ids,false);
  render();
}

/* reorder albums/playlists inside a folder */
function reorderSheet(P){
  const fid=P?view.pf:view.folder,items=P?playlists:albums,st=P?'playlists':'albums';
  let list=items.filter(x=>(x.folderId||null)===fid).sort(byOrd);if(list.length<2)return toast('Nothing to reorder');
  openOv(`<h3>Reorder ${P?'playlists':'albums'}</h3><p class="dupn" style="margin-bottom:6px">Drag the handle or use the arrows.</p><div id="rolist"></div><div class="bt"><button class="pill acc" id="rod">Done</button></div>`);
  const L=$('#rolist');
  const draw=()=>{L.innerHTML=list.map((x,i)=>`<div class="rord" data-id="${x.id}"><span class="th">${P?plCover(x):cover(x)}</span><span class="nm">${esc(x.name)}</span><button class="mv" data-d="-1" ${i===0?'disabled':''} aria-label="Move up">${ic('up',20)}</button><button class="mv" data-d="1" ${i===list.length-1?'disabled':''} aria-label="Move down" style="transform:rotate(180deg)">${ic('up',20)}</button><span class="hd" aria-label="Drag">${ic('reorder',22)}</span></div>`).join('')};
  const save=async()=>{for(let i=0;i<list.length;i++){list[i].ord=i;await put(st,list[i])}};
  draw();
  L.onclick=async e=>{const b=e.target.closest('.mv');if(!b||b.disabled)return;const id=b.closest('.rord').dataset.id,i=list.findIndex(x=>x.id===id),j=i+ +b.dataset.d;if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];draw();await save()};
  let dg=null;
  L.onpointerdown=e=>{const h=e.target.closest('.hd');if(!h)return;e.preventDefault();dg=h.closest('.rord');dg.classList.add('dragging');try{L.setPointerCapture(e.pointerId)}catch(_){}};
  L.onpointermove=e=>{if(!dg)return;const t=document.elementFromPoint(e.clientX,e.clientY),o=t&&t.closest?t.closest('.rord'):null;if(!o||o===dg||o.parentNode!==L)return;const k=[...L.children];k.indexOf(dg)<k.indexOf(o)?o.after(dg):o.before(dg)};
  const up=async()=>{if(!dg)return;dg.classList.remove('dragging');dg=null;const ids=[...L.children].map(r=>r.dataset.id);list=ids.map(id=>list.find(x=>x.id===id));draw();await save()};
  L.onpointerup=up;L.onpointercancel=up;
  $('#rod').onclick=()=>{closeOv();render()};
  $('#ov').onclick=e=>{if(e.target.id==='ov'){closeOv();render()}};
}
/* actions: folders */
function folderForm(f,P){return new Promise(res=>{
  const isNew=!f,d={name:f?f.name:'',color:f?f.color:PAL[(P?pfolders:folders).length%PAL.length],cover:f&&f.cover||null,cmedia:f&&f.cmedia||null,cm:null,op:f&&f.copac!=null?f.copac:1};
  openOv(`<h3>${isNew?'New folder':'Customize folder'}</h3><label for="fn">Name</label><input type="text" id="fn" maxlength="60" placeholder="Folder name"><label>Accent color</label>
  <div class="sw" id="sw">${PAL.map(c=>`<button type="button" class="swb" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="swc" aria-label="Custom color"><input type="color" id="fcc">${ic('palette',16)}</label></div>
  <label>Cover</label><div class="fcrow"><div class="fpv" id="fpv"></div><div class="fcb"><button type="button" class="pill" id="fca"></button><button type="button" class="pill" id="fcr">Delete cover</button><input type="file" id="fci" accept="image/*,video/*" hidden><div class="fop" id="fop"><span>Opacity</span><input type="range" class="rng" id="fco" min="0" max="100"><b id="fcv"></b></div></div></div>
  <div class="bt">${isNew?'':'<button class="pill mr" id="fd">Delete</button>'}<button class="pill" id="fx">Cancel</button><button class="pill acc" id="fs">Save</button></div>`);
  $('#fn').value=d.name;
  const pv=()=>{$('#fpv').innerHTML=folderTile({id:f?f.id:'',color:d.color,cover:d.cover,cmedia:d.cm||d.cmedia,copac:d.op},P);$('#fca').textContent=d.cover?'Change cover':'Add cover';$('#fcr').style.display=d.cover?'':'none';$('#fop').classList.toggle('off',!d.cover);const o=Math.round(d.op*100);$('#fco').value=o;$('#fco').style.setProperty('--p',o+'%');$('#fcv').textContent=o+'%'};
  $('#fca').onclick=()=>$('#fci').click();
  $('#fci').onchange=async e=>{const fl=e.target.files[0];e.target.value='';if(!fl)return;const r=await makeCoverX(fl);if(!r)return cvFail('Could not read that image');d.cover=r.data;d.cm=mdPrev(r);d.cmedia=null;pv()};
  $('#fcr').onclick=()=>{d.cover=null;d.cm=null;d.cmedia=null;pv()};
  $('#fco').oninput=e=>{d.op=e.target.value/100;pv()};$('#fcc').value=/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#ff5a36';
  const mark=()=>{document.querySelectorAll('#sw .swb').forEach(b=>b.classList.toggle('on',b.dataset.c.toLowerCase()===d.color.toLowerCase()));$('#sw .swc').classList.toggle('on',!PAL.some(c=>c.toLowerCase()===d.color.toLowerCase()));pv()};mark();
  $('#sw').onclick=e=>{const b=e.target.closest('.swb');if(!b)return;d.color=b.dataset.c;mark()};
  $('#fcc').oninput=e=>{d.color=e.target.value;mark()};
  const close=v=>{closeOv();res(v)};
  $('#fx').onclick=()=>close();
  $('#fs').onclick=async()=>{
    d.name=$('#fn').value.trim()||'Untitled folder';
    const ref=await medCommit(d);
    if(isNew){const nf={id:uid(),name:d.name,color:d.color,cover:d.cover,copac:d.op};if(ref)nf.cmedia=ref;(P?pfolders:folders).push(nf);await put(P?'pfolders':'folders',nf);close(nf)}
    else{const old=f.cmedia&&f.cmedia.id;f.name=d.name;f.color=d.color;f.cover=d.cover;f.copac=d.op;if(ref)f.cmedia=ref;else delete f.cmedia;await put(P?'pfolders':'folders',f);close(f);medGC([old])}
  };
  if(!isNew)$('#fd').onclick=async()=>{
    closeOv();
    const r=await choose('Delete "'+f.name+'"?',[{label:P?'Delete folder, keep playlists':'Delete folder, keep albums',value:1,danger:true}]);
    if(r)await delFolderP(f,P);
    res(null);
  };
  $('#ov').onclick=e=>{if(e.target.id==='ov')close()};
})}

/* ===== playlists: songs are referenced by id, so adding to a playlist never removes them from their album ===== */
const plSongs=id=>{const p=plGet(id);if(!p)return [];const m=new Map(songs.map(s=>[s.id,s]));return (p.songs||[]).map(i=>m.get(i)).filter(Boolean)};
const mcell=sc=>{
  if(safeImg(sc.cover))return `<img src="${safeImg(sc.cover)}" alt="" loading="lazy" decoding="async">`;
  const n=sc.name||'?',h=hue(n),bg=sc.color?`linear-gradient(160deg,rgba(255,255,255,.2),rgba(0,0,0,.3)),${sc.color}`:`linear-gradient(135deg,hsl(${h} 60% 45%),hsl(${(h+50)%360} 65% 30%))`;
  return `<i class="pmc" style="background:${bg}">${esc(n.trim().charAt(0).toUpperCase())}</i>`;
};
function plCover(p,live){
  if(p.cover)return cover({cover:p.cover,name:p.name,cmedia:p.cmedia},undefined,live);
  if(!p.color){
    const l=plSongs(p.id);
    if(l.length){
      const seen=new Set(),u=[];
      for(const s of l){const sc=songCover(s),k=sc.id||((sc.cover?sc.cover.length+sc.cover.slice(-30):'')+'|'+sc.name+'|'+(sc.color||''));if(!seen.has(k)){seen.add(k);u.push(sc)}}
      if(u.length>=4)return `<div class="cov pm"><div class="pmos">${u.slice(0,4).map(mcell).join('')}</div></div>`;
      return cover(u[0],l[0].name);
    }
  }
  return cover({name:p.name,color:p.color});
}
const pfoldCard=f=>{const n=playlists.filter(p=>p.folderId===f.id).length;return `<div class="fcard" data-fid="${f.id}"><button class="card" data-act="openpf" data-id="${f.id}">${folderTile(f,true)}<b>${esc(f.name)}</b><span>${n} ${n===1?'playlist':'playlists'}</span></button><button class="fm" data-act="pfmenu" data-id="${f.id}" aria-label="Folder options">${ic('dots',22)}</button></div>`};
function renderPlaylists(m){
  if(rotOn)rotBuild();
  if(view.pl&&plGet(view.pl))return renderPlaylist(m);
  const inF=view.pf?pfolders.find(f=>f.id===view.pf):null;
  const list=playlists.filter(p=>(p.folderId||null)===(inF?inF.id:null)).sort(byOrd);
  if(!inF)$('#fb').innerHTML=szBar(list.length);
  if(inF)$('#fb').innerHTML=fbar('Playlists',inF.name,`${list.length} ${list.length===1?'playlist':'playlists'}`,fszBtns()+`<span class="ftl">`+gBtn(list.length)+`<button class="ab" data-act="fmore" aria-haspopup="dialog" aria-label="More folder options" title="More">${ic('dots',22)}</button></span>`);
  let h=gridOpen()+(inF||!LIKE.on?'':likedCard())+(inF||!rotOn?'':rotCard())+(inF?'':pfolders.map(pfoldCard).join(''))+
    list.map(p=>{const n=plSongs(p.id).length;return `<div class="acard${gMode&&gSet.has(p.id)?' gon':''}" data-gid="${p.id}">${gMode?`<span class="gck">${gSet.has(p.id)?ic('check',15):''}</span>`:''}<button class="card" data-act="openpl" data-id="${p.id}">${plCover(p)}<b>${esc(p.name)}</b><span>${n} ${n===1?'song':'songs'}</span></button><button class="alm" data-act="plcard" data-id="${p.id}" aria-label="Playlist options">${ic('dots',20)}</button></div>`}).join('')+'</div>';
  if(!list.length&&(inF||!pfolders.length)&&!((rotOn||LIKE.on)&&!inF))h+=`<div class="empty">${inF?'This folder is empty.<br>Tap + to create a playlist here.':'No playlists yet.<br>Tap + to create a playlist or a folder.<br>Songs you add stay in their albums.'}</div>`;
  m.innerHTML=h;
}
function renderPlaylist(m){
  const p=plGet(view.pl),list=plSongs(p.id),tot=list.reduce((n,s)=>n+effDur(s),0);
  $('#fb').innerHTML=`<div class="abar"><button class="back" data-act="back" aria-label="Back">${ic('arrow',26)}</button><div class="abtns">${p.sys?'':`<button class="ab" data-act="pladd" data-id="${p.id}" aria-label="Add songs" title="Add songs">${ic('addpl',22)}</button>`}<button class="ab" data-act="plqueue" data-id="${p.id}" aria-label="Add playlist to queue" title="Add playlist to queue">${ic('qm',21)}</button>${p.sys?'':`<button class="ab${selMode?' acc':''}" data-act="select" aria-label="Select songs" title="Select songs">${ic('sel',21)}</button><button class="ab" data-act="plmenu" data-id="${p.id}" aria-label="More options" title="More">${ic('dots',22)}</button>`}</div></div>`;
  m.innerHTML=`<div class="acv">${plCover(p,true)}</div>
  <div class="at"><h2>${esc(p.name)}</h2><button class="ib sh" data-act="plshuf" data-id="${p.id}" aria-label="Shuffle play">${ic('shuffle',22)}</button><button class="pbig" data-act="plplay" data-id="${p.id}" aria-label="Play">${ic('play',26)}</button></div>
  <p class="am">${[list.length+(list.length===1?' track':' tracks'),tot?Math.max(1,Math.round(tot/60))+' min':''].filter(Boolean).join(' \u00b7 ')}</p>${p.desc?`<p class="am" style="margin-top:-8px">${esc(p.desc)}</p>`:''}`+
    '<div class="rl">'+(list.length?list.map((s,i)=>rowHtml(s,i,true)).join(''):(p.sys?(p.id===LIKEID?'<div class="empty">No liked songs yet.<br>Tap the heart on a song to add it here.</div>':'<div class="empty">Nothing here yet.<br>Songs you play often will show up in Rotation on their own.</div>'):'<div class="empty">This playlist is empty.<br>Use the add songs button, or choose Add to playlist on any song.</div>'))+'</div>';
}
function plForm(p,fid){return new Promise(res=>{
  const isNew=!p,d={color:p?p.color||null:null,cover:p?p.cover||null:null,cmedia:p&&p.cmedia||null,cm:null};
  openOv(`<h3>${isNew?'New playlist':'Customize playlist'}</h3><div class="cvrow"><div class="thumb" id="lpt"></div><div class="cvb"><button type="button" class="pill" id="lpc"></button><button type="button" class="pill" id="lpm">Make cover</button><button type="button" class="pill" id="lpp">Crop and position</button><button type="button" class="pill" id="lpr">Remove cover</button></div></div>
  <label for="lpn">Name</label><input type="text" id="lpn" maxlength="80" placeholder="Playlist name" autocomplete="off">
  <label for="lpd">Description (optional)</label><input type="text" id="lpd" maxlength="140" placeholder="What is this playlist for?" autocomplete="off">
  <label>Color (automatic uses your songs' covers)</label><div class="sw" id="lpw"><button type="button" class="swb auto" data-c="" aria-label="Automatic color">${ic('close',14)}</button>${PAL.map(c=>`<button type="button" class="swb" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="swc" aria-label="Custom color"><input type="color" id="lpk">${ic('palette',16)}</label></div>
  <div class="bt">${isNew?'':'<button class="pill mr" id="lpx">Delete</button>'}<button class="pill" id="lpq">Cancel</button><button class="pill acc" id="lps">Save</button></div>`);
  $('#lpn').value=p?p.name:'';$('#lpd').value=p&&p.desc||'';
  $('#lpk').value=/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#ff5a36';
  const pv=()=>{$('#lpt').innerHTML=plCover({id:p?p.id:'__new',name:$('#lpn').value.trim()||'Playlist',color:d.color,cover:d.cover,cmedia:d.cm||d.cmedia},true);$('#lpc').textContent=d.cover?'Change cover':'Import cover';$('#lpr').style.display=d.cover?'':'none';$('#lpp').style.display=d.cover&&!d.cm&&!d.cmedia?'':'none'};
  const mark=()=>{document.querySelectorAll('#lpw .swb').forEach(b=>b.classList.toggle('on',(b.dataset.c||'').toLowerCase()===(d.color||'').toLowerCase()));$('#lpw .swc').classList.toggle('on',!!d.color&&!PAL.some(c=>c.toLowerCase()===d.color.toLowerCase()));pv()};mark();
  $('#lpw').onclick=e=>{const b=e.target.closest('.swb');if(!b)return;d.color=b.dataset.c||null;mark()};
  $('#lpk').oninput=e=>{d.color=e.target.value;mark()};
  $('#lpn').oninput=pv;
  $('#lpc').onclick=()=>$('#pi').click();
  $('#lpm').onclick=async()=>{const f=await covMaker({title:$('#lpn').value,sub:'',color:d.color});if(!f)return;const r=await makeCover(f);if(!r)return cvFail('Could not make the cover');d.cover=r.data;d.orig=null;d.cm=null;d.cmedia=null;pv()};
  $('#lpr').onclick=()=>{d.cover=null;d.orig=null;d.cm=null;d.cmedia=null;pv()};
  $('#lpp').onclick=async()=>{let src=d.orig;if(!src){try{src=await(await fetch(d.cover)).blob()}catch(e){return toast('Could not open that cover')}}
    const cr=await cropSheet(src,'img',1,d.orig?d.oc:null);if(!cr)return;const b=cr.def?src:await cropBake(src,1,1024,cr),r=b&&await makeCover(b);if(!r)return cvFail('Could not crop that cover');d.cover=r.data;if(d.orig)d.oc=cropPack(cr);pv()};
  $('#pi').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=await makeCoverX(f);if(!r)return cvFail('Could not read that image');d.cover=r.data;d.orig=r.orig||null;d.oc=r.c||null;d.cm=mdPrev(r);d.cmedia=null;pv()};
  const close=v=>{closeOv();res(v)};
  $('#lpq').onclick=()=>close(null);
  $('#lps').onclick=async()=>{
    const name=$('#lpn').value.trim()||'Untitled playlist',desc=$('#lpd').value.trim();
    const ref=await medCommit(d);
    if(isNew){const np={id:uid(),name,desc,color:d.color,cover:d.cover,folderId:fid||null,songs:[],added:Date.now()};if(ref)np.cmedia=ref;playlists.push(np);await put('playlists',np);close(np)}
    else{const old=p.cmedia&&p.cmedia.id;p.name=name;p.desc=desc;p.color=d.color;p.cover=d.cover;if(ref)p.cmedia=ref;else delete p.cmedia;await put('playlists',p);close(p);medGC([old])}
  };
  if(!isNew)$('#lpx').onclick=async()=>{closeOv();await plDelete(p);res(null)};
  $('#lpn').onkeydown=e=>{if(e.key==='Enter')$('#lps').click()};
  $('#ov').onclick=e=>{if(e.target.id==='ov')close(null)};
  setTimeout(()=>{const i=$('#lpn');i.focus();i.select()},60);
})}
async function addToPlaylist(ids){
  ids=ids.filter(id=>songs.some(s=>s.id===id));if(!ids.length)return false;
  const opts=playlists.map(p=>{const f=p.folderId?pfolders.find(x=>x.id===p.folderId):null;return {label:(f?f.name+' \u00b7 ':'')+p.name,value:p.id,pl:p}});
  opts.push({label:'New playlist',value:'__new',plus:true});
  const t=await choose(ids.length===1?'Add to playlist':'Add '+ids.length+' songs to playlist',opts);
  if(!t)return false;
  let p;
  if(t==='__new'){p=await plForm(null,null);if(!p)return false}else p=playlists.find(x=>x.id===t);
  if(!p)return false;
  const have=new Set(p.songs||[]);let n=0;p.songs=p.songs||[];
  for(const id of ids)if(!have.has(id)){p.songs.push(id);have.add(id);n++}
  if(n)await put('playlists',p);
  toast(n?`Added ${n} ${n===1?'song':'songs'} to ${p.name}`:'Already in '+p.name);
  return true;
}
function pickForPlaylist(pid){
  const p=playlists.find(x=>x.id===pid);if(!p)return;
  const have=new Set(p.songs||[]),cand=songs.filter(s=>!have.has(s.id));
  if(!cand.length)return toast(songs.length?'All your songs are already here':'No songs in your library');
  pickSheet('Add to '+p.name,cand,async ids=>{p.songs=(p.songs||[]).concat(ids.filter(id=>!have.has(id)));await put('playlists',p);toast(`Added ${ids.length} ${ids.length===1?'song':'songs'}`);render()});
}
async function plMove(p){
  const opts=[{label:'No folder',value:'__none',sel:!p.folderId}].concat(pfolders.map(f=>({label:f.name,value:f.id,sel:f.id===p.folderId})));opts.push({label:'New folder',value:'__new'});
  const r=await choose('Move to folder',opts);
  if(r==='__new'){const f=await folderForm(null,true);if(f){p.folderId=f.id;await put('playlists',p)}}
  else if(r==='__none'){p.folderId=null;await put('playlists',p)}
  else if(r){p.folderId=r;await put('playlists',p)}
}
/* ---- confirm box and library undo ----
   Every delete / remove below records how to put things back. Settings has an Undo button that replays the newest entry.
   The history lives until the app is closed (deleted songs keep their audio in memory so they can come back). */
function confirmBox(title,msg,ok){return new Promise(res=>{
  openOv(`<h3>${esc(title)}</h3><p class="dupn" style="margin:2px 6px 14px">${msg}</p><div class="bt"><button type="button" class="pill" id="cfc">Cancel</button><button type="button" class="pill dgr" id="cfo">${esc(ok||'Remove')}</button></div>`);
  const done=v=>{closeOv();res(v)};
  $('#cfc').onclick=()=>done(false);$('#cfo').onclick=()=>done(true);
  $('#ov').onclick=e=>{if(e.target.id==='ov')done(false)};
})}
const uHist=[];
function uPush(label,run){uHist.push({label,run});if(uHist.length>10)uHist.shift();uPaint()}
function uPaint(){
  const top=uHist[uHist.length-1];
  document.querySelectorAll('[data-uundo]').forEach(b=>{b.disabled=!top;b.title=top?'Undo: '+top.label:'Nothing to undo'});
  const l=document.getElementById('st-ulab');if(l)l.textContent=top?top.label+(uHist.length>1?' ('+uHist.length+' steps)':''):'Nothing to undo';
}
async function uUndo(){
  const x=uHist.pop();uPaint();if(!x)return toast('Nothing to undo');
  try{await x.run();toast('Undone: '+x.label)}catch(e){toast('Could not undo')}
  uPaint();try{render()}catch(_){}
}
const untomb=(st,id)=>{const t=tomb();if(t[st+':'+id]){delete t[st+':'+id];LS('tracks-tomb',JSON.stringify(t))}};
function snapSongs(ids){
  const set=new Set(ids);
  return {songs:songs.filter(x=>set.has(x.id)),pls:playlists.filter(p=>(p.songs||[]).some(i=>set.has(i))).map(p=>({id:p.id,songs:p.songs.slice()}))};
}
async function restoreSongs(sn){
  for(const x of sn.songs)if(!songs.some(y=>y.id===x.id)){untomb('songs',x.id);songs.push(x);await put('songs',x)}
  for(const o of sn.pls){const p=playlists.find(y=>y.id===o.id);if(p){p.songs=o.songs.slice();await put('playlists',p)}}
}
async function dropSongs(ids){
  const set=new Set(ids);
  for(const id of ids)await del('songs',id);
  await purgePl(ids);
  songs=songs.filter(x=>!set.has(x.id));queue=queue.filter(x=>!set.has(x));upNext=upNext.filter(x=>!set.has(x));
  if(set.has(cur)){au.pause();au.removeAttribute('src');cur=null;closeFull()}
}
async function plDelete(p){
  const ids=(p.songs||[]).filter(i=>songById(i)),n=ids.length;
  const opts=[{label:'Delete playlist, keep songs',value:'keep',danger:true}];
  if(n&&!p.sys)opts.push({label:'Delete playlist and its '+n+(n===1?' song':' songs'),value:'all',danger:true});
  const r=await choose('Delete "'+p.name+'"?',opts);
  if(!r)return;
  if(r==='all'&&!await confirmBox('Delete '+n+(n===1?' song':' songs')+' too?','This removes '+(n===1?'the song':'these songs')+' from your library, from other playlists and from the queue. You can undo it from Settings until you close the app.','Delete all'))return;
  const pc=Object.assign({},p,{songs:(p.songs||[]).slice()}),sn=r==='all'?snapSongs(ids):null;
  playlists=playlists.filter(x=>x.id!==p.id);await del('playlists',p.id);
  if(view.pl===p.id){view.pl=null;view.pf=p.folderId||null}
  if(sn)await dropSongs(ids);
  uPush(r==='all'?'Deleted playlist "'+p.name+'" and its songs':'Deleted playlist "'+p.name+'"',async()=>{
    untomb('playlists',pc.id);if(!playlists.some(x=>x.id===pc.id))playlists.push(pc);await put('playlists',pc);
    if(sn)await restoreSongs(sn);
  });
  toast(r==='all'?'Deleted playlist and songs. Undo is in Settings':'Deleted playlist. Undo is in Settings');
}
async function plMenu(id,card){
  const p=playlists.find(x=>x.id===id);if(!p)return;
  const r=await choose(p.name,[{label:'Customize',value:'c'},{label:'Add songs',value:'add'},{label:'Move to folder',value:'mv'},{label:'Add all songs elsewhere',value:'else',ic:'addpl'},{label:'Share playlist',value:'shareplaylist',ic:'share'},...(card?[]:[{label:'Sleep timer',value:'sleep',ic:'clock'}]),{label:'Delete playlist',value:'d',danger:true}]);
  if(r==='c')await plForm(p);
  if(r==='add')pickForPlaylist(id);
  if(r==='mv')await plMove(p);
  if(r==='else')await addAllElsewhere(plSongs(id).map(s=>s.id));
  if(r==='sleep')await sleepMenu();
  if(r==='shareplaylist'){shareColl('playlist',p);return}
  if(r==='d')await plDelete(p);
  render();
}
async function delFolderP(f,P){
  const items=P?playlists:albums,st=P?'playlists':'albums';
  for(const a of items)if(a.folderId===f.id){a.folderId=null;await put(st,a)}
  if(P){pfolders=pfolders.filter(x=>x.id!==f.id);await del('pfolders',f.id);if(view.pf===f.id)view.pf=null}
  else{folders=folders.filter(x=>x.id!==f.id);await del('folders',f.id);if(view.folder===f.id)view.folder=null}
}
async function purgePl(ids){
  const set=new Set(ids);
  for(const p of playlists)if((p.songs||[]).some(id=>set.has(id))){p.songs=p.songs.filter(id=>!set.has(id));await put('playlists',p)}
}


/* ===== END 10-actions.js ===== */


/* ===== BEGIN 11-gestures.js ===== */
/* search and filter */
function openSearch(){
  const sb=$('#sb');if(sb.classList.contains('open'))return;
  const w=$('#tb').clientWidth-40;$('#tb').classList.add('so');sb.classList.add('open');
  an(sb,[{width:'44px'},{width:w+'px'}],{duration:320,easing:EASE_OUT});$('#sq').focus();
}
function closeSearch(){
  const sb=$('#sb');if(!sb.classList.contains('open'))return;
  clearTimeout(sqT);$('#sq').value='';view.q='';$('#sq').blur();
  const a=an(sb,[{width:sb.offsetWidth+'px'},{width:'44px'}],{duration:260,easing:EASE,fill:'forwards'});
  const fin=()=>{sb.classList.remove('open');$('#tb').classList.remove('so');if(a)a.cancel()};
  if(a)a.onfinish=fin;else fin();
  render();
}

/* long press (750 ms) to reorder songs inside an album */
let noClick=0,hold=null,drag=null;
function cancelHold(){if(hold){clearTimeout(hold.t);hold=null}}
function renumber(){[...document.querySelectorAll('#main .row')].forEach((r,i)=>{const n=r.querySelector('.n');if(n)n.textContent=i+1})}
function place(x,y){
  const t=document.elementFromPoint(x,y),row=t&&t.closest?t.closest('.row'):null;
  if(row&&row!==drag.el&&row.parentNode===drag.el.parentNode){
    const r=row.getBoundingClientRect();
    const all=[...document.querySelectorAll('#main .row')],tops=all.map(q=>q.getBoundingClientRect().top);
    if(y<r.top+r.height/2)row.parentNode.insertBefore(drag.el,row);else row.parentNode.insertBefore(drag.el,row.nextSibling);
    all.forEach((q,i)=>{const d=tops[i]-q.getBoundingClientRect().top;if(!d)return;const isD=q===drag.el;an(q,[{transform:'translateY('+d+'px)'+(isD?' scale(1.02)':'')},{transform:isD?'scale(1.02)':'none'}],{duration:230,easing:EASE})});
    renumber();
  }
}
function startDrag(){
  if(!hold)return;
  drag={el:hold.el,x:hold.x,y:hold.y};hold=null;
  drag.el.classList.add('drag');
  if(navigator.vibrate)try{navigator.vibrate(30)}catch(e){}
  drag.iv=setInterval(()=>{
    const m=$('#main');
    if(drag.y<150)m.scrollTop-=10;else if(drag.y>innerHeight-240)m.scrollTop+=10;else return;
    place(drag.x,drag.y);
  },16);
}
function endDrag(){
  cancelHold();
  if(!drag)return;
  clearInterval(drag.iv);drag.el.classList.remove('drag');drag=null;noClick=Date.now()+500;
  if(view.tab==='playlists'&&view.pl){const p=playlists.find(x=>x.id===view.pl);if(p){const ids=[...document.querySelectorAll('#main .row')].map(r=>r.dataset.id);p.songs=ids.concat((p.songs||[]).filter(id=>!ids.includes(id)));put('playlists',p)}}
  else [...document.querySelectorAll('#main .row')].forEach((r,i)=>{const s=songById(r.dataset.id);if(s){s.pos=i;put('songs',s)}});
  toast('Order saved');
}
$('#main').addEventListener('pointerdown',e=>{
  if(selMode||view.pl===ROTID||view.pl===LIKEID||!(view.album||(view.tab==='playlists'&&view.pl))||e.target.closest('.k'))return;
  const el=e.target.closest('.row');if(!el)return;
  cancelHold();
  hold={el,x:e.clientX,y:e.clientY,t:setTimeout(startDrag,750)};
});
$('#main').addEventListener('contextmenu',e=>{if(e.target.closest('.row'))e.preventDefault()});
window.addEventListener('pointermove',e=>{
  if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10)cancelHold();
  if(!drag)return;
  drag.x=e.clientX;drag.y=e.clientY;place(drag.x,drag.y);
});
window.addEventListener('pointerup',endDrag);
window.addEventListener('pointercancel',endDrag);
document.addEventListener('touchmove',e=>{if((drag||ad)&&e.cancelable)e.preventDefault()},{passive:false});
/* Block Android pull-to-refresh: cancel downward swipes when the touched scroller is already at the top */
(()=>{let y0=0,sc=null;
const scroller=el=>{for(;el&&el!==document.documentElement;el=el.parentElement){
  if(el.scrollHeight>el.clientHeight+1){const o=getComputedStyle(el).overflowY;if(o==='auto'||o==='scroll')return el}}
  return null};
document.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;y0=e.touches[0].clientY;sc=scroller(e.target)},{passive:true});
document.addEventListener('touchmove',e=>{
  const dy=e.touches[0].clientY-y0;
  if(dy>0&&(!sc||sc.scrollTop<=0)&&e.cancelable)e.preventDefault();
},{passive:false});})();

/* swipe and hold to select many songs: hold a row (or drag from its checkbox), then slide up or down */
let ds=null;
const dsRows=()=>{flushRows();return [...document.querySelectorAll('#main .row[data-act="selrow"]')]};
function dsSet(r,on){if(selSet.has(r.dataset.id)===on)return;on?selSet.add(r.dataset.id):selSet.delete(r.dataset.id);const ck=r.querySelector('.ck');if(ck){ck.classList.toggle('on',on);ck.innerHTML=on?ic('check',14):''}}
function dsIndex(y){const R=ds.rows;let best=0,bd=1e9;for(let i=0;i<R.length;i++){const b=R[i].getBoundingClientRect();if(y>=b.top&&y<=b.bottom)return i;const d=Math.min(Math.abs(y-b.top),Math.abs(y-b.bottom));if(d<bd){bd=d;best=i}}return best}
function dsApply(){const i=dsIndex(ds.y),lo=Math.min(ds.a,i),hi=Math.max(ds.a,i);ds.rows.forEach((r,k)=>dsSet(r,k>=lo&&k<=hi?ds.mode:ds.base.has(r.dataset.id)));updateBar()}
function dsStart(){if(!ds||ds.on)return;ds.rows=dsRows();ds.a=ds.rows.indexOf(ds.row);if(ds.a<0){ds=null;return}ds.on=true;ds.base=new Set(selSet);ds.mode=!selSet.has(ds.row.dataset.id);dsApply();if(navigator.vibrate)navigator.vibrate(12);ds.raf=requestAnimationFrame(dsTick)}
function dsTick(){if(!ds||!ds.on)return;const m=$('#main').getBoundingClientRect(),bot=$('#selbar').getBoundingClientRect().top-24;let v=0;if(ds.y<m.top+80)v=-Math.min(18,(m.top+80-ds.y)/4+1);else if(ds.y>bot)v=Math.min(18,(ds.y-bot)/4+1);if(v){$('#main').scrollTop+=v;dsApply()}ds.raf=requestAnimationFrame(dsTick)}
function dsEnd(){if(!ds)return;clearTimeout(ds.t);cancelAnimationFrame(ds.raf);if(ds.on)noClick=Date.now()+350;ds=null}
$('#main').addEventListener('pointerdown',e=>{
  if(!selMode||e.target.closest('.k'))return;
  const row=e.target.closest('.row[data-act="selrow"]');if(!row)return;
  dsEnd();ds={row,sx:e.clientX,sy:e.clientY,y:e.clientY,on:false,fromCk:!!e.target.closest('.n'),t:setTimeout(dsStart,280)};
});
window.addEventListener('pointermove',e=>{
  if(!ds)return;ds.y=e.clientY;
  if(!ds.on&&Math.hypot(e.clientX-ds.sx,e.clientY-ds.sy)>7){if(ds.fromCk)dsStart();else{dsEnd();return}}
  if(ds&&ds.on)dsApply();
});
window.addEventListener('pointerup',dsEnd);window.addEventListener('pointercancel',dsEnd);
document.addEventListener('touchmove',e=>{if(ds&&ds.on&&e.cancelable)e.preventDefault()},{passive:false});
$('#main').addEventListener('contextmenu',e=>{if(selMode)e.preventDefault()});

/* swipe a song row to the right to add it to the queue (Spotify style): the row follows the finger, an accent strip with the queue icon
   shows behind it, and letting go past the threshold adds the song and snaps the row back. Swipes that start elsewhere still switch tabs. */
let rsw=null;
(()=>{
  const THR=72,MAXX=150,m=$('#main');
  const blocked=()=>selMode||drag||ad||ds||$('#ov').classList.contains('open')||$('#full').classList.contains('open')||qOpen;
  const soft=d=>d<=THR?d:Math.min(MAXX,THR+(d-THR)*.35);
  const clean=row=>{row.style.transition='';row.style.transform='';row.classList.remove('rsw','hit');const q=row.querySelector(':scope>.qsi');if(q)q.remove()};
  function back(row){
    if(RM.matches){clean(row);return}
    row.style.transition='transform .28s cubic-bezier(.22,.8,.24,1)';row.style.transform='translateX(0)';
    let done=false;const fin=()=>{if(done)return;done=true;clean(row)};
    row.addEventListener('transitionend',fin,{once:true});setTimeout(fin,380);
  }
  m.addEventListener('touchstart',e=>{
    rsw=null;
    if(e.touches.length!==1||blocked()||e.target.closest('.k'))return;
    const row=e.target.closest('.row[data-act="play"]');if(!row)return;
    rsw={row,x:e.touches[0].clientX,y:e.touches[0].clientY,h:false,v:false,hit:false,dx:0};
  },{passive:true});
  m.addEventListener('touchmove',e=>{
    const r=rsw;if(!r||r.v)return;
    const t=e.touches[0],dx=t.clientX-r.x,dy=t.clientY-r.y;
    if(!r.h){
      if(dx<-10||(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*.8)){r.v=true;return}
      if(!(dx>10&&dx>Math.abs(dy)*1.2))return;
      r.h=true;cancelHold();
      r.row.classList.add('rsw');r.row.style.transition='none';
      const q=document.createElement('span');q.className='qsi';q.innerHTML=ic('qm',22);r.row.appendChild(q);
    }
    if(e.cancelable)e.preventDefault();
    r.dx=Math.max(0,dx);
    r.row.style.transform='translateX('+soft(r.dx)+'px)';
    const hit=r.dx>=THR;
    if(hit!==r.hit){r.hit=hit;r.row.classList.toggle('hit',hit);if(hit&&navigator.vibrate)try{navigator.vibrate(12)}catch(_){}}
  },{passive:false});
  const end=cancel=>{
    const r=rsw;if(!r)return;
    if(r.h){
      noClick=Date.now()+450;
      const id=r.row.dataset.id,add=!cancel&&r.hit;
      back(r.row);
      if(add)qadd(id,false);
    }
    setTimeout(()=>{if(rsw===r)rsw=null});/* the tab swipe below still reads rsw during this same touchend */
  };
  m.addEventListener('touchend',()=>end(false),{passive:true});
  m.addEventListener('touchcancel',()=>end(true),{passive:true});
})();

/* swipe left/right on the list to switch between Albums and Songs */
(()=>{let t0=null;const m=$('#main');
m.addEventListener('touchstart',e=>{
  t0=null;if(e.touches.length!==1||e.target.closest('input,.chips,.k'))return;
  t0={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};
},{passive:true});
m.addEventListener('touchend',e=>{
  if(!t0)return;const t=e.changedTouches[0],dx=t.clientX-t0.x,dy=t.clientY-t0.y,dt=Date.now()-t0.t;t0=null;
  if(selMode||drag||ad||hold||ah||ds||(rsw&&rsw.h)||$('#ov').classList.contains('open')||$('#full').classList.contains('open')||qOpen)return;
  if(Math.abs(dx)<64||Math.abs(dx)<Math.abs(dy)*1.8||dt>700)return;
  const ti=TABS.indexOf(view.tab)+(dx<0?1:-1);if(ti<0||ti>=TABS.length)return;const to=TABS[ti];
  document.querySelector('[data-act=tab][data-t="'+to+'"]').click();
},{passive:true});
})();


/* swipe left = next song, swipe right = previous song, on the big player and on the mini player */
(()=>{
  let t0=null;
  const hs=el=>{for(;el&&el!==document.body;el=el.parentElement)if(el.scrollWidth>el.clientWidth+1){const o=getComputedStyle(el).overflowX;if(o==='auto'||o==='scroll')return true}return false};
  for(const sel of ['#full','#mini']){
    const h=$(sel);if(!h)continue;
    h.addEventListener('touchstart',e=>{
      t0=null;if(e.touches.length!==1||e.target.closest('input,canvas,button,textarea,select,a')||hs(e.target))return;
      t0={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};
    },{passive:true});
    h.addEventListener('touchend',e=>{
      if(!t0)return;const t=e.changedTouches[0],dx=t.clientX-t0.x,dy=t.clientY-t0.y,dt=Date.now()-t0.t;t0=null;
      if(!cur||Math.abs(dx)<56||Math.abs(dx)<Math.abs(dy)*1.6||dt>800)return;
      const d=dx<0?1:-1;step(d);
      if(sel==='#mini'){const m=$('#mini .m1');if(m)an(m,[{opacity:0,transform:`translateX(${d*28}px)`},{opacity:1,transform:'none'}],{duration:260,easing:EASE_OUT})}
    },{passive:true});
  }
})();

/* hold an album, drag it onto a folder (or onto Back to move it out of a folder) */
let ah=null,ad=null;
function acancel(){if(ah){clearTimeout(ah.t);ah=null}}
function amove(){
  const d=ad;d.g.style.transform=`translate3d(${d.x-d.ox}px,${d.y-d.oy}px,0) scale(1.08)`;
  const t=document.elementFromPoint(d.x,d.y),h=t&&t.closest?t.closest('.fcard,[data-act="back"]'):null;
  if(h!==d.hot){if(d.hot)d.hot.classList.remove('hot');if(h)h.classList.add('hot');d.hot=h}
  if(!h&&d.wrap)aplace(d);
}
/* inside a folder: dragging over another item swaps places with it (others slide out of the way) */
function aplace(d){
  if(Date.now()-d.last<220)return;
  const t=document.elementFromPoint(d.x,d.y),w=t&&t.closest?t.closest('.acard'):null;
  const ws=d.ws||[d.wrap];if(!w||ws.includes(w)||w.parentNode!==d.wrap.parentNode)return;
  const par=d.wrap.parentNode,kids=[...par.children],i=kids.indexOf(d.wrap),j=kids.indexOf(w);
  const before=kids.map(k=>k.getBoundingClientRect());
  let ref=j>i?w.nextSibling:w;while(ref&&ws.includes(ref))ref=ref.nextSibling;ws.forEach(x=>par.insertBefore(x,ref));
  kids.forEach((k,n)=>{if(ws.includes(k))return;const r=k.getBoundingClientRect(),dx=before[n].left-r.left,dy=before[n].top-r.top;if(dx||dy)an(k,[{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:240,easing:EASE})});
  d.moved=true;d.last=Date.now();
}
function astart(){
  if(!ah)return;
  const el=ah.el,cv=el.querySelector('.cov'),r=cv.getBoundingClientRect();
  const g=document.createElement('div');g.className='ghost';g.style.width=r.width+'px';g.style.height=r.height+'px';g.innerHTML=cv.outerHTML;
  document.body.appendChild(g);
  ad={el,g,id:el.dataset.id,w:r.width,h:r.height,x:ah.x,y:ah.y,ox:ah.x-r.left,oy:ah.y-r.top,hot:null,wrap:el.closest('.acard'),moved:false,last:0};ah=null;agroup(ad);
  el.style.opacity='.3';
  if(navigator.vibrate)try{navigator.vibrate(30)}catch(e){}
  amove();
  ad.iv=setInterval(()=>{const m=$('#main');if(ad.y<150)m.scrollTop-=10;else if(ad.y>innerHeight-120)m.scrollTop+=10;else return;amove()},16);
}
function aend(){
  acancel();if(!ad)return;
  const d=ad;ad=null;clearInterval(d.iv);noClick=Date.now()+500;
  d.el.style.opacity='';(d.ws||[]).forEach(w=>w.style.opacity='');if(d.hot)d.hot.classList.remove('hot');
  const PP=view.tab==='playlists',a=(PP?playlists:albums).find(x=>x.id===d.id);
  if(!d.hot&&d.moved&&d.wrap.parentNode){
    const items=PP?playlists:albums;
    [...d.wrap.parentNode.children].forEach((w,i)=>{const c=w.querySelector('.card'),o=c&&items.find(x=>x.id===c.dataset.id);if(o){o.ord=i;put(PP?'playlists':'albums',o)}});
    toast('Order saved');
  }
  if(d.hot&&a){
    const fid=d.hot.classList.contains('fcard')?d.hot.dataset.fid:null,tr=d.hot.getBoundingClientRect();
    const k=an(d.g,[{transform:d.g.style.transform,opacity:.95},{transform:`translate3d(${tr.left+tr.width/2-d.w/2}px,${tr.top+tr.height/2-d.h/2}px,0) scale(.2)`,opacity:0}],{duration:260,easing:EASE,fill:'forwards'});
    setTimeout(()=>d.g.remove(),k?270:0);
    for(const id of d.ids||[d.id]){const o=(PP?playlists:albums).find(x=>x.id===id);if(o&&!o.sys){o.folderId=fid;put(PP?'playlists':'albums',o)}}if(gMode&&d.ids&&d.ids.length>1)gOff();
    toast(fid?'Moved to '+(PP?pfolders:folders).find(f=>f.id===fid).name:'Moved out of the folder');
    render();
    if(fid)an(document.querySelector('.fcard[data-fid="'+fid+'"]'),[{transform:'scale(1.07)'},{transform:'none'}],{duration:340,easing:'cubic-bezier(.2,.9,.3,1.35)'});
  }else{
    const c=d.el.querySelector('.cov').getBoundingClientRect();
    const k=an(d.g,[{transform:d.g.style.transform},{transform:`translate3d(${c.left}px,${c.top}px,0) scale(1)`}],{duration:240,easing:EASE_OUT,fill:'forwards'});
    setTimeout(()=>d.g.remove(),k?250:0);
  }
}
async function delFolder(f){
  const r=await choose('Delete "'+f.name+'"?',[{label:'Delete folder, keep albums',value:1,danger:true}]);
  if(r){for(const a of albums)if(a.folderId===f.id){a.folderId=null;await put('albums',a)}folders=folders.filter(x=>x.id!==f.id);await del('folders',f.id);if(view.folder===f.id)view.folder=null}
}
$('#main').addEventListener('pointerdown',e=>{
  if(!((view.tab==='albums'&&!view.album)||(view.tab==='playlists'&&!view.pl)))return;
  const el=e.target.closest('.card[data-act="open"],.card[data-act="openpl"]');if(!el||el.dataset.id===ROTID||el.dataset.id===LIKEID)return;
  acancel();ah={el,x:e.clientX,y:e.clientY,t:setTimeout(astart,gMode?420:750)};
});
$('#main').addEventListener('contextmenu',e=>{if(e.target.closest('.card'))e.preventDefault()});
window.addEventListener('pointermove',e=>{
  if(ah&&Math.hypot(e.clientX-ah.x,e.clientY-ah.y)>10)acancel();
  if(!ad)return;ad.x=e.clientX;ad.y=e.clientY;amove();
});
window.addEventListener('pointerup',aend);
window.addEventListener('pointercancel',aend);


/* several selected albums / playlists: hold one to drag them all (onto a folder, Back, or between other items) */
function agroup(d){
  const ids=gMode&&gSet.has(d.id)?[...gSet]:[d.id];
  d.ws=[...document.querySelectorAll('#main .acard[data-gid]')].filter(w=>ids.includes(w.dataset.gid));
  if(!d.ws.includes(d.wrap))d.ws=[d.wrap];
  d.ids=d.ws.map(w=>w.dataset.gid);d.ws.forEach(w=>w.style.opacity='.3');
  if(d.ws.length>1){const b=document.createElement('b');b.className='gbadge';b.textContent=d.ws.length;d.g.appendChild(b)}
}
/* position of the selection: start, end, or one by one */
async function gPos(){
  const P=view.tab==='playlists',items=P?playlists:albums,st=P?'playlists':'albums',fid=(P?view.pf:view.folder)||null;
  const ids=[...gSet].filter(id=>items.some(y=>y.id===id&&!y.sys));if(!ids.length)return false;
  const r=await choose('Position of '+ids.length+(ids.length===1?' item':' items'),[{label:'Move to start',value:'s',ic:'up'},{label:'Move to end',value:'e',ic:'down'},{label:'Reorder one by one',value:'r',ic:'reorder'}]);
  if(!r)return false;
  if(r==='r'){gOff();reorderSheet(P);return false}
  const list=items.filter(x=>(x.folderId||null)===fid&&!x.sys).sort(byOrd),mv=list.filter(x=>ids.includes(x.id)),rest=list.filter(x=>!ids.includes(x.id)),out=r==='s'?mv.concat(rest):rest.concat(mv);
  for(let i=0;i<out.length;i++){out[i].ord=i;await put(st,out[i])}
  toast('Order saved');return true;
}


/* ===== END 11-gestures.js ===== */
