/* click routing */
/* big player top bar menu: one button opens a pill (background, cover transition, beat effects) centred on the bar */
function tbmPlace(w){
  const p=w.querySelector('.tbmp'),bar=w.parentElement;if(!p||!bar)return;
  const wr=w.getBoundingClientRect(),br=bar.getBoundingClientRect(),pw=p.offsetWidth,m=8;
  let dx=br.left+br.width/2-pw/2-wr.left;
  const l=wr.left+dx;dx+=Math.max(0,m-l)-Math.max(0,l+pw-(innerWidth-m));
  p.style.left=dx+'px';p.style.setProperty('--ox',(wr.width/2-dx)+'px');
}
function tbmSet(open){
  const w=$('#fc .tbm');if(!w)return;
  if(open===w.classList.contains('open'))return;
  if(open)tbmPlace(w);
  w.classList.toggle('open',open);
  const b=w.querySelector('.tbmb'),p=w.querySelector('.tbmp');
  b.classList.toggle('on',open);b.setAttribute('aria-expanded',String(open));p.setAttribute('aria-hidden',String(!open));
}
document.addEventListener('pointerdown',e=>{if($('#fc .tbm.open')&&!e.target.closest('.tbm'))tbmSet(false)},true);
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#fc .tbm.open')){tbmSet(false);e.preventDefault();e.stopImmediatePropagation()}},true);
addEventListener('resize',()=>tbmSet(false));
document.addEventListener('click',async e=>{
  if(Date.now()<noClick){e.preventDefault();return}
  if($('#vp')&&$('#vp').classList.contains('open')&&!e.target.closest('#vp,[data-act=vol]'))closeVp();
  if($('#mini.vm')&&!e.target.closest('#mini .m2,#mini .mvs'))miniVol(false);
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,id=b.dataset.id;
  if(gMode&&(act==='open'||act==='openpl')&&b.closest('.acard[data-gid]')){e.stopPropagation();if(gSet.has(id))gSet.delete(id);else gSet.add(id);return gPaint()}
  if(act==='gselect'){if(gMode)gOff();else{gMode=true;gSet.clear()}render();gPaint();if(gMode)an($('#selbar'),[{opacity:0,transform:'translateY(100%)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE_OUT});return}
  if(gMode&&act==='selexit'){gOff();return render()}
  if(gMode&&act==='selall'){const c=[...document.querySelectorAll('#main .acard[data-gid]')].map(el=>el.dataset.gid);if(c.every(x=>gSet.has(x)))gSet.clear();else c.forEach(x=>gSet.add(x));return gPaint()}
  if(gMode&&act==='gpos'){if(!gSet.size)return toast('Select something first');if(await gPos())gOff();return render()}
  if(gMode&&act==='gmove'){if(!gSet.size)return toast('Select something first');if(await gMove())gOff();return render()}
  if(gMode&&act==='gdel'){if(!gSet.size)return toast('Select something first');if(await gDelete())gOff();return render()}
  if(act==='tbmenu'){const w=b.closest('.tbm');if(w)tbmSet(!w.classList.contains('open'));return}
  if(act==='one'){e.stopPropagation();return oneOpen(b)}
  if(act==='like'){e.stopPropagation();return toggleLike(id||cur)}
  if(act==='npmore'){e.stopPropagation();if(cur)songMenu(cur,null);return}
  if(act==='gotoalb'){e.stopPropagation();const aid=b.dataset.alb;if(!albums.find(x=>x.id===aid))return;if($('#full').classList.contains('open'))closeFull();if(qOpen)closeQ();closeSearch();selMode=false;selSet.clear();view.tab='albums';view.folder=null;view.artist=null;view.rec=null;view.album=aid;return render()}
  if(act==='gotoart'){e.stopPropagation();const n=b.dataset.art;if(!n)return;if($('#full').classList.contains('open'))closeFull();if(qOpen)closeQ();closeSearch();selMode=false;selSet.clear();view.tab='songs';view.folder=null;view.album=null;view.rec=null;view.artist=n;return render()}
  if(act==='gotorec'){e.stopPropagation();const n=b.dataset.rec;if(!n)return;if($('#full').classList.contains('open'))closeFull();if(qOpen)closeQ();closeSearch();selMode=false;selSet.clear();view.tab='songs';view.folder=null;view.album=null;view.artist=null;view.rec=n;return render()}
  if(act==='menu'){e.stopPropagation();return songMenu(id,view.tab==='playlists'?view.pl:null)}
  if(act==='play'){const list=(view.tab==='playlists'&&view.pl)?plSongs(view.pl).map(s=>s.id):view.album?albumSongs(view.album).map(s=>s.id):songsList().map(s=>s.id);return playSong(id,list)}
  if(act==='tab'){closeSearch();selMode=false;selSet.clear();view.tab=b.dataset.t;view.album=null;view.folder=null;view.artist=null;view.rec=null;view.pl=null;view.pf=null;return render()}
  if(act==='plus'){
    if(b.classList.contains('off'))return;
    if(view.tab==='songs'){const r=await choose('Add songs',[{label:'Add files',value:'f'},{label:'Import folder',value:'d'}]);if(r==='f')$('#fi').click();else if(r==='d'){dirMode='songs';$('#di').click()}return}
    if(view.tab==='playlists'){
      const r=await choose('Create',[{label:'New playlist',value:'pl'}].concat(view.pf?[]:[{label:'New folder',value:'folder'}],[{label:'Import folder as playlist',value:'dir'},{label:'Import Spotify playlist',value:'zip'}]));
      if(r==='pl'){const p=await plForm(null,view.pf);if(p){view.pl=p.id;render()}}
      else if(r==='dir'){dirMode='pl';$('#di').click()}
      else if(r==='zip')startZipImport();
      else if(r==='folder'){const f=await folderForm(null,true);if(f)render()}
      return;
    }
    let r=await choose('Create',[{label:'New album',value:'album'}].concat(view.folder?[]:[{label:'New folder',value:'folder'}],[{label:'Import folder as album',value:'dir'}]));
    if(r==='dir'){dirMode='album';$('#di').click();return}
    if(r==='album'){const f=await albumForm('New album',null,'Create');if(f){const a=newAlbum(f.name,view.folder,f.artist,f.feat);view.album=a.id;render()}}
    else if(r==='folder'){const f=await folderForm(null);if(f)render()}
    return;
  }
  if(act==='search')return openSearch();
  if(act==='clearsearch')return closeSearch();
  if(act==='filter'){
    const r=await choose('Sort songs by',Object.keys(SORTS).map(k=>({label:SORTS[k][0],value:k,sel:k===sortKey})));
    if(r){sortKey=r;try{localStorage.setItem('tracks-sort',r)}catch(e){}render()}
    return;
  }
  if(act==='foldermenu'){const f=folders.find(x=>x.id===id);if(!f)return;const r=await choose(f.name,[{label:'Customize',value:'c'},{label:'Delete folder',value:'d',danger:true}]);if(r==='c')await folderForm(f);if(r==='d')await delFolder(f);return render()}
  if(act==='open'){view.album=id;return render()}
  if(act==='openf'){view.folder=id;return render()}
  if(act==='back'){if(view.tab==='playlists'){if(view.pl){const p=playlists.find(x=>x.id===view.pl);view.pl=null;view.pf=p?p.folderId||null:null}else view.pf=null;return render()}if(view.tab==='songs'&&(view.artist||view.rec)){view.artist=null;view.rec=null;return render()}if(view.album){const a=albums.find(x=>x.id===view.album);view.album=null;view.folder=a?a.folderId||null:null}else view.folder=null;return render()}
  if(act==='folderedit'){const f=await folderForm(folders.find(x=>x.id===id));render();return}
  if(act==='reorder'){return reorderSheet(view.tab==='playlists')}
  if(act==='fcustom')return fcSheet();
  if(act==='fszmenu'){
    const r=await choose('Cover size',[{label:'Small',value:'s',ic:'szs',sel:fsz==='s'},{label:'Medium',value:'m',ic:'szm',sel:fsz==='m'||!FSZ_LAB[fsz]},{label:'Large',value:'l',ic:'szl',sel:fsz==='l'},{label:'Custom\u2026',value:'c',ic:'tune',sel:fsz==='c'}]);
    if(!r)return;if(r==='c'){fsz='c';try{localStorage.setItem('tracks-fsize','c')}catch(e){}render();return fcSheet()}
    fsz=r;try{localStorage.setItem('tracks-fsize',fsz)}catch(e){}return render()}
  if(act==='fmore'){
    const P=view.tab==='playlists',f=P?pfolders.find(x=>x.id===view.pf):folders.find(x=>x.id===view.folder);if(!f)return;
    const n=(P?playlists:albums).filter(x=>(x.folderId||null)===f.id).length,items=[];
    if(n>1)items.push({label:P?'Reorder playlists':'Reorder albums',value:'reorder',ic:'reorder'});
    items.push({label:'Customize folder',value:P?'pfedit':'folderedit',ic:'palette'});
    const r=await choose(f.name,items);
    if(r){const t=document.createElement('button');t.dataset.act=r;t.dataset.id=f.id;t.style.display='none';document.body.appendChild(t);t.click();t.remove()}
    return}
  if(act==='fsize'){fsz=b.dataset.s;try{localStorage.setItem('tracks-fsize',fsz)}catch(e){}return render()}
  if(act==='addsongs')return pickSongs(id);
  if(act==='almenu'){
    const a=albums.find(x=>x.id===id);if(!a)return;
    let r=await choose(a.name,[{label:'Customize',value:'c'},{label:'Add all songs elsewhere',value:'allelse',ic:'addpl'},{label:'Share album',value:'sharealb',ic:'share'},{label:'Delete album',value:'delalbum',danger:true}]);
    if(r==='c')r=await choose('Customize album',[{label:'Edit name & artist',value:'rename'},{label:'Change cover',value:'cover'},{label:'Move to folder',value:'albfolder'}]);
    if(r==='sleep'){await sleepMenu();return}
    if(r){const t=document.createElement('button');t.dataset.act=r;t.dataset.id=id;t.style.display='none';document.body.appendChild(t);t.click();t.remove()}
    return;
  }
  if(act==='albmenu'){
    const r=await choose('Album options',[{label:'Edit name & artist',value:'rename'},{label:'Change cover',value:'cover'},{label:'Move to folder',value:'albfolder'},{label:'Add all songs elsewhere',value:'allelse',ic:'addpl'},{label:'Share album',value:'sharealb',ic:'share'},{label:'Sleep timer',value:'sleep',ic:'clock'},{label:'Delete album',value:'delalbum',danger:true}]);
    if(r==='sleep'){await sleepMenu();return}
    if(r){const t=document.createElement('button');t.dataset.act=r;t.dataset.id=id;t.style.display='none';document.body.appendChild(t);t.click();t.remove()}
    return;
  }
  if(act==='rename'){const a=albums.find(x=>x.id===id),f=await albumForm('Edit album',a,'Save');if(f){a.name=f.name;a.artist=f.artist;a.feat=f.feat||[];await put('albums',a);render()}return}
  if(act==='cover'){const a=albums.find(x=>x.id===id),w=a?await choose('Album cover',[{label:'Import image or video',value:'imp'},{label:'Make a cover',value:'mk'}].concat(a.cover?[{label:'Crop and position',value:'crop'}]:[])):'imp';if(w==='crop'){await albumRecrop(a);return}if(w==='mk'){const f=await covMaker({title:a.name,sub:a.artist||'',color:null});if(!f)return;const r=await makeCover(f);if(!r)return cvFail('Could not make the cover');const old=a.cmedia&&a.cmedia.id,oo=a.crig&&a.crig.id;a.cover=r.data;a.ccol=r.color;delete a.cmedia;delete a.crig;delete a.cc;await put('albums',a);render();medGC([old,oo]);return}if(w==='imp'){coverFor=id;$('#ci').click()}return}
  if(act==='albfolder'){
    const a=albums.find(x=>x.id===id),opts=[{label:'No folder',value:'__none',sel:!a.folderId}].concat(folders.map(f=>({label:f.name,value:f.id,sel:f.id===a.folderId})));opts.push({label:'New folder',value:'__new'});
    const r=await choose('Move to folder',opts);
    if(r==='__new'){const f=await folderForm(null);if(f){a.folderId=f.id;await put('albums',a)}}
    else if(r==='__none'){a.folderId=null;await put('albums',a)}
    else if(r){a.folderId=r;await put('albums',a)}
    return render();
  }
  if(act==='delalbum'){
    const a=albums.find(x=>x.id===id);if(!a)return;
    const own=songs.filter(x=>x.album===id),n=own.length;
    const opts=[{label:'Delete album, keep songs',value:'keep',danger:true}];
    if(n)opts.push({label:'Delete album and its '+n+(n===1?' song':' songs'),value:'all',danger:true});
    const r=await choose('Delete "'+a.name+'"?',opts);
    if(!r)return;
    if(r==='all'&&!await confirmBox('Delete '+n+(n===1?' song':' songs')+' too?','This removes '+(n===1?'the song':'these songs')+' from your library, from playlists and from the queue. You can undo it from Settings until you close the app.','Delete all'))return;
    const ac=Object.assign({},a),ids=own.map(x=>x.id),sn=r==='all'?snapSongs(ids):null;
    albums=albums.filter(x=>x.id!==id);await del('albums',id);
    if(sn)await dropSongs(ids);else for(const x of own){x.album=null;await put('songs',x)}
    view.album=null;
    uPush(r==='all'?'Deleted album "'+a.name+'" and its songs':'Deleted album "'+a.name+'"',async()=>{
      untomb('albums',ac.id);if(!albums.some(x=>x.id===ac.id))albums.push(ac);await put('albums',ac);
      if(sn){await restoreSongs(sn)}else for(const sid of ids){const x=songById(sid);if(x){x.album=ac.id;await put('songs',x)}}
    });
    toast(r==='all'?'Deleted album and songs. Undo is in Settings':'Deleted album. Undo is in Settings');
    render();return}
  if(act==='minihide'||act==='minishow'){const h=act==='minihide';$('#app').classList.toggle('mh',h);LS('tracks-mh',h?'1':null);return}
  if(act==='sharealb'){const a=albums.find(x=>x.id===id);if(a)shareColl('album',a);return}
  if(act==='allelse')return addAllElsewhere(albumSongs(id).map(s=>s.id));
  if(act==='playall'){const l=albumSongs(id).map(s=>s.id);if(l.length)playSong(l[0],l);else toast('Album is empty');return}
  if(act==='openpl'){view.pl=id;return render()}
  if(act==='openpf'){view.pf=id;return render()}
  if(act==='pfedit'){await folderForm(pfolders.find(x=>x.id===id),true);render();return}
  if(act==='pfmenu'){
    const f=pfolders.find(x=>x.id===id);if(!f)return;
    const r=await choose(f.name,[{label:'Customize',value:'c'},{label:'Delete folder',value:'d',danger:true}]);
    if(r==='c')await folderForm(f,true);
    if(r==='d'){const ok=await choose('Delete "'+f.name+'"?',[{label:'Delete folder, keep playlists',value:1,danger:true}]);if(ok)await delFolderP(f,true)}
    return render();
  }
  if(act==='plcard'||act==='plmenu')return plMenu(id,act==='plcard');
  if(act==='pladd')return pickForPlaylist(id);
  if(act==='plplay'){const l=plSongs(id).map(s=>s.id);if(l.length)playSong(l[0],l);else toast('Playlist is empty');return}
  if(act==='plshuf'){const l=plSongs(id).map(s=>s.id);if(!l.length)return toast('Playlist is empty');shuffle=true;syncCtl();return playSong(l[Math.floor(Math.random()*l.length)],l)}
  if(act==='plqueue'){const l=plSongs(id).map(s=>s.id);if(!l.length)return toast('Playlist is empty');return qaddMany(l,false)}
  if(act==='miniplaylist'){if(cur){await addToPlaylist([cur]);render()}return}
  if(act==='selpl'){if(!selSet.size)return toast('Select songs first');if(await addToPlaylist(selIds())){selMode=false;selSet.clear()}return render()}
  if(act==='lyedit'){e.stopPropagation();try{tbmSet(false)}catch(_){}if(cur)lsOpen(cur);return}
  if(act==='bgopts'){tbmSet(false);bgSheet();return}
  if(act==='tropts'){tbmSet(false);trSheet();return}
  if(act==='fxopts'){tbmSet(false);fxSheet();return}
  if(act==='editfull'){const s=songById(cur);if(s){await editSong(s);render()}return}
  if(act==='minialbum'){const s=songById(cur);if(s){await moveSong(s);render()}return}
  if(act==='toggle'){e.stopPropagation();if(cur)xfTogglePlay();return renderMini()}
  if(act==='select'){selMode=!selMode;selSet.clear();render();updateBar();if(selMode)an($('#selbar'),[{opacity:0,transform:'translateY(100%)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE_OUT});return}
  if(act==='selexit'){selMode=false;selSet.clear();return render()}
  if(act==='selrow'){if(selSet.has(id))selSet.delete(id);else selSet.add(id);const ck=b.querySelector('.ck'),on=selSet.has(id);ck.classList.toggle('on',on);ck.innerHTML=on?ic('check',14):'';return updateBar()}
  if(act==='selrm'){if(!selSet.size)return toast('Select songs first');const ids=[...selSet];
    const inPl=view.tab==='playlists'&&view.pl,pl=inPl?playlists.find(x=>x.id===view.pl):null,al=!inPl?albums.find(x=>x.id===view.album):null;
    const what=pl?'playlist':'album',nm=(pl||al||{}).name||'this list',n=ids.length;
    if(!await confirmBox('Remove '+n+(n===1?' song':' songs')+'?','They will be taken out of the '+what+' \u201c'+esc(nm)+'\u201d. The songs stay in your library.','Remove'))return;
    if(pl){const old=(pl.songs||[]).slice(),pid=pl.id;pl.songs=old.filter(x=>!selSet.has(x));await put('playlists',pl);
      uPush('Removed '+n+(n===1?' song':' songs')+' from "'+pl.name+'"',async()=>{const p=playlists.find(x=>x.id===pid);if(p){p.songs=old;await put('playlists',p)}})}
    else{const prev=ids.map(id=>{const x=songById(id);return x?[id,x.album]:null}).filter(Boolean);
      for(const id of ids){const x=songById(id);if(x){x.album=null;await put('songs',x)}}
      uPush('Removed '+n+(n===1?' song':' songs')+' from "'+nm+'"',async()=>{for(const [id,a] of prev){const x=songById(id);if(x){x.album=a;await put('songs',x)}}})}
    toast('Removed '+n+(n===1?' song':' songs')+'. Undo is in Settings');selMode=false;selSet.clear();return render()}
  if(act==='selall'){const l=curList();if(l.every(s=>selSet.has(s.id)))selSet.clear();else l.forEach(s=>selSet.add(s.id));render();return updateBar()}
  if(act==='selqueue'){if(!selSet.size)return toast('Select songs first');qaddMany(selIds(),false);selMode=false;selSet.clear();return render()}
  if(act==='seldel'){if(!selSet.size)return toast('Select songs first');if(await bulkDelete([...selSet])){selMode=false;selSet.clear()}return render()}
  if(act==='selalbum'){if(!selSet.size)return toast('Select songs first');if(await bulkAlbum([...selSet])){selMode=false;selSet.clear()}return render()}
  if(act==='selcolor'){if(!selSet.size)return toast('Select songs first');if(await bulkColor([...selSet])){selMode=false;selSet.clear()}return render()}
  if(act==='seltag'){if(!selSet.size)return toast('Select songs first');if(await bulkTag([...selSet])){selMode=false;selSet.clear()}return render()}
  if(act==='playshuf'){const l=albumSongs(id).map(s=>s.id);if(!l.length)return toast('Album is empty');shuffle=true;syncCtl();return playSong(l[Math.floor(Math.random()*l.length)],l)}
  if(act==='norm')return nmToggle();
  if(act==='mute')return toggleMute();
  if(act==='cloud')return cloudSheet();
  if(act==='theme')return setTheme(b.dataset.t,true);
  if(act==='settings')return openSettings();
  if(act==='outdev')return outSheet();
  if(act==='qopen'){if(b.closest('#npb')&&npOn())return npQToggle();return openQ()}
  if(act==='qclose')return closeQ();
  if(act==='qundo')return qUndo();
  if(act==='qclearnext'){if(!upNext.length)return toast('Nothing to clear');qSnap();upNext=[];saveLast(true);renderQueue();return toast('Cleared the songs you added')}
  if(act==='qshuf'){qSnap();const ci=queue.indexOf(ctxCur);queue=queue.slice(0,ci+1).concat(shuf(queue.slice(ci+1)));shuf(upNext);renderQueue();return toast('Queue shuffled')}
  if(act==='qclear'){qSnap();upNext=[];const ci=queue.indexOf(ctxCur);if(ci>=0)queue=queue.slice(0,ci+1);renderQueue();return toast('Queue cleared')}
  if(act==='qplay'){const k=b.dataset.k,i=+b.dataset.i;if(k==='up'){qSnap();const sid=upNext[i];upNext=upNext.slice(i+1);return playSong(sid,null,true)}if(k==='ctx')return playSong(queue[i]);return}
  if(act==='qtop'){qSnap();const k=b.dataset.k,i=+b.dataset.i;if(k==='up'){const x=upNext.splice(i,1)[0];upNext.unshift(x)}else{const x=queue.splice(i,1)[0];upNext.unshift(x)}return renderQueue()}
  if(act==='qrm'){qSnap();const k=b.dataset.k,i=+b.dataset.i;if(k==='up')upNext.splice(i,1);else queue.splice(i,1);return renderQueue()}
  if(act==='albqueue'){const l=albumSongs(id).map(s=>s.id);if(!l.length)return toast('Album is empty');return qaddMany(l,false)}
  if(act==='vol'){if(b.closest('#mini')){const m=$('#mini');miniVol(!m.classList.contains('vm'));if(m.classList.contains('vm'))vpTimer();return}return toggleVp(b)}
  if(act==='next')return step(1);
  if(act==='prev'){if(vT()>3)vSeek(0);else step(-1);return}
  if(act==='shuffle'){shuffle=!shuffle;applyShuffle();shPlayed=new Set(cur?[cur]:[]);shHist=cur?[cur]:[];saveLast(true);syncCtl();return pop(b.firstChild)}
  if(act==='repeat'){repeat=(repeat+1)%3;syncCtl();return pop(b.firstChild)}
  if(act==='lyrics')return lyToggle();
  if(act==='lyseek'){e.stopPropagation();return lySeek(b)}
  if(act==='lyload')return $('#li').click();
  if(act==='lyfind'){e.stopPropagation();return cur?lyFind(cur):0}
  if(act==='closefull')return closeFull();
});

let vpT=null;
function closeVp(){const v=$('#vp');if(!v||!v.classList.contains('open'))return;clearTimeout(vpT);const a=an(v,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(8px) scale(.96)'}],{duration:180,easing:EASE,fill:'forwards'});const f=()=>{v.classList.remove('open');if(a)a.cancel()};if(a)a.onfinish=f;else f()}
function layoutMiniVol(){/* layout is pure CSS now (the volume bar is a flex item that takes the leftover space), nothing to measure */}
function miniVol(on){const m=$('#mini');if(!m||m.classList.contains('vm')===on)return;m.classList.toggle('vm',on);if(on){paintVol();layoutMiniVol()}else m.classList.remove('tight','tighter')}
addEventListener('resize',layoutMiniVol);
function vpTimer(){clearTimeout(vpT);vpT=setTimeout(()=>{closeVp();miniVol(false)},3500)}
function toggleVp(btn){
  const v=$('#vp');if(v.classList.contains('open'))return closeVp();
  const r=(btn&&!btn.closest('#mini')?btn:$('#mini')).getBoundingClientRect(),a=$('#app').getBoundingClientRect();
  const inFull=btn&&!btn.closest('#mini');if(inFull){v.style.bottom='auto';v.style.top=(r.bottom-a.top+8)+'px'}else{v.style.top='auto';v.style.bottom=(a.bottom-r.top+8)+'px';v.style.left=(r.left-a.left+6)+'px';v.style.right='auto'}if(inFull&&document.documentElement.dataset.layout==='pc'){v.style.right='auto';v.style.left=Math.max(8,r.left-a.left-70)+'px'}v.classList.add('open');
  an(v,[{opacity:0,transform:'translateY(8px) scale(.96)'},{opacity:1,transform:'none'}],{duration:240,easing:EASE_OUT});vpTimer();
}

/* hold the queue button of the Spotify bar for 1 s (a ring fills up) to open the whole queue as a settings-style window; a normal tap shows the queue in the side panel */
(()=>{
  let t=null,fired=0,btn=null;
  const hit=e=>{const b=e.target&&e.target.closest&&e.target.closest('#npb [data-act=qopen]');return b&&npOn()?b:null};
  const stop=()=>{clearTimeout(t);if(btn){btn.classList.remove('qhold');btn=null}};
  document.addEventListener('pointerdown',e=>{
    const b=hit(e);if(!b||e.button>0)return;
    fired=0;stop();btn=b;b.classList.remove('qhold');void b.getBoundingClientRect();b.classList.add('qhold');
    t=setTimeout(()=>{fired=1;const x=btn;stop();try{navigator.vibrate&&navigator.vibrate(14)}catch(_){}openQ(true);if(x)x.blur()},500);
  },true);
  ['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,stop,true));
  document.addEventListener('click',e=>{if(fired&&hit(e)){fired=0;e.stopPropagation();e.preventDefault()}},true);
  document.addEventListener('contextmenu',e=>{if(hit(e))e.preventDefault()},true);
  /* settings-style window: a click outside closes it */
  document.addEventListener('pointerdown',e=>{const p=$('#qp');if(p&&p.classList.contains('open')&&p.classList.contains('qset')&&!e.target.closest('#qp')&&!hit(e))closeQ()},true);
})();

/* queue */
/* undo history: a snapshot of the queue is taken before every change, so Undo can bring back removed, cleared, shuffled or moved songs */
const qHist=[];
function qSnap(){qHist.push({q:queue.slice(),u:upNext.slice(),o:shOrig.slice()});if(qHist.length>40)qHist.shift();qUndoPaint()}
function qUndoPaint(){document.querySelectorAll('[data-act=qundo]').forEach(b=>{b.disabled=!qHist.length})}
function qUndo(){
  const x=qHist.pop();qUndoPaint();if(!x)return toast('Nothing to undo');
  const ok=a=>a.filter(i=>songById(i));
  queue=ok(x.q);upNext=ok(x.u);shOrig=ok(x.o);
  if(ctxCur!=null&&songById(ctxCur)&&!queue.includes(ctxCur))queue.unshift(ctxCur);
  saveLast(true);renderQueue();toast('Undone');
}
const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function qadd(id,next){
  if(!songById(id))return;
  if(cur===null){playSong(id,[id]);return}
  qSnap();if(next)upNext.unshift(id);else upNext.push(id);
  toast(next?'Playing next':'Added to queue');if(qOpen)renderQueue();npQRefresh();
}
function qaddMany(ids,next){
  if(cur===null){playSong(ids[0],ids);return}
  qSnap();upNext=next?ids.concat(upNext):upNext.concat(ids);
  toast(`Added ${ids.length} ${ids.length===1?'song':'songs'} to the queue`);if(qOpen)renderQueue();npQRefresh();
}
function qrow(s,k,i){
  const acts=k==='now'?'':`<button class="k" data-act="qtop" data-k="${k}" data-i="${i}" aria-label="Play next">${ic('up',20)}</button><button class="k" data-act="qrm" data-k="${k}" data-i="${i}" aria-label="Remove from queue">${ic('close',20)}</button>`;
  return `<div class="row ${k==='now'?'on':''}" data-act="qplay" data-k="${k}" data-i="${i}"><div class="th">${cover(songCover(s),s.name)}</div><div class="t"><b>${esc(s.name)}</b><span>${esc(sub(s)||'No album')}</span></div>${acts}</div>`;
}
function renderQueue(){
  const l=$('#ql');if(!l)return;const keep=l.scrollTop,s=songById(cur);
  const ci=queue.indexOf(ctxCur),ctx=ci<0?[]:queue.slice(ci+1).map((id,j)=>({id,i:ci+1+j}));
  let h=s?`<div class="scd"><h4>Now playing</h4>${qrow(s,'now',0)}</div>`:'<div class="scd"><h4>Now playing</h4><div class="empty">Nothing is playing.</div></div>';
  if(upNext.length)h+=`<div class="scd"><h4>Next in queue<span class="qcl"><i>${upNext.length}</i><button type="button" class="pill" data-act="qclearnext" aria-label="Clear the songs I added">Clear</button></span></h4>`+upNext.map((id,i)=>{const x=songById(id);return x?qrow(x,'up',i):''}).join('')+'</div>';
  if(ctx.length)h+=`<div class="scd"><h4>Next up<span>${ctx.length}</span></h4>`+ctx.map(o=>{const x=songById(o.id);return x?qrow(x,'ctx',o.i):''}).join('')+'</div>';
  if(!upNext.length&&!ctx.length)h+='<div class="empty">The queue is empty.<br>Use Play next or Add to queue on any song.</div>';
  l.innerHTML=h;l.scrollTop=keep;npQRefresh();qUndoPaint();
}
function openQ(set){
  qOpen=true;const p=$('#qp');p.getAnimations().forEach(x=>x.cancel());p.classList.toggle('qset',set===true);p.classList.add('open');renderQueue();
  an(p,set===true?[{opacity:0,transform:'scale(.94) translateY(14px)'},{opacity:1,transform:'none'}]:[{transform:'translateY(100%)'},{transform:'none'}],{duration:set===true?320:400,easing:EASE_OUT});
  [...$('#ql').querySelectorAll('.row')].slice(0,12).forEach((r,i)=>an(r,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:340,delay:120+i*26,easing:EASE_OUT,fill:'backwards'}));
}
function closeQ(){
  qOpen=false;const p=$('#qp');if(!p.classList.contains('open'))return;
  const st=p.classList.contains('qset');
  const a=an(p,st?[{opacity:1,transform:'none'},{opacity:0,transform:'scale(.96) translateY(10px)'}]:[{transform:'none'},{transform:'translateY(100%)'}],{duration:st?200:300,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  if(a)a.onfinish=()=>{p.classList.remove('open','qset');a.cancel()};else p.classList.remove('open','qset');
}

/* select mode and bulk actions */
let selMode=false;const selSet=new Set();
let gMode=false;const gSet=new Set();/* several albums or playlists selected at once */
const gOk=()=>(view.tab==='albums'&&!view.album)||(view.tab==='playlists'&&!view.pl);
const gOff=()=>{gMode=false;gSet.clear()};
const gBtn=n=>n>0?`<button class="ab${gMode?' acc':''}" data-act="gselect" aria-label="Select ${view.tab==='playlists'?'playlists':'albums'}" title="Select">${ic('sel',21)}</button>`:'';
function gPaint(){
  const c=$('#selc');if(c)c.textContent=gSet.size+' selected';
  const cards=[...document.querySelectorAll('#main .acard[data-gid]')];
  cards.forEach(el=>{const on=gSet.has(el.dataset.gid);el.classList.toggle('gon',on);const k=el.querySelector('.gck');if(k)k.innerHTML=on?ic('check',15):''});
  const b=document.querySelector('[data-act=selall]');if(b)b.textContent=cards.length&&cards.every(el=>gSet.has(el.dataset.gid))?'Deselect all':'Select all';
}
async function gMove(){
  const P=view.tab==='playlists',arr0=P?playlists:albums,ids=[...gSet].filter(id=>arr0.some(y=>y.id===id&&!y.sys));if(!ids.length)return false;
  const arr=P?playlists:albums,st=P?'playlists':'albums',fl=P?pfolders:folders;
  const opts=[{label:'No folder',value:'__none'}].concat(fl.map(f=>({label:f.name,value:f.id})));opts.push({label:'New folder',value:'__new'});
  const r=await choose('Move '+ids.length+(P?(ids.length===1?' playlist':' playlists'):(ids.length===1?' album':' albums')),opts);
  if(r==null)return false;
  let fid=null;
  if(r==='__new'){const f=await folderForm(null,P);if(!f)return false;fid=f.id}else if(r!=='__none')fid=r;
  for(const id of ids){const x=arr.find(y=>y.id===id);if(x){x.folderId=fid;await put(st,x)}}
  toast('Moved '+ids.length+(ids.length===1?' item':' items'));return true;
}
async function gDelete(){
  const P=view.tab==='playlists',arr0=P?playlists:albums,ids=[...gSet].filter(id=>arr0.some(y=>y.id===id&&!y.sys)),n=ids.length;if(!n)return false;
  const r=await choose('Delete '+n+(P?(n===1?' playlist?':' playlists?'):(n===1?' album?':' albums?')),[{label:P?'Delete, keep songs':'Delete, keep songs',value:1,danger:true}]);
  if(!r)return false;
  const set=new Set(ids);
  if(P){playlists=playlists.filter(x=>!set.has(x.id));for(const id of ids)await del('playlists',id)}
  else{albums=albums.filter(x=>!set.has(x.id));for(const id of ids)await del('albums',id);for(const x of songs)if(set.has(x.album)){x.album=null;await put('songs',x)}}
  toast('Deleted '+n+(n===1?' item':' items'));return true;
}
const canSel=()=>view.tab==='songs'||(view.tab==='albums'&&!!view.album)||(view.tab==='playlists'&&!!view.pl);
const curList=()=>view.tab==='playlists'&&view.pl?plSongs(view.pl):view.tab==='albums'&&view.album?albumSongs(view.album):songsList();
function updateBar(){const c=$('#selc');if(c)c.textContent=selSet.size+' selected';const b=document.querySelector('[data-act=selall]');if(b){const l=curList();b.textContent=l.length&&l.every(x=>selSet.has(x.id))?'Deselect all':'Select all'}}
async function bulkAlbum(ids){
  const opts=albums.map(a=>({label:a.name,value:a.id,cov:a}));opts.push({label:'New album',value:'__new',plus:true});opts.push({label:'No album',value:'__none'});
  const t=await choose('Add '+ids.length+(ids.length===1?' song':' songs')+' to album',opts);if(!t)return false;
  let aid=null;
  if(t==='__new'){const f=await albumForm('New album',null,'Create');if(!f)return false;aid=newAlbum(f.name,null,f.artist,f.feat).id}else if(t!=='__none')aid=t;
  let p=Date.now();for(const id of ids){const s=songById(id);if(s){s.album=aid;s.pos=p++;await put('songs',s)}}
  toast('Updated '+ids.length+(ids.length===1?' song':' songs'));return true;
}
function pickColor(title){return new Promise(res=>{
  let c;
  openOv(`<h3>${esc(title)}</h3><div class="sw" id="pcw"><button type="button" class="swb auto" data-c="" aria-label="Automatic color">${ic('close',14)}</button>${PAL.map(x=>`<button type="button" class="swb" data-c="${x}" style="background:${x}" aria-label="Color ${x}"></button>`).join('')}<label class="swc" aria-label="Custom color"><input type="color" id="pcc" value="#ff5a36">${ic('palette',16)}</label></div><div class="bt"><button class="pill" id="pcx">Cancel</button><button class="pill acc" id="pco">Apply</button></div>`);
  const mark=()=>{document.querySelectorAll('#pcw .swb').forEach(b=>b.classList.toggle('on',c!==undefined&&(b.dataset.c||'').toLowerCase()===(c||'').toLowerCase()));$('#pcw .swc').classList.toggle('on',!!c&&!PAL.some(p=>p.toLowerCase()===c.toLowerCase()))};
  $('#pcw').onclick=e=>{const b=e.target.closest('.swb');if(!b)return;c=b.dataset.c;mark()};
  $('#pcc').oninput=e=>{c=e.target.value;mark()};
  const close=v=>{closeOv();res(v)};
  $('#pcx').onclick=()=>close(null);
  $('#pco').onclick=()=>close(c===undefined?null:c);
  $('#ov').onclick=e=>{if(e.target.id==='ov')close(null)};
})}
async function bulkColor(ids){
  const c=await pickColor('Color for '+ids.length+(ids.length===1?' song':' songs'));if(c===null)return false;
  for(const id of ids){const s=songById(id);if(s){s.color=c||null;await put('songs',s)}}
  toast('Color updated');return true;
}
function bulkTag(ids){return new Promise(res=>{
  openOv(`<h3>Tag ${ids.length} ${ids.length===1?'song':'songs'}</h3><label for="ta">Artist</label><input type="text" id="ta" maxlength="120" placeholder="Keep current"><label for="tf">Featuring artist (added to each song)</label><input type="text" id="tf" maxlength="120" placeholder="None"><label>Cover art (optional)</label><button type="button" class="pill" id="tcb">Choose image</button><span id="tcn" style="margin-left:10px;color:var(--mute);font-size:13px"></span><label for="tl">Album</label><input type="text" id="tl" maxlength="80" placeholder="Keep current"><div class="chips" id="tch">${albums.map(a=>`<button type="button" class="chip" data-n="${esc(a.name)}">${esc(a.name)}</button>`).join('')}</div><label for="trc">Record</label><input type="text" id="trc" maxlength="80" placeholder="Keep current"><div class="chips" id="trch">${knownRecs().map(r=>`<button type="button" class="chip" data-n="${esc(r)}">${esc(r)}</button>`).join('')}</div><div class="bt"><button class="pill" id="tx">Cancel</button><button class="pill acc" id="to">Apply</button></div>`);
  $('#tch').onclick=e=>{const c=e.target.closest('.chip');if(c)$('#tl').value=c.dataset.n};
  $('#trch').onclick=e=>{const c=e.target.closest('.chip');if(c)$('#trc').value=c.dataset.n};
  let cvr=null;const fi=document.createElement('input');fi.type='file';fi.accept='image/*,video/*';
  $('#tcb').onclick=()=>fi.click();
  fi.onchange=async()=>{const x=fi.files[0];if(!x)return;cvr=await makeCoverX(x);$('#tcn').textContent=cvr?x.name:(MEDERR==='cancel'?'':(MEDERR||'Could not read that image'))};
  {const A=[...new Set(ids.map(id=>{const x=songById(id);return x?artOf(x):''}))];if(A.length===1&&A[0])$('#ta').value=A[0]}
  const close=v=>{closeOv();res(v)};
  $('#tx').onclick=()=>close(false);
  $('#to').onclick=async()=>{
    const ar=$('#ta').value.trim(),al=$('#tl').value.trim(),ft=$('#tf').value.replace(/\s+/g,' ').trim();
    const rc=normRec($('#trc').value);
    if(!ar&&!al&&!ft&&!cvr&&!rc)return close(false);
    let aid=null;if(al){const ex=albums.find(a=>a.name.toLowerCase()===al.toLowerCase());aid=ex?ex.id:newAlbum(al).id}
    const cref=cvr&&cvr.media?await medSave(cvr.media):null,oldm=[];
    if(cvr&&aid){const A=albums.find(a=>a.id===aid);if(A){oldm.push(A.cmedia&&A.cmedia.id);A.cover=cvr.data;A.ccol=cvr.color;if(cref)A.cmedia=Object.assign({},cref);else delete A.cmedia;await put('albums',A)}}let p=Date.now();
    for(const id of ids){const s=songById(id);if(!s)continue;if(ar)s.artist=ar;if(ft){const f=featOf(s).slice();if(!f.some(x=>sameArt(x,ft)))f.push(ft);s.feat=f}if(ar||ft)s.feat=featOf(s).filter(x=>!sameArt(x,s.artist||''));if(aid){s.album=aid;s.pos=p++}if(rc)s.rec=rc;if(cvr){oldm.push(s.cmedia&&s.cmedia.id);s.cover=cvr.data;s.ccol=cvr.color;if(cref)s.cmedia=Object.assign({},cref);else delete s.cmedia}await put('songs',s)}
    toast('Tags updated');close(true);medGC(oldm);
  };
  $('#ov').onclick=e=>{if(e.target.id==='ov')close(false)};
})}

async function bulkDelete(ids){
  const r=await choose('Delete '+ids.length+(ids.length===1?' song?':' songs?'),[{label:'Delete from library',value:1,danger:true}]);if(!r)return false;
  const sn=snapSongs(ids);await dropSongs(ids);
  uPush('Deleted '+ids.length+(ids.length===1?' song':' songs'),()=>restoreSongs(sn));
  toast('Deleted '+ids.length+(ids.length===1?' song':' songs')+'. Undo is in Settings');return true;
}
function selIds(){const l=curList().filter(s=>selSet.has(s.id)).map(s=>s.id);return l.concat([...selSet].filter(id=>!l.includes(id)))}

const fmtDate=t=>new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const fmtLen=s=>{const hh=Math.floor(s/3600),mm=Math.floor(s%3600/60),ss=Math.round(s%60);return hh?hh+'h '+mm+'m':mm+'m '+ss+'s'};

/* volume and mute */
let lastVol=1;
function paintVol(){const z=uvol===0;document.querySelectorAll('.mt2').forEach(e=>e.classList.toggle('on',z));document.querySelectorAll('[data-vi]').forEach(e=>{const k=z?'volx':'vol';if(e.dataset.k!==k){e.dataset.k=k;e.innerHTML=ic(k,+e.dataset.s||20)}})}
function setVol(v){v=Math.max(0,Math.min(1,v));uvol=v;if(!(XF.live||XF.ov||XF.inr||LP.busy))au.volume=v;if(v>0)lastVol=v;const p=Math.round(v*100);['#vol','#fvol','#mvl','#nbvl'].forEach(q=>{const r=$(q);if(r){r.value=p;r.style.setProperty('--p',p+'%')}});paintVol()}
function toggleMute(){const c=uvol;if(c>0){lastVol=c;setVol(0)}else setVol(lastVol||1);vpTimer()}

/* theme */
function curTheme(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
/* custom theme: any background colour, every other colour derived for readable contrast */
const CT={hex:'#1e293b',mode:'dark',adj:false};
try{const h=localStorage.getItem('tracks-custom-bg');if(/^#[0-9a-f]{6}$/i.test(h||''))CT.hex=h.toLowerCase()}catch(e){}
const hex2rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgb2hex=c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const linC=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const lumC=c=>.2126*linC(c[0])+.7152*linC(c[1])+.0722*linC(c[2]);
const crC=(a,b)=>{const x=lumC(a),y=lumC(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const mixC=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function customVars(hex){
  let bg=hex2rgb(hex),adj=false;
  const WT=[244,244,242],BT=[17,17,17],dark=crC(bg,WT)>=crC(bg,BT),ext=dark?[0,0,0]:[255,255,255],text=dark?WT:BT;
  for(let i=0;i<40&&crC(bg,text)<6;i++){bg=mixC(bg,ext,.04);adj=true}
  const toward=dark?[255,255,255]:[0,0,0];
  let surf=mixC(bg,toward,.07),surf2=mixC(bg,toward,.14);
  for(let t=.14;t>0&&crC(text,surf2)<5.5;t-=.02)surf2=mixC(bg,toward,t);
  let mute=mixC(text,bg,.32);
  for(let t=.32;t>0&&(crC(mute,bg)<4.8||crC(mute,surf2)<4.5);t-=.04)mute=mixC(text,bg,t);
  let acct=[255,90,54];
  for(let t=0;t<1&&crC(acct,bg)<4.5;t+=.05)acct=mixC([255,90,54],text,t);
  const line=mixC(bg,text,.16);
  return{bg,surf,surf2,text,mute,line,acct,mode:dark?'dark':'light',adj,hex:rgb2hex(bg)}
}
function clearCustom(){const S=document.documentElement.style;['--bg','--surf','--surf2','--text','--mute','--line','--bgc','--sfc','--acct'].forEach(k=>S.removeProperty(k));S.colorScheme=''}
function applyCustom(hex){
  const c=customVars(hex),S=document.documentElement.style,j=a=>a.map(Math.round).join(',');
  S.setProperty('--bg',rgb2hex(c.bg));S.setProperty('--surf',rgb2hex(c.surf));S.setProperty('--surf2',rgb2hex(c.surf2));
  S.setProperty('--text',rgb2hex(c.text));S.setProperty('--mute',rgb2hex(c.mute));S.setProperty('--line',rgb2hex(c.line));
  S.setProperty('--bgc',j(c.bg));S.setProperty('--sfc',j(c.surf));S.setProperty('--acct',rgb2hex(c.acct));S.colorScheme=c.mode;
  CT.mode=c.mode;CT.adj=c.adj;CT.shown=c.hex;
}
function paintTheme(){
  const r=document.documentElement,t=curTheme();
  if(t==='custom'&&!r.style.getPropertyValue('--bg'))applyCustom(CT.hex);
  const mode=t==='custom'?CT.mode:(t==='dark'?'dark':'light');r.dataset.mode=mode;
  document.querySelectorAll('.setg[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='custom'?(CT.shown||CT.hex):(t==='dark'?'#0b0b0c':'#f6f6f4');
}
function setTheme(t,save){const r=document.documentElement;r.classList.add('tt');r.dataset.theme=t;if(t==='custom')applyCustom(CT.hex);else clearCustom();if(save)try{localStorage.setItem('tracks-theme',t)}catch(e){}paintTheme();setTimeout(()=>r.classList.remove('tt'),260)}
function setCustomBg(hex,save){CT.hex=hex.toLowerCase();if(save)try{localStorage.setItem('tracks-custom-bg',CT.hex)}catch(e){}setTheme('custom',save)}
(function(){try{if(localStorage.getItem('tracks-theme')==='custom'){document.documentElement.dataset.theme='custom';applyCustom(CT.hex)}}catch(e){}paintTheme();try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',paintTheme)}catch(e){}})();

/* layout mode: auto detects phone vs PC, can be forced from Settings */
const LAY={m:'auto'};
try{const v=localStorage.getItem('tracks-layout');if(v==='phone'||v==='pc'||v==='auto')LAY.m=v}catch(e){}
function detectLayout(){return(matchMedia('(hover:hover) and (pointer:fine)').matches&&innerWidth>=640)?'pc':'phone'}
function curLayout(){return LAY.m==='auto'?detectLayout():LAY.m}
function applyLayout(){document.documentElement.dataset.layout=curLayout();try{dockSync()}catch(e){}if(typeof npApply==='function')npApply()}
function setLayout(m,save){LAY.m=m;if(save)try{localStorage.setItem('tracks-layout',m)}catch(e){}applyLayout();try{hbPlace()}catch(e){}}
applyLayout();
addEventListener('resize',()=>{if(LAY.m==='auto')applyLayout()});
/* mouse wheel over the player-bar volume button or slider changes the volume */
/* attached to the player bar itself (a non-passive wheel listener on the document slows down scrolling everywhere) */
function npbWheel(e){const t=e.target.closest&&e.target.closest('.nr .mt,#nbvl');if(!t)return;e.preventDefault();setVol(Math.min(1,Math.max(0,uvol+(e.deltaY<0?.05:-.05))))}
/* movable section bar: Albums / Songs / Playlists can sit on top (default), left, right or bottom. The same buttons move, so every existing handler keeps working */
const DOCKS=['top','left','right','bottom'];
const getDock=()=>{const v=LS('tracks-dock');return DOCKS.includes(v)?v:'top'};
function applyDock(d){
  const tabs=document.querySelector('.tabs'),dock=$('#dock'),hdr=document.querySelector('#top header');
  document.documentElement.dataset.dock=d;
  if(!tabs||!dock||!hdr)return;
  const host=d==='top'?hdr:dock;if(tabs.parentNode!==host)host.appendChild(tabs);
}
function setDock(d){if(!DOCKS.includes(d))return;LS('tracks-dock',d);applyDock(d);try{dockSync()}catch(e){}if(typeof npApply==='function')npApply();if(d!=='top')an($('#dock'),[{opacity:0},{opacity:1}],{duration:260,easing:EASE})}
[['t1','album'],['t2','note'],['t3','plist']].forEach(([id,k])=>{const b=$('#'+id);if(b&&!b.querySelector('.tic')){const t=b.textContent;b.innerHTML=ic(k,24).replace('class="ic"','class="ic tic"')+'<span class="tl">'+esc(t)+'</span>'}});
applyDock(getDock());
/* navigation bar size: drag the bar's inner edge to shrink it (never larger than the normal size); narrow enough = icons only */
const DKC={on:LS('tracks-dockc')==='1'};/* top bar: icons only on/off */
const dkMax=()=>{const pc=document.documentElement.dataset.layout==='pc',d=getDock();return d==='bottom'?(pc?72:66):(pc?112:84)};
const dkKey=()=>getDock()==='bottom'?'tracks-dockh':'tracks-dockw';
function dockSync(){
  const R=document.documentElement,d=getDock();let icons=false;
  R.style.removeProperty('--dw');R.style.removeProperty('--dbh');
  if(d==='left'||d==='right'){let w=+LS('tracks-dockw')||0;if(w&&w<dkMax()){w=Math.max(58,w);R.style.setProperty('--dw',w+'px');icons=w<84}}
  else if(d==='bottom'){let h=+LS('tracks-dockh')||0;if(h&&h<dkMax()){h=Math.max(54,h);R.style.setProperty('--dbh',h+'px');icons=h<60}}
  else icons=DKC.on;
  R.dataset.dockc=icons?'on':'off';
  try{fpDock()}catch(e){}
  try{hbPlace()}catch(e){}
}
/* small windows: Add, Cloud sync, Queue and Settings move onto the navigation bar (works for top, left, right and bottom bars). The same buttons move, so every handler keeps working */
const HBM={m:(()=>{const v=LS('tracks-hbm');return v==='on'||v==='off'?v:'auto'})()};/* auto = small windows only, on = always, off = never */
function setHbm(m){if(m!=='auto'&&m!=='on'&&m!=='off')return;HBM.m=m;LS('tracks-hbm',m);try{hbPlace()}catch(e){}if(typeof npApply==='function')try{npApply()}catch(e){}}
/* custom icon layout: Add, Cloud sync, Queue and Settings can sit in the header (left or right), on a side or bottom bar, or be hidden. The same buttons move, so every handler keeps working */
const IC_KEYS=['plus','cloud','qk','gear'];
const IC_NAME={plus:'Add',cloud:'Cloud sync',qk:'Queue',gear:'Settings'};
const IC_ICON={plus:'plus',cloud:'cloud',qk:'qm',gear:'gear'};
const IC_POS=[['hl','Top left'],['hr','Top right'],['nl','Bar start'],['nr','Bar end'],['off','Hide']];
const IC_TAB={t1:['album','Albums'],t2:['note','Songs'],t3:['plist','Playlists']};
/* look options: sh shape, bg background, sd shadow, bw border width (null = the style's own), gs icon size inside the button (%), col button colour and ink icon colour (null = automatic), tf = size and spacing also drive the tabs, ts = tab style */
const IC_SH=[['circle','Circle'],['round','Rounded'],['squircle','Squircle'],['square','Square'],['plain','Plain']];
const IC_BG=[['auto','Default'],['glass','Glass'],['solid','Solid'],['none','None'],['outline','Outline'],['soft','Soft tint'],['accent','Accent'],['gradient','Gradient'],['neon','Neon']];
const IC_SD=[['auto','Default'],['none','None'],['soft','Soft'],['strong','Strong'],['glow','Glow']];
const IC_TS=[['auto','Default'],['pill','Pill'],['under','Underline'],['outline','Outline'],['soft','Soft tint']];
const icDef=()=>({on:false,pos:{plus:'hl',cloud:'hl',qk:'hr',gear:'hr'},ord:IC_KEYS.slice(),tabs:['t1','t2','t3'],size:44,gap:8,sh:'circle',bg:'auto',acc:false,sd:'auto',bw:null,gs:52,col:null,ink:null,tf:true,ts:'auto'});
const ICP=icDef();
try{const j=JSON.parse(LS('tracks-icp')||'null');if(j&&typeof j==='object'){
  ICP.on=!!j.on;
  IC_KEYS.forEach(k=>{if(j.pos&&IC_POS.some(p=>p[0]===j.pos[k]))ICP.pos[k]=j.pos[k]});
  if(Array.isArray(j.ord)&&j.ord.length===4&&IC_KEYS.every(k=>j.ord.includes(k)))ICP.ord=j.ord.slice();
  if(Array.isArray(j.tabs)&&j.tabs.length===3&&['t1','t2','t3'].every(k=>j.tabs.includes(k)))ICP.tabs=j.tabs.slice();
  if(isFinite(j.size))ICP.size=Math.min(60,Math.max(32,+j.size));
  if(isFinite(j.gap))ICP.gap=Math.min(24,Math.max(0,+j.gap));
  if(IC_SH.some(p=>p[0]===j.sh))ICP.sh=j.sh;
  if(IC_BG.some(p=>p[0]===j.bg))ICP.bg=j.bg;
  if(IC_SD.some(p=>p[0]===j.sd))ICP.sd=j.sd;
  if(IC_TS.some(p=>p[0]===j.ts))ICP.ts=j.ts;
  if(j.bw!==null&&j.bw!==undefined&&isFinite(j.bw))ICP.bw=Math.min(4,Math.max(0,+j.bw));
  if(isFinite(j.gs))ICP.gs=Math.min(80,Math.max(40,+j.gs));
  if(/^#[0-9a-f]{6}$/i.test(j.col||''))ICP.col=j.col;
  if(/^#[0-9a-f]{6}$/i.test(j.ink||''))ICP.ink=j.ink;
  if(typeof j.tf==='boolean')ICP.tf=j.tf;
  ICP.acc=!!j.acc}}catch(e){}
if(ICP.pos.gear==='off')ICP.pos.gear='hr';/* Settings can never be hidden, or there would be no way back */
const icSave=()=>LS('tracks-icp',JSON.stringify(ICP));
/* the bar placements need a left, right or bottom bar: with the bar on top those buttons stay in the header */
const icEff=k=>{let p=ICP.pos[k];if(k==='gear'&&p==='off')p='hr';if((p==='nl'||p==='nr')&&getDock()==='top')p=p==='nl'?'hl':'hr';return p};
/* the look settings (shadow, border, colours, glyph size, tab options) become attributes and CSS variables on the page */
function icLook(R){
  const at=(a,v)=>{if(v===null||v===undefined)R.removeAttribute('data-'+a);else R.setAttribute('data-'+a,v)},pv=(n,v)=>{if(v===null||v===undefined)R.style.removeProperty(n);else R.style.setProperty(n,v)};
  pv('--ics',ICP.size+'px');pv('--icg',ICP.gap+'px');pv('--icgs',(ICP.gs/100).toFixed(2));
  pv('--icbw',ICP.bw===null?null:ICP.bw+'px');pv('--icbase',ICP.col);pv('--ici',ICP.ink);
  at('icsd',ICP.sd==='auto'?null:ICP.sd);at('icbw',ICP.bw===null?null:'on');at('iccol',ICP.col?'on':null);at('icink',ICP.ink?'on':null);
  at('ict',ICP.tf?'on':'off');at('icts',ICP.ts==='auto'?null:ICP.ts);
}
function icApply(){
  const R=document.documentElement,top=$('#top'),hrow=top&&top.querySelector('.hr'),tabs=document.querySelector('.tabs');
  if(!top||!hrow||!tabs)return;
  if(R.dataset.hb==='dock')delete R.dataset.hb;
  const mk=id=>$('#'+id)||Object.assign(document.createElement('div'),{id});
  const G={hl:mk('ihl'),hr:mk('ihr'),nl:mk('hbx'),nr:mk('hby')},host=tabs.parentNode;
  if(G.hl.parentNode!==hrow||hrow.firstChild!==G.hl)hrow.insertBefore(G.hl,hrow.firstChild);
  if(G.hr.parentNode!==hrow||hrow.lastChild!==G.hr)hrow.appendChild(G.hr);
  if(G.nl.parentNode!==host||G.nl.nextSibling!==tabs)host.insertBefore(G.nl,tabs);
  if(G.nr.parentNode!==host||G.nr.previousSibling!==tabs)host.insertBefore(G.nr,tabs.nextSibling);
  const B={plus:$('#plus'),cloud:$('#cb'),qk:$('#qk'),gear:$('#gear')},want={hl:[],hr:[],nl:[],nr:[]};
  ICP.ord.forEach(k=>{const b=B[k];if(!b)return;const p=icEff(k);b.classList.toggle('icoff',p==='off');if(p!=='off')want[p].push(b)});
  Object.keys(G).forEach(g=>{const cur=[...G[g].children].filter(x=>!x.classList.contains('icoff'));if(cur.length!==want[g].length||cur.some((x,i)=>x!==want[g][i]))want[g].forEach(b=>G[g].appendChild(b))});
  R.dataset.ic='on';R.dataset.icsh=ICP.sh;R.dataset.icb=ICP.bg;R.dataset.ica=ICP.acc?'on':'off';
  icLook(R);
  ICP.tabs.forEach((t,i)=>{const e=$('#'+t);if(e)e.style.order=String(i)});
}
function icRestore(){
  const R=document.documentElement,top=$('#top'),hrow=top&&top.querySelector('.hr'),plus=$('#plus'),gear=$('#gear'),cb=$('#cb'),qk=$('#qk');
  ['ic','icsh','icb','ica','icsd','icbw','iccol','icink','ict','icts'].forEach(a=>R.removeAttribute('data-'+a));
  ['--ics','--icg','--icgs','--icbw','--icbase','--ici'].forEach(v=>R.style.removeProperty(v));
  [plus,cb,qk,gear].forEach(b=>b&&b.classList.remove('icoff'));
  ['t1','t2','t3'].forEach(t=>{const e=$('#'+t);if(e)e.style.order=''});
  if(hrow&&plus&&gear){hrow.insertBefore(plus,hrow.firstChild);if(cb)plus.after(cb);hrow.appendChild(gear);if(qk&&top)top.insertBefore(qk,$('#tb'))}
  ['ihl','ihr','hbx','hby'].forEach(id=>{const g=$('#'+id);if(g)g.remove()});
}
function icPvHtml(sel){
  const d=getDock(),pvs=Math.round(ICP.size*.62),gl=Math.round(pvs*ICP.gs/100);
  const g=p=>ICP.ord.filter(k=>icEff(k)===p).map(k=>`<span class="pvi${sel===k?' sel':''}" data-pk="${k}" data-k="${k}" role="button" tabindex="0" aria-label="${IC_NAME[k]}" title="${IC_NAME[k]}">${ic(IC_ICON[k],gl)}</span>`).join('');
  const lab=ICP.tabs.map(t=>`<b>${IC_TAB[t][1].toUpperCase()}</b>`).join(''),tic=ICP.tabs.map(t=>`<span>${ic(IC_TAB[t][0],20)}</span>`).join('');
  return `<div class="icpv" data-dock="${d}" data-sh="${ICP.sh}" data-bg="${ICP.bg}" data-acc="${ICP.acc?'on':'off'}" data-psd="${ICP.sd}" data-pts="${ICP.ts}" style="--pvs:${pvs}px;--pvg:${Math.round(ICP.gap*.7)}px;--pvgs:${ICP.gs/100}${ICP.bw===null?'':';--pvbw:'+ICP.bw+'px'}${ICP.col?';--pvc:'+ICP.col:''}${ICP.ink?';--pvk:'+ICP.ink:''}"><div class="pvm"><div class="pvh"><div class="pvg">${g('hl')}</div>${d==='top'?'':'<span class="pvl">traX</span>'}<div class="pvg">${g('hr')}</div></div>${d==='top'?`<div class="pvt">${lab}</div>`:''}<div class="pvbody"><span></span><span></span><span></span><span></span><span></span><span></span></div></div>${d==='top'?'':`<div class="pvbar"><div class="pvg">${g('nl')}</div><div class="pvg pvtb">${tic}</div><div class="pvg">${g('nr')}</div></div>`}</div>`;
}
function icSheet(){
  let sel='plus';
  openOv(`<h3>Layout &amp; placement</h3><div id="icpv"></div><p class="dupn" id="icnote" style="margin:0 6px 12px"></p><div id="icb"></div>`);
  const sh=$('#ov .sheet'),chip=(on,a,t)=>`<button type="button" class="chip${on?' on':''}" ${a}>${t}</button>`;
  const body=()=>{
    const row=k=>{const g=ICP.ord.filter(x=>icEff(x)===icEff(k)),i=g.indexOf(k);
      return `<div class="icr${sel===k?' on':''}" data-rk="${k}"><div class="icrt"><span class="icri">${ic(IC_ICON[k],22)}</span><b>${IC_NAME[k]}</b><span class="icrm"><button type="button" class="ib" data-mv="${k}" data-d="-1" aria-label="Move ${IC_NAME[k]} earlier"${i<1?' disabled':''}>${ic('up',20)}</button><button type="button" class="ib" data-mv="${k}" data-d="1" aria-label="Move ${IC_NAME[k]} later"${i>=g.length-1?' disabled':''}>${ic('down',20)}</button></span></div><div class="bgst icrc">${IC_POS.filter(p=>!(k==='gear'&&p[0]==='off')).map(p=>chip(ICP.pos[k]===p[0],`data-pos="${p[0]}" data-k="${k}"`,p[1])).join('')}</div></div>`};
    const trow=(t,i)=>`<div class="icr"><div class="icrt"><span class="icri">${ic(IC_TAB[t][0],22)}</span><b>${IC_TAB[t][1]}</b><span class="icrm"><button type="button" class="ib" data-tmv="${t}" data-d="-1" aria-label="Move ${IC_TAB[t][1]} earlier"${i<1?' disabled':''}>${ic('up',20)}</button><button type="button" class="ib" data-tmv="${t}" data-d="1" aria-label="Move ${IC_TAB[t][1]} later"${i>=2?' disabled':''}>${ic('down',20)}</button></span></div></div>`;
    const sl=(id,l,v,mn,mx,df,u='px')=>`<div class="fop${v===df?' dflt':''}"><span>${l}</span><input type="range" class="rng" id="${id}" min="${mn}" max="${mx}" value="${v}" style="--p:${(v-mn)/(mx-mn)*100}%" aria-label="${l}"><b>${v}${u}</b><button type="button" class="rsb" data-icrs="${id}" aria-label="Reset ${l} to default" title="Reset to default">${ic('rst',16)}</button></div>`;
    const chs=(list,cur,attr)=>list.map(p=>chip(cur===p[0],`${attr}="${p[0]}"`,p[1])).join('');
    const sw=(attr,on,t,sm)=>`<button type="button" class="srow" ${attr} role="switch" aria-checked="${on}"><span class="st"><b>${t}</b>${sm?`<small>${sm}</small>`:''}</span><span class="stog"></span></button>`;
    const colr=(id,l,v,fb)=>`<div class="icr"><div class="icrt"><b>${l}</b><span class="icrm"><input type="color" class="iccp${v?' set':''}" id="${id}" value="${v||fb}" aria-label="${l}"><button type="button" class="pill" data-iccl="${id}"${v?'':' disabled'}>Auto</button></span></div></div>`;
    return preHtml()+`<div class="scd"><h4>Buttons</h4>${ICP.ord.map(row).join('')}</div>
    <div class="scd"><h4>Tabs</h4>${ICP.tabs.map(trow).join('')}
    ${sw('data-tf="1"',ICP.tf,'Icon size and spacing apply to tabs','The size and spacing sliders below also resize the tabs and the gap between them.')}
    <div class="icr"><div class="icrt"><b>Tab style</b></div><div class="bgst icrc">${chs(IC_TS,ICP.ts,'data-ts')}</div></div></div>
    <div class="scd"><h4>Look</h4><div class="bgs">${sl('icsz','Icon size',ICP.size,32,60,44)}${sl('icgp','Spacing',ICP.gap,0,24,8)}${sl('icgs','Icon inside button',ICP.gs,40,80,52,'%')}${sl('icbw','Border',ICP.bw===null?1:ICP.bw,0,4,ICP.bw===null?1:-1)}</div>
    <div class="icr"><div class="icrt"><b>Shape</b></div><div class="bgst icrc">${chs(IC_SH,ICP.sh,'data-sh')}</div></div>
    <div class="icr"><div class="icrt"><b>Background</b></div><div class="bgst icrc">${chs(IC_BG,ICP.bg,'data-bgm')}</div></div>
    <div class="icr"><div class="icrt"><b>Shadow</b></div><div class="bgst icrc">${chs(IC_SD,ICP.sd,'data-sd')}</div></div>
    ${colr('iccol','Button colour',ICP.col,'#1db954')}${colr('icink','Icon colour',ICP.ink,'#ffffff')}
    ${sw('data-acc="1"',ICP.acc,'Accent colour icons')}
    ${sw('data-hdac="1"',HDAC.on,'Colour from the song',"Add, Cloud, Queue and Settings follow the current song's colour, like the X in the traX logo.")}</div>
    <div class="bt"><button type="button" class="pill mr" data-icreset="1">Reset</button><button type="button" class="pill acc" data-icdone="1">Done</button></div>`;
  };
  const pv=()=>{$('#icpv').innerHTML=icPvHtml(sel);
    const bar=ICP.ord.some(k=>(ICP.pos[k]==='nl'||ICP.pos[k]==='nr')&&getDock()==='top');
    $('#icnote').textContent=bar?'Bar start and Bar end need the navigation bar on the left, right or bottom (Settings, Layout). Until then they stay at the top.':'Tap an icon to select it.'};
  const paint=()=>{pv();$('#icb').innerHTML=body()};
  const apply=()=>{ICP.on=true;icSave();try{hbPlace()}catch(_){}if(typeof npApply==='function')try{npApply()}catch(_){}};
  const swap=(arr,k,d)=>{const i=arr.indexOf(k),j=i+d;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]]};
  sh.onclick=e=>{
    const t=e.target;
    if(t.closest('[data-icdone]')){closeOv();return}
    if(preClick(t,paint))return;
    const p=t.closest('.pvi');if(p){sel=p.dataset.pk;paint();const r=sh.querySelector(`[data-rk="${sel}"]`);if(r)r.scrollIntoView({block:'nearest',behavior:RM.matches?'auto':'smooth'});return}
    const rw=t.closest('[data-rk]');if(rw&&!t.closest('.chip,.ib')){sel=rw.dataset.rk;paint();return}
    if(t.closest('[data-icreset]')){const d=icDef();Object.assign(ICP,d,{on:false});icSave();try{hbPlace()}catch(_){}if(typeof npApply==='function')try{npApply()}catch(_){}sel='plus';paint();toast('Standard layout restored');return}
    const c=t.closest('[data-pos]');if(c){ICP.pos[c.dataset.k]=c.dataset.pos;sel=c.dataset.k;apply();paint();return}
    const m=t.closest('[data-mv]');if(m&&!m.disabled){const k=m.dataset.mv,d=+m.dataset.d,g=ICP.ord.filter(x=>icEff(x)===icEff(k)),i=g.indexOf(k),o=g[i+d];if(o){swap(ICP.ord,k,0);const a=ICP.ord.indexOf(k),b=ICP.ord.indexOf(o);ICP.ord[a]=o;ICP.ord[b]=k}sel=k;apply();paint();return}
    const tm=t.closest('[data-tmv]');if(tm&&!tm.disabled){swap(ICP.tabs,tm.dataset.tmv,+tm.dataset.d);apply();paint();return}
    const sp=t.closest('[data-sh]');if(sp){ICP.sh=sp.dataset.sh;apply();paint();return}
    const sdc=t.closest('[data-sd]');if(sdc){ICP.sd=sdc.dataset.sd;apply();paint();return}
    const tsc=t.closest('[data-ts]');if(tsc){ICP.ts=tsc.dataset.ts;apply();paint();return}
    if(t.closest('[data-tf]')){ICP.tf=!ICP.tf;apply();paint();return}
        const rs=t.closest('[data-icrs]');if(rs){const id=rs.dataset.icrs;if(id==='icsz')ICP.size=44;else if(id==='icgp')ICP.gap=8;else if(id==='icgs')ICP.gs=52;else if(id==='icbw')ICP.bw=null;apply();paint();return}
    const ccl=t.closest('[data-iccl]');if(ccl&&!ccl.disabled){ICP[ccl.dataset.iccl==='iccol'?'col':'ink']=null;apply();paint();return}
    const bm=t.closest('[data-bgm]');if(bm){ICP.bg=bm.dataset.bgm;apply();paint();return}
    if(t.closest('[data-acc]')){ICP.acc=!ICP.acc;apply();paint();return}
    if(t.closest('[data-hdac]')){HDAC.on=!HDAC.on;LS('tracks-hdac',HDAC.on?'1':'0');hdacApply();paint();return}
  };
  sh.oninput=e=>{const i=e.target;
    if(i.id==='iccol'||i.id==='icink'){ICP[i.id==='iccol'?'col':'ink']=i.value;apply();pv();i.classList.add('set');const r=i.parentNode.querySelector('[data-iccl]');if(r)r.disabled=false;return}
    if(!['icsz','icgp','icgs','icbw'].includes(i.id))return;
    const v=+i.value,mn=+i.min,mx=+i.max;if(i.id==='icsz')ICP.size=v;else if(i.id==='icgp')ICP.gap=v;else if(i.id==='icgs')ICP.gs=v;else ICP.bw=v;
    i.style.setProperty('--p',((v-mn)/(mx-mn)*100)+'%');i.parentNode.querySelector('b').textContent=v+(i.id==='icgs'?'%':'px');i.parentNode.classList.remove('dflt');apply();pv()};
  sh.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('pvi')){e.preventDefault();e.target.click()}};
  {const hd=sh.querySelector('.sthd');if(hd){const a=$('#icpv'),n=$('#icnote');a.style.margin='6px auto 4px';n.style.margin='0 6px';hd.appendChild(a);hd.appendChild(n)}}
  paint();
}
function hbPlace(){
  if(ICP.on){icApply();return}
  if(document.documentElement.dataset.ic)icRestore();
  const R=document.documentElement,top=$('#top'),hr=top&&top.querySelector('.hr'),plus=$('#plus'),gear=$('#gear'),tabs=document.querySelector('.tabs');
  if(!top||!hr||!plus||!gear||!tabs)return;
  const d=getDock(),w=top.clientWidth,cb=$('#cb'),qk=$('#qk');
  const want=R.dataset.layout==='pc'&&(HBM.m==='on'||(HBM.m==='auto'&&w>0&&w<(d==='top'?620:640)));
  let gx=$('#hbx'),gy=$('#hby');
  if(want){
    if(!gx){gx=document.createElement('div');gx.id='hbx';gy=document.createElement('div');gy.id='hby'}
    const host=tabs.parentNode;
    if(gx.parentNode!==host||gx.nextSibling!==tabs)host.insertBefore(gx,tabs);
    if(gy.parentNode!==host||gy.previousSibling!==tabs)host.insertBefore(gy,tabs.nextSibling);
    if(plus.parentNode!==gx)gx.appendChild(plus);
    if(cb&&cb.parentNode!==gx)gx.appendChild(cb);
    if(qk&&qk.parentNode!==gy)gy.appendChild(qk);
    if(gear.parentNode!==gy)gy.appendChild(gear);
    R.dataset.hb='dock';
  }else if(R.dataset.hb==='dock'){
    hr.insertBefore(plus,hr.firstChild);
    if(cb)plus.after(cb);
    hr.appendChild(gear);
    if(qk)top.insertBefore(qk,$('#tb'));
    if(gx)gx.remove();if(gy)gy.remove();
    delete R.dataset.hb;
  }
}
try{new ResizeObserver(()=>{try{hbPlace()}catch(e){}}).observe($('#top'))}catch(e){}
try{hbPlace()}catch(e){}
function setDockC(on){/* Settings switch: icons only <-> normal size */
  const d=getDock();
  if(d==='top'){DKC.on=!!on;LS('tracks-dockc',on?'1':'0')}else LS(dkKey(),on?(d==='bottom'?'54':'58'):'');
  dockSync();if(typeof npApply==='function')npApply();
}
(function(){
  const dock=$('#dock');if(!dock)return;
  document.querySelectorAll('.tab').forEach(t=>{t.title=t.textContent.trim()});
  dockSync();
})();
/* top bar look: colour, transparency and blur (applies to the section bar too when it is not on top) */
const TPB={c:'',t:null,b:null};
try{const j=JSON.parse(LS('tracks-topbar')||'null');if(j&&typeof j==='object'){if(/^#[0-9a-f]{6}$/i.test(j.c))TPB.c=j.c;if(typeof j.t==='number'&&isFinite(j.t))TPB.t=Math.min(100,Math.max(0,j.t));if(typeof j.b==='number'&&isFinite(j.b))TPB.b=Math.min(40,Math.max(0,j.b))}}catch(e){}
const tpbSave=()=>LS('tracks-topbar',JSON.stringify(TPB));
function tpbApply(){
  const r=document.documentElement,s=r.style;
  if(!TPB.c&&TPB.t===null&&TPB.b===null){r.removeAttribute('data-tpb');r.removeAttribute('data-tpt');['--tpc','--tpa','--tpbl'].forEach(k=>s.removeProperty(k));return}
  r.setAttribute('data-tpb','1');
  const t=TPB.t===null?22:TPB.t;
  s.setProperty('--tpa',(1-t/100).toFixed(2));s.setProperty('--tpbl',(TPB.b===null?18:TPB.b)+'px');
  let tone='';
  if(TPB.c){const v=[1,3,5].map(i=>parseInt(TPB.c.substr(i,2),16));s.setProperty('--tpc',v.join(','));if(t<=50)tone=(0.299*v[0]+0.587*v[1]+0.114*v[2])>150?'dark':'light'}else s.removeProperty('--tpc');
  if(tone)r.setAttribute('data-tpt',tone);else r.removeAttribute('data-tpt');
}
tpbApply();
const BGP=['#000000','#1c1c1e','#0f172a','#102a1f','#2b1220','#241638','#f4ecd8','#e3f2e9','#dbeafe','#fde7ef'];
let setTab='app';
const HINT={on:LS('tracks-hints')!=='0'};
/* Songs toolbar: the classic round search, select and sort buttons */
function tbmApply(){document.documentElement.dataset.tbm='legacy';const sb=document.getElementById('sb');if(sb){sb.classList.remove('open');const t=document.getElementById('tb');if(t)t.classList.remove('so')}}
tbmApply();
const GEST={on:LS('tracks-gest')!=='0'};
/* PC: right-click empty space opens the Add / Create menu at the cursor; right-click a song, album, playlist or folder opens its 3-dots menu */
const RCA={on:LS('tracks-rcadd')!=='0'};
const RCI={on:LS('tracks-rcitem')!=='0'};
let ctxAt=null;
document.addEventListener('contextmenu',e=>{
  if((!RCA.on&&!RCI.on)||document.documentElement.dataset.layout!=='pc'||e.defaultPrevented)return;
  const t=e.target;if(!t||!t.closest||!t.closest('#main'))return;
  if($('#ov').classList.contains('open')||$('#full').classList.contains('open')||qOpen||selMode||gMode)return;
  const it=t.closest('.row,.acard,.fcard');
  if(it){
    if(!RCI.on)return;
    const d=it.querySelector('.k[data-act=menu],.alm,.fm');if(!d)return;
    e.preventDefault();ctxAt={x:e.clientX,y:e.clientY};d.click();ctxAt=null;return;
  }
  if(!RCA.on||t.closest('button,a,input,textarea,select,label,video,img,[data-act],[contenteditable]'))return;
  const p=$('#plus');if(!p||p.classList.contains('off'))return;
  e.preventDefault();ctxAt={x:e.clientX,y:e.clientY};p.click();ctxAt=null;
},true);
const HDAC={on:LS('tracks-hdac')!=='0'};
const hdacApply=()=>document.documentElement.setAttribute('data-hdac',HDAC.on?'on':'off');
hdacApply();
/* Queue button with the side player: the side player has its own queue, so the header Queue button used to disappear whenever it was on. This setting keeps it visible (header or navigation bar). */
const QKS={on:LS('tracks-qks')==='1'};
const qksApply=()=>document.documentElement.setAttribute('data-qkv',QKS.on?'on':'off');
const qksSet=on=>{QKS.on=!!on;LS('tracks-qks',QKS.on?'1':'0');qksApply()};
qksApply();
const hintApply=()=>document.documentElement.setAttribute('data-hints',HINT.on?'on':'off');
hintApply();
function openSettings(){
  const opt=(a,v,k,lb)=>`<button type="button" class="setg" ${a}="${v}">${ic(k,24)}<span>${lb}</span></button>`;
  const chev='<svg class="sch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const row=(x,t,d,v)=>`<button type="button" class="srow" data-x="${x}"><span class="st"><b>${t}</b>${d?`<small>${d}</small>`:''}</span>${v?`<span class="sv">${v}</span>`:''}${chev}</button>`;
  const TABS=[['app','Look'],['lay','Layout'],['play','Playback'],['lib','Library'],['data','Backup']];
  const appCard=`<div class="scd"><h4>App</h4>${row('swu',SWU.w?'Update available':'Check for updates',SWU.w?'Tap to restart and update':'See if a new version is ready',SWU.w?'Install':'')}</div>`;
  openOv(`<div class="sthd"><div class="sth"><h3>Settings</h3><button type="button" class="pill acc" id="st-done">Done</button></div>
  <div class="stt" role="tablist">${TABS.map(t=>`<button type="button" role="tab" data-tab="${t[0]}">${t[1]}${t[0]==='data'&&SWU.w?'<i class="tdot"></i>':''}</button>`).join('')}</div></div>
  <section class="stp" data-p="app">
    <div class="scd"><h4>Theme</h4><div class="setr">${opt('data-t','light','sun','Light')}${opt('data-t','dark','moon','Dark')}${opt('data-t','custom','palette','Custom')}</div>
    <div class="cset" id="cset" hidden><label>Background colour</label><div class="sw" id="cbsw">${BGP.map(c=>`<button type="button" class="swb" data-c="${c}" style="background:${c}" aria-label="Background ${c}"></button>`).join('')}<label class="swc" aria-label="Custom colour"><input type="color" id="cbk">${ic('palette',16)}</label></div><p class="dupn" id="cnote" style="margin:2px 6px 2px"></p></div></div>
    <div class="scd"><h4>Background</h4><div class="tgs"><label>Image, GIF or video</label><div class="cvrow"><div class="thumb" id="tbth"></div><div class="cvb"><span id="tbcap" style="font-size:12px;color:var(--mute)"></span><button type="button" class="pill" id="tbip"></button><button type="button" class="pill" id="tbcr">Crop and position</button><button type="button" class="pill" id="tbir">Remove</button></div></div>
    <div id="tbmore" hidden><button type="button" class="srow" id="tbon" role="switch" aria-checked="false"><span class="st"><b>Show behind the app</b></span><span class="stog"></span></button><div class="bgs"><div class="fop"><span>Dim</span><input type="range" class="rng" id="tbd" min="0" max="90" aria-label="Dim"><b></b></div><div class="fop"><span>Blur</span><input type="range" class="rng" id="tbb" min="0" max="30" aria-label="Blur"><b></b></div></div></div></div></div>
    <div class="scd"><h4>Top bar</h4><div class="sw" id="tpsw"><button type="button" class="swb auto" data-c="" aria-label="Automatic color">${ic('close',14)}</button>${PAL.map(c=>`<button type="button" class="swb" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="swc" aria-label="Custom color"><input type="color" id="tpcc">${ic('palette',16)}</label></div><div class="bgs"><div class="fop"><span>Transparency</span><input type="range" class="rng" id="tpt" min="0" max="100" aria-label="Transparency"><b></b></div><div class="fop"><span>Blur</span><input type="range" class="rng" id="tpb" min="0" max="40" aria-label="Blur"><b></b></div></div><div class="bt" style="margin-top:6px"><button type="button" class="pill" id="tpr">Reset top bar</button></div></div>
    <div class="scd"><h4>Animated media</h4><div class="bgst" id="anst"><button type="button" class="chip" data-v="all">Everywhere</button><button type="button" class="chip" data-v="big">Players and album pages</button><button type="button" class="chip" data-v="off">Off</button></div><p class="dupn" style="margin:8px 6px 2px">GIF and video covers and backgrounds. Turn off to save battery.</p></div>
    <div class="scd"><h4>Performance</h4><div class="bgst" id="pfst"><button type="button" class="chip" data-pf="off">Off</button><button type="button" class="chip" data-pf="auto">Auto</button><button type="button" class="chip" data-pf="on">On</button><button type="button" class="chip" data-pf="custom">Custom</button></div><p class="dupn" id="pfn" style="margin:8px 6px 2px"></p><div class="pfl" id="pfl" hidden>${PF.map(k=>`<button type="button" class="pfr" data-pfk="${k[0]}" role="switch" aria-checked="false"><span class="pft"><b>${k[1]}</b><small>${k[2]}</small></span><i class="pfs" aria-hidden="true"></i></button>`).join('')}</div></div>
    <div class="scd"><h4>Hints</h4><button type="button" class="srow" data-hint="1" role="switch" aria-checked="true"><span class="st"><b>Show empty-page hints</b><small>Tips on empty pages.</small></span><span class="stog"></span></button></div>
  </section>
  <section class="stp" data-p="lay">
    <div class="scd"><h4>Layout mode</h4><div class="setr">${opt('data-m','auto','devices','Auto')}${opt('data-m','phone','phone','Phone')}${opt('data-m','pc','desk','PC')}</div><p class="dupn" id="setn" style="margin:6px 6px 2px"></p></div>
    <div class="scd"><h4>Navigation bar</h4><div class="setr s4">${opt('data-d','top','dkt','Top')}${opt('data-d','left','dkl','Left')}${opt('data-d','right','dkr','Right')}${opt('data-d','bottom','dkb','Bottom')}</div><button type="button" class="srow" data-dkc="1" role="switch" aria-checked="false"><span class="st"><b>Compact bar</b><small>Icons only.</small></span><span class="stog"></span></button></div>
    <div class="scd"><h4>Buttons</h4>${row('icl','Layout and placement','Presets, icon layout, button and tab looks',ICP.on||Object.keys(FP.p).length?'On':'')}
    <p class="dupn" style="margin:10px 6px 8px">Header buttons (Add, Cloud, Queue, Settings). PC only; the layout editor overrides this.</p><div class="bgst" id="hbst"><button type="button" class="chip" data-hbm="auto">Small windows</button><button type="button" class="chip" data-hbm="on">Always on bar</button><button type="button" class="chip" data-hbm="off">Never</button></div>
    <button type="button" class="srow" data-qks="1" role="switch" aria-checked="false"><span class="st"><b>Keep the queue button</b><small>Show it even when the side player is on.</small></span><span class="stog"></span></button></div>
    <div class="scd"><h4>Mouse and touch</h4><button type="button" class="srow" data-rca="1" role="switch" aria-checked="true"><span class="st"><b>Right-click to add</b><small>PC only. Opens the Add menu on empty space.</small></span><span class="stog"></span></button><button type="button" class="srow" data-rci="1" role="switch" aria-checked="true"><span class="st"><b>Right-click songs, albums and playlists</b><small>PC only. Same menu as the 3 dots.</small></span><span class="stog"></span></button><button type="button" class="srow" data-gest="1" role="switch" aria-checked="true"><span class="st"><b>Swipe from edge to go back</b><small>Also makes the phone's back gesture work in the app.</small></span><span class="stog"></span></button></div>
    <div class="scd"><h4>Side player</h4><button type="button" class="srow" data-npset="main" role="switch" aria-checked="false"><span class="st"><b>Spotify style player</b><small>PC only. Cover and lyrics on the right.</small></span><span class="stog"></span></button><div id="npmore"><button type="button" class="srow" data-npset="ly" role="switch" aria-checked="true"><span class="st"><b>Show lyrics under the cover</b></span><span class="stog"></span></button><div class="bgs"><div class="fop"><span>Panel width</span><input type="range" class="rng" id="npwr" min="280" max="900" aria-label="Panel width"><b></b></div></div></div><p class="dupn" id="npn" style="margin:6px 6px 2px"></p></div>
  </section>
  <section class="stp" data-p="play">
    <div class="scd"><h4>Sound</h4>${row('outdev','Output device','Phone speaker, Bluetooth earbuds, headphones\u2026',esc(outName()))}${row('xfopen','Song transitions','Crossfade and gapless',esc(xfSummary()))}</div>
    <div class="scd"><h4>Playlists and buttons</h4><button type="button" class="srow" data-lk="1" role="switch" aria-checked="true"><span class="st"><b>Liked Songs playlist</b><small>Heart button and a Liked Songs playlist. Likes are kept if you turn it off.</small></span><span class="stog"></span></button><button type="button" class="srow" data-sp="1" role="switch" aria-checked="false"><span class="st"><b>Rotation playlist</b><small>Your recent favourites, updated automatically.</small></span><span class="stog"></span></button><button type="button" class="srow" data-onebtn="1" role="switch" aria-checked="false"><span class="st"><b>One add button</b><small>A single + in the players for Like, Album and Playlist.</small></span><span class="stog"></span></button></div>
  </section>
  <section class="stp" data-p="lib">
    <div class="scd"><h4>Manage library</h4>${row('stats','Listening stats','Most played and time listened')}${row('dups','Find duplicate songs','Review and remove extra copies')}${row('miss','Missing info finder','Songs missing artist, album, cover or lyrics')}${row('rfbulk','Replace audio in bulk','Swap many files at once')}</div>
    <div class="scd"><h4>Lyrics</h4><button type="button" class="srow" data-lrl="1" role="switch" aria-checked="true"><span class="st"><b>Find lyrics online (LRCLIB)</b><small>Looks up lyrics on lrclib.net when a song has none. Sends title, artist, album and length.</small></span><span class="stog"></span></button>${row('lyfind','Find lyrics online now','For every song without synced lyrics')}${row('lyscan','Scan lyrics','Look inside your song files')}${row('lymass','Add lyric files','Pick several .lrc files')}</div>
  </section>
  <section class="stp" data-p="data">
    ${SWU.w?appCard:''}
    <div class="scd"><h4>Sync and sharing</h4>${row('cloud','Google Drive sync','Back up and sync devices')}${row('shares','Ongoing shares','Songs, albums and playlists you share with a link',shCount()?String(shCount()):'')}</div>
    <div class="scd"><h4>Backup file</h4>${row('bkfull','Save full backup','Everything in one file')}${row('bksmall','Save small backup','Playlists and details, no songs')}${row('imp','Restore from backup','Pick a backup file')}</div>
    <div class="scd"><h4>Protection</h4><button type="button" class="srow" data-x="persist"><span class="st"><b>Keep library on this device</b><small id="stos">Checking\u2026</small></span><span class="sv" id="stov"></span>${chev}</button></div>
    ${SWU.w?'':appCard}
  </section>
  <div class="stfoot"><button type="button" class="pill" data-uundo="1" aria-label="Undo last change" disabled>${ic('undo',16)}Undo</button><span class="stul" id="st-ulab">Nothing to undo</span></div>`);
  const sh=$('#ov .sheet');sh.classList.add('setsh');
  const dkPaint=()=>{sh.querySelectorAll('[data-dkc]').forEach(b=>b.setAttribute('aria-checked',String(document.documentElement.dataset.dockc==='on')));const d=getDock();sh.querySelectorAll('.setg[data-d]').forEach(b=>b.classList.toggle('on',b.dataset.d===d));sh.querySelectorAll('#anst .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===ANIM.m));sh.querySelectorAll('#hbst .chip').forEach(c=>c.classList.toggle('on',c.dataset.hbm===HBM.m))};
  const tpPaint=()=>{
    sh.querySelectorAll('#tpsw .swb').forEach(b=>b.classList.toggle('on',(b.dataset.c||'').toLowerCase()===TPB.c.toLowerCase()));
    const t=TPB.t===null?22:TPB.t,bl=TPB.b===null?18:TPB.b;
    [['tpt',t,'%',100],['tpb',bl,'px',40]].forEach(([id,v,u,mx])=>{const i=$('#'+id);i.value=v;i.style.setProperty('--p',(v/mx*100)+'%');i.parentNode.querySelector('b').textContent=v+u});
    const cc=$('#tpcc');if(cc&&TPB.c&&!cc._live&&cc.value!==TPB.c)cc.value=TPB.c;
  };
  const tbPaint=()=>{
    const m=MED.get('theme'),has=!!m;
    $('#tbth').innerHTML=has?`<div class="cov"><img src="${esc(m.poster||medSrc({id:'theme'}).url)}" alt=""></div>`:'<div class="cov" style="background:var(--surf2);color:var(--mute)">+</div>';
    $('#tbcap').textContent=has?(TBG.on?'Showing your '+({img:'image',gif:'GIF',video:'video'}[m.t]||'media')+' behind the app':'Saved, but switched off'):'Nothing added yet';
    $('#tbip').textContent=has?'Change media':'Add image, GIF or video';$('#tbir').style.display=has?'':'none';$('#tbcr').style.display=has?'':'none';
    $('#tbmore').hidden=!has;$('#tbon').setAttribute('aria-checked',!!(has&&TBG.on));
    [['tbd','dim','%'],['tbb','blur','px']].forEach(([id,k,u])=>{const i=$('#'+id);i.value=TBG[k];i.style.setProperty('--p',(TBG[k]/+i.max*100)+'%');i.parentNode.querySelector('b').textContent=TBG[k]+u});
  };
  const npPaint=()=>{
    const a=sh.querySelector('[data-npset=main]'),l=sh.querySelector('[data-npset=ly]'),m=$('#npmore'),n=$('#npn'),w=$('#npwr'),pc=document.documentElement.dataset.layout==='pc';
    if(a)a.setAttribute('aria-checked',!!NP.on);if(l)l.setAttribute('aria-checked',!!NP.ly);if(m)m.hidden=!NP.on;sh.querySelectorAll('[data-qks]').forEach(q=>q.setAttribute('aria-checked',!!QKS.on));
    if(w){const mx=npMax();w.max=mx;const v=Math.min(NP.w,mx);w.value=v;w.style.setProperty('--p',(mx>280?Math.min(100,(v-280)/(mx-280)*100):100)+'%');w.parentNode.querySelector('b').textContent=v+'px'}
    if(n)n.textContent=NP.on&&!pc?'Needs the PC layout or a wider window.':'';
  };
  const pfPaint=()=>{sh.querySelectorAll('#pfst .chip').forEach(c=>c.classList.toggle('on',c.dataset.pf===PERF.m));const pl_=$('#pfl');if(pl_){pl_.hidden=PERF.m!=='custom';pl_.querySelectorAll('.pfr').forEach(b=>{const an=!PERF.c[b.dataset.pfk];b.classList.toggle('on',an);b.setAttribute('aria-checked',an?'true':'false')})}const n=$('#pfn');if(n)n.textContent=PERF_NOTE[PERF.m]+(PERF.m==='auto'?(PERF.on?' Active right now.':' Not needed right now.'):'')};
  const paint=()=>{
    paintTheme();
    sh.querySelectorAll('.setg[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===LAY.m));
    const cu=curTheme()==='custom';$('#cset').hidden=!cu;
    if(cu){const h=CT.shown||CT.hex;sh.querySelectorAll('#cbsw .swb').forEach(b=>b.classList.toggle('on',b.dataset.c===CT.hex));{const k_=$('#cbk');if(!k_._live&&k_.value!==CT.hex)k_.value=CT.hex}$('#cbsw .swc').classList.toggle('on',!BGP.includes(CT.hex));$('#cnote').textContent=CT.adj?'Adjusted to '+h+' for readable text.':'Text colour adjusts automatically.'}
    const n=$('#setn');if(n)n.textContent=LAY.m==='auto'?'':(LAY.m==='pc'?'Wide layout for computers.':'Compact touch layout.');
    sh.querySelectorAll('.stt button').forEach(b=>{const on=b.dataset.tab===setTab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
    sh.querySelectorAll('.stp').forEach(p=>p.hidden=p.dataset.p!==setTab);
    const sp=sh.querySelector('[data-sp]');if(sp)sp.setAttribute('aria-checked',!!rotOn);const lk_=sh.querySelector('[data-lk]');if(lk_)lk_.setAttribute('aria-checked',!!LIKE.on);const one_=sh.querySelector('[data-onebtn]');if(one_)one_.setAttribute('aria-checked',!!ONE.on);
    const hn=sh.querySelector('[data-hint]');if(hn)hn.setAttribute('aria-checked',!!HINT.on);uPaint();const gs_=sh.querySelector('[data-gest]');if(gs_)gs_.setAttribute('aria-checked',!!GEST.on);{const rc_=sh.querySelector('[data-rca]');if(rc_)rc_.setAttribute('aria-checked',!!RCA.on);const ri_=sh.querySelector('[data-rci]');if(ri_)ri_.setAttribute('aria-checked',!!RCI.on)}
    const lr_=sh.querySelector('[data-lrl]');if(lr_)lr_.setAttribute('aria-checked',!!LRL.on);
    tbPaint();dkPaint();tpPaint();npPaint();pfPaint();
  };
  paint();stoPaint();
  sh.onclick=e=>{
    if(e.target.closest('#st-done')){closeOv();return}
    {const u_=e.target.closest('[data-uundo]');if(u_){if(!u_.disabled)uUndo();return}}
    const tb=e.target.closest('[data-tab]');if(tb){setTab=tb.dataset.tab;paint();sh.scrollTop=0;return}
    const tw_=e.target.closest('#tpsw .swb');if(tw_){TPB.c=tw_.dataset.c||'';tpbSave();tpbApply();paint();return}
    const hbm_=e.target.closest('#hbst .chip');if(hbm_){setHbm(hbm_.dataset.hbm);paint();return}
    const pf_=e.target.closest('#pfst .chip');if(pf_){setPerf(pf_.dataset.pf);paint();return}
    const pfr_=e.target.closest('#pfl .pfr');if(pfr_){const k=pfr_.dataset.pfk;setPerfF(k,!PERF.c[k]);paint();return}
    const an_=e.target.closest('#anst .chip');if(an_){setAnim(an_.dataset.v);paint();return}
    const w=e.target.closest('#cbsw .swb');if(w){setCustomBg(w.dataset.c,true);paint();return}
    const lrl_=e.target.closest('[data-lrl]');if(lrl_){LRL.on=!LRL.on;LS('tracks-lrclib',LRL.on?'1':'0');paint();return}
    const hn=e.target.closest('[data-hint]');if(hn){HINT.on=!HINT.on;LS('tracks-hints',HINT.on?'1':'0');hintApply();paint();return}
    const rci_=e.target.closest('[data-rci]');if(rci_){RCI.on=!RCI.on;LS('tracks-rcitem',RCI.on?'1':'0');paint();return}
    const rca_=e.target.closest('[data-rca]');if(rca_){RCA.on=!RCA.on;LS('tracks-rcadd',RCA.on?'1':'0');paint();return}
    const gsb_=e.target.closest('[data-gest]');if(gsb_){GEST.on=!GEST.on;LS('tracks-gest',GEST.on?'1':'0');paint();return}
    const dkc_=e.target.closest('[data-dkc]');if(dkc_){setDockC(document.documentElement.dataset.dockc!=='on');paint();return}
    const qks_=e.target.closest('[data-qks]');if(qks_){qksSet(!QKS.on);paint();return}
    const npb_=e.target.closest('[data-npset]');
    if(npb_){if(npb_.dataset.npset==='main'){NP.on=!NP.on;LS('tracks-np',NP.on?'1':'0')}else{NP.ly=!NP.ly;LS('tracks-npl',NP.ly?'1':'0')}npApply();paint();return}
    const lkb_=e.target.closest('[data-lk]');if(lkb_){likeSet(!LIKE.on);paint();return}
    const onb_=e.target.closest('[data-onebtn]');if(onb_){oneSet(!ONE.on);paint();return}
    const sp=e.target.closest('[data-sp]');if(sp){rotSet(!rotOn);paint();return}
    const x=e.target.closest('[data-x]');
    if(x){const k=x.dataset.x;
      if(k==='stats'){closeOv();setTimeout(statsSheet,380)}
      else if(k==='cloud'){closeOv();setTimeout(cloudSheet,380)}
      else if(k==='shares'){closeOv();setTimeout(sharesSheet,380)}
      else if(k==='bkfull')bkExport(true);
      else if(k==='bksmall')bkExport(false);
      else if(k==='imp')importBackup();
      else if(k==='persist')stoAsk();
      else if(k==='dups'){closeOv();setTimeout(dupSheet,380)}
      else if(k==='miss'){closeOv();setTimeout(()=>missSheet('all'),380)}
      else if(k==='swu')swuAct();
      else if(k==='lyscan')lyScanAll(true);
      else if(k==='lyfind')lyFindAll();
      else if(k==='lymass'){closeOv();setTimeout(lyMassPick,60)}
      else if(k==='outdev'){closeOv();setTimeout(outSheet,380)}
      else if(k==='xfopen'){closeOv();setTimeout(xfSheet,380)}
      else if(k==='icl'){closeOv();setTimeout(icSheet,380)}else if(k==='fpe'){closeOv();setTimeout(()=>fpEdit(true),380)}
      else if(k==='rfbulk'){closeOv();rfBulkPick()}
      return}
    const b=e.target.closest('.setg');if(!b)return;
    if(b.dataset.t)setTheme(b.dataset.t,true);else if(b.dataset.m)setLayout(b.dataset.m,true);else if(b.dataset.d)setDock(b.dataset.d);paint()};
  /* native colour pickers (phones): while the picker is open the page is only recoloured, once per frame.
     No repaint of the sheet and no rewriting of the input's own value (that closes or resets the picker on Android and iOS),
     no transition class and no storage write per event. The colour is saved when the picker closes (change/blur) or after a short pause. */
  const liveColor=(inp,live,commit)=>{
    let raf=0,v='',tm=0;
    const flush=()=>{clearTimeout(tm);if(raf){cancelAnimationFrame(raf);raf=0}if(inp._live){inp._live=0;commit(inp.value||v)}};
    inp.addEventListener('input',()=>{
      v=inp.value;inp._live=1;
      if(!raf)raf=requestAnimationFrame(()=>{raf=0;live(v)});
      clearTimeout(tm);tm=setTimeout(flush,700);
    });
    inp.addEventListener('change',flush);inp.addEventListener('blur',flush);
  };
  liveColor($('#cbk'),v=>{CT.hex=v.toLowerCase();applyCustom(CT.hex);paintTheme()},v=>{setCustomBg(v,true);paint()});
  liveColor($('#tpcc'),v=>{TPB.c=v;tpbApply()},v=>{TPB.c=v;tpbSave();tpbApply();paint()});
  $('#tpt').oninput=e=>{TPB.t=+e.target.value;tpbSave();tpbApply();paint()};
  $('#tpb').oninput=e=>{TPB.b=+e.target.value;tpbSave();tpbApply();paint()};
  $('#npwr').oninput=e=>{NP.w=+e.target.value;LS('tracks-npw',String(NP.w));npApply();paint()};
  $('#tpr').onclick=()=>{TPB.c='';TPB.t=null;TPB.b=null;tpbSave();tpbApply();paint()};
  $('#tbip').onclick=()=>$('#tbi').click();
  $('#tbi').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
    const r=await makeThemeMedia(f);if(!r)return cvFail('Could not read that file');
    const o=MED.get('theme');if(o&&o.url)try{URL.revokeObjectURL(o.url)}catch(_){}
    MED.set('theme',{blob:r.blob,t:r.t,poster:r.poster});TBG.p=r.p||null;
    if(!(await medPut({id:'theme',blob:r.blob,t:r.t,poster:r.poster,mod:Date.now()})))toast('Could not keep it on this device, it will be lost when you close the app');
    TBG.on=true;TBG.t=r.t;tbgSave();tbgApply();tbPaint()};
  $('#tbcr').onclick=async()=>{const m=MED.get('theme');if(!m)return;
    if(m.t==='img'){
      const ar=scrAr(),cr=await cropSheet(m.blob,'img',ar,null,true);if(!cr||cr.def)return;
      const nb=await cropBake(m.blob,ar,1920,cr);if(!nb)return;
      if(m.url)try{URL.revokeObjectURL(m.url)}catch(_){}
      MED.set('theme',{blob:nb,t:'img',poster:''});await medPut({id:'theme',blob:nb,t:'img',poster:'',mod:Date.now()});
      tbgApply();tbPaint();return}
    const cr=await cropSheet(m.blob,m.t==='video'?'video':'gif',scrAr(),TBG.p,true);if(!cr)return;
    TBG.p=cr.def?null:[+cr.tx.toFixed(2),+cr.ty.toFixed(2),+cr.z.toFixed(3)];tbgSave();tbgApply();tbPaint()};
  $('#tbir').onclick=async()=>{const o=MED.get('theme');MED.delete('theme');if(o&&o.url)try{URL.revokeObjectURL(o.url)}catch(_){}await medDel('theme');TBG.on=false;TBG.p=null;tbgSave();tbgApply();tbPaint()};
  $('#tbon').onclick=()=>{TBG.on=!TBG.on;tbgSave();tbgApply();tbPaint()};
  $('#tbd').oninput=e=>{TBG.dim=+e.target.value;tbgSave();tbgApply();tbPaint()};
  $('#tbb').oninput=e=>{TBG.blur=+e.target.value;tbgSave();tbgApply();tbPaint()};
}
/* keyboard shortcuts (PC mode) */
addEventListener('keydown',e=>{
  if(document.documentElement.dataset.layout!=='pc'||e.ctrlKey||e.metaKey||e.altKey)return;
  const t=e.target,tag=t&&t.tagName;if((tag==='INPUT'&&t.type!=='range')||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
  if(e.key==='Escape'){if($('#ov').classList.contains('open'))closeOv();else if(typeof qOpen!=='undefined'&&qOpen)closeQ();else if($('#full').classList.contains('open'))closeFull();return}
  if($('#ov').classList.contains('open'))return;
  if((e.key==='q'||e.key==='Q')&&tag!=='INPUT'){e.preventDefault();$('#qp').classList.contains('open')?closeQ():openQ();return}
  if(e.key==='/'&&tag!=='INPUT'){e.preventDefault();openSearch();return}
  if(e.code==='Space'&&tag!=='BUTTON'){if(cur){e.preventDefault();xfTogglePlay();renderMini()}}
  else if(e.key==='ArrowRight'&&tag!=='INPUT'){e.preventDefault();if(e.shiftKey)step(1);else if(vD())vSeek(vT()+5)}
  else if(e.key==='ArrowLeft'&&tag!=='INPUT'){e.preventDefault();if(e.shiftKey)step(-1);else vSeek(vT()-5)}
  else if((e.key==='m'||e.key==='M')&&cur)toggleMute();
  else if((e.key==='l'||e.key==='L')&&cur&&$('#full').classList.contains('open'))lyToggle();
});

/* announce the song that starts (screen readers): debounced so quick skips say only the last one */
let _npT=0;
au.addEventListener('loadstart',()=>{if(restoring)return;clearTimeout(_npT);_npT=setTimeout(()=>{const s=cur&&songById(cur);if(s)say('Now playing '+s.name+(artOf(s)?', '+artOf(s):''))},350)});
/* playback errors: say so, skip ahead, and give up after a few failures in a row */
let auErr=0;
au.addEventListener('error',()=>{
  if(!au.getAttribute('src'))return;
  auErr++;
  if(restoring||auErr>3||queue.length<2){toast('This file cannot be played');return}
  toast('Cannot play this file, skipping');step(1,true);
});
au.addEventListener('playing',()=>{auErr=0});
/* after the first tap: ask the browser not to evict the library, and warn when space is nearly full */
addEventListener('pointerdown',async()=>{try{
  if(!songs.length||!navigator.storage)return;
  if(navigator.storage.persist&&!(await navigator.storage.persisted()))await navigator.storage.persist();
  if(navigator.storage.estimate){const e=await navigator.storage.estimate();if(e.quota&&e.usage/e.quota>.9)toast('Storage is almost full, remove songs you no longer need')}
}catch(e){}},{once:true});

