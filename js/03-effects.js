/* beat effects (big player): bounce, squash, glow, ripple and bars, driven by the audio. All of them grow from the cover centre, so the result stays symmetric */
const FXL=[['bounce','Bounce'],['squash','Squash'],['glow','Glow'],['ripple','Ripple'],['bars','Bars']];
/* quick picks: each one is a list of [low Hz, high Hz] bands */
const FXB=[['sub','Sub 808',[[20,110]]],['kick','Kick',[[40,120]]],['bass','Bass',[[43,300]]],['vox','Vocals',[[300,3400]]],['snare','Snare',[[150,300],[2500,6000]]],['hat','Hi-hats',[[6000,16000]]],['full','Full range',[[43,13000]]]];
/* old single-band names from earlier versions, only used to carry saved settings over */
const FXBAND={sub:[20,110],bass:[43,300],mid:[300,2700],treble:[2700,13000],full:[43,13000]};
const FXMAXB=5,FXMIN=20,FXMAX=20000,FXBC=['#b57bee','#ee7bb5','#f0a35e','#d6dc5e','#5fdc9c'];
/* a band is {lo,hi,g,on}: edges in Hz, weight 0-150 %, on/off. Keeps at least a quarter octave of width */
function fxClampBand(b){
  let lo=Math.min(FXMAX,Math.max(FXMIN,+b.lo)),hi=Math.min(FXMAX,Math.max(FXMIN,+b.hi));
  if(lo>hi){const t=lo;lo=hi;hi=t}
  if(hi/lo<1.19){const c=Math.sqrt(lo*hi);lo=c/1.0905;hi=c*1.0905;if(lo<FXMIN){lo=FXMIN;hi=lo*1.19}if(hi>FXMAX){hi=FXMAX;lo=hi/1.19}}
  return {lo,hi,g:Math.min(150,Math.max(0,isFinite(b.g)?+b.g:100)),on:b.on===0?0:1};
}
const FXR=[['amt','Intensity',0,100,'%'],['sens','Sensitivity',0,100,'%'],['smo','Smoothness',0,95,'%'],['rch','Reach',0,100,'%'],['lag','Sync lead',0,200,'ms']];
const FXD={on:1,e:{bounce:1,squash:0,glow:1,ripple:0,bars:0},bands:[{lo:43,hi:300,g:100,on:1}],mode:'beat',col:'cover',amt:50,sens:50,smo:55,rch:50,lag:40};
const fxS=JSON.parse(JSON.stringify(FXD));
try{const j=JSON.parse(localStorage.getItem('tracks-fx')||'null');if(j&&typeof j==='object'){
  if(j.on===0||j.on===1)fxS.on=j.on;
  if(j.e&&typeof j.e==='object')FXL.forEach(x=>{if(j.e[x[0]]===0||j.e[x[0]]===1)fxS.e[x[0]]=j.e[x[0]]});
  if(Array.isArray(j.bands)){const b=j.bands.filter(x=>x&&isFinite(x.lo)&&isFinite(x.hi)).slice(0,FXMAXB).map(fxClampBand);if(b.length)fxS.bands=b}
  else if(FXBAND[j.band])fxS.bands=[fxClampBand({lo:FXBAND[j.band][0],hi:FXBAND[j.band][1],g:100,on:1})];
  if(j.mode==='beat'||j.mode==='level')fxS.mode=j.mode;
  if(j.col==='cover'||j.col==='white')fxS.col=j.col;
  FXR.forEach(r=>{const v=j[r[0]];if(typeof v==='number'&&isFinite(v))fxS[r[0]]=Math.min(r[3],Math.max(r[2],v))})}}catch(e){}
/* audio graph is only built once an effect is switched on and a song plays, so the player behaves as before until then */
let fxAC=null,fxGain=null,fxAN=null,fxAS=null,fxCH=[],fxBuf=null,fxDly=null,fxKey='',fxLagCur=-1,fxOK=true,fxRaf=0,fxPrev=0,fxSel=0,fxEd=null;
function fxGraph(){
  if(fxAN)return true;if(!fxOK)return false;
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C){fxOK=false;return false}
    fxAC=new C({latencyHint:'interactive'});try{if(OUT.id&&fxAC.setSinkId)fxAC.setSinkId(OUT.id).catch(()=>{})}catch(_){}const src=fxAC.createMediaElementSource(au);
    fxAN=fxAC.createAnalyser();fxAN.fftSize=2048;fxAN.smoothingTimeConstant=0;   /* spectrum, for the bars; no built-in smoothing so nothing lags */
    fxAS=fxAC.createAnalyser();fxAS.fftSize=8192;fxAS.smoothingTimeConstant=.72; /* fine, smoothed spectrum, only drawn in the frequency picker */
    fxDly=fxAC.createDelay(.5);fxGain=fxAC.createGain();   /* fxGain = volume normalization */
    src.connect(fxAN);src.connect(fxAS);
    /* one filtered channel per band: 24 dB/oct high-pass + low-pass, then a small analyser reading its level (much faster than an FFT) */
    for(let i=0;i<FXMAXB;i++){
      const f=['highpass','highpass','lowpass','lowpass'].map(ty=>{const n=fxAC.createBiquadFilter();n.type=ty;n.Q.value=.7071;return n});
      const an=fxAC.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=0;
      src.connect(f[0]);f[0].connect(f[1]);f[1].connect(f[2]);f[2].connect(f[3]);f[3].connect(an);
      fxCH.push({f,a:an,td:new Float32Array(1024),n:1024});
    }
    src.connect(fxDly);fxDly.connect(fxGain);fxGain.connect(fxAC.destination);   /* the sound is held back a few ms so the picture lands on the hit */
    fxBuf=new Uint8Array(fxAN.frequencyBinCount);
    fxAC.onstatechange=()=>{if(fxAC.state!=='running'&&!au.paused)fxAC.resume().catch(()=>{})};
  }catch(e){fxOK=false;fxAN=null}
  return !!fxAN;
}
/* filters follow the bands; low bands need a longer window to see a full wave */
function fxBandsSet(){
  const key=fxS.bands.map(b=>b.lo.toFixed(1)+'-'+b.hi.toFixed(1)).join('|');if(key===fxKey)return;fxKey=key;
  const nyq=fxAC.sampleRate/2*.92;
  fxS.bands.forEach((b,i)=>{
    const c=fxCH[i];if(!c)return;
    const lo=Math.min(nyq*.9,b.lo),hi=Math.min(nyq,Math.max(lo*1.1,b.hi));
    c.f[0].frequency.value=lo;c.f[1].frequency.value=lo;c.f[2].frequency.value=hi;c.f[3].frequency.value=hi;
    const n=lo<30?2048:lo<150?1024:512;if(n!==c.n){c.n=n;c.a.fftSize=n;c.td=new Float32Array(n)}
  });
}
function fxLagSet(){
  const v=fxS.on?fxS.lag:0;if(v===fxLagCur)return;fxLagCur=v;
  try{fxDly.delayTime.setTargetAtTime(v/1000,fxAC.currentTime,.015)}catch(e){fxDly.delayTime.value=v/1000}
}
const fxPE={bounce:0,squash:0,glow:0,ripple:0,bars:0};
const fxDemoBuf=new Uint8Array(512);
function fxDemo(now){
  const t=now/1000,b=t%.55,kick=Math.exp(-b*8),hat=Math.exp(-((t+.275)%.55)*14);
  for(let i=0;i<512;i++){
    const v=kick*Math.exp(-i/9)+hat*(i>30?Math.exp(-i/260)*.8:0)*.7+.12*Math.exp(-i/80)*(.6+.4*Math.sin(t*3+i/9));
    fxDemoBuf[i]=Math.max(0,Math.min(1,v))*255;
  }
  return fxDemoBuf;
}
/* targets: the big player cover, plus the preview inside the settings sheet */
const fxT=[
  {id:'main',demo:false,get:()=>{const f=$('#full');if(!f||!f.classList.contains('open'))return null;const h=$('#fc .fcv');return h?{host:h,cov:h.querySelector('.cov')}:null}},
  {id:'prev',demo:true,get:()=>{const h=$('#fxpv');return h?{host:h,cov:h.querySelector('.cov')}:null}}
];
fxT.forEach(t=>{t.env=0;t.slow=0;t.pk=.3;t.bs=[];t.bpk=.3;t.raw=null;t.rings=[];t.lastR=0;t.bars=new Float32Array(64);t.dirty=false});
function fxColor(){
  if(fxS.col==='white')return '255,255,255';
  const s=songById(cur);let c=null;try{c=s&&accent(s)}catch(e){}
  return (c&&c.length>=3)?c.slice(0,3).join(','):'255,255,255';
}
function fxReset(t,r){
  if(r&&r.cov){r.cov.style.scale='';r.cov.style.boxShadow=''}
  if(r&&r.host){const c=r.host.querySelector(':scope>.fxcv');if(c){const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height)}}
  t.env=0;t.rings.length=0;t.dirty=false;
}
function fxFrame(t,r,spec,dt,now,col,bw,lv){
  const o=fxS,amt=o.amt/100,cov=r.cov;if(!cov)return false;
  let E=o.e;if(PERF.f.beat){fxPE.bounce=E.bounce;fxPE.squash=E.squash;E=fxPE}/* performance mode: no glow, ripple or bars */
  const W=cov.offsetWidth,H=cov.offsetHeight;/* measured before anything is written, so the browser does not lay out twice per frame */
  let v=0;
  if(spec){
    /* every band is read and shaped on its own (so a quiet hi-hat band still reacts), scaled by its weight; the strongest one drives the cover */
    let vm=0;
    o.bands.forEach((B,i)=>{
      const q=t.bs[i]||(t.bs[i]={pk:.3,slow:0,v:0});
      if(!B.on){q.v=0;return}
      let x0;
      if(lv)x0=lv[i];
      else{const lo=Math.max(1,Math.round(B.lo/bw)),hi=Math.min(spec.length,Math.max(lo+1,Math.round(B.hi/bw)));let sum=0;for(let k=lo;k<hi;k++)sum+=spec[k];x0=sum/((hi-lo)*255)}
      q.pk=Math.max(x0,q.pk*(1-dt*.2),.12);
      let x=Math.min(1,x0/q.pk);
      const th=.6*(1-o.sens/100);x=Math.max(0,Math.min(1,(x-th)/(1-th)));
      let vi;
      if(o.mode==='beat'){vi=Math.max(0,Math.min(1,(x-q.slow)*3.5));q.slow+=(x-q.slow)*Math.min(1,dt*12)}   /* short baseline (~80 ms) so a hit that lands on a ringing 808 tail still counts as a new hit */
      else{vi=x;q.slow=x}
      q.v=vi;vm=Math.max(vm,Math.min(1,vi*B.g/100));
    });
    v=vm;t.v=v;
  }
  const rel=o.mode==='beat'?.03+o.smo/100*.28:.04+o.smo/100*.5,k=1-Math.exp(-dt/(v>t.env?.012:rel));
  t.env+=(v-t.env)*k;
  const env=t.env;
  /* scale, bounce and squash both pivot on the centre */
  let sx=1,sy=1;
  if(E.bounce){const g=1+env*amt*.16;sx*=g;sy*=g}
  if(E.squash){sx*=1+env*amt*.12;sy*=1-env*amt*.08}
  cov.style.scale=(E.bounce||E.squash)?(sx.toFixed(4)+' '+sy.toFixed(4)):'';
  cov.style.boxShadow=E.glow?('0 22px 50px rgba(0,0,0,.45),0 0 '+(18+env*90*amt).toFixed(1)+'px '+(env*26*amt).toFixed(1)+'px rgba('+col+','+(.12+env*.75*Math.max(.35,amt)).toFixed(3)+')'):'';
  /* canvas layer: ripple + bars */
  const host=r.host;
  let cv=host.querySelector(':scope>.fxcv');
  const need=E.ripple||E.bars;
  if(!need){if(cv){const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height)}t.rings.length=0}
  else{
    if(!cv){cv=document.createElement('canvas');cv.className='fxcv';host.insertBefore(cv,host.firstChild)}
    const big=host.classList.contains('fcv'),d=Math.min(2,window.devicePixelRatio||1),cw=big?window.innerWidth:host.clientWidth,ch=big?window.innerHeight:host.clientHeight;
    let ox=0,oy=0;if(big){const hr=host.getBoundingClientRect();ox=hr.left;oy=hr.top;cv.style.width=cw+'px';cv.style.height=ch+'px'}
    if(cv.width!==Math.round(cw*d)||cv.height!==Math.round(ch*d)){cv.width=Math.round(cw*d);cv.height=Math.round(ch*d)}
    const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,cw,ch);
    const cx=ox+cov.offsetLeft+W/2,cy=oy+cov.offsetTop+H/2,hw=W*sx/2,hh=H*sy/2,rad=(t.radEl===cov&&t.radW===W)?t.rad:(t.radEl=cov,t.radW=W,t.rad=parseFloat(getComputedStyle(cov).borderTopLeftRadius)||12);
    const reach=o.rch/100,room=Math.max(8,Math.min(cx-hw,cw-cx-hw,cy-hh,ch-cy-hh));
    if(E.ripple){
      if(spec&&v>.45&&now-t.lastR>260){t.rings.push(now);t.lastR=now}
      const life=700+reach*900,mg=Math.min(room,20+reach*90);
      t.rings=t.rings.filter(a=>now-a<life);
      for(const a of t.rings){
        const p=(now-a)/life,e=1-Math.pow(1-p,2.2),gr=e*mg,al=Math.pow(1-p,1.6)*.7;
        g.strokeStyle='rgba('+col+','+al.toFixed(3)+')';g.lineWidth=.6+2.8*(1-p);
        const x0=cx-hw-gr,y0=cy-hh-gr,w=2*(hw+gr),h=2*(hh+gr),rr=rad+gr;
        g.beginPath();
        if(g.roundRect)g.roundRect(x0,y0,w,h,rr);else g.rect(x0,y0,w,h);
        g.stroke();
      }
    }
    if(E.bars&&spec){
      /* the bars spread across the frequencies you picked (log scale, mirrored on both axes) */
      const N=64,maxLen=(14+reach*70)*(.5+amt),gap=5;
      let bl=1e9,bh=0;o.bands.forEach(B=>{if(B.on){bl=Math.min(bl,B.lo);bh=Math.max(bh,B.hi)}});if(bh<=0){bl=43;bh=9500}
      const lbw=Math.log(bh/bl),raw=t.raw||(t.raw=new Float32Array(N));let mx=0;
      for(let i=0;i<N;i++){
        const th=(i+.5)/N*Math.PI*2,f=Math.atan2(Math.abs(Math.sin(th)),Math.abs(Math.cos(th)))/(Math.PI/2);
        const idx=Math.min(spec.length-1,Math.max(1,Math.round(bl*Math.exp(lbw*f)/bw)));
        raw[i]=spec[idx]/255;if(raw[i]>mx)mx=raw[i];
      }
      t.bpk=Math.max(mx,t.bpk*(1-dt*.2),.25);
      g.lineCap='round';g.lineWidth=Math.max(2,Math.min(4,Math.min(hw,hh)*2*Math.PI/N*.4));
      const sh=.6*(1-o.sens/100);
      for(let i=0;i<N;i++){
        const th=(i+.5)/N*Math.PI*2,c=Math.cos(th),sn=Math.sin(th);
        let b=Math.min(1,raw[i]/t.bpk);b=Math.max(0,(b-sh))/(1-sh);
        const bk=1-Math.exp(-dt/(b>t.bars[i]?.02:.05+o.smo/100*.3));t.bars[i]+=(b-t.bars[i])*bk;
        const m=Math.max(Math.abs(c)/hw,Math.abs(sn)/hh);
        const r0=(1/m)+gap,len=2+t.bars[i]*maxLen;
        g.strokeStyle='rgba('+col+','+(.35+.55*t.bars[i]).toFixed(3)+')';
        g.beginPath();g.moveTo(cx+c*r0,cy+sn*r0);g.lineTo(cx+c*(r0+len),cy+sn*(r0+len));g.stroke();
      }
    }
  }
  t.dirty=true;
  return env>.002||t.rings.length>0||(E.bars&&spec&&t.bars.some(x=>x>.01));
}
function fxLoop(now){
  fxRaf=0;
  if(PERF.f.beat&&fxPrev&&now-fxPrev<28){fxRaf=requestAnimationFrame(fxLoop);return}/* performance mode: 30 frames per second */
  const dt=Math.min(.05,Math.max(.001,(now-(fxPrev||now))/1000));fxPrev=now;
  const playing=!au.paused&&!au.ended;let live=false,spec=null,realBW=43.07,lv=null;
  const rs=fxT.map(t=>t.get());/* what is on screen right now: the big player cover and the settings preview */
  const shown=!!fxEd||rs.some(r=>r&&r.cov);
  if(fxS.on&&!RM.matches){
    if(playing&&fxGraph()){try{
      fxLagSet();fxBandsSet();/* the audio graph stays in place so the sound does not change when the player opens */
      if(shown){
        fxAN.getByteFrequencyData(fxBuf);spec=fxBuf;realBW=fxAC.sampleRate/fxAN.fftSize;
        lv=fxS.bands.map((B,i)=>{const c=fxCH[i];if(!c||!B.on)return 0;c.a.getFloatTimeDomainData(c.td);let sq=0;for(let k=0;k<c.td.length;k++)sq+=c.td[k]*c.td[k];return Math.max(0,(20*Math.log10(Math.sqrt(sq/c.td.length)+1e-6)+60)/60)});
      }
    }catch(e){spec=null;lv=null}}
  }
  if(fxAN&&!fxS.on)try{fxLagSet()}catch(e){}
  const col=shown?fxColor():'255,255,255';
  for(let ti=0;ti<fxT.length;ti++){
    const t=fxT[ti],r=rs[ti];
    if(!r||!r.cov){t.dirty=false;continue}
    if(!fxS.on||RM.matches){if(t.dirty)fxReset(t,r);continue}
    let sp=spec;if(!sp&&t.demo)sp=fxDemo(now);
    if(fxFrame(t,r,sp,dt,now,col,sp===spec?realBW:43.07,sp===spec?lv:null))live=true;else if(!sp&&t.dirty)fxReset(t,r);
    if(sp&&t.demo)live=true;
  }
  if(fxEd)fxEdDraw(now,!!(spec&&fxAS));
  if(live||playing&&fxS.on&&shown)fxRaf=requestAnimationFrame(fxLoop);else fxPrev=0;
}
function fxKick(){if(!fxRaf)fxRaf=requestAnimationFrame(fxLoop)}
/* frequency picker: draggable bands over the live spectrum, like an EQ */
const fxF2X=(f,W)=>Math.log(f/FXMIN)/Math.log(FXMAX/FXMIN)*W;
const fxX2F=(x,W)=>FXMIN*Math.pow(FXMAX/FXMIN,Math.min(1,Math.max(0,x/W)));
const fxFmt=f=>f>=1000?(+(f/1000).toFixed(f>=10000?1:2))+'k':String(Math.round(f));
const fxPar=v=>{const m=/^\s*([\d.,]+)\s*(k?)\s*(?:hz)?\s*$/i.exec(String(v));if(!m)return null;const n=parseFloat(m[1].replace(',','.'));return isFinite(n)?n*(m[2]?1000:1):null};
function fxAddAt(f){const B=fxS.bands;if(B.length>=FXMAXB)return false;const k=Math.pow(2,.75);B.push(fxClampBand({lo:f/k,hi:f*k,g:100,on:1}));fxSel=B.length-1;return true}
function fxAddFree(){
  const C=[[2500,6000],[40,120],[6000,16000],[300,2500],[150,300]],B=fxS.bands;
  const ov=c=>B.some(b=>Math.min(b.hi,c[1])>Math.max(b.lo,c[0]));
  const c=C.find(x=>!ov(x))||C[0];
  if(B.length<FXMAXB){B.push(fxClampBand({lo:c[0],hi:c[1],g:100,on:1}));fxSel=B.length-1}
}
const FXPT=14,FXPB=18;
function fxEdInit(cv,onChange){
  const ed=fxEd={cv,drag:null,lastTap:0,lastX:0,lastY:0,txt:getComputedStyle(cv).color||'#fff',sp:new Uint8Array(4096)};
  const plotH=()=>cv.clientHeight-FXPT-FXPB;
  const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  const nodeXY=b=>{const W=cv.clientWidth;return[(fxF2X(b.lo,W)+fxF2X(b.hi,W))/2,FXPT+(1-b.g/150)*plotH()]};
  const inBand=(x,W)=>{let best=-1,bw=1e9;fxS.bands.forEach((b,i)=>{const x0=fxF2X(b.lo,W),x1=fxF2X(b.hi,W);if(x>=x0&&x<=x1&&x1-x0<bw){bw=x1-x0;best=i}});return best};
  cv.addEventListener('pointerdown',e=>{
    const W=cv.clientWidth,[x,y]=pos(e),B=fxS.bands;let hit=null;
    for(let i=B.length-1;i>=0;i--){const n=nodeXY(B[i]);if(Math.hypot(x-n[0],y-n[1])<=20){hit={m:'move',i};break}}
    if(!hit){
      const order=[fxSel,...B.map((_,i)=>i).filter(i=>i!==fxSel)];
      for(const i of order){
        if(!B[i])continue;
        const x0=fxF2X(B[i].lo,W),x1=fxF2X(B[i].hi,W),d0=Math.abs(x-x0),d1=Math.abs(x-x1);
        if(d0<=11&&d0<=d1){hit={m:'lo',i};break}
        if(d1<=11){hit={m:'hi',i};break}
      }
    }
    if(!hit){const i=inBand(x,W);if(i>=0)hit={m:'move',i}}
    if(!hit){   /* empty space: a quick second tap adds a band here */
      const now=performance.now();
      if(now-ed.lastTap<320&&Math.hypot(x-ed.lastX,y-ed.lastY)<24){if(fxAddAt(fxX2F(x,W)))onChange();ed.lastTap=0}
      else{ed.lastTap=now;ed.lastX=x;ed.lastY=y}
      return;
    }
    e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}
    fxSel=hit.i;const b=B[hit.i];
    ed.drag={m:hit.m,i:hit.i,x,y,lo:b.lo,hi:b.hi,g:b.g};onChange();
  });
  cv.addEventListener('pointermove',e=>{
    const d=ed.drag;if(!d)return;const b=fxS.bands[d.i];if(!b)return;
    const W=cv.clientWidth,[x,y]=pos(e);
    if(d.m==='move'){
      let sh=(x-d.x)/W*Math.log(FXMAX/FXMIN);sh=Math.min(Math.log(FXMAX/d.hi),Math.max(Math.log(FXMIN/d.lo),sh));
      b.lo=d.lo*Math.exp(sh);b.hi=d.hi*Math.exp(sh);
      let g=Math.min(150,Math.max(0,d.g-(y-d.y)/plotH()*150));if(Math.abs(g-100)<4)g=100;b.g=Math.round(g);   /* sticks to the 100 % line */
    }else if(d.m==='lo')b.lo=Math.min(fxX2F(x,W),b.hi/1.19);
    else b.hi=Math.max(fxX2F(x,W),b.lo*1.19);
    const c=fxClampBand(b);b.lo=c.lo;b.hi=c.hi;onChange();
  });
  const up=()=>{ed.drag=null};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{   /* mouse wheel over a band = width, like the Q knob in an EQ */
    const W=cv.clientWidth;let i=inBand(pos(e)[0],W);if(i<0)i=fxSel;const b=fxS.bands[i];if(!b)return;
    e.preventDefault();fxSel=i;
    const c=Math.sqrt(b.lo*b.hi),w=Math.sqrt(b.hi/b.lo)*Math.exp(-e.deltaY*.0015),nb=fxClampBand({lo:c/w,hi:c*w,g:b.g,on:b.on});
    b.lo=nb.lo;b.hi=nb.hi;onChange();
  },{passive:false});
}
function fxEdDraw(now,live){
  const ed=fxEd,cv=ed&&ed.cv;if(!cv)return;if(!cv.isConnected){fxEd=null;return}
  const W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
  const d=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){cv.width=Math.round(W*d);cv.height=Math.round(H*d)}
  const g=cv.getContext('2d'),PT=FXPT,PH=H-FXPT-FXPB,txt=ed.txt,B=fxS.bands;
  if(fxSel>=B.length)fxSel=B.length-1;if(fxSel<0)fxSel=0;
  g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
  g.font='10px system-ui,-apple-system,sans-serif';g.textAlign='center';
  /* grid */
  const lab={50:'50',100:'100',200:'200',500:'500',1000:'1k',2000:'2k',5000:'5k',10000:'10k'};
  g.fillStyle=txt;g.strokeStyle=txt;g.lineWidth=1;
  for(let dec=10;dec<=10000;dec*=10)for(let m=1;m<10;m++){
    const f=dec*m;if(f<FXMIN||f>=FXMAX)continue;const x=Math.round(fxF2X(f,W))+.5;
    g.globalAlpha=m===1?.16:.06;g.beginPath();g.moveTo(x,PT);g.lineTo(x,PT+PH);g.stroke();
    if(lab[f]){g.globalAlpha=.5;g.fillText(lab[f],x,H-5)}
  }
  [0,50,100,150].forEach(v=>{const y=Math.round(PT+(1-v/150)*PH)+.5;g.globalAlpha=v===100?.5:.07;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()});
  /* band regions, lit up by how hard each band is hitting right now */
  const act=i=>{const t=fxT[1].bs[i];return t&&fxS.on?Math.min(1,t.v||0):0};
  B.forEach((b,i)=>{
    const x0=fxF2X(b.lo,W),x1=fxF2X(b.hi,W);
    g.globalAlpha=b.on?.09+.3*act(i):.035;g.fillStyle=FXBC[i];g.fillRect(x0,PT,x1-x0,PH);
  });
  /* spectrum */
  const pts=[];
  if(live){
    fxAS.getByteFrequencyData(ed.sp);const bh=fxAC.sampleRate/8192,sp=ed.sp;
    for(let x=0;x<=W;x+=2){
      const a=fxX2F(x-1,W)/bh,b=fxX2F(x+1,W)/bh;let v;
      if(b-a<1){const c=(a+b)/2,i=Math.floor(c),fr=c-i;v=sp[i]*(1-fr)+sp[Math.min(4095,i+1)]*fr}
      else{v=0;for(let k=Math.floor(a);k<=Math.min(4095,Math.ceil(b));k++)v=Math.max(v,sp[k])}
      pts.push(Math.min(1,v/255*(.8+.35*x/W)));
    }
  }else{
    const t=now/1000,kb=Math.exp(-(t%.55)*8),hb=Math.exp(-((t+.275)%.55)*14);
    for(let x=0;x<=W;x+=2){
      const f=fxX2F(x,W),p=x/W;
      pts.push(Math.max(0,Math.min(1,.5-.3*p+kb*.42*Math.exp(-Math.pow(Math.log2(f/55),2)/1.3)+hb*.3*Math.exp(-Math.pow(Math.log2(f/9000),2)/1.6)+.05*Math.sin(f/90+t*2))));
    }
  }
  g.beginPath();g.moveTo(0,PT+PH);pts.forEach((v,i)=>g.lineTo(i*2,PT+PH*(1-v)));g.lineTo(W,PT+PH);g.closePath();
  g.fillStyle=txt;g.globalAlpha=live?.26:.14;g.fill();g.strokeStyle=txt;g.globalAlpha=live?.55:.3;g.lineWidth=1;g.stroke();
  if(!live){g.globalAlpha=.45;g.fillStyle=txt;g.textAlign='right';g.fillText('demo spectrum',W-8,12);g.textAlign='center'}
  /* edges, weight bars and numbered dots */
  B.forEach((b,i)=>{
    const sel=i===fxSel,x0=fxF2X(b.lo,W),x1=fxF2X(b.hi,W),y=PT+(1-b.g/150)*PH,cx=(x0+x1)/2,a=act(i),col=FXBC[i];
    g.strokeStyle=col;g.lineWidth=sel?1.5:1;g.globalAlpha=b.on?(sel?.95:.45):.25;
    g.beginPath();g.moveTo(x0,PT);g.lineTo(x0,PT+PH);g.moveTo(x1,PT);g.lineTo(x1,PT+PH);g.stroke();
    if(sel){g.fillStyle=col;g.globalAlpha=.95;[x0,x1].forEach(x=>{g.beginPath();if(g.roundRect)g.roundRect(x-3,PT+PH-34,6,20,3);else g.rect(x-3,PT+PH-34,6,20);g.fill()})}
    g.lineWidth=2.5;g.globalAlpha=b.on?.9:.3;g.beginPath();g.moveTo(x0,y);g.lineTo(x1,y);g.stroke();
    g.globalAlpha=b.on?1:.5;g.shadowColor=col;g.shadowBlur=b.on?a*20:0;
    g.fillStyle='#1b2430';g.strokeStyle=col;g.lineWidth=sel?3:2;
    g.beginPath();g.arc(cx,y,sel?13:11,0,Math.PI*2);g.fill();g.stroke();g.shadowBlur=0;
    g.fillStyle='#fff';g.globalAlpha=b.on?1:.6;g.font='bold 11px system-ui,-apple-system,sans-serif';g.textAlign='center';g.fillText(String(i+1),cx,y+4);
  });
  /* readout of the selected band */
  const s0=B[fxSel];
  if(s0){g.font='600 11px system-ui,-apple-system,sans-serif';g.textAlign='left';g.fillStyle=txt;g.globalAlpha=.85;g.fillText(fxFmt(s0.lo)+' - '+fxFmt(s0.hi)+' Hz  |  weight '+Math.round(s0.g)+'%'+(s0.on?'':'  (muted)'),8,11)}
  g.globalAlpha=1;
}
function fxSheet(){
  const o=fxS,chips=(id,list,cls)=>`<div class="bgst" id="${id}">${list.map(x=>`<button type="button" class="chip ${cls||''}" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`;
  const cs=songById(cur),art=cs?cover(songCover(cs),cs.name):'<div class="cov"></div>';
  openOv(`<h3>Beat effects</h3><p class="dupn" style="margin-bottom:6px">Moves the big player cover with the music. Applies to every song.</p><div class="bgs">
  <div class="fxpv" id="fxpv">${art}</div>
  <label>Effects</label>${chips('fxon',[['1','On'],['0','Off']])}
  <div id="fxmore"><label>Mix (tap to combine)</label>${chips('fxe',FXL)}
  <label>Reacts to these frequencies</label>
  <div class="fxeq"><canvas id="fxeq" aria-label="Frequency picker"></canvas></div>
  <p class="fxhint">Drag a dot to move a band (up and down sets its weight). Drag the edges to make it wider or narrower. Double-tap empty space to add a band.</p>
  <div class="bgst" id="fxbt"></div>
  <div id="fxbp">
    <div class="fxhz"><div><label>From (Hz)</label><input type="text" inputmode="decimal" id="fxlo" autocomplete="off"></div><div><label>To (Hz)</label><input type="text" inputmode="decimal" id="fxhi" autocomplete="off"></div></div>
    <div class="fop fx" id="fxgr"><span>Weight</span><input type="range" class="rng" id="fxg" min="0" max="150" aria-label="Band weight"><b></b><button type="button" class="rsb" id="fxgrs" aria-label="Reset weight to default" title="Reset to default">${ic('rst',16)}</button></div>
    <div class="bgst"><button type="button" class="chip fx" id="fxmu">Mute band</button><button type="button" class="chip fx" id="fxrm">${ic('trash',14)} Remove</button></div>
  </div>
  <label>Quick picks</label>${chips('fxq',FXB)}
  <label>Response</label>${chips('fxm',[['beat','Beat punch'],['level','Loudness']])}
  <label>Colour</label>${chips('fxc',[['cover','From cover'],['white','White']])}
  <div id="fxrows">${FXR.map(r=>`<div class="fop fx" data-k="${r[0]}"><span>${r[1]}</span><input type="range" class="rng" data-k="${r[0]}" min="${r[2]}" max="${r[3]}" aria-label="${r[1]}"><b></b><button type="button" class="rsb" data-r="${r[0]}" aria-label="Reset ${r[1]} to default" title="Reset to default">${ic('rst',16)}</button></div>`).join('')}</div></div></div>
  <div class="bt"><button class="pill mr" id="fxx">Reset</button><button class="pill acc" id="fxdn">Done</button></div>`);
  const keep=()=>{try{localStorage.setItem('tracks-fx',JSON.stringify(o))}catch(e){}};
  let tabH='';
  const paintB=()=>{
    const B=o.bands;if(fxSel>=B.length)fxSel=B.length-1;if(fxSel<0)fxSel=0;
    const h=B.map((b,i)=>`<button type="button" class="chip fxtab${i===fxSel?' on':''}${b.on?'':' mu'}" data-i="${i}" style="--c:${FXBC[i]}" aria-label="Band ${i+1}"><i></i>${i+1}</button>`).join('')+(B.length<FXMAXB?`<button type="button" class="chip fx" data-add="1" aria-label="Add band">${ic('plus',14)} Add</button>`:'');
    if(h!==tabH){tabH=h;$('#fxbt').innerHTML=h}
    const b=B[fxSel],lo=$('#fxlo'),hi=$('#fxhi'),gr=$('#fxg');
    if(document.activeElement!==lo)lo.value=fxFmt(b.lo);
    if(document.activeElement!==hi)hi.value=fxFmt(b.hi);
    gr.value=b.g;gr.style.setProperty('--p',(b.g/150*100)+'%');
    $('#fxgr b').textContent=Math.round(b.g)+'%';$('#fxgr').classList.toggle('dflt',Math.round(b.g)===100);
    const mu=$('#fxmu');mu.classList.toggle('on',!b.on);mu.textContent=b.on?'Mute band':'Unmute band';
    $('#fxrm').disabled=B.length<2;
  };
  const paint=()=>{
    const on=(id,f)=>document.querySelectorAll('#'+id+' .chip').forEach(c=>c.classList.toggle('on',f(c.dataset.v)));
    on('fxon',v=>v===String(o.on));on('fxe',v=>!!o.e[v]);on('fxm',v=>v===o.mode);on('fxc',v=>v===o.col);
    on('fxq',v=>{const p=FXB.find(x=>x[0]===v);return !!p&&p[2].length===o.bands.length&&p[2].every((r,i)=>Math.abs(r[0]-o.bands[i].lo)<.5&&Math.abs(r[1]-o.bands[i].hi)<.5)});
    $('#fxmore').style.display=o.on?'':'none';
    FXR.forEach(r=>{
      const el=document.querySelector('#fxrows .fop[data-k="'+r[0]+'"]'),inp=el.querySelector('input'),v=o[r[0]];
      inp.value=v;inp.style.setProperty('--p',((v-r[2])/(r[3]-r[2])*100)+'%');el.querySelector('b').textContent=v+r[4];el.classList.toggle('dflt',v===FXD[r[0]]);
      el.style.display=(r[0]!=='rch'||o.e.ripple||o.e.bars)?'':'none';
    });
    paintB();
  };
  const ch=()=>{keep();paint();fxKick();fxEdDraw(performance.now(),false)};
  $('#fxon').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;o.on=+c.dataset.v;if(!o.on){fxT.forEach(t=>fxReset(t,t.get()))}ch()};
  $('#fxe').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;o.e[c.dataset.v]=o.e[c.dataset.v]?0:1;ch()};
  $('#fxm').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;o.mode=c.dataset.v;ch()};
  $('#fxc').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;o.col=c.dataset.v;ch()};
  $('#fxbt').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;if(c.dataset.add)fxAddFree();else fxSel=+c.dataset.i;ch()};
  $('#fxq').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;const p=FXB.find(x=>x[0]===c.dataset.v);if(!p)return;o.bands=p[2].map(r=>fxClampBand({lo:r[0],hi:r[1],g:100,on:1}));fxSel=0;fxT.forEach(t=>{t.bs=[]});ch()};
  const edit=(k,el)=>{
    const v=fxPar(el.value),b=o.bands[fxSel];
    if(v!=null){if(k==='lo')b.lo=Math.min(v,b.hi/1.19);else b.hi=Math.max(v,b.lo*1.19);const c=fxClampBand(b);b.lo=c.lo;b.hi=c.hi}
    el.value=fxFmt(b[k]);ch();
  };
  [['#fxlo','lo'],['#fxhi','hi']].forEach(x=>{const el=$(x[0]);el.onchange=()=>edit(x[1],el);el.onkeydown=e=>{if(e.key==='Enter')el.blur()}});
  $('#fxg').oninput=e=>{let v=+e.target.value;if(Math.abs(v-100)<3)v=100;o.bands[fxSel].g=v;ch()};
  $('#fxgrs').onclick=()=>{o.bands[fxSel].g=100;ch()};
  $('#fxmu').onclick=()=>{const b=o.bands[fxSel];b.on=b.on?0:1;ch()};
  $('#fxrm').onclick=()=>{if(o.bands.length<2)return;o.bands.splice(fxSel,1);fxSel=Math.max(0,fxSel-1);fxT.forEach(t=>{t.bs=[]});ch()};
  $('#fxrows').oninput=e=>{const k=e.target.dataset.k;if(!k)return;o[k]=+e.target.value;ch()};
  $('#fxrows').onclick=e=>{const b=e.target.closest('.rsb');if(!b)return;o[b.dataset.r]=FXD[b.dataset.r];ch()};
  $('#fxx').onclick=()=>{const d=JSON.parse(JSON.stringify(FXD));Object.keys(d).forEach(k=>{o[k]=d[k]});fxSel=0;fxT.forEach(t=>{t.bs=[]});ch()};
  $('#fxdn').onclick=()=>closeOv();
  $('#ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
  fxEdInit($('#fxeq'),()=>{keep();paint();fxKick()});
  paint();fxKick();fxEdDraw(performance.now(),false);
}

/* normalize volume (v2)
   - Loudness is measured once per song with the ITU BS.1770 K-weighting (shelf + high-pass), 400 ms blocks with 75% overlap and the two standard gates, then cached.
   - The song is normalized BEFORE you hear it: a song that is not measured yet starts silent, is measured (usually well under a second or two), rewinds to where it began and only then lets the sound through.
   - The next songs in the queue are measured in the background, so most songs start instantly at the right level.
   - The correction is a gain node after the beat-effect analysers (visuals are unaffected). Boosts never push the peaks past full scale.
   - Tap the button to switch on/off. Hold it (or right-click) for the target level and "analyse whole library". */
const NM_MAXUP=12,NM_MAXDN=-20,NM_V=2;
const NM_TG=[[-16,'Quiet','\u221216 LUFS'],[-14,'Standard','\u221214 LUFS'],[-11,'Loud','\u221211 LUFS']];
const nmTarget=()=>{let v=-14;try{v=parseFloat(localStorage.getItem('tracks-nmt'))}catch(e){}return NM_TG.some(t=>t[0]===v)?v:-14};
const nm={on:0,db:0,key:null,hold:null,busy:0,tk:0,all:0};
try{nm.on=localStorage.getItem('tracks-norm')==='1'?1:0}catch(e){}
let nmCache={};try{nmCache=JSON.parse(localStorage.getItem('tracks-loud')||'{}')||{}}catch(e){}
function nmSave(){try{if(songs.length)for(const k of Object.keys(nmCache))if(!songs.some(x=>x.id===k))delete nmCache[k];localStorage.setItem('tracks-loud',JSON.stringify(nmCache))}catch(e){}}
const nmEntry=s=>{const e=s&&s.blob&&nmCache[s.id];return e&&e.v===NM_V&&e.sz===s.blob.size?e:null};
/* K-weighting filters for any sample rate (same maths as the BS.1770 reference filters) */
function nmKW(fs){
  const f1=1681.974450955533,G=3.999843853973347,Q1=.7071752369554196,K1=Math.tan(Math.PI*f1/fs),Vh=Math.pow(10,G/20),Vb=Math.pow(Vh,.4996667741545416),a1=1+K1/Q1+K1*K1;
  const f2=38.13547087602444,Q2=.5003270373238773,K2=Math.tan(Math.PI*f2/fs),a2=1+K2/Q2+K2*K2;
  return [
    {b0:(Vh+Vb*K1/Q1+K1*K1)/a1,b1:2*(K1*K1-Vh)/a1,b2:(Vh-Vb*K1/Q1+K1*K1)/a1,a1:2*(K1*K1-1)/a1,a2:(1-K1/Q1+K1*K1)/a1},
    {b0:1,b1:-2,b2:1,a1:2*(K2*K2-1)/a2,a2:(1-K2/Q2+K2*K2)/a2}
  ];
}
async function nmMeasure(s){
  if(s.blob.size>150*1048576)throw new Error('too big');   /* decoding would need far too much memory */
  const buf=await s.blob.arrayBuffer(),OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const ab=await new Promise((res,rej)=>{const p=new OC(1,1,44100).decodeAudioData(buf,res,rej);if(p&&p.catch)p.catch(rej)});
  const sr=ab.sampleRate,N=ab.length,sub=Math.max(1,Math.round(sr*.1)),nch=Math.min(2,ab.numberOfChannels),mul=nch===1?2:1;   /* mono counts as two matching channels */
  const [A,B]=nmKW(sr),chs=[],z=[];
  for(let c=0;c<nch;c++){chs.push(ab.getChannelData(c));z.push(new Float64Array(8))}
  const subs=[];let acc=0,cnt=0,pk=0;
  for(let i=0;i<N;i++){
    for(let c=0;c<nch;c++){
      const x=chs[c][i],ax=x<0?-x:x;if(ax>pk)pk=ax;const q=z[c];
      const y=A.b0*x+A.b1*q[0]+A.b2*q[1]-A.a1*q[2]-A.a2*q[3];q[1]=q[0];q[0]=x;q[3]=q[2];q[2]=y;
      const w=B.b0*y+B.b1*q[4]+B.b2*q[5]-B.a1*q[6]-B.a2*q[7];q[5]=q[4];q[4]=y;q[7]=q[6];q[6]=w;
      acc+=w*w;
    }
    if(++cnt===sub){subs.push(acc/sub*mul);acc=0;cnt=0;if(subs.length%80===0)await new Promise(r=>setTimeout(r,0))}
  }
  if(cnt>sub/2)subs.push(acc/cnt*mul);
  const blocks=[];for(let i=0;i+4<=subs.length;i++)blocks.push((subs[i]+subs[i+1]+subs[i+2]+subs[i+3])/4);
  if(!blocks.length&&subs.length)blocks.push(subs.reduce((t,x)=>t+x,0)/subs.length);
  const L=m=>10*Math.log10(m)-.691,mean=a=>a.reduce((t,x)=>t+x,0)/a.length;
  const ab70=blocks.filter(m=>m>0&&L(m)>-70);let l=-80;
  if(ab70.length){const rel=L(mean(ab70))-10,g=ab70.filter(m=>L(m)>rel);l=L(mean(g.length?g:ab70))}   /* absolute gate -70 LUFS, relative gate -10 LU */
  return {v:NM_V,sz:s.blob.size,l:+l.toFixed(2),pk:+(20*Math.log10(pk||1e-6)).toFixed(2)};
}
function nmGain(e){
  if(!e||e.l<=-60)return 0;
  const g=Math.min(NM_MAXUP,Math.max(NM_MAXDN,nmTarget()-e.l));
  return Math.min(g,Math.max(0,-.5-e.pk));   /* only the boost is limited by the peak */
}
/* one measuring job per song at a time; background jobs run one after another so the phone never decodes two songs at once */
const nmJobs=new Map(),nmBg={p:Promise.resolve()};
function nmGet(s,urgent){
  const k=s.id+':'+s.blob.size,hit=nmEntry(s);if(hit)return Promise.resolve(hit);
  const run=()=>{
    const e=nmEntry(s);if(e)return Promise.resolve(e);
    const j0=nmJobs.get(k);if(j0)return j0;
    const j=nmMeasure(s).then(r=>{nmCache[s.id]=r;nmSave();return r});
    nmJobs.set(k,j);const done=()=>{if(nmJobs.get(k)===j)nmJobs.delete(k)};j.then(done,done);return j;
  };
  if(urgent)return run();
  const p=nmBg.p.catch(()=>{}).then(run);nmBg.p=p;return p;
}
const nmTxt=d=>(d>=0?'+':'\u2212')+Math.abs(d).toFixed(1)+' dB';
function nmPaint(){
  document.querySelectorAll('.nmb').forEach(b=>{
    b.classList.toggle('on',!!nm.on);b.classList.toggle('busy',!!nm.busy);b.setAttribute('aria-pressed',nm.on?'true':'false');
    const t=nm.on?(nm.busy?'Analysing loudness\u2026':'Volume normalized ('+nmTxt(nm.db)+'). Tap to turn off, hold for options'):'Normalize volume. Hold for options';
    b.title=t;b.setAttribute('aria-label',t);
  });
}
function nmLevel(v){   /* raw gain, no fade (used to keep a song silent until it is measured) */
  if(fxGain&&fxAC){const t=fxAC.currentTime;try{fxGain.gain.cancelScheduledValues(t);fxGain.gain.setValueAtTime(v,t)}catch(e){fxGain.gain.value=v}}
}
function nmSet(db,instant){
  nm.db=db;
  if(fxGain&&fxAC){const t=fxAC.currentTime,v=Math.pow(10,db/20);try{fxGain.gain.cancelScheduledValues(t);if(instant)fxGain.gain.setValueAtTime(v,t);else fxGain.gain.setTargetAtTime(v,t,.08)}catch(e){fxGain.gain.value=v}}
  nmPaint();
}
/* fresh = a song is starting (or resuming): keep it silent until it is measured. Not fresh = normalize was just switched on mid-song: play on, then ease to the new level. */
function nmEnsure(say,fresh){
  if(!nm.on){nm.hold=null;nm.busy=0;if(nm.db)nmSet(0,true);else nmPaint();return}
  const s=songById(cur);if(!s||!s.blob)return;
  const key=s.id+':'+s.blob.size;
  if(nm.key===key){if(say)toast('Volume normalized ('+nmTxt(nm.db)+')');return}
  if(nm.hold===key)return;
  if(!fxGraph()){nm.busy=0;nmPaint();if(say)toast('Normalize is not supported in this browser');return}   /* built right here, inside the tap */
  const my=++nm.tk,e=nmEntry(s);nm.hold=null;
  if(e){nm.key=key;nm.busy=0;nmSet(nmGain(e),!!fresh);nmWarm();if(say)toast('Volume normalized ('+nmTxt(nm.db)+')');return}
  nm.key=null;nm.busy=1;
  const p0=au.currentTime||0,t0=performance.now();
  if(fresh){nm.hold=key;nm.db=0;nmLevel(0)}else nmSet(0);
  nmPaint();
  const slow=fresh?setTimeout(()=>{if(my===nm.tk&&nm.busy)toast('Analysing loudness\u2026')},900):0;
  nmGet(s,true).then(r=>{
    clearTimeout(slow);if(my!==nm.tk)return;
    nm.busy=0;nm.hold=null;nm.key=key;
    if(fresh){const el=(performance.now()-t0)/1000;if(au.currentTime>=p0&&au.currentTime<p0+el+1.5){try{au.currentTime=p0}catch(_){}}}   /* the silent seconds are not lost */
    nmSet(nmGain(r),!!fresh);nmWarm();
    if(say)toast('Volume normalized ('+nmTxt(nm.db)+')');
  }).catch(()=>{
    clearTimeout(slow);if(my!==nm.tk)return;
    nm.busy=0;nm.hold=null;nm.key=key;nmSet(0,true);toast('Could not analyse this song, playing it as it is');
  });
}
/* measure the next songs in the background so they start instantly at the right level */
function nmWarm(){
  if(!nm.on)return;
  const ids=[...upNext],i=queue.indexOf(ctxCur);
  if(i>=0&&queue.length>1)for(let k=1;k<=2;k++)ids.push(queue[(i+k)%queue.length]);
  [...new Set(ids)].slice(0,3).forEach(id=>{if(id===cur)return;const s=songById(id);if(s&&s.blob&&!nmEntry(s))nmGet(s,false).catch(()=>{})});
}
async function nmAll(){
  if(nm.all){nm.all=0;return}
  const todo=songs.filter(s=>s.blob&&!nmEntry(s));
  if(!todo.length)return toast('Every song on this device is already analysed');
  nm.all=1;let n=0,bad=0;
  for(const s of todo){
    if(!nm.all)break;
    if(n%5===0)toast('Analysing '+(n+1)+' of '+todo.length+'\u2026 (open this menu again to stop)');n++;
    try{await nmGet(s,false)}catch(e){bad++}
  }
  const stopped=!nm.all;nm.all=0;
  toast(stopped?'Stopped after '+n+' of '+todo.length+' songs':'Library analysed'+(bad?' ('+bad+' could not be read)':''));
}
function nmToggle(){
  nm.on=nm.on?0:1;try{localStorage.setItem('tracks-norm',String(nm.on))}catch(e){}
  nm.tk++;nm.key=null;nm.hold=null;nm.busy=0;
  if(nm.on){if(cur)nmEnsure(true,false);else{toast('Normalize is on for every song you play');nmPaint()}}
  else{nmSet(0);toast('Normalize off')}
}
async function nmMenu(){
  const t=nmTarget();
  const items=NM_TG.map((x,i)=>({label:x[1]+' \u00b7 '+x[2],value:'t'+x[0],sel:nm.on&&x[0]===t,ic:'lvl'+(i+1)}));
  items.push({label:nm.all?'Stop analysing the library':'Analyse the whole library now',value:'all',ic:nm.all?'stopsq':'wave',gap:1});
  items.push({label:nm.on?'Turn normalize off':'Turn normalize on',value:'tog',ic:'power'});
  const r=await choose('Normalize volume',items);
  if(!r)return;
  if(r==='all')return nmAll();
  if(r==='tog')return nmToggle();
  try{localStorage.setItem('tracks-nmt',String(+r.slice(1)))}catch(e){}
  if(!nm.on)return nmToggle();
  const s=songById(cur),e=nmEntry(s);
  if(e){nm.key=s.id+':'+s.blob.size;nmSet(nmGain(e))}
  toast('Target level '+NM_TG.find(x=>x[0]===nmTarget())[2]);
}
/* hold the button (or right-click) for the options; the tap that follows a hold must not also toggle */
(()=>{
  let t=null,fired=0;
  const open=()=>{if(fired)return;fired=1;clearTimeout(t);try{navigator.vibrate&&navigator.vibrate(12)}catch(_){}nmMenu()};
  const hit=e=>e.target&&e.target.closest&&e.target.closest('.nmb');
  document.addEventListener('pointerdown',e=>{if(!hit(e))return;fired=0;clearTimeout(t);t=setTimeout(open,520)},true);
  ['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(t),true));
  document.addEventListener('click',e=>{if(fired&&hit(e)){fired=0;e.stopPropagation();e.preventDefault()}},true);
  document.addEventListener('contextmenu',e=>{if(!hit(e))return;e.preventDefault();open()},true);
})();
au.addEventListener('play',()=>nmEnsure(false,true));

