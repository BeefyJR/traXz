

/* ===== BEGIN 15-trim.js ===== */
/* ===== Trim sheet: waveform you can play and skip through, trim handles, a smooth section loop, and per-song fades ===== */
/* ===== Section loop: repeats a part of the song a few extra times. The jump is a short equal-power crossfade
   between two players: the main one fades out at the loop end while a second one, parked and ready at the loop start,
   fades in. Then the main player moves to where the second one is and takes over again. ===== */
const LPX=.25;
function lpStop(){
  clearInterval(LP.iv);LP.iv=0;
  if(LP.busy&&LP.vs){try{LP.vs(1)}catch(_){}}
  LP.busy=0;LP.vs=null;LP.key=null;
  const g=LP.g;LP.g=null;
  if(g){try{g.pause();g.removeAttribute('src');g.load()}catch(_){}}
  if(LP.u){URL.revokeObjectURL(LP.u);LP.u=null}
}
function lpPrep(blob,a){
  const key=blob.size+':'+a;if(LP.g&&LP.key===key)return;
  lpStop();
  const g=new Audio();g.preload='auto';g.volume=0;LP.u=URL.createObjectURL(blob);g.src=LP.u;LP.g=g;LP.key=key;
  const park=()=>{try{g.currentTime=a}catch(_){}};
  if(g.readyState>0)park();else g.addEventListener('loadedmetadata',park,{once:true});
}
/* el = the player that is about to reach the loop end, vs(k) = sets its volume to k, gn() = extra gain for the second player */
function lpJump(el,vs,gn,X,a){
  const g=LP.g;if(!g||LP.busy)return false;
  LP.busy=1;LP.vs=vs;
  const vol=()=>xfCl(uvol*gn());
  let ph=0,t0=0,t1=0,tries=0,lead=.1;
  g.volume=0;
  const start=()=>{if(ph)return;ph=1;t0=performance.now();LP.iv=setInterval(step,16)};
  g.addEventListener('playing',start,{once:true});setTimeout(start,240);
  g.play().catch(()=>{if(LP.g===g){lpStop();try{el.currentTime=a}catch(_){}}});
  const done=()=>{ph=3;t1=performance.now()};
  const hand=()=>{
    tries++;
    el.addEventListener('seeked',()=>{
      if(LP.g!==g)return;
      const d=el.currentTime-g.currentTime;
      if(Math.abs(d)<=.04||tries>=3)done();else{lead=Math.max(0,lead-d);hand()}
    },{once:true});
    try{el.currentTime=g.currentTime+lead}catch(_){done()}
  };
  setTimeout(()=>{if(LP.g===g&&ph&&ph<3)done()},X*1000+2500);   /* never stay silent if a seek never reports back */
  function step(){
    if(LP.g!==g||el.paused){lpStop();return}
    if(ph===1){
      const k=Math.min(1,(performance.now()-t0)/(X*1000));
      vs(Math.cos(k*Math.PI/2));g.volume=xfCl(vol()*Math.sin(k*Math.PI/2));
      if(k>=1){ph=2;vs(0);g.volume=vol();hand()}
    }else if(ph===3){
      const k=Math.min(1,(performance.now()-t1)/80);
      vs(Math.sin(k*Math.PI/2));g.volume=xfCl(vol()*Math.cos(k*Math.PI/2));
      if(k>=1)lpStop();
    }
  }
  return true;
}
const lpId=s=>s.id+':'+s.loop.a+':'+s.loop.b+':'+s.loop.n+':'+(s.loop.m||'');
function lpPending(){
  const s=songById(cur),L=s&&s.loop;
  if(!L||!s.blob||LPN.id!==lpId(s))return false;
  if(L.m==='end')return LPN.tail<2||LPN.left>0;   /* the part is still to be added at the end */
  return LPN.left>0&&au.currentTime<L.b+.5;
}
/* "Add at the end": the song plays to its end, then the chosen part is crossfaded in and played, and the song ends where that part ends */
function lpTail(s,L,t,X){
  const D=au.duration;if(!isFinite(D)||D<=0)return;
  const e=(s.trim&&s.trim.b!=null)?Math.min(+s.trim.b,D):D;
  if(LPN.tail===1)LPN.tail=2;   /* the jump has finished */
  if(LPN.tail&&LPN.t>t+1.5){LPN.tail=0;LPN.left=L.n;trRefresh()}   /* you went back: play it normally again */
  LPN.t=t;
  if(!LPN.tail){
    if(t<e-3.5)return;
    lpPrep(s.blob,L.a);
    if(t>=e-X-.35&&LP.g&&LP.g.readyState>=2){
      LPN.left--;LPN.tail=1;
      TR={a:TR?TR.a:0,b:L.b};   /* from here on the song ends where the added part ends */
      lpJump(au,xfSetVol,xfNmGain,X,L.a);
    }
    return;
  }
  if(LPN.left>0){
    if(t<L.b-3.5)return;
    lpPrep(s.blob,L.a);
    if(t>=L.b-X-.04&&LP.g&&LP.g.readyState>=2){LPN.left--;LPN.tail=1;lpJump(au,xfSetVol,xfNmGain,X,L.a)}
  }else if(t>=L.b-.03)xfEnd1();
}
function lpTick(){
  if(!cur||au.paused||restoring||XF.mid)return;
  const t=au.currentTime;
  if(LP.busy){LPN.t=t;return}
  const s=songById(cur),L=s&&s.loop;
  if(!L||!s.blob)return;
  const id=lpId(s);if(LPN.id!==id){LPN.id=id;LPN.left=L.n;LPN.tail=0;LPN.t=t}
  const X=Math.min(L.x||LPX,(L.b-L.a)/3);
  if(L.m==='end')return lpTail(s,L,t,X);
  if(t<L.a-.3)LPN.left=L.n;
  if(LPN.left<=0||t>L.b+.4||t<L.b-3.5)return;
  lpPrep(s.blob,L.a);
  if(t>=L.b-X-.04){
    if(LP.g&&LP.g.readyState>=2){LPN.left--;lpJump(au,xfSetVol,xfNmGain,X,L.a)}
    else if(t>=L.b){LPN.left--;try{au.currentTime=L.a}catch(_){}}   /* the second player was not ready: a plain jump */
  }
}
setInterval(lpTick,25);
['ended','loadstart'].forEach(ev=>au.addEventListener(ev,()=>{if(LPN.tail){LPN.tail=0;trRefresh()}LPN.id=null;if(!LP.busy)lpStop()}));

/* ===== Tempo detection: onset envelope (low band + high band) -> autocorrelation for the tempo -> comb search for the exact BPM and where beat 1 falls.
   Returns {bpm, off (seconds of a beat line), conf (about 1 = random, 2.5+ = clear beat)} or null. ===== */
function bpmDetect(ab){
  const sr=ab.sampleRate,L=ab.length,c0=ab.getChannelData(0),c1=ab.numberOfChannels>1?ab.getChannelData(1):null;
  const hop=Math.max(32,Math.round(sr/200)),fr=sr/hop,n=Math.floor(L/hop);
  if(n<fr*6)return null;
  const el=new Float32Array(n),ef=new Float32Array(n),a=1-Math.exp(-2*Math.PI*180/sr);let y=0;
  for(let i=0;i<n;i++){
    let sl=0,sf=0;
    for(let j=i*hop,e=j+hop;j<e;j++){const x=c1?(c0[j]+c1[j])*.5:c0[j];y+=a*(x-y);sl+=y*y;const d=x-y;sf+=d*d}
    el[i]=Math.sqrt(sl/hop);ef[i]=Math.sqrt(sf/hop);
  }
  const prep=e=>{
    let mx=0;for(let i=0;i<n;i++)if(e[i]>mx)mx=e[i];
    if(!(mx>0))return null;
    const o=new Float32Array(n);let p=0,sum=0;
    for(let i=0;i<n;i++){const l=Math.log1p(200*e[i]/mx),d=l-p;p=l;o[i]=d>0?d:0;sum+=o[i]}
    const m=sum/n||1;for(let i=0;i<n;i++)o[i]/=m;return o;
  };
  const o1=prep(el),o2=prep(ef);if(!o1&&!o2)return null;
  const on=new Float32Array(n);for(let i=0;i<n;i++)on[i]=(o1?o1[i]:0)+(o2?o2[i]*.5:0);
  /* keep only the peaks: subtract a moving average */
  {const W=Math.max(2,Math.round(fr*.4)),cs=new Float64Array(n+1);for(let i=0;i<n;i++)cs[i+1]=cs[i]+on[i];
   const out=new Float32Array(n);for(let i=0;i<n;i++){const a0=Math.max(0,i-W),b0=Math.min(n,i+W+1),mean=(cs[b0]-cs[a0])/(b0-a0),v=on[i]-mean;out[i]=v>0?v:0}on.set(out)}
  /* analyse at most 5 minutes from the middle of the song */
  let i0=0,m=n;const cap=Math.floor(fr*300);if(n>cap){i0=Math.floor((n-cap)/2);m=cap}
  const env=on.subarray(i0,i0+m);
  const lagMin=Math.max(2,Math.floor(fr*60/190)),lagMax=Math.ceil(fr*60/60),top=Math.min(lagMax*2,m>>1);
  const ac=new Float64Array(top+2);
  for(let lag=lagMin-1;lag<=top;lag++){let s=0;const e=m-lag;for(let i=0;i<e;i++)s+=env[i]*env[i+lag];ac[lag]=s/e}
  let bl=0,bs=-1;
  for(let lag=lagMin;lag<=lagMax&&lag<top;lag++){
    const bpm=60*fr/lag,w=Math.exp(-.5*Math.pow(Math.log2(bpm/118)/.9,2));
    const s=(ac[lag]+(lag*2<=top?.5*ac[lag*2]:0))*w;
    if(s>bs){bs=s;bl=lag}
  }
  if(!bl||!(bs>0))return null;
  let lagf=bl;{const A=ac[bl-1],B=ac[bl],C=ac[bl+1],dn=A-2*B+C;if(dn<0)lagf=bl+.5*(A-C)/dn}
  let bpm0=60*fr/lagf;while(bpm0<70)bpm0*=2;while(bpm0>=180)bpm0/=2;
  /* one smoothed copy, so the comb search reads a single value per beat */
  const es=new Float32Array(m+2);for(let i=0;i<m;i++)es[i]=env[i]+.5*((i>0?env[i-1]:0)+(i<m-1?env[i+1]:0));
  const comb=(bpm,ph)=>{
    const T=60*fr/bpm;let best=-1,bp=0;
    for(let p=0;p<T;p+=ph){
      let s=0;
      for(let t=p;t<m-1;t+=T)s+=es[(t+.5)|0];
      if(s>best){best=s;bp=p}
    }
    return {bpm,s:best,p:bp,T};
  };
  let best=null;
  for(let c=bpm0*.985;c<=bpm0*1.015;c+=.03){const r=comb(c,1);if(!best||r.s>best.s)best=r}
  {const c0b=best.bpm;for(let c=c0b-.05;c<=c0b+.05;c+=.005){const r=comb(c,.5);if(r.s>best.s)best=r}}
  {const r0=Math.round(best.bpm);if(Math.abs(r0-best.bpm)<=.12){const r=comb(r0,.5);if(r.s>=best.s*.985)best=r}}
  let avg=0;for(let i=0;i<m;i++)avg+=env[i];avg/=m;
  const beats=Math.max(1,Math.floor(m/best.T)),conf=avg>0?best.s/(beats*avg*2):0,bsec=60/best.bpm;
  let off=(i0+best.p)/fr;off=((off%bsec)+bsec)%bsec;
  return {bpm:+best.bpm.toFixed(2),off,conf};
}
const WFC=new Map();
async function trWave(s){
  const k=s.id+':'+s.blob.size,h=WFC.get(k);if(h)return h;
  if(s.blob.size>120*1048576)throw new Error('too big');
  const buf=await s.blob.arrayBuffer(),OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const ab=await new Promise((res,rej)=>{const p=new OC(1,1,44100).decodeAudioData(buf,res,rej);if(p&&p.catch)p.catch(rej)});
  const N=2400,L=ab.length,c0=ab.getChannelData(0),c1=ab.numberOfChannels>1?ab.getChannelData(1):null,pk=new Float32Array(N),bs=L/N;
  for(let i=0;i<N;i++){
    let m=0;const a=Math.floor(i*bs),b=Math.min(L,Math.floor((i+1)*bs)),st=Math.max(1,Math.floor((b-a)/400));
    for(let j=a;j<b;j+=st){let v=c0[j];if(v<0)v=-v;if(v>m)m=v;if(c1){let w=c1[j];if(w<0)w=-w;if(w>m)m=w}}
    pk[i]=m;
  }
  let mx=0;for(let i=0;i<N;i++)if(pk[i]>mx)mx=pk[i];
  if(mx>0)for(let i=0;i<N;i++)pk[i]=Math.pow(pk[i]/mx,.7);
  const r={p:pk,d:ab.duration};
  /* light mono copy (about 11 kHz) for the cut finder */
  {const fct=Math.max(1,Math.floor(ab.sampleRate/11025)),Lm=Math.floor(L/fct),mo=new Float32Array(Lm),nch=c1?2:1;
   for(let i=0;i<Lm;i++){let sm=0;const a=i*fct;for(let j=0;j<fct;j++){sm+=c0[a+j];if(c1)sm+=c1[a+j]}mo[i]=sm/(fct*nch)}
   r.m=mo;r.msr=ab.sampleRate/fct}
  /* the waveform shows at once; the tempo is worked out right after, so the sheet never waits for it */
  r.bpmP=(async()=>{await new Promise(x=>setTimeout(x,30));try{return bpmDetect(ab)}catch(e){console.warn('bpm failed',e);return null}})();
  WFC.set(k,r);if(WFC.size>5)WFC.delete(WFC.keys().next().value);return r;
}
/* ===== Bake: renders the trim and the section loop (same crossfade maths as the live player) into a new audio file.
   Output is 16-bit WAV, so the result is exact and every browser can play it. ===== */
async function bakeLoop(blob,tr,lp,parts){
  const OC=window.OfflineAudioContext||window.webkitOfflineAudioContext,buf=await blob.arrayBuffer();
  const ab=await new Promise((res,rej)=>{const p=new OC(1,1,44100).decodeAudioData(buf,res,rej);if(p&&p.catch)p.catch(rej)});
  const sr=ab.sampleRate,nc=Math.min(2,ab.numberOfChannels),len=ab.length,src=[];
  for(let c=0;c<nc;c++)src.push(ab.getChannelData(c));
  const cl=v=>Math.max(0,Math.min(len,Math.round(v*sr)));
  let X,plan=[],seams=[];
  if(parts){   /* several parts, in list order, each joined to the next with a crossfade */
    const P=parts.map(q=>[cl(q.a),cl(q.b)]);
    X=Math.max(1,Math.round(Math.min(lp.x,Math.min(...P.map(q=>(q[1]-q[0])/sr))/3)*sr));
    P.forEach((q,k)=>{const last=k===P.length-1;plan.push(['p',k?q[0]+X:q[0],last?q[1]:q[1]-X]);if(!last)plan.push(['x',q[1]-X,P[k+1][0]])});
  }else{
    const only=lp.m==='only',A=only?cl(lp.a):cl(tr.a),B=only?cl(lp.b):cl(tr.b),la=cl(lp.a),lb=cl(lp.b),n=lp.n,end=lp.m==='end';
    X=Math.max(1,Math.round(Math.min(lp.x,(lp.b-lp.a)/3)*sr));
    let E=end?B:lb;plan.push(['p',A,E-X]);
    for(let k=1;k<=n;k++){plan.push(['x',E-X,la]);E=lb;plan.push(['p',la+X,k<n?lb-X:(end?lb:B)])}
  }
  let total=0;for(const q of plan)total+=q[0]==='x'?X:Math.max(0,q[2]-q[1]);
  if(total>sr*60*30)throw new Error('too long');
  const out=[];for(let c=0;c<nc;c++)out.push(new Float32Array(total));
  let w=0;
  for(const q of plan){
    if(q[0]==='p'){const m=Math.max(0,q[2]-q[1]);for(let c=0;c<nc;c++)out[c].set(src[c].subarray(q[1],q[1]+m),w);w+=m}
    else{seams.push((w+X/2)/sr);for(let c=0;c<nc;c++){const o=out[c],s=src[c];for(let i=0;i<X;i++){const k=(i+.5)/X*Math.PI/2;o[w+i]=s[q[1]+i]*Math.cos(k)+s[q[2]+i]*Math.sin(k)}}w+=X}
  }
  /* 16-bit PCM WAV */
  const bytes=total*nc*2,hd=new DataView(new ArrayBuffer(44)),ws=(o,t)=>{for(let i=0;i<t.length;i++)hd.setUint8(o+i,t.charCodeAt(i))};
  ws(0,'RIFF');hd.setUint32(4,36+bytes,true);ws(8,'WAVE');ws(12,'fmt ');hd.setUint32(16,16,true);hd.setUint16(20,1,true);hd.setUint16(22,nc,true);
  hd.setUint32(24,sr,true);hd.setUint32(28,sr*nc*2,true);hd.setUint16(32,nc*2,true);hd.setUint16(34,16,true);ws(36,'data');hd.setUint32(40,bytes,true);
  const chunks=[hd.buffer],CH=262144;
  for(let a=0;a<total;a+=CH){
    const m=Math.min(CH,total-a),pc=new Int16Array(m*nc);
    for(let i=0;i<m;i++)for(let c=0;c<nc;c++){let v=out[c][a+i];v=v<-1?-1:v>1?1:v;pc[i*nc+c]=v<0?v*32768:v*32767}
    chunks.push(pc.buffer);
    if((a/CH)%8===7)await new Promise(r=>setTimeout(r));   /* let the page breathe on long songs */
  }
  return {blob:new Blob(chunks,{type:'audio/wav'}),dur:total/sr,seams};
}
/* Undo: the audio file from before the first loop / join comes back */
async function undoBake(s,quiet){
  if(!s||!s.orig)return;
  const {blob,dur}=s.orig;delete s.orig;delete s.edit;
  await rfApply(s,blob,dur,{quiet:true,bake:true});
  if(!quiet){toast('Back to the original audio');render()}
}
/* remembered tempo corrections (typed, tapped or moved by hand), per song file */
const bpmLoad=k=>{try{return (JSON.parse(localStorage.getItem('tracks-bpm')||'{}'))[k]||null}catch(_){return null}};
const bpmKeep=(k,v)=>{try{const m=JSON.parse(localStorage.getItem('tracks-bpm')||'{}');delete m[k];m[k]=v;const ks=Object.keys(m);while(ks.length>80)delete m[ks.shift()];localStorage.setItem('tracks-bpm',JSON.stringify(m))}catch(_){}};
/* ===== Cut finder (experimental helper for Join parts and Loop): suggests where one piece of a song should end and the next begin so the blend sounds seamless.
   It works on a light mono copy of the song (w.m at w.msr Hz) and scores every candidate pair on what the ear notices at a crossfade:
   where it falls in the beat, whether the harmony (chroma) and loudness and tone match, and whether the waveforms line up in phase.
   Then the best few are nudged by a few milliseconds to the point where the waveforms agree best. ===== */
function cutFinder(w){
  const m=w.m,sr=w.msr,L=m.length,H=Math.max(1,Math.round(sr*.01)),nF=Math.floor(L/H);
  const E=new Float32Array(nF),BD=new Float32Array(nF);
  for(let f=0;f<nF;f++){let e=0,b=0,p=f*H?m[f*H-1]:0;for(let i=f*H,j=i+H;i<j;i++){const v=m[i],d=v-p;e+=v*v;b+=d*d;p=v}E[f]=e;BD[f]=b}
  const r3=v=>Math.round(v*1000)/1000,cl=(v,a,b)=>v<a?a:v>b?b:v;
  /* loudness (dB) and brightness (how much of the energy is high frequency) of a stretch */
  const feat=(t0,t1)=>{
    let a=cl(Math.round(t0*sr/H),0,nF),b=cl(Math.round(t1*sr/H),0,nF);if(b<=a){if(a>=nF)a=nF-1;b=a+1}
    let e=0,d=0;for(let f=a;f<b;f++){e+=E[f];d+=BD[f]}
    return {db:10*Math.log10(e/((b-a)*H)+1e-9),br:Math.log((d+1e-12)/(e+1e-12)+.01)};
  };
  /* harmony: 12-note chroma of a 0.28 s window that ends at t (role o) or starts at t (role i), from a Goertzel filter per note (C3 to B5) */
  const N=Math.max(256,Math.round(.28*sr)),win=new Float32Array(N),seg=new Float32Array(N),bins=[];
  for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/(N-1));
  for(let k=48;k<84;k++){const f=440*Math.pow(2,(k-69)/12);if(f<sr*.45)bins.push([k%12,2*Math.cos(2*Math.PI*f/sr)])}
  const CC=new Map();
  const chroma=(t,role)=>{
    const s=cl(Math.round(t*sr)-(role==='o'?N:0),0,Math.max(0,L-N)),key=s;let c=CC.get(key);if(c!==void 0)return c;
    for(let i=0;i<N;i++)seg[i]=(m[s+i]||0)*win[i];
    const v=new Float32Array(12);
    for(const [pc,co] of bins){let s1=0,s2=0;for(let i=0;i<N;i++){const s0=seg[i]+co*s1-s2;s2=s1;s1=s0}v[pc]+=Math.sqrt(Math.max(0,s1*s1+s2*s2-co*s1*s2))}
    let n=0;for(let i=0;i<12;i++)n+=v[i]*v[i];n=Math.sqrt(n);
    if(n>1e-6){for(let i=0;i<12;i++)v[i]/=n;c=v}else c=null;
    if(CC.size>4000)CC.clear();CC.set(key,c);return c;
  };
  /* waveform agreement over 40 ms at the middle of the blend, in samples */
  const Wn=Math.max(32,Math.round(.04*sr));
  const ncc=(ca,cb)=>{
    const a=Math.round(ca-Wn/2),b=Math.round(cb-Wn/2);if(a<0||b<0||a+Wn>L||b+Wn>L)return 0;
    let ab=0,aa=0,bb=0;for(let i=0;i<Wn;i++){const x=m[a+i],y=m[b+i];ab+=x*y;aa+=x*x;bb+=y*y}
    return aa>1e-9&&bb>1e-9?ab/Math.sqrt(aa*bb):0;
  };
  const circ=(d,p)=>{d=((d%p)+p)%p;return Math.min(d,p-d)};
  const WT={harm:.3,wave:.2,loud:.15,tone:.1,grid:.25};
  const score=(out,inn,X,grid)=>{
    const fo=feat(out-X,out),fi=feat(inn,inn+X),t={};
    t.loud=Math.exp(-Math.abs(fo.db-fi.db)/4);
    t.tone=Math.exp(-Math.abs(fo.br-fi.br)/.8);
    const co=chroma(out,'o'),ci=chroma(inn,'i');let cs;
    if(co&&ci){let d=0;for(let i=0;i<12;i++)d+=co[i]*ci[i];cs=cl((d-.35)/.6,0,1)}else cs=(!co&&!ci)?1:.3;
    t.harm=cs;
    t.wave=Math.max(0,ncc((out-X/2)*sr,(inn+X/2)*sr));
    let keys=['harm','wave','loud','tone'];
    if(grid&&grid.bpm>0){
      const bs=60/grid.bpm,po=(out-grid.off)/bs,pi=(inn-grid.off)/bs;
      const ao=Math.exp(-Math.pow(circ(po,1)/.05,2)),ai=Math.exp(-Math.pow(circ(pi,1)/.05,2));
      const gv=.5*Math.exp(-Math.pow(circ(pi-po,1)/.05,2))+.5*Math.exp(-Math.pow(circ(pi-po,4)/.07,2));
      t.grid=.25*(ao+ai)+.5*gv;keys=keys.concat('grid');
    }
    let sw=0,ss=0;for(const k of keys){sw+=WT[k];ss+=WT[k]*t[k]}
    return {s:ss/sw,t};
  };
  const why=t=>{
    const a=[];
    if(t.grid>=.8)a.push('on the beat');
    if(t.harm>=.8)a.push('same harmony');
    if(t.loud>=.8)a.push('even loudness');
    if(t.tone>=.8)a.push('similar tone');
    if(t.wave>=.5)a.push('waveforms line up');
    return a;
  };
  /* q: {out,inn,X,mv:'in'|'out'|'both',win,grid,oMin,oMax,iMin,iMax,ok(out,inn)} (times in seconds) */
  const run=q=>{
    const {X,mv,grid}=q,win=q.win||3;
    const span=(c,lo,hi,fixed)=>{
      if(fixed)return [c];
      const a=Math.max(lo,c-win),b=Math.min(hi,c+win);
      if(b<a)return [c];
      const arr=[];
      if(grid&&grid.bpm>0){const st=60/grid.bpm/2;for(let k=Math.ceil((a-grid.off)/st-1e-6);;k++){const t=grid.off+k*st;if(t>b+1e-6)break;arr.push(r3(t))}}
      else{const st=Math.max(.04,(b-a)/110);for(let t=a;t<=b+1e-9;t+=st)arr.push(r3(t))}
      return arr;
    };
    const O=span(q.out,q.oMin,q.oMax,mv==='in'),I=span(q.inn,q.iMin,q.iMax,mv==='out');
    const now=score(q.out,q.inn,X,grid),all=[];
    for(const a of O)for(const b of I){if(q.ok&&!q.ok(a,b))continue;const r=score(a,b,X,grid);all.push({out:a,inn:b,s:r.s,t:r.t})}
    all.sort((p,r)=>r.s-p.s);
    /* the best few are nudged by a few ms to where the waveforms agree best */
    const maxd=Math.round((grid&&grid.bpm>0?.008:.015)*sr),top=all.slice(0,12);
    for(const c of top){
      const mvIn=mv!=='out';let best=-2,bd=0;
      for(let d=-maxd;d<=maxd;d++){
        const o2=mvIn?c.out:c.out+d/sr,i2=mvIn?c.inn+d/sr:c.inn;
        const v=ncc((o2-X/2)*sr,(i2+X/2)*sr);if(v>best){best=v;bd=d}
      }
      if(bd){
        const o2=mvIn?c.out:r3(c.out+bd/sr),i2=mvIn?r3(c.inn+bd/sr):c.inn;
        if((q.ok?q.ok(o2,i2):true)&&o2>=q.oMin-1e-9&&o2<=q.oMax+1e-9&&i2>=q.iMin-1e-9&&i2<=q.iMax+1e-9){const r=score(o2,i2,X,grid);if(r.s>=c.s){c.out=o2;c.inn=i2;c.s=r.s;c.t=r.t}}
      }
    }
    top.sort((p,r)=>r.s-p.s);
    const pick=[];
    for(const c of top){if(pick.some(p=>Math.abs(p.out-c.out)<.12&&Math.abs(p.inn-c.inn)<.12))continue;pick.push(c);if(pick.length>=3)break}
    return {now:now.s,list:pick.map(c=>({out:c.out,inn:c.inn,s:c.s,why:why(c.t)}))};
  };
  return {run,score:(o,i,X,g)=>score(o,i,X,g).s};
}

const cfBox=k=>`<div class="cf" id="cf-${k}"><div class="trh"><span>${ic('search',18)}<b>Smooth the ${k==='j'?'cuts':'loop seam'}</b></span></div><p class="trs">Looks through the waveform near your cut for the spot where the two sides blend best: matching the beat, harmony, loudness and waveform. It is a guide, so always listen before saving.</p><label>What may move</label><div class="bgst" data-cfm="${k}">${(k==='j'?[['in','Start of next part'],['out','End of previous part'],['both','Both']]:[['in','Loop start'],['out','Loop end'],['both','Both']]).map(x=>`<button type="button" class="chip" data-v="${x[0]}">${x[1]}</button>`).join('')}</div><div id="cf-${k}-l"></div></div>`;
function trimSheet(s){
  if(!s)return;
  if(!s.blob)return toast('Download this song from Drive first');
  const src=s.orig||s,T=s.orig?(s.edit||{}):s,D=src.dur||0;if(!(D>=2))return toast('This song is too short to trim');
  const o={a:Math.max(0,+(T.trim&&T.trim.a)||0),b:(T.trim&&T.trim.b!=null)?Math.min(D,+T.trim.b):D,xi:s.xi!=null?+s.xi:null,xo:s.xo!=null?+s.xo:null};
  if(o.b-o.a<1){o.a=0;o.b=D}
  const lp={on:false,a:0,b:0,n:2,x:.25,m:'only'};
  const jn={a:0,b:Math.min(D,8)};   /* the part being picked for Join parts: separate from the trim handles */
  const pl=(T.parts||[]).map(q=>({a:+q.a,b:+q.b}));
  if(T.loop){lp.a=+T.loop.a||0;lp.b=+T.loop.b||0;lp.n=Math.max(1,Math.min(8,Math.round(+T.loop.n)||2));lp.x=[.1,.25,.5,1].includes(+T.loop.x)?+T.loop.x:.25;lp.m=T.loop.m==='end'?'end':T.loop.m==='only'?'only':'in';lp.on=lp.b-lp.a>=1.5}
  const ref=s.refDur>0?+s.refDur:0;
  const ft=t=>{t=Math.max(0,t);const m=Math.floor(t/60),x=t-m*60;return m+':'+(x<10?'0':'')+x.toFixed(1)};
  const lch=(k,arr)=>arr.map(x=>`<button type="button" class="chip" data-lk="${k}" data-v="${x[1]}">${x[0]}</button>`).join('');
  /* a start / end box: typed time, nudges (the big step is one beat once the tempo is known) and a button that takes the playhead */
  const tcol=(k,label)=>`<div class="tmc"><label for="tm-i-${k}">${label}</label><input type="text" inputmode="decimal" id="tm-i-${k}" aria-label="${label}, type m:ss.s" autocomplete="off"><div class="tmn"><button type="button" data-t="${k}" data-d="-B" data-bg="-"></button><button type="button" data-t="${k}" data-d="-.1">\u2212.1</button><button type="button" data-t="${k}" data-d=".1">+.1</button><button type="button" data-t="${k}" data-d="B" data-bg="+"></button></div><button type="button" class="pill" data-here="${k}">At playhead</button></div>`;
  const wv=(k,aria)=>`<div class="trw"><canvas id="tw-${k}" aria-label="${aria}"></canvas><span class="trl" id="tl-${k}">Reading waveform\u2026</span></div><div class="trov" id="to-${k}"><i></i></div><input type="range" class="rng trsl" id="ts-${k}" min="0" max="1000" step="1" value="0" aria-label="Scroll the waveform"><div class="trz"><span class="trtm" id="tr-${k}"></span><div class="trzb"><button type="button" id="tzo-${k}" aria-label="Zoom out">\u2212</button><output id="tzl-${k}">1\u00d7</output><button type="button" id="tzi-${k}" aria-label="Zoom in">+</button></div></div>`;
  openOv(`<h3>Trim &amp; loop</h3><p class="dupn">Edit \u201c${esc(s.name)}\u201d. Trim sets where it starts and ends. Join parts and Loop build a new audio file when you save, and you can always undo back to the original.</p>
  ${s.orig?`<div class="trc"><div class="trh"><span><b>Edited audio</b></span><button type="button" class="pill acc" id="tm-un">Undo, back to original</button></div><p class="dupn" style="margin:2px 0 0">You are editing from the original file. Saving builds the edited audio again.</p></div>`:''}
  <div class="tmbar" id="tm-bar">
    <button type="button" class="trp sm" id="tm-pp" aria-label="Play">${ic('play',22)}</button>
    <div class="tmt"><b id="tm-t1">0:00.0</b><span id="tm-t2"></span></div>
    <button type="button" class="trk5" id="tm-bp" data-sg="-1">\u2039 beat</button><button type="button" class="trk5" id="tm-bn" data-sg="1">beat \u203a</button>
    <button type="button" class="chip" id="tm-sn">Snap</button>
  </div>
  <div class="tmmd" id="tm-md" role="group" aria-label="Tool"><button type="button" class="chip" data-md="t">Trim</button><button type="button" class="chip" data-md="j">Join parts</button><button type="button" class="chip" data-md="l">Loop</button></div>
  <p class="trs tmmn">One tool at a time. The other two are switched off until you pick them.</p>
  <div class="trc" id="tm-tc"><div class="trh"><span class="tcl"><b>Tempo &amp; beat grid</b></span><output class="trsm" id="tm-bs"></output></div>
    <div class="tmb"><input type="text" inputmode="decimal" id="tm-bpm" aria-label="Beats per minute" autocomplete="off"><em>BPM</em><button type="button" class="pill" id="tm-h">\u00f72</button><button type="button" class="pill" id="tm-d">\u00d72</button><button type="button" class="pill" id="tm-tap">Tap</button></div>
    <label>Snap handles and playhead to</label><div class="bgst" id="tm-sg"><button type="button" class="chip" data-sv="off">Off</button><button type="button" class="chip" data-sv="half">\u00bd beat</button><button type="button" class="chip" data-sv="beat">Beat</button><button type="button" class="chip" data-sv="bar">Bar</button></div>
    <div class="trx"><button type="button" class="pill" id="tm-b1">Beat 1 at playhead</button></div>
    <div class="trs" id="tm-bt"></div>
  </div>
  <div class="trc tt" id="tm-ct"><div class="trh"><span>${ic('cut',18)}<b>Trim</b></span><output class="trsm" id="tm-ts"></output></div>
    ${wv('t','Trim waveform. Tap to move the playhead, drag the two round handles to trim.')}
    <div class="tmcols">${tcol('a','Start')}${tcol('b','End')}</div>
    <div class="trx"><button type="button" class="pill tmp" id="tm-ps">Hear start</button><button type="button" class="pill tmp" id="tm-pe">Hear end</button>${ref?'<button type="button" class="pill" id="tm-m">Match old length</button>':''}</div>
    <div class="trs" id="tm-s"></div>
  </div>
  <div class="trc tj shut" id="tm-cj"><div class="trh"><span>${ic('plus',18)}<b>Join parts</b></span><button type="button" class="chip" id="tm-jt">Show</button></div>
    <div class="tmbody">
      <p class="dupn" style="margin:6px 0 0">Mark a part with the orange handles, tap Add part, then pick another. Parts play in list order, joined with a short crossfade. The trim handles are not used here.</p>
      ${wv('j','Join waveform. Tap to move the playhead, drag the orange flags to pick a part.')}
      <div class="tmcols">${tcol('ja','Part start')}${tcol('jb','Part end')}</div>
      <div class="trx"><button type="button" class="pill acc" id="tm-pa">Add part</button><button type="button" class="pill tmp" id="tm-pjh">Hear part</button></div>
      <div id="tm-pl"></div>
      <div id="tm-pb" style="display:none"><label>Blend at the join</label><div class="bgst" id="tm-px">${lch('x',[['Tight',.1],['Soft',.25],['Long',.5],['Wide',1]])}</div><div class="trs" id="tm-psum"></div>${cfBox('j')}</div>
    </div>
  </div>
  <div class="trc tl" id="tm-cl"><div class="trh"><span>${ic('repeat',18)}<b>Loop a section</b></span><button type="button" class="chip" id="tm-lpt">Off</button></div>
    <p class="trs" id="tm-lh">Play only the part you pick (everything else is trimmed out), repeat it in place, or add it at the end, joined with a short crossfade.</p>
    <div class="tmbody" id="tm-lpb">
      ${wv('l','Loop waveform. Tap to move the playhead, drag the blue flags to choose the loop.')}
      <div class="tmcols">${tcol('la','From')}${tcol('lb','To')}</div>
      <label>Where it goes</label><div class="bgst" id="tm-lm"><button type="button" class="chip" data-lk="m" data-v="only">Only this part</button><button type="button" class="chip" data-lk="m" data-v="in">Repeat in place</button><button type="button" class="chip" data-lk="m" data-v="end">Add at the end</button></div>
      <label id="tm-lnl">Extra repeats</label><div class="bgst" id="tm-ln">${lch('n',[['1\u00d7',1],['2\u00d7',2],['3\u00d7',3],['4\u00d7',4],['6\u00d7',6],['8\u00d7',8]])}</div>
      <label>Blend at the join</label><div class="bgst" id="tm-lx">${lch('x',[['Tight',.1],['Soft',.25],['Long',.5],['Wide',1]])}</div>
      <div class="trx"><button type="button" class="pill tmp" id="tm-lt">${ic('play',14)}Test loop</button></div>
      <div class="trs" id="tm-ls"></div>
      ${cfBox('l')}
    </div>
  </div>
  <div class="trc tp" id="tm-cp"><div class="trh"><span>${ic('play',18)}<b>Preview result</b></span><output class="trsm" id="tm-pst"></output></div>
    <p class="trs" id="tm-pn">Hear the whole song the way Save will make it, before anything is changed.</p>
    <div class="tmpl"><button type="button" class="trp sm" id="tm-rp" aria-label="Play preview">${ic('play',22)}</button>
      <div class="tmpr"><input type="range" class="rng" id="tm-rs" min="0" max="1000" step="1" value="0" aria-label="Preview position"><div class="tmpk" id="tm-rk"></div><div class="tmpt"><span id="tm-rt1">0:00.0</span><span id="tm-rt2">0:00.0</span></div></div></div>
    <div class="trx" id="tm-rj"></div>
    <div class="trx"><button type="button" class="pill" id="tm-re">Hear the ending</button></div>
  </div>
  <div class="bt"><button class="pill mr" id="tm-r">Reset</button><button class="pill" id="tm-x">Cancel</button><button class="pill acc" id="tm-ok">Save</button></div>`);
  let wf=null,head=o.a,resume=false,pLeft=lp.n,pTail=0,raf=0,pvU=null,pvStop=Infinity;
  let mode=pl.length?'j':lp.on?'l':'t',stash=null,jOpen=mode==='j';
  if(mode!=='t'){stash={a:o.a,b:o.b};o.a=0;o.b=D;head=0;if(mode==='l')lp.on=lp.b-lp.a>=1.5}   /* the trim is off while another tool is in use */
  const r2=v=>Math.round(v*1000)/1000;
  /* ---- tempo grid: bpm + the time of one beat line; snapping and the lines on every waveform use it ---- */
  const bKey=s.id+':'+src.blob.size,G={bpm:0,off:0,snap:'beat',on:true,state:'wait',conf:0};
  {const m=bpmLoad(bKey);if(m&&m.b>0){G.bpm=m.b;G.off=m.o||0;G.state='man'}}
  const beatSec=()=>G.bpm>0?60/G.bpm:0;
  const MUL={half:.5,beat:1,bar:4};
  const stepSec=()=>beatSec()*MUL[G.snap];
  const snapOn=()=>G.on&&G.bpm>0;
  const clampT=v=>Math.max(0,Math.min(D,v));
  const snapT=t=>{if(!snapOn())return t;const st=stepSec();return clampT(G.off+Math.round((t-G.off)/st)*st)};
  const stepGrid=(t,dir,st)=>{const k=(t-G.off)/st,nk=dir>0?Math.floor(k+1e-4)+1:Math.ceil(k-1e-4)-1;return clampT(G.off+nk*st)};
  const keepBpm=()=>bpmKeep(bKey,{b:G.bpm,o:G.off});
  const curT=()=>pv.paused?head:pv.currentTime;
  const cleanHead=()=>snapOn()?snapT(curT()):curT();
  const clampLoop=()=>{
    if(!lp.on)return;
    if(o.b-o.a<2.2){lp.on=false;return}
    lp.a=Math.max(o.a,lp.a);lp.b=Math.min(o.b-.2,lp.b);
    if(lp.b-lp.a<1.5){if(lp.a+1.5<=o.b-.2)lp.b=lp.a+1.5;else{lp.b=o.b-.2;lp.a=lp.b-1.5}}
    lp.a=r2(lp.a);lp.b=r2(lp.b);
  };
  clampLoop();
  /* ---- three waveforms, each with its own zoom and handles; the playhead is shared ---- */
  const FLAG={t:null,j:'255,170,60',l:'90,170,255'};
  const mkView=key=>{
    const cv=$('#tw-'+key),V={key,cv,ctx:cv.getContext('2d'),z:1,vs:0,drag:null,od:false,ac:null,tx:null};
    V.span=()=>D/V.z;
    V.clamp=()=>{V.vs=Math.max(0,Math.min(V.vs,D-V.span()))};
    V.px=t=>(t-V.vs)/V.span()*cv.clientWidth;
    V.tAt=x=>V.vs+Math.max(0,Math.min(1,x/(cv.clientWidth||1)))*V.span();
    V.fit=(a,b)=>{V.z=Math.max(1,Math.min(32,D/Math.max(1,(b-a)*1.5)));V.vs=(a+b)/2-V.span()/2;V.clamp()};
    return V;
  };
  const VS={t:mkView('t'),j:mkView('j'),l:mkView('l')},VL=[VS.t,VS.j,VS.l];
  if(lp.on)VS.l.fit(lp.a,lp.b);
  const handlesOf=V=>V.key==='t'?[['a',o.a],['b',o.b]]:V.key==='j'?[['ja',jn.a],['jb',jn.b]]:lp.on?[['la',lp.a],['lb',lp.b]]:[];
  const drawV=V=>{
    const cv=V.cv,ctx=V.ctx,r=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;if(!w)return;
    if(cv.width!==Math.round(w*r)||cv.height!==Math.round(h*r)){cv.width=Math.round(w*r);cv.height=Math.round(h*r)}
    if(!V.ac){V.ac=getComputedStyle(cv).color;V.tx=getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#fff'}
    ctx.setTransform(r,0,0,r,0,0);ctx.clearRect(0,0,w,h);
    const k=V.key,ac=V.ac,sp=V.span(),N=wf?wf.p.length:0,mu='rgba(128,128,128,.4)';
    const ra=k==='t'?o.a:k==='j'?jn.a:lp.a,rb=k==='t'?o.b:k==='j'?jn.b:lp.b,showR=k!=='l'||lp.on;
    const xa=V.px(ra),xb=V.px(rb);
    for(let x=0;x<w;x+=3){
      let v;
      if(wf){let i0=Math.max(0,Math.floor((V.vs+x/w*sp)/D*N)),i1=Math.min(N-1,Math.max(i0,Math.ceil((V.vs+(x+3)/w*sp)/D*N)-1));v=0;for(let i=i0;i<=i1;i++)if(wf.p[i]>v)v=wf.p[i]}
      else v=.14+.08*Math.sin((V.vs+x/w*sp)/D*120);
      const bh=Math.max(2,v*(h-34));
      ctx.fillStyle=(showR&&x+2>=xa&&x<=xb)?ac:mu;ctx.fillRect(x,(h-bh)/2,2,bh);
    }
    if(k==='l'){   /* a loop lives inside the trim: show what is trimmed away as dimmed */
      ctx.fillStyle='rgba(0,0,0,.38)';const ta=V.px(o.a),tb=V.px(o.b);
      if(ta>0)ctx.fillRect(0,0,Math.min(w,ta),h);if(tb<w)ctx.fillRect(Math.max(0,tb),0,w-Math.max(0,tb),h);
      if(lp.on&&lp.m==='only'){const la=V.px(lp.a),lb=V.px(lp.b);if(la>0)ctx.fillRect(0,0,Math.min(w,la),h);if(lb<w)ctx.fillRect(Math.max(0,lb),0,w-Math.max(0,lb),h)}   /* only the picked part is kept */
    }
    /* beat lines: faint on the beat, stronger where a bar starts */
    const bs=beatSec();
    if(bs>0){
      const ppb=bs/sp*w;
      if(ppb*4>=6){
        const k0=Math.ceil((V.vs-G.off)/bs),k1=Math.floor((V.vs+sp-G.off)/bs);
        ctx.fillStyle=V.tx;
        for(let q=k0;q<=k1;q++){
          const bar=((q%4)+4)%4===0;if(ppb<6&&!bar)continue;
          const x=Math.round(V.px(G.off+q*bs));
          ctx.globalAlpha=bar?.5:.2;ctx.fillRect(x,0,bar?2:1,h);
          if(G.snap==='half'&&ppb>=26){ctx.globalAlpha=.1;ctx.fillRect(Math.round(V.px(G.off+(q+.5)*bs)),h*.3,1,h*.4)}
        }
        ctx.globalAlpha=1;
      }
    }
    const tri=(x,y,dx,dy)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y);ctx.lineTo(x,y+dy);ctx.fill()};
    if(k==='t'){
      ctx.fillStyle=ac;ctx.fillRect(xa-1.5,0,3,h);ctx.fillRect(xb-1.5,0,3,h);
      [xa,xb].forEach(x=>{ctx.beginPath();ctx.arc(x,h/2,10,0,6.2832);ctx.fill()});
      ctx.fillStyle='#fff';[xa,xb].forEach(x=>{ctx.fillRect(x-1,h/2-4,2,8)});
    }else if(k==='j'){
      const OC='255,170,60';
      pl.forEach((q,i)=>{const a=V.px(q.a),b=V.px(q.b);ctx.fillStyle='rgba(255,170,60,.22)';ctx.fillRect(a,0,b-a,h);ctx.fillStyle='rgba(255,170,60,.9)';ctx.fillRect(a,0,2,h);ctx.fillRect(b-2,0,2,h);ctx.font='700 12px sans-serif';ctx.fillText(String(i+1),a+6,h-8)});
      ctx.fillStyle='rgba('+OC+',.12)';ctx.fillRect(xa,0,xb-xa,h);ctx.fillStyle='rgb('+OC+')';ctx.fillRect(xa-1,0,2,h);ctx.fillRect(xb-1,0,2,h);
      tri(xa,0,16,16);tri(xb,0,-16,16);tri(xa,h,16,-16);tri(xb,h,-16,-16);
    }else if(lp.on){
      const LC='90,170,255';
      ctx.fillStyle='rgba('+LC+',.18)';ctx.fillRect(xa,0,xb-xa,h);ctx.fillStyle='rgb('+LC+')';ctx.fillRect(xa-1,0,2,h);ctx.fillRect(xb-1,0,2,h);
      tri(xa,0,16,16);tri(xb,0,-16,16);tri(xa,h,16,-16);tri(xb,h,-16,-16);
    }
    if(head>=V.vs&&head<=V.vs+sp){
      const x=Math.round(V.px(head));   /* always white with a dark edge, so it reads on any waveform and theme */
      ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x-2.5,0,5,h);ctx.fillStyle='#fff';ctx.fillRect(x-1,0,2,h);
      ctx.lineJoin='round';ctx.lineWidth=1.5;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.fillStyle='#fff';
      for(const [y,d] of [[0,1],[h,-1]]){ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.lineTo(x,y+d*12);ctx.closePath();ctx.fill();ctx.stroke()}
    }
  };
  const light=()=>{
    $('#tm-t1').textContent=ft(head);$('#tm-t2').textContent=' / '+ft(D);
    VL.forEach(V=>{
      const t=$('#to-'+V.key+' i');if(t){t.style.left=(V.vs/D*100)+'%';t.style.width=(100/V.z)+'%'}
      const sl=$('#ts-'+V.key);if(sl&&!V.sd){const rg=D-V.span();sl.value=rg>0?Math.round(V.vs/rg*1000):0;sl.style.setProperty('--p',(sl.value/10)+'%')}
      const e=$('#tr-'+V.key);if(e)e.textContent=V.z>1?ft(V.vs)+' \u2013 '+ft(V.vs+V.span()):'Whole song';
      drawV(V);
    });
  };
  const plPaint=()=>{
    const el=$('#tm-pl');if(!el)return;
    el.innerHTML=pl.map((q,i)=>`<div class="trn"><span class="trk">${i+1}</span><div class="trb"><output style="flex:1;min-width:0">${ft(q.a)} \u2013 ${ft(q.b)} (${fmt(q.b-q.a)})</output><button type="button" data-pp="hear" data-i="${i}" aria-label="Hear part ${i+1}">\u25b6</button><button type="button" data-pp="up" data-i="${i}" aria-label="Move up">\u2191</button><button type="button" data-pp="dn" data-i="${i}" aria-label="Move down">\u2193</button><button type="button" data-pp="ed" data-i="${i}" aria-label="Edit part">\u270e</button><button type="button" data-pp="rm" data-i="${i}" aria-label="Remove part">\u2715</button></div></div>`).join('');
    $('#tm-pb').style.display=pl.length?'':'none';
    document.querySelectorAll('#tm-px .chip').forEach(c=>c.classList.toggle('on',String(lp.x)===c.dataset.v));
    const tot=pl.reduce((n,q)=>n+q.b-q.a,0);
    $('#tm-psum').textContent=pl.length>1?`${pl.length} parts, about ${fmt(tot)} in total. Use the arrows to reorder, \u270e to load a part back into the handles, \u2715 to remove it.`:'Add one more part to join them. A single part is the same as a trim.';
  };
  const SNL={half:'\u00bd beat',beat:'beat',bar:'bar'};
  const paint=()=>{
    const bs=beatSec(),lab=bs?(G.on?SNL[G.snap]:'beat'):'1 s';
    document.querySelectorAll('#ov [data-bg]').forEach(e=>{e.textContent=(e.dataset.bg==='-'?'\u2212':'+')+lab});
    [['a',o.a],['b',o.b],['la',lp.a],['lb',lp.b],['ja',jn.a],['jb',jn.b]].forEach(([k,v])=>{const e=$('#tm-i-'+k);if(e&&document.activeElement!==e)e.value=ft(v)});
    const len=o.b-o.a,cut=o.a>=.05||o.b<D-.05;
    $('#tm-ts').textContent=cut?fmt(len)+' of '+fmt(D):'Whole song';
    let t=`Plays ${fmt(len)}${cut?' of '+fmt(D):''}`;
    if(ref){const d=len-ref;t+=Math.abs(d)<.5?'. Matches the song you replaced.':`. The song you replaced was ${fmt(ref)}, so this is ${fmt(Math.abs(d))} ${d>0?'longer':'shorter'}.`}
    $('#tm-s').textContent=t;
    $('#tm-ct').classList.toggle('off',mode!=='t');$('#tm-cj').classList.toggle('off',mode!=='j');$('#tm-cl').classList.toggle('off',mode!=='l');
    document.querySelectorAll('#tm-md .chip').forEach(c=>c.classList.toggle('on',c.dataset.md===mode));
    /* join */
    $('#tm-cj').classList.toggle('shut',mode!=='j');$('#tm-jt').textContent=jOpen?'Hide':pl.length?pl.length+(pl.length===1?' part':' parts'):'Show';$('#tm-jt').classList.toggle('on',pl.length>0);
    /* loop */
    const lt=$('#tm-lpt');lt.textContent=lp.on?'On':'Off';lt.classList.toggle('on',lp.on);
    $('#tm-lpb').style.display=lp.on?'':'none';$('#tm-lh').style.display=lp.on?'none':'';
    if(lp.on){
      document.querySelectorAll('#tm-lm .chip,#tm-ln .chip,#tm-lx .chip').forEach(c=>c.classList.toggle('on',String(lp[c.dataset.lk])===c.dataset.v));
      $('#tm-lnl').textContent=lp.m==='end'?'Times added at the end':lp.m==='only'?'Extra repeats of the part':'Extra repeats';
      const L=lp.b-lp.a;
      $('#tm-ls').textContent=lp.m==='only'?`Keeps only ${ft(lp.a)} to ${ft(lp.b)} (${fmt(L)}) and trims the rest of the song. The part plays ${lp.n+1} ${lp.n+1===1?'time':'times'}, about ${fmt(L*(lp.n+1))} in total.`:lp.m==='end'?`Plays the song, then adds ${ft(lp.a)} to ${ft(lp.b)} (${fmt(L)}) at the end${lp.n>1?', '+lp.n+' times':''}. That adds ${fmt(L*lp.n)} to the song.`:`Plays ${ft(lp.a)} to ${ft(lp.b)} (${fmt(L)}) ${lp.n} extra ${lp.n===1?'time':'times'}, then carries on. That adds ${fmt(L*lp.n)} to the song.`;
    }
    plPaint();cfPaint('j');cfPaint('l');
    /* tempo card and transport */
    const bi=$('#tm-bpm');if(bi&&document.activeElement!==bi)bi.value=G.bpm?String(+G.bpm.toFixed(2)):'';
    document.querySelectorAll('#tm-sg .chip').forEach(c=>{const v=c.dataset.sv;c.classList.toggle('on',v==='off'?!G.on:(G.on&&G.snap===v));c.classList.toggle('dis',!bs)});
    const sn=$('#tm-sn');sn.textContent=bs?(G.on?'Snap on':'Snap off'):'No grid';sn.classList.toggle('on',snapOn());sn.classList.toggle('dis',!bs);
    $('#tm-bp').textContent=bs?'\u2039 beat':'\u22123 s';$('#tm-bn').textContent=bs?'beat \u203a':'+3 s';
    $('#tm-bs').textContent=G.state==='wait'?'Listening\u2026':G.state==='none'&&!bs?'Not found':G.state==='man'?'Set by you':G.conf<1.8?'Unsure':'Detected';
    $('#tm-bt').textContent=G.state==='wait'?'Listening for the beat. You can keep editing meanwhile.':
      !bs?'No steady beat found. Type a BPM or tap the tempo, then move the playhead to a beat and press Beat 1 at playhead.':
      (G.state==='man'?'Faint lines are beats and bold lines start a bar.':G.conf<1.8?'The beat was hard to hear, so check the lines by ear. Try \u00f72 or \u00d72, or press Beat 1 at playhead on a beat.':'Faint lines are beats and bold lines start a bar. If they sit on the wrong beat, try \u00f72 or \u00d72, or press Beat 1 at playhead on a beat.');
    $('#tm-b1').disabled=!bs;
    rpSync();
    ['h','d'].forEach(i=>{$('#tm-'+i).disabled=!bs});
    const sz=VL.map(V=>{const z=Math.round(V.z*10)/10;$('#tzl-'+V.key).textContent=z+'\u00d7';$('#to-'+V.key).style.display=V.z>1?'':'none';$('#ts-'+V.key).style.display=V.z>1?'block':'none'});
    light();
  };
  const set=(k,v)=>{
    v=r2(v);
    if(k==='ja'){jn.a=Math.max(0,Math.min(v,jn.b-1));return paint()}
    if(k==='jb'){jn.b=Math.min(D,Math.max(v,jn.a+1));return paint()}
    if(k==='a')o.a=Math.max(0,Math.min(v,o.b-1));
    else if(k==='b')o.b=Math.min(D,Math.max(v,o.a+1));
    else if(!lp.on)return;
    else if(k==='la'){lp.a=v;if(lp.b-lp.a<1.5)lp.b=lp.a+1.5}
    else if(k==='lb'){lp.b=v;if(lp.b-lp.a<1.5)lp.a=lp.b-1.5}
    clampLoop();paint();
  };
  const val=k=>({a:o.a,b:o.b,la:lp.a,lb:lp.b,ja:jn.a,jb:jn.b})[k];
  /* hear it through a separate player, so the main one is left alone */
  const pv=new Audio();pv.preload='auto';
  const setPlaying=b=>{const p=$('#tm-pp');if(!p)return;p.classList.toggle('on',b);p.innerHTML=ic(b?'pause':'play',22);p.setAttribute('aria-label',b?'Pause':'Play')};
  const stopPv=()=>{
    pv.pause();lpStop();pv.volume=uvol;setPlaying(false);cancelAnimationFrame(raf);
    document.querySelectorAll('#ov .tmp').forEach(b=>b.classList.remove('acc'));
    if(!pv.paused||pv.currentTime)head=Math.min(D,pv.currentTime||head);
    if($('#tm-c')||$('#tw-t'))light();
  };
  const frame=()=>{
    if(pv.paused)return;
    head=pv.currentTime;
    if(!LP.busy&&head>=pvStop-.03){stopPv();return}
    VL.forEach(V=>{if(V.z>1&&(head>V.vs+V.span()*.92||head<V.vs)){V.vs=head-V.span()*.1;V.clamp()}});
    light();raf=requestAnimationFrame(frame);
  };
  const playPv=(from,to,btn)=>{
    if(!pvU){pvU=URL.createObjectURL(src.blob);pv.src=pvU}
    if(!au.paused){au.pause();resume=true}
    document.querySelectorAll('#ov .tmp').forEach(b=>b.classList.remove('acc'));
    rpStop();lpStop();cfStop();pvStop=to==null?Infinity:to;head=from;pLeft=lp.n;pTail=0;
    try{pv.currentTime=from}catch(_){}
    pv.volume=uvol;
    pv.play().then(()=>{setPlaying(true);if(btn)btn.classList.add('acc');cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}).catch(()=>toast('Could not play this file'));
  };
  pv.onended=stopPv;
  /* ---- preview of the result: built with the same code Save uses, then played in its own player. Nothing is stored. ---- */
  const rp=new Audio();rp.preload='auto';
  const rpS={key:'',u:null,off:0,dur:0,seams:[],kind:'',busy:false,on:false,sd:false,raf:0};
  const rpPlan=()=>{
    const t=mode==='t';let a=t?o.a:0,b=t?o.b:D,P=mode==='j'?pl.map(q=>({a:q.a,b:q.b})):[];
    if(P.length===1){a=P[0].a;b=P[0].b;P=[]}
    const join=P.length>=2,loop=!join&&mode==='l'&&lp.on&&lp.b-lp.a>=1.5;
    return {join,loop,a,b,P};
  };
  const rpKey=()=>{const p=rpPlan();return JSON.stringify([p.join?p.P.map(q=>[q.a,q.b]):0,p.loop?[lp.a,lp.b,lp.n,lp.m]:0,(p.join||p.loop)?lp.x:0,p.a,p.b])};
  const rpIc=b=>{const e=$('#tm-rp');if(!e)return;e.classList.toggle('on',b);e.innerHTML=ic(b?'pause':'play',22);e.setAttribute('aria-label',b?'Pause preview':'Play preview')};
  const rpStop=()=>{cancelAnimationFrame(rpS.raf);if(!rpS.on&&rp.paused)return;rp.pause();rpS.on=false;rpIc(false)};
  const rpT=()=>Math.max(0,Math.min(rpS.dur,rp.currentTime-rpS.off));
  const rpDraw=()=>{
    const e=$('#tm-rs');if(!e)return;const t=rpT();
    if(!rpS.sd)e.value=rpS.dur?Math.round(t/rpS.dur*1000):0;
    e.style.setProperty('--p',(e.value/10)+'%');
    $('#tm-rt1').textContent=ft(t);$('#tm-rt2').textContent=rpS.u?ft(rpS.dur):'0:00.0';
  };
  const rpFrame=()=>{
    if(rp.paused)return;
    if(rpT()>=rpS.dur-.03){rpStop();rpDraw();return}
    rpDraw();rpS.raf=requestAnimationFrame(rpFrame);
  };
  const rpFresh=()=>!!rpS.u&&rpS.key===rpKey();
  const rpSync=()=>{
    const st=$('#tm-pst');if(!st)return;
    const p=rpPlan(),fresh=rpFresh(),cut=p.a>=.05||p.b<D-.05;
    const what=p.join?'Joined parts':p.loop?(lp.m==='end'?'Part added at the end':lp.m==='only'?'Selected part only':'Looped section'):cut?'Trimmed song':'Whole song, no changes';
    st.textContent=rpS.busy?'Building\u2026':fresh?what+' \u00b7 '+fmt(rpS.dur):what;
    $('#tm-pn').textContent=rpS.busy?'Building the preview from your edits\u2026':!rpS.u||fresh?'Hear the whole song the way Save will make it, before anything is changed.':'You changed something since this preview was built. Press play to hear the new version.';
    $('#tm-rk').innerHTML=fresh?rpS.seams.map(t=>'<i style="left:'+(t/rpS.dur*100)+'%"></i>').join(''):'';
    $('#tm-rj').innerHTML=fresh?rpS.seams.map((t,i)=>'<button type="button" class="chip" data-sm="'+i+'">'+(rpS.kind==='j'?'Join ':'Loop ')+(i+1)+' \u00b7 '+ft(t)+'</button>').join(''):'';
    const b=$('#tm-rp');if(b)b.disabled=rpS.busy;
  };
  const rpBuild=async()=>{
    if(rpFresh())return true;
    const p=rpPlan(),key=rpKey();rpStop();rpS.busy=true;rpSync();
    try{
      let blob=src.blob,dur=p.b-p.a,off=p.a,seams=[];
      if(p.join||p.loop){const r=await bakeLoop(src.blob,{a:p.a,b:p.b},{a:lp.a,b:lp.b,n:lp.n,x:lp.x,m:lp.m},p.join?p.P:null);blob=r.blob;dur=r.dur;off=0;seams=r.seams||[]}
      if(!$('#tm-rp'))return false;   /* the sheet was closed while building */
      if(rpS.u)URL.revokeObjectURL(rpS.u);
      rpS.u=URL.createObjectURL(blob);rp.src=rpS.u;
      Object.assign(rpS,{key,off,dur,seams,kind:p.join?'j':'l'});
      return true;
    }catch(e){console.warn('preview failed',e);toast('Could not build the preview. This song may be too long.');return false}
    finally{rpS.busy=false;if($('#tm-rp')){rpSync();rpDraw()}}
  };
  const rpPlay=async from=>{
    if(rpS.busy)return;
    if(!(await rpBuild()))return;
    if(!pv.paused)stopPv();cfStop();
    if(!au.paused){au.pause();resume=true}
    const t=from!=null?from:(rpT()>=rpS.dur-.1?0:rpT());
    if(rp.readyState<1)await new Promise(r=>{rp.addEventListener('loadedmetadata',r,{once:true});setTimeout(r,1500)});
    try{rp.currentTime=rpS.off+Math.max(0,Math.min(rpS.dur-.05,t))}catch(_){}
    rp.volume=uvol;
    rp.play().then(()=>{rpS.on=true;rpIc(true);cancelAnimationFrame(rpS.raf);rpS.raf=requestAnimationFrame(rpFrame)}).catch(()=>toast('Could not play the preview'));
  };
  rp.onended=()=>{rpStop();rpDraw()};
  $('#tm-rp').onclick=()=>{if(rpS.on)rpStop();else rpPlay()};
  $('#tm-re').onclick=async()=>{if(rpS.busy)return;if(!(await rpBuild()))return;rpPlay(Math.max(0,rpS.dur-10))};
  $('#tm-rj').onclick=e=>{const b=e.target.closest('[data-sm]');if(b)rpPlay(Math.max(0,rpS.seams[+b.dataset.sm]-2.5))};
  {const e=$('#tm-rs');
   e.oninput=()=>{if(!rpS.u){e.value=0;return}rpS.sd=true;try{rp.currentTime=rpS.off+e.value/1000*rpS.dur}catch(_){}rpDraw()};
   e.onchange=e.onpointerup=e.onblur=()=>{rpS.sd=false}}
  const seekTo=t=>{
    head=Math.max(0,Math.min(D,t));pLeft=lp.n;pTail=0;
    if(LP.busy)lpStop();
    if(pvU){try{pv.currentTime=head}catch(_){}}
    light();
  };
  /* tap a waveform to move the playhead; drag a handle to move it. With Snap on, both land on the beat lines. */
  const hitV=(V,e)=>{
    const x=e.clientX-V.cv.getBoundingClientRect().left;
    let best=null,bd=28;
    for(const [k,t] of handlesOf(V)){const d=Math.abs(x-V.px(t));if(d<bd){bd=d;best=k}}
    return best;
  };
  const mvV=(V,e)=>{
    if(!V.drag)return;
    const rc=V.cv.getBoundingClientRect(),t=V.tAt(e.clientX-rc.left),q=V.span()/(rc.width||1)<.05?100:10,v=snapOn()?snapT(t):Math.round(t*q)/q;
    if(V.drag==='seek')seekTo(v);else set(V.drag,v);
  };
  const setZ=(V,n)=>{
    const c=(head>=V.vs&&head<=V.vs+V.span())?head:V.vs+V.span()/2;
    V.z=Math.max(1,Math.min(32,n));V.vs=c-V.span()/2;V.clamp();paint();
  };
  VL.forEach(V=>{
    V.cv.onpointerdown=e=>{V.drag=hitV(V,e)||'seek';try{V.cv.setPointerCapture(e.pointerId)}catch(_){}mvV(V,e)};
    V.cv.onpointermove=e=>mvV(V,e);V.cv.onpointerup=V.cv.onpointercancel=()=>{V.drag=null};
    V.cv.addEventListener('wheel',e=>{   /* desktop: ctrl + wheel zooms, shift + wheel or a sideways swipe scrolls */
      if(e.ctrlKey||e.metaKey){e.preventDefault();const rc=V.cv.getBoundingClientRect(),t=V.tAt(e.clientX-rc.left);V.z=Math.max(1,Math.min(32,V.z*(e.deltaY<0?1.25:.8)));V.vs=t-(e.clientX-rc.left)/(rc.width||1)*V.span();V.clamp();paint()}
      else if(V.z>1&&(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))){e.preventDefault();V.vs+=(e.deltaX||e.deltaY)/(V.cv.clientWidth||1)*V.span();V.clamp();light()}
    },{passive:false});
    $('#tzi-'+V.key).onclick=()=>setZ(V,V.z*2);$('#tzo-'+V.key).onclick=()=>setZ(V,V.z/2);
    const ov=$('#to-'+V.key),ovMv=e=>{if(!V.od)return;const rc=ov.getBoundingClientRect();V.vs=(e.clientX-rc.left)/rc.width*D-V.span()/2;V.clamp();light()};
    const ss=$('#ts-'+V.key);
    ss.oninput=()=>{V.sd=true;const rg=D-V.span();V.vs=rg>0?ss.value/1000*rg:0;V.clamp();light()};
    ss.onchange=ss.onpointerup=ss.onblur=()=>{V.sd=false};
    ov.onpointerdown=e=>{V.od=true;try{ov.setPointerCapture(e.pointerId)}catch(_){}ovMv(e)};
    ov.onpointermove=ovMv;ov.onpointerup=ov.onpointercancel=()=>{V.od=false};
  });
  const ppAct=(k,i)=>{
    const q=pl[i];if(!q)return;
    if(k==='rm')pl.splice(i,1);
    else if(k==='up'&&i>0)[pl[i-1],pl[i]]=[pl[i],pl[i-1]];
    else if(k==='dn'&&i<pl.length-1)[pl[i+1],pl[i]]=[pl[i],pl[i+1]];
    else if(k==='ed'){jn.a=q.a;jn.b=q.b;pl.splice(i,1);VS.j.fit(q.a,q.b)}
    else if(k==='hear'){stopPv();playPv(q.a,q.b,null);return}
    paint();
  };
  const pT=v=>{v=String(v).trim().replace(',','.');const m=v.split(':');if(m.length>3||m.some(x=>x===''||isNaN(+x)))return NaN;return m.reduce((n,x)=>n*60+(+x),0)};
  /* every time box can be typed into: 1:23.4 or 83.4, then Enter */
  ['a','b','la','lb','ja','jb'].forEach(k=>{const e=$('#tm-i-'+k);
    e.onchange=()=>{const v=pT(e.value);if(isFinite(v))set(k,Math.min(D,Math.max(0,v)));e.blur();paint()};
    e.onkeydown=ev=>{if(ev.key==='Enter')e.blur()};e.onfocus=()=>e.select()});
  /* tempo controls */
  const setBpm=(b,off)=>{G.bpm=Math.max(30,Math.min(300,r2(b)));if(off!=null)G.off=off;G.state='man';keepBpm();paint()};
  {const bi=$('#tm-bpm');
   bi.onchange=()=>{const v=parseFloat(String(bi.value).replace(',','.'));if(v>=30&&v<=300)setBpm(v);else paint();bi.blur()};
   bi.onkeydown=ev=>{if(ev.key==='Enter')bi.blur()};bi.onfocus=()=>bi.select()}
  $('#tm-h').onclick=()=>{if(G.bpm)setBpm(G.bpm/2)};
  $('#tm-d').onclick=()=>{if(G.bpm)setBpm(G.bpm*2)};
  $('#tm-b1').onclick=()=>{const b=beatSec();if(!b)return;const t=curT();G.off=((t%b)+b)%b;G.state='man';keepBpm();paint()};
  let taps=[];
  $('#tm-tap').onclick=()=>{
    const n=performance.now();if(taps.length&&n-taps[taps.length-1]>2500)taps=[];
    taps.push(n);if(taps.length>10)taps.shift();
    if(taps.length>=3){const iv=(taps[taps.length-1]-taps[0])/(taps.length-1);const b=60000/iv;if(b>=30&&b<=300){const keepOff=G.bpm>0?G.off:undefined;setBpm(b,keepOff)}}
    else toast('Keep tapping on the beat');
  };
  $('#tm-sn').onclick=()=>{if(!beatSec())return toast('Set a BPM first');G.on=!G.on;paint()};
  $('#ov .sheet').addEventListener('click',e=>{
    const pp=e.target.closest('[data-pp]');if(pp)return ppAct(pp.dataset.pp,+pp.dataset.i);
    const n=e.target.closest('[data-t]');
    if(n){
      const k=n.dataset.t,d=n.dataset.d,cur=val(k),bs=beatSec();
      if(d==='B'||d==='-B'){const dir=d[0]==='-'?-1:1;return set(k,bs?stepGrid(cur,dir,G.on?stepSec():bs):cur+dir)}
      return set(k,cur+parseFloat(d));
    }
    const hr=e.target.closest('[data-here]');if(hr)return set(hr.dataset.here,cleanHead());
    const sv=e.target.closest('[data-sv]');if(sv){if(!beatSec())return toast('Set a BPM first');const v=sv.dataset.sv;if(v==='off')G.on=false;else{G.on=true;G.snap=v}return paint()}
    const l=e.target.closest('.chip[data-lk]');if(l){lp[l.dataset.lk]=l.dataset.lk==='m'?l.dataset.v:+l.dataset.v;pLeft=lp.n;pTail=0;paint();return}
    const sg=e.target.closest('[data-sg]');if(sg){const d=+sg.dataset.sg,bs=beatSec();seekTo(bs?stepGrid(curT(),d,bs):curT()+d*3)}
  });
  $('#tm-pp').onclick=()=>{if(!pv.paused)return stopPv();playPv(head>=D-.1?o.a:head,null,null)};
  $('#tm-jt').onclick=()=>setMode(mode==='j'?'t':'j');
  $('#tm-pa').onclick=()=>{if(jn.b-jn.a<1)return toast('Pick a longer part');pl.push({a:jn.a,b:jn.b});lp.on=false;paint()};
  $('#tm-pjh').onclick=e=>hearBtn(e.currentTarget,jn.a,jn.b);
  if(ref)$('#tm-m').onclick=()=>{
    let a=o.a,b=a+ref;if(b>D){b=D;a=Math.max(0,D-ref)}
    if(b-a<1)return toast('The old length is too short to match');
    o.a=r2(a);o.b=r2(b);clampLoop();paint();
  };
  const hearBtn=(btn,from,to)=>{const was=btn.classList.contains('acc');stopPv();if(was)return;playPv(from,to,btn)};
  $('#tm-ps').onclick=e=>hearBtn(e.currentTarget,o.a,Math.min(o.b,o.a+5));
  $('#tm-pe').onclick=e=>hearBtn(e.currentTarget,Math.max(o.a,o.b-5),o.b);
  $('#tm-lt').onclick=e=>{if(lp.on)hearBtn(e.currentTarget,lp.m==='end'?Math.max(0,o.b-5):lp.m==='only'?lp.a:Math.max(0,lp.a-3),lp.m==='end'||lp.m==='only'?null:Math.min(D,lp.b+4))};
  const enableLoop=()=>{
    if(o.b-o.a<2.2)return false;
    lp.on=true;
    if(!(lp.b-lp.a>=1.5)||lp.b<=o.a||lp.a>=o.b){
      const h=snapOn()?snapT(Math.max(o.a,Math.min(head,o.b-4))):Math.max(o.a,Math.min(head,o.b-4));
      lp.a=h;lp.b=Math.min(o.b-.2,h+(beatSec()?Math.max(1.5,Math.round(8/(beatSec()*4))*beatSec()*4):8));
      if(snapOn())lp.b=Math.min(o.b-.2,snapT(lp.b));
    }
    clampLoop();pLeft=lp.n;VS.l.fit(lp.a,lp.b);return lp.on;
  };
  /* ---- Smooth cuts: suggests better cut points for a join or a loop seam, from the waveform (see cutFinder) ---- */
  const CF={mv:{j:'in',l:'both'},sig:{j:'',l:''},res:{j:{},l:{}},tm:{j:0,l:0},fnd:null,fw:null,busy:false,ad:null,u:null};
  const cfFinder=()=>{if(!wf||!wf.m)return null;if(CF.fw!==wf){CF.fw=wf;CF.fnd=cutFinder(wf)}return CF.fnd};
  const cfGrid=()=>G.bpm>0?{bpm:G.bpm,off:G.off}:null;
  const cfX=k=>Math.max(.05,k==='l'?Math.min(lp.x,(lp.b-lp.a)/3):lp.x);
  const cfSeams=k=>{
    const S=[];
    if(k==='j'){
      for(let i=0;i+1<pl.length;i++){const A=pl[i],B=pl[i+1];
        S.push({label:'Part '+(i+1)+' \u2192 '+(i+2),nout:'end of part '+(i+1),nin:'start of part '+(i+2),out:A.b,inn:B.a,oMin:A.a+1,oMax:D,iMin:0,iMax:B.b-1,ok:null,set:(a,b)=>{A.b=a;B.a=b}})}
      if(pl.length&&jn.b-jn.a>=1){const A=pl[pl.length-1];
        S.push({label:'Part '+pl.length+' \u2192 the part you are picking',nout:'end of part '+pl.length,nin:'part start',out:A.b,inn:jn.a,oMin:A.a+1,oMax:D,iMin:0,iMax:jn.b-1,ok:null,set:(a,b)=>{A.b=a;jn.a=b}})}
    }else if(lp.on){
      S.push({label:'Loop end \u2192 loop start',nout:'loop end',nin:'loop start',out:lp.b,inn:lp.a,oMin:o.a+1.5,oMax:o.b-.2,iMin:o.a,iMax:o.b-1.7,ok:(a,b)=>a-b>=1.5,set:(a,b)=>{lp.a=b;lp.b=a}})}
    return S;
  };
  const cfDesc=(S,c)=>{const b=[];if(Math.abs(c.inn-S.inn)>5e-4)b.push(S.nin+' to '+ft(c.inn));if(Math.abs(c.out-S.out)>5e-4)b.push(S.nout+' to '+ft(c.out));return b.length?'Move '+b.join(' and '):'Keep both points'};
  const cfRes=(k,i)=>{
    const box=$('#cf-'+k+'-r'+i);if(!box)return;const h=CF.res[k][i],S=cfSeams(k)[i];
    if(!h||!S){box.innerHTML='';return}
    const L=h.r.list.filter(c=>c.s>h.r.now+.02);h.L=L;
    box.innerHTML=L.length?L.map((c,n)=>`<div class="cfc"><div class="cfct"><span><b>${Math.round(c.s*100)}%</b> fit</span><span>${cfDesc(S,c)}</span>${c.why.length?'<small>'+c.why.join(', ')+'</small>':''}</div><div class="trx cfcb"><button type="button" class="pill tmp" data-cfh="${k}:${i}:${n}">Hear</button><button type="button" class="pill acc" data-cfu="${k}:${i}:${n}">Use</button></div></div>`).join(''):'<p class="trs">Nothing better nearby. This cut already fits about as well as this part of the song allows.</p>';
  };
  const cfPaint=k=>{
    const host=$('#cf-'+k);if(!host)return;
    const S=cfSeams(k),ready=!!(wf&&wf.m),sig=S.map(x=>x.label).join('|')+'|'+(ready?1:0);
    if(sig!==CF.sig[k]){
      CF.sig[k]=sig;CF.res[k]={};
      $('#cf-'+k+'-l').innerHTML=S.length?S.map((x,i)=>`<div class="cfs"><div class="cfh"><b>${x.label}</b><span class="cfq" id="cf-${k}-q${i}"></span></div><div class="trx"><button type="button" class="pill acc" data-cfs="${k}:${i}">Find a better cut</button><button type="button" class="pill tmp" data-cfh="${k}:${i}:now">Hear this cut</button></div><div class="cfr" id="cf-${k}-r${i}"></div></div>`).join(''):'<p class="trs">'+(k==='j'?'Add a part first. The cut between two parts is what gets smoothed.':'Turn the loop on to smooth its seam.')+'</p>';
    }
    host.querySelectorAll('[data-cfm] .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===CF.mv[k]));
    S.forEach((x,i)=>{const h=CF.res[k][i];if(h&&(Math.abs(h.from[0]-x.out)>5e-4||Math.abs(h.from[1]-x.inn)>5e-4)){delete CF.res[k][i];cfRes(k,i)}});   /* the points moved: old suggestions no longer apply */
    clearTimeout(CF.tm[k]);
    if(!ready||mode!==k)return;
    CF.tm[k]=setTimeout(()=>{
      const F=cfFinder(),g=cfGrid();if(!F)return;
      cfSeams(k).forEach((x,i)=>{const e=$('#cf-'+k+'-q'+i);if(!e)return;const p=Math.round(F.score(x.out,x.inn,cfX(k),g)*100);e.textContent=p+'% fit now';e.className='cfq '+(p>=80?'g':p>=55?'m':'r')});
    },160);
  };
  const cfStop=()=>{const a=CF.ad;if(a&&!a.paused)a.pause();document.querySelectorAll('#ov [data-cfh]').forEach(b=>b.classList.remove('acc'))};
  const cfDone=()=>{cfStop();if(CF.ad)CF.ad.removeAttribute('src');if(CF.u){URL.revokeObjectURL(CF.u);CF.u=null}};
  /* hear one cut: three seconds before it, the blend, three seconds after. Built with the same code Save uses. */
  const cfHear=async(out,inn,btn)=>{
    if(CF.busy)return;
    if(btn.classList.contains('acc')){cfStop();return}
    CF.busy=true;const old=btn.textContent;btn.textContent='Building\u2026';
    try{
      const r=await bakeLoop(src.blob,{a:0,b:D},{a:0,b:0,n:0,x:lp.x,m:'in'},[{a:Math.max(0,out-3),b:out},{a:inn,b:Math.min(D,inn+3)}]);
      if(!$('#tm-pa'))return;   /* the sheet was closed while building */
      if(!pv.paused)stopPv();rpStop();if(!au.paused){au.pause();resume=true}
      cfStop();if(CF.u)URL.revokeObjectURL(CF.u);CF.u=URL.createObjectURL(r.blob);
      const a=CF.ad||(CF.ad=new Audio());a.src=CF.u;a.volume=uvol;a.onended=cfStop;
      await a.play();btn.classList.add('acc');
    }catch(e){console.warn('cut preview failed',e);toast('Could not play this cut')}
    finally{CF.busy=false;btn.textContent=old}
  };
  const cfSuggest=async(k,i)=>{
    const F=cfFinder();
    if(!F)return toast(wf?'Waveform data is not available for this song':'Still reading the waveform\u2026');
    const S=cfSeams(k)[i];if(!S||CF.busy)return;
    CF.busy=true;const box=$('#cf-'+k+'-r'+i);box.innerHTML='<p class="trs">Listening to the waveform\u2026</p>';
    await new Promise(r=>setTimeout(r,40));
    try{
      const mv=CF.mv[k];
      const r=F.run({out:S.out,inn:S.inn,X:cfX(k),mv,win:mv==='both'?2:3.5,grid:cfGrid(),oMin:S.oMin,oMax:S.oMax,iMin:S.iMin,iMax:S.iMax,ok:S.ok});
      CF.res[k][i]={from:[S.out,S.inn],r};cfRes(k,i);
    }catch(e){console.warn('cut search failed',e);box.innerHTML='<p class="trs">Could not analyse this song.</p>'}
    finally{CF.busy=false}
  };
  const cfApply=(k,i,c)=>{
    const S=cfSeams(k)[i];if(!S)return;
    cfStop();S.set(c.out,c.inn);if(k==='l')clampLoop();
    delete CF.res[k][i];cfRes(k,i);paint();toast('Cut moved. Tap Hear this cut to check it');
  };
  const cfClick=e=>{
    const t=e.target.closest('button');if(!t)return;
    const m=t.closest('[data-cfm]');
    if(m&&t.dataset.v){const k=m.dataset.cfm;CF.mv[k]=t.dataset.v;CF.res[k]={};CF.sig[k]='';paint();return}
    if(t.dataset.cfs){const [k,i]=t.dataset.cfs.split(':');cfSuggest(k,+i);return}
    if(t.dataset.cfu){const [k,i,n]=t.dataset.cfu.split(':'),h=CF.res[k][+i],c=h&&h.L&&h.L[+n];if(c)cfApply(k,+i,c);return}
    if(t.dataset.cfh){
      const [k,i,n]=t.dataset.cfh.split(':'),S=cfSeams(k)[+i];if(!S)return;
      if(n==='now')cfHear(S.out,S.inn,t);else{const h=CF.res[k][+i],c=h&&h.L&&h.L[+n];if(c)cfHear(c.out,c.inn,t)}
    }
  };
  $('#cf-j').onclick=cfClick;$('#cf-l').onclick=cfClick;
  /* one tool at a time: Trim, Join parts or Loop. The other two are switched off (their values are kept while you stay in the sheet). */
  const setMode=m=>{
    if(m===mode)return;
    if(!pv.paused)stopPv();rpStop();
    if(mode==='t'){stash={a:o.a,b:o.b};}   /* leaving Trim: the whole song is used until you come back */
    if(m==='t'){if(stash){o.a=stash.a;o.b=stash.b;stash=null}lp.on=false}
    else{if(mode==='t'){o.a=0;o.b=D}
      if(m==='j')lp.on=false;
      else{if(!enableLoop()){if(stash){o.a=stash.a;o.b=stash.b;stash=null}return toast('The song is too short to loop')}}}
    mode=m;jOpen=m==='j';head=Math.min(head,D);paint();setTimeout(light,60);
  };
  $('#tm-md').onclick=e=>{const b=e.target.closest('[data-md]');if(b)setMode(b.dataset.md)};
  $('#tm-lpt').onclick=()=>setMode(mode==='l'?'t':'l');
  /* while previewing, the loop runs the same way as in the player */
  const pt=setInterval(()=>{
    if(!lp.on||pv.paused)return;
    if(lp.m==='only'&&pLeft<=0&&!LP.busy&&pv.currentTime>=lp.b-.03){stopPv();return}   /* the rest of the song is trimmed away */
    if(lp.m==='end'){   /* hear how the end sounds with the part added */
      if(LP.busy)return;
      const t=pv.currentTime,X=Math.min(lp.x,(lp.b-lp.a)/3),jump=()=>{pLeft--;pTail=1;pvStop=pLeft>0?Infinity:lp.b;lpJump(pv,k=>{pv.volume=xfCl(uvol*k)},()=>1,X,lp.a)};
      if(pTail===1)pTail=2;
      if(!pTail){if(pLeft>0&&t>=o.b-3.5&&t<o.b+.4){lpPrep(src.blob,lp.a);if(t>=o.b-X-.35&&LP.g&&LP.g.readyState>=2)jump()}}
      else if(pLeft>0&&t>=lp.b-3.5&&t<lp.b+.4){lpPrep(src.blob,lp.a);if(t>=lp.b-X-.04&&LP.g&&LP.g.readyState>=2)jump()}
      return;
    }
    if(LP.busy||pLeft<=0)return;
    const t=pv.currentTime,X=Math.min(lp.x,(lp.b-lp.a)/3);
    if(t>lp.b+.4||t<lp.b-3.5)return;
    lpPrep(src.blob,lp.a);
    if(t>=lp.b-X-.04){
      if(LP.g&&LP.g.readyState>=2){pLeft--;lpJump(pv,k=>{pv.volume=xfCl(uvol*k)},()=>1,X,lp.a)}
      else if(t>=lp.b){pLeft--;try{pv.currentTime=lp.a}catch(_){}}
    }
  },25);
  const ros=[];
  const fin=()=>{
    clearInterval(pt);cancelAnimationFrame(raf);
    rpStop();rp.removeAttribute('src');if(rpS.u){URL.revokeObjectURL(rpS.u);rpS.u=null}
    ros.forEach(r=>r.disconnect());cfDone();
    pv.pause();lpStop();pv.removeAttribute('src');if(pvU)URL.revokeObjectURL(pvU);
    if(resume&&cur)au.play().catch(()=>{});closeOv();
  };
  $('#tm-r').onclick=()=>{if(!pv.paused)stopPv();rpStop();o.a=0;o.b=D;o.xi=null;o.xo=null;lp.on=false;pl.length=0;head=0;stash=null;mode='t';jOpen=false;paint()};
  {const u=$('#tm-un');if(u)u.onclick=async()=>{if(!pv.paused)stopPv();u.disabled=true;await undoBake(s);fin()}}
  $('#tm-x').onclick=fin;$('#ov').onclick=e=>{if(e.target.id==='ov')fin()};
  $('#tm-ok').onclick=async()=>{
    rpStop();
    delete s.xi;delete s.xo;
    if(mode!=='j')pl.length=0;if(mode!=='l')lp.on=false;if(mode!=='t'){o.a=0;o.b=D}   /* switched-off tools are not saved */
    if(pl.length===1){o.a=pl[0].a;o.b=pl[0].b;pl.length=0}
    const cut=o.a>=.05||o.b<D-.05,join=pl.length>=2,loop=!join&&lp.on&&lp.b-lp.a>=1.5;
    if(join||loop){   /* a loop or joined parts are built into the audio file itself */
      const btn=$('#tm-ok');if(btn.disabled)return;btn.disabled=true;btn.textContent='Building audio\u2026';
      if(!pv.paused)stopPv();
      try{
        const r=await bakeLoop(src.blob,{a:o.a,b:o.b},{a:lp.a,b:lp.b,n:lp.n,x:lp.x,m:lp.m},join?pl:null);
        const f=new File([r.blob],(s.name||'song').replace(/[\\/:*?"<>|]+/g,' ').trim()+'.wav',{type:'audio/wav'});
        const keep=s.orig||{blob:s.blob,dur:s.dur};
        const rec={trim:cut?{a:o.a,b:o.b}:null,loop:loop?{a:lp.a,b:lp.b,n:lp.n,x:lp.x,m:lp.m}:null,parts:join?pl.map(q=>({a:q.a,b:q.b})):null};
        await rfApply(s,f,r.dur,{quiet:true,bake:true});
        s.orig=keep;s.edit=rec;await put('songs',s);
        toast(join?'Parts joined and saved into the audio ('+fmt(r.dur)+')':lp.m==='end'?'Part added at the end and saved into the audio':lp.m==='only'?'Only the selected part is kept, saved into the audio ('+fmt(r.dur)+')':'Loop saved into the audio ('+fmt(r.dur)+')');fin();render();
      }catch(e){console.warn('bake failed',e);btn.disabled=false;btn.textContent='Save';toast('Could not build the audio. This song may be too long.')}
      return;
    }
    if(s.orig)await undoBake(s,true);   /* no loop or parts any more: back to the original file, with a plain trim */
    if(cut)s.trim={a:o.a,b:o.b>=D-.05?null:o.b};else delete s.trim;
    if(loop){s.loop={a:lp.a,b:lp.b,n:lp.n,x:lp.x};if(lp.m==='end')s.loop.m='end'}else delete s.loop;
    await put('songs',s);
    if(cur===s.id){
      LPN.tail=0;trRefresh();XF.arm=0;XF.ended=0;LPN.id=null;
      const t=au.currentTime;if(TR&&(t<TR.a-.05||t>TR.b-.5))vSeek(0);
      const d=$('#dt2');if(d)d.textContent=fmt(vD());const m=$('#mdt');if(m)m.textContent=fmt(vD());
      if(lyOn){lyI=-1;lySync(true)}
    }
    toast(loop?(lp.m==='end'?'Part will be added at the end':cut?'Trimmed, loop on':'Loop on'):cut?'Trimmed to '+fmt(o.b-o.a):'Trim removed');fin();render();
  };
  trWave({id:s.id+(s.orig?'o':''),blob:src.blob}).then(w=>{
    wf=w;document.querySelectorAll('#ov .trl').forEach(l=>l.remove());light();cfPaint('j');cfPaint('l');
    w.bpmP.then(res=>{
      if(!$('#tm-bpm'))return;   /* the sheet was closed meanwhile */
      if(G.state==='wait'){
        if(res&&res.bpm>0){G.bpm=res.bpm;G.off=res.off;G.conf=res.conf;G.state='ok'}else G.state='none';
        paint();
      }
    });
  }).catch(()=>{document.querySelectorAll('#ov .trl').forEach(l=>{l.textContent='Waveform not available, use the buttons'});G.state='none';paint()});
  VL.forEach(V=>{if(window.ResizeObserver){const r=new ResizeObserver(()=>drawV(V));r.observe(V.cv);ros.push(r)}});
  /* the transport stays in view under the sheet header while the sections scroll */
  {const hd=document.querySelector('#ov .sthd'),bar=$('#tm-bar'),place=()=>{bar.style.top=((hd?hd.offsetHeight:0)+4)+'px'};place();
   if(window.ResizeObserver&&hd){const r=new ResizeObserver(place);r.observe(hd);ros.push(r)}}
  requestAnimationFrame(paint);paint();
  setTimeout(light,420);   /* the sheet is still sliding in on the first paint */
}


/* ===== END 15-trim.js ===== */


/* ===== BEGIN 16-library.js ===== */
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
  {const w=(SWU.reg&&SWU.reg.waiting)||SWU.w;if(w){SWU.asked=true;w.postMessage('SKIP_WAITING');toast('Updating\u2026');return}}
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

/* ===== END 16-library.js ===== */


/* ===== BEGIN 17-covermaker.js ===== */
/* ===== cover maker: draws a square cover (gradients, patterns, photo, text) and hands back a JPEG file ===== */
const CM_PAL=[['#ff5a36','#ffb199','#2b1220'],['#2563eb','#7dd3fc','#0f172a'],['#10b981','#a7f3d0','#052e2b'],['#a855f7','#f0abfc','#1e1033'],['#f59e0b','#fde68a','#3b1d05'],['#ef4444','#fca5a5','#111827'],['#111827','#6b7280','#f9fafb'],['#f472b6','#fbcfe8','#4a044e'],['#14b8a6','#fde047','#134e4a'],['#e5e7eb','#9ca3af','#111827']];
const CM_STY=[['mesh','Mesh'],['grad','Gradient'],['aurora','Aurora'],['halftone','Halftone'],['liquid','Liquid'],['vinyl','Vinyl'],['photo','Photo']];
/* fonts use system stacks (the app works offline); [weight/style, stack, caps, label] */
const CM_FONT={
  sans:['800',"'Helvetica Neue',Arial,sans-serif",0,'Bold'],
  thin:['300',"'Helvetica Neue',Helvetica,Arial,sans-serif",0,'Light'],
  serif:['italic 700',"Georgia,'Times New Roman',serif",0,'Serif'],
  classic:['700',"'Palatino Linotype',Palatino,'Book Antiqua',serif",0,'Classic'],
  fashion:['700',"Didot,'Bodoni MT','Bodoni 72',Georgia,serif",0,'Fashion'],
  slab:['800',"Rockwell,'Roboto Slab','Courier New',serif",0,'Slab'],
  mono:['700',"ui-monospace,Menlo,Consolas,monospace",0,'Mono'],
  type:['400',"'Courier New',Courier,monospace",0,'Typewriter'],
  cond:['800',"'Arial Narrow','Helvetica Neue',Arial,sans-serif",1,'Caps'],
  poster:['400',"Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif",1,'Poster'],
  wide:['900',"Verdana,'DejaVu Sans',sans-serif",1,'Wide'],
  geo:['700',"Futura,'Century Gothic','Avenir Next','Trebuchet MS',sans-serif",1,'Geometric'],
  round:['800',"'Arial Rounded MT Bold',ui-rounded,'SF Pro Rounded',Nunito,'Trebuchet MS',sans-serif",0,'Round'],
  human:['600',"'Gill Sans','Gill Sans MT',Calibri,'Trebuchet MS',sans-serif",0,'Humanist'],
  engr:['700',"Copperplate,'Copperplate Gothic Light',Papyrus,fantasy",1,'Engraved'],
  script:['italic 400',"'Brush Script MT','Snell Roundhand','Segoe Script','Lucida Handwriting',cursive",0,'Script'],
  marker:['700',"'Marker Felt','Chalkboard SE','Comic Sans MS',cursive",0,'Marker']
};
const CM_FX=[['none','None'],['shadow','Shadow'],['glow','Glow'],['neon','Neon'],['outline','Outline'],['glitch','Glitch'],['retro','3D']];
const CM_IFX=[['none','None'],['glow','Glow'],['neon','Neon'],['glitch','Glitch'],['blur','Blur'],['vignette','Vignette'],['duotone','Duotone']];
/* several image effects can be on together; they are applied in this order whatever order they were tapped in */
const CM_IORD=['duotone','blur','neon','glow','glitch','vignette'];
const cmCv=w=>{const c=document.createElement('canvas');c.width=c.height=w;return c};
/* soft blur that works in every browser (no ctx.filter): shrink in halves, then grow back in halves */
function cmBlur(src,W,r){
  const t=Math.max(2,Math.round(W/Math.max(1,r)));let w=W,c=src;
  const step=nw=>{const n=cmCv(nw),g=n.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(c,0,0,nw,nw);c=n};
  while(w>t){w=Math.max(t,Math.round(w/2));step(w)}
  while(w<W){w=Math.min(W,w*2);step(w)}
  return c}
/* image effects: drawn on the finished background, before the grain */
function cmFx(x,S,W){
  const list=CM_IORD.filter(k=>(S.ifx||[]).includes(k)),am=(S.ifa==null?50:S.ifa)/100;if(!list.length)return;
  const [c0,c1,c2]=S.c,tint=S.igc&&S.igc!=='auto'?S.igc:null;
  const copy=()=>{const t=cmCv(W);t.getContext('2d').drawImage(x.canvas,0,0);return t};
  const reset=()=>{x.globalCompositeOperation='source-over';x.globalAlpha=1};
  const bloom=(r,a)=>{
    let b=cmBlur(copy(),W,r),t=cmCv(W),g=t.getContext('2d');
    g.drawImage(b,0,0);g.globalCompositeOperation='lighter';g.drawImage(b,0,0);
    if(tint){g.globalCompositeOperation='multiply';g.fillStyle=tint;g.fillRect(0,0,W,W)}
    x.globalCompositeOperation='screen';x.globalAlpha=Math.min(1,a);x.drawImage(t,0,0);reset()};
  list.forEach(fx=>{
  if(fx==='glow'){bloom(34+am*120,.4+am*.5);bloom(10+am*30,.22+am*.38)}
  else if(fx==='neon'){
    x.globalCompositeOperation='saturation';x.globalAlpha=.5+am*.5;x.fillStyle='#f00';x.fillRect(0,0,W,W);reset();
    x.globalCompositeOperation='overlay';x.globalAlpha=.5+am*.4;x.drawImage(copy(),0,0);reset();
    x.globalAlpha=.12+am*.25;x.fillStyle='#000';x.fillRect(0,0,W,W);reset();
    bloom(26+am*90,.55+am*.4);bloom(8+am*24,.4)}
  else if(fx==='glitch'){
    const R=cmRng((S.seed|0)+7),d=Math.round(6+am*40),src=copy(),out=cmCv(W),g=out.getContext('2d');
    g.fillStyle='#000';g.fillRect(0,0,W,W);g.globalCompositeOperation='lighter';
    [['#f00',-d],['#0f0',0],['#00f',d]].forEach(([col,dx])=>{const t=cmCv(W),h=t.getContext('2d');h.drawImage(src,0,0);h.globalCompositeOperation='multiply';h.fillStyle=col;h.fillRect(0,0,W,W);g.drawImage(t,dx,0)});
    g.globalCompositeOperation='source-over';
    const snap=cmCv(W);snap.getContext('2d').drawImage(out,0,0);
    for(let i=0,n=Math.round(4+am*14);i<n;i++){const y=R()*W,h=8+R()*(30+am*60),sx=(R()-.5)*(60+am*220);g.drawImage(snap,0,y,W,h,sx,y,W,h)}
    x.drawImage(out,0,0)}
  else if(fx==='blur'){x.drawImage(cmBlur(copy(),W,4+am*60),0,0)}
  else if(fx==='vignette'){
    const g=x.createRadialGradient(W/2,W/2,W*(.62-am*.4),W/2,W/2,W*.78);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,'+(.35+am*.6).toFixed(3)+')');
    x.fillStyle=g;x.fillRect(0,0,W,W)}
  else if(fx==='duotone'){
    const id=x.getImageData(0,0,W,W),d=id.data,A=cmRgb(c2),B=cmRgb(c1),C=cmRgb(c0),m=.2+.8*am;
    for(let i=0;i<d.length;i+=4){
      const l=(.299*d[i]+.587*d[i+1]+.114*d[i+2])/255,lo=l<.5,k=lo?l*2:(l-.5)*2,P=lo?A:B,Q=lo?B:C;
      d[i]+=(P[0]+(Q[0]-P[0])*k-d[i])*m;d[i+1]+=(P[1]+(Q[1]-P[1])*k-d[i+1])*m;d[i+2]+=(P[2]+(Q[2]-P[2])*k-d[i+2])*m}
    x.putImageData(id,0,0)}
  });
}
function cmRng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function cmRgb(h){h=String(h||'#000').replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');const n=parseInt(h,16)||0;return[n>>16&255,n>>8&255,n&255]}
const cmLum=h=>{const c=cmRgb(h);return .299*c[0]+.587*c[1]+.114*c[2]};
const cmMixW=(h,t)=>{const c=cmRgb(h);return 'rgb('+c.map(v=>Math.round(v+(255-v)*t)).join(',')+')'};
/* the background is drawn once and cached; moving or restyling text only re-draws the text on top */
function cmBg(S){
  const W=1024,key=[S.style,S.seed,S.c.join(),S.grain,S.dim,S.imgUrl||'',(S.ifx||[]).join('+'),S.ifa,S.igc].join('|');
  if(S._bk===key&&S._bc)return S._bc;
  const cv=S._bc||(S._bc=document.createElement('canvas'));cv.width=cv.height=W;
  const x=cv.getContext('2d',{willReadFrequently:true}),R=cmRng(S.seed),[c0,c1,c2]=S.c,st=S.style;
  x.globalAlpha=1;x.globalCompositeOperation='source-over';x.fillStyle=c2;x.fillRect(0,0,W,W);
  if(st==='grad'){const a=R()*Math.PI*2,cx=W/2,cy=W/2,r=W*.75,g=x.createLinearGradient(cx-Math.cos(a)*r,cy-Math.sin(a)*r,cx+Math.cos(a)*r,cy+Math.sin(a)*r);g.addColorStop(0,c0);g.addColorStop(.55,c1);g.addColorStop(1,c2);x.fillStyle=g;x.fillRect(0,0,W,W)}
  else if(st==='mesh'){for(let i=0;i<6;i++){const px=R()*W,py=R()*W,r=W*(.35+R()*.5),g=x.createRadialGradient(px,py,0,px,py,r),c=i%2?c1:c0;g.addColorStop(0,c);g.addColorStop(1,c+'00');x.fillStyle=g;x.fillRect(0,0,W,W)}}
  else if(st==='aurora'){
    x.fillStyle=c2;x.fillRect(0,0,W,W);
    for(let i=0;i<70;i++){x.globalAlpha=.15+R()*.6;x.fillStyle='#fff';const s=R()<.15?3:2;x.fillRect(R()*W,R()*W*.75,s,s)}
    x.globalAlpha=1;x.globalCompositeOperation='screen';
    for(let b=0;b<4;b++){
      const col=b%2?c1:c0,ph=R()*6.28,amp=W*(.06+R()*.12),fr=.8+R()*1.4,by=W*(.3+R()*.4);
      for(let i=0;i<=64;i++){
        const t=i/64,px=-W*.1+t*W*1.2,py=by+Math.sin(t*fr*6.28+ph)*amp,r=W*(.07+.03*Math.sin(t*9+ph)),g=x.createRadialGradient(0,0,0,0,0,r);
        g.addColorStop(0,col+'2e');g.addColorStop(1,col+'00');
        x.save();x.translate(px,py);x.scale(1,3.2);x.fillStyle=g;x.beginPath();x.arc(0,0,r,0,7);x.fill();x.restore();
      }
    }
    x.globalCompositeOperation='source-over';
  }
  else if(st==='halftone'){
    x.fillStyle=c2;x.fillRect(0,0,W,W);
    const a=R()*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),sp=32,q=Math.SQRT1_2;
    const dots=(col,off,inv,k)=>{x.fillStyle=col;x.beginPath();for(let i=-46;i<=46;i++)for(let j=-46;j<=46;j++){const u=(i+off)*sp,v=(j+off)*sp,px=W/2+(u-v)*q,py=W/2+(u+v)*q;if(px<-sp||py<-sp||px>W+sp||py>W+sp)continue;let t=((px-W/2)*ca+(py-W/2)*sa)/(W*.8)*.5+.5;t=Math.max(0,Math.min(1,t));if(inv)t=1-t;const r=sp*k*t;if(r<.6)continue;x.moveTo(px+r,py);x.arc(px,py,r,0,7)}x.fill()};
    dots(c1,.5,true,.55);dots(c0,0,false,.78);
  }
  else if(st==='liquid'){
    const n=240,t=document.createElement('canvas');t.width=t.height=n;const tx=t.getContext('2d'),id=tx.createImageData(n,n),p1=R()*6.28,p2=R()*6.28,p3=R()*6.28,fq=2.4+R()*2.4,A=cmRgb(c0),B=cmRgb(c1),C=cmRgb(c2);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const u=i/n*fq,w=j/n*fq;
      let f=(Math.sin(u+1.8*Math.sin(w*1.2+p1)+p2)+Math.sin(w+1.6*Math.sin(u*1.1+p3))+.6*Math.sin((u+w)*.8+p2))/2.6*.5+.5;
      f=f*f*(3-2*f);
      const lo=f<.5,k=lo?f*2:(f-.5)*2,P=lo?C:A,Q=lo?A:B,o=(j*n+i)*4;
      id.data[o]=P[0]+(Q[0]-P[0])*k;id.data[o+1]=P[1]+(Q[1]-P[1])*k;id.data[o+2]=P[2]+(Q[2]-P[2])*k;id.data[o+3]=255;
    }
    tx.putImageData(id,0,0);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(t,0,0,W,W);
  }
  else if(st==='vinyl'){const g=x.createRadialGradient(W*.3,W*.3,0,W/2,W/2,W);g.addColorStop(0,c0);g.addColorStop(1,c2);x.fillStyle=g;x.fillRect(0,0,W,W);const cx=W/2,cy=W/2;x.fillStyle='#0a0a0a';x.beginPath();x.arc(cx,cy,W*.46,0,7);x.fill();x.strokeStyle='rgba(255,255,255,.07)';x.lineWidth=2;for(let r=W*.2;r<W*.45;r+=11){x.beginPath();x.arc(cx,cy,r,0,7);x.stroke()}x.fillStyle=c1;x.beginPath();x.arc(cx,cy,W*.16,0,7);x.fill();x.fillStyle='#0a0a0a';x.beginPath();x.arc(cx,cy,W*.02,0,7);x.fill()}
  else if(st==='photo'){if(S.img){const im=S.img,k=Math.max(W/im.width,W/im.height),w=im.width*k,h=im.height*k;x.drawImage(im,(W-w)/2,(W-h)/2,w,h);x.fillStyle='rgba(0,0,0,'+(S.dim/100)+')';x.fillRect(0,0,W,W)}else{x.fillStyle=c0;x.fillRect(0,0,W,W)}}
  cmFx(x,S,W);
  if(S.grain>0){const n=document.createElement('canvas');n.width=n.height=256;const nx=n.getContext('2d'),d=nx.createImageData(256,256),G=cmRng(7);for(let i=0;i<d.data.length;i+=4){const v=G()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}nx.putImageData(d,0,0);x.globalCompositeOperation='overlay';x.globalAlpha=S.grain/100*.6;x.fillStyle=x.createPattern(n,'repeat');x.fillRect(0,0,W,W);x.globalAlpha=1;x.globalCompositeOperation='source-over'}
  let lum=0,kk=0;for(let i=1;i<6;i++)for(let j=1;j<6;j++){const p=x.getImageData(i*W/6|0,j*W/6|0,1,1).data;lum+=(.299*p[0]+.587*p[1]+.114*p[2]);kk++}
  S._lum=lum/kk;S._bk=key;return cv;
}
function cmDraw(cv,S,clean){
  const W=1024,bg=cmBg(S);cv.width=cv.height=W;const x=cv.getContext('2d');x.drawImage(bg,0,0);
  const lum=S._lum;let moved=false;
  S.T.forEach(T=>{
    if(T.hid){T.bb=null;return}
    if(T.type==='img'){cmImgDraw(x,T,W);return}
    const title=(T.title||'').trim(),sub=(T.sub||'').trim();if(!title&&!sub){T.bb=null;return}
    const col0=T.tc==='white'?'#fff':T.tc==='black'?'#111':/^#/.test(T.tc||'')?T.tc:(lum>150?'#111':'#fff');
    /* gradient fill: the first stop acts as the text's base color for outlines and glows */
    const gg=!!T.gr,g1=T.g1||S.c[0],g2=T.g2||S.c[1],col=gg?g1:col0;
    const F=CM_FONT[T.font]||CM_FONT.sans,px=T.size*2.2,pad=84,mw=W-pad*2,lh=1.06;
    const fit=(txt,size,wt)=>{x.font=wt+' '+size+'px '+F[1];const out=[];let line='';for(const w of txt.split(/\s+/)){const t=line?line+' '+w:w;if(x.measureText(t).width>mw&&line){out.push(line);line=w}else line=t}if(line)out.push(line);return out};
    const tt=F[2]?title.toUpperCase():title,tl=title?fit(tt,px,F[0]):[],sp=px*.4,sl=sub?fit(F[2]?sub.toUpperCase():sub,sp,F[0]):[];
    const th=tl.length*px*lh,sh=sl.length*sp*1.3,gap=tl.length&&sl.length?px*.18:0,tot=th+gap+sh;
    let bw=0;x.font=F[0]+' '+px+'px '+F[1];tl.forEach(l=>{bw=Math.max(bw,x.measureText(l).width)});x.font=F[0]+' '+sp+'px '+F[1];sl.forEach(l=>{bw=Math.max(bw,x.measureText(l).width)});
    T.bb={w:bw,h:tot};
    if(T.pv||T.x==null){const k=T.pv||'b';T.pv=null;T.y=Math.round((k==='t'?pad+tot/2:k==='c'?W/2:W-pad-tot/2)/W*100);T.x=50;moved=true}
    const fxs=Array.isArray(T.fx)?T.fx:[],has=k=>fxs.includes(k),am=(T.fa==null?50:T.fa)/100,contrast=cmLum(col)>140?'#000':'#fff';
    const ac=k=>T.gc&&T.gc!=='auto'?T.gc:(k==='outline'||k==='retro'?contrast:col);
    /* run draws every line of this text with the current canvas style; a = opacity of the title, the subtitle is a little softer */
    const run=(op,a)=>{let y=-tot/2;x.font=F[0]+' '+px+'px '+F[1];x.globalAlpha=a;tl.forEach((l,i)=>op(l,0,y+i*px*lh));y+=th+gap;x.font=F[0]+' '+sp+'px '+F[1];x.globalAlpha=a*.8;sl.forEach((l,i)=>op(l,0,y+i*sp*1.3));x.globalAlpha=1};
    const fill=(t,X,y)=>x.fillText(t,X,y);
    const noSh=()=>{x.shadowColor='rgba(0,0,0,0)';x.shadowBlur=0;x.shadowOffsetX=0;x.shadowOffsetY=0};
    x.save();x.translate(T.x/100*W,T.y/100*W);x.rotate((T.rot||0)*Math.PI/180);x.textAlign='center';x.textBaseline='top';x.lineJoin='round';
    /* the gradient is made after the move and turn, so it travels with the text */
    let fs=col;
    if(gg){const a=(T.ga==null?90:T.ga)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),L=Math.abs(ca)*(bw/2+8)+Math.abs(sa)*(tot/2+8),gr=x.createLinearGradient(-ca*L,-sa*L,ca*L,sa*L);gr.addColorStop(0,g1);gr.addColorStop(1,g2);fs=gr}
    x.fillStyle=fs;
    /* effects stack in a fixed order, back to front: 3D, shadow, glitch, glow, neon, outline, then the letters themselves */
    if(has('retro')){const n=Math.round(4+am*26);x.fillStyle=ac('retro');for(let i=n;i>=1;i--)run((t,X,y)=>x.fillText(t,X+i*.75,y+i*.75),1)}
    if(has('shadow')){x.fillStyle=fs;x.shadowColor='rgba(0,0,0,'+(.1+am*.4)+')';x.shadowBlur=8+am*34;x.shadowOffsetY=3+am*10;run(fill,1);noSh()}
    if(has('glitch')){const d=6+am*26;x.fillStyle='#ff2a6d';run((t,X,y)=>x.fillText(t,X-d,y+d*.15),.85);x.fillStyle='#00e5ff';run((t,X,y)=>x.fillText(t,X+d,y-d*.15),.85)}
    if(has('glow')){const b=20+am*90,g=ac('glow');x.fillStyle=fs;x.shadowColor=g;x.shadowBlur=b;run(fill,1);x.shadowBlur=b*.45;run(fill,1);noSh()}
    if(has('neon')){const b=18+am*70,g=ac('neon');x.fillStyle=g;x.shadowColor=g;x.shadowBlur=b*1.4;run(fill,1);x.shadowBlur=b*.6;run(fill,1);x.shadowBlur=b*.2;run(fill,1);noSh()}
    if(has('outline')){x.lineWidth=4+am*24;x.strokeStyle=ac('outline');run((t,X,y)=>x.strokeText(t,X,y),1)}
    x.fillStyle=(has('neon')&&!gg)?cmMixW(col,.7):fs;run(fill,1);
    x.restore();
  });
  if(!clean)cmGuideDraw(x,S,W);
  return moved;
}
/* ---- guides: lines the text snaps to. Canvas units (1024). Margins match the 84px text padding. ---- */
const cmGX=()=>[84,1024/3,512,2048/3,940];
function cmSnap(S,T){
  const A={x:[],y:[]};if(S.snap===false||!T.bb||T.x==null)return A;
  const W=1024,th=(T.rot||0)*Math.PI/180,c=Math.abs(Math.cos(th)),n=Math.abs(Math.sin(th)),hw=T.bb.w/2*c+T.bb.h/2*n,hh=T.bb.w/2*n+T.bb.h/2*c,TH=14;
  const gx=cmGX(),gy=cmGX();
  S.T.forEach(o=>{if(o!==T&&o.bb&&o.x!=null){gx.push(o.x/100*W);gy.push(o.y/100*W)}});
  const fit=(p,h,gs)=>{let best=null;for(const g of gs)for(const e of [-h,0,h]){const d=g-(p+e);if(Math.abs(d)<=TH&&(!best||Math.abs(d)<Math.abs(best.d)))best={d,g}}return best};
  const bx=fit(T.x/100*W,hw,gx),by=fit(T.y/100*W,hh,gy);
  if(bx){T.x=(T.x/100*W+bx.d)/W*100;A.x.push(bx.g)}
  if(by){T.y=(T.y/100*W+by.d)/W*100;A.y.push(by.g)}
  return A;
}
/* image layers: the picture is kept as a canvas (already shrunk to 1400px) and drawn at size% of the cover width */
function cmImgDraw(x,T,W){
  const im=T.im;if(!im){T.bb=null;return}
  const w=Math.max(8,T.size/100*W),h=w*T.ar,r=Math.min(w,h)/2*((T.rad||0)/50);T.bb={w,h};
  x.save();x.translate(T.x/100*W,T.y/100*W);x.rotate((T.rot||0)*Math.PI/180);if(T.flip)x.scale(-1,1);
  x.globalAlpha=(T.op==null?100:T.op)/100;
  if(r>.5){x.beginPath();x.moveTo(-w/2+r,-h/2);x.arcTo(w/2,-h/2,w/2,h/2,r);x.arcTo(w/2,h/2,-w/2,h/2,r);x.arcTo(-w/2,h/2,-w/2,-h/2,r);x.arcTo(-w/2,-h/2,w/2,-h/2,r);x.closePath();x.clip()}
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(im,-w/2,-h/2,w,h);x.restore();
}
function cmLoadImg(f){return new Promise((ok,no)=>{
  const u=URL.createObjectURL(f),im=new Image();
  im.onload=()=>{
    URL.revokeObjectURL(u);
    if(!im.naturalWidth||!im.naturalHeight)return no();
    const k=Math.min(1,1400/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k));
    const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,0,0,w,h);
    const t=document.createElement('canvas'),tk=80/Math.max(w,h);t.width=Math.max(1,Math.round(w*tk));t.height=Math.max(1,Math.round(h*tk));t.getContext('2d').drawImage(c,0,0,t.width,t.height);
    const ar=h/w;
    ok({type:'img',name:((f.name||'Image').replace(/\.[^.]+$/,'').slice(0,24))||'Image',im:c,thumb:t.toDataURL('image/png'),ar,x:50,y:50,size:Math.round(Math.min(60,60/ar)),sz0:Math.round(Math.min(60,60/ar)),rot:0,op:100,rad:0,flip:false,hid:false,bb:null});
  };
  im.onerror=()=>{URL.revokeObjectURL(u);no()};im.src=u;
})}
/* the selected layer gets a dashed frame and a round handle at its bottom right corner to resize it; neither is saved into the cover */
function cmHandle(T){const W=1024,p=T.type==='img'?0:14,hw=T.bb.w/2+p,hh=T.bb.h/2+p,a=(T.rot||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return[T.x/100*W+hw*c-hh*s,T.y/100*W+hw*s+hh*c]}
function cmSelDraw(x,S,W){
  const T=S.T[S.k];if(!T||!T.bb||T.x==null||S.tab!=='tx')return;
  const p=T.type==='img'?0:14,hw=T.bb.w/2+p,hh=T.bb.h/2+p;
  x.save();x.globalCompositeOperation='source-over';x.globalAlpha=1;
  x.translate(T.x/100*W,T.y/100*W);x.rotate((T.rot||0)*Math.PI/180);
  x.lineWidth=3;x.strokeStyle='rgba(255,255,255,.95)';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=4;x.setLineDash([16,10]);x.strokeRect(-hw,-hh,hw*2,hh*2);
  x.setLineDash([]);x.shadowBlur=0;x.fillStyle='#fff';x.strokeStyle='#ff3d81';x.lineWidth=5;x.beginPath();x.arc(hw,hh,17,0,7);x.fill();x.stroke();
  x.restore();
}
function cmGuideDraw(x,S,W){
  cmSelDraw(x,S,W);
  const A=S.ga||{x:[],y:[]};if(!S.grid&&!A.x.length&&!A.y.length&&!S.drag)return;
  x.save();x.globalCompositeOperation='source-over';x.globalAlpha=1;x.setLineDash([14,12]);
  const line=(a,b,c,d)=>{x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke()};
  if(S.grid||S.drag){x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.55)';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=3;cmGX().forEach(g=>{line(g,0,g,W);line(0,g,W,g)});x.shadowBlur=0}
  x.setLineDash([]);x.lineWidth=3;x.strokeStyle='#ff3d81';x.shadowColor='rgba(0,0,0,.5)';x.shadowBlur=4;
  A.x.forEach(g=>line(g,0,g,W));A.y.forEach(g=>line(0,g,W,g));
  x.restore();
}
const cmLayer=(i,t,u)=>({title:t||'',sub:u||'',font:'sans',x:null,y:null,rot:0,pv:i?'c':'b',size:i?36:46,sz0:i?36:46,tc:'auto',gc:'auto',fx:['shadow'],fa:50,gr:false,g1:null,g2:null,ga:90,bb:null});
function covMaker(o){return new Promise(res=>{
  o=o||{};
  const S={style:'mesh',pal:0,c:CM_PAL[0].slice(),seed:(Math.random()*1e6|0)+1,T:[cmLayer(0,(o.title||'').slice(0,80),(o.sub||'').slice(0,80))],k:0,grain:18,dim:35,ifx:[],ifa:50,igc:'auto',img:null,imgUrl:null,tab:'bg',snap:true,grid:false,ga:null,drag:false};
  if(/^#[0-9a-f]{6}$/i.test(o.color||'')){S.c=[o.color,S.c[1],S.c[2]];S.pal=-1}
  const NOL=cmLayer(0,'');const cur=()=>S.T[S.k]||NOL;/* NOL: stand-in when no layer is selected, edits to it draw nothing */
  const e=document.createElement('div');e.id='cmk';e.setAttribute('role','dialog');e.setAttribute('aria-modal','true');e.setAttribute('aria-label','Make cover');
  const chips=(id,list,st)=>`<div class="cmg" id="${id}">${list.map(l=>`<button type="button" class="chip" data-v="${l[0]}"${st&&st[l[0]]?` style="${st[l[0]]}"`:''}>${l[1]}</button>`).join('')}</div>`;
  const fst={};Object.keys(CM_FONT).forEach(k=>{const F=CM_FONT[k],w=/\d+/.exec(F[0]),it=/italic/.test(F[0]);fst[k]=`font-family:${F[1]};font-weight:${w?w[0]:400};font-style:${it?'italic':'normal'}`});
  const swatches=`<button type="button" class="cmsw" data-sw="0" aria-label="Palette color 1"></button><button type="button" class="cmsw" data-sw="1" aria-label="Palette color 2"></button><button type="button" class="cmsw" data-sw="2" aria-label="Palette color 3"></button>`;
  e.innerHTML=`<div class="cmd"><h3>Make cover</h3><div class="cmp"><canvas id="cmv" width="1024" height="1024"></canvas></div>
  <div class="cmtb"><div class="cmtabs" id="cmtab"><button type="button" class="chip" data-v="bg">Background</button><button type="button" class="chip" data-v="tx">Layers</button></div></div>
  <div class="cmc">
  <div id="cmbg">
    <div class="cmsec"><div class="cml">Style</div>${chips('cms',CM_STY)}
      <div class="cmw" id="cmph" hidden><button type="button" class="pill" id="cmpb">Choose a photo\u2026</button><input type="file" id="cmpf" accept="image/*" hidden></div>
      <div class="fop" id="cmdw" hidden><span>Dim photo</span><input type="range" class="rng" id="cmd2" min="0" max="85" aria-label="Dim photo"><b></b></div>
    </div>
    <div class="cmsec"><div class="cml">Colors</div><div class="cmw" id="cmpl">${CM_PAL.map((p,i)=>`<button type="button" class="cmpal" data-i="${i}" aria-label="Palette ${i+1}" style="background:linear-gradient(135deg,${p[0]} 0 40%,${p[1]} 40% 70%,${p[2]} 70%)"></button>`).join('')}</div>
      <div class="cmw cmcr"><input type="color" class="cmcol" data-k="0" aria-label="Main color"><input type="color" class="cmcol" data-k="1" aria-label="Second color"><input type="color" class="cmcol" data-k="2" aria-label="Background color"><button type="button" class="pill" id="cmsh">${ic('shuffle',16)}Shuffle</button></div>
    </div>
    <div class="cmsec"><div class="cml">Finish</div>
      <div class="fop"><span>Grain</span><input type="range" class="rng" id="cmg" min="0" max="100" aria-label="Grain"><b></b></div>
      <div class="cml sub">Image effect</div>${chips('cmie',CM_IFX)}<div class="cmh" style="margin-top:8px">Tap more than one to combine them.</div>
      <div id="cmio" hidden>
        <div class="fop" style="margin-top:12px"><span>Strength</span><input type="range" class="rng" id="cmia" min="0" max="100" aria-label="Image effect strength"><b></b></div>
        <div class="cml sub" id="cmil">Glow color</div><div class="cmw" id="cmic"><button type="button" class="chip" data-v="auto">Auto</button>${swatches}<button type="button" class="cmsw" data-sw="w" aria-label="White" style="background:#fff"></button><label class="cmcl" aria-label="Custom effect color"><input type="color" id="cmici"></label></div>
      </div>
    </div>
  </div>
  <div id="cmtx" hidden>
    <div class="cmsec"><div class="cml">Layers</div><div class="cmh">The top of the list is the front. Tap a layer to edit it, tap the eye to hide it, drag the handle to reorder. You can also tap a layer on the preview, drag it, or drag its round corner handle to resize.</div>
      <div id="cmll" role="list"></div>
      <div class="cmw" style="margin-top:10px"><button type="button" class="pill" data-add="1">${ic('plus',14)}Add text</button><button type="button" class="pill" data-addimg="1">${ic('image',16)}Add image</button></div>
      <div class="cmw" id="cmod" style="margin-top:8px"><button type="button" class="pill" id="cmfw">${ic('up',16)}Bring forward</button><button type="button" class="pill" id="cmbk">${ic('down',16)}Send backward</button></div>
      <input type="file" id="cmlf" accept="image/*" multiple hidden><input type="file" id="cmlr2" accept="image/*" hidden>
    </div>
    <div id="cmtp">
    <div class="cmsec"><div class="cml">Text</div>
      <div class="cmw cmtxr"><input type="text" id="cmt" maxlength="80" placeholder="Title" autocomplete="off"><button type="button" class="cmdel" id="cmdel" aria-label="Delete this text" title="Delete this text">${ic('trash',20)}</button></div>
      <input type="text" id="cmu" maxlength="80" placeholder="Subtitle (optional)" autocomplete="off">
    </div>
    <div class="cmsec"><div class="cml">Font</div>${chips('cmf',Object.keys(CM_FONT).map(k=>[k,CM_FONT[k][3]]),fst)}</div>
    <div class="cmsec"><div class="cml">Color</div><div class="cmg" id="cmfm" style="margin-bottom:10px"><button type="button" class="chip" data-v="solid">Solid</button><button type="button" class="chip" data-v="grad">Gradient</button></div>
      <div id="cmgo" hidden>
        <div class="cml sub">Start color</div><div class="cmw" id="cmg1">${swatches}<button type="button" class="cmsw" data-sw="w" aria-label="White" style="background:#fff"></button><button type="button" class="cmsw" data-sw="k" aria-label="Black" style="background:#111"></button><label class="cmcl" aria-label="Custom start color"><input type="color" id="cmg1i"></label></div>
        <div class="cml sub">End color</div><div class="cmw" id="cmg2">${swatches}<button type="button" class="cmsw" data-sw="w" aria-label="White" style="background:#fff"></button><button type="button" class="cmsw" data-sw="k" aria-label="Black" style="background:#111"></button><label class="cmcl" aria-label="Custom end color"><input type="color" id="cmg2i"></label></div>
        <div class="fop" style="margin-top:12px"><span>Angle</span><input type="range" class="rng" id="cmga" min="0" max="360" aria-label="Gradient angle"><b></b></div>
        <div class="cmw" style="margin-top:6px"><button type="button" class="pill" id="cmgsw">Swap colors</button></div>
      </div>
      <div class="cmw" id="cmtc"><button type="button" class="chip" data-v="auto">Auto</button><button type="button" class="chip" data-v="white">White</button><button type="button" class="chip" data-v="black">Black</button>${swatches}<label class="cmcl" aria-label="Custom text color"><input type="color" id="cmtci"></label></div></div>
    <div class="cmsec"><div class="cml">Effect</div>${chips('cme',CM_FX)}<div class="cmh" style="margin-top:8px">Tap more than one to combine them. They share one strength and one color.</div>
      <div id="cmfo">
        <div class="fop" style="margin-top:12px"><span>Strength</span><input type="range" class="rng" id="cmfa" min="0" max="100" aria-label="Effect strength"><b></b></div>
        <div class="cml sub" id="cmgl">Effect color</div><div class="cmw" id="cmgc"><button type="button" class="chip" data-v="auto">Auto</button>${swatches}<button type="button" class="cmsw" data-sw="w" aria-label="White" style="background:#fff"></button><label class="cmcl" aria-label="Custom effect color"><input type="color" id="cmgci"></label></div>
      </div>
    </div>
    <div class="cmsec"><div class="cml">Size and position</div>
      <div class="fop"><span>Size</span><input type="range" class="rng" id="cmz" min="20" max="90" aria-label="Text size"><b></b></div>
      <div class="fop"><span>Rotate</span><input type="range" class="rng" id="cmsr" min="-180" max="180" aria-label="Text rotation"><b></b></div>
      <div class="cmg" id="cmpp"><button type="button" class="pill" data-p="t">Top</button><button type="button" class="pill" data-p="c">Middle</button><button type="button" class="pill" data-p="b">Bottom</button></div>
    </div>
    </div>
    <div id="cmip" hidden>
      <div class="cmsec"><div class="cml">Image</div>
        <div class="cmw"><button type="button" class="pill" id="cmmrp">Replace image\u2026</button><button type="button" class="pill" id="cmmfl">Flip</button><button type="button" class="cmdel r" id="cmmdel" aria-label="Delete this image" title="Delete this image">${ic('trash',20)}</button></div>
      </div>
      <div class="cmsec"><div class="cml">Size and position</div>
        <div class="fop"><span>Size</span><input type="range" class="rng" id="cmmz" min="5" max="200" aria-label="Image size"><b></b></div>
        <div class="fop"><span>X</span><input type="range" class="rng" id="cmmx" min="0" max="100" aria-label="Horizontal position"><b></b></div>
        <div class="fop"><span>Y</span><input type="range" class="rng" id="cmmy" min="0" max="100" aria-label="Vertical position"><b></b></div>
        <div class="fop"><span>Rotate</span><input type="range" class="rng" id="cmmr" min="-180" max="180" aria-label="Image rotation"><b></b></div>
        <div class="fop"><span>Opacity</span><input type="range" class="rng" id="cmmo" min="0" max="100" aria-label="Image opacity"><b></b></div>
        <div class="fop"><span>Corners</span><input type="range" class="rng" id="cmmc" min="0" max="50" aria-label="Rounded corners"><b></b></div>
        <div class="cmw" style="margin-top:10px"><button type="button" class="pill" id="cmmct">Center</button><button type="button" class="pill" id="cmmfit">Fit</button><button type="button" class="pill" id="cmmfill">Fill cover</button></div>
      </div>
    </div>
    <div class="cmsec"><div class="cml">Guides</div><div class="cmw" id="cmgd"><button type="button" class="chip" data-v="snap">Snap to guides</button><button type="button" class="chip" data-v="grid">Show guides</button></div><div class="cmh" style="margin-top:8px">Text snaps to the center, the thirds, the margins and your other texts. Guides always appear while you drag. They are never saved into the cover.</div></div>
  </div>
  </div>
  <div class="bt"><button type="button" class="pill" id="cmx">Cancel</button><button type="button" class="pill acc" id="cmok">Use cover</button></div></div>`;
  const q=s=>e.querySelector(s),qa=s=>[...e.querySelectorAll(s)];
  let done=false;
  const kd=ev=>{if(ev.key==='Escape'){ev.stopPropagation();fin(null)}};
  const fin=v=>{if(done)return;done=true;document.removeEventListener('keydown',kd,true);if(S.imgUrl)URL.revokeObjectURL(S.imgUrl);e.remove();res(v)};
  const sl=()=>{const T=cur();[['#cmsr',T.rot,'\u00b0',-180,180],['#cmga',T.ga==null?90:T.ga,'\u00b0',0,360],['#cmz',T.size,'',20,90],['#cmfa',T.fa==null?50:T.fa,'%',0,100],['#cmg',S.grain,'%',0,100],['#cmia',S.ifa==null?50:S.ifa,'%',0,100],['#cmd2',S.dim,'%',0,85]].concat(T.type==='img'?[['#cmmz',T.size,'%',5,200],['#cmmx',T.x==null?50:T.x,'%',0,100],['#cmmy',T.y==null?50:T.y,'%',0,100],['#cmmr',T.rot||0,'\u00b0',-180,180],['#cmmo',T.op==null?100:T.op,'%',0,100],['#cmmc',T.rad||0,'%',0,50]]:[]).forEach(([id,v,u,mn,mx])=>{const i=q(id);i.value=v;i.style.setProperty('--p',((v-mn)/(mx-mn)*100)+'%');i.parentNode.querySelector('b').textContent=Math.round(v)+u});q('#cmz').dataset.def=T.sz0||46;q('#cmmz').dataset.def=T.sz0||(T.type==='img'?T.size:50)};
  const EYE1='<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M12 5C7 5 3 9.5 2 12c1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>',EYE0='<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M12 5C7 5 3 9.5 2 12c1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z" opacity=".35"/><path d="M3.2 4.6l1.4-1.4 16.2 16.2-1.4 1.4z"/></svg>',GRIP='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M5 7h14v2H5zm0 4h14v2H5zm0 4h14v2H5z"/></svg>',LOCK='<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17 9V7a5 5 0 00-10 0v2H5v12h14V9h-2zM9 7a3 3 0 016 0v2H9V7z"/></svg>';
  const lay=()=>{
    const n=S.T.length;let h='';
    for(let d=0;d<n;d++){
      const i=n-1-d,T=S.T[i],img=T.type==='img',nm=img?T.name:((T.title||'').trim().slice(0,22)||'Text '+(i+1));
      h+=`<div class="cmlr${i===S.k?' on':''}${T.hid?' off':''}" data-r="${i}" role="listitem"><button type="button" class="cmeye" data-eye="${i}" aria-label="${T.hid?'Show':'Hide'} ${esc(nm)}" aria-pressed="${!T.hid}">${T.hid?EYE0:EYE1}</button><button type="button" class="cmlm" data-l="${i}"><span class="cmth">${img?`<img src="${T.thumb}" alt="">`:'<b>T</b>'}</span><span class="cmln">${esc(nm)}</span></button><button type="button" class="cmgrip" data-grip="${i}" aria-label="Drag to reorder ${esc(nm)}">${GRIP}</button></div>`;
    }
    h+=`<div class="cmlr bgr" role="listitem"><span class="cmlk" title="Locked">${LOCK}</span><button type="button" class="cmlm" data-bgl="1"><span class="cmth" style="background:linear-gradient(135deg,${S.c[0]},${S.c[1]},${S.c[2]})"></span><span class="cmln">Background</span></button></div>`;
    q('#cmll').innerHTML=h;
  };
  const load=()=>{const T=cur();q('#cmt').value=T.title||'';q('#cmu').value=T.sub||''};
  let raf=0;const draw=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(cmDraw(q('#cmv'),S))sl()})};
  const same=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase();
  const sync=()=>{
    const T=cur(),fxs=Array.isArray(T.fx)?T.fx:[];
    qa('#cmtab .chip').forEach(b=>b.classList.toggle('on',b.dataset.v===S.tab));q('#cmbg').hidden=S.tab!=='bg';q('#cmtx').hidden=S.tab!=='tx';
    qa('#cms .chip').forEach(b=>b.classList.toggle('on',b.dataset.v===S.style));
    qa('#cmf .chip').forEach(b=>b.classList.toggle('on',b.dataset.v===T.font));
    qa('#cme .chip').forEach(b=>b.classList.toggle('on',b.dataset.v==='none'?!fxs.length:fxs.includes(b.dataset.v)));
    qa('#cmgd .chip').forEach(b=>b.classList.toggle('on',b.dataset.v==='snap'?S.snap!==false:!!S.grid));
    qa('#cmfm .chip').forEach(b=>b.classList.toggle('on',(b.dataset.v==='grad')===!!T.gr));
    q('#cmgo').hidden=!T.gr;q('#cmtc').hidden=!!T.gr;
    {const g1=T.g1||S.c[0],g2=T.g2||S.c[1],hx2=v=>/^#/.test(v);
     [['#cmg1',g1,'#cmg1i'],['#cmg2',g2,'#cmg2i']].forEach(([id,v,ii])=>{qa(id+' .cmsw').forEach(b=>b.classList.toggle('on',same(v,b.dataset.c)));q(ii).value=hx2(v)?v:'#ffffff';q(ii).parentNode.classList.toggle('on',![...qa(id+' .cmsw')].some(b=>same(v,b.dataset.c)))})}
    qa('#cmpl .cmpal').forEach(b=>b.classList.toggle('on',+b.dataset.i===S.pal));
    qa('.cmcol').forEach(i=>i.value=S.c[+i.dataset.k]);
    qa('.cmsw').forEach(b=>{const c=b.dataset.sw==='w'?'#ffffff':b.dataset.sw==='k'?'#111111':S.c[+b.dataset.sw];b.style.background=c;b.dataset.c=c});
    const tc=T.tc||'auto',gc=T.gc||'auto',hx=v=>/^#/.test(v);
    qa('#cmtc .chip').forEach(b=>b.classList.toggle('on',b.dataset.v===tc));
    qa('#cmtc .cmsw').forEach(b=>b.classList.toggle('on',hx(tc)&&same(tc,b.dataset.c)));
    q('#cmtci').value=hx(tc)?tc:'#ffffff';q('#cmtci').parentNode.classList.toggle('on',hx(tc)&&![...qa('#cmtc .cmsw')].some(b=>same(tc,b.dataset.c)));
    qa('#cmgc .chip').forEach(b=>b.classList.toggle('on',b.dataset.v===gc));
    qa('#cmgc .cmsw').forEach(b=>b.classList.toggle('on',hx(gc)&&same(gc,b.dataset.c)));
    q('#cmgci').value=hx(gc)?gc:'#ffffff';q('#cmgci').parentNode.classList.toggle('on',hx(gc)&&![...qa('#cmgc .cmsw')].some(b=>same(gc,b.dataset.c)));
    const ies=S.ifx||[],ig=S.igc||'auto';
    qa('#cmie .chip').forEach(b=>b.classList.toggle('on',b.dataset.v==='none'?!ies.length:ies.includes(b.dataset.v)));
    qa('#cmic .chip').forEach(b=>b.classList.toggle('on',b.dataset.v===ig));
    qa('#cmic .cmsw').forEach(b=>b.classList.toggle('on',hx(ig)&&same(ig,b.dataset.c)));
    q('#cmici').value=hx(ig)?ig:'#ffffff';q('#cmici').parentNode.classList.toggle('on',hx(ig)&&![...qa('#cmic .cmsw')].some(b=>same(ig,b.dataset.c)));
    q('#cmio').hidden=!ies.length;q('#cmic').hidden=q('#cmil').hidden=!(ies.includes('glow')||ies.includes('neon'));
    q('#cmfo').hidden=!fxs.length;q('#cmgc').hidden=q('#cmgl').hidden=!fxs.some(k=>k==='glow'||k==='neon'||k==='outline'||k==='retro');
    q('#cmph').hidden=S.style!=='photo';q('#cmdw').hidden=S.style!=='photo'||!S.img;
    q('#cmpb').textContent=S.img?'Change photo\u2026':'Choose a photo\u2026';
    {const has=!!S.T[S.k],isImg=has&&T.type==='img';
     q('#cmtp').hidden=!has||isImg;q('#cmip').hidden=!isImg;q('#cmod').hidden=!has;
     q('#cmfw').disabled=!has||S.k>=S.T.length-1;q('#cmbk').disabled=!has||S.k<=0}
    lay();sl();draw();
  };
  e.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    const grp=b.parentNode.id,v=b.dataset.v,T=cur();
    if(grp==='cmtab'){S.tab=v;q('.cmc').scrollTop=0}
    else if(grp==='cms'){S.style=v;if(v==='photo'&&!S.img)q('#cmpf').click()}
    else if(grp==='cmf')T.font=v;else if(grp==='cme'){if(v==='none')T.fx=[];else{const a=(Array.isArray(T.fx)?T.fx:[]).slice(),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);T.fx=a}}
    else if(grp==='cmtc'){if(b.dataset.sw!=null)T.tc=b.dataset.c;else T.tc=v}
    else if(grp==='cmgc'){if(b.dataset.sw!=null)T.gc=b.dataset.c;else T.gc=v}
    else if(grp==='cmie'){if(v==='none')S.ifx=[];else{const a=(S.ifx||[]).slice(),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);S.ifx=a}}
    else if(grp==='cmic'){if(b.dataset.sw!=null)S.igc=b.dataset.c;else S.igc=v}
    else if(grp==='cmfm')T.gr=v==='grad';
    else if(grp==='cmg1'){if(b.dataset.sw!=null)T.g1=b.dataset.c}
    else if(grp==='cmg2'){if(b.dataset.sw!=null)T.g2=b.dataset.c}
    else if(grp==='cmgd'){if(v==='snap')S.snap=S.snap===false;else S.grid=!S.grid}
    else if(b.id==='cmgsw'){const a=T.g1||S.c[0];T.g1=T.g2||S.c[1];T.g2=a}
    else if(b.dataset.p)T.pv=b.dataset.p;
    else if(b.dataset.eye!=null){const L=S.T[+b.dataset.eye];if(L)L.hid=!L.hid}
    else if(b.dataset.grip!=null)return;
    else if(b.dataset.bgl){S.tab='bg';q('.cmc').scrollTop=0}
    else if(b.dataset.l!=null){S.k=+b.dataset.l;load()}
    else if(b.dataset.add){if(S.T.length>=12)return toast('That is enough layers for one cover');S.T.push(cmLayer(1,'New text'));S.k=S.T.length-1;load();S.tab='tx';sync();q('#cmt').focus();q('#cmt').select();return}
    else if(b.dataset.addimg)return q('#cmlf').click();
    else if(b.id==='cmdel'||b.id==='cmmdel'){if(S.k>=0){S.T.splice(S.k,1);S.k=Math.min(S.k,S.T.length-1);load()}}
    else if(b.id==='cmfw'){if(S.k>=0&&S.k<S.T.length-1){const t=S.T[S.k];S.T[S.k]=S.T[S.k+1];S.T[S.k+1]=t;S.k++}}
    else if(b.id==='cmbk'){if(S.k>0){const t=S.T[S.k];S.T[S.k]=S.T[S.k-1];S.T[S.k-1]=t;S.k--}}
    else if(b.id==='cmmrp')return q('#cmlr2').click();
    else if(b.id==='cmmfl'){if(T.type==='img')T.flip=!T.flip}
    else if(b.id==='cmmct'){if(T.type==='img'){T.x=50;T.y=50}}
    else if(b.id==='cmmfit'){if(T.type==='img'){T.x=50;T.y=50;T.rot=0;T.size=Math.min(100,100/T.ar)}}
    else if(b.id==='cmmfill'){if(T.type==='img'){T.x=50;T.y=50;T.rot=0;T.size=Math.min(200,Math.max(100,100/T.ar))}}
    else if(b.classList.contains('cmpal')){S.pal=+b.dataset.i;S.c=CM_PAL[S.pal].slice()}
    else if(b.id==='cmsh'){S.seed=(Math.random()*1e6|0)+1;if(S.pal>=0){S.pal=Math.floor(Math.random()*CM_PAL.length);S.c=CM_PAL[S.pal].slice()}}
    else if(b.id==='cmpb')return q('#cmpf').click();
    else if(b.id==='cmx')return fin(null);
    else if(b.id==='cmok'){cmDraw(q('#cmv'),S,true);return q('#cmv').toBlob(bl=>fin(bl?new File([bl],'cover.jpg',{type:'image/jpeg'}):null),'image/jpeg',.92)}
    else return;
    sync();
  });
  q('#cmt').oninput=ev=>{cur().title=ev.target.value;lay();draw()};q('#cmu').oninput=ev=>{cur().sub=ev.target.value;draw()};
  q('#cmsr').oninput=ev=>{cur().rot=+ev.target.value;sync()};q('#cmfa').oninput=ev=>{cur().fa=+ev.target.value;sync()};
  q('#cmz').oninput=ev=>{cur().size=+ev.target.value;sync()};q('#cmg').oninput=ev=>{S.grain=+ev.target.value;sync()};q('#cmd2').oninput=ev=>{S.dim=+ev.target.value;sync()};
  q('#cmtci').oninput=ev=>{cur().tc=ev.target.value;sync()};q('#cmg1i').oninput=ev=>{cur().g1=ev.target.value;sync()};q('#cmg2i').oninput=ev=>{cur().g2=ev.target.value;sync()};q('#cmga').oninput=ev=>{cur().ga=+ev.target.value;sync()};q('#cmgci').oninput=ev=>{cur().gc=ev.target.value;sync()};
  q('#cmia').oninput=ev=>{S.ifa=+ev.target.value;sync()};
  /* image sliders only redraw the preview and refresh the value labels: no list rebuild per tick */
  [['#cmmz','size'],['#cmmx','x'],['#cmmy','y'],['#cmmr','rot'],['#cmmo','op'],['#cmmc','rad']].forEach(([id,k])=>{q(id).oninput=ev=>{const T=cur();if(T.type!=='img')return;T[k]=+ev.target.value;sl();draw()}});
  q('#cmlf').onchange=async ev=>{
    const fs=[...ev.target.files];ev.target.value='';let bad=0;
    for(const f of fs){
      if(S.T.length>=12){toast('That is enough layers for one cover');break}
      try{S.T.push(await cmLoadImg(f));S.k=S.T.length-1}catch(_){bad++}
    }
    if(bad)toast('Could not read that image');
    S.tab='tx';load();sync();
  };
  q('#cmlr2').onchange=async ev=>{const f=ev.target.files[0];ev.target.value='';const T=cur();if(!f||T.type!=='img')return;try{const L=await cmLoadImg(f);T.im=L.im;T.thumb=L.thumb;T.ar=L.ar;T.name=L.name;sync()}catch(_){toast('Could not read that image')}};
  /* drag a layer by its handle to reorder; the rows move live, the order is applied on release */
  q('#cmll').addEventListener('pointerdown',ev=>{
    const g=ev.target.closest('.cmgrip');if(!g)return;ev.preventDefault();
    const row=g.closest('.cmlr'),list=q('#cmll');try{g.setPointerCapture(ev.pointerId)}catch(_){}
    row.classList.add('drag');
    const mv=e2=>{
      for(const r of list.querySelectorAll('.cmlr:not(.bgr)')){
        if(r===row)continue;const bx=r.getBoundingClientRect();
        if(e2.clientY>bx.top&&e2.clientY<bx.bottom){
          const below=!!(row.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING),mid=bx.top+bx.height/2;
          if(below&&e2.clientY>mid)r.after(row);else if(!below&&e2.clientY<mid)r.before(row);
          break}}
    };
    const up=()=>{
      g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);g.removeEventListener('pointercancel',up);
      row.classList.remove('drag');
      const sel=S.T[S.k],order=[...list.querySelectorAll('.cmlr:not(.bgr)')].reverse().map(r=>S.T[+r.dataset.r]);
      if(order.length===S.T.length&&order.every(Boolean)){S.T=order;S.k=S.T.indexOf(sel)}
      sync();
    };
    g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
  });q('#cmici').oninput=ev=>{S.igc=ev.target.value;sync()};
  qa('.cmcol').forEach(i=>i.oninput=ev=>{S.c[+i.dataset.k]=ev.target.value;S.pal=-1;sync()});
  {const cv=q('#cmv');let dr=null,rw=[50,50],sc=null;
   const pt=ev=>{const r=cv.getBoundingClientRect();return[(ev.clientX-r.left)/r.width*1024,(ev.clientY-r.top)/r.height*1024]};
   const lim=T=>T.type==='img'?[5,200]:[20,90];
   /* tap a layer on the preview to pick it (topmost first), then drag to move it; the round corner handle resizes it */
   const hit=ev=>{const [px,py]=pt(ev),W=1024;
     for(let i=S.T.length-1;i>=0;i--){const T=S.T[i];if(!T.bb||T.x==null)continue;const dx=px-T.x/100*W,dy=py-T.y/100*W,a=-(T.rot||0)*Math.PI/180,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(rx)<=T.bb.w/2+30&&Math.abs(ry)<=T.bb.h/2+30)return i}return -1};
   cv.onpointerdown=ev=>{try{cv.setPointerCapture(ev.pointerId)}catch(_){}
     const T0=S.T[S.k],[px,py]=pt(ev);
     if(S.tab==='tx'&&T0&&T0.bb&&T0.x!=null){const c=cmHandle(T0);if(Math.hypot(px-c[0],py-c[1])<=48){const d0=Math.hypot(px-T0.x/100*1024,py-T0.y/100*1024);if(d0>20){sc={T:T0,d0,s0:T0.size};dr=null;S.drag=false;return}}}
     const i=hit(ev);if(i>=0){if(i!==S.k){S.k=i;load()}S.tab='tx';sync()}dr=[ev.clientX,ev.clientY];{const T=cur();rw=[T.x==null?50:T.x,T.y==null?50:T.y];S.drag=true}};
   cv.onpointermove=ev=>{
     if(sc){const [px,py]=pt(ev),T=sc.T,d=Math.hypot(px-T.x/100*1024,py-T.y/100*1024),[a,b]=lim(T);T.size=Math.max(a,Math.min(b,sc.s0*d/sc.d0));cmDraw(cv,S);return}
     if(!dr)return;const T=cur(),r=cv.getBoundingClientRect();rw[0]=Math.max(0,Math.min(100,rw[0]+(ev.clientX-dr[0])/r.width*100));rw[1]=Math.max(0,Math.min(100,rw[1]+(ev.clientY-dr[1])/r.height*100));dr=[ev.clientX,ev.clientY];T.x=rw[0];T.y=rw[1];S.ga=cmSnap(S,T);cmDraw(cv,S)};
   cv.onpointerup=cv.onpointercancel=()=>{const was=S.drag||sc;dr=null;sc=null;S.drag=false;S.ga=null;if(was){cmDraw(cv,S);sl()}};
   cv.addEventListener('wheel',ev=>{const T=S.T[S.k];if(S.tab!=='tx'||!T||!T.bb)return;ev.preventDefault();const [a,b]=lim(T);T.size=Math.max(a,Math.min(b,T.size*(ev.deltaY<0?1.06:.94)));cmDraw(cv,S);sl()},{passive:false})}
  q('#cmpf').onchange=ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{if(S.imgUrl)URL.revokeObjectURL(S.imgUrl);S.imgUrl=u;S.img=im;S.style='photo';sync()};im.onerror=()=>{URL.revokeObjectURL(u);toast('Could not read that image')};im.src=u};
  e.addEventListener('pointerdown',ev=>{if(ev.target===e)fin(null)});
  document.addEventListener('keydown',kd,true);
  document.body.appendChild(e);load();sync();
})}

/* ===== END 17-covermaker.js ===== */


/* ===== BEGIN 18-init.js ===== */
/* static UI and init */
function ui(){
  try{const t=localStorage.getItem('tracks-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else if(t==='custom'){document.documentElement.dataset.theme='custom';applyCustom(CT.hex)}}catch(e){}
  if(LS('tracks-mh'))$('#app').classList.add('mh');
  $('#app').insertAdjacentHTML('beforeend',`<button id="mshow" data-act="minishow" aria-label="Show player">${ic('chev',18)}</button>`);
  $('#plus').innerHTML=ic('plus',26);$('#qk').innerHTML=ic('qm',22);
  $('#app').insertAdjacentHTML('beforeend',`<div id="selbar"><div class="sr"><button class="ib" data-act="selexit" aria-label="Done">${ic('close',22)}</button><span id="selc">0 selected</span><button class="pill" data-act="selall">All</button></div><div class="sg"><button class="ib" data-act="selalbum" aria-label="Add to album">${ic('album',22)}</button><button class="ib" data-act="selpl" aria-label="Add to playlist">${ic('plist',22)}</button><button class="ib" data-act="selqueue" aria-label="Add to queue">${ic('qm',23)}</button><button class="ib" data-act="selcolor" aria-label="Change color">${ic('palette',22)}</button><button class="ib" data-act="seltag" aria-label="Tag artist and album">${ic('tag',22)}</button><button class="ib" id="selrm" data-act="selrm" aria-label="Remove from this list">${ic('minus',22)}</button><button class="ib" data-act="seldel" aria-label="Delete songs">${ic('trash',22)}</button><button class="ib gb" data-act="gmove" aria-label="Move to folder">${ic('move',22)}</button><button class="ib gb" data-act="gpos" aria-label="Change position">${ic('reorder',22)}</button><button class="ib gb" data-act="gdel" aria-label="Delete">${ic('trash',22)}</button></div></div>`);
  $('#gear').innerHTML=ic('gear',24);paintTheme();applyLayout();
  new ResizeObserver(()=>document.documentElement.style.setProperty('--tp',$('#top').offsetHeight+'px')).observe($('#top'));
  $('#tb').innerHTML=`<div class="sb" id="sb"><button class="sbi" data-act="search" aria-label="Search">${ic('search',22)}</button><input id="sq" type="search" placeholder="Search songs, artists, albums" autocomplete="off" enterkeyhint="search" aria-label="Search songs"><button class="sbx" data-act="clearsearch" aria-label="Clear search">${ic('close',20)}</button></div><button class="pill" id="selbtn" data-act="select" aria-label="Select songs">${ic('sel',20)}</button><button class="pill" id="flt" data-act="filter">${ic('filter',18)}<span id="fl"></span></button>`;
  tbmApply();
  let sqA=0;
  $('#sq').oninput=()=>{view.q=$('#sq').value;clearTimeout(sqT);if(songs.length<400)render();else sqT=setTimeout(render,160);
    clearTimeout(sqA);const q=view.q.trim();if(q)sqA=setTimeout(()=>{const n=document.querySelectorAll('#main .row').length;say(n?n+(n===1?' song found':' songs found'):'No songs found')},700)};
  $('#sq').onblur=()=>{if(!$('#sq').value)closeSearch()};
  $('#mini').innerHTML=`<video class="mbv mv" muted loop playsinline preload="none" disablepictureinpicture tabindex="-1" aria-hidden="true"></video><button class="mhide" data-act="minihide" aria-label="Hide player">${ic('chev',18)}</button><div class="m1"><div class="mcv" id="mc"></div><div class="t"><b id="mt"></b><span id="ms"></span></div>${likeBtn()}${oneBtn()}<button class="ib" data-act="minialbum" aria-label="Add to album">${ic('album',22)}</button><button class="ib" data-act="miniplaylist" aria-label="Add to playlist">${ic('plist',22)}</button></div>
  <div class="m3"><span id="mct">0:00</span><input type="range" class="rng" id="msk" min="0" max="1000" value="0" style="--f:rgb(var(--ac))" aria-label="Seek"><span id="mdt">0:00</span></div><div class="m2"><button class="ib" data-act="vol" data-vi data-s="22" aria-label="Volume">${ic('vol',22)}</button><div class="mvs"><input type="range" class="rng" id="mvl" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%;--f:rgb(var(--ac))" aria-label="Volume"><button class="ib mt2" data-act="mute" aria-label="Mute or unmute">${ic('volx',16)}</button><button class="ib nmb mnm" data-act="norm" aria-pressed="false" aria-label="Normalize volume" title="Normalize volume">${ic('norm',17)}</button></div><button class="ib tg" data-act="shuffle" aria-label="Shuffle"></button><button class="ib" data-act="prev" aria-label="Previous">${ic('prev',24)}</button><button class="ib mp" id="mp" data-act="toggle" aria-label="Play or pause"></button><button class="ib" data-act="next" aria-label="Next">${ic('next',24)}</button><button class="ib tg" data-act="repeat" aria-label="Repeat"></button><button class="ib" data-act="qopen" aria-label="Queue">${ic('qm',22)}</button></div>`;
  $('#app').insertAdjacentHTML('beforeend',`<div id="vp"><button class="ib mt" data-act="mute" data-vi data-s="20" aria-label="Mute or unmute">${ic('vol',20)}</button><input type="range" class="rng" id="vol" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%" aria-label="Volume"></div>`);
  $('#vol').oninput=e=>{setVol(e.target.value/100);vpTimer()};
  $('#mvl').oninput=e=>{setVol(e.target.value/100);vpTimer()};nmPaint();
  $('#msk').oninput=e=>{if(vD())vSeek(e.target.value/1000*vD());e.target.style.setProperty('--p',(e.target.value/10)+'%');$('#mct').textContent=fmt(vT())};
  $('#msk').onpointerdown=()=>{seeking=true};
  $('#app').insertAdjacentHTML('beforeend',`<div id="qp"><div class="qh"><h3>Queue</h3><div class="qa"><button class="ovx" data-act="qshuf" aria-label="Shuffle upcoming songs">${ic('shuffle',18)}</button><button class="ovx" id="qundo" data-act="qundo" aria-label="Undo last queue change" title="Undo" disabled>${ic('undo',18)}</button><button class="pill" data-act="qclear" title="Remove everything after the current song">Clear all</button><button class="ovx" data-act="qclose" aria-label="Close queue">${ic('close',16)}</button></div></div><div id="ql"></div></div>`);
  $('#mini .m1').addEventListener('click',e=>{if(e.target.closest('[data-act]'))return;openFull()});
  $('#app').insertAdjacentHTML('beforeend',`<aside id="np" aria-label="Now playing"><div class="npg" id="npg" role="separator" aria-orientation="vertical" aria-label="Drag to resize the panel" title="Drag to resize (double-click to reset)"></div><div class="npge" id="npge"></div><div class="nph"><b>Now playing</b><span class="nphr"><button class="ib" data-npa="full" aria-label="Open full player" title="Full screen player">${ic('npx',22)}</button></span></div><div class="npc" id="npc" data-npa="full"></div><div class="npi"><div class="npn"><h2 id="npt"></h2><p id="nps"></p></div>${likeBtn()}${oneBtn()}</div><div class="npl" id="npl"></div></aside><div id="npb"><div class="nl"><div class="nc" id="nbc" data-npa="full"></div><div class="nt"><b id="nbt"></b><span id="nbs"></span></div><div class="npa">${likeBtn()}${oneBtn()}<button class="ib" data-act="minialbum" aria-label="Add to album" title="Add to album">${ic('album',22)}</button><button class="ib" data-act="miniplaylist" aria-label="Add to playlist" title="Add to playlist">${ic('plist',22)}</button><button class="ib" data-act="editfull" aria-label="Edit song details" title="Edit song details">${ic('edit',22)}</button><button class="ib npm" data-act="npmore" aria-label="More options" title="Like, add to album or playlist, edit details">${ic('dots',22)}</button></div></div><div class="nm"><div class="nctl"><button class="ib tg" data-act="shuffle" aria-label="Shuffle"></button><button class="ib" data-act="prev" aria-label="Previous">${ic('prev',24)}</button><button class="ib mp" id="nbp" data-act="toggle" aria-label="Play or pause"></button><button class="ib" data-act="next" aria-label="Next">${ic('next',24)}</button><button class="ib tg" data-act="repeat" aria-label="Repeat"></button></div><div class="nsk"><span id="nbct">0:00</span><input type="range" class="rng" id="nbsk" min="0" max="1000" value="0" aria-label="Seek"><span id="nbdt">0:00</span></div></div><div class="nr"><button class="ib${NP.ly?' on':''}" data-npa="ly" aria-label="Show lyrics" title="Lyrics">${ic('mic',22)}</button><button class="ib nmb pnm" data-act="norm" aria-pressed="false" aria-label="Normalize volume" title="Normalize volume">${ic('norm',22)}</button><button class="ib" data-act="qopen" aria-label="Queue" title="Queue (hold for the full queue)">${ic('qm',22)}<svg class="qring" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="17"/></svg></button><span class="nvg"><button class="ib mt" data-act="mute" data-vi data-s="20" aria-label="Mute or unmute">${ic('vol',20)}</button><input type="range" class="rng" id="nbvl" min="0" max="100" value="${Math.round(uvol*100)}" style="--p:${Math.round(uvol*100)}%" aria-label="Volume"></span></div></div>`);
  $('#np').addEventListener('click',npClick);$('#npb').addEventListener('click',npClick);$('#npb').addEventListener('wheel',npbWheel,{passive:false});nmPaint();
  $('#nbsk').oninput=e=>{if(vD())vSeek(e.target.value/1000*vD());e.target.style.setProperty('--p',(e.target.value/10)+'%');$('#nbct').textContent=fmt(vT())};
  $('#nbsk').onpointerdown=()=>{seeking=true};
  $('#nbvl').oninput=e=>setVol(e.target.value/100);
  ['wheel','touchstart','pointerdown'].forEach(ev=>$('#npl').addEventListener(ev,()=>{NP.user=Date.now()},{passive:true}));
  npApply();
  syncCtl();
}
(async()=>{
  try{db=await openDB();songs=(await tx('songs','readonly',s=>s.getAll()))||[];albums=(await tx('albums','readonly',s=>s.getAll()))||[];folders=(await tx('folders','readonly',s=>s.getAll()))||[];playlists=(await tx('playlists','readonly',s=>s.getAll()))||[];pfolders=(await tx('pfolders','readonly',s=>s.getAll()))||[];await lyDbLoad()}catch(e){db=null}
  try{await medLoad()}catch(e){}
  songs.sort((a,b)=>a.added-b.added);
  ui();mvInit();tbgApply();applyBg();restoreLast();render();if(window.splashReady)window.splashReady();
  $('#plus').insertAdjacentHTML('afterend',`<button class="ib" id="cb" data-act="cloud" aria-label="Google Drive sync" title="Google Drive sync" style="margin-left:10px;margin-right:auto">${ic('cloud',24)}</button>`);$('#qk').title='Queue (Q)';try{hbPlace()}catch(e){}$('#gear').title='Settings';$('#plus').title='Create / import';
  parseTok();if(LS('tracks-cloud')){cloudSt('Connected');if(navigator.onLine)cloudSync(false)}
  if(!db)toast('Storage unavailable, songs last until you close this page');
  const SS=new Set(songs);
  for(const o of [...songs,...albums]){
    if(o.cover&&!o.ccol){const c=await colorFromUrl(o.cover);if(c){o.ccol=c;await put(SS.has(o)?'songs':'albums',o)}}
  }
  renderMini();lyBoot();medBootGC();shareIntake();shareOpen();albumOpen();fpInit();
})();
/* ===== Edge swipe = back =====
   Swipe in from the left or right screen edge: closes the top-most layer (sheet, queue, full player, search, selection)
   or goes up one level in the library (song > album > folder). Settings > Layout > Gestures switches it off.
   One history entry is kept in reserve so the phone's own back gesture / back button does the same instead of closing the app. */
(()=>{
  const ZONE=24,ZONE2=44,MIN=64,MAXW=()=>innerWidth;/* phones' own back gesture owns roughly the outer 24px, so the page also accepts swipes that start a little further in (not on a song row: that swipe adds to the queue) */
  const vis=el=>!!(el&&el.getClientRects().length);
  function backStep(){
    if(document.querySelector('#crop,#cmk,#fpbar'))return true;/* editors: swallow, they have their own buttons */
    const ov=$('#ov');
    if(ov&&ov.classList.contains('open')){ov.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true}
    if(qOpen){closeQ();return true}
    if($('#full').classList.contains('open')){closeFull();return true}
    if(selMode){selMode=false;selSet.clear();render();return true}
    const sb=$('#sb');if(sb&&sb.classList.contains('open')){closeSearch();return true}
    const b=[...document.querySelectorAll('#app [data-act="back"]')].find(vis);
    if(b){b.click();return true}
    return false;
  }
  /* finger-following back bubble in the accent colour */
  let ind=null,st=null;
  const mk=()=>{if(ind)return ind;ind=document.createElement('div');ind.id='gbk';ind.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';document.body.appendChild(ind);return ind};
  const paintInd=(side,dx,y)=>{
    const el=mk(),p=Math.min(1,dx/MIN),w=46;
    el.classList.toggle('r',side==='r');
    el.style.display='flex';el.style.top=Math.max(60,Math.min(innerHeight-60,y))+'px';el.style.marginTop='-23px';
    const off=-w+p*(w+14);/* slides in from off-screen */
    el.style.left=side==='l'?'0':'auto';el.style.right=side==='r'?'0':'auto';
    el.style.transform='translateX('+(side==='l'?off:-off)+'px) scale('+(.7+.3*p)+')';
    el.style.opacity=String(.35+.65*p);
  };
  const hideInd=(done)=>{
    if(!ind)return;const el=ind;
    if(done&&!RM.matches){el.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'});setTimeout(()=>{el.style.display='none';el.getAnimations().forEach(a=>a.cancel())},170)}
    else{el.style.display='none'}
  };
  addEventListener('touchstart',e=>{
    st=null;
    if(!GEST.on||e.touches.length!==1)return;
    const t=e.touches[0],x=t.clientX,w=MAXW();
    const near=e.target.closest&&e.target.closest('.row[data-act="play"],input[type=range],canvas,.chips');
    const z=near?ZONE:ZONE2;
    const side=x<=z?'l':x>=w-z?'r':null;
    if(!side)return;
    st={side,sx:x,sy:t.clientY,lock:false,hit:false,dx:0};
  },{passive:true,capture:true});
  addEventListener('touchmove',e=>{
    if(!st)return;
    if(e.touches.length!==1){st=null;hideInd();return}
    const t=e.touches[0],dx=st.side==='l'?t.clientX-st.sx:st.sx-t.clientX,dy=Math.abs(t.clientY-st.sy);
    if(!st.lock){
      if(dy>14&&dy>dx*1.2){st=null;return}/* it is a vertical scroll */
      if(dx>8&&dx>dy*.9)st.lock=true;else return;
    }
    st.dx=Math.max(0,dx);
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
    if(!st.hit&&st.dx>=MIN){st.hit=true;try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}
    else if(st.hit&&st.dx<MIN)st.hit=false;
    paintInd(st.side,st.dx,t.clientY);
  },{passive:false,capture:true});
  const end=ok=>{
    if(!st)return;
    const go=ok&&st.lock&&st.dx>=MIN;st.lock&&hideInd(go);st=null;
    if(go)backStep();
  };
  addEventListener('touchend',()=>end(true),{passive:true,capture:true});
  addEventListener('touchcancel',()=>end(false),{passive:true,capture:true});

  /* the phone's own back gesture / button: keep one spare history entry and use it to step back inside the app */
  let armed=false,tried=false;
  const arm=()=>{try{history.pushState({trax:1},'',location.href);armed=true}catch(_){}};
  const EV=['pointerup','touchend','click','keydown'];
  const first=()=>{if(tried)return;tried=true;EV.forEach(n=>removeEventListener(n,first,true));arm()};/* browsers skip history entries made before a completed tap or key press, so wait for one */
  EV.forEach(n=>addEventListener(n,first,true));
  addEventListener('popstate',()=>{
    if(!armed)return;
    armed=false;
    if(GEST.on&&backStep()){arm();return}
    try{history.back()}catch(_){}/* nothing left to close: let the phone leave the app as usual */
  });
})();


/* ===== Audio output device =====
   Chrome and Edge (desktop and Android) can send sound to a chosen output with setSinkId. Safari and iOS cannot:
   there the system decides (Control Centre, AirPlay), so the sheet offers the AirPlay picker when the browser has one. */
const OUT={id:LS('tracks-outdev')||'',label:LS('tracks-outlbl')||''};
const outCan=()=>typeof au.setSinkId==='function';
const outName=()=>OUT.id?(OUT.label||'Selected device'):'System default';
async function outApply(){
  if(!outCan())return true;
  try{await au.setSinkId(OUT.id||'')}catch(e){return false}
  try{if(fxAC&&fxAC.setSinkId)await fxAC.setSinkId(OUT.id||'')}catch(e){}
  return true;
}
async function outDevices(){
  try{return(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput'&&d.deviceId!=='communications')}catch(e){return[]}
}
const outKind=l=>/bluetooth|buds|airpods|earphone|earbud|headset|headphone|hands-?free/i.test(l)?'Bluetooth or headphones':/speaker|built-?in|internal|phone|earpiece/i.test(l)?'Speaker':/hdmi|display|tv|monitor/i.test(l)?'Screen or TV':/usb|dock|dac/i.test(l)?'USB audio':'Audio output';
function outSave(id,label){OUT.id=id||'';OUT.label=id?(label||''):'';LS('tracks-outdev',OUT.id||null);LS('tracks-outlbl',OUT.label||null)}
async function outPick(id,label){
  const prev={id:OUT.id,label:OUT.label};
  outSave(id,label);
  const ok=await outApply();
  if(!ok){outSave(prev.id,prev.label);await outApply();toast('Could not switch to that device');return false}
  toast(id?'Playing on '+(label||'the selected device'):'Playing on the system default');
  return true;
}
function outSheet(){
  const known=outCan(),pick=typeof navigator.mediaDevices?.selectAudioOutput==='function',air=typeof au.webkitShowPlaybackTargetPicker==='function';
  openOv(`<h3>Output device</h3><div class="scd" id="outl"><p class="dupn" style="margin:6px">Looking for devices\u2026</p></div><div id="outx"></div><div class="bt"><button type="button" class="pill acc" id="outdn">Done</button></div>`);
  const sh=$('#ov .sheet');if(!sh)return;
  const L=()=>sh.querySelector('#outl'),X=()=>sh.querySelector('#outx');
  const row=(id,t,d,on)=>`<button type="button" class="srow" data-od="${esc(id)}" data-ol="${esc(t)}" role="radio" aria-checked="${on}"><span class="st"><b>${esc(t)}</b>${d?`<small>${esc(d)}</small>`:''}</span><span class="sv">${on?'Playing here':''}</span></button>`;
  let busy=false;
  const paint=async()=>{
    if(!L())return;
    const dev=known?await outDevices():[];if(!L())return;
    const named=dev.filter(d=>d.label),seen=new Set();
    let h=row('','System default','Phone or computer speaker, or whatever the system is connected to',!OUT.id);
    named.forEach(d=>{if(d.deviceId==='default'||seen.has(d.deviceId))return;seen.add(d.deviceId);h+=row(d.deviceId,d.label,outKind(d.label),OUT.id===d.deviceId)});
    if(OUT.id&&!seen.has(OUT.id))h+=row(OUT.id,OUT.label||'Selected device','Not seen right now',true);
    L().innerHTML=h;
    const nameless=dev.length>0&&!named.length;let x='';
    if(known&&pick)x+=`<div class="bt" style="margin-top:6px"><button type="button" class="pill" id="outsel">Choose another device\u2026</button></div>`;
    if(known&&!pick&&(!named.length||nameless))x+=`<div class="bt" style="margin-top:6px"><button type="button" class="pill" id="outperm">Show device names</button></div><p class="dupn" style="margin:6px">Your browser only shows names after the microphone permission is allowed. Nothing is recorded.</p>`;
    if(air)x+=`<div class="bt" style="margin-top:6px"><button type="button" class="pill" id="outair">${ic('out',16)}AirPlay and Bluetooth\u2026</button></div>`;
    if(!known)x+=`<p class="dupn" style="margin:8px 6px">${air?'This browser lets the system choose the speaker. Use the button above, or the audio output control in your phone settings.':'This browser cannot switch the speaker from inside the app. Connect your Bluetooth earbuds or speaker in the phone settings, and sound moves there automatically.'}</p>`;
    X().innerHTML=x;
  };
  sh.addEventListener('click',async e=>{
    if(e.target.closest('#outdn')){closeOv();return}
    if(busy)return;
    const r=e.target.closest('[data-od]');
    if(r){if(!known){toast('This browser cannot switch the output');return}busy=true;await outPick(r.dataset.od,r.dataset.ol);busy=false;paint();return}
    if(e.target.closest('#outsel')){busy=true;try{const d=await navigator.mediaDevices.selectAudioOutput();if(d&&d.deviceId)await outPick(d.deviceId,d.label)}catch(_){}busy=false;paint();return}
    if(e.target.closest('#outperm')){busy=true;try{const st=await navigator.mediaDevices.getUserMedia({audio:true});st.getTracks().forEach(t=>t.stop())}catch(_){toast('Permission was not given')}busy=false;paint();return}
    if(e.target.closest('#outair')){try{au.webkitShowPlaybackTargetPicker()}catch(_){}return}
  });
  sh.addEventListener('outrefresh',paint);
  paint();
}
/* an output that disappears (earbuds switched off) falls back to the system default */
try{navigator.mediaDevices&&navigator.mediaDevices.addEventListener('devicechange',async()=>{
  if(OUT.id){const d=await outDevices();if(d.length&&!d.some(x=>x.deviceId===OUT.id)){outSave('','');await outApply();toast('Output device disconnected. Using the system default')}}
  const b=$('#outl')&&$('#ov .sheet');if(b)b.dispatchEvent(new CustomEvent('outrefresh'));
})}catch(_){}
if(OUT.id)outApply().then(ok=>{if(!ok){outSave('','')}});

/* ===== Reset buttons next to sliders =====
   Every adjustment slider gets the round reset arrow; volume, seek, scroll and preview sliders never do.
   A reset sets the default and fires the slider's own input and change events, so each sheet reacts as if you dragged there. */
const RST_DEF={cpz:100,cpx:500,cpy:500,fcr:160,fco:100,icsz:44,icgp:8,tbd:55,tbb:0,tpt:22,tpb:18,npwr:360,cmd2:35,cmg:18,cmia:50,cmga:90,cmfa:50,cmsr:0,cmmx:50,cmmy:50,cmmr:0,cmmo:100,cmmc:0};
const RST_NAME={cpz:'Zoom',cpx:'X',cpy:'Y'};
function rstClick(btn){
  const f=btn.closest('.fop'),i=f&&f.querySelector('input.rng');if(!i)return;
  const id=i.id;
  if(id==='tpt'||id==='tpb'){/* top bar: back to untouched, not to a stored number */
    TPB[id==='tpt'?'t':'b']=null;tpbSave();tpbApply();
    const v=RST_DEF[id],mx=id==='tpt'?100:40;i.value=v;i.style.setProperty('--p',(v/mx*100)+'%');const b=f.querySelector('b');if(b)b.textContent=v+(id==='tpt'?'%':'px');return;
  }
  let d=i.dataset.def!=null&&i.dataset.def!==''?+i.dataset.def:RST_DEF[id];
  if(d==null||!isFinite(d))return;
  d=Math.min(+i.max,Math.max(+i.min,d));
  i.value=d;
  i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));
  try{navigator.vibrate&&navigator.vibrate(6)}catch(_){}
}
function rstScan(){
  document.querySelectorAll('.fop').forEach(f=>{
    if(f.querySelector('.rsb'))return;
    const i=f.querySelector('input.rng');if(!i||!i.id)return;
    if(!(i.id in RST_DEF)&&i.dataset.def==null&&i.id!=='cmz'&&i.id!=='cmmz')return;
    const lb=i.getAttribute('aria-label')||RST_NAME[i.id]||'slider';
    const b=document.createElement('button');b.type='button';b.className='rsb';b.dataset.rg='1';
    b.setAttribute('aria-label','Reset '+lb+' to default');b.title='Reset to default';b.innerHTML=ic('rst',16);
    f.appendChild(b);
  });
}
{
  let q=0;const sched=()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;try{rstScan()}catch(_){}})};
  const hit=n=>n.nodeType===1&&(n.classList.contains('fop')||n.querySelector('.fop'));
  const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(hit(n)){sched();return}});
  mo.observe(document.body,{childList:true});
  const ov=document.getElementById('ov');if(ov)mo.observe(ov,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('.rsb[data-rg]');if(!b)return;
    e.preventDefault();e.stopPropagation();rstClick(b);
  },true);
  sched();
}

/* last-resort safety net: a stray error must never freeze the app silently. Log it, tell the person once in a while, keep playing. */
(function(){let t=0;const warn=e=>{console.error('traXz',e);if(Date.now()-t<10000)return;t=Date.now();try{toast('Something went wrong. If it keeps happening, reload the page.')}catch(_){}};
  addEventListener('unhandledrejection',ev=>{warn(ev.reason)});
  addEventListener('error',ev=>{if(ev&&ev.target&&ev.target!==window)return;warn(ev&&(ev.error||ev.message))})})();

/* ===== END 18-init.js ===== */
