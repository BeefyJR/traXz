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

