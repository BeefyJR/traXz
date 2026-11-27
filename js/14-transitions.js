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

