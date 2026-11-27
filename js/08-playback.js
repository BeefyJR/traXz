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

