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
