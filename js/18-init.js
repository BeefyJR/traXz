/* static UI and init */
function ui(){
  try{const t=localStorage.getItem('tracks-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else if(t==='custom'){document.documentElement.dataset.theme='custom';applyCustom(CT.hex)}}catch(e){}
  if(LS('tracks-mh'))$('#app').classList.add('mh');
  $('#app').insertAdjacentHTML('beforeend',`<button id="mshow" data-act="minishow" aria-label="Show player">${ic('chev',18)}</button>`);
  $('#plus').innerHTML=ic('plus',26);$('#qk').innerHTML=ic('qm',22);
  $('#app').insertAdjacentHTML('beforeend',`<div id="selbar"><div class="sr"><button class="ib" data-act="selexit" aria-label="Done">${ic('close',22)}</button><span id="selc">0 selected</span><button class="pill" data-act="selall">All</button></div><div class="sg"><button class="ib" data-act="selalbum" aria-label="Add to album">${ic('album',22)}</button><button class="ib" data-act="selpl" aria-label="Add to playlist">${ic('plist',22)}</button><button class="ib" data-act="selqueue" aria-label="Add to queue">${ic('qm',23)}</button><button class="ib" data-act="selcolor" aria-label="Change color">${ic('palette',22)}</button><button class="ib" data-act="seltag" aria-label="Tag artist and album">${ic('tag',22)}</button><button class="ib" id="selrm" data-act="selrm" aria-label="Remove from this list">${ic('minus',22)}</button><button class="ib" data-act="seldel" aria-label="Delete songs">${ic('trash',22)}</button><button class="ib gb" data-act="gmove" aria-label="Move to folder">${ic('move',22)}</button><button class="ib gb" data-act="gpos" aria-label="Change position">${ic('reorder',22)}</button><button class="ib gb" data-act="gdel" aria-label="Delete">${ic('trash',22)}</button></div></div>`);
  $('#gear').innerHTML=ic('gear',24);paintTheme();applyLayout();
  new ResizeObserver(()=>document.documentElement.style.setProperty('--tp',$('#top').offsetHeight+'px')).observe($('#top'));
  $('#tb').innerHTML=`<div class="sb" id="sb"><button class="sbi" data-act="search" aria-label="Search">${ic('search',22)}</button><input id="sq" type="search" placeholder="Search songs, artists, albums" autocomplete="off" enterkeyhint="search" aria-label="Search songs"><button class="sbx" data-act="clearsearch" aria-label="Clear search">${ic('close',20)}</button></div><button class="pill" id="selbtn" data-act="select" aria-label="Select songs">${ic('sel',20)}</button><button class="pill" id="flt" data-act="filter">${ic('filter',18)}<span id="fl"></span></button>`;
  tbmApply();
  let sqA=0;
  $('#sq').oninput=()=>{view.q=$('#sq').value;clearTimeout(sqT);if(songs.length<400)render();else sqT=setTimeout(render,160);
    clearTimeout(sqA);const q=view.q.trim();if(q)sqA=setTimeout(()=>{const n=document.querySelectorAll('#main .row').length;say(n?n+(n===1?' song found':' songs found'):'No songs found')},700)};
  $('#sq').onblur=()=>{if(!$('#sq').value)closeSearch()};
  $('#mini').innerHTML=`<video class="mbv mv" muted loop playsinline preload="none" disablepictureinpicture tabindex="-1" aria-hidden="true"></video><button class="mhide" data-act="minihide" aria-label="Hide player">${ic('chev',18)}</button><div class="m1"><div class="mcv" id="mc"></div><div class="t"><b id="mt"></b><span id="ms"></span></div>${likeBtn()}${oneBtn()}<button class="ib" data-act="minialbum" aria-label="Add to album">${ic('album',22)}</button><button class="ib" data-act="miniplaylist" aria-label="Add to playlist">${ic('plist',22)}</button></div>
  <div class="m3"><span id="mct">0:00</span><input type="range" class="rng" id="msk" min="0" max="1000" value="0" style="--f:rgb(var(--ac))" aria-label="Seek"><span id="mdt">0:00</span></div><div class="m2"><button class="ib" data-act="vol" data-vi data-s="22" aria-label="Volume">${ic('vol',22)}</button><div class="mvs"><input type="range" class="rng" id="mvl" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%;--f:rgb(var(--ac))" aria-label="Volume"><button class="ib mt2" data-act="mute" aria-label="Mute or unmute">${ic('volx',16)}</button><button class="ib nmb mnm" data-act="norm" aria-pressed="false" aria-label="Normalize volume" title="Normalize volume">${ic('norm',17)}</button></div><button class="ib tg" data-act="shuffle" aria-label="Shuffle"></button><button class="ib" data-act="prev" aria-label="Previous">${ic('prev',24)}</button><button class="ib mp" id="mp" data-act="toggle" aria-label="Play or pause"></button><button class="ib" data-act="next" aria-label="Next">${ic('next',24)}</button><button class="ib tg" data-act="repeat" aria-label="Repeat"></button><button class="ib" data-act="qopen" aria-label="Queue">${ic('qm',22)}</button></div>`;
  $('#app').insertAdjacentHTML('beforeend',`<div id="vp"><button class="ib mt" data-act="mute" data-vi data-s="20" aria-label="Mute or unmute">${ic('vol',20)}</button><input type="range" class="rng" id="vol" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%" aria-label="Volume"></div>`);
  $('#vol').oninput=e=>{setVol(e.target.value/100);vpTimer()};
  $('#mvl').oninput=e=>{setVol(e.target.value/100);vpTimer()};nmPaint();
  $('#msk').oninput=e=>{if(vD())vSeek(e.target.value/1000*vD());e.target.style.setProperty('--p',(e.target.value/10)+'%');$('#mct').textContent=fmt(vT())};
  $('#msk').onpointerdown=()=>{seeking=true};
  $('#app').insertAdjacentHTML('beforeend',`<div id="qp"><div class="qh"><h3>Queue</h3><div class="qa"><button class="ovx" data-act="qshuf" aria-label="Shuffle upcoming songs">${ic('shuffle',18)}</button><button class="ovx" id="qundo" data-act="qundo" aria-label="Undo last queue change" title="Undo" disabled>${ic('undo',18)}</button><button class="pill" data-act="qclear" title="Remove everything after the current song">Clear all</button><button class="ovx" data-act="qclose" aria-label="Close queue">${ic('close',16)}</button></div></div><div id="ql"></div></div>`);
  $('#mini .m1').addEventListener('click',e=>{if(e.target.closest('[data-act]'))return;openFull()});
  $('#app').insertAdjacentHTML('beforeend',`<aside id="np" aria-label="Now playing"><div class="npg" id="npg" role="separator" aria-orientation="vertical" aria-label="Drag to resize the panel" title="Drag to resize (double-click to reset)"></div><div class="npge" id="npge"></div><div class="nph"><b>Now playing</b><span class="nphr"><button class="ib" data-npa="full" aria-label="Open full player" title="Full screen player">${ic('npx',22)}</button></span></div><div class="npc" id="npc" data-npa="full"></div><div class="npi"><div class="npn"><h2 id="npt"></h2><p id="nps"></p></div>${likeBtn()}${oneBtn()}</div><div class="npl" id="npl"></div></aside><div id="npb"><div class="nl"><div class="nc" id="nbc" data-npa="full"></div><div class="nt"><b id="nbt"></b><span id="nbs"></span></div><div class="npa">${likeBtn()}${oneBtn()}<button class="ib" data-act="minialbum" aria-label="Add to album" title="Add to album">${ic('album',22)}</button><button class="ib" data-act="miniplaylist" aria-label="Add to playlist" title="Add to playlist">${ic('plist',22)}</button><button class="ib" data-act="editfull" aria-label="Edit song details" title="Edit song details">${ic('edit',22)}</button><button class="ib npm" data-act="npmore" aria-label="More options" title="Like, add to album or playlist, edit details">${ic('dots',22)}</button></div></div><div class="nm"><div class="nctl"><button class="ib tg" data-act="shuffle" aria-label="Shuffle"></button><button class="ib" data-act="prev" aria-label="Previous">${ic('prev',24)}</button><button class="ib mp" id="nbp" data-act="toggle" aria-label="Play or pause"></button><button class="ib" data-act="next" aria-label="Next">${ic('next',24)}</button><button class="ib tg" data-act="repeat" aria-label="Repeat"></button></div><div class="nsk"><span id="nbct">0:00</span><input type="range" class="rng" id="nbsk" min="0" max="1000" value="0" aria-label="Seek"><span id="nbdt">0:00</span></div></div><div class="nr"><button class="ib${NP.ly?' on':''}" data-npa="ly" aria-label="Show lyrics" title="Lyrics">${ic('mic',22)}</button><button class="ib nmb pnm" data-act="norm" aria-pressed="false" aria-label="Normalize volume" title="Normalize volume">${ic('norm',22)}</button><button class="ib" data-act="qopen" aria-label="Queue" title="Queue (hold for the full queue)">${ic('qm',22)}<svg class="qring" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="17"/></svg></button><span class="nvg"><button class="ib mt" data-act="mute" data-vi data-s="20" aria-label="Mute or unmute">${ic('vol',20)}</button><input type="range" class="rng" id="nbvl" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%" aria-label="Volume"></span></div></div>`);
  $('#np').addEventListener('click',npClick);$('#npb').addEventListener('click',npClick);$('#npb').addEventListener('wheel',npbWheel,{passive:false});nmPaint();
  $('#nbsk').oninput=e=>{if(vD())vSeek(e.target.value/1000*vD());e.target.style.setProperty('--p',(e.target.value/10)+'%');$('#nbct').textContent=fmt(vT())};
  $('#nbsk').onpointerdown=()=>{seeking=true};
  $('#nbvl').oninput=e=>setVol(e.target.value/100);
  ['wheel','touchstart','pointerdown'].forEach(ev=>$('#npl').addEventListener(ev,()=>{NP.user=Date.now()},{passive:true}));
  npApply();
  syncCtl();
}
(async()=>{
  try{db=await openDB();songs=(await tx('songs','readonly',s=>s.getAll()))||[];albums=(await tx('albums','readonly',s=>s.getAll()))||[];folders=(await tx('folders','readonly',s=>s.getAll()))||[];playlists=(await tx('playlists','readonly',s=>s.getAll()))||[];pfolders=(await tx('pfolders','readonly',s=>s.getAll()))||[];await lyDbLoad()}catch(e){db=null}
  try{await medLoad()}catch(e){}
  songs.sort((a,b)=>a.added-b.added);
  ui();mvInit();tbgApply();applyBg();restoreLast();render();if(window.splashReady)window.splashReady();
  $('#plus').insertAdjacentHTML('afterend',`<button class="ib" id="cb" data-act="cloud" aria-label="Google Drive sync" title="Google Drive sync" style="margin-left:10px;margin-right:auto">${ic('cloud',24)}</button>`);$('#qk').title='Queue (Q)';try{hbPlace()}catch(e){}$('#gear').title='Settings';$('#plus').title='Create / import';
  parseTok();if(LS('tracks-cloud')){cloudSt('Connected');if(navigator.onLine)cloudSync(false)}
  if(!db)toast('Storage unavailable, songs last until you close this page');
  const SS=new Set(songs);
  for(const o of [...songs,...albums]){
    if(o.cover&&!o.ccol){const c=await colorFromUrl(o.cover);if(c){o.ccol=c;await put(SS.has(o)?'songs':'albums',o)}}
  }
  renderMini();lyBoot();medBootGC();shareIntake();shareOpen();albumOpen();fpInit();
})();
/* ===== Edge swipe = back =====
   Swipe in from the left or right screen edge: closes the top-most layer (sheet, queue, full player, search, selection)
   or goes up one level in the library (song > album > folder). Settings > Layout > Gestures switches it off.
   One history entry is kept in reserve so the phone's own back gesture / back button does the same instead of closing the app. */
(()=>{
  const ZONE=24,ZONE2=44,MIN=64,MAXW=()=>innerWidth;/* phones' own back gesture owns roughly the outer 24px, so the page also accepts swipes that start a little further in (not on a song row: that swipe adds to the queue) */
  const vis=el=>!!(el&&el.getClientRects().length);
  function backStep(){
    if(document.querySelector('#crop,#cmk,#fpbar'))return true;/* editors: swallow, they have their own buttons */
    const ov=$('#ov');
    if(ov&&ov.classList.contains('open')){ov.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true}
    if(qOpen){closeQ();return true}
    if($('#full').classList.contains('open')){closeFull();return true}
    if(selMode){selMode=false;selSet.clear();render();return true}
    const sb=$('#sb');if(sb&&sb.classList.contains('open')){closeSearch();return true}
    const b=[...document.querySelectorAll('#app [data-act="back"]')].find(vis);
    if(b){b.click();return true}
    return false;
  }
  /* finger-following back bubble in the accent colour */
  let ind=null,st=null;
  const mk=()=>{if(ind)return ind;ind=document.createElement('div');ind.id='gbk';ind.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';document.body.appendChild(ind);return ind};
  const paintInd=(side,dx,y)=>{
    const el=mk(),p=Math.min(1,dx/MIN),w=46;
    el.classList.toggle('r',side==='r');
    el.style.display='flex';el.style.top=Math.max(60,Math.min(innerHeight-60,y))+'px';el.style.marginTop='-23px';
    const off=-w+p*(w+14);/* slides in from off-screen */
    el.style.left=side==='l'?'0':'auto';el.style.right=side==='r'?'0':'auto';
    el.style.transform='translateX('+(side==='l'?off:-off)+'px) scale('+(.7+.3*p)+')';
    el.style.opacity=String(.35+.65*p);
  };
  const hideInd=(done)=>{
    if(!ind)return;const el=ind;
    if(done&&!RM.matches){el.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'});setTimeout(()=>{el.style.display='none';el.getAnimations().forEach(a=>a.cancel())},170)}
    else{el.style.display='none'}
  };
  addEventListener('touchstart',e=>{
    st=null;
    if(!GEST.on||e.touches.length!==1)return;
    const t=e.touches[0],x=t.clientX,w=MAXW();
    const near=e.target.closest&&e.target.closest('.row[data-act="play"],input[type=range],canvas,.chips');
    const z=near?ZONE:ZONE2;
    const side=x<=z?'l':x>=w-z?'r':null;
    if(!side)return;
    st={side,sx:x,sy:t.clientY,lock:false,hit:false,dx:0};
  },{passive:true,capture:true});
  addEventListener('touchmove',e=>{
    if(!st)return;
    if(e.touches.length!==1){st=null;hideInd();return}
    const t=e.touches[0],dx=st.side==='l'?t.clientX-st.sx:st.sx-t.clientX,dy=Math.abs(t.clientY-st.sy);
    if(!st.lock){
      if(dy>14&&dy>dx*1.2){st=null;return}/* it is a vertical scroll */
      if(dx>8&&dx>dy*.9)st.lock=true;else return;
    }
    st.dx=Math.max(0,dx);
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
    if(!st.hit&&st.dx>=MIN){st.hit=true;try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}
    else if(st.hit&&st.dx<MIN)st.hit=false;
    paintInd(st.side,st.dx,t.clientY);
  },{passive:false,capture:true});
  const end=ok=>{
    if(!st)return;
    const go=ok&&st.lock&&st.dx>=MIN;st.lock&&hideInd(go);st=null;
    if(go)backStep();
  };
  addEventListener('touchend',()=>end(true),{passive:true,capture:true});
  addEventListener('touchcancel',()=>end(false),{passive:true,capture:true});

  /* the phone's own back gesture / button: keep one spare history entry and use it to step back inside the app */
  let armed=false,tried=false;
  const arm=()=>{try{history.pushState({trax:1},'',location.href);armed=true}catch(_){}};
  const EV=['pointerup','touchend','click','keydown'];
  const first=()=>{if(tried)return;tried=true;EV.forEach(n=>removeEventListener(n,first,true));arm()};/* browsers skip history entries made before a completed tap or key press, so wait for one */
  EV.forEach(n=>addEventListener(n,first,true));
  addEventListener('popstate',()=>{
    if(!armed)return;
    armed=false;
    if(GEST.on&&backStep()){arm();return}
    try{history.back()}catch(_){}/* nothing left to close: let the phone leave the app as usual */
  });
})();


/* ===== Audio output device =====
   Chrome and Edge (desktop and Android) can send sound to a chosen output with setSinkId. Safari and iOS cannot:
   there the system decides (Control Centre, AirPlay), so the sheet offers the AirPlay picker when the browser has one. */
const OUT={id:LS('tracks-outdev')||'',label:LS('tracks-outlbl')||''};
const outCan=()=>typeof au.setSinkId==='function';
const outName=()=>OUT.id?(OUT.label||'Selected device'):'System default';
async function outApply(){
  if(!outCan())return true;
  try{await au.setSinkId(OUT.id||'')}catch(e){return false}
  try{if(fxAC&&fxAC.setSinkId)await fxAC.setSinkId(OUT.id||'')}catch(e){}
  return true;
}
async function outDevices(){
  try{return(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput'&&d.deviceId!=='communications')}catch(e){return[]}
}
const outKind=l=>/bluetooth|buds|airpods|earphone|earbud|headset|headphone|hands-?free/i.test(l)?'Bluetooth or headphones':/speaker|built-?in|internal|phone|earpiece/i.test(l)?'Speaker':/hdmi|display|tv|monitor/i.test(l)?'Screen or TV':/usb|dock|dac/i.test(l)?'USB audio':'Audio output';
function outSave(id,label){OUT.id=id||'';OUT.label=id?(label||''):'';LS('tracks-outdev',OUT.id||null);LS('tracks-outlbl',OUT.label||null)}
async function outPick(id,label){
  const prev={id:OUT.id,label:OUT.label};
  outSave(id,label);
  const ok=await outApply();
  if(!ok){outSave(prev.id,prev.label);await outApply();toast('Could not switch to that device');return false}
  toast(id?'Playing on '+(label||'the selected device'):'Playing on the system default');
  return true;
}
function outSheet(){
  const known=outCan(),pick=typeof navigator.mediaDevices?.selectAudioOutput==='function',air=typeof au.webkitShowPlaybackTargetPicker==='function';
  openOv(`<h3>Output device</h3><div class="scd" id="outl"><p class="dupn" style="margin:6px">Looking for devices\u2026</p></div><div id="outx"></div><div class="bt"><button type="button" class="pill acc" id="outdn">Done</button></div>`);
  const sh=$('#ov .sheet');if(!sh)return;
  const L=()=>sh.querySelector('#outl'),X=()=>sh.querySelector('#outx');
  const row=(id,t,d,on)=>`<button type="button" class="srow" data-od="${esc(id)}" data-ol="${esc(t)}" role="radio" aria-checked="${on}"><span class="st"><b>${esc(t)}</b>${d?`<small>${esc(d)}</small>`:''}</span><span class="sv">${on?'Playing here':''}</span></button>`;
  let busy=false;
  const paint=async()=>{
    if(!L())return;
    const dev=known?await outDevices():[];if(!L())return;
    const named=dev.filter(d=>d.label),seen=new Set();
    let h=row('','System default','Phone or computer speaker, or whatever the system is connected to',!OUT.id);
    named.forEach(d=>{if(d.deviceId==='default'||seen.has(d.deviceId))return;seen.add(d.deviceId);h+=row(d.deviceId,d.label,outKind(d.label),OUT.id===d.deviceId)});
    if(OUT.id&&!seen.has(OUT.id))h+=row(OUT.id,OUT.label||'Selected device','Not seen right now',true);
    L().innerHTML=h;
    const nameless=dev.length>0&&!named.length;let x='';
    if(known&&pick)x+=`<div class="bt" style="margin-top:6px"><button type="button" class="pill" id="outsel">Choose another device\u2026</button></div>`;
    if(known&&!pick&&(!named.length||nameless))x+=`<div class="bt" style="margin-top:6px"><button type="button" class="pill" id="outperm">Show device names</button></div><p class="dupn" style="margin:6px">Your browser only shows names after the microphone permission is allowed. Nothing is recorded.</p>`;
    if(air)x+=`<div class="bt" style="margin-top:6px"><button type="button" class="pill" id="outair">${ic('out',16)}AirPlay and Bluetooth\u2026</button></div>`;
    if(!known)x+=`<p class="dupn" style="margin:8px 6px">${air?'This browser lets the system choose the speaker. Use the button above, or the audio output control in your phone settings.':'This browser cannot switch the speaker from inside the app. Connect your Bluetooth earbuds or speaker in the phone settings, and sound moves there automatically.'}</p>`;
    X().innerHTML=x;
  };
  sh.addEventListener('click',async e=>{
    if(e.target.closest('#outdn')){closeOv();return}
    if(busy)return;
    const r=e.target.closest('[data-od]');
    if(r){if(!known){toast('This browser cannot switch the output');return}busy=true;await outPick(r.dataset.od,r.dataset.ol);busy=false;paint();return}
    if(e.target.closest('#outsel')){busy=true;try{const d=await navigator.mediaDevices.selectAudioOutput();if(d&&d.deviceId)await outPick(d.deviceId,d.label)}catch(_){}busy=false;paint();return}
    if(e.target.closest('#outperm')){busy=true;try{const st=await navigator.mediaDevices.getUserMedia({audio:true});st.getTracks().forEach(t=>t.stop())}catch(_){toast('Permission was not given')}busy=false;paint();return}
    if(e.target.closest('#outair')){try{au.webkitShowPlaybackTargetPicker()}catch(_){}return}
  });
  sh.addEventListener('outrefresh',paint);
  paint();
}
/* an output that disappears (earbuds switched off) falls back to the system default */
try{navigator.mediaDevices&&navigator.mediaDevices.addEventListener('devicechange',async()=>{
  if(OUT.id){const d=await outDevices();if(d.length&&!d.some(x=>x.deviceId===OUT.id)){outSave('','');await outApply();toast('Output device disconnected. Using the system default')}}
  const b=$('#outl')&&$('#ov .sheet');if(b)b.dispatchEvent(new CustomEvent('outrefresh'));
})}catch(_){}
if(OUT.id)outApply().then(ok=>{if(!ok){outSave('','')}});

/* ===== Reset buttons next to sliders =====
   Every adjustment slider gets the round reset arrow; volume, seek, scroll and preview sliders never do.
   A reset sets the default and fires the slider's own input and change events, so each sheet reacts as if you dragged there. */
const RST_DEF={cpz:100,cpx:500,cpy:500,fcr:160,fco:100,icsz:44,icgp:8,tbd:55,tbb:0,tpt:22,tpb:18,npwr:360,cmd2:35,cmg:18,cmia:50,cmga:90,cmfa:50,cmsr:0,cmmx:50,cmmy:50,cmmr:0,cmmo:100,cmmc:0};
const RST_NAME={cpz:'Zoom',cpx:'X',cpy:'Y'};
function rstClick(btn){
  const f=btn.closest('.fop'),i=f&&f.querySelector('input.rng');if(!i)return;
  const id=i.id;
  if(id==='tpt'||id==='tpb'){/* top bar: back to untouched, not to a stored number */
    TPB[id==='tpt'?'t':'b']=null;tpbSave();tpbApply();
    const v=RST_DEF[id],mx=id==='tpt'?100:40;i.value=v;i.style.setProperty('--p',(v/mx*100)+'%');const b=f.querySelector('b');if(b)b.textContent=v+(id==='tpt'?'%':'px');return;
  }
  let d=i.dataset.def!=null&&i.dataset.def!==''?+i.dataset.def:RST_DEF[id];
  if(d==null||!isFinite(d))return;
  d=Math.min(+i.max,Math.max(+i.min,d));
  i.value=d;
  i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));
  try{navigator.vibrate&&navigator.vibrate(6)}catch(_){}
}
function rstScan(){
  document.querySelectorAll('.fop').forEach(f=>{
    if(f.querySelector('.rsb'))return;
    const i=f.querySelector('input.rng');if(!i||!i.id)return;
    if(!(i.id in RST_DEF)&&i.dataset.def==null&&i.id!=='cmz'&&i.id!=='cmmz')return;
    const lb=i.getAttribute('aria-label')||RST_NAME[i.id]||'slider';
    const b=document.createElement('button');b.type='button';b.className='rsb';b.dataset.rg='1';
    b.setAttribute('aria-label','Reset '+lb+' to default');b.title='Reset to default';b.innerHTML=ic('rst',16);
    f.appendChild(b);
  });
}
{
  let q=0;const sched=()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;try{rstScan()}catch(_){}})};
  const hit=n=>n.nodeType===1&&(n.classList.contains('fop')||n.querySelector('.fop'));
  const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(hit(n)){sched();return}});
  mo.observe(document.body,{childList:true});
  const ov=document.getElementById('ov');if(ov)mo.observe(ov,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('.rsb[data-rg]');if(!b)return;
    e.preventDefault();e.stopPropagation();rstClick(b);
  },true);
  sched();
}

/* last-resort safety net: a stray error must never freeze the app silently. Log it, tell the person once in a while, keep playing. */
(function(){let t=0;const warn=e=>{console.error('traXz',e);if(Date.now()-t<10000)return;t=Date.now();try{toast('Something went wrong. If it keeps happening, reload the page.')}catch(_){}};
  addEventListener('unhandledrejection',ev=>{warn(ev.reason)});
  addEventListener('error',ev=>{if(ev&&ev.target&&ev.target!==window)return;warn(ev&&(ev.error||ev.message))})})();
