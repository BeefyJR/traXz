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

