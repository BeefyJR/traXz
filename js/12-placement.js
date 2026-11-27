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

