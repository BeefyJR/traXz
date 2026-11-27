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

