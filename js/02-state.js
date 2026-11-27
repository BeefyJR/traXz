/* state */
let db=null,songs=[],albums=[],folders=[],playlists=[],pfolders=[],queue=[],upNext=[],ctxCur=null,qOpen=false,cur=null,shuffle=false,shOrig=[],repeat=0,curUrl=null,coverFor=null,seeking=false;
/* id -> song lookup used all over the player (it runs every frame and 40x a second): a map whose every hit is verified, with a scan as the fallback, so it can never return a stale song */
var _sIx=null,_sSrc=null,_sLen=-1;
function songById(id){
  if(id==null)return undefined;
  if(!_sIx||_sSrc!==songs||_sLen!==songs.length){_sIx=new Map();for(let i=0;i<songs.length;i++){const k=songs[i].id;if(!_sIx.has(k))_sIx.set(k,i)}_sSrc=songs;_sLen=songs.length}
  const i=_sIx.get(id);let x=i!=null?songs[i]:undefined;
  if(x&&x.id===id)return x;
  x=songs.find(y=>y.id===id);if(x)_sIx=null;/* array was re-sorted or edited in place: rebuild next time */
  return x;
}
const TABS=['albums','songs','playlists'];
let view={tab:'albums',folder:null,album:null,artist:null,rec:null,q:'',pf:null,pl:null};
let lastKey=null,lastDepth=0,lastTab=null,miniSig=null,miniFor=null,fullSig=null,fullFor=null;
const PAL=['#ff5a36','#ff9f1c','#f5d90a','#3fb950','#2dd4bf','#3b82f6','#8b5cf6','#ec4899','#9ca3af'];
const SORTS={
  added:['Recently added',(a,b)=>b.added-a.added],
  oldest:['Oldest first',(a,b)=>a.added-b.added],
  az:['Title A to Z',(a,b)=>cmp(a.name,b.name)],
  za:['Title Z to A',(a,b)=>cmp(b.name,a.name)],
  artist:['Artist A to Z',(a,b)=>cmp(a.artist||'\uffff',b.artist||'\uffff')||cmp(a.name,b.name)],
  album:['Album A to Z',(a,b)=>cmp((albumOf(a)||{name:'\uffff'}).name,(albumOf(b)||{name:'\uffff'}).name)||cmp(a.name,b.name)],
  long:['Longest first',(a,b)=>effDur(b)-effDur(a)],
  short:['Shortest first',(a,b)=>effDur(a)-effDur(b)]
};
let sortKey='added';try{const k=localStorage.getItem('tracks-sort');if(SORTS[k])sortKey=k}catch(e){}

/* player background settings */
const BGST=[['mix','Blobs + cover'],['blobs','Blobs'],['img','Cover'],['grad','Gradient'],['solid','Solid']];
const BGR=[['spd','Speed',0,250,'%'],['dim','Dim',0,70,'%'],['sat','Saturation',0,200,'%'],['hue','Hue shift',-180,180,'\u00b0'],['bo','Blob opacity',20,100,'%'],['bz','Blob size',50,200,'%'],['cb','Image blur',0,100,'px'],['bio','Image opacity',10,100,'%']];
const BGREL={mix:['spd','dim','sat','hue','bo','bz','cb','bio'],blobs:['spd','dim','sat','hue','bo','bz'],img:['dim','sat','hue','cb','bio'],grad:['spd','dim','sat','hue'],solid:['dim','sat','hue']};
const BGD={st:'mix',spd:100,dim:18,sat:100,hue:0,bo:90,bz:100,cb:46,bio:70,col:null};
const bgS=Object.assign({},BGD);
try{const j=JSON.parse(localStorage.getItem('tracks-bg')||'null');if(j&&typeof j==='object'){
  if(BGST.some(x=>x[0]===j.st))bgS.st=j.st;
  BGR.forEach(r=>{const v=j[r[0]];if(typeof v==='number'&&isFinite(v))bgS[r[0]]=Math.min(r[3],Math.max(r[2],v))});
  if(/^#[0-9a-f]{6}$/i.test(j.col||''))bgS.col=j.col}}catch(e){}
let bgImg=null,bgMed=null,bgCrop=null;try{bgImg=localStorage.getItem('tracks-bgimg')||null}catch(e){}
/* older versions kept one global look: it stays as the starting point for albums you have not customized */
const bgBase=Object.assign({},bgS,{st:'mix'}),bgBaseImg=bgImg;
function makeBgImage(file){return new Promise(res=>{
  const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const k=Math.min(1,1024/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.82))};
  im.onerror=()=>res(null);im.src=u})}
/* settings live on the album (or on the song itself when it has no album), so each album keeps its own look */
const bgTarget=s=>albumOf(s)||s;
const bgKeyOf=s=>(albumOf(s)?'a':'s')+bgTarget(s).id;
let bgKey=null,bgST=null;
function loadBg(s){
  const b=bgTarget(s).bg;
  Object.assign(bgS,bgBase);bgImg=bgBaseImg;bgMed=null;bgCrop=null;
  if(b&&typeof b==='object'){
    if(BGST.some(x=>x[0]===b.st))bgS.st=b.st;
    BGR.forEach(r=>{const v=b[r[0]];if(typeof v==='number'&&isFinite(v))bgS[r[0]]=Math.min(r[3],Math.max(r[2],v))});
    bgS.col=/^#[0-9a-f]{6}$/i.test(b.col||'')?b.col:null;
    bgImg=typeof b.img==='string'&&b.img?b.img:null;
    bgMed=bgImg&&b.mid&&typeof b.mid.id==='string'&&(b.mid.t==='gif'||b.mid.t==='video')?{id:b.mid.id,t:b.mid.t,p:Array.isArray(b.mid.p)&&b.mid.p.length===3&&b.mid.p.every(Number.isFinite)?b.mid.p:null}:null;
    bgCrop=cropOk(b.c)?{x:b.c.x,y:b.c.y,z:b.c.z,ia:b.c.ia}:null;
  }
  bgKey=bgKeyOf(s);applyBg();
}
function saveBg(){
  const s=songById(cur);if(!s)return;
  const t=bgTarget(s),st=albumOf(s)?'albums':'songs',b={};
  Object.keys(BGD).forEach(k=>{b[k]=bgS[k]});if(bgImg)b.img=bgImg;if(bgCrop)b.c=bgCrop;if(bgImg&&bgMed){b.mid={id:bgMed.id,t:bgMed.t};if(bgMed.p)b.mid.p=bgMed.p}
  clearTimeout(bgST);bgST=setTimeout(async()=>{const old=t.bg&&t.bg.mid?t.bg.mid.id:null;t.bg=b;await put(st,t);if(old&&(!b.mid||b.mid.id!==old))medGC([old])},350);
}
/* places the background picture / video with its crop for the frame it is shown in (re-runs when the window or screen shape changes) */
function bgPlace(){
  const f=$('#fbg'),bc=f.querySelector('.bcus'),bi=f.querySelector('.bimg'),vd=f.querySelector('.bvid');if(!bc||!vd||!bi)return;
  let tr='';const W=f.clientWidth*1.24,H=f.clientHeight*1.24;/* every layer is inset -12%, so its box is 124% of the frame (a hidden layer reports no size) */
  if(bgCrop&&W&&H)tr=cropTf(bgCrop,W,H);
  else if(bgImg&&bgMed&&Array.isArray(bgMed.p)&&bgMed.p.length===3)tr='translate('+bgMed.p[0]+'%,'+bgMed.p[1]+'%) scale('+bgMed.p[2]+')';
  bc.style.transform=bgImg?tr:'';bi.style.transform=bgImg?'':tr;vd.style.transform=tr;
  if(!f._ro&&window.ResizeObserver){f._ro=new ResizeObserver(()=>bgPlace());f._ro.observe(f)}
}
function applyBg(){
  const f=$('#fbg'),st=f.style,o=bgS;
  BGST.forEach(x=>f.classList.toggle('st-'+x[0],x[0]===o.st));
  st.setProperty('--spd',Math.max(o.spd,5)/100);
  st.setProperty('--aps',o.spd===0?'paused':'running');
  st.setProperty('--dim',o.dim/100);
  st.setProperty('--bo',o.bo/100);
  st.setProperty('--bz',o.bz/100);
  st.setProperty('--cb',o.cb+'px');
  st.setProperty('--bio',o.bio/100);
  {const bc=f.querySelector('.bcus'),vd=f.querySelector('.bvid'),m=bgImg&&bgMed?medSrc(bgMed):null,cs=!bgImg&&cur?songById(cur):null,cc=cs?songCover(cs):null,cm=cc&&cc.cover&&cc.cmedia&&animOn(true)?medSrc(cc.cmedia):null,
   gif=m&&m.t==='gif'&&animOn(true)?m.url:null,vid=(m&&m.t==='video'&&animOn(true)?m.url:null)||(cm&&cm.t==='video'?cm.url:null),poster=bgImg||(cc&&cc.cover)||'',want=gif||bgImg||null;
   if(bc._im!==want){bc._im=want;bc.style.backgroundImage=want?'url("'+want+'")':'none';bc.classList.toggle('on',!!want)}
   bgPlace();
   f.classList.toggle('hascus',!!bgImg);f.classList.toggle('hasvid',!!vid);bgPlace();
   if(vd._u!==vid||vd._p!==poster){vd._u=vid;vd._p=poster;if(vid){vd.dataset.v=vid;vd.poster=poster}else{delete vd.dataset.v;vd.removeAttribute('poster')}mvEval()}}
  st.filter=(o.sat!==100||o.hue!==0)?'saturate('+o.sat/100+') hue-rotate('+o.hue+'deg)':'';
}
function bgSheet(){
  const o=bgS,cs=songById(cur),al=cs&&albumOf(cs);
  openOv(`<h3>Player background</h3><p class="dupn" style="margin-bottom:6px">Saved for ${al?'the album \u201c'+esc(al.name)+'\u201d':'this song'} only. A custom image, GIF or video also plays behind the mini player.</p><div class="bgs"><label>Style</label><div class="bgst" id="bgst">${BGST.map(x=>`<button type="button" class="chip" data-s="${x[0]}">${x[1]}</button>`).join('')}</div>
  <div class="cvrow" id="bgimgrow"><div class="thumb" id="bgth"></div><div class="cvb"><span id="bgcap" style="font-size:12px;color:var(--mute)"></span><button type="button" class="pill" id="bgip"></button><button type="button" class="pill" id="bgcr">Crop and position</button><button type="button" class="pill" id="bgir">Use album cover</button></div></div>
  <div id="bgcw"><label>Color</label><div class="sw" id="bgc"><button type="button" class="swb auto" data-c="" aria-label="Automatic color">${ic('close',14)}</button>${PAL.map(c=>`<button type="button" class="swb" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<label class="swc" aria-label="Custom color"><input type="color" id="bgcc">${ic('palette',16)}</label></div></div>
  <div id="bgrows">${BGR.map(r=>`<div class="fop" data-k="${r[0]}"><span>${r[1]}</span><input type="range" class="rng" data-k="${r[0]}" min="${r[2]}" max="${r[3]}" aria-label="${r[1]}"><b></b><button type="button" class="rsb" data-r="${r[0]}" aria-label="Reset ${r[1]} to default" title="Reset to default">${ic('rst',16)}</button></div>`).join('')}</div></div>
  <div class="bt"><button class="pill mr" id="bgx">Reset</button><button class="pill acc" id="bgd">Done</button></div>`);
  const paint=()=>{
    document.querySelectorAll('#bgst .chip').forEach(c=>c.classList.toggle('on',c.dataset.s===o.st));
    document.querySelectorAll('#bgc .swb').forEach(b=>b.classList.toggle('on',(b.dataset.c||'').toLowerCase()===(o.col||'').toLowerCase()));
    $('#bgc .swc').classList.toggle('on',!!o.col&&!PAL.some(c=>c.toLowerCase()===o.col.toLowerCase()));
    $('#bgcc').value=o.col||'#ff5a36';
    const hc=!!(cs&&songCover(cs).cover);$('#bgcw').style.display=(o.st==='img'&&(bgImg||hc))?'none':'';
    $('#bgimgrow').style.display=(o.st==='img'||o.st==='mix')?'flex':'none';
    $('#bgth').innerHTML=bgImg?cover({cover:bgImg,name:'?'}):cs?cover(songCover(cs),cs.name):'<div class="cov" style="background:var(--surf2);color:var(--mute)">+</div>';
    $('#bgcap').textContent=bgImg?(bgMed?'Using your own '+(bgMed.t==='video'?'video':'GIF'):'Using your own image'):hc?'Using the album cover (default)':'No cover yet, showing blobs';
    $('#bgip').textContent=bgImg?'Change media':'Import image, GIF or video';$('#bgir').style.display=bgImg?'':'none';$('#bgcr').style.display=(bgImg||hc)?'':'none';
    BGR.forEach(r=>{
      const el=document.querySelector('#bgrows .fop[data-k="'+r[0]+'"]'),inp=el.querySelector('input'),v=o[r[0]];
      inp.value=v;inp.style.setProperty('--p',((v-r[2])/(r[3]-r[2])*100)+'%');
      el.querySelector('b').textContent=(r[0]==='spd'&&v===0)?'Off':v+r[4];el.classList.toggle('dflt',v===BGD[r[0]]);
      el.style.display=BGREL[o.st].includes(r[0])?'':'none';
    });
  };
  const ch=()=>{applyBg();const sg=songById(cur);if(sg){updateBg(sg);miniBg(sg)}saveBg();paint()};
  paint();
  $('#bgst').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;o.st=c.dataset.s;ch()};
  $('#bgip').onclick=()=>$('#bi').click();
  $('#bgir').onclick=()=>{bgImg=null;bgMed=null;bgCrop=null;ch()};
  $('#bgcr').onclick=async()=>{
    let blob,kind='img';
    if(bgImg){
      if(bgMed){const m=MED.get(bgMed.id);if(!m)return toast('That file is not on this device');blob=m.blob;kind=m.t==='video'?'video':'gif'}
      else{const u=bgImg.split(','),bin=atob(u[1]||''),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);blob=new Blob([arr],{type:'image/jpeg'})}
    }else{
      const c=cs&&songCover(cs);if(!c||!c.cover)return;const m=c.cmedia&&MED.get(c.cmedia.id);
      if(m){blob=m.blob;kind=m.t==='video'?'video':'gif'}else{try{blob=await(await fetch(c.cover)).blob()}catch(e){return toast('Could not open the cover')}}
    }
    const cr=await cropSheet(blob,kind,scrAr(),bgCrop||(bgImg&&bgMed&&bgMed.p)||null,false,[.5625,1,1.7778]);if(!cr)return;
    bgCrop=cropPack(cr);if(bgMed)bgMed.p=null;ch()};
  $('#bi').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=await makeBgMedia(f);if(!r)return cvFail('Could not read that file');bgImg=r.data;bgCrop=r.c||null;bgMed=r.media?await medSave(r.media):null;if(o.st!=='mix')o.st='img';ch()};
  $('#bgc').onclick=e=>{const b=e.target.closest('.swb');if(!b)return;o.col=b.dataset.c||null;ch()};
  $('#bgcc').oninput=e=>{o.col=e.target.value;ch()};
  $('#bgrows').oninput=e=>{const k=e.target.dataset.k;if(!k)return;o[k]=+e.target.value;ch()};
  $('#bgrows').onclick=e=>{const b=e.target.closest('.rsb');if(!b)return;o[b.dataset.r]=BGD[b.dataset.r];ch()};
  $('#bgx').onclick=()=>{clearTimeout(bgST);const s=cur&&songById(cur);if(s){const tg=bgTarget(s),old=tg.bg&&tg.bg.mid?tg.bg.mid.id:null;delete tg.bg;put(albumOf(s)?'albums':'songs',tg);loadBg(s);updateBg(s);miniBg(s);if(old)medGC([old])}paint()};
  $('#bgd').onclick=()=>closeOv();
  $('#ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
}


/* cover transition (big player) */
const TRS=[['slide','Slide'],['fade','Fade'],['zoom','Zoom'],['flip','Flip'],['cube','Cube'],['spin','Spin'],['stack','Stack'],['drop','Drop'],['blur','Blur'],['none','Off']];
const TRE={smooth:['Smooth','cubic-bezier(.22,.8,.24,1)'],snappy:['Snappy','cubic-bezier(.16,1,.3,1)'],soft:['Soft','cubic-bezier(.45,0,.25,1)'],bounce:['Bounce','cubic-bezier(.34,1.56,.64,1)'],linear:['Linear','linear']};
const TRR=[['dur','Duration',150,1500,'ms'],['dist','Distance',10,150,'%'],['rot','Rotation',0,360,'\u00b0'],['sc','Scale',40,150,'%'],['bl','Blur',0,40,'px'],['ov','Overlap',0,100,'%']];
const TRREL={slide:['dur','dist','sc','bl','ov'],fade:['dur','bl','ov'],zoom:['dur','sc','bl','ov'],flip:['dur','rot','bl','ov'],cube:['dur','bl','ov'],spin:['dur','rot','sc','bl','ov'],stack:['dur','dist','rot','sc','bl','ov'],drop:['dur','dist','sc','bl','ov'],blur:['dur','bl','ov'],none:[]};
const TRP={slide:{dist:100,sc:85,bl:0,ov:100},fade:{bl:0,ov:100},zoom:{sc:70,bl:0,ov:60},flip:{rot:90,bl:0,ov:0},cube:{bl:0,ov:100},spin:{rot:180,sc:60,bl:0,ov:100},stack:{dist:110,rot:90,sc:88,bl:0,ov:100},drop:{dist:80,sc:90,bl:0,ov:100},blur:{bl:16,ov:100}};
const TRD={st:'slide',ea:'smooth',dir:'auto',txt:1,dur:520,dist:100,rot:90,sc:85,bl:0,ov:100};
const trS=Object.assign({},TRD);let trDir=0;const trDef=k=>{const p=TRP[trS.st];return(p&&p[k]!=null)?p[k]:TRD[k]};
try{const j=JSON.parse(localStorage.getItem('tracks-tr')||'null');if(j&&typeof j==='object'){
  if(TRS.some(x=>x[0]===j.st))trS.st=j.st;
  if(TRE[j.ea])trS.ea=j.ea;
  if(j.dir==='auto'||j.dir==='fwd'||j.dir==='rev')trS.dir=j.dir;
  if(j.txt===0||j.txt===1)trS.txt=j.txt;
  TRR.forEach(r=>{const v=j[r[0]];if(typeof v==='number'&&isFinite(v))trS[r[0]]=Math.min(r[3],Math.max(r[2],v))})}}catch(e){}
/* plays the old cover out and the new one in; works on any two stacked elements, so the settings preview uses it too */
function trRun(oldEl,newEl,dir,o){
  if(RM.matches||o.st==='none'||!oldEl||!newEl||!newEl.animate)return Promise.resolve();
  const n=dir<0?-1:1,sc=o.sc/100,z=1+(1-sc)*1.2,tl=o.rot/4,d=o.dist,r=o.rot,bl=PERF.f.trans?0:o.bl,S=PERF.f.trans&&o.st==='blur'?'fade':o.st,W=newEl.offsetWidth||300;
  const B=v=>v?'blur('+v+'px)':'none',F=(t,op,b)=>({transform:t,opacity:op,filter:B(b||0)});
  let a,b;
  if(S==='fade'){a=[F('none',1),F('none',0,bl)];b=[F('none',0,bl),F('none',1)]}
  else if(S==='slide'){a=[F('none',1),F('translateX('+(-n*d)+'%) scale('+sc+')',0,bl)];b=[F('translateX('+(n*d)+'%) scale('+sc+')',0,bl),F('none',1)]}
  else if(S==='zoom'){a=[F('none',1),F('scale('+(n>0?z:1/z)+')',0,bl)];b=[F('scale('+(n>0?1/z:z)+')',0,bl),F('none',1)]}
  else if(S==='flip'){const P='perspective(900px) ';a=[F(P+'rotateY(0deg)',1),F(P+'rotateY('+(-n*r)+'deg)',0,bl)];b=[F(P+'rotateY('+(n*r)+'deg)',0,bl),F(P+'rotateY(0deg)',1)]}
  else if(S==='cube'){const P=g=>'perspective(1100px) translateZ('+(-W/2)+'px) rotateY('+g+'deg) translateZ('+(W/2)+'px)';a=[F(P(0),1),F(P(-n*90),1,bl)];b=[F(P(n*90),1,bl),F(P(0),1)]}
  else if(S==='spin'){a=[F('none',1),F('rotate('+(n*r)+'deg) scale('+sc+')',0,bl)];b=[F('rotate('+(-n*r)+'deg) scale('+sc+')',0,bl),F('none',1)]}
  else if(S==='stack'){a=[F('none',1),F('translateX('+(-n*d)+'%) rotate('+(-n*tl)+'deg)',0,bl)];b=[F('scale('+sc+')',1,bl),F('none',1)]}
  else if(S==='drop'){a=[F('none',1),F('translateY('+(-n*d)+'%) scale('+sc+')',0,bl)];b=[F('translateY('+(n*d)+'%) scale('+sc+')',0,bl),F('none',1)]}
  else if(S==='blur'){a=[F('none',1),F('scale(1.04)',0,bl||16)];b=[F('scale(.96)',0,bl||16),F('none',1)]}
  else return Promise.resolve();
  const T=PERF.f.trans?Math.min(o.dur,320):o.dur,ov=o.ov/100,dd=T/(2-ov),dl=T-dd,ease=(TRE[o.ea]||TRE.smooth)[1],st=S==='stack';
  oldEl.style.zIndex=st?2:1;newEl.style.zIndex=st?1:2;
  if(S==='flip'||S==='cube')oldEl.style.backfaceVisibility=newEl.style.backfaceVisibility='hidden';
  const A1=oldEl.animate(a,{duration:dd,easing:ease,fill:'forwards'}),A2=newEl.animate(b,{duration:dd,delay:dl,easing:ease,fill:'backwards'});
  return Promise.all([A1.finished,A2.finished]).catch(()=>{}).then(()=>{[oldEl,newEl].forEach(e=>{e.style.backfaceVisibility='';e.style.zIndex=''})});
}
/* called by the big player when the song changes: ghost is a copy of the previous cover */
function coverChange(ghost,hint){
  const o=trS,n=o.dir==='fwd'?1:o.dir==='rev'?-1:(hint||1),nc=$('#fc .cov'),host=$('#fc .fcv');
  if(RM.matches)return;
  if(ghost&&nc&&host&&o.st!=='none'){
    Object.assign(ghost.style,{position:'absolute',left:nc.offsetLeft+'px',top:nc.offsetTop+'px',margin:'0',pointerEvents:'none'});
    host.appendChild(ghost);
    trRun(ghost,nc,n,o).then(()=>ghost.remove());
  }
  if(o.txt)['h2','p'].forEach((t,i)=>{const e=$('#fc .fti '+t);if(e&&!RM.matches)e.animate([{opacity:0,transform:'translateX('+(n*22)+'px)'},{opacity:1,transform:'none'}],{duration:Math.round(Math.max(200,o.dur*.75)),delay:Math.round(o.dur*.12)+i*50,easing:EASE_OUT,fill:'backwards'})});
}
function trSheet(){
  const o=trS,cs=songById(cur),art=cs?cover(songCover(cs),cs.name):'<div class="cov"></div>';
  const chips=(id,list)=>`<div class="bgst" id="${id}">${list.map(x=>`<button type="button" class="chip" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`;
  openOv(`<h3>Cover transition</h3><p class="dupn" style="margin-bottom:6px">Plays on the big player cover when the song changes. Applies to every song.</p><div class="bgs">
  <div class="trpv"><div class="trl" id="tra"><div class="trin">${art}</div></div><div class="trl" id="trb" style="visibility:hidden"><div class="trin tralt">${art}</div></div></div>
  <label>Style</label>${chips('trst',TRS)}
  <div id="trmore"><label>Easing</label>${chips('tre',Object.keys(TRE).map(k=>[k,TRE[k][0]]))}<label>Direction</label>${chips('trd',[['auto','Follows skip'],['fwd','Always forward'],['rev','Always back']])}</div>
  <label>Title and artist</label>${chips('trt',[['1','Animate'],['0','Still']])}
  <div id="trrows">${TRR.map(r=>`<div class="fop tr" data-k="${r[0]}"><span>${r[1]}</span><input type="range" class="rng" data-k="${r[0]}" min="${r[2]}" max="${r[3]}" aria-label="${r[1]}"><b></b><button type="button" class="rsb" data-r="${r[0]}" aria-label="Reset ${r[1]} to default" title="Reset to default">${ic('rst',16)}</button></div>`).join('')}</div></div>
  <div class="bt"><button class="pill mr" id="trx">Reset</button><button class="pill" id="trp">Preview</button><button class="pill acc" id="trdn">Done</button></div>`);
  const L={a:$('#tra'),b:$('#trb')};let shown='a',alt=false,tk=0,pt=null;
  const keep=()=>{try{localStorage.setItem('tracks-tr',JSON.stringify(o))}catch(e){}};
  const paint=()=>{
    const on=(id,v)=>document.querySelectorAll('#'+id+' .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===String(v)));
    on('trst',o.st);on('tre',o.ea);on('trd',o.dir);on('trt',o.txt);
    $('#trmore').style.display=o.st==='none'?'none':'';
    TRR.forEach(r=>{
      const el=document.querySelector('#trrows .fop[data-k="'+r[0]+'"]'),inp=el.querySelector('input'),v=o[r[0]];
      inp.value=v;inp.style.setProperty('--p',((v-r[2])/(r[3]-r[2])*100)+'%');
      el.querySelector('b').textContent=v+r[4];el.classList.toggle('dflt',v===trDef(r[0]));el.style.display=TRREL[o.st].includes(r[0])?'':'none';
    });
  };
  const run=async()=>{
    if(!L.a.isConnected||o.st==='none'||RM.matches)return;
    const k=++tk,x=L[shown],y=L[shown==='a'?'b':'a'];
    [x,y].forEach(l=>{l.getAnimations().forEach(g=>g.cancel());l.style.visibility='hidden'});
    x.style.visibility='visible';y.style.visibility='visible';
    await trRun(x,y,o.dir==='rev'?-1:o.dir==='fwd'?1:(alt?-1:1),o);
    if(k!==tk||!L.a.isConnected)return;
    x.getAnimations().forEach(g=>g.cancel());x.style.visibility='hidden';shown=shown==='a'?'b':'a';alt=!alt;
  };
  const ch=()=>{keep();paint();clearTimeout(pt);pt=setTimeout(run,260)};
  const pick=(id,fn)=>{$('#'+id).onclick=e=>{const c=e.target.closest('.chip');if(!c)return;fn(c.dataset.v);ch()}};
  pick('trst',v=>{o.st=v;Object.assign(o,TRP[v]||{})});
  pick('tre',v=>{o.ea=v});
  pick('trd',v=>{o.dir=v});
  pick('trt',v=>{o.txt=+v});
  $('#trrows').oninput=e=>{const k=e.target.dataset.k;if(!k)return;o[k]=+e.target.value;ch()};
  $('#trrows').onclick=e=>{const b=e.target.closest('.rsb');if(!b)return;o[b.dataset.r]=trDef(b.dataset.r);ch()};
  $('#trx').onclick=()=>{Object.assign(o,TRD);ch()};
  $('#trp').onclick=run;
  $('#trdn').onclick=()=>closeOv();
  $('#ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
  paint();pt=setTimeout(run,450);
}

