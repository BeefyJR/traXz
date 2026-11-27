/* ===== Replace many audio files at once: each file is matched to a song by its tags and file name ===== */
const AUDRE=/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i;
async function rfBulkPick(){
  const v=await choose('Replace audio in bulk',[{label:'Pick audio files',value:'f',ic:'filep'},{label:'Pick a folder',value:'d',ic:'impfld'}]);if(!v)return;
  const i=document.createElement('input');i.type='file';i.multiple=true;
  if(v==='d')i.webkitdirectory=true;else i.accept='audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.wma,.aiff';
  i.onchange=()=>{const fs=[...i.files];if(fs.length)rfBulk(fs)};i.click();
}
const rfIndex=()=>songs.map(s=>({s,kt:tkey(s.name),sa:nkey(artOf(s)),full:nkey(artOf(s)+' '+s.name),nn:nkey(s.name)}));
function rfScore(r,x){
  let sc=0;const kt=r.kt;
  if(kt&&x.kt){
    if(kt===x.kt)sc=100;
    else if(Math.min(kt.length,x.kt.length)>=4&&(kt.includes(x.kt)||x.kt.includes(kt)))sc=62;
    else{const A=kt.split(' '),B=x.kt.split(' ');let n=0;for(const w of A)if(B.includes(w))n++;if(n/Math.max(A.length,B.length)>=.75)sc=70}
  }
  if(sc<100&&r.ns&&(r.ns===x.full||r.ns===x.nn))sc=100;   /* the whole file name can be "Artist Title" */
  if(!sc)return 0;
  if(r.ra&&x.sa){if(r.ra===x.sa||r.ra.includes(x.sa)||x.sa.includes(r.ra))sc+=30;else sc-=45}   /* a different artist is a strong warning */
  const dd=Math.abs((r.dur||0)-(effDur(x.s)||0));if(dd<=1.5)sc+=8;else if(dd<=4)sc+=3;
  return sc;
}
function rfMatch(rows){
  const idx=rfIndex(),prs=[];
  rows.forEach((r,i)=>{
    r.kt=tkey(r.title);r.ns=nkey(r.stem);r.ra=nkey(r.artist);r.song=null;r.score=0;
    if(r.bad)return;
    for(const x of idx){const sc=rfScore(r,x);if(sc>=55)prs.push([sc,i,x.s])}
  });
  prs.sort((a,b)=>b[0]-a[0]);const used=new Set();
  for(const [sc,i,s] of prs){const r=rows[i];if(r.song||used.has(s.id))continue;r.song=s;r.score=sc;used.add(s.id)}   /* best matches first, one file per song */
  return idx;
}
async function rfBulk(files){
  const aud=[...files].filter(f=>!/^\._/.test(f.name)&&(f.type.startsWith('audio/')||AUDRE.test(f.name)));
  if(!aud.length)return toast('Pick audio files');
  if(!songs.length)return toast('Add songs first, then replace their audio');
  if($('#ov').classList.contains('open'))closeOv();
  toast('Matching '+aud.length+(aud.length===1?' file':' files')+'\u2026');
  const rows=[];
  for(let i=0;i<aud.length;i++){
    const f=aud[i];if(aud.length>3&&i&&i%3===0)toast('Reading '+i+' of '+aud.length+'\u2026');
    let t=null;try{t=await readTags(f)}catch(_){}
    const stem=f.name.replace(/\.[^.]+$/,''),base=stem.replace(/^\s*\d{1,3}\s*[-._)]+\s*/,'')||stem,m=songMeta(base,t||{}),dur=await getDur(f);
    rows.push({f,stem,title:m.title,artist:m.artist,dur:isFinite(dur)?dur:0,bad:!(dur>0)});
  }
  const idx=rfMatch(rows);
  rows.forEach(r=>{r.on=!!r.song&&r.score>=100});
  const o={trim:false,add:false},lab=s=>s.name+(artOf(s)?' \u2014 '+artOf(s):'');
  const diff=r=>{if(!r.song)return '';const d=r.dur-effDur(r.song);return Math.abs(d)<1?'same length':fmt(Math.abs(d))+(d>0?' longer':' shorter')};
  const rowHtml=(r,i)=>`<div class="rbr ${r.song?'':'no'}" data-i="${i}"><input type="checkbox" ${r.on?'checked':''} ${r.song&&!r.bad?'':'disabled'} aria-label="Replace this song"><div class="rbt"><b>${r.song?esc(r.song.name):(r.bad?'Could not read this file':'No match found')}</b><span>${r.song?esc(artOf(r.song)||'No artist'):''}</span><small>${esc(r.f.name)} \u00b7 ${fmt(r.dur)}${r.song?' \u00b7 '+esc(diff(r)):''}${r.song?' \u00b7 '+esc(qInfo(r.song.blob,r.song.dur)+' \u2192 '+qInfo(r.f,r.dur)):''}</small></div>${r.bad?'':`<button type="button" class="pill" data-c="${i}">${r.song?'Change':'Pick'}</button>`}</div>`;
  const pick=async i=>{
    const r=rows[i],cand=idx.map(x=>({x,sc:rfScore(r,x)})).filter(c=>c.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,8);
    const items=cand.map(c=>({label:lab(c.x.s),value:c.x.s.id,noic:true,sel:!!r.song&&r.song.id===c.x.s.id}));
    items.push({label:'Search all songs\u2026',value:'__q',ic:'search'});
    if(r.song)items.push({label:'Do not replace this one',value:'__x',noic:true,danger:true});
    const v=await choose(r.f.name,items);let id=v;
    if(v==='__q'){
      id=null;const q=await ask('Search songs','');
      if(q){const k=nkey(q),hits=songs.filter(s=>nkey(s.name).includes(k)||nkey(artOf(s)).includes(k)).slice(0,12);
        if(hits.length)id=await choose('Pick a song',hits.map(s=>({label:lab(s),value:s.id,noic:true})));else toast('No songs found')}
    }
    if(v==='__x'){r.song=null;r.on=false;r.score=0}
    else if(id){const s=songById(id);if(s){rows.forEach(z=>{if(z!==r&&z.song&&z.song.id===id){z.song=null;z.on=false;z.score=0}});r.song=s;r.score=1000;r.on=true}}
    show();
  };
  const show=()=>{
    const un=rows.filter(r=>!r.song&&!r.bad).length;
    openOv(`<h3>Replace audio files</h3><p class="dupn" id="rb-n"></p><div class="rbl" id="rb-l">${rows.map(rowHtml).join('')}</div><div class="bgst" id="rb-q"><button type="button" class="chip" data-q="all">Select all matches</button><button type="button" class="chip" data-q="none">None</button><button type="button" class="chip" data-q="up">Only quality upgrades</button></div>
    <label class="pk dall"><input type="checkbox" id="rb-t" ${o.trim?'checked':''}><span class="t"><b>Trim longer files to the old length</b><small>Cuts extra seconds off the end, up to 30 s</small></span></label>
    ${un?`<label class="pk dall"><input type="checkbox" id="rb-a" ${o.add?'checked':''}><span class="t"><b>Add ${un} unmatched ${un===1?'file':'files'} as new songs</b></span></label>`:''}
    <div class="bt"><button class="pill" id="rb-c">Cancel</button><button class="pill acc" id="rb-g"></button></div>`);
    const cnt=()=>rows.filter(r=>r.on&&r.song&&!r.bad).length;
    const upd=()=>{
      const n=cnt(),m=rows.filter(r=>r.song).length,g=$('#rb-g');
      $('#rb-n').textContent=`${m} of ${rows.length} ${rows.length===1?'file matches':'files match'} a song by name and artist. Name, artist, album, cover, playlists and lyrics stay. Only the sound changes.`;
      g.textContent=n?'Replace '+n+(n===1?' song':' songs'):(o.add&&un?'Add files':'Replace');g.disabled=!n&&!(o.add&&un);
    };
    $('#rb-l').onchange=e=>{const row=e.target.closest('.rbr');if(row){rows[+row.dataset.i].on=e.target.checked;upd()}};
    $('#rb-l').onclick=e=>{const b=e.target.closest('[data-c]');if(b)pick(+b.dataset.c)};
    $('#rb-t').onchange=e=>{o.trim=e.target.checked};
    $('#rb-q').onclick=e=>{const c=e.target.closest('[data-q]');if(!c)return;const q=c.dataset.q;rows.forEach(r=>{r.on=!!r.song&&!r.bad&&(q==='all'||(q==='up'&&(!r.song.blob||kbps(r.f,r.dur)>kbps(r.song.blob,r.song.dur)*1.15)))});show()};
    const ad=$('#rb-a');if(ad)ad.onchange=e=>{o.add=e.target.checked;upd()};
    $('#rb-c').onclick=()=>closeOv();$('#ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
    $('#rb-g').onclick=async()=>{
      const sel=rows.filter(r=>r.on&&r.song&&!r.bad),rest=o.add?rows.filter(r=>!r.song&&!r.bad).map(r=>r.f):[];
      closeOv();let n=0;
      for(let k=0;k<sel.length;k++){
        toast('Replacing '+(k+1)+' of '+sel.length+'\u2026');
        try{await rfApply(sel[k].song,sel[k].f,sel[k].dur,{quiet:true,trim:o.trim});n++}catch(e){console.warn('replace failed',e)}
      }
      render();
      if(n)toast('Replaced '+n+(n===1?' song':' songs'));
      if(rest.length)await addFiles(rest);
    };
    upd();
  };
  show();
}
function dlBlob(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},4000)}
function exportBackup(){
  const cut=o=>{const c=Object.assign({},o);delete c.blob;delete c.orig;delete c.cover;delete c.cmedia;return c};
  dlBlob(new Blob([JSON.stringify({app:'traXz',v:1,date:new Date().toISOString(),songs:songs.map(cut),albums:albums.map(cut),playlists:playlists.map(cut),stats:ST})],{type:'application/json'}),'traXz-backup.json');
  toast('Backup saved (details only, not the audio files)')}
function exportSong(s){
  if(!s.blob)return toast('Download this song from Drive first');
  const t=s.blob.type||'audio/mpeg',ext=(t.split('/')[1]||'mp3').replace('mpeg','mp3').replace(/[^a-z0-9].*$/i,'')||'mp3';
  dlBlob(s.blob,((s.name||'song').replace(/[\\/:*?"<>|]+/g,'_'))+'.'+ext);
  toast('Song exported')}
function importBackup(){
  const f=document.createElement('input');f.type='file';f.accept='.trax,.json,application/json';
  f.onchange=async()=>{
    const file=f.files[0];if(!file)return;
    if(/\.trax$/i.test(file.name))return bkImport(file);
    try{
      const d=JSON.parse(await file.text());
      if(!d||d.app!=='traXz'||!Array.isArray(d.songs))return toast('That is not a traXz backup file');
      const keep=['blob','cover','cmedia'];
      const merge=(o,n)=>{const c={};for(const k of Object.keys(n||{}))if(bkSafeKey(k))c[k]=n[k];keep.forEach(k=>{if(o&&o[k]!==undefined)c[k]=o[k];else delete c[k]});return c};
      let upd=0,added=0;
      for(const n of d.songs){const o=songById(n.id);if(!o)continue;const m=merge(o,n);Object.assign(o,m);await put('songs',o);upd++}
      for(const [key,arr,list] of [['albums',d.albums,albums],['playlists',d.playlists,playlists]]){
        for(const n of (arr||[])){const i=list.findIndex(x=>x.id===n.id);
          if(i>=0){const m=merge(list[i],n);Object.assign(list[i],m);await put(key,list[i])}
          else{const m=merge(null,n);list.push(m);await put(key,m);added++}}}
      if(d.stats&&typeof d.stats==='object'){for(const [id,r] of Object.entries(d.stats)){const o=ST[id];ST[id]=o?{s:Math.max(o.s||0,r.s||0),n:Math.max(o.n||0,r.n||0)}:r}stSave()}
      render();
      toast('Backup imported: '+upd+' '+(upd===1?'song':'songs')+' updated'+(added?', '+added+' playlists/albums added':''));
    }catch(e){toast('Could not read that backup file')}
  };
  f.click()}
function statsSheet(){
  const rows=Object.entries(ST).map(([id,r])=>({s:songs.find(x=>String(x.id)===id),r})).filter(o=>o.s);
  const tot=rows.reduce((a,o)=>a+o.r.s,0),pl=rows.reduce((a,o)=>a+o.r.n,0),art={};
  rows.forEach(o=>{const a=artOf(o.s)||'Unknown';art[a]=(art[a]||0)+o.r.s});
  const hm=x=>x>=3600?(x/3600).toFixed(1)+' h':Math.round(x/60)+' min';
  const ln=(a,b)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line)"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a)}</span><span style="color:var(--mute);flex:none">${b}</span></div>`;
  const top=(l,f)=>l.slice(0,5).map(f).join('')||'<p style="color:var(--mute);margin:6px 0">Nothing yet</p>';
  openOv(`<h3>Listening stats</h3><p style="margin:0 0 8px;color:var(--mute)">${hm(tot)} listened, ${pl} plays</p><label>Top songs</label>${top(rows.slice().sort((a,b)=>b.r.n-a.r.n||b.r.s-a.r.s),o=>ln(o.s.name,o.r.n+' plays'))}<label>Top artists</label>${top(Object.entries(art).sort((a,b)=>b[1]-a[1]),e=>ln(e[0],hm(e[1])))}<button type="button" class="pill" id="stx" style="margin-top:14px">Close</button>`);
  $('#stx').onclick=closeOv}
/* ===== Smart playlists: Rotation. Songs you play often fill it automatically; recent plays count more, so it drifts over time ===== */
const ROTID='__rot',ROT_HALF=14/* days until a play counts half as much */,ROT_MAX=50,ROT_IN=2.5/* score to get in */,ROT_STAY=1.5/* score to stay in (lower, so songs do not flicker) */,ROT_KEEP=90,ROT_CAP=40;
let rotOn=LS('tracks-smart')==='1',rotT=null,rotPlays={},rotIds=[];
try{rotPlays=JSON.parse(LS('tracks-plays')||'{}')||{}}catch(e){rotPlays={}}
try{rotIds=JSON.parse(LS('tracks-rot')||'[]')||[]}catch(e){rotIds=[]}
/* SVG covers: ' ( ) ! * must be percent-encoded too, or safeImg() refuses the data URI and the cover never shows */
const svgUri=x=>'data:image/svg+xml,'+encodeURIComponent(x).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const ROT_COVER=svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff7a3d'/><stop offset='.55' stop-color='#e8386d'/><stop offset='1' stop-color='#6d3bd6'/></linearGradient><radialGradient id='r' cx='.3' cy='.2' r='.9'><stop offset='0' stop-color='#fff' stop-opacity='.28'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs><rect width='200' height='200' fill='url(#g)'/><rect width='200' height='200' fill='url(#r)'/><g fill='none' stroke='#fff' stroke-width='11' stroke-linecap='round'><path d='M52 100a48 48 0 0 1 82-34' opacity='.95'/><path d='M148 100a48 48 0 0 1-82 34' opacity='.95'/></g><path d='M138 38l4 36-34-8z' fill='#fff'/><path d='M62 162l-4-36 34 8z' fill='#fff'/><path d='M90 82v36l30-18z' fill='#fff'/></svg>");
const ROT={id:ROTID,name:'Rotation',cover:ROT_COVER,desc:'Your most played songs lately. It updates itself as your listening changes.',sys:true,songs:rotIds.slice()};
function plGet(id){return id===ROTID?(rotOn?ROT:null):id===LIKEID?(LIKE.on?(LIKEPL.songs=likedIds(),LIKEPL):null):playlists.find(x=>x.id===id)}
const rotSave=()=>LS('tracks-plays',JSON.stringify(rotPlays));
/* plays are logged even while the setting is off, so Rotation is already accurate when it is switched on */
function rotLog(id){
  if(!id)return;
  const a=rotPlays[id]||(rotPlays[id]=[]);a.push(Date.now());if(a.length>ROT_CAP)a.splice(0,a.length-ROT_CAP);
  clearTimeout(rotT);rotT=setTimeout(()=>{rotSave();rotBuild()},4000);
}
function rotBuild(){
  if(!songs.length)return;/* library not loaded yet: do not prune anything */
  const now=Date.now(),have=new Set(songs.map(x=>x.id)),cut=now-ROT_KEEP*864e5,prev=new Set(rotIds),sc=[];
  for(const id of Object.keys(rotPlays)){
    const a=rotPlays[id].filter(t=>t>cut);
    if(!a.length||!have.has(id)){delete rotPlays[id];continue}
    rotPlays[id]=a;
    let v=0;for(const t of a)v+=Math.pow(.5,(now-t)/864e5/ROT_HALF);
    if(v>=(prev.has(id)?ROT_STAY:ROT_IN))sc.push([id,v]);
  }
  sc.sort((x,y)=>y[1]-x[1]);
  const next=sc.slice(0,ROT_MAX).map(x=>x[0]);
  if(JSON.stringify(next)!==JSON.stringify(rotIds)){rotIds=next;LS('tracks-rot',JSON.stringify(rotIds))}
  ROT.songs=rotIds.slice();
}
function rotSet(on){
  if(on===rotOn)return;
  rotOn=on;LS('tracks-smart',on?'1':null);
  if(on)rotBuild();else if(view.pl===ROTID)view.pl=null;
  if(view.tab==='playlists')render();
  toast(on?'Rotation playlist is on':'Smart playlists are off');
}
function rotCard(){const n=ROT.songs.length;return `<div class="acard"><button class="card" data-act="openpl" data-id="${ROTID}">${plCover(ROT)}<b>Rotation</b><span>${n} ${n===1?'song':'songs'} \u00b7 Auto</span></button></div>`}
setInterval(()=>{if(rotOn)rotBuild()},3600000);
addEventListener('pagehide',rotSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden)rotSave();else if(rotOn){rotBuild();if(view.tab==='playlists'&&!view.pl&&!$('#ov').classList.contains('open'))render()}});
/* ===== Liked songs. A liked song carries s.liked (the time it was liked) on the song itself, so it is saved, backed up and synced to Drive like every other song detail.
   The Liked Songs playlist is built from those songs (newest like first). The Settings switch only shows or hides the hearts and the playlist; likes are never deleted by it. ===== */
ICON.heart='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
ICON.heartO='M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z';
ICON.likeOff='M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z';
ICON.likeOn='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
const LIKEID='__liked';
var LIKE={on:LS('tracks-like')!=='0'};/* on unless switched off in Settings */
document.documentElement.dataset.like=LIKE.on?'on':'off';
const LIKED_COVER=svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#7c4dff'/><stop offset='.55' stop-color='#c04df0'/><stop offset='1' stop-color='#ff4d8d'/></linearGradient><radialGradient id='r' cx='.3' cy='.2' r='.9'><stop offset='0' stop-color='#fff' stop-opacity='.28'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs><rect width='200' height='200' fill='url(#g)'/><rect width='200' height='200' fill='url(#r)'/><path fill='#fff' transform='translate(46 46) scale(4.5)' d='"+ICON.heart+"'/></svg>");
const LIKEPL={id:LIKEID,name:'Liked Songs',cover:LIKED_COVER,desc:'Songs you have liked, newest first.',sys:true,songs:[]};
const likedIds=()=>songs.filter(s=>s.liked).sort((a,b)=>b.liked-a.liked).map(s=>s.id);
const likeBtn=s=>{const on=!!(s&&s.liked);return `<button class="ib lk${on?' on':''}" data-act="like" data-i="${on?1:0}" aria-pressed="${on}" aria-label="Like" title="${on?'Remove from Liked Songs':'Add to Liked Songs'}">${ic(on?'likeOn':'likeOff',22)}</button>`};
/* small filled heart in song rows (tap to like or unlike); hidden while selecting */
const likeBadgeHtml=s=>LIKE&&LIKE.on&&!selMode?`<button type="button" class="lkb${s.liked?' on':''}" data-act="like" data-id="${s.id}" aria-pressed="${!!s.liked}" aria-label="Like ${esc(s.name)}" title="${s.liked?'Remove from Liked Songs':'Add to Liked Songs'}">${ic(s.liked?'likeOn':'likeOff',18)}</button>`:'';
function likedCard(){const n=likedIds().length;return `<div class="acard"><button class="card" data-act="openpl" data-id="${LIKEID}">${plCover(LIKEPL)}<b>Liked Songs</b><span>${n} ${n===1?'song':'songs'}</span></button></div>`}
/* make every heart button (mini player, big player, side player bar) match the song that is playing */
function likePaint(){
  if(!LIKE)return;
  document.documentElement.dataset.like=LIKE.on?'on':'off';
  const s=songById(cur),on=!!(s&&s.liked);
  document.querySelectorAll('.one').forEach(b=>b.classList.toggle('on',on&&LIKE.on));
  document.querySelectorAll('.lk').forEach(b=>{
    b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label','Like');b.title=on?'Remove from Liked Songs':'Add to Liked Songs';
    const k=on?'1':'0';if(b.dataset.i!==k){b.dataset.i=k;b.innerHTML=ic(on?'likeOn':'likeOff',22)}
  });
}
function likeRows(id){
  const s=songById(id);if(!s)return;
  document.querySelectorAll('#main .row[data-id="'+id+'"] .d').forEach(d=>{const o=d.querySelector('.lkb');if(o)o.remove();const h=likeBadgeHtml(s);if(h)d.insertAdjacentHTML('afterbegin',h)});
}
async function toggleLike(id){
  if(!LIKE.on||!id)return;
  const s=songById(id);if(!s)return;
  const on=!s.liked;
  if(on)s.liked=Date.now();else delete s.liked;
  likePaint();likeRows(id);
  if(on&&id===cur)document.querySelectorAll('.lk svg').forEach(pop);
  toast(on?'Added to Liked Songs':'Removed from Liked Songs');
  await put('songs',s);/* stamps s.mod, so Drive sync picks the newest change */
  if(view.tab==='playlists'&&(!view.pl||view.pl===LIKEID))render();
}
function likeSet(on){
  if(on===LIKE.on)return;
  LIKE.on=on;LS('tracks-like',on?'1':'0');
  if(!on&&view.pl===LIKEID)view.pl=null;
  likePaint();render();
  toast(on?'Liked Songs is on':'Liked Songs is off. Your likes are kept.');
}

/* ===== One button for like / add to album / add to playlist. Switch: Settings > Playback > Player buttons.
   The button opens a small menu (role=menu): arrow keys / Home / End move, Enter or Space picks, Escape closes and gives focus back. ===== */
ICON.likeadd='M12.81 2.62 c-1.29 0 -2.52 0.6 -3.33 1.55 C8.67 3.22 7.44 2.62 6.15 2.62 3.87 2.62 2.08 4.41 2.08 6.69 c0 2.8 2.52 5.08 6.33 8.54 L9.48 16.2 l1.07 -0.98 C14.36 11.77 16.88 9.49 16.88 6.69 16.88 4.41 15.09 2.62 12.81 2.62zm-3.26 11.51 l-0.07 0.07 -0.07 -0.07 C5.88 10.94 3.56 8.83 3.56 6.69 3.56 5.21 4.67 4.1 6.15 4.1 c1.14 0 2.25 0.73 2.64 1.75 h1.38 C10.56 4.83 11.67 4.1 12.81 4.1 c1.48 0 2.59 1.11 2.59 2.59 0 2.14 -2.32 4.25 -5.85 7.44zM18 13.5h2v3.5h3.5v2H20v3.5h-2V19h-3.5v-2H18z';/* heart with a plus: unique, not confusable with the queue icon */
var ONE={on:LS('tracks-one')==='1'};
document.documentElement.dataset.one=ONE.on?'on':'off';
const oneBtn=()=>{const c=songById(cur),l=!!(LIKE.on&&c&&c.liked);return `<button type="button" class="ib one${l?' on':''}" data-act="one" aria-haspopup="menu" aria-expanded="false" aria-label="Like or add to album or playlist" title="Like, add to album or playlist">${ic('likeadd',22)}</button>`};
let ONEM=null;
function oneClose(back){
  const m=ONEM;if(!m)return;ONEM=null;
  document.removeEventListener('pointerdown',m.pd,true);document.removeEventListener('keydown',m.kd,true);removeEventListener('resize',m.cl);
  m.el.remove();m.btn.setAttribute('aria-expanded','false');
  if(back&&m.btn.isConnected)try{m.btn.focus({preventScroll:true})}catch(_){}
}
function oneOpen(btn){
  const was=ONEM&&ONEM.btn===btn;oneClose(false);if(was){btn.focus();return}
  const id=cur,sg=id&&songById(id);if(!sg)return;
  const it=[];
  if(LIKE.on)it.push({k:'like',t:sg.liked?'Remove from Liked Songs':'Add to Liked Songs',i:sg.liked?'likeOn':'likeOff'});
  it.push({k:'album',t:'Add to album',i:'album'},{k:'pl',t:'Add to playlist',i:'plist'});
  const el=document.createElement('div');el.className='onem';el.setAttribute('role','menu');el.setAttribute('aria-label','Like or add '+sg.name);
  el.innerHTML=it.map(x=>`<button type="button" class="onei" role="menuitem" tabindex="-1" data-k="${x.k}">${ic(x.i,20)}<span>${esc(x.t)}</span></button>`).join('');
  document.body.appendChild(el);
  const r=btn.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;
  el.style.left=Math.max(8,Math.min(r.left+r.width/2-w/2,innerWidth-w-8))+'px';
  el.style.top=Math.max(8,r.top-h-8>=8?r.top-h-8:Math.min(r.bottom+8,innerHeight-h-8))+'px';
  btn.setAttribute('aria-expanded','true');
  const items=[...el.querySelectorAll('.onei')];
  const m=ONEM={btn,el,
    pd:e=>{if(!el.contains(e.target)&&!btn.contains(e.target))oneClose(false)},
    kd:e=>{
      e.stopPropagation();/* player shortcuts (space = play / pause) must not fire while the menu is open */
      const i=items.indexOf(document.activeElement),k=e.key;
      if(k==='Escape'){e.preventDefault();oneClose(true)}
      else if(k==='ArrowDown'||k==='ArrowUp'||k==='Home'||k==='End'){
        e.preventDefault();
        const n=k==='Home'?0:k==='End'?items.length-1:i<0?(k==='ArrowDown'?0:items.length-1):(i+(k==='ArrowDown'?1:-1)+items.length)%items.length;
        items[n].focus();
      }else if(k==='Tab')oneClose(true);
    },
    cl:()=>oneClose(false)};
  document.addEventListener('pointerdown',m.pd,true);document.addEventListener('keydown',m.kd,true);addEventListener('resize',m.cl);
  el.addEventListener('click',async e=>{
    const b=e.target.closest('.onei');if(!b)return;e.stopPropagation();
    const k=b.dataset.k,s2=songById(id);oneClose(true);/* focus goes back to the button first, so the next sheet hands it back when it closes */
    if(!s2)return;
    if(k==='like')await toggleLike(id);
    else if(k==='album'){await moveSong(s2);render()}
    else if(k==='pl'){await addToPlaylist([id]);render()}
  });
  if(!PERF.f.ui&&!RM.matches)an(el,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:140,easing:EASE_OUT});
  items[0].focus();
}
function oneSet(on){
  if(on===ONE.on)return;
  ONE.on=on;LS('tracks-one',on?'1':'0');document.documentElement.dataset.one=on?'on':'off';oneClose(false);
  toast(on?'Like and add buttons are now one button':'Like and add buttons are shown separately');
}
{const _rm=renderMini;renderMini=function(){const r=_rm.apply(this,arguments);likePaint();return r}}
const _cs=cloudSheet;cloudSheet=function(){_cs.apply(this,arguments);cloudQuota()};
async function cloudQuota(){
  const B=x=>x>=1e9?(x/1e9).toFixed(1)+' GB':Math.round(x/1e6)+' MB';let h='';
  try{if(LS('tracks-cloud')&&CL.tok&&navigator.onLine){const r=await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota',{headers:{Authorization:'Bearer '+CL.tok}});
    if(r.ok){const q=(await r.json()).storageQuota,l=+q.limit,u=+q.usage;h+=l?`Drive: ${(u/l*100).toFixed(1)}% used, ${B(l-u)} left of ${B(l)}`:`Drive: ${B(u)} used`}}}catch(e){}
  try{const q=await navigator.storage.estimate();if(q.quota)h+=(h?'<br>':'')+`This device: ${(q.usage/q.quota*100).toFixed(1)}% used, ${B(q.quota-q.usage)} left`}catch(e){}
  const e=$('#cst');if(h&&e&&!$('#cqt'))e.insertAdjacentHTML('afterend',`<p id="cqt" style="margin:0 0 12px;color:var(--mute);font-size:14px">${h}</p>`)}

/* ===== backup file (.trax), storage protection, duplicate finder, shared files, app update ===== */
{const st=document.createElement('style');st.textContent='#gear.swu{outline:2px solid rgb(var(--ac));outline-offset:-3px;border-radius:50%}';document.head.appendChild(st)}
const bkSafeKey=k=>k!=='__proto__'&&k!=='constructor'&&k!=='prototype';
const BK_MAGIC='TRAXBK1\n',BK_STORES=['songs','albums','folders','playlists','pfolders','lyrics'],BK_SKIP=/^tracks-(tok|cid|cloud|dirty|tomb|last|reup|perf|perf-c)$/;
const bkAll=async n=>(await tx(n,'readonly',s=>s.getAll()))||[];
/* layout: magic | raw files | JSON index | 16-digit index length. Files are never loaded into memory, so big libraries work. */
async function bkExport(withAudio){
  const name='traXz-backup-'+new Date().toISOString().slice(0,10)+(withAudio?'':'-small')+'.trax';
  let w=null;
  if(window.showSaveFilePicker){try{w=await (await showSaveFilePicker({suggestedName:name,types:[{description:'traXz backup',accept:{'application/octet-stream':['.trax']}}]})).createWritable()}catch(e){if(e&&e.name==='AbortError')return}}
  try{
    toast('Preparing backup\u2026');
    const parts=[BK_MAGIC];let off=BK_MAGIC.length;
    const add=b=>{const o=off;parts.push(b);off+=b.size;return [o,b.size]};
    const pack=(v,d)=>{
      if(v instanceof Blob)return {$b:add(v),t:v.type};
      if(Array.isArray(v))return v.map(x=>pack(x,d+1));
      if(v&&typeof v==='object'&&d<4&&Object.getPrototypeOf(v)===Object.prototype){const o={};for(const k in v)o[k]=pack(v[k],d+1);return o}
      return v};
    const data={app:'traXz',kind:'full',v:2,date:new Date().toISOString(),audio:!!withAudio,stores:{},ls:{}};
    for(const n of BK_STORES)data.stores[n]=(await bkAll(n)).map(r=>{if(n==='songs'){r=Object.assign({},r);delete r.orig;if(!withAudio)delete r.blob}return pack(r,0)});
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^tracks-/.test(k)&&!BK_SKIP.test(k))data.ls[k]=localStorage.getItem(k)}
    const idx=new Blob([JSON.stringify(data)]);parts.push(idx,String(idx.size).padStart(16,'0'));
    if(w){for(const p of parts)await w.write(p);await w.close()}else dlBlob(new Blob(parts,{type:'application/octet-stream'}),name);
    toast(withAudio?'Full backup saved':'Small backup saved (no songs)');
  }catch(e){try{w&&await w.abort()}catch(_){}toast('Could not save the backup. For big libraries try the small backup plus Google Drive.')}
}
async function bkImport(file){
  try{
    if(await file.slice(0,BK_MAGIC.length).text()!==BK_MAGIC)return toast('That is not a traXz backup file');
    const n=+(await file.slice(-16).text()),end=file.size-16;if(!(n>0&&n<end))return toast('That backup file looks damaged');
    const d=JSON.parse(await file.slice(end-n,end).text());
    toast('Restoring\u2026');
    const un=v=>{if(Array.isArray(v))return v.map(un);if(v&&typeof v==='object'){if(v.$b)return file.slice(v.$b[0],v.$b[0]+v.$b[1],v.t||'');const r={};for(const k in v)if(bkSafeKey(k))r[k]=un(v[k]);return r}return v};
    const tm=tomb();let added=0;
    for(const n2 of BK_STORES){
      const have=new Map((await bkAll(n2)).map(r=>[r.id,r]));
      for(const r0 of d.stores[n2]||[]){
        const r=un(r0),o=have.get(r.id);
        if(o){if((r.mod||0)<=(o.mod||0))continue;if(n2==='songs'&&!r.blob&&o.blob)r.blob=o.blob}
        await tx(n2,'readwrite',s=>s.put(r));delete tm[n2+':'+r.id];added++}}
    LS('tracks-tomb',JSON.stringify(tm));
    for(const k in d.ls||{}){
      if(BK_SKIP.test(k)||!/^tracks-/.test(k)||typeof d.ls[k]!=='string'||d.ls[k].length>5e6)continue;/* only this app's own settings, only text */
      if(k==='tracks-stats'){try{const a=JSON.parse(LS(k)||'{}'),b=JSON.parse(d.ls[k]);for(const i in b){const x=a[i];a[i]=x?{s:Math.max(x.s||0,b[i].s||0),n:Math.max(x.n||0,b[i].n||0)}:b[i]}LS(k,JSON.stringify(a))}catch(_){}}
      else if(LS(k)===null)LS(k,d.ls[k])}
    cloudDirty();toast('Restored '+added+' items. Reloading\u2026');setTimeout(()=>location.reload(),1400);
  }catch(e){console.warn(e);toast('Could not restore that backup file')}
}
/* storage protection */
async function stoPaint(){
  const a=$('#stos'),b=$('#stov');if(!a||!navigator.storage||!navigator.storage.persisted){if(a)a.textContent='Not supported in this browser';return}
  try{const p=await navigator.storage.persisted(),q=navigator.storage.estimate?await navigator.storage.estimate():{};
    const u=q.quota?' ('+fmtSize(q.usage||0)+' used)':'';
    a.textContent=p?'Protected from automatic clearing.'+u:'Not protected. Tap to protect your songs.'+u;
    b.textContent=p?'On':'Off'}catch(e){a.textContent='Could not check'}
}
async function stoAsk(){
  try{if(await navigator.storage.persisted()){toast('Already protected');return}
    const ok=navigator.storage.persist&&await navigator.storage.persist();
    toast(ok?'Library is now protected':'The browser said no. Installing the app to your home screen usually helps.')}catch(e){}
  stoPaint()}
/* duplicate finder */
function dupGroups(){
  const par={},f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x]}return x},un=(a,b)=>{par[f(a)]=f(b)};
  const bySize={},byT={},pc={};
  for(const p of playlists)for(const i of p.songs||[])pc[i]=(pc[i]||0)+1;
  for(const s of songs)par[s.id]=s.id;
  for(const s of songs){
    if(s.blob&&s.blob.size>0){const k=s.blob.size+':'+Math.round(s.dur||0);if(bySize[k]!==undefined)un(bySize[k],s.id);else bySize[k]=s.id}
    const t=tkey(s.name);
    if(t){const k=t+'|'+nkey(artOf(s)),a=byT[k]||(byT[k]=[]);for(const o of a)if(!(s.dur&&o.dur)||Math.abs(s.dur-o.dur)<=4)un(o.id,s.id);a.push(s)}}
  const g={};for(const s of songs)(g[f(s.id)]||(g[f(s.id)]=[])).push(s);
  const sc=s=>[s.blob?1:0,((ST[s.id]&&ST[s.id].n)||0)+(pc[s.id]||0)+(s.liked?1:0),s.blob?s.blob.size:0];
  return Object.values(g).filter(a=>a.length>1).map(a=>a.sort((x,y)=>{const p=sc(x),q=sc(y);return q[0]-p[0]||q[1]-p[1]||q[2]-p[2]})).sort((a,b)=>tkey(a[0].name).localeCompare(tkey(b[0].name)));
}
async function dupMerge(k,r){
  let ch=false;
  if(!k.album&&r.album){k.album=r.album;ch=true}
  if(r.liked&&!k.liked){k.liked=r.liked;ch=true}
  if(!k.blob&&r.blob){k.blob=r.blob;ch=true}
  if(ch)await put('songs',k);
  for(const p of playlists)if((p.songs||[]).includes(r.id)){p.songs=p.songs.map(i=>i===r.id?k.id:i).filter((i,x,a)=>a.indexOf(i)===x);await put('playlists',p)}
  const a=ST[r.id];if(a){const b=ST[k.id]||{s:0,n:0};ST[k.id]={s:(b.s||0)+(a.s||0),n:(b.n||0)+(a.n||0)};delete ST[r.id];stSave()}
  const sw=x=>x.map(i=>i===r.id?k.id:i);queue=sw(queue);upNext=sw(upNext);if(ctxCur===r.id)ctxCur=k.id;
  if(cur===r.id){au.pause();au.removeAttribute('src');cur=null;closeFull()}
  await del('songs',r.id);songs=songs.filter(s=>s.id!==r.id);
}
function dupSheet(){
  const G=dupGroups(),mm=s=>Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0');
  if(!G.length){openOv('<h3>Duplicate songs</h3><p style="margin:0 0 14px;color:var(--mute)">No duplicates found. Your library is clean.</p><button type="button" class="pill acc" id="dpx">Close</button>');$('#dpx').onclick=closeOv;return}
  const rows=G.map((g,gi)=>`<div style="margin:14px 0 2px;font-size:13px;font-weight:700;color:var(--mute)">${esc(g[0].name)}</div>`+g.map((s,i)=>`<label class="pk"><input type="checkbox" data-k="${gi}:${i}"${i?' checked':''}><span class="t"><b>${esc(s.name)}${i?'':' (best copy, kept)'}</b><small>${esc(artOf(s)||'Unknown artist')} \u00b7 ${s.dur?mm(s.dur)+' \u00b7 ':''}${s.blob?fmtSize(s.blob.size):'not on this device'}</small></span></label>`).join('')).join('');
  openOv(`<h3>Duplicate songs</h3><p style="margin:0 0 4px;color:var(--mute)">${G.length} ${G.length===1?'song appears':'songs appear'} more than once. Ticked copies are removed; their playlist spots, likes and play counts move to the copy you keep.</p>${rows}<div class="bt" style="margin-top:14px"><button type="button" class="pill" id="dpx">Cancel</button><button type="button" class="pill acc" id="dpr"></button></div>`);
  const boxes=()=>[...document.querySelectorAll('#ov [data-k]')],lab=()=>{const n=boxes().filter(b=>b.checked).length;$('#dpr').textContent='Remove '+n;$('#dpr').disabled=!n};
  $('#ov').onchange=lab;lab();$('#dpx').onclick=closeOv;
  $('#dpr').onclick=async()=>{
    const on=new Set(boxes().filter(b=>b.checked).map(b=>b.dataset.k));let n=0;
    for(let gi=0;gi<G.length;gi++){
      let rm=G[gi].filter((s,i)=>on.has(gi+':'+i));if(rm.length===G[gi].length)rm=rm.slice(1);
      const k=G[gi].find(s=>!rm.includes(s));for(const r of rm){await dupMerge(k,r);n++}}
    closeOv();render();toast('Removed '+n+(n===1?' duplicate':' duplicates'))};
}
/* songs shared into the app from another app (Web Share Target, see sw.js) */
async function shareIntake(){
  try{
    if(!/[?&]shared=/.test(location.search))return;
    history.replaceState(null,'',location.pathname);
    const c=await caches.open('trax-share'),fs=[];
    for(const k of await c.keys()){const r=await c.match(k),b=await r.blob();fs.push(new File([b],decodeURIComponent(r.headers.get('X-Name')||'shared.mp3'),{type:r.headers.get('Content-Type')||b.type||'audio/mpeg'}));await c.delete(k)}
    if(fs.length)await addFiles(fs);
  }catch(e){toast('Could not import the shared songs')}
}
/* ===== share a song as a link =====
   Sender: the audio (and a small cover) go to the sender's Drive as "anyone with the link can view". The link is
   <app>/?play=<audioId>[.<coverId>]&t=<title>&a=<artist>&f=<feat|feat>.
   Receiver: the app opens on a play card that streams the file straight from Drive (nothing is saved or downloaded),
   with Add song / Export song / decline (X). Reading a public Drive file needs GKEY, a Google API key limited to the Drive API. */
const SH_API='https://www.googleapis.com/drive/v3/files/',SH_KEY='tracks-shared';
const shMap=()=>{try{return JSON.parse(LS(SH_KEY)||'{}')||{}}catch(e){return{}}};
const shSave=m=>LS(SH_KEY,JSON.stringify(m));
const shSafe=n=>String(n||'song').replace(/[\\/:*?"<>|]+/g,'_').trim().slice(0,100)||'song';
const shAuthErr=e=>/reconnect|Session expired|Token expired/.test((e&&e.message)||'');
const shBase=()=>/^https?:$/.test(location.protocol)&&!/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)?redir():SP_REDIRECTS[SP_REDIRECTS.length-1];
const shLink=r=>shBase()+'?play='+r.a+(r.c?'.'+r.c:'')+'&t='+encodeURIComponent(r.t||'')+(r.r?'&a='+encodeURIComponent(r.r):'')+((r.f||[]).length?'&f='+encodeURIComponent(r.f.join('|')):'');

/* ---- sender ---- */
async function shFolder(){
  let f=LS('tracks-shfid');
  if(f){try{const j=await (await gapi(DV+'/'+f+'?fields=trashed')).json();if(!j.trashed)return f}catch(e){if(shAuthErr(e))throw e}}
  const q=encodeURIComponent("name='Tracks shared' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const j=await (await gapi(DV+'?q='+q+'&fields=files(id)')).json();
  f=j.files[0]?j.files[0].id:(await (await gapi(DV,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Tracks shared',mimeType:'application/vnd.google-apps.folder'})})).json()).id;
  LS('tracks-shfid',f);return f;
}
function shPut(url,blob,type,on){return new Promise((res,rej)=>{
  const x=new XMLHttpRequest();x.open('PUT',url);x.setRequestHeader('Content-Type',type);
  x.upload.onprogress=e=>{if(on&&e.lengthComputable)on(e.loaded/e.total)};
  x.onload=()=>{if(x.status>=200&&x.status<300){try{res(JSON.parse(x.responseText).id)}catch(e){rej(new Error('Upload failed'))}}else rej(new Error('Upload '+x.status))};
  x.onerror=()=>rej(new Error('Upload failed. Check your connection'));x.send(blob)})}
async function shUp(name,blob,type,parent,on){
  type=type||'application/octet-stream';
  const r=await gapi(DU+'?uploadType=resumable&fields=id',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':type},body:JSON.stringify({name,parents:[parent]})});
  return shPut(r.headers.get('Location'),blob,type,on);
}
const shPub=id=>gapi(DV+'/'+id+'/permissions?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reader',type:'anyone',allowFileDiscovery:false})});
function shCoverBlob(src){return new Promise(res=>{
  if(!src)return res(null);
  const i=new Image();
  i.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=360;const m=Math.min(i.width,i.height);c.getContext('2d').drawImage(i,(i.width-m)/2,(i.height-m)/2,m,m,0,0,360,360);c.toBlob(b=>res(b),'image/jpeg',.85)}catch(e){res(null)}};
  i.onerror=()=>res(null);i.src=src})}

function shSetup(){
  openOv(`<h3>Share links need one setup step</h3><p class="dupn">People who open your link are not signed in to your Google account, so the app reads the shared song with a Google API key.</p><p class="dupn">1. In Google Cloud Console, open the project that has your OAuth client ID and make sure the Google Drive API is enabled.<br>2. Credentials, Create credentials, API key. Under API restrictions pick Google Drive API, and under Website restrictions add your app address.<br>3. Paste the key into index.html at <b>const GKEY=''</b> and deploy again.</p><div class="bt"><button type="button" class="pill acc" id="shx">Close</button></div>`);
  $('#shx').onclick=closeOv;
}
async function shareSong(s){
  if(!s.blob)return toast('Download this song from Drive first');
  if(!GKEY)return shSetup();
  if(!LS('tracks-cloud')){toast('Connect Google Drive first');return cloudSheet()}
  const r=shMap()[s.id];
  if(r&&r.sz===s.blob.size)return shareSheet(s,r);
  openOv(`<h3>Share song</h3><p class="dupn">This uploads <b>${esc(s.name)}</b> to your Google Drive and lets anyone with the link play it in traXz. They can add it to their library or export it. You can stop sharing at any time.</p><div class="bt"><button type="button" class="pill" id="shn">Cancel</button><button type="button" class="pill acc" id="shg">Create link</button></div>`);
  $('#shn').onclick=closeOv;$('#shg').onclick=()=>shMake(s);
}
async function shMake(s){
  openOv(`<h3>Creating link</h3><p class="dupn" id="shp">Getting ready\u2026</p>`);
  const say=t=>{const e=$('#shp');if(e)e.textContent=t},ids=[];
  try{
    await token(false);
    const fo=await shFolder(),ty=s.blob.type||'audio/mpeg',ex=(ty.split('/')[1]||'mp3').replace('mpeg','mp3').replace(/[^a-z0-9].*$/i,'')||'mp3',nm=shSafe(s.name);
    const aid=await shUp(nm+'.'+ex,s.blob,ty,fo,p=>say('Uploading '+Math.round(p*100)+'%'));ids.push(aid);
    let cid2='';
    const cb=await shCoverBlob(s.cover||(albumOf(s)||{}).cover);
    if(cb){say('Adding the cover\u2026');cid2=await shUp(nm+'-cover.jpg',cb,'image/jpeg',fo);ids.push(cid2)}
    say('Making the link\u2026');
    for(const i of ids)await shPub(i);
    const m=shMap();m[s.id]={a:aid,c:cid2,t:s.name,r:artOf(s),f:featOf(s),sz:s.blob.size};shSave(m);
    shareSheet(s,m[s.id]);
  }catch(e){
    for(const i of ids)gapi(DV+'/'+i,{method:'DELETE'}).catch(()=>{});
    if(shAuthErr(e)){closeOv();toast('Connect Google Drive again first');cloudSheet();return}
    openOv(`<h3>Could not create the link</h3><p class="dupn">${esc((e&&e.message)||'Something went wrong')}</p><div class="bt"><button type="button" class="pill acc" id="shx">Close</button></div>`);
    $('#shx').onclick=closeOv;
  }
}
function shareSheet(s,r){
  const url=shLink(r),who=[r.r,(r.f||[]).length?'feat. '+r.f.join(', '):''].filter(Boolean).join(' ');
  openOv(`<h3>Share song</h3><p class="dupn">Anyone with this link can play <b>${esc(r.t||s.name)}</b>${who?' by '+esc(who):''} in traXz, then add it to their library or export it.</p><input type="text" id="shl" readonly value="${esc(url)}" style="margin-bottom:12px"><div class="bt"><button type="button" class="pill" id="shoff">Stop sharing</button><button type="button" class="pill" id="shcp">Copy link</button>${navigator.share?'<button type="button" class="pill acc" id="shnat">Share\u2026</button>':''}</div>`);
  const inp=$('#shl');inp.onfocus=()=>inp.select();
  $('#shcp').onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('Link copied'),()=>{inp.focus();inp.select();toast('Press copy on the selected link')});
  const nat=$('#shnat');if(nat)nat.onclick=()=>navigator.share({title:r.t||s.name,text:'Listen to '+(r.t||s.name)+(who?' by '+who:''),url}).catch(()=>{});
  $('#shoff').onclick=()=>shStop(s,r);
}
async function shStop(s,r){
  try{
    for(const i of [r.a,r.c].filter(Boolean)){try{await gapi(DV+'/'+i,{method:'DELETE'})}catch(e){if(!/Drive 404/.test((e&&e.message)||''))throw e}}
  }catch(e){return toast(shAuthErr(e)?'Connect Google Drive again to stop sharing':'Could not stop sharing')}
  const m=shMap();delete m[s.id];shSave(m);closeOv();toast('Sharing stopped. The link no longer works');
}

/* ---- receiver: the play card ---- */
function shareOpen(){
  let q;try{q=new URLSearchParams(location.search)}catch(e){return}
  const p=q.get('play');if(p===null)return;
  const m=/^([\w-]{10,100})(?:\.([\w-]{10,100}))?$/.exec(p);
  const I={t:(q.get('t')||'').trim().slice(0,120)||'Shared song',a:(q.get('a')||'').trim().slice(0,120),f:(q.get('f')||'').split('|').map(x=>x.trim()).filter(Boolean).slice(0,6)};
  const url=(id,x)=>SH_API+id+'?'+(x||'')+'key='+encodeURIComponent(GKEY);
  try{au.pause()}catch(e){}
  const root=document.createElement('div');root.id='shc';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Shared song');
  const a=new Audio();a.preload='metadata';
  let ext='mp3',mime='audio/mpeg',blobP=null,coverP=null,dead=false,seeking=false;
  const key=e=>{if(e.key==='Escape'){e.preventDefault();done()}};
  const done=()=>{
    dead=true;a.pause();a.removeAttribute('src');try{a.load()}catch(e){}
    document.removeEventListener('keydown',key,true);root.remove();
    try{history.replaceState(null,'',location.pathname)}catch(e){}
  };
  const bad=(t,msg)=>{
    dead=true;a.pause();
    root.innerHTML=`<div class="shk bad"><button type="button" class="ib shx" aria-label="Close">${ic('close',22)}</button><h3>${esc(t)}</h3><p class="dupn">${esc(msg)}</p><button type="button" class="pill acc" id="shbx">Close</button></div>`;
    root.querySelector('.shx').onclick=root.querySelector('#shbx').onclick=done;
  };
  document.body.appendChild(root);document.addEventListener('keydown',key,true);
  if(!m)return bad('Link not valid','This share link looks incomplete. Ask for a new one.');
  if(!GKEY)return bad('Cannot open this song','This copy of the app is not set up to open shared songs yet.');
  const who=I.a+(I.f.length?(I.a?' ':'')+'feat. '+I.f.join(', '):'');
  root.innerHTML=`<div class="shk">
    <button type="button" class="ib shx" aria-label="Decline and close">${ic('close',22)}</button>
    <button type="button" class="pill acc sha" id="sha"><span>Add song</span></button>
    <div class="shcv">${cover({name:I.t})}</div>
    <button type="button" class="pill shb" id="shb"><span>Export song</span></button>
    <div class="shti"><b>${esc(I.t)}</b>${who?`<span>${esc(who)}</span>`:''}</div>
    <div class="shsk"><input type="range" class="rng" id="shsk" min="0" max="1000" value="0" aria-label="Seek"><div class="shtm"><span id="sht1">0:00</span><span id="sht2">0:00</span></div></div>
    <div class="shct"><button type="button" class="ib" id="shbk" aria-label="Back 10 seconds">${ic('prev',24)}</button><button type="button" class="ib shpl" id="shpl" aria-label="Play">${ic('play',30)}</button><button type="button" class="ib" id="shfw" aria-label="Forward 10 seconds">${ic('next',24)}</button></div>
    <div class="shvl">${ic('vol',18)}<input type="range" class="rng" id="shvl" min="0" max="100" value="100" aria-label="Volume"></div>
  </div>`;
  const g=s=>root.querySelector(s),sk=g('#shsk'),pl=g('#shpl'),vl=g('#shvl');
  const fill=el=>el.style.setProperty('--p',(el.value/el.max*100)+'%');
  const du=()=>isFinite(a.duration)?a.duration:0;
  const paint=()=>{if(!seeking&&du()){sk.value=a.currentTime/du()*1000;fill(sk)}g('#sht1').textContent=fmt(a.currentTime);g('#sht2').textContent=fmt(du())};
  a.ontimeupdate=a.onloadedmetadata=a.ondurationchange=paint;
  a.onplay=()=>{pl.innerHTML=ic('pause',30);pl.setAttribute('aria-label','Pause')};
  a.onpause=a.onended=()=>{pl.innerHTML=ic('play',30);pl.setAttribute('aria-label','Play')};
  a.onerror=()=>{if(!dead)bad('Song unavailable','This song could not be loaded. The link may have been turned off, or you may be offline.')};
  pl.onclick=()=>{if(a.paused)a.play().catch(()=>toast('Could not play this song'));else a.pause()};
  g('#shbk').onclick=()=>{a.currentTime=Math.max(0,a.currentTime-10)};
  g('#shfw').onclick=()=>{if(du())a.currentTime=Math.min(du(),a.currentTime+10)};
  sk.oninput=()=>{seeking=true;fill(sk);if(du())g('#sht1').textContent=fmt(sk.value/1000*du())};
  sk.onchange=()=>{if(du())a.currentTime=sk.value/1000*du();seeking=false};
  vl.oninput=()=>{a.volume=vl.value/100;fill(vl)};fill(sk);fill(vl);
  g('.shx').onclick=done;
  a.src=url(m[1],'alt=media&');
  /* cover and file details load in the background; the card is usable at once */
  const coverBlob=()=>coverP||(coverP=m[2]?fetch(url(m[2],'alt=media&')).then(r=>{if(!r.ok)throw 0;return r.blob()}):Promise.resolve(null));
  coverBlob().then(b=>{if(b&&!dead)g('.shcv').innerHTML=cover({cover:URL.createObjectURL(b),name:I.t})}).catch(()=>{});
  fetch(url(m[1],'fields=name,mimeType&')).then(r=>{if(!r.ok)throw r.status;return r.json()}).then(j=>{
    const e=/\.([a-z0-9]{2,5})$/i.exec(j.name||'');if(e)ext=e[1].toLowerCase();
    mime=/^audio\//.test(j.mimeType||'')?j.mimeType:(Z_MIME[ext]||mime);
  }).catch(c=>{if((c===404||c===403)&&!dead)bad('Song unavailable','This song is no longer shared.')});
  const blob=()=>blobP||(blobP=fetch(url(m[1],'alt=media&')).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.blob()}).catch(e=>{blobP=null;throw e}));
  const busy=(b,on,txt)=>{b.disabled=on;b.style.opacity=on?.6:'';b.querySelector('span').textContent=txt};
  g('#shb').onclick=async()=>{
    const b=g('#shb');busy(b,true,'Saving\u2026');
    try{const x=await blob();dlBlob(x,shSafe(I.t)+'.'+ext);toast('Song exported')}catch(e){toast('Could not download the song')}
    if(!dead)busy(b,false,'Export song');
  };
  g('#sha').onclick=async()=>{
    const b=g('#sha');busy(b,true,'Adding\u2026');
    let x,cv=null;
    try{x=await blob()}catch(e){busy(b,false,'Add song');return toast('Could not download the song')}
    try{const cb=await coverBlob();if(cb)cv=await makeCover(cb)}catch(e){}
    const f=new File([x],shSafe(I.t)+'.'+ext,{type:mime});
    done();/* close the card first: a duplicate question from the library has to be visible */
    const r=await addFiles([f]);
    const s=r&&r.ids&&r.ids[0]?songById(r.ids[0]):null;
    if(s){s.name=I.t;if(I.a)s.artist=I.a;if(I.f.length)s.feat=I.f;if(cv){s.cover=cv.data;s.ccol=cv.color}await put('songs',s);render()}
  };
  try{
    an(root,[{opacity:0},{opacity:1}],{duration:220,easing:'linear'});
    an(g('.shk'),[{opacity:0,transform:'translateY(18px) scale(.95)'},{opacity:1,transform:'none'}],{duration:380,easing:EASE_OUT});
  }catch(e){}
  pl.focus({preventScroll:true});
}
/* ===== share an album or a playlist as a link =====
   Same Google Drive setup as Share song. Every song (and one small cover) is uploaded to "Tracks shared" as
   "anyone with the link can view", plus one tiny manifest .json that lists the songs in order. The link is
   <app>/?album=<id> or <app>/?playlist=<id>, so it stays short however long the list is.
   Receiver: the app opens a card that streams the songs from Drive. "Add album" / "Add playlist" downloads them all,
   adds them to the library in order and builds the album or playlist. Updating the link re-uses songs that did not change.
   Settings > Backup > Ongoing shares lists everything that is still shared and can stop it. */
const SA_KEY='tracks-shalb';
const saMap=()=>{try{return JSON.parse(LS(SA_KEY)||'{}')||{}}catch(e){return{}}};
const saSave=m=>LS(SA_KEY,JSON.stringify(m));
const saKind=k=>k==='p'||k==='playlist'?{k:'p',w:'playlist',list:o=>plSongs(o.id)}:{k:'a',w:'album',list:o=>albumSongs(o.id)};
const saLink=r=>shBase()+'?'+saKind(r.k).w+'='+r.m;
const saCov=(o,l)=>o.cover||l.map(s=>songCover(s).cover).find(Boolean)||null;/* a playlist without its own cover borrows the first song cover */
const saSig=(a,l)=>[a.name,a.artist||'',(a.feat||[]).join(','),saCov(a,l)?saCov(a,l).length:0].join('|')+'#'+l.map(s=>[s.id,s.blob?s.blob.size:'-',s.name,artOf(s),featOf(s).join(',')].join(':')).join('|');
/* delete Drive files; a file that is already gone (404) counts as deleted, any other failure is reported so nothing stays public by mistake */
const saDel=async ids=>{for(const i of ids.filter(Boolean)){try{await gapi(DV+'/'+i,{method:'DELETE'})}catch(e){if(!/Drive 404/.test((e&&e.message)||''))throw e}}};

/* ---- sender ---- */
async function shareColl(kind,a){
  const K=saKind(kind),list=K.list(a);
  if(!list.length)return toast('This '+K.w+' is empty');
  if(!GKEY)return shSetup();
  if(!LS('tracks-cloud')){toast('Connect Google Drive first');return cloudSheet()}
  const r=saMap()[a.id];
  if(r)return saSheet(a,r);
  const mb=list.reduce((n,s)=>n+(s.blob?s.blob.size:0),0)/1048576,miss=list.filter(s=>!s.blob).length;
  openOv(`<h3>Share ${K.w}</h3><p class="dupn">This uploads the ${list.length} ${list.length===1?'song':'songs'} of <b>${esc(a.name)}</b>${mb?' (about '+Math.max(1,Math.round(mb))+' MB)':''} to your Google Drive and lets anyone with the link play the ${K.w} in traXz. They can add the whole ${K.w} to their library. You can stop sharing at any time in Settings, Backup, Ongoing shares.${miss?' '+miss+(miss===1?' song is':' songs are')+' still in Drive only and will be downloaded first.':''}</p><div class="bt"><button type="button" class="pill" id="shn">Cancel</button><button type="button" class="pill acc" id="shg">Create link</button></div>`);
  $('#shn').onclick=closeOv;$('#shg').onclick=()=>saMake(kind,a,null);
}
async function saMake(kind,a,old){
  const K=saKind(kind);
  openOv(`<h3>${old?'Updating link':'Creating link'}</h3><p class="dupn" id="shp">Getting ready\u2026</p>`);
  const say=t=>{const e=$('#shp');if(e)e.textContent=t},fresh=[];
  try{
    const list=K.list(a);
    if(!list.length)throw new Error('This '+K.w+' is empty');
    for(let i=0;i<list.length;i++)if(!list[i].blob){say('Downloading \u201c'+list[i].name+'\u201d from Drive\u2026');await cloudFetch(list[i],false)}
    await token(false);
    const fo=await shFolder(),prev=(old&&old.s)||{},keep={},tr=[];
    for(let i=0;i<list.length;i++){
      const s=list[i],p=prev[s.id],ty=s.blob.type||'audio/mpeg',ex=(ty.split('/')[1]||'mp3').replace('mpeg','mp3').replace(/[^a-z0-9].*$/i,'')||'mp3';
      let aid;
      if(p&&p.sz===s.blob.size)aid=p.a;/* unchanged since the last time: keep the uploaded file */
      else{
        aid=await shUp(shSafe(s.name)+'.'+ex,s.blob,ty,fo,pc=>say('Uploading song '+(i+1)+' of '+list.length+' \u00b7 '+Math.round(pc*100)+'%'));
        fresh.push(aid);say('Sharing song '+(i+1)+' of '+list.length+'\u2026');await shPub(aid);
      }
      keep[s.id]={a:aid,sz:s.blob.size,x:ex};
      tr.push({i:aid,t:s.name,a:artOf(s),f:featOf(s),d:Math.round(s.dur||0),x:ex});
    }
    const cs=saCov(a,list),ck=cs?cs.length:0;let cid2='',oldC='';
    if(old&&old.c&&old.ck===ck)cid2=old.c;
    else{
      oldC=(old&&old.c)||'';
      const cb=await shCoverBlob(cs);
      if(cb){say('Adding the cover\u2026');cid2=await shUp(shSafe(a.name)+'-cover.jpg',cb,'image/jpeg',fo);fresh.push(cid2);await shPub(cid2)}
    }
    say('Making the link\u2026');
    const man=new Blob([JSON.stringify({v:1,k:K.k,t:a.name,a:a.artist||'',f:(a.feat||[]).filter(Boolean),c:cid2,s:tr})],{type:'application/json'});
    let mid='';
    if(old){try{await dUp('share.json',man,'application/json',old.m);mid=old.m}catch(e){if(!/Drive 404/.test((e&&e.message)||''))throw e}}/* same id = same link */
    if(!mid){mid=await shUp(shSafe(a.name)+' ('+K.w+').json',man,'application/json',fo);fresh.push(mid);await shPub(mid)}
    const m=saMap();m[a.id]={k:K.k,m:mid,c:cid2,ck,s:keep,t:a.name,n:list.length,sig:saSig(a,list),ts:(old&&old.ts)||Date.now()};saSave(m);
    /* only now drop what the new list no longer needs */
    const gone=Object.keys(prev).filter(k=>!keep[k]).map(k=>prev[k].a);if(oldC)gone.push(oldC);
    try{await saDel(gone)}catch(e){}
    saSheet(a,m[a.id]);
  }catch(e){
    try{await saDel(fresh)}catch(_){}
    if(shAuthErr(e)){closeOv();toast('Connect Google Drive again first');cloudSheet();return}
    openOv(`<h3>Could not create the link</h3><p class="dupn">${esc((e&&e.message)||'Something went wrong')}</p><div class="bt"><button type="button" class="pill acc" id="shx">Close</button></div>`);
    $('#shx').onclick=closeOv;
  }
}
function saSheet(a,r){
  const K=saKind(r.k),url=saLink(r),stale=r.sig!==saSig(a,K.list(a)),who=a.artist||'';
  openOv(`<h3>Share ${K.w}</h3><p class="dupn">Anyone with this link can play <b>${esc(a.name)}</b>${who?' by '+esc(who):''} (${r.n} ${r.n===1?'song':'songs'}) in traXz, then add the whole ${K.w} to their library.${stale?' This '+K.w+' has changed since you made the link. Update it to share the new version (the link stays the same).':''}</p><input type="text" id="shl" readonly value="${esc(url)}" style="margin-bottom:12px"><div class="bt" style="flex-wrap:wrap"><button type="button" class="pill" id="shoff">Stop sharing</button>${stale?'<button type="button" class="pill" id="shup">Update</button>':''}<button type="button" class="pill" id="shcp">Copy link</button>${navigator.share?'<button type="button" class="pill acc" id="shnat">Share\u2026</button>':''}</div>`);
  const inp=$('#shl');inp.onfocus=()=>inp.select();
  $('#shcp').onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('Link copied'),()=>{inp.focus();inp.select();toast('Press copy on the selected link')});
  const nat=$('#shnat');if(nat)nat.onclick=()=>navigator.share({title:a.name,text:'Listen to '+a.name+(who?' by '+who:''),url}).catch(()=>{});
  const up=$('#shup');if(up)up.onclick=()=>saMake(r.k,a,r);
  $('#shoff').onclick=async()=>{
    try{await saDrop({t:'col',id:a.id,ids:saIds(r)})}
    catch(e){return toast(shAuthErr(e)?'Connect Google Drive again to stop sharing':'Could not stop sharing')}
    closeOv();toast('Sharing stopped. The link no longer works');
  };
}
const saIds=r=>Object.values(r.s||{}).map(x=>x.a).concat([r.c,r.m]);

/* ---- Settings > Backup > Ongoing shares ---- */
function shItems(){
  const out=[],sm=shMap(),am=saMap();
  for(const id in sm){const r=sm[id],s=songById(id);out.push({t:'song',id,name:r.t||(s&&s.name)||'Song',sub:'Song'+(r.r?' \u00b7 '+r.r:''),ids:[r.a,r.c],url:shLink(r),gone:!s,open:s?()=>shareSheet(s,r):null,ts:0})}
  for(const id in am){
    const r=am[id],K=saKind(r.k),o=K.w==='playlist'?playlists.find(x=>x.id===id):albums.find(x=>x.id===id);
    out.push({t:'col',id,name:r.t||(o&&o.name)||K.w,sub:(K.w==='playlist'?'Playlist':'Album')+' \u00b7 '+r.n+(r.n===1?' song':' songs'),ids:saIds(r),url:saLink(r),gone:!o,open:o?()=>saSheet(o,r):null,ts:r.ts||0})
  }
  return out.sort((x,y)=>y.ts-x.ts);
}
const shCount=()=>Object.keys(shMap()).length+Object.keys(saMap()).length;
async function saDrop(it){/* delete the Drive files first; forget the share only when that worked */
  await saDel(it.ids);
  if(it.t==='song'){const m=shMap();delete m[it.id];shSave(m)}else{const m=saMap();delete m[it.id];saSave(m)}
}
function sharesSheet(){
  const items=shItems();
  openOv(`<div class="sth"><h3>Ongoing shares</h3><button type="button" class="pill acc" id="shdn">Back</button></div>
  <p class="dupn" style="margin:2px 2px 8px">Songs, albums and playlists you are still sharing with a link. Stopping deletes the shared copies from your Google Drive, so the link stops working. Your library is not touched.</p>
  ${items.length?`<div class="scd shl">${items.map((it,i)=>`<div class="shr" data-i="${i}"><button type="button" class="st shro" data-a="open"${it.open?'':' disabled'}><b>${esc(it.name)}</b><small>${esc(it.sub)}${it.gone?' \u00b7 removed from your library':''}</small></button><button type="button" class="pill" data-a="cp">Copy</button><button type="button" class="pill" data-a="st">Stop</button></div>`).join('')}</div><div class="bt"><button type="button" class="pill" id="shall">Stop all (${items.length})</button></div>`:`<div class="empty" style="padding:26px 8px">You are not sharing anything.<br>Use Share on a song, album or playlist to make a link.</div>`}`);
  const back=()=>{setTab='data';openSettings()};
  $('#shdn').onclick=back;
  const fail=e=>{if(shAuthErr(e)){toast('Connect Google Drive again to stop sharing');closeOv();cloudSheet()}else toast('Could not stop sharing')};
  const root=$('#ov .sheet');/* the sheet is rebuilt on every open, so this handler goes away with it */
  root.onclick=async e=>{
    const b=e.target.closest('[data-a]');if(!b)return;
    const it=items[+b.closest('.shr').dataset.i];if(!it)return;
    if(b.dataset.a==='open'){if(it.open)it.open();return}
    if(b.dataset.a==='cp')return navigator.clipboard.writeText(it.url).then(()=>toast('Link copied'),()=>toast('Could not copy the link'));
    if(b.dataset.a==='st'){
      b.disabled=true;b.textContent='Stopping\u2026';
      try{await saDrop(it)}catch(x){return fail(x)}
      toast('Sharing stopped');sharesSheet();
    }
  };
  const all=$('#shall');
  if(all)all.onclick=async()=>{
    const ok=await choose('Stop sharing everything?',[{label:'Stop all '+items.length+' shares',value:1,danger:true}]);
    if(!ok){sharesSheet();return}
    openOv(`<h3>Stopping shares</h3><p class="dupn" id="shp">Working\u2026</p>`);
    let n=0;
    for(const it of items){
      const e=$('#shp');if(e)e.textContent='Stopping '+(n+1)+' of '+items.length+'\u2026';
      try{await saDrop(it);n++}catch(x){return fail(x)}
    }
    toast('Stopped '+n+(n===1?' share':' shares'));sharesSheet();
  };
}

/* ---- receiver: the album / playlist card ---- */
function albumOpen(){
  let q;try{q=new URLSearchParams(location.search)}catch(e){return}
  const isP=q.get('playlist')!==null,p=isP?q.get('playlist'):q.get('album');if(p===null)return;
  let W=isP?'playlist':'album';
  const ID=/^[\w-]{10,100}$/,clip=(v,n)=>String(v==null?'':v).trim().slice(0,n);
  const url=(id,x)=>SH_API+id+'?'+(x||'')+'key='+encodeURIComponent(GKEY);
  try{au.pause()}catch(e){}
  const root=document.createElement('div');root.id='shc';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Shared '+W);
  const a=new Audio();a.preload='none';
  let dead=false,seeking=false,I=-1,T=[],M=null,coverP=null;
  const key=e=>{if(e.key==='Escape'){e.preventDefault();done()}};
  const done=()=>{
    dead=true;a.pause();a.removeAttribute('src');try{a.load()}catch(e){}
    document.removeEventListener('keydown',key,true);root.remove();
    try{history.replaceState(null,'',location.pathname)}catch(e){}
  };
  const bad=(t,msg)=>{
    dead=true;a.pause();
    root.innerHTML=`<div class="sak bad"><button type="button" class="ib shx" aria-label="Close">${ic('close',22)}</button><h3>${esc(t)}</h3><p class="dupn">${esc(msg)}</p><button type="button" class="pill acc" id="shbx">Close</button></div>`;
    root.querySelector('.shx').onclick=root.querySelector('#shbx').onclick=done;
  };
  document.body.appendChild(root);document.addEventListener('keydown',key,true);
  if(!ID.test(p))return bad('Link not valid','This share link looks incomplete. Ask for a new one.');
  if(!GKEY)return bad('Cannot open this '+W,'This copy of the app is not set up to open shared '+W+'s yet.');
  root.innerHTML=`<div class="sak bad"><button type="button" class="ib shx" aria-label="Close">${ic('close',22)}</button><h3>Opening ${W}\u2026</h3></div>`;
  root.querySelector('.shx').onclick=done;
  fetch(url(p,'alt=media&')).then(r=>{if(!r.ok)throw r.status;return r.json()}).then(j=>{
    if(dead)return;
    const cl=v=>(Array.isArray(v)?v:[]).map(x=>clip(x,120)).filter(Boolean).slice(0,6);
    T=(Array.isArray(j&&j.s)?j.s:[]).slice(0,300).filter(x=>x&&ID.test(x.i||'')).map(x=>({i:x.i,t:clip(x.t,120)||'Song',a:clip(x.a,120),f:cl(x.f),d:+x.d||0,x:/^[a-z0-9]{2,5}$/i.test(x.x||'')?x.x.toLowerCase():'mp3'}));
    if(!T.length)throw 404;
    W=isP||(j&&j.k==='p')?'playlist':'album';
    M={k:W==='playlist'?'p':'a',t:clip(j.t,120)||'Shared '+W,a:clip(j.a,120),f:cl(j.f),c:ID.test(j.c||'')?j.c:''};
    build();
  }).catch(c=>{if(!dead)bad(c===404||c===403?(W[0].toUpperCase()+W.slice(1))+' unavailable':'Could not open the '+W,c===404||c===403?'This '+W+' is no longer shared.':'It could not be loaded. Check your connection and try again.')});

  function build(){
    const who=M.a+(M.f.length?(M.a?' ':'')+'feat. '+M.f.join(', '):''),tot=T.reduce((n,t)=>n+t.d,0),mins=Math.round(tot/60);
    root.innerHTML=`<div class="sak">
      <button type="button" class="ib shx" aria-label="Close">${ic('close',22)}</button>
      <div class="sah"><div class="sacv">${cover({name:M.t})}</div><div class="sati"><b>${esc(M.t)}</b>${who?`<span>${esc(who)}</span>`:''}<span>${T.length} ${T.length===1?'song':'songs'}${mins?' \u00b7 '+mins+' min':''}</span></div></div>
      <div class="sals">${T.map((t,i)=>`<button type="button" class="sar" data-i="${i}"><span class="san">${i+1}</span><span class="sat"><b>${esc(t.t)}</b>${t.a&&t.a!==M.a?`<i>${esc(t.a+(t.f.length?' feat. '+t.f.join(', '):''))}</i>`:''}</span><span class="sad">${t.d?fmt(t.d):''}</span></button>`).join('')}</div>
      <div class="shsk"><input type="range" class="rng" id="shsk" min="0" max="1000" value="0" aria-label="Seek"><div class="shtm"><span id="sht1">0:00</span><span id="sht2">0:00</span></div></div>
      <div class="shct"><button type="button" class="ib" id="shbk" aria-label="Previous song">${ic('prev',24)}</button><button type="button" class="ib shpl" id="shpl" aria-label="Play">${ic('play',30)}</button><button type="button" class="ib" id="shfw" aria-label="Next song">${ic('next',24)}</button></div>
      <button type="button" class="pill acc" id="saa" style="width:100%;justify-content:center;margin-top:14px"><span>Add ${W}</span></button>
    </div>`;
    const g=s=>root.querySelector(s),sk=g('#shsk'),pl=g('#shpl');
    const fill=el=>el.style.setProperty('--p',(el.value/el.max*100)+'%');
    const du=()=>isFinite(a.duration)?a.duration:0;
    const paint=()=>{if(!seeking&&du()){sk.value=a.currentTime/du()*1000;fill(sk)}g('#sht1').textContent=fmt(a.currentTime);g('#sht2').textContent=fmt(du())};
    const mark=()=>root.querySelectorAll('.sar').forEach((e,k)=>e.classList.toggle('on',k===I));
    const play=i=>{if(i<0||i>=T.length)return;I=i;a.src=url(T[i].i,'alt=media&');a.play().catch(()=>toast('Could not play this song'));mark();paint()};
    a.ontimeupdate=a.onloadedmetadata=a.ondurationchange=paint;
    a.onplay=()=>{pl.innerHTML=ic('pause',30);pl.setAttribute('aria-label','Pause')};
    a.onpause=()=>{pl.innerHTML=ic('play',30);pl.setAttribute('aria-label','Play')};
    a.onended=()=>{if(I<T.length-1)play(I+1);else{I=-1;mark()}};
    a.onerror=()=>{if(!dead&&I>=0)toast('This song could not be loaded')};
    pl.onclick=()=>{if(I<0)play(0);else if(a.paused)a.play().catch(()=>toast('Could not play this song'));else a.pause()};
    g('#shbk').onclick=()=>{if(I<0)return;if(a.currentTime>3)a.currentTime=0;else play(I-1)};
    g('#shfw').onclick=()=>{if(I<0)play(0);else play(I+1)};
    g('.sals').onclick=e=>{const r=e.target.closest('.sar');if(r)play(+r.dataset.i)};
    sk.oninput=()=>{seeking=true;fill(sk);if(du())g('#sht1').textContent=fmt(sk.value/1000*du())};
    sk.onchange=()=>{if(du())a.currentTime=sk.value/1000*du();seeking=false};
    fill(sk);g('.shx').onclick=done;
    /* the cover loads in the background */
    coverP=M.c?fetch(url(M.c,'alt=media&')).then(r=>{if(!r.ok)throw 0;return r.blob()}):Promise.resolve(null);
    coverP.then(b=>{if(b&&!dead)g('.sacv').innerHTML=cover({cover:URL.createObjectURL(b),name:M.t})}).catch(()=>{});
    const busy=(b,on,txt)=>{b.disabled=on;b.style.opacity=on?.6:'';b.querySelector('span').textContent=txt};
    g('#saa').onclick=async()=>{
      const b=g('#saa'),fs=[];busy(b,true,'Downloading\u2026');a.pause();
      try{
        for(let i=0;i<T.length;i++){
          if(dead)return;
          b.querySelector('span').textContent='Downloading '+(i+1)+' of '+T.length+'\u2026';
          const r=await fetch(url(T[i].i,'alt=media&'));if(!r.ok)throw new Error('http '+r.status);
          const bl=await r.blob();
          fs.push(new File([bl],shSafe(T[i].t)+'.'+T[i].x,{type:Z_MIME[T[i].x]||(/^audio\//.test(bl.type)?bl.type:'audio/mpeg')}));
        }
      }catch(e){if(!dead)busy(b,false,'Add '+W);return toast('Could not download the '+W)}
      let cv=null;try{const cb=await coverP;if(cb)cv=await makeCover(cb)}catch(e){}
      done();/* close the card first: a duplicate question from the library has to be visible */
      saImport(M,T,fs,cv);
    };
    try{
      an(root,[{opacity:0},{opacity:1}],{duration:220,easing:'linear'});
      an(g('.sak'),[{opacity:0,transform:'translateY(18px) scale(.95)'},{opacity:1,transform:'none'}],{duration:380,easing:EASE_OUT});
    }catch(e){}
  }
}
/* songs are added one at a time so each one is matched to its place in the list, even when the library already has some of them */
async function saImport(M,T,fs,cv){
  const got=[];
  for(let i=0;i<fs.length;i++){
    const r=await addFiles([fs[i]]);
    if(r&&r.ids&&r.ids[0]){const s=songById(r.ids[0]);if(s){s.name=T[i].t;if(T[i].a)s.artist=T[i].a;if(T[i].f.length)s.feat=T[i].f;await put('songs',s);got.push({s,fresh:true})}}
    else if(r&&r.dups&&r.dups[0]){const s=songById(r.dups[0]);if(s)got.push({s,fresh:false})}/* already in the library */
  }
  if(!got.length)return;
  const key=nkey(M.t);
  if(M.k==='p'){/* playlist: every song joins it in order, and songs keep whatever album they have */
    let pl=playlists.find(x=>nkey(x.name)===key);
    if(!pl){pl={id:uid(),name:M.t,desc:'',color:null,cover:null,folderId:null,songs:[],added:Date.now()};playlists.push(pl)}
    const have=new Set(pl.songs||[]);
    pl.songs=(pl.songs||[]).concat([...new Set(got.map(x=>x.s.id))].filter(id=>!have.has(id)));
    if(cv&&!pl.cover)pl.cover=cv.data;
    await put('playlists',pl);
    view.tab='playlists';view.pf=null;view.pl=pl.id;
    toast('Playlist \u201c'+pl.name+'\u201d \u00b7 '+pl.songs.length+(pl.songs.length===1?' song':' songs'));render();return;
  }
  let al=albums.find(x=>nkey(x.name)===key);
  if(!al)al=newAlbum(M.t,null,M.a,M.f);
  let p=Date.now(),n=0;
  for(const {s,fresh} of got){
    if(!fresh&&s.album&&s.album!==al.id)continue;/* already in another album: leave it there */
    s.album=al.id;s.pos=p++;await put('songs',s);n++;
  }
  if(cv&&!al.cover){al.cover=cv.data;al.ccol=cv.color;await put('albums',al)}
  view.tab='albums';view.album=al.id;
  toast('Album \u201c'+al.name+'\u201d \u00b7 '+n+(n===1?' song':' songs'));render();
}
/* app update */
function swuAct(){
  if(SWU.w){SWU.asked=true;SWU.w.postMessage('SKIP_WAITING');toast('Updating\u2026');return}
  if(!SWU.reg)return toast('Updates are not available here');
  toast('Checking\u2026');swuRegister().catch(()=>{});
  setTimeout(()=>{if(SWU.w){setTab='data';openSettings()}else toast('You have the newest version')},2500);
}

/* ===== audio quality helpers, missing info finder ===== */
const kbps=(b,d)=>b&&d>0?Math.round(b.size*8/d/1000):0;
const qInfo=(b,d)=>{if(!b)return '';const t=((b.type||'').split('/')[1]||'').replace(/^x-/,'').replace('mpeg','mp3').replace('mp4','m4a'),k=kbps(b,d);return (t?t.toUpperCase():'?')+(k?' '+k+' kbps':'')};
const missOf=s=>{const al=albumOf(s),m=[],L=LYM.get(s.id);if(!artOf(s))m.push('artist');if(!s.album)m.push('album');if(!s.cover&&!s.cmedia&&!(al&&(al.cover||al.cmedia)))m.push('cover');if(!(L&&L.l&&L.l.length))m.push('lyrics');return m};
let missF='all';
function missSheet(f){
  if(f)missF=f;
  const all=songs.map(s=>({s,m:missOf(s)})).filter(o=>o.m.length),cnt=k=>all.filter(o=>o.m.includes(k)).length;
  if(!all.length){openOv('<h3>Missing info</h3><p class="dupn">Every song has an artist, album, cover and lyrics.</p><div class="bt"><button type="button" class="pill acc" id="msx">Close</button></div>');$('#msx').onclick=closeOv;return}
  const F=[['all','All',all.length],['artist','No artist',cnt('artist')],['album','No album',cnt('album')],['cover','No cover',cnt('cover')],['lyrics','No lyrics',cnt('lyrics')]];
  const rows=all.filter(o=>missF==='all'||o.m.includes(missF)).sort((a,b)=>cmp(a.s.name,b.s.name)),shown=rows.slice(0,200),showLy=missF==='lyrics'||missF==='all';
  openOv(`<h3>Missing info</h3><p class="dupn">Tick songs to look them up online or fix their tags. With nothing ticked, every song in the list is used.</p>
  <div class="mschips" id="msf">${F.map(x=>`<button type="button" class="chip${x[0]===missF?' on':''}" data-f="${x[0]}">${x[1]}<em>${x[2]}</em></button>`).join('')}</div>
  <div class="msslide" id="mss" aria-hidden="true"><i></i></div>
  <div class="pl" id="msl">${shown.map(o=>`<label class="msrow"><input type="checkbox" data-id="${esc(o.s.id)}"><span class="mst"><b>${esc(o.s.name)}</b><span class="mstags">${o.m.map(k=>`<i data-m="${k}">${k}</i>`).join('')}</span></span><button type="button" class="msedit" data-e="${esc(o.s.id)}" aria-label="Edit ${esc(o.s.name)}">${ic('pencil',16)}</button></label>`).join('')}</div>${rows.length>shown.length?`<p class="dupn">Showing the first ${shown.length} of ${rows.length}.</p>`:''}
  <div class="msbar"><div class="mshd"><span id="msc"></span><button type="button" class="mslink" id="msa">Select all</button></div>
  <div class="msgrid"><button type="button" class="msact" id="msn">${ic('search',20)}<span>Find online</span></button>${showLy?`<button type="button" class="msact" id="msy">${ic('mic',20)}<span>Find lyrics</span></button>`:''}<button type="button" class="msact acc" id="msb">${ic('tag',20)}<span>Edit tags</span></button></div></div>`);
  const find=d=>songs.find(x=>String(x.id)===d),ids=()=>[...document.querySelectorAll('#msl input:checked')].map(b=>find(b.dataset.id)).filter(Boolean).map(s=>s.id);
  const lab=()=>{
    const n=ids().length,b=[...document.querySelectorAll('#msl input')];
    $('#msb span').textContent=n?'Edit tags ('+n+')':'Edit tags';
    $('#msc').textContent=n?n+' selected':rows.length+(rows.length===1?' song':' songs');
    $('#msa').textContent=b.length&&b.every(x=>x.checked)?'Clear':'Select all';
  };lab();
  $('#msl').onchange=lab;
  $('#msf').onclick=e=>{const c=e.target.closest('[data-f]');if(c)missSheet(c.dataset.f)};
  {const f=$('#msf'),tr=$('#mss'),th=tr.firstChild,on=f.querySelector('.on');
  if(on)f.scrollLeft+=on.getBoundingClientRect().left-f.getBoundingClientRect().left-(f.clientWidth-on.offsetWidth)/2;/* keep the chosen filter in view */
  const paint=()=>{const over=f.scrollWidth-f.clientWidth;tr.classList.toggle('on',over>2);if(over<=2)return;const W=tr.clientWidth,w=Math.max(28,W*f.clientWidth/f.scrollWidth);th.style.width=w+'px';th.style.left=(f.scrollLeft/over*(W-w))+'px'};
  f.addEventListener('scroll',paint,{passive:true});paint();requestAnimationFrame(paint);
  f.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&f.scrollWidth>f.clientWidth){f.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
  /* drag (or tap) the slider to move the row */
  const to=x=>{const r=tr.getBoundingClientRect(),w=th.offsetWidth,over=f.scrollWidth-f.clientWidth;f.scrollLeft=Math.max(0,Math.min(1,(x-r.left-w/2)/(r.width-w)))*over};
  tr.addEventListener('pointerdown',e=>{tr.setPointerCapture(e.pointerId);to(e.clientX);const mv=ev=>to(ev.clientX),up=()=>{tr.removeEventListener('pointermove',mv);tr.removeEventListener('pointerup',up);tr.removeEventListener('pointercancel',up)};tr.addEventListener('pointermove',mv);tr.addEventListener('pointerup',up);tr.addEventListener('pointercancel',up)})}
  $('#msa').onclick=()=>{const b=[...document.querySelectorAll('#msl input')],on=b.some(x=>!x.checked);b.forEach(x=>x.checked=on);lab()};
  $('#msl').onclick=async e=>{const b=e.target.closest('[data-e]');if(!b)return;e.preventDefault();const s=find(b.dataset.e);if(s){await editSong(s);render();setTimeout(missSheet,300)}};
  $('#msb').onclick=async()=>{const a=ids();if(!a.length)return toast('Tick some songs first');await bulkTag(a);render();setTimeout(missSheet,380)};
  $('#msn').onclick=()=>{const a=ids();omSheet(a.length?a:rows.map(o=>o.s.id))};
  const y=$('#msy');if(y)y.onclick=async()=>{closeOv();await lyFindAll();setTimeout(missSheet,300)};
}
/* ===== find missing info online (iTunes Search: cover, song name, artist, featuring, album) ===== */
const OM={cache:new Map(),busy:false};
const omTitle=t=>{const feat=[];let title=String(t||'').replace(FEAT_RE,(m,a,b)=>{feat.push(...(a||b).split(/,|&|\band\b/i).map(x=>x.trim()).filter(Boolean));return ''}).trim()||String(t||'').trim();return {title,feat}};
async function omSearch(s){
  const pm=songMeta(s.name||'',{}),ar=(s.artist||artOf(s)||pm.artist||'').trim(),ti=(pm.title||s.name||'').replace(FEAT_RE,'').trim();
  if(!ti)return {c:[]};
  const q=(ar+' '+ti).trim(),hit=OM.cache.get(q);if(hit)return hit;
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),12000);
  let js;
  try{
    const r=await fetch('https://itunes.apple.com/search?media=music&entity=song&limit=12&term='+encodeURIComponent(q),{signal:ctl.signal});
    if(!r.ok)return {err:1};
    js=await r.json();
  }catch(e){return {err:1}}finally{clearTimeout(tm)}
  const tk=tkey(ti),ak=nkey(ar),out=[];
  for(const x of (js.results||[])){
    if(!x.trackName||!x.artistName)continue;
    const o=omTitle(x.trackName),ck=tkey(o.title);let sc=0;
    if(ck===tk)sc+=3;else if(tk.length>=4&&ck.length>=4&&(ck.includes(tk)||tk.includes(ck)))sc+=1.5;else continue;
    if(ak){const xa=nkey(x.artistName);if(xa===ak||xa.includes(ak)||ak.includes(xa))sc+=2;else sc-=1}
    if(sc<1.5)continue;
    let album=(x.collectionName||'').trim();if(/\s-\s(single|ep)$/i.test(album))album='';
    out.push({name:o.title,artist:x.artistName.trim(),feat:o.feat.filter(f=>!sameArt(f,x.artistName)),album,cover:x.artworkUrl100?x.artworkUrl100.replace(/\d+x\d+(bb|cc)?(?=\.\w+$)/,'600x600bb'):'',sc});
  }
  const seen=new Set(),c=out.sort((a,b)=>b.sc-a.sc).filter(x=>{const k=nkey(x.name+'|'+x.artist+'|'+x.album);if(seen.has(k))return false;seen.add(k);return true}).slice(0,5);
  const res={c};OM.cache.set(q,res);return res;
}
async function omImg(u){
  try{const r=await fetch(u);if(!r.ok)return null;const b=await r.blob();return await makeCover(new File([b],'cover.jpg',{type:b.type||'image/jpeg'}))}catch(e){return null}
}
/* which fields would change, and which of them are switched on by default (only the ones that are missing) */
function omDiff(s,c){
  const f=[],on=new Set(),cur=s.name||'';
  if(c.cover&&!s.cover&&!s.cmedia){f.push('cover');on.add('cover')}
  if(c.name&&c.name!==cur){f.push('name');if(/^\d{1,3}[\s._-]|\s-\s|_/.test(cur))on.add('name')}
  if(c.artist&&!sameArt(c.artist,s.artist||'')){f.push('artist');if(!artOf(s))on.add('artist')}
  if(c.feat.length&&featOf(s).join('|').toLowerCase()!==c.feat.join('|').toLowerCase()){f.push('feat');if(!featOf(s).length)on.add('feat')}
  if(c.album&&!s.album){f.push('album');on.add('album')}
  return {f,on};
}
const OM_LAB={cover:'Cover',name:'Song name',artist:'Artist',feat:'Featuring',album:'Album'};
async function omSheet(ids){
  if(OM.busy)return;
  if(navigator.onLine===false)return toast('You are offline');
  const list=ids.map(id=>songById(id)).filter(Boolean);
  if(!list.length)return toast('Nothing to look up');
  let stop=false,fail=0;const R=[];
  openOv(`<h3>Find online</h3><p class="dupn" id="omp">Searching 0 of ${list.length}\u2026</p><p class="dupn">Uses the free iTunes Search service. It is sent the song title and artist. About 3 seconds per song.</p><div class="bt"><button type="button" class="pill acc" id="omx">Stop and review</button></div>`);
  $('#omx').onclick=()=>{stop=true};
  OM.busy=true;
  try{
    for(let i=0;i<list.length&&!stop;i++){
      const s=list[i],r=await omSearch(s);
      if(r.err){if(++fail>=3){toast('Could not reach iTunes Search');break}}
      else{fail=0;if(r.c.length)R.push({s,c:r.c,i:0,on:null})}
      const p=$('#omp');if(!p)return;/* sheet was closed */
      p.textContent='Searching '+(i+1)+' of '+list.length+' \u00b7 '+R.length+' matched';
      if(i<list.length-1&&!r.fromCache)await new Promise(z=>setTimeout(z,3000));
    }
  }finally{OM.busy=false}
  if(!$('#omp'))return;
  omReview(R,list.length);
}
function omReview(R,total){
  const init=r=>{const d=omDiff(r.s,r.c[r.i]);r.f=d.f;r.on=new Set(d.on)};
  R.forEach(init);
  const act=()=>R.filter(r=>r.on.size).length;
  const row=(r,k)=>{
    const c=r.c[r.i],cv=c.cover?`<img src="${esc(c.cover)}" alt="" loading="lazy" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex:none;background:rgba(128,128,128,.2)">`:'<div style="width:56px;height:56px;border-radius:8px;flex:none;background:rgba(128,128,128,.2)"></div>';
    return `<div class="omr" data-k="${k}" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)">${cv}<div style="flex:1;min-width:0"><b style="display:block">${esc(c.name)}</b><small style="display:block;color:var(--mute)">${esc(c.artist)}${c.feat.length?' feat. '+esc(c.feat.join(', ')):''}${c.album?' \u00b7 '+esc(c.album):''}</small><small style="display:block;color:var(--mute);margin-top:2px">Now: ${esc(r.s.name)}${artOf(r.s)?' \u00b7 '+esc(artOf(r.s)):''}</small><div class="bgst" style="margin-top:8px">${r.f.length?r.f.map(x=>`<button type="button" class="chip${r.on.has(x)?' on':''}" data-f="${x}">${OM_LAB[x]}</button>`).join(''):'<small style="color:var(--mute)">Nothing new to add</small>'}${r.c.length>1?`<button type="button" class="pill" data-nx="1">Other match ${r.i+1}/${r.c.length}</button>`:''}</div></div></div>`};
  openOv(`<h3>Found online</h3><p class="dupn">${R.length} of ${total} songs matched. Switched-on items will be saved. Tap an item to switch it on or off. Existing names, artists and covers stay unless you switch them on.</p><div class="pl" id="oml">${R.map(row).join('')||'<p class="dupn">No confident matches found.</p>'}</div><div class="bt"><button type="button" class="pill" id="omc">Cancel</button>${R.length?'<button type="button" class="pill acc" id="oma"></button>':''}</div>`);
  const lab=()=>{const b=$('#oma');if(b){const n=act();b.textContent=n?'Apply ('+n+')':'Apply';b.disabled=!n}};lab();
  $('#omc').onclick=()=>{closeOv();setTimeout(missSheet,300)};
  $('#oml').onclick=e=>{
    const rw=e.target.closest('.omr');if(!rw)return;const k=+rw.dataset.k,r=R[k];
    const ch=e.target.closest('[data-f]');
    if(ch){const f=ch.dataset.f;r.on.has(f)?r.on.delete(f):r.on.add(f)}
    else if(e.target.closest('[data-nx]')){r.i=(r.i+1)%r.c.length;init(r)}
    else return;
    rw.outerHTML=row(r,k);lab();
  };
  const ap=$('#oma');if(ap)ap.onclick=async()=>{
    ap.disabled=true;let n=0,cf=0;
    for(const r of R){
      if(!r.on.size)continue;const s=r.s,c=r.c[r.i];
      if(r.on.has('name'))s.name=c.name;
      if(r.on.has('artist'))s.artist=c.artist;
      if(r.on.has('feat')||r.on.has('artist')){const ft=r.on.has('feat')?c.feat:featOf(s);s.feat=ft.filter(x=>!sameArt(x,s.artist||''))}
      if(r.on.has('album')&&c.album){const ex=albums.find(a=>a.name.toLowerCase()===c.album.toLowerCase());s.album=ex?ex.id:newAlbum(c.album).id;s.pos=Date.now()}
      if(r.on.has('cover')&&c.cover){toast('Downloading cover for '+s.name+'\u2026');const im=await omImg(c.cover);if(im){s.cover=im.data;s.ccol=im.color}else cf++}
      await put('songs',s);if(cur===s.id)setSession(s);n++;
    }
    render();closeOv();
    toast('Updated '+n+(n===1?' song':' songs')+(cf?' \u00b7 '+cf+' cover'+(cf===1?'':'s')+' could not be downloaded':''));
    setTimeout(missSheet,380);
  };
}
