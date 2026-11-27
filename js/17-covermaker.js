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
