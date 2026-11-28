

/* ===== BEGIN 12-placement.js ===== */
/* ===== free placement v2: drag, resize, rotate, hide and layer icons, tabs and player controls anywhere (main screen, mini player, side player, full player).
   Guides snap to edges and centres (Alt = no snap). Undo / redo, arrow-key nudging, an item list and a collapsible panel make it easy to use.
   Safe by design: saved data is validated on load, keys of the full player are stable, essential buttons can never be hidden or lost off screen,
   and nothing runs while no placement exists. Escape hatch: open the app with ?fp=reset to clear every placement. ===== */
ICON.undo='M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z';
ICON.redo='M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z';
const FPAN=['dock','np','npb','mini','top','main'];   /* panels an item can stay attached to */
const FP={on:false,p:{},b:{},sn:true};
const FP_LIM={x:[-4000,4000],y:[-4000,4000],s:[20,400],r:[-360,360],w:[20,100],h:[20,100],z:[-10,30]};
/* anything read from storage, a preset or an undo step goes through here: wrong types, NaN and absurd values are dropped or clamped */
function fpSanitize(j){
  const o={on:false,p:{},b:{},sn:true};
  if(!j||typeof j!=='object')return o;
  o.on=!!j.on;o.sn=j.sn!==false;
  if(+j.rw>=200&&+j.rw<=8000)o.rw=Math.round(+j.rw);if(+j.rh>=200&&+j.rh<=8000)o.rh=Math.round(+j.rh);   /* window size the layout was made at */
  if(j.p&&typeof j.p==='object'){
    for(const k of Object.keys(j.p).slice(0,500)){
      const q=j.p[k];if(!q||typeof q!=='object'||k.length>120)continue;
      const c={};
      for(const f of ['x','y','s','r','w','h','z']){if(q[f]===undefined||q[f]===null)continue;const v=+q[f];if(isFinite(v))c[f]=Math.round(Math.max(FP_LIM[f][0],Math.min(FP_LIM[f][1],v)))}
      if(q.ng)c.ng=true;if(q.hd)c.hd=true;
      if(q.a&&typeof q.a==='object'&&FPAN.includes(q.a.i)){const a={i:q.a.i};let ok=true;for(const f of ['l','r','t','b','w','h']){const v=+q.a[f];if(!isFinite(v)||v<-9999||v>9999)ok=false;a[f]=Math.round(v)}if(ok&&a.w>0&&a.h>0)c.a=a}
      o.p[k]=c;
    }
  }
  if(j.b&&typeof j.b==='object'){
    const B=j.b,n=(v,a,b)=>{v=+v;return isFinite(v)&&v?Math.round(Math.max(a,Math.min(b,v))):null};
    const tw=n(B.tw,30,100),th=n(B.th,40,400),dw=n(B.dw,54,200),dh=n(B.dh,50,150);
    if(tw!==null)o.b.tw=tw;if(th!==null)o.b.th=th;if(dw!==null)o.b.dw=dw;if(dh!==null)o.b.dh=dh;
    if(B.ta==='r'||B.ta==='l')o.b.ta=B.ta;
    const vw=n(B.vw,40,900),vh=n(B.vh,40,2400);if(vw!==null)o.b.vw=vw;if(vh!==null)o.b.vh=vh;
    const tvw=n(B.tvw,60,4000),tvh=n(B.tvh,30,1200);if(tvw!==null)o.b.tvw=tvw;if(tvh!==null)o.b.tvh=tvh;/* top bar free size in px *//* navigation bar free size in px */
    if(B.tf===0||B.tf===false)o.b.tf=0;if(B.df===0||B.df===false)o.b.df=0;/* 0 = icons stay put when the bar is moved */
  }
  return o;
}
if(/[?&]fp=reset\b/.test(location.search)){LS('tracks-fp',null);LS('tracks-fpbar',null)}
try{Object.assign(FP,fpSanitize(JSON.parse(LS('tracks-fp')||'null')))}catch(e){}
FP.on=false;FP.p={};FP.b={};try{LS('tracks-fp',null)}catch(e){}/* the layout is fixed: stored free placement is discarded */
/* saving is debounced (sliders fire many events) and always flushed when the page is hidden or closed */
let fpSv=0;
const fpSaveNow=()=>{if(fpSv){clearTimeout(fpSv);fpSv=0}if(fpOn()){FP.rw=innerWidth;FP.rh=innerHeight;fpAnchor()}LS('tracks-fp',JSON.stringify(FP))};
const fpSave=()=>{if(fpOn()){fpCounter();fpHQ()}/* resize handles follow the bars after every change */if(!fpSv)fpSv=setTimeout(fpSaveNow,180)};
addEventListener('pagehide',()=>{if(fpSv)fpSaveNow()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&fpSv)fpSaveNow()});

const FPS={hdr:'#plus,#cb,#qk,#gear,#top .tab,#dock .tab,#tb>*,#fb .ab,#fb .back,#fb .fsz2,#fb .fsz2 button,#mini,#main,#np,#npb,#top,#dock,#logo',mini:'#mini :is(.m1,.m2)>:is(.ib,.mcv,.t),#mini .m2,#mini .m3,#mini .mvs,#mini #mvl',np:'#npb :is(.npa,.nctl,.nr)>.ib,#npb .nc,#npb .nt,#npb .nctl,#npb .nsk,#npb .nvg,#npb #nbvl',pan:'#np .nph,#np #npc,#np .npi,#np .npn,#np .npl,#np .npi>.ib',
  full:'#fc .ftop,#fc .ftop>.ib,#fc .tbm,#fc .fcv,#fc .fti,#fc .fsk,#fc .ctl,#fc .ctl>.ib,#fc .fbot,#fc .fg,#fc .fg>.ib,#fc .fvol,#fc .fr,#fc .fr>.ib'};
const FPG={hdr:'Screen and bars',mini:'Mini player',np:'Player bar',pan:'Side panel',full:'Full player'};
const fpBox=s=>s==='hdr'?$('#app'):$(s==='mini'?'#mini':s==='pan'?'#np':s==='full'?'#fc':'#npb');
const fpOn=()=>document.documentElement.classList.contains('fpe');
let FPM='main';/* what the editor is working on: the main screen or the full player */
const fpFull=()=>FPM==='full';
/* buttons that must always stay reachable: they cannot be hidden, and if they end up off screen their placement is reset */
const FPK_ESS='#gear,#fp,[data-act=toggle],[data-act=closefull]';
const fpKeep=el=>/^(main|top|dock|np|npb|mini|logo)$/.test(el.id)||el.matches(FPK_ESS)||!!el.querySelector(FPK_ESS);
/* keys of the older scopes are kept exactly as they were so saved layouts still match; the full player gets clean ones */
function fpKey(s,el){
  if(s==='full')return 'full:'+(el.id||(el.dataset.act?el.dataset.act+(el.dataset.s||''):'')||el.className.split(' ')[0]||'item');
  return s+':'+(el.id||el.dataset.act+(el.dataset.s||'')||el.dataset.npa||el.className.split(' ')[0]);
}
function fpItems(){const o=[];for(const s in FPS){const seen={};document.querySelectorAll(FPS[s]).forEach(el=>{let k=fpKey(s,el),n=seen[k]=(seen[k]||0)+1;if(n>1)k+='#'+n;el.dataset.fpk=k;el.dataset.fps=s;o.push(el)})}return o}
let FPSEL=null;
const FPD={x:0,y:0,s:100,r:0,w:100,h:100};/* slider defaults: what each reset button returns to */
/* how far the selected item may move so it stays inside its panel; measured fresh, so it follows size and rotation */
function fpRange(el,p){
  const bx=fpBox(el.dataset.fps),rr=el.getBoundingClientRect(),cx=p.x||0,cy=p.y||0;let a=[-400,400,-400,400];
  if(bx){const q=bx.getBoundingClientRect();if(q.width)a=[q.left-(rr.left-cx),q.right-(rr.right-cx),q.top-(rr.top-cy),q.bottom-(rr.bottom-cy)].map(Math.round)}
  let mnx=Math.min(a[0],cx),mxx=Math.max(a[1],cx),mny=Math.min(a[2],cy),mxy=Math.max(a[3],cy);
  if(mxx-mnx<80){mnx=Math.min(mnx,cx-40);mxx=Math.max(mxx,cx+40)}/* a bar that fills its panel still gets a usable slider */
  if(mxy-mny<80){mny=Math.min(mny,cy-40);mxy=Math.max(mxy,cy+40)}
  return {x:[mnx,mxx],y:[mny,mxy]};
}
/* refresh every slider in the editor from the stored values (ranges, thumbs, labels, reset buttons) */
function fpSync(skip){
  const el=FPSEL,b=$('#fpbar');if(!el||!b)return;
  const p=FP.p[el.dataset.fpk]||{},R=fpRange(el,p);
  b.querySelectorAll('[data-fpf]').forEach(i=>{
    const f=i.dataset.fpf;if(f===skip)return;
    if(R[f]){i.min=R[f][0];i.max=R[f][1]}
    const v=p[f]||FPD[f],mn=+i.min,mx=+i.max;i.value=v;
    i.style.setProperty('--p',((v-mn)/(mx-mn)*100)+'%');
    const lb=i.parentNode.querySelector('b');if(lb)lb.textContent=v+(i.dataset.u||'%');
    i.parentNode.classList.toggle('dflt',v===FPD[f]);
  });
}
/* drop an item's saved entry once nothing differs from the default */
function fpClean(k){const p=FP.p[k];if(p&&!p.x&&!p.y&&!p.r&&(!p.s||p.s===100)&&(!p.w||p.w===100)&&(!p.h||p.h===100)&&!p.z&&!p.ng&&!p.hd)delete FP.p[k]}
const fpMk=k=>FP.p[k]=Object.assign({x:0,y:0},FP.p[k]);/* the entry of an item, created when needed */

/* ---- undo / redo: a step is the whole placement before a change; only real changes are recorded ---- */
const fpH={u:[],r:[]};
const fpSnap=()=>JSON.stringify({p:FP.p,b:FP.b,sn:FP.sn});
function fpBtn(){const b=$('#fpbar');if(!b)return;const u=b.querySelector('[data-fp=undo]'),r=b.querySelector('[data-fp=redo]');if(u)u.disabled=!fpH.u.length;if(r)r.disabled=!fpH.r.length}
function fpCommit(pre){if(pre==null)return;if(pre===fpSnap())return;fpH.u.push(pre);if(fpH.u.length>60)fpH.u.shift();fpH.r=[];fpBtn()}
function fpRestore(s){
  let j=null;try{j=JSON.parse(s)}catch(e){return}
  Object.assign(FP,fpSanitize(Object.assign({},j,{on:true})));
  try{dockSync()}catch(_){}
  fpApply(true);fpSave();fpHandles();
  if(FPSEL&&FPSEL.isConnected)fpSel(FPSEL);else fpSel(null);
  fpRot();
}
function fpUndo(redo){
  const from=redo?fpH.r:fpH.u,to=redo?fpH.u:fpH.r;if(!from.length)return;
  to.push(fpSnap());fpRestore(from.pop());fpBtn();
}

/* Placement is stored in pixels, made at one window size. In a smaller window every placed item keeps its place relative to the window: the spot it had
   (natural place + offset) is scaled with the window, so something put in a bottom corner stays in that corner. Free bar widths shrink by the amount the window shrank
   (side panels and bars keep their own size). Nothing grows. The saved layout is never changed outside the editor; while arranging, everything is rebased to the current window. */
function fpRef(){
  let rw=FP.rw,rh=FP.rh;
  if(!rw){rw=Math.max(innerWidth,(FP.b&&FP.b.tvw)||0)}   /* older layouts did not record it: the free top bar width is the best hint */
  if(!rh)rh=innerHeight;
  return {rw:Math.max(rw,innerWidth),rh:Math.max(rh,innerHeight)};
}
function fpK(){
  if(fpOn()||!FP.on)return {x:1,y:1};
  const r=fpRef();
  return {x:innerWidth/r.rw,y:innerHeight/r.rh};
}
let FPE={sig:'',m:{}};
const fpPanels=()=>FPAN.map(id=>{const e=document.getElementById(id),r=e&&e.getBoundingClientRect();return r&&r.width>20&&r.height>20?{id,el:e,r}:null}).filter(Boolean);
const fpMoved=id=>{const q=FP.p['hdr:'+id];return !!(q&&(q.x||q.y))};
/* remember, for every moved item, which panel it was put on and how far from that panel's edges, so it follows that panel when the window changes */
function fpAnchor(){
  const ps=fpPanels();if(!ps.length)return;
  document.querySelectorAll('[data-fpk]').forEach(el=>{
    const q=FP.p[el.dataset.fpk];if(!q||!(q.x||q.y))return;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
    const cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;let best=null;
    for(const pn of ps){
      if(pn.el===el||el.contains(pn.el)||fpMoved(pn.id))continue;
      if(cx<pn.r.left||cx>pn.r.right||cy<pn.r.top||cy>pn.r.bottom)continue;
      const a=pn.r.width*pn.r.height;if(!best||a<best.a)best={pn,a};
    }
    if(!best){delete q.a;return}
    const R=best.pn.r;
    q.a={i:best.pn.id,l:Math.round(cx-R.left),r:Math.round(R.right-cx),t:Math.round(cy-R.top),b:Math.round(R.bottom-cy),w:Math.round(R.width),h:Math.round(R.height)};
  });
}
const fpHasAnchor=()=>Object.values(FP.p).some(q=>q.a&&(q.x||q.y));
/* where the layout puts each moved item in this window: [x,y] offsets, measured from its natural (unmoved) place */
function fpAbsCalc(){
  const W=innerWidth,H=innerHeight,r=fpRef(),out={};
  const items=fpItems().filter(el=>{const q=FP.p[el.dataset.fpk];return q&&(q.x||q.y)});
  if(!items.length)return out;
  const keep=items.map(el=>el.style.translate);
  items.forEach(el=>{el.style.translate=''});
  const nat=items.map(el=>{const q=el.getBoundingClientRect();return q.width&&q.height?[(q.left+q.right)/2,(q.top+q.bottom)/2]:null});
  items.forEach((el,i)=>{el.style.translate=keep[i]});
  const ps=fpPanels();
  items.forEach((el,i)=>{
    const n=nat[i];if(!n)return;
    const q=FP.p[el.dataset.fpk];
    const pn=q.a&&!fpMoved(q.a.i)&&ps.find(x=>x.id===q.a.i&&x.el!==el&&!el.contains(x.el));
    if(pn){   /* same spot on the same panel: the distance to the nearest edge is kept, in a wide panel the spot scales with it */
      const a=q.a,R=pn.r,pos=(d1,d2,f,lo,len)=>d1<=d2&&d1<=160?lo+d1:d2<d1&&d2<=160?lo+len-d2:lo+f*len;
      const dx=Math.max(8,Math.min(W-8,pos(a.l,a.r,a.l/a.w,R.left,R.width))),dy=Math.max(8,Math.min(H-8,pos(a.t,a.b,a.t/a.h,R.top,R.height)));
      out[el.dataset.fpk]=[Math.round(dx-n[0]),Math.round(dy-n[1])];return;
    }
    const gx=Math.max(0,Math.min(1,n[0]/W)),gy=Math.max(0,Math.min(1,n[1]/H));
    /* items anchored to the right or bottom of the window were further right / down in the bigger window */
    const ox=n[0]+(r.rw-W)*gx+(q.x||0),oy=n[1]+(r.rh-H)*gy+(q.y||0);
    out[el.dataset.fpk]=[Math.round(ox*W/r.rw-n[0]),Math.round(oy*H/r.rh-n[1])];
  });
  return out;
}
function fpAbsSync(){
  const k=fpK();
  if(k.x>=1&&k.y>=1&&!fpHasAnchor()){FPE.sig='';FPE.m={};return}
  const r=fpRef(),sig=innerWidth+'x'+innerHeight+'|'+r.rw+'x'+r.rh+'|'+fpPanels().map(x=>x.id+Math.round(x.r.left)+','+Math.round(x.r.top)+','+Math.round(x.r.width)+','+Math.round(x.r.height)).join(';')+'|'+JSON.stringify(FP.p);
  if(sig!==FPE.sig){FPE.m=fpAbsCalc();FPE.sig=sig}
}
const fpOff=(key,p)=>{const e=!fpOn()&&FPE.m[key];if(e)return e;const k=fpK();return [Math.round((p&&p.x||0)*k.x),Math.round((p&&p.y||0)*k.y)]};
function fpBw(B,r){   /* free bar sizes for this window */
  const o=Object.assign({},B),dW=r.rw-innerWidth,dH=r.rh-innerHeight,d=getDock();
  if(o.tvw)o.tvw=Math.max(60,Math.min(innerWidth-8,o.tvw-dW));
  if(o.vw&&(d==='top'||d==='bottom'))o.vw=Math.max(40,Math.min(innerWidth-8,o.vw-dW));
  if(o.vh&&(d==='left'||d==='right'))o.vh=Math.max(40,Math.min(innerHeight-8,o.vh-dH));
  return o;
}
function fpBs(){
  const B=FP.on&&FP.b||{};if(fpOn())return B;
  const r=fpRef();if(r.rw===innerWidth&&r.rh===innerHeight)return B;
  return fpBw(B,r);
}
/* arranging in a window of another size than the layout was made in: bring every offset and bar size to this window first */
function fpRebase(){
  const r=fpRef();
  if(r.rw>innerWidth||r.rh>innerHeight||fpHasAnchor()){
    const m=fpAbsCalc(),k={x:innerWidth/r.rw,y:innerHeight/r.rh};
    for(const key in FP.p){const q=FP.p[key],e=m[key];
      if(e){q.x=e[0];q.y=e[1]}else{if(q.x)q.x=Math.round(q.x*k.x);if(q.y)q.y=Math.round(q.y*k.y)}}
    if(FP.b)FP.b=Object.assign(FP.b,fpBw(FP.b,r));
  }
  FP.rw=innerWidth;FP.rh=innerHeight;
}
function fpOne(el,p){
  const o=p?fpOff(el.dataset.fpk,p):null,t=p?o[0]+'px '+o[1]+'px':'',sc=p&&p.s&&p.s!==100&&el.id!=='main'?String(p.s/100):'';
  if(el.style.translate!==t)el.style.translate=t;if(el.style.scale!==sc)el.style.scale=sc;const rt=p&&p.r&&el.id!=='main'?p.r+'deg':'';if(el.style.rotate!==rt)el.style.rotate=rt;
  if(p&&p.z){el.style.zIndex=String(p.z);if(!el.dataset.fpz&&getComputedStyle(el).position==='static'){el.style.position='relative';el.dataset.fpz='1'}}
  else if(el.style.zIndex){el.style.zIndex='';if(el.dataset.fpz){el.style.position='';delete el.dataset.fpz}}
  el.classList.toggle('fphd',!!(p&&p.hd&&!fpKeep(el)));/* hidden items stay faintly visible while editing so they can be brought back */
  if(el.id==='main'){const w=p&&p.w&&p.w<100,h=p&&p.h&&p.h<100;el.style.width=w?p.w+'%':'';el.style.height=h?p.h+'%':'';el.style.flex=h?'none':'';el.style.alignSelf=w?'center':''}
}
function fpDock(){const R=document.documentElement,d=getDock(),B=fpBs();if((d==='left'||d==='right')&&B.dw)R.style.setProperty('--dw',B.dw+'px');else if(d==='bottom'&&B.dh)R.style.setProperty('--dbh',B.dh+'px')}
function fpBars(){const hd=document.querySelector('#top header'),B=fpBs();if(hd&&!B.tvw){const w=B.tw&&B.tw<100?B.tw+'%':'',l=w?(B.ta==='r'?'auto':'0'):'',r=w?(B.ta==='r'?'0':'auto'):'',h=B.th?B.th+'px':'';hd.style.zoom='';if(hd.style.width!==w)hd.style.width=w;if(hd.style.height!==h){hd.style.height=h;hd.style.boxSizing=h?'border-box':'';hd.style.minHeight=h?'0':''}hd.style.marginLeft=l;hd.style.marginRight=r}fpDock();fpDockSize();fpTopSize();fpCounter()}
/* The top bar is sized freely too (tvw / tvh): everything inside keeps its natural width, and the queue button keeps its distance from the bar's right edge */
function fpTopSize(){
  const tp=$('#top'),B=fpBs(),R=document.documentElement;if(!tp)return;
  const kids=[...tp.children].filter(c=>c.id!=='qk');
  const clr=()=>{kids.forEach(c=>{if(c.dataset.fpvw){c.style.width='';c.style.flex='';c.style.boxSizing='';delete c.dataset.fpvw}})};
  if(!B.tvw&&!B.tvh){if(tp.dataset.fpvs){tp.style.width='';tp.style.height='';tp.style.boxSizing='';clr();delete tp.dataset.fpvs}R.dataset.fptv='off';R.style.setProperty('--fptdw','0px');return}
  tp.style.width='';tp.style.height='';clr();
  const nw=tp.offsetWidth,nat=kids.map(c=>c.offsetWidth);
  if(B.tvw&&nw){kids.forEach((c,i)=>{if(nat[i]){c.style.boxSizing='border-box';c.style.width=nat[i]+'px';c.style.flex='none';c.dataset.fpvw='1'}})}
  if(B.tvw)tp.style.width=B.tvw+'px';if(B.tvh)tp.style.height=B.tvh+'px';tp.style.boxSizing='border-box';tp.dataset.fpvs='1';
  R.dataset.fptv=B.tvw?'on':'off';R.style.setProperty('--fptdw',B.tvw&&nw?(nw-B.tvw)+'px':'0px');
}
/* The navigation bar can be sized freely in both directions (vw / vh). Its buttons keep their normal size: only the bar changes. */
function fpDockSize(){
  const dk=$('#dock'),tb=dk&&dk.querySelector(':scope>.tabs'),B=fpBs();
  if(!dk||!tb)return;
  if(!B.vw&&!B.vh){if(dk.dataset.fpvs){dk.style.width='';dk.style.height='';dk.style.boxSizing='';tb.style.width='';tb.style.height='';tb.style.flex='';delete dk.dataset.fpvs}return}
  dk.style.width='';dk.style.height='';tb.style.width='';tb.style.height='';tb.style.flex='';
  const nw=tb.offsetWidth,nh=tb.offsetHeight;
  if(nw&&nh){tb.style.flex='none';tb.style.width=nw+'px';tb.style.height=nh+'px'}
  if(B.vw)dk.style.width=B.vw+'px';if(B.vh)dk.style.height=B.vh+'px';dk.style.boxSizing='border-box';dk.dataset.fpvs='1';
}
/* Option per bar: when icons do not follow, the bar moves alone and its contents are shifted back by the same amount */
function fpCounter(){
  const R=document.documentElement,B=FP.on&&FP.b||{};
  for(const [id,f] of [['top','tf'],['dock','df']]){
    const p=FP.on&&FP.p['hdr:'+id]||{},off=B[f]===0,oo=fpOff('hdr:'+id,p);
    R.dataset['fp'+f]=off?'off':'on';
    R.style.setProperty('--fp'+id+'x',off?-oo[0]+'px':'0px');R.style.setProperty('--fp'+id+'y',off?-oo[1]+'px':'0px');
  }
}
function fpCounterLive(k,x,y){const id=k==='hdr:top'?'top':'dock',f=id==='top'?'tf':'df',R=document.documentElement;if((FP.b||{})[f]===0){R.style.setProperty('--fp'+id+'x',-x+'px');R.style.setProperty('--fp'+id+'y',-y+'px')}}
let fphQ=0;const fpHQ=()=>{if(!fphQ)fphQ=requestAnimationFrame(()=>{fphQ=0;fpHandles();fpRot()})};
function fpHandles(){
  document.querySelectorAll('.fph,.fpr').forEach(x=>x.remove());if(!fpOn()||fpFull())return;
  const hd=document.querySelector('#top header'),dk=$('#dock'),d=getDock(),out=[];
  const add=(bar,el,dirs,ox,oy)=>{
    if(!el)return;const q=el.getBoundingClientRect();if(!q.width)return;
    const r={left:q.left+(ox||0),top:q.top+(oy||0),width:q.width,height:q.height};r.right=r.left+r.width;r.bottom=r.top+r.height;
    out.push(`<i class="fpr" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px"></i>`);
    const X={w:r.left,'':r.left+r.width/2,e:r.right},Y={n:r.top,'':r.top+r.height/2,s:r.bottom};
    dirs.forEach(k=>{const y=k.includes('n')?'n':k.includes('s')?'s':'',x=k.includes('w')?'w':k.includes('e')?'e':'',px=Math.max(5,Math.min(innerWidth-5,X[x])),py=Math.max(5,Math.min(innerHeight-5,Y[y]));
      out.push(`<i class="fph" data-h="${bar}" data-d="${k}" style="left:${Math.round(px-5)}px;top:${Math.round(py-5)}px"></i>`)});
  };
  add('top',$('#top'),['nw','n','ne','w','e','sw','s','se']);
  if(dk&&d!=='top')add('dock',dk,['nw','n','ne','w','e','sw','s','se']);
  document.body.insertAdjacentHTML('beforeend',out.join(''));
}
/* one gesture at a time: a second finger or a stray pointer never starts a second drag */
let fpBusy=false;
const fpBusyOn=()=>{fpBusy=true;document.documentElement.classList.add('fpd')};/* the panel fades while dragging so nothing is hidden behind it */
const fpBusyOff=()=>{fpBusy=false;document.documentElement.classList.remove('fpd')};
/* resize like an image in Paint: corner and edge handles around the bar (top bar: width and height; side/bottom bar: thickness) */
document.addEventListener('pointerdown',e=>{
  const h=e.target.closest&&e.target.closest('.fph');if(!h||!fpOn())return;
  e.preventDefault();e.stopPropagation();if(fpBusy||e.button>0||e.isPrimary===false)return;
  const bar=h.dataset.h,k=h.dataset.d,sgx=k.includes('e')?1:k.includes('w')?-1:0,sgy=k.includes('s')?1:k.includes('n')?-1:0,B=FP.b=FP.b||{},pre=fpSnap();
  const sx=e.clientX,sy=e.clientY,top=bar==='top',el=top?$('#top'):$('#dock');if(!el)return;
  const kx=top?'tvw':'vw',ky=top?'tvh':'vh',pk=top?'hdr:top':'hdr:dock',LM=top?[60,4000,30,1200]:[40,900,40,2400];
  const r=el.getBoundingClientRect(),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),pid=e.pointerId;
  fpBusyOn();
  const mv=ev=>{
    if(ev.pointerId!==pid)return;
    const dx=ev.clientX-sx,dy=ev.clientY-sy;
    /* free resize in x and y: the edge opposite the handle stays where it is, the icons and buttons inside keep their size and place */
    if(sgx)B[kx]=Math.round(cl(r.width+sgx*dx,LM[0],LM[1]));
    if(sgy)B[ky]=Math.round(cl(r.height+sgy*dy,LM[2],LM[3]));
    if(!B[kx])B[kx]=Math.round(r.width);if(!B[ky])B[ky]=Math.round(r.height);
    fpBars();
    const q=el.getBoundingClientRect(),P=fpMk(pk);
    if(sgx>0)P.x=Math.round((P.x||0)+r.left-q.left);else if(sgx<0)P.x=Math.round((P.x||0)+r.right-q.right);
    if(sgy>0)P.y=Math.round((P.y||0)+r.top-q.top);else if(sgy<0)P.y=Math.round((P.y||0)+r.bottom-q.bottom);
    fpOne(el,P);fpCounter();
    fpApply(true);fpHQ();
  };
  const up=ev=>{if(ev&&ev.pointerId!==pid)return;removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);fpBusyOff();FP.on=true;fpCommit(pre);fpSave();fpHandles()};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
},true);

/* ---- applying: does nothing at all while there is no placement and the editor is closed ---- */
let fpDirty=false;
const fpHas=()=>FP.on&&(Object.keys(FP.p).length>0||Object.keys(FP.b||{}).length>0);
function fpApply(force){
  const has=fpHas(),ed=fpOn();
  if(!has&&!ed&&!fpDirty&&!force)return;
  if(!ed)fpAbsSync();else{FPE.sig='';FPE.m={}}
  fpBars();
  const items=fpItems();
  for(const el of items)fpOne(el,FP.on&&FP.p[el.dataset.fpk]);
  fpDirty=has||ed;
  document.documentElement.dataset.fpv=(ed||(FP.on&&Object.keys(FP.p).some(k=>k.startsWith('mini:'))))?'on':'off';
  /* the full player is rebuilt on every song change: keep the selection on the same item */
  if(FPSEL&&!FPSEL.isConnected){const k=FPSEL.dataset.fpk,n=items.find(x=>x.dataset.fpk===k);if(n){FPSEL=n;n.classList.add('fpsel');fpRot()}else fpSel(null)}
}
const fpName=el=>{
  if(el.id==='logo')return 'Logo';if(el.id==='top')return 'Top bar';if(el.id==='dock')return 'Navigation bar';if(el.id==='main')return 'Content area';if(el.id==='np')return 'Side panel';if(el.id==='npb')return 'Player bar';if(el.id==='mini')return 'Mini player';
  if(el.classList.contains('mvs'))return 'Volume';
  if(el.dataset.fps==='full'){const c=el.classList;if(c.contains('ftop'))return 'Top row';if(c.contains('tbm'))return 'Options menu';if(c.contains('fcv'))return 'Cover';if(c.contains('fti'))return 'Title and artist';if(c.contains('fsk'))return 'Seek bar';if(c.contains('ctl'))return 'Controls row';if(c.contains('fbot'))return 'Bottom row';if(c.contains('fg'))return 'Like and add buttons';if(c.contains('fvol'))return 'Volume';if(c.contains('fr'))return 'Queue and edit buttons'}
  return el.getAttribute('aria-label')||el.title||el.id||el.className.split(' ')[0]||'Item';
};
function fpSel(el){
  setTimeout(fpRot,0);FPSEL=el;document.querySelectorAll('.fpsel').forEach(x=>x.classList.remove('fpsel'));const b=$('#fpsel');if(!b)return;
  const it=$('#fpit');if(it)it.value=el?el.dataset.fpk:'';
  if(!el){b.innerHTML='<small>Tap an item on the screen, or pick one from the list.</small>';return}
  el.classList.add('fpsel');
  const p=FP.p[el.dataset.fpk]||{},main=el.id==='main',keep=fpKeep(el),sl=(f,l,v,mn,mx,u='%')=>`<div class="fop${v===FPD[f]?' dflt':''}"><span>${l}</span><input type="range" class="rng" data-fpf="${f}" data-u="${u}" min="${mn}" max="${mx}" value="${v}" style="--p:${(v-mn)/(mx-mn)*100}%" aria-label="${l}"><b>${v}${u}</b><button type="button" class="rsb" data-fpr="${f}" aria-label="Reset ${l}" title="Reset ${l}">${ic('rst',16)}</button></div>`;
  const pos=()=>{const R=fpRange(el,p);return sl('x','X',p.x||0,R.x[0],R.x[1],'px')+sl('y','Y',p.y||0,R.y[0],R.y[1],'px')};
  b.innerHTML=`<b>${esc(fpName(el))}</b><div class="bgs">${pos()}${main?sl('w','Width',p.w||100,40,100)+sl('h','Height',p.h||100,40,100):sl('s','Size',p.s||100,20,300)+sl('r','Rotate',p.r||0,-180,180,'\u00b0')}</div>`+`<div class="icrt"><b>Layer ${p.z||0}</b><span class="icrm"><button type="button" class="ib" data-fpz="-1" aria-label="Send back one layer" title="Send back (behind panels)">${ic('down',20)}</button><button type="button" class="ib" data-fpz="1" aria-label="Bring forward one layer" title="Bring forward (above panels)">${ic('up',20)}</button></span></div>`+(main?'':`<button type="button" class="srow" data-fpg="1" role="switch" aria-checked="${!p.ng}"><span class="st"><b>Alignment guides</b></span><span class="stog"></span></button>`)+(keep?'':`<button type="button" class="srow" data-fph="1" role="switch" aria-checked="${!!p.hd}"><span class="st"><b>Hide this item</b></span><span class="stog"></span></button>`)+(el.id==='top'||el.id==='dock'?`<button type="button" class="srow" data-fpb="${el.id==='top'?'tf':'df'}" role="switch" aria-checked="${(FP.b||{})[el.id==='top'?'tf':'df']!==0}"><span class="st"><b>Move icons with the bar</b></span><span class="stog"></span></button>`:'')+'<button type="button" class="pill" data-fp="item">Reset this item</button>';
}
/* sliders: one undo step per drag of a slider */
let fpSlPre=null;
document.addEventListener('input',e=>{
  const i=e.target;if(!FPSEL||!i.dataset||!i.dataset.fpf||!i.closest('#fpbar'))return;
  if(fpSlPre===null)fpSlPre=fpSnap();
  const k=FPSEL.dataset.fpk,p=fpMk(k),v=+i.value,mn=+i.min,mx=+i.max;p[i.dataset.fpf]=v;
  i.style.setProperty('--p',((v-mn)/(mx-mn)*100)+'%');i.parentNode.querySelector('b').textContent=v+(i.dataset.u||'%');i.parentNode.classList.toggle('dflt',v===FPD[i.dataset.fpf]);fpOne(FPSEL,p);fpSave();fpSync(i.dataset.fpf);fpRot();
});
document.addEventListener('change',e=>{const i=e.target;if(i&&i.dataset&&i.dataset.fpf&&i.closest&&i.closest('#fpbar')){const k=FPSEL&&FPSEL.dataset.fpk;if(k)fpClean(k);fpCommit(fpSlPre);fpSlPre=null;fpSave()}});
function fpGuides(x,y,b){
  let gx=$('#fpgx'),gy=$('#fpgy');
  if(!b){if(gx)gx.remove();if(gy)gy.remove();return}
  if(!gx){document.body.insertAdjacentHTML('beforeend','<i id="fpgx" class="fpg"></i><i id="fpgy" class="fpg"></i>');gx=$('#fpgx');gy=$('#fpgy')}
  gx.style.cssText=x==null?'display:none':`left:${x}px;top:${b.top}px;height:${b.height}px;width:1px`;
  gy.style.cssText=y==null?'display:none':`top:${y}px;left:${b.left}px;width:${b.width}px;height:1px`;
}
/* the item list: every visible item of the current screen, grouped, so tiny or overlapping items are always reachable */
function fpList(){
  const sel=$('#fpit');if(!sel)return;
  const G={},cnt={};
  for(const el of fpItems()){
    if((el.dataset.fps==='full')!==fpFull())continue;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    let n=fpName(el);cnt[n]=(cnt[n]||0)+1;if(cnt[n]>1)n+=' '+cnt[n];
    (G[el.dataset.fps]=G[el.dataset.fps]||[]).push([el.dataset.fpk,n]);
  }
  const html='<option value="">Choose an item\u2026</option>'+Object.keys(G).map(s=>`<optgroup label="${esc(FPG[s]||s)}">${G[s].map(a=>`<option value="${esc(a[0])}">${esc(a[1])}</option>`).join('')}</optgroup>`).join('');
  if(sel.dataset.sig!==html){sel.dataset.sig=html;sel.innerHTML=html}
  sel.value=FPSEL?FPSEL.dataset.fpk:'';
}
function fpPick(k){const el=fpItems().find(x=>x.dataset.fpk===k&&(x.dataset.fps==='full')===fpFull());if(el&&el.getBoundingClientRect().width)fpSel(el);else fpSel(null)}
function fpStep(d){
  const o=[...$('#fpit').options].map(x=>x.value).filter(Boolean);if(!o.length)return;
  const i=FPSEL?o.indexOf(FPSEL.dataset.fpk):-1;fpPick(o[((i<0?(d>0?-1:0):i)+d+o.length)%o.length]);
}
/* quick buttons: the things that are awkward to tap */
function fpModeUi(){
  const b=$('#fpbar');if(!b)return;
  b.querySelectorAll('[data-fpm]').forEach(c=>{const on=c.dataset.fpm===FPM;c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on))});
  const q=$('#fpq');if(q)q.innerHTML=fpFull()?[['#fc .ftop','Top row'],['#fc .fcv','Cover'],['#fc .fti','Title'],['#fc .fsk','Seek bar'],['#fc .ctl','Controls'],['#fc .fbot','Bottom row']].map(a=>`<button type="button" class="chip" data-fpq="${a[0]}">${a[1]}</button>`).join(''):[['#logo','Logo'],['#top','Top bar'],['#dock','Nav bar'],['#main','Content']].map(a=>`<button type="button" class="chip" data-fpq="${a[0]}">${a[1]}</button>`).join('');
  const t=b.querySelector('.fpt');if(t)t.innerHTML=fpFull()?'Arrange the full player: cover, title, seek bar and buttons.<br>Drag, or use the arrow keys (Shift = 10 px).':`Editing the ${npOn()?'Spotify bar':'mini player'}, tabs and icons.<br>Drag, or use the arrow keys (Shift = 10 px).`;
}
let fpFullBy=false;/* true when the editor opened the full player itself, so Done closes it again */
function fpMode(m){
  if(!fpOn()||m===FPM)return;
  if(m==='full'){
    if(!songById(cur)){toast('Play a song first to arrange the full player');return}
    if(!$('#full').classList.contains('open')){try{openFull();fpFullBy=true}catch(e){return}}
  }else if($('#full').classList.contains('open')){try{closeFull()}catch(e){}fpFullBy=false}
  FPM=m;fpSel(null);fpModeUi();fpGuides(0,0,null);
  document.querySelectorAll('.fph,.fpr').forEach(x=>x.remove());
  setTimeout(()=>{if(!fpOn()||FPM!==m)return;fpItems();fpApply();fpHandles();fpList()},m==='full'?480:380);
}
function fpEdit(on){
  const R=document.documentElement;
  R.classList.toggle('fpe',on);const old=$('#fpbar');if(old)old.remove();
  if(!on){
    fpGuides(0,0,null);fpSel(null);document.querySelectorAll('.fph,.fpr,.fprot').forEach(x=>x.remove());R.classList.remove('fpd');fpBusy=false;
    fpAnchor();fpApply(true);fpSaveNow();
    if(fpFullBy){fpFullBy=false;try{closeFull()}catch(_){}}
    FPM='main';setTimeout(fpRescue,450);return;
  }
  FP.on=true;fpRebase();fpSaveNow();fpItems();FPM=$('#full').classList.contains('open')?'full':'main';fpH.u=[];fpH.r=[];fpFullBy=false;
  fpApply(true);fpHandles();
  const mp=LS('tracks-fpmin'),min=mp==null?(innerHeight<480||innerWidth<340):mp==='1';   /* small window: start as a single bar so the screen stays visible */
  document.body.insertAdjacentHTML('beforeend',`<div id="fpbar" role="toolbar" aria-label="Free placement editor" class="${min?'min':''}"><div id="fpgrip" title="Drag to move this panel"><i class="fpgi"></i><span>Free placement<i class="xbadge s">Experimental</i></span><button type="button" class="ib" data-fp="undo" aria-label="Undo" title="Undo (Ctrl+Z)" disabled>${ic('undo',20)}</button><button type="button" class="ib" data-fp="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled>${ic('redo',20)}</button><button type="button" class="ib" data-fp="min" aria-expanded="${!min}" aria-label="${min?'Expand panel':'Collapse panel'}" title="${min?'Expand panel':'Collapse panel to see the screen'}">${ic(min?'up':'down',20)}</button><button type="button" class="ib" data-fp="reset" aria-label="Reset all placement" title="Reset all placement">${ic('rst',20)}</button></div><div id="fpbody"><div id="fpmode" role="group" aria-label="What to arrange"><button type="button" class="chip" data-fpm="main">Main screen</button><button type="button" class="chip" data-fpm="full">Full player</button></div><div id="fpq"></div><div class="fpit"><select id="fpit" aria-label="Choose an item to edit"></select><button type="button" class="ib" data-fpn="-1" aria-label="Previous item" title="Previous item">${ic('up',20)}</button><button type="button" class="ib" data-fpn="1" aria-label="Next item" title="Next item">${ic('down',20)}</button></div><span class="fpt"></span><div id="fpsel"></div><button type="button" class="srow" data-fpsn="1" role="switch" aria-checked="${FP.sn!==false}"><span class="st"><b>Snap to guides</b></span><span class="stog"></span></button><div><button type="button" class="pill acc" data-fp="done">Done</button></div></div></div>`);
  fpModeUi();fpSel(null);fpList();fpPlaceBar();
}
/* ---- picking and dragging items ---- */
document.addEventListener('pointerdown',e=>{
  if(!fpOn()||e.target.closest('#fpbar,.fprot,.fph'))return;
  const L=[];for(const n of document.elementsFromPoint(e.clientX,e.clientY)){const it=n.closest&&n.closest('[data-fpk]');if(it&&(it.dataset.fps==='full')===fpFull()&&!L.includes(it))L.push(it)}
  const was=FPSEL,el=L.includes(was)?was:L[0];if(!el)return;
  e.preventDefault();e.stopPropagation();if(fpBusy||e.button>0||e.isPrimary===false)return;
  const s=el.dataset.fps,k=el.dataset.fpk,c=Object.assign({x:0,y:0},FP.p[k]),r0=el.getBoundingClientRect(),boxEl=fpBox(s);if(!boxEl)return;
  const bx=boxEl.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,pre=fpSnap(),pid=e.pointerId,snapOn=FP.sn!==false&&!c.ng;
  const xs=[bx.left,bx.left+bx.width/2,bx.right],ys=[bx.top,bx.top+bx.height/2,bx.bottom];
  fpItems().forEach(o=>{if(o===el||o.dataset.fps!==s)return;const r=o.getBoundingClientRect();if(!r.width)return;xs.push(r.left,r.left+r.width/2,r.right);ys.push(r.top,r.top+r.height/2,r.bottom)});
  let dx=0,dy=0,mvd=false;
  const snap=(L,len,arr)=>{let best=7,off=0,g=null;for(const t of arr)for(const v of [L,L+len/2,L+len]){const d=t-v;if(Math.abs(d)<best){best=Math.abs(d);off=d;g=t}}return [off,g]};
  const mv=ev=>{
    if(ev.pointerId!==pid)return;
    if(!mvd&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>4){mvd=true;fpBusyOn()}
    if(!mvd)return;
    dx=Math.min(bx.right-r0.right,Math.max(bx.left-r0.left,ev.clientX-sx));dy=Math.min(bx.bottom-r0.bottom,Math.max(bx.top-r0.top,ev.clientY-sy));
    let gx=null,gy=null;
    if(!ev.altKey&&snapOn){const a=snap(r0.left+dx,r0.width,xs),b=snap(r0.top+dy,r0.height,ys);if(a[1]!=null){dx+=a[0];gx=a[1]}if(b[1]!=null){dy+=b[0];gy=b[1]}}
    el.style.translate=(c.x+dx)+'px '+(c.y+dy)+'px';fpGuides(gx,gy,bx);
    if(s==='hdr'){if(k==='hdr:top'||k==='hdr:dock')fpCounterLive(k,c.x+dx,c.y+dy);fpHQ()}/* handles move with the bar while dragging */
  };
  const up=ev=>{
    if(ev&&ev.pointerId!==pid)return;
    removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);fpGuides(0,0,null);fpBusyOff();
    if(mvd&&ev&&ev.type!=='pointercancel'){const p=fpMk(k);p.x=Math.round(c.x+dx);p.y=Math.round(c.y+dy);fpClean(k);fpOne(el,FP.p[k]);fpCommit(pre);fpSave()}else fpOne(el,FP.on&&FP.p[k]);
    fpSel(!mvd&&was===el&&L.length>1?L[(L.indexOf(el)+1)%L.length]:el);
  };
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
},true);
/* ---- buttons of the editor ---- */
function fpResetAll(){const pre=fpSnap();FP.p={};FP.b={};try{dockSync()}catch(_){}fpApply(true);fpCommit(pre);fpSave();fpSel(null);fpHandles();fpList();toast('Placement reset. Undo brings it back')}
document.addEventListener('click',e=>{
  if(!fpOn())return;const t=e.target;
  if(!t.closest('#fpbar')){e.stopPropagation();e.preventDefault();return}/* nothing outside the editor can be triggered while arranging */
  let b;
  if(b=t.closest('[data-fp]')){
    const a=b.dataset.fp;
    if(a==='reset')fpResetAll();
    else if(a==='undo')fpUndo(false);
    else if(a==='redo')fpUndo(true);
    else if(a==='item'){if(FPSEL){const pre=fpSnap();delete FP.p[FPSEL.dataset.fpk];if(FPSEL.id==='dock'){delete FP.b.vw;delete FP.b.vh;delete FP.b.df}if(FPSEL.id==='top'){delete FP.b.tw;delete FP.b.th;delete FP.b.ta;delete FP.b.tf;delete FP.b.tvw;delete FP.b.tvh}fpApply(true);fpCommit(pre);fpSave();fpSel(FPSEL)}}
    else if(a==='min'){const bar=$('#fpbar'),m=!bar.classList.contains('min');bar.classList.toggle('min',m);LS('tracks-fpmin',m?'1':'0');b.setAttribute('aria-expanded',String(!m));b.setAttribute('aria-label',m?'Expand panel':'Collapse panel');b.title=m?'Expand panel':'Collapse panel to see the screen';b.innerHTML=ic(m?'up':'down',20);fpClampBar()}
    else fpEdit(false);
    return;
  }
  if(b=t.closest('[data-fpm]')){fpMode(b.dataset.fpm);return}
  if(b=t.closest('[data-fpn]')){fpStep(+b.dataset.fpn);return}
  if(b=t.closest('[data-fpr]')){
    if(!FPSEL)return;const f=b.dataset.fpr,k=FPSEL.dataset.fpk,pre=fpSnap();fpMk(k)[f]=FPD[f];fpClean(k);
    fpOne(FPSEL,FP.p[k]);fpCommit(pre);fpSave();fpSync();fpRot();return;
  }
  if(b=t.closest('[data-fpz]')){
    if(!FPSEL)return;const k=FPSEL.dataset.fpk,pre=fpSnap(),p=fpMk(k);p.z=Math.max(-10,Math.min(30,(p.z||0)+ +b.dataset.fpz));fpClean(k);fpOne(FPSEL,FP.p[k]||null);fpCommit(pre);fpSave();fpSel(FPSEL);return;
  }
  if(b=t.closest('[data-fpg]')){
    if(!FPSEL)return;const k=FPSEL.dataset.fpk,pre=fpSnap(),p=fpMk(k);p.ng=!p.ng;if(!p.ng)delete p.ng;fpClean(k);fpCommit(pre);fpSave();b.setAttribute('aria-checked',String(!p.ng));return;
  }
  if(b=t.closest('[data-fph]')){
    if(!FPSEL||fpKeep(FPSEL))return;const k=FPSEL.dataset.fpk,pre=fpSnap(),p=fpMk(k);p.hd=!p.hd;if(!p.hd)delete p.hd;fpClean(k);fpOne(FPSEL,FP.p[k]||null);fpCommit(pre);fpSave();fpSel(FPSEL);return;
  }
  if(b=t.closest('[data-fpb]')){const f=b.dataset.fpb,pre=fpSnap();FP.b=FP.b||{};if(FP.b[f]===0)delete FP.b[f];else FP.b[f]=0;fpApply(true);fpHQ();fpCommit(pre);fpSave();b.setAttribute('aria-checked',String(FP.b[f]!==0));return}
  if(b=t.closest('[data-fpsn]')){const pre=fpSnap();FP.sn=FP.sn===false;fpCommit(pre);fpSave();b.setAttribute('aria-checked',String(FP.sn!==false));return}
  if(b=t.closest('[data-fpq]')){
    const el=document.querySelector(b.dataset.fpq);
    if(el&&el.dataset.fpk&&el.getBoundingClientRect().width)fpSel(el);else toast('Not visible right now');
  }
},true);
document.addEventListener('change',e=>{if(e.target&&e.target.id==='fpit'&&fpOn())fpPick(e.target.value)});
/* keyboard: Esc = done, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y = undo / redo, arrows nudge the selected item (Shift = 10 px), Delete resets it */
let fpNdPre=null,fpNdT=0;
function fpNudge(dx,dy){
  const el=FPSEL;if(!el||!el.isConnected)return;
  if(fpNdPre===null)fpNdPre=fpSnap();
  const k=el.dataset.fpk,p=fpMk(k),R=fpRange(el,p);
  p.x=Math.round(Math.max(R.x[0],Math.min(R.x[1],(p.x||0)+dx)));p.y=Math.round(Math.max(R.y[0],Math.min(R.y[1],(p.y||0)+dy)));
  fpOne(el,p);fpSave();fpSync();fpRot();
  clearTimeout(fpNdT);fpNdT=setTimeout(()=>{fpClean(k);fpCommit(fpNdPre);fpNdPre=null},500);
}
addEventListener('keydown',e=>{
  if(!fpOn())return;
  if(e.key==='Escape'){e.preventDefault();fpEdit(false);return}
  const t=e.target,typing=t&&(t.isContentEditable||/^(TEXTAREA|SELECT)$/.test(t.tagName)||(t.tagName==='INPUT'&&t.type!=='range'));
  if(typing)return;
  const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod&&k==='z'){e.preventDefault();fpUndo(e.shiftKey);return}
  if(mod&&k==='y'){e.preventDefault();fpUndo(true);return}
  if(mod||e.altKey)return;
  if(t&&t.tagName==='INPUT'&&t.type==='range')return;/* arrows belong to the focused slider */
  const st=e.shiftKey?10:1;
  if(k==='arrowleft'||k==='arrowright'||k==='arrowup'||k==='arrowdown'){if(!FPSEL)return;e.preventDefault();fpNudge(k==='arrowleft'?-st:k==='arrowright'?st:0,k==='arrowup'?-st:k==='arrowdown'?st:0);return}
  if((k==='delete'||k==='backspace')&&FPSEL&&!(t&&t.tagName==='BUTTON')){e.preventDefault();const pre=fpSnap();delete FP.p[FPSEL.dataset.fpk];if(FPSEL.id==='dock'){delete FP.b.vw;delete FP.b.vh;delete FP.b.df}if(FPSEL.id==='top'){delete FP.b.tw;delete FP.b.th;delete FP.b.ta;delete FP.b.tf;delete FP.b.tvw;delete FP.b.tvh}fpApply(true);fpCommit(pre);fpSave();fpSel(FPSEL)}
});
/* safety net: an essential button (settings, play, close) that ends up off screen, for example after rotating the phone, gets its placement reset */
let fpRq=0;
function fpRescue(){
  fpRq=0;if(fpOn()||!fpHas())return;
  {const k=fpK();if(k.x>=1&&k.y>=1&&Object.values(FP.p).some(q=>(q.x||q.y)&&!q.a)){FP.rw=FP.rw||innerWidth;FP.rh=FP.rh||innerHeight;fpAnchor();fpSaveNow()}}   /* older layouts: remember which panel each item sits on */
  if(fpFit()&&Date.now()-fpToastAt>8000){fpToastAt=Date.now();toast('Placed items were moved to fit this window')}
  const f=$('#full');let ch=false;
  document.querySelectorAll(FPK_ESS).forEach(el=>{
    const k=el.dataset.fpk,p=k&&FP.p[k];if(!p)return;
    if(f&&el.closest('#full')&&(!f.classList.contains('open')||f.getAnimations().length))return;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
    if(r.right<4||r.bottom<4||r.left>innerWidth-4||r.top>innerHeight-4){delete FP.p[k];ch=true}
  });
  if(ch){fpSave();fpApply(true);toast('A button was off screen, so its placement was reset')}
}
/* a smaller window: pull moved items back inside it (and shrink ones that are bigger than the window) instead of losing them.
   Items that sit off screen by nature (tabs in a scrolling bar) are left alone. While arranging, the change is kept; otherwise it only lasts until the page is reloaded,
   so the saved layout comes back untouched when the window is large again. */
let fpToastAt=0;
function fpFit(){
  if(!fpHas()&&!fpOn())return false;
  const W=innerWidth,H=innerHeight,M=4,f=$('#full');let ch=false;
  const live=el=>!(el.closest('#full')&&(!f||!f.classList.contains('open')||f.getAnimations().length));
  const items=[...document.querySelectorAll('[data-fpk]')].filter(el=>!/^(main|top|dock)$/.test(el.id)&&live(el));
  /* top and navigation bars sized by hand never need to be wider or taller than the window */
  if(fpOn()&&FP.b){for(const [k,lim,mn] of [['tvw',W-2*M,60],['vw',W-2*M,40],['tvh',H-2*M,30],['vh',H-2*M,40]]){if(FP.b[k]>lim&&lim>=mn){FP.b[k]=Math.round(lim);ch=true}}if(ch)fpBars()}
  /* pass 1: size */
  for(const el of items){
    const p=FP.p[el.dataset.fpk];if(!p||p.hd||!(p.s&&p.s>20))continue;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    const k=Math.min((W-2*M)/r.width,(H-2*M)/r.height);
    if(k<1){p.s=Math.max(20,Math.floor(p.s*k));fpOne(el,p);ch=true}
  }
  /* pass 2: position (parents first, so a button inside a moved panel is measured after the panel) */
  for(const el of items){
    const p=FP.p[el.dataset.fpk];if(!p||p.hd||!(p.x||p.y))continue;
    const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    const o0=fpOff(el.dataset.fpk,p),nx=(r.left+r.right)/2-o0[0],ny=(r.top+r.bottom)/2-o0[1];
    if(nx<0||nx>W||ny<0||ny>H)continue;   /* its natural place is already off screen (scrolling bar): not ours to fix */
    let dx=0,dy=0;
    if(r.left<M)dx=M-r.left;else if(r.right>W-M)dx=W-M-r.right;
    if(r.top<M)dy=M-r.top;else if(r.bottom>H-M)dy=H-M-r.bottom;
    if(r.width>W-2*M)dx=M-r.left;if(r.height>H-2*M)dy=M-r.top;
    if(!dx&&!dy)continue;
    const cl=(v,a)=>Math.round(Math.max(FP_LIM[a][0],Math.min(FP_LIM[a][1],v)));
    const kk=fpK(),e=FPE.m[el.dataset.fpk];if(e&&!fpOn()){e[0]+=Math.round(dx);e[1]+=Math.round(dy)}else{p.x=cl((p.x||0)+dx/kk.x,'x');p.y=cl((p.y||0)+dy/kk.y,'y')}fpOne(el,p);ch=true;
  }
  return ch;
}
let fpFt=0;
addEventListener('resize',()=>{
  if(fpOn()){fpHQ();clearTimeout(fpFt);fpFt=setTimeout(()=>{if(!fpOn())return;fpRebase();fpApply(true);fpFit();fpApply(true);fpSave();fpSync();fpHQ()},160)}
  else if(fpHas()){clearTimeout(fpFt);fpFt=setTimeout(()=>{if(fpOn())return;fpApply(true);fpHQ()},120);if(!fpRq)fpRq=setTimeout(fpRescue,300)}
});
addEventListener('orientationchange',()=>{if(!fpOn()&&fpHas()&&!fpRq)fpRq=setTimeout(fpRescue,500)});

/* layout presets: built-in and your own; a preset holds the whole layout (bar, icons, free placement, side player) */
const PRE_KEY='tracks-presets',PRE_LOAD=()=>{try{const a=JSON.parse(LS(PRE_KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}};
const PRE_FP={on:false,p:{}},PRE_NP=on=>({on,ly:true,w:360}),PRE_POS=(a,b,c,d)=>({plus:a,cloud:b,qk:c,gear:d});
const PRE_BUILT=[
 {id:'std',name:'Standard',d:{dock:'top',dkc:false,dkw:'',dkh:'',hbm:'auto',icp:{on:false},fp:PRE_FP,np:PRE_NP(false)}},
 {id:'spot',name:'Spotify style',d:{dock:'left',dkc:false,dkw:'58',dkh:'',hbm:'off',icp:{on:false},fp:PRE_FP,np:{on:true,ly:true,w:380}}},
 {id:'bot',name:'Bottom bar',d:{dock:'bottom',dkc:false,dkw:'',dkh:'',hbm:'off',icp:{on:false},fp:PRE_FP,np:PRE_NP(false)}},
 {id:'rail',name:'Compact rail',d:{dock:'right',dkc:false,dkw:'58',dkh:'',hbm:'on',icp:{on:true,size:38,gap:4,sh:'plain',bg:'none',pos:PRE_POS('nl','nl','nr','nr')},fp:PRE_FP,np:PRE_NP(false)}}
];
function preSnap(){return JSON.parse(JSON.stringify({dock:getDock(),dkc:DKC.on,dkw:LS('tracks-dockw')||'',dkh:LS('tracks-dockh')||'',hbm:HBM.m,icp:ICP,fp:FP,np:{on:NP.on,ly:NP.ly,w:NP.w}}))}
function preApply(d){
  const x=JSON.parse(JSON.stringify(d));
  Object.assign(ICP,icDef(),x.icp||{});if(ICP.pos.gear==='off')ICP.pos.gear='hr';icSave();
  Object.assign(FP,fpSanitize(x.fp));fpSave();
  if(x.np){NP.on=!!x.np.on;NP.ly=x.np.ly!==false;if(x.np.w)NP.w=x.np.w;LS('tracks-np',NP.on?'1':'0');LS('tracks-npl',NP.ly?'1':'0');LS('tracks-npw',String(NP.w))}
  DKC.on=!!x.dkc;LS('tracks-dockc',x.dkc?'1':'0');LS('tracks-dockw',x.dkw||'');LS('tracks-dockh',x.dkh||'');
  if(x.hbm)setHbm(x.hbm);
  setDock(DOCKS.includes(x.dock)?x.dock:'top');
  try{hbPlace()}catch(e){}try{npApply()}catch(e){}fpApply();
}
function preClick(t,paint){
  let b;
  if(b=t.closest('[data-preset]')){const x=PRE_BUILT.concat(PRE_LOAD()).find(q=>q.id===b.dataset.preset);if(x){preApply(x.d);toast('Layout: '+x.name);paint()}return true}
  if(t.closest('[data-presave]')){ask('Name this preset','','Save').then(n=>{if(n){const a=PRE_LOAD();a.push({id:'u'+Date.now(),name:n,d:preSnap()});LS(PRE_KEY,JSON.stringify(a));toast('Preset saved')}setTimeout(icSheet,300)});return true}
  if(b=t.closest('[data-prepl]')){const a=PRE_LOAD(),x=a.find(q=>q.id===b.dataset.prepl);if(x){x.d=preSnap();LS(PRE_KEY,JSON.stringify(a));toast('Preset updated with the current layout')}return true}
  if(b=t.closest('[data-predel]')){LS(PRE_KEY,JSON.stringify(PRE_LOAD().filter(q=>q.id!==b.dataset.predel)));paint();return true}
  if(b=t.closest('[data-fpgo]')){const full=b.dataset.fpgo==='full';closeOv();setTimeout(()=>{fpEdit(true);if(full)fpMode('full')},380);return true}
  if(t.closest('[data-fpclr]')){FP.p={};FP.b={};fpSaveNow();try{dockSync()}catch(_){}fpApply(true);paint();return true}
  return false;
}
const FP_IN_MENU=false;/* the Free placement card is hidden from the Layout menu on purpose; set this to true to show it again. The editor itself is untouched. */
const fpMenuHtml=()=>`<div class="scd"><h4>Free placement<span class="xbadge">Experimental</span></h4><p class="dupn" style="margin:2px 6px 8px">Drag icons, tabs, toolbars, the side panel and the controls of the mini player, side player and full player anywhere. Resize, rotate, layer or hide them, with undo and redo. Guides snap to edges and centres. This feature is still being tested and can misbehave on some screens; if something ends up out of reach, open the app with ?fp=reset.</p><div class="bt"><button type="button" class="pill acc" data-fpgo="1">Place freely</button><button type="button" class="pill" data-fpgo="full">Arrange full player</button>${Object.keys(FP.p).length||Object.keys(FP.b||{}).length?'<button type="button" class="pill" data-fpclr="1">Clear placement</button>':''}</div></div>`;
const preHtml=()=>{const my=PRE_LOAD();return `<div class="scd"><h4>Presets</h4><div class="bgst icrc">${PRE_BUILT.concat(my).map(p=>`<button type="button" class="chip" data-preset="${p.id}">${esc(p.name)}</button>`).join('')}</div>${my.length?`<div class="icr"><div class="icrt"><b>My presets</b></div>${my.map(p=>`<div class="icrt"><b>${esc(p.name)}</b><span class="icrm"><button type="button" class="pill" data-prepl="${p.id}" title="Replace with the current layout">Update</button><button type="button" class="ib" data-predel="${p.id}" aria-label="Delete ${esc(p.name)}">${ic('trash',20)}</button></span></div>`).join('')}</div>`:''}<div class="bt" style="margin-top:6px"><button type="button" class="pill" data-presave="1">Save current layout as preset</button></div><p class="dupn" style="margin:6px 6px 2px">A preset keeps the navigation bar, icon layout and side player.</p></div>`+(FP_IN_MENU?'\n'+fpMenuHtml():'')};

/* the editor panel: drag it by its header, it always stays on screen and above everything else; it can be collapsed to a single bar */
function fpClampBar(){const b=$('#fpbar');if(!b)return;const r=b.getBoundingClientRect();b.style.left=Math.max(8,Math.min(innerWidth-r.width-8,r.left))+'px';b.style.top=Math.max(8,Math.min(innerHeight-r.height-8,r.top))+'px'}
let fpRo=null;
function fpPlaceBar(){
  const b=$('#fpbar');if(!b)return;let p=null;try{p=JSON.parse(LS('tracks-fpbar')||'null')}catch(e){}
  const r=b.getBoundingClientRect();b.style.transform='none';
  const wide=innerWidth>=700;/* wide screens: out of the way on the right; phones: centred */
  b.style.left=(p&&isFinite(p.x)?p.x:wide?innerWidth-r.width-16:(innerWidth-r.width)/2)+'px';b.style.top=(p&&isFinite(p.y)?p.y:wide?Math.max(70,(innerHeight-r.height)/3):(innerHeight-r.height)/2)+'px';
  fpClampBar();
  try{if(fpRo)fpRo.disconnect();fpRo=new ResizeObserver(fpClampBar);fpRo.observe(b)}catch(e){}
}
document.addEventListener('pointerdown',e=>{
  const g=e.target.closest&&e.target.closest('#fpgrip');if(!g||e.target.closest('button')||!fpOn()||e.button>0)return;
  const b=$('#fpbar'),r=b.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;e.preventDefault();
  try{g.setPointerCapture(e.pointerId)}catch(_){}
  const mv=ev=>{b.style.left=Math.max(8,Math.min(innerWidth-r.width-8,ev.clientX-ox))+'px';b.style.top=Math.max(8,Math.min(innerHeight-b.offsetHeight-8,ev.clientY-oy))+'px'};
  const up=()=>{g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);g.removeEventListener('pointercancel',up);LS('tracks-fpbar',JSON.stringify({x:parseFloat(b.style.left),y:parseFloat(b.style.top)}))};
  g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
});
addEventListener('resize',fpClampBar);

/* rotate the selected item: drag the round handle above it (snaps every 15 degrees, hold Alt for free rotation) */
function fpRot(){
  document.querySelectorAll('.fprot').forEach(x=>x.remove());
  const el=FPSEL;if(!fpOn()||!el||el.id==='main'||!el.isConnected)return;
  const r=el.getBoundingClientRect();if(!r.width)return;
  const p=FP.p[el.dataset.fpk]||{},a=(p.r||0)*Math.PI/180,cx=r.left+r.width/2,cy=r.top+r.height/2,hh=el.offsetHeight?el.offsetHeight*(p.s||100)/200:r.height/2,R=hh+26;
  const x=Math.max(12,Math.min(innerWidth-12,cx+Math.sin(a)*R)),y=Math.max(12,Math.min(innerHeight-12,cy-Math.cos(a)*R));
  document.body.insertAdjacentHTML('beforeend',`<i class="fprot" style="left:${Math.round(x-9)}px;top:${Math.round(y-9)}px" title="Drag to rotate" aria-label="Rotate"></i>`);
}
document.addEventListener('pointerdown',e=>{
  const h=e.target.closest&&e.target.closest('.fprot');if(!h||!fpOn()||!FPSEL)return;
  e.preventDefault();e.stopPropagation();if(fpBusy||e.button>0||e.isPrimary===false)return;
  const el=FPSEL,k=el.dataset.fpk,r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,pre=fpSnap(),pid=e.pointerId;
  fpBusyOn();
  const mv=ev=>{
    if(ev.pointerId!==pid)return;
    let a=Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI+90;a=((a+540)%360)-180;
    if(!ev.altKey){const n=Math.round(a/15)*15;if(Math.abs(a-n)<4)a=n}
    const p=fpMk(k);p.r=Math.round(a);fpOne(el,p);fpRot();
    fpSync();
  };
  const up=ev=>{if(ev&&ev.pointerId!==pid)return;removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);fpBusyOff();fpClean(k);fpCommit(pre);fpSave();fpSync();fpRot()};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
},true);
/* watches the parts of the interface that get rebuilt (mini player, side player, bars, full player) and puts the placement back.
   Only real element changes count, not the time text that ticks every second, so this costs nothing during playback. */
function fpInit(){
  let q=0;
  const go=()=>{q=0;fpApply();if(fpOn())fpList()};
  const mo=new MutationObserver(recs=>{
    if(q)return;
    for(const r of recs){for(const n of r.addedNodes){if(n.nodeType===1){q=requestAnimationFrame(go);return}}}
  });
  ['#mini','#npb','#np','#dock','#top','#fc'].forEach(x=>{const n=$(x);if(n)mo.observe(n,{childList:true,subtree:true})});
  fpApply();setTimeout(fpRescue,1200);
}


/* ===== END 12-placement.js ===== */


/* ===== BEGIN 13-controls.js ===== */
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

function detectLayout(){return(matchMedia('(hover:hover) and (pointer:fine)').matches&&innerWidth>=640)?'pc':'phone'}
function curLayout(){return LAY.m==='auto'?detectLayout():LAY.m}
function applyLayout(){document.documentElement.dataset.layout=curLayout();try{applyDock(getDock())}catch(e){}try{dockSync()}catch(e){}try{hbPlace()}catch(e){}if(typeof npApply==='function')npApply()}
function setLayout(){/* layout is fixed: PC = left icon bar + side player, phone = bottom bar */}
applyLayout();
addEventListener('resize',()=>{applyLayout()});
/* mouse wheel over the player-bar volume button or slider changes the volume */
/* attached to the player bar itself (a non-passive wheel listener on the document slows down scrolling everywhere) */
function npbWheel(e){const t=e.target.closest&&e.target.closest('.nr .mt,#nbvl');if(!t)return;e.preventDefault();setVol(Math.min(1,Math.max(0,uvol+(e.deltaY<0?.05:-.05))))}
/* movable section bar: Albums / Songs / Playlists can sit on top (default), left, right or bottom. The same buttons move, so every existing handler keeps working */
const DOCKS=['top','left','right','bottom'];
const getDock=()=>curLayout()==='pc'?'left':'bottom';/* fixed: PC = left bar, phone = bottom bar */
function applyDock(d){
  const tabs=document.querySelector('.tabs'),dock=$('#dock'),hdr=document.querySelector('#top header');
  document.documentElement.dataset.dock=d;
  if(!tabs||!dock||!hdr)return;
  const host=d==='top'?hdr:dock;if(tabs.parentNode!==host)host.appendChild(tabs);
}
function setDock(){/* the bar position is fixed */}
[['t1','album'],['t2','note'],['t3','plist']].forEach(([id,k])=>{const b=$('#'+id);if(b&&!b.querySelector('.tic')){const t=b.textContent;b.innerHTML=ic(k,24).replace('class="ic"','class="ic tic"')+'<span class="tl">'+esc(t)+'</span>'}});
applyDock(getDock());
/* navigation bar size: drag the bar's inner edge to shrink it (never larger than the normal size); narrow enough = icons only */
const DKC={on:LS('tracks-dockc')==='1'};/* top bar: icons only on/off */
const dkMax=()=>{const pc=document.documentElement.dataset.layout==='pc',d=getDock();return d==='bottom'?(pc?72:66):(pc?112:84)};
const dkKey=()=>getDock()==='bottom'?'tracks-dockh':'tracks-dockw';
function dockSync(){
  const R=document.documentElement,d=getDock();let icons=false;
  R.style.removeProperty('--dw');R.style.removeProperty('--dbh');
  if(d==='left'){R.style.setProperty('--dw','58px');icons=true}
  else{R.style.setProperty('--dbh','54px');icons=true}
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
const icDef=()=>({on:true,pos:{plus:'hl',cloud:'hl',qk:'hr',gear:'hr'},ord:IC_KEYS.slice(),tabs:['t1','t2','t3'],size:44,gap:8,sh:'circle',bg:'auto',acc:false,sd:'auto',bw:null,gs:52,col:null,ink:null,tf:true,ts:'auto'});
const ICP=icDef();
try{const j=JSON.parse(LS('tracks-icp')||'null');if(j&&typeof j==='object'){
  if(IC_SH.some(p=>p[0]===j.sh))ICP.sh=j.sh;
  if(IC_BG.some(p=>p[0]===j.bg))ICP.bg=j.bg;
  if(IC_SD.some(p=>p[0]===j.sd))ICP.sd=j.sd;
  if(IC_TS.some(p=>p[0]===j.ts))ICP.ts=j.ts;
  if(/^#[0-9a-f]{6}$/i.test(j.col||''))ICP.col=j.col;
  if(/^#[0-9a-f]{6}$/i.test(j.ink||''))ICP.ink=j.ink;
  ICP.acc=!!j.acc}}catch(e){}
ICP.on=true;/* button and tab positions are fixed (see icEff); only the look is customisable */
const icSave=()=>LS('tracks-icp',JSON.stringify(ICP));
/* the bar placements need a left, right or bottom bar: with the bar on top those buttons stay in the header */
const icEff=k=>{const pc=curLayout()==='pc';return({plus:'nl',cloud:pc?'nl':'hl',qk:pc?'off':'hr',gear:'nr'})[k]||'hl'};/* fixed layout. PC: Add + Cloud at the top of the left bar, Settings at the bottom, queue lives in the player bar. Phone: Cloud top left, Queue top right, Add + Settings on the bottom bar */
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
  let sel=null;
  openOv(`<h3>Button &amp; tab style</h3><div id="icpv"></div><p class="dupn" id="icnote" style="margin:0 6px 12px"></p><div id="icb"></div>`);
  const sh=$('#ov .sheet'),chip=(on,a,t)=>`<button type="button" class="chip${on?' on':''}" ${a}>${t}</button>`;
  const body=()=>{
    const row=k=>{const g=ICP.ord.filter(x=>icEff(x)===icEff(k)),i=g.indexOf(k);
      return `<div class="icr${sel===k?' on':''}" data-rk="${k}"><div class="icrt"><span class="icri">${ic(IC_ICON[k],22)}</span><b>${IC_NAME[k]}</b><span class="icrm"><button type="button" class="ib" data-mv="${k}" data-d="-1" aria-label="Move ${IC_NAME[k]} earlier"${i<1?' disabled':''}>${ic('up',20)}</button><button type="button" class="ib" data-mv="${k}" data-d="1" aria-label="Move ${IC_NAME[k]} later"${i>=g.length-1?' disabled':''}>${ic('down',20)}</button></span></div><div class="bgst icrc">${IC_POS.filter(p=>!(k==='gear'&&p[0]==='off')).map(p=>chip(ICP.pos[k]===p[0],`data-pos="${p[0]}" data-k="${k}"`,p[1])).join('')}</div></div>`};
    const trow=(t,i)=>`<div class="icr"><div class="icrt"><span class="icri">${ic(IC_TAB[t][0],22)}</span><b>${IC_TAB[t][1]}</b><span class="icrm"><button type="button" class="ib" data-tmv="${t}" data-d="-1" aria-label="Move ${IC_TAB[t][1]} earlier"${i<1?' disabled':''}>${ic('up',20)}</button><button type="button" class="ib" data-tmv="${t}" data-d="1" aria-label="Move ${IC_TAB[t][1]} later"${i>=2?' disabled':''}>${ic('down',20)}</button></span></div></div>`;
    const sl=(id,l,v,mn,mx,df,u='px')=>`<div class="fop${v===df?' dflt':''}"><span>${l}</span><input type="range" class="rng" id="${id}" min="${mn}" max="${mx}" value="${v}" style="--p:${(v-mn)/(mx-mn)*100}%" aria-label="${l}"><b>${v}${u}</b><button type="button" class="rsb" data-icrs="${id}" aria-label="Reset ${l} to default" title="Reset to default">${ic('rst',16)}</button></div>`;
    const chs=(list,cur,attr)=>list.map(p=>chip(cur===p[0],`${attr}="${p[0]}"`,p[1])).join('');
    const sw=(attr,on,t,sm)=>`<button type="button" class="srow" ${attr} role="switch" aria-checked="${on}"><span class="st"><b>${t}</b>${sm?`<small>${sm}</small>`:''}</span><span class="stog"></span></button>`;
    const colr=(id,l,v,fb)=>`<div class="icr"><div class="icrt"><b>${l}</b><span class="icrm"><input type="color" class="iccp${v?' set':''}" id="${id}" value="${v||fb}" aria-label="${l}"><button type="button" class="pill" data-iccl="${id}"${v?'':' disabled'}>Auto</button></span></div></div>`;
    return `
    <div class="scd"><h4>Tabs</h4>
    <div class="icr"><div class="icrt"><b>Tab style</b></div><div class="bgst icrc">${chs(IC_TS,ICP.ts,'data-ts')}</div></div></div>
    <div class="scd"><h4>Button styles</h4>
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
    $('#icnote').textContent=bar?'Bar start and Bar end need the navigation bar on the left, right or bottom (Settings, Layout). Until then they stay at the top.':'Preview of your buttons and tabs.'};
  const paint=()=>{pv();$('#icb').innerHTML=body()};
  const apply=()=>{ICP.on=true;icSave();try{hbPlace()}catch(_){}if(typeof npApply==='function')try{npApply()}catch(_){}};
  const swap=(arr,k,d)=>{const i=arr.indexOf(k),j=i+d;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]]};
  sh.onclick=e=>{
    const t=e.target;
    if(t.closest('[data-icdone]')){closeOv();return}
    if(preClick(t,paint))return;
    const p=t.closest('.pvi');if(p){return;sel=p.dataset.pk;paint();const r=sh.querySelector(`[data-rk="${sel}"]`);if(r)r.scrollIntoView({block:'nearest',behavior:RM.matches?'auto':'smooth'});return}
    const rw=t.closest('[data-rk]');if(rw&&!t.closest('.chip,.ib')){sel=rw.dataset.rk;paint();return}
    if(t.closest('[data-icreset]')){const d=icDef();Object.assign(ICP,d,{on:true});icSave();try{hbPlace()}catch(_){}if(typeof npApply==='function')try{npApply()}catch(_){}sel=null;paint();toast('Button and tab style reset');return}
    const c=t.closest('[data-pos]');if(c){ICP.pos[c.dataset.k]=c.dataset.pos;sel=c.dataset.k;apply();paint();return}
    const m=t.closest('[data-mv]');if(m&&!m.disabled){const k=m.dataset.mv,d=+m.dataset.d,g=ICP.ord.filter(x=>icEff(x)===icEff(k)),i=g.indexOf(k),o=g[i+d];if(o){swap(ICP.ord,k,0);const a=ICP.ord.indexOf(k),b=ICP.ord.indexOf(o);ICP.ord[a]=o;ICP.ord[b]=k}sel=k;apply();paint();return}
    const tm=t.closest('[data-tmv]');if(tm&&!tm.disabled){swap(ICP.tabs,tm.dataset.tmv,+tm.dataset.d);apply();paint();return}
    const sp=t.closest('[data-sh]');if(sp){ICP.sh=sp.dataset.sh;apply();paint();return}
    const sdc=t.closest('[data-sd]');if(sdc){ICP.sd=sdc.dataset.sd;apply();paint();return}
    const tsc=t.closest('[data-ts]');if(tsc){ICP.ts=tsc.dataset.ts;apply();paint();return}
    const ccl=t.closest('[data-iccl]');if(ccl&&!ccl.disabled){ICP[ccl.dataset.iccl==='iccol'?'col':'ink']=null;apply();paint();return}
    const bm=t.closest('[data-bgm]');if(bm){ICP.bg=bm.dataset.bgm;apply();paint();return}
    if(t.closest('[data-acc]')){ICP.acc=!ICP.acc;apply();paint();return}
    if(t.closest('[data-hdac]')){HDAC.on=!HDAC.on;LS('tracks-hdac',HDAC.on?'1':'0');hdacApply();paint();return}
  };
  sh.oninput=e=>{const i=e.target;
    if(i.id==='iccol'||i.id==='icink'){ICP[i.id==='iccol'?'col':'ink']=i.value;apply();pv();i.classList.add('set');const r=i.parentNode.querySelector('[data-iccl]');if(r)r.disabled=false;return}
  };
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
  const TABS=[['app','Look'],['lay','Interface'],['play','Playback'],['lib','Library'],['data','Backup']];
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
    <div class="scd"><h4>Buttons and tabs</h4>${row('icl','Button and tab style','Shape, colours, size, tab style')}</div>
    <div class="scd"><h4>Mouse and touch</h4><button type="button" class="srow" data-rca="1" role="switch" aria-checked="true"><span class="st"><b>Right-click to add</b><small>PC only. Opens the Add menu on empty space.</small></span><span class="stog"></span></button><button type="button" class="srow" data-rci="1" role="switch" aria-checked="true"><span class="st"><b>Right-click songs, albums and playlists</b><small>PC only. Same menu as the 3 dots.</small></span><span class="stog"></span></button><button type="button" class="srow" data-gest="1" role="switch" aria-checked="true"><span class="st"><b>Swipe from edge to go back</b><small>Also makes the phone's back gesture work in the app.</small></span><span class="stog"></span></button></div>
    <div class="scd"><h4>Side player (PC)</h4><div id="npmore"><button type="button" class="srow" data-npset="ly" role="switch" aria-checked="true"><span class="st"><b>Show lyrics under the cover</b></span><span class="stog"></span></button><div class="bgs"><div class="fop"><span>Panel width</span><input type="range" class="rng" id="npwr" min="280" max="900" aria-label="Panel width"><b></b></div></div></div><p class="dupn" id="npn" style="margin:6px 6px 2px"></p></div>
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
    if(n)n.textContent='';{const cd=m&&m.closest('.scd');if(cd)cd.hidden=!pc}
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


/* ===== END 13-controls.js ===== */


/* ===== BEGIN 14-transitions.js ===== */
/* sleep timer, crossfade or gapless, listening stats, export and share, Drive quota */
const ST=(()=>{try{return JSON.parse(LS('tracks-stats')||'{}')||{}}catch(e){return {}}})();
let stLast=0,stAcc=0,stDone=0;
let stDirty=0;
const stSave=()=>{stDirty=0;LS('tracks-stats',JSON.stringify(ST))};
setInterval(()=>{if(stDirty)stSave()},15000);addEventListener('pagehide',()=>{if(stDirty)stSave()});
au.addEventListener('loadstart',()=>{stLast=0;stAcc=0;stDone=0});
au.addEventListener('timeupdate',()=>{
  if(!cur||au.paused){stLast=0;return}
  const d=au.currentTime-stLast;stLast=au.currentTime;if(d<=0||d>2)return;
  const r=ST[cur]||(ST[cur]={n:0,s:0});r.s+=d;stAcc+=d;stDirty=1;
  if(!stDone&&stAcc>=Math.min(30,(au.duration||60)/2)){stDone=1;r.n++;rotLog(cur)}
});
let slT=null,slEnd=false,slV='0',slI=null,slAlb=null;
const slAlbName=()=>{const a=albums.find(x=>x.id===slAlb);return a?a.name:'this album'};
function sleepSet(v){clearTimeout(slT);slT=null;slEnd=false;slAlb=null;slV=v;
  if(v==='end'){slEnd=true;toast('Stopping after this song')}
  else if(v==='album'){const s=cur&&songById(cur);if(!s||!s.album){slV='0';return toast('Play a song that is in an album first')}slAlb=s.album;toast('Stopping after the last song of '+slAlbName())}
  else if(+v>0){slT=setTimeout(sleepStop,v*60000);toast('Sleep timer: '+v+' min')}else toast('Sleep timer off')}
function sleepStop(){slT=null;slV='0';if(au.paused)return;const v0=au.volume,t0=Date.now();clearInterval(slI);
  slI=setInterval(()=>{const k=Math.min(1,(Date.now()-t0)/6000);au.volume=v0*(1-k);if(k>=1){clearInterval(slI);au.pause();au.volume=v0;renderMini()}},200)}
/* the song that just ended was the last one of the chosen album that is still ahead in the queue */
function slAlbumDone(){
  if(!slAlb)return false;
  const s=cur&&songById(cur);if(!s||s.album!==slAlb)return false;
  const i=queue.indexOf(ctxCur);if(i<0)return true;
  return !queue.slice(i+1).some(id=>{const x=songById(id);return x&&x.album===slAlb})}
async function sleepMenu(){
  const o=[['0','Off'],['15','15 minutes'],['30','30 minutes'],['60','60 minutes'],['end','End of this song'],['album','End of this album']];
  const r=await choose('Sleep timer',o.map(([v,l])=>({label:l,value:v,sel:v===slV,ic:v==='0'?'close':'clock'})));
  if(r)sleepSet(r)}
const _step=step;step=function(d,auto){if(auto&&(slEnd||slAlbumDone())){slEnd=false;slAlb=null;slV='0';au.pause();renderMini();toast('Sleep timer: stopped');return}return _step(d,auto)};
/* ===== Transitions: how one song moves into the next =====
   Off        each song plays to its end
   Gapless    a very short overlap closes the silent gap
   Crossfade  the end of one song fades out while the next fades in (the old song keeps playing on a second player)
   Dip        one song fades out completely, then the next fades in
   Songs can override the fade lengths (Trim &amp; loop), and albums can stay gapless. */
const XCV={
  lin:{n:'Linear',i:k=>k,o:k=>1-k},
  pow:{n:'Equal power',i:k=>Math.sin(k*Math.PI/2),o:k=>Math.cos(k*Math.PI/2)},
  smooth:{n:'Smooth',i:k=>k*k*(3-2*k),o:k=>1-k*k*(3-2*k)}
};
const XST=[['off','Off'],['gap','Gapless'],['cross','Crossfade'],['dip','Dip']];
const XD={st:'off',dur:4,cv:'pow',skip:0,alb:1,sep:0,lo:4,li:4,pf:0,snap:0,pts:null,po:null};
/* custom curves: points joined by a monotone cubic, so the volume never overshoots between points */
let xfVer=0;const xfCC={};
const xfCl0=v=>Math.max(0,Math.min(1,v));
function xfMono(P){
  const n=P.length,x=P.map(q=>q[0]),y=P.map(q=>q[1]),d=[],m=[];
  for(let i=0;i<n-1;i++)d[i]=(y[i+1]-y[i])/(x[i+1]-x[i]);
  m[0]=d[0];m[n-1]=d[n-2];
  for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){
    if(d[i]===0){m[i]=0;m[i+1]=0;continue}
    const a=m[i]/d[i],b=m[i+1]/d[i],q=a*a+b*b;
    if(q>9){const t=3/Math.sqrt(q);m[i]=t*a*d[i];m[i+1]=t*b*d[i]}
  }
  return t=>{
    if(t<=x[0])return y[0];if(t>=x[n-1])return y[n-1];
    let i=0;while(i<n-2&&t>x[i+1])i++;
    const h=x[i+1]-x[i],u=(t-x[i])/h,u2=u*u,u3=u2*u;
    return xfCl0((2*u3-3*u2+1)*y[i]+(u3-2*u2+u)*h*m[i]+(-2*u3+3*u2)*y[i+1]+(u3-u2)*h*m[i+1]);
  };
}
const xfMirror=P=>P.map(q=>[1-q[0],q[1]]).reverse();
const xfSample=(f,n)=>{n=n||7;return Array.from({length:n},(_,i)=>{const t=i/(n-1);return [t,xfCl0(f(t))]})};
function xfNorm(P,out){
  if(!Array.isArray(P)||P.length<2||P.length>16)return null;
  const a=P.map(q=>Array.isArray(q)&&isFinite(q[0])&&isFinite(q[1])?[xfCl0(+q[0]),xfCl0(+q[1])]:null);
  if(a.includes(null))return null;
  a.sort((u,v)=>u[0]-v[0]);a[0][0]=0;a[a.length-1][0]=1;
  a[0][1]=out?1:0;a[a.length-1][1]=out?0:1;
  for(let i=1;i<a.length;i++)if(a[i][0]-a[i-1][0]<.02)return null;
  return a;
}
function xfCust(w){
  const c=xfCC[w];if(c&&c.v===xfVer)return c.f;
  let P=w==='i'?xfS.pts:(xfS.po||(xfS.pts?xfMirror(xfS.pts):null));
  if(!P)P=w==='i'?[[0,0],[1,1]]:[[0,1],[1,0]];
  const f=xfMono(P);xfCC[w]={v:xfVer,f};return f;
}
XCV.custom={n:'Custom',i:k=>xfCust('i')(k),o:k=>xfCust('o')(k)};
const xfS=Object.assign({},XD);
(()=>{try{
  const j=JSON.parse(LS('tracks-xf2')||'null');
  if(j&&typeof j==='object'){
    if(XST.some(x=>x[0]===j.st))xfS.st=j.st;
    if(isFinite(j.dur))xfS.dur=Math.min(12,Math.max(1,+j.dur));
    if(XCV[j.cv])xfS.cv=j.cv;
    if(isFinite(j.skip))xfS.skip=Math.min(5,Math.max(0,+j.skip));
    if(j.alb===0||j.alb===1)xfS.alb=j.alb;
    if(j.sep===1)xfS.sep=1;
    if(isFinite(j.lo))xfS.lo=Math.min(12,Math.max(0,+j.lo));
    if(isFinite(j.li))xfS.li=Math.min(12,Math.max(0,+j.li));
    if(isFinite(j.pf))xfS.pf=Math.min(3,Math.max(0,+j.pf));
    if(j.snap===1)xfS.snap=1;
    const pn=xfNorm(j.pts,false);if(pn)xfS.pts=pn;
    const pq=xfNorm(j.po,true);if(pq)xfS.po=pq;
    if(xfS.cv==='custom'&&!xfS.pts)xfS.cv='pow';
  }else{   /* older versions: Off, Gapless, 3 or 6 seconds */
    const o=LS('tracks-xf');
    if(o==='gap')xfS.st='gap';else if(+o>0){xfS.st='cross';xfS.dur=+o;xfS.cv='lin';xfS.alb=0}
  }
}catch(e){}})();
const xfSave=()=>LS('tracks-xf2',JSON.stringify(xfS));
const xfCl=v=>Math.max(0,Math.min(1,v));
const xfSetVol=g=>{au.volume=xfCl(uvol*g)};
function xfRem(){const D=au.duration;if(!isFinite(D)||D<=0)return Infinity;return((TR?Math.min(TR.b,D):D)-au.currentTime)/(au.playbackRate||1)}
const xfNmGain=()=>(nm.on&&nm.db<0)?Math.pow(10,nm.db/20):1;   /* the old song is not on the normalizer, so it gets the same cut by volume */

/* what plays next, without changing anything (null when it cannot be known, e.g. at the end of a shuffle round) */
function xfPeek(){
  if(!cur||repeat===2)return null;
  let id=null;
  const un=upNext.find(x=>!offSkip(x));
  if(upNext.length&&un)id=un;
  else if(!upNext.length||upNext.every(offSkip)){
    const i=queue.indexOf(ctxCur);
    if(i>=0){for(let j=i+1;j<queue.length;j++)if(!offSkip(queue[j])){id=queue[j];break}
      if(!id&&repeat===1&&!shuffle&&queue.length>1)for(let j=0;j<i;j++)if(!offSkip(queue[j])){id=queue[j];break}}
  }
  return id?(songById(id)||null):null;
}
/* the plan for going from song a to song b: kind, fade-out and fade-in lengths, overlap window, curve */
function xfPlan(a,b){
  if(!a||!b||!b.blob)return null;
  const st=xfS.st;let X=st==='off'?0:xfS.dur,alb=false;
  if(st==='gap')X=.25;
  if(st!=='off'&&st!=='gap'&&xfS.alb&&a.album&&a.album===b.album){X=.25;alb=true}
  const kind=(st==='dip'&&!alb)?'dip':'cross';
  const sp=xfS.sep&&(st==='cross'||st==='dip')&&!alb;
  let out=a.xo!=null?+a.xo:(sp?xfS.lo:X),inn=b.xi!=null?+b.xi:(sp?xfS.li:X);
  const la=effDur(a),lb=effDur(b);
  if(la)out=Math.min(out,Math.max(0,la/2-1));
  if(lb)inn=Math.min(inn,Math.max(0,lb/2-1));
  if(!(out>0||inn>0))return null;
  return {kind,out,inn,W:kind==='cross'?Math.max(out,inn):0,cv:(st==='gap'||alb)?'pow':xfS.cv};
}
const xfLead=p=>!p?0:(p.kind==='cross'?p.W:p.out);

/* second player: holds the end of the song that is fading out */
function xfGhost(s){const g=new Audio();try{if(OUT.id&&g.setSinkId)g.setSinkId(OUT.id).catch(()=>{})}catch(_){}g.preload='auto';g.src=URL.createObjectURL(s.blob);g.volume=0;return g}
function xfPre(s){if(!s||!s.blob||XF.preId===s.id)return;xfDropPre();XF.pre=xfGhost(s);XF.preId=s.id;try{XF.pre.load()}catch(_){}}
function xfDropPre(){const g=XF.pre;XF.pre=null;XF.preId=null;if(g){try{g.pause();URL.revokeObjectURL(g.src);g.removeAttribute('src')}catch(_){}}}
function xfDropGhost(){clearInterval(XF.iv);XF.iv=0;XF.live=0;const g=XF.g;XF.g=null;XF.gp=0;if(g){try{g.pause();URL.revokeObjectURL(g.src);g.removeAttribute('src')}catch(_){}}}
function xfKill(){clearInterval(XF.ov);XF.ov=0;clearInterval(XF.inr);XF.inr=0;xfDropGhost()}

/* watching the song that is playing; runs on every time update */
function xfWatch(){
  if(!cur||restoring||au.paused||XF.mid||LP.busy)return;
  const D=au.duration;if(!isFinite(D)||D<=0)return;
  if(TR&&!XF.ended&&au.currentTime>=Math.min(TR.b,D)-.03)return xfEnd1();   /* reached the trimmed end */
  if(XF.arm===2)return;
  if(lpPending())return;   /* a section loop is still due: no fade into the next song yet */
  const rem=xfRem();if(rem>14)return;
  if(XF.arm===0){
    const s=songById(cur),b=(slEnd||slAlbumDone())?null:xfPeek(),pl=b?xfPlan(s,b):null;
    if(!pl&&!TR)return;   /* nothing special: the browser's own "ended" does the job */
    const lead=xfLead(pl);if(rem>lead+1.4)return;
    XF.arm=1;XF.id=cur;XF.pl=pl;
    if(pl&&pl.kind==='cross')xfPre(s);   /* the second player loads now, so it can start the instant it is needed */
    clearTimeout(XF.tm);XF.tm=setTimeout(xfAt,Math.max(0,(rem-lead)*1000));
    return;
  }
  if(rem<=xfLead(XF.pl)+.05)xfAt();   /* timers can run late in the background; the next time update catches up */
}
/* the trimmed end was reached: go on, or stop if there is nothing next */
function xfEnd1(){
  if(XF.ended)return;XF.ended=1;XF.arm=2;clearTimeout(XF.tm);
  const id=cur;step(1,true);
  if(cur===id&&au.readyState>0&&TR&&au.currentTime>=TR.b-1){au.pause();vSeek(0);renderMini()}
}
function xfAt(){
  clearTimeout(XF.tm);
  const id=XF.id,pl=XF.pl;
  if(cur!==id||au.paused||XF.arm!==1){if(XF.arm===1)XF.arm=0;return}
  const rem=xfRem(),lead=xfLead(pl);
  if(rem>lead+.4){XF.arm=0;return}   /* you seeked back: look again later */
  XF.arm=2;
  if(!pl)return xfEnd1();
  const s=songById(id),b=xfPeek();
  if(!s||!b||!b.blob){if(TR)xfEnd1();return}
  if(pl.kind==='dip')return xfDip(id,pl);
  if(rem<.8){if(TR)xfEnd1();return}   /* too late for a fade */
  const W=Math.min(pl.W,rem-.1);
  xfLaunch(s,{kind:'cross',W,out:Math.min(pl.out,W),inn:Math.min(pl.inn,W),cv:pl.cv},()=>step(1,true));
}
/* Dip: the volume follows the song's own position, so seeking during the fade behaves */
function xfDip(id,pl){
  clearInterval(XF.ov);
  const tick=()=>{
    if(cur!==id){clearInterval(XF.ov);XF.ov=0;return}
    if(au.paused)return;
    const rem=xfRem(),cv=XCV[pl.cv]||XCV.pow;
    if(pl.out>0&&rem<=pl.out)xfSetVol(cv.o(xfCl(1-rem/pl.out)));else xfSetVol(1);
    if(rem<=pl.out+.6)XF.pend={len:pl.inn,cv:pl.cv,t:performance.now(),ttl:3500};   /* the next song fades in */
    if(rem<=.02){clearInterval(XF.ov);XF.ov=0}
  };
  XF.ov=setInterval(tick,30);tick();
}
/* Crossfade: the second player carries the old song while the main player starts the next one */
async function xfLaunch(s0,pl,advance){
  const id0=cur,cv=XCV[pl.cv]||XCV.pow;
  const g=(XF.pre&&XF.preId===s0.id)?XF.pre:xfGhost(s0);XF.pre=null;XF.preId=null;
  xfDropGhost();XF.g=g;XF.gp=0;
  const gn=xfNmGain();
  try{g.currentTime=Math.max(0,Math.min(au.currentTime+.05,(isFinite(au.duration)?au.duration:1e9)-.05))}catch(_){}
  g.volume=xfCl(uvol*gn);
  await new Promise(r=>{let d=0;const f=()=>{if(!d){d=1;r()}};g.addEventListener('playing',f,{once:true});setTimeout(f,260);g.play().catch(f)});
  if(XF.g!==g||cur!==id0||au.paused||au.ended||g.paused){if(XF.g===g)xfDropGhost();xfSetVol(1);return}   /* the second player did not start: let the song end on its own */
  XF.mid=1;let ok=false;
  try{xfSetVol(0);advance();ok=cur!==id0}catch(e){}finally{XF.mid=0}
  if(!ok){xfDropGhost();xfSetVol(1);return}
  XF.live=1;let el=0,last=performance.now();
  const tick=()=>{
    const n=performance.now();if(!au.paused)el+=(n-last)/1000;last=n;
    const gi=pl.inn>0?cv.i(xfCl(el/pl.inn)):1,go=pl.out>0?cv.o(xfCl((el-(pl.W-pl.out))/pl.out)):1;
    xfSetVol(gi);g.volume=xfCl(uvol*gn*go);
    if(el>=pl.W-.02&&el>=pl.inn-.02){xfDropGhost();xfSetVol(1)}
  };
  XF.iv=setInterval(tick,30);tick();
}
/* Next / Previous with a short fade (the "On skip" setting) */
function xfManual(d,base){
  const s0=songById(cur),W=Math.min(xfS.skip,xfRem()-.3);
  if(!s0||!s0.blob||!(W>=.3))return base(d,false);
  xfLaunch(s0,{kind:'cross',W,out:W,inn:W,cv:xfS.cv},()=>base(d,false));
}
/* a new song starts (not through the crossfade above): clear leftovers, and fade it in after a Dip */
function xfStart(){
  if(XF.mid)return;
  xfKill();xfSetVol(1);
  const p=XF.pend;XF.pend=null;
  if(p&&performance.now()-p.t<p.ttl&&p.len>0)xfFadeIn(p.len,p.cv);
}
function xfFadeIn(len,key){
  const cv=XCV[key]||XCV.pow;let el=0,last=performance.now();
  xfSetVol(0);
  XF.inr=setInterval(()=>{
    const n=performance.now();if(!au.paused)el+=(n-last)/1000;last=n;
    const k=xfCl(el/len);xfSetVol(cv.i(k));
    if(k>=1){clearInterval(XF.inr);XF.inr=0;xfSetVol(1)}
  },30);
}
function xfTest(){
  const s=songById(cur);
  if(!s||!(au.duration>0))return toast('Play a song first, then test');
  const b=xfPeek();if(!b)return toast('Add a next song to the queue to test');
  const pl=xfPlan(s,b);if(!pl)return toast('Transitions are off');
  const end=TR?TR.b:au.duration;
  try{au.currentTime=Math.max(vA(),end-xfLead(pl)-4)}catch(_){}
  if(au.paused)au.play().catch(()=>{});
  toast('Jumped to the end of this song');
}
/* pause and resume with a short fade (the "Pause fade" setting) */
function xfTogglePlay(){
  if(!cur)return;
  if(XF.pz){clearInterval(XF.pz);XF.pz=0;xfSetVol(1);return}   /* pressed again while fading out: carry on playing */
  if(au.paused){au.play().catch(()=>{});return}
  const len=xfS.pf;
  if(!(len>0)||XF.live||XF.ov||XF.inr||XF.mid){au.pause();return}
  const id=cur,cv=XCV[xfS.cv]||XCV.pow;let el=0,last=performance.now();
  XF.pz=setInterval(()=>{
    const n=performance.now();el+=(n-last)/1000;last=n;
    if(cur!==id||au.paused){clearInterval(XF.pz);XF.pz=0;xfSetVol(1);return}
    const k=xfCl(el/len);xfSetVol(cv.o(k));
    if(k>=1){clearInterval(XF.pz);XF.pz=0;au.pause();xfSetVol(1)}
  },30);
}
au.addEventListener('play',()=>{
  if(!(xfS.pf>0)||XF.live||XF.ov||XF.inr||XF.mid||XF.pz||au.currentTime<.4)return;
  xfFadeIn(xfS.pf,xfS.cv);
});
au.addEventListener('loadstart',()=>{if(XF.pz){clearInterval(XF.pz);XF.pz=0}XF.arm=0;XF.ended=0;clearTimeout(XF.tm);if(XF.preId&&XF.preId!==cur)xfDropPre()});
au.addEventListener('timeupdate',xfWatch);
au.addEventListener('pause',()=>{const g=XF.g;if(g&&!g.paused){g.pause();XF.gp=1}});
au.addEventListener('play',()=>{
  const g=XF.g;if(g&&XF.gp){XF.gp=0;g.play().catch(()=>{});return}
  if(!XF.live&&!XF.ov&&!XF.inr&&!XF.mid&&uvol>0&&Math.abs(au.volume-uvol)>.001)au.volume=uvol;   /* never stay silent after a fade */
});
const _stepX=step;
step=function(d,auto){
  if(!auto&&xfS.skip>0&&cur&&!au.paused&&!XF.mid&&!XF.live)return xfManual(d,_stepX);
  return _stepX(d,auto);
};
/* ===== Transitions sheet ===== */
const xfSummary=()=>{const o=xfS;if(o.st==='off')return 'Off';if(o.st==='gap')return 'Gapless';return (o.st==='cross'?'Crossfade':'Dip')+' \u00b7 '+(o.sep?o.lo+' / '+o.li:o.dur)+' s'+(o.cv==='custom'?' \u00b7 Custom curve':'')};
/* the curve editor canvas: both curves, the one being edited drawn strong, handles when the curve is custom */
function xfDraw(c,o,tab,pv,hot){
  const r=window.devicePixelRatio||1,w=c.clientWidth||300,h=c.clientHeight||176;
  if(c.width!==Math.round(w*r)||c.height!==Math.round(h*r)){c.width=Math.round(w*r);c.height=Math.round(h*r)}
  const x=c.getContext('2d');x.setTransform(r,0,0,r,0,0);x.clearRect(0,0,w,h);
  const P=14,X=t=>P+t*(w-2*P),Y=v=>h-P-v*(h-2*P),cv=XCV[o.cv]||XCV.pow,col=getComputedStyle(c).color;
  x.lineWidth=1;x.strokeStyle='rgba(128,128,128,.22)';x.beginPath();
  for(let i=0;i<=4;i++){const t=i/4;x.moveTo(X(t),Y(0));x.lineTo(X(t),Y(1));x.moveTo(X(0),Y(t));x.lineTo(X(1),Y(t))}
  x.stroke();
  const line=(f,al,lw)=>{x.globalAlpha=al;x.strokeStyle=col;x.lineWidth=lw;x.lineJoin='round';x.lineCap='round';x.beginPath();
    for(let i=0;i<=90;i++){const t=i/90,px=X(t),py=Y(f(t));i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();x.globalAlpha=1};
  const ed=tab==='o'?'o':'i';
  line(ed==='i'?cv.o:cv.i,.3,2);line(ed==='i'?cv.i:cv.o,1,3);
  if(o.cv==='custom'){
    const Pt=ed==='i'?o.pts:(o.po||xfMirror(o.pts)),can=ed==='i'||!!o.po;
    if(Pt)Pt.forEach((q,i)=>{
      const end=i===0||i===Pt.length-1,rad=i===hot?9:7;
      x.beginPath();x.arc(X(q[0]),Y(q[1]),rad,0,Math.PI*2);
      x.globalAlpha=can?1:.4;
      x.fillStyle=end?getComputedStyle(document.documentElement).getPropertyValue('--bg')||'#000':col;x.fill();
      x.lineWidth=2.5;x.strokeStyle=col;x.stroke();x.globalAlpha=1;
    });
  }
  if(pv!=null){
    x.strokeStyle='rgba(128,128,128,.7)';x.lineWidth=1;x.beginPath();x.moveTo(X(pv),Y(0));x.lineTo(X(pv),Y(1));x.stroke();
    [cv.i(pv),cv.o(pv)].forEach(v=>{x.beginPath();x.arc(X(pv),Y(v),5,0,Math.PI*2);x.fillStyle=col;x.fill()});
  }
}
function xfSheet(){
  const o=xfS,DESC={
    off:'Each song plays to its end, then the next one starts.',
    gap:'Closes the silent gap between songs with a very short overlap.',
    cross:'The end of one song fades out while the next one fades in.',
    dip:'One song fades out completely, then the next one fades in.'};
  const SH=[['Linear',k=>k],['Slow start',k=>k*k],['Fast start',k=>1-(1-k)*(1-k)],['Late swell',k=>k*k*k],['S curve',k=>k*k*k*(k*(k*6-15)+10)]];
  const fop=(k,lb,mn,mx,st)=>`<div class="fop" data-k="${k}"><span>${lb}</span><input type="range" class="rng" min="${mn}" max="${mx}" step="${st}" aria-label="${lb}"><b></b><button type="button" class="rsb" data-r="${k}" aria-label="Reset ${lb}" title="Reset to default">${ic('rst',16)}</button></div>`;
  const swr=(k,t,sm)=>`<button type="button" class="srow" data-sw="${k}" role="switch" aria-checked="false"><span class="st"><b>${t}</b>${sm?`<small>${sm}</small>`:''}</span><span class="stog"></span></button>`;
  openOv(`<h3>Transitions</h3><p class="dupn" id="xf-ds"></p>
  <div class="scd"><h4>Style</h4><div class="bgst" id="xf-st">${XST.map(x=>`<button type="button" class="chip" data-s="${x[0]}">${x[1]}</button>`).join('')}</div></div>
  <div class="scd bgs" id="xf-c1"><h4>Length</h4>${fop('dur','Length',1,12,.5)}${fop('lo','Fade out',0,12,.5)}${fop('li','Fade in',0,12,.5)}${swr('sep','Different fade out and fade in','Set the end of one song and the start of the next separately')}</div>
  <div class="scd" id="xf-c2"><h4>Curve</h4><div class="bgst" id="xf-cv">${Object.keys(XCV).map(k=>`<button type="button" class="chip" data-c="${k}">${XCV[k].n}</button>`).join('')}</div>
    <div class="bgst" id="xf-tb" style="margin-top:10px"><button type="button" class="chip" data-e="i">Next song in</button><button type="button" class="chip" data-e="o">Current song out</button></div>
    <canvas class="xed" id="xf-ed" aria-label="Fade curve editor. Horizontal is time through the fade, vertical is volume."></canvas>
    <div class="xro" id="xf-ro"></div><p class="dupn" id="xf-hn" style="margin:0 2px 8px"></p>
    <div id="xf-cu"><div class="bgst" id="xf-sh">${SH.map((q,i)=>`<button type="button" class="chip" data-h="${i}">${q[0]}</button>`).join('')}</div>
      ${swr('mirror','Fade out mirrors fade in','Turn off to draw the fade out on its own')}${swr('snap','Snap to grid','Points jump to eighths')}</div>
    <div class="bt" style="margin-top:10px"><button type="button" class="pill" id="xf-pv">Preview</button></div></div>
  <div class="scd bgs" id="xf-c3"><h4>Skipping and pausing</h4>${fop('skip','On skip',0,5,.5)}${fop('pf','Pause fade',0,3,.1)}<p class="dupn" style="margin:4px 2px 0">On skip fades when you tap next or previous. Pause fade softens pausing and resuming. Both work with any style.</p></div>
  <div class="scd" id="xf-aw">${swr('alb','Keep albums gapless','No fade between songs from the same album')}</div>
  
  <div class="bt"><button class="pill mr" id="xf-rs">Reset</button><button class="pill" id="xf-t">Test</button><button class="pill acc" id="xf-d">Done</button></div>`);
  const sh=$('#ov .sheet'),cc=$('#xf-ed');
  let tab='i',drag=-1,hit0=-1,t0=0,pvRaf=0;
  const mirrored=()=>!o.po;
  const cur=()=>tab==='o'&&o.po?o.po:o.pts;
  const draw=(h)=>xfDraw(cc,o,tab,null,h);
  const toCustom=fresh=>{
    if(o.cv==='custom')return;
    if(fresh||!o.pts){const f=XCV[o.cv]||XCV.pow;o.pts=xfSample(f.i);o.po=null}
    o.cv='custom';xfVer++;
  };
  const paint=()=>{
    const fade=o.st==='cross'||o.st==='dip',cu=o.cv==='custom';
    $('#xf-ds').textContent=DESC[o.st];
    sh.querySelectorAll('#xf-st .chip').forEach(c=>c.classList.toggle('on',c.dataset.s===o.st));
    sh.querySelectorAll('#xf-cv .chip').forEach(c=>c.classList.toggle('on',c.dataset.c===o.cv));
    $('#xf-c1').hidden=!fade;$('#xf-c2').hidden=!fade;$('#xf-aw').hidden=o.st==='off';
    if(cu&&mirrored())tab='i';
    sh.querySelectorAll('#xf-tb .chip').forEach(c=>{c.hidden=!cu||(c.dataset.e==='o'&&mirrored());c.classList.toggle('on',c.dataset.e===tab)});
    $('#xf-tb').hidden=!cu||mirrored();
    $('#xf-cu').hidden=!cu;
    $('#xf-pv').parentNode.style.justifyContent='flex-start';
    sh.querySelectorAll('[data-sw]').forEach(b=>{const k=b.dataset.sw,v=k==='mirror'?mirrored():!!o[k];b.setAttribute('aria-checked',v?'true':'false')});
    sh.querySelectorAll('.fop').forEach(el=>{
      const k=el.dataset.k,inp=el.querySelector('input'),v=o[k],mn=+inp.min,mx=+inp.max;
      el.hidden=(k==='dur'&&!!o.sep)||((k==='lo'||k==='li')&&!o.sep);
      inp.value=v;inp.style.setProperty('--p',((v-mn)/(mx-mn)*100)+'%');
      el.querySelector('b').textContent=((k==='skip'||k==='pf')&&v===0)?'Off':(Math.round(v*10)/10)+' s';
      el.classList.toggle('dflt',v===XD[k]);
    });
    $('#xf-hn').textContent=!cu?'Tap or drag on the curve to edit it freely.':(tab==='o'&&!o.po)?'':'Drag a point to shape the curve. Tap empty space to add one, double tap a point to remove it.';
    draw();
  };
  const geo=()=>{const w=cc.clientWidth,h=cc.clientHeight,P=14;return{w,h,P,X:t=>P+t*(w-2*P),Y:v=>h-P-v*(h-2*P)}};
  const pos=e=>{const g=geo(),rc=cc.getBoundingClientRect(),px=e.clientX-rc.left,py=e.clientY-rc.top;return{px,py,t:xfCl0((px-g.P)/(g.w-2*g.P)),v:xfCl0((g.h-g.P-py)/(g.h-2*g.P)),g}};
  const roTxt=(t,v)=>{$('#xf-ro').textContent=t==null?'':'Time '+Math.round(t*100)+'%   Volume '+Math.round(v*100)+'%'};
  const stopPv=()=>{cancelAnimationFrame(pvRaf);pvRaf=0};
  cc.onpointerdown=e=>{
    stopPv();
    if(tab==='o'&&!o.po)return;
    if(o.cv!=='custom'){toCustom(true);tab='i';paint()}
    const P0=cur(),q=pos(e);let hit=-1,bd=22;
    P0.forEach((p,i)=>{const d=Math.hypot(q.g.X(p[0])-q.px,q.g.Y(p[1])-q.py);if(d<bd){bd=d;hit=i}});
    const now=performance.now();
    if(hit===0||(hit>0&&hit===P0.length-1))return;
    if(hit>0){
      if(hit0===hit&&now-t0<350){P0.splice(hit,1);hit0=-1;xfVer++;xfSave();paint();paint();return}
      hit0=hit;t0=now;drag=hit;
    }else{
      if(P0.length>=14)return;
      let t=q.t,v=q.v;if(o.snap){t=Math.round(t*8)/8;v=Math.round(v*8)/8}
      let j=0;while(j<P0.length-1&&P0[j+1][0]<t)j++;
      if(t-P0[j][0]<.04||P0[j+1][0]-t<.04)return;
      P0.splice(j+1,0,[t,v]);drag=j+1;hit0=drag;t0=now;xfVer++;
    }
    cc.setPointerCapture(e.pointerId);e.preventDefault();
    const p=P0[drag];roTxt(p[0],p[1]);draw(drag);
  };
  cc.onpointermove=e=>{
    if(drag<0)return;
    const P0=cur(),q=pos(e);let t=q.t,v=q.v;
    if(o.snap){t=Math.round(t*8)/8;v=Math.round(v*8)/8}
    t=Math.min(P0[drag+1][0]-.03,Math.max(P0[drag-1][0]+.03,t));
    P0[drag]=[t,xfCl0(v)];xfVer++;roTxt(t,xfCl0(v));draw(drag);
  };
  const up=()=>{if(drag<0)return;drag=-1;xfSave();roTxt(null);draw()};
  cc.onpointerup=up;cc.onpointercancel=up;
  sh.addEventListener('click',e=>{
    const t=e.target;let b;
    if(b=t.closest('#xf-st .chip')){o.st=b.dataset.s;xfSave();return paint()}
    if(b=t.closest('#xf-cv .chip')){const k=b.dataset.c;if(k==='custom')toCustom(false);else{o.cv=k;xfVer++}xfSave();return paint()}
    if(b=t.closest('#xf-tb .chip')){tab=b.dataset.e;return paint()}
    if(b=t.closest('#xf-sh .chip')){
      const f=SH[+b.dataset.h][1];
      if(tab==='o'&&o.po)o.po=xfSample(k=>f(1-k)).map(q=>[q[0],q[1]]);
      else{o.pts=xfSample(f,9);if(tab==='i'&&mirrored())o.po=null}
      xfVer++;xfSave();return paint();
    }
    if(b=t.closest('[data-sw]')){
      const k=b.dataset.sw;
      if(k==='mirror'){if(o.po){o.po=null;tab='i'}else o.po=xfMirror(o.pts||xfSample(XCV.pow.i));xfVer++}
      else o[k]=o[k]?0:1;
      xfSave();return paint();
    }
    if(b=t.closest('.rsb')){o[b.dataset.r]=XD[b.dataset.r];xfSave();return paint()}
    if(t.closest('#xf-pv')){
      stopPv();
      const len=Math.max(1.2,Math.min(8,o.sep?Math.max(o.lo,o.li):o.dur)),st=performance.now();
      const f=n=>{if(!cc.isConnected)return;const k=Math.min(1,(n-st)/(len*1000));xfDraw(cc,o,tab,k);if(k<1)pvRaf=requestAnimationFrame(f);else{pvRaf=0;setTimeout(draw,600)}};
      pvRaf=requestAnimationFrame(f);return;
    }
  });
  sh.addEventListener('input',e=>{const el=e.target.closest('.fop');if(!el||e.target.type!=='range')return;o[el.dataset.k]=+e.target.value;xfSave();paint()});
  $('#xf-rs').onclick=()=>{Object.assign(o,XD);xfVer++;tab='i';xfSave();paint()};
  $('#xf-t').onclick=()=>{closeOv();xfTest()};
  $('#xf-d').onclick=()=>closeOv();
  $('#ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
  paint();
  setTimeout(draw,420);   /* the sheet is still sliding in on the first paint, so the canvas gets measured again once it has settled */
}


/* ===== END 14-transitions.js ===== */
