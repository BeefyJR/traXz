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

