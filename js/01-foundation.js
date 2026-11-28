

/* ===== BEGIN 01-core.js ===== */
const $=s=>document.querySelector(s),au=$('#au');
/* Performance mode: Off / Auto / On. Auto switches on for weak devices, Data Saver and low battery. It only lightens the look (no frosted glass, no animated media, lighter beat effects, shorter animations); nothing is removed. */
/* Each feature can be lightened on its own: PF lists them. Off / Auto / On set all of them together; Custom lets you pick (checked = animated). PERF.f[key] is true when that feature runs in its light form. */
const PF=[['glass','Frosted glass','Blurred bars and sheets'],['ui','Interface animations','Sheets and list fades'],['bg','Moving background','Drifting colour blobs'],['media','GIF and video covers','Animated instead of still'],['beat','Beat effects','Glow and ripples with the music'],['trans','Song change transitions','Slide, cube and flip in the big player']];
const PERF={m:'off',on:false,bat:false,f:{},c:{},sig:''};
try{const v=localStorage.getItem('tracks-perf');if(v==='on'||v==='auto'||v==='off'||v==='custom')PERF.m=v}catch(e){}
try{const c=JSON.parse(localStorage.getItem('tracks-perf-c')||'null');if(c&&typeof c==='object')PF.forEach(k=>{PERF.c[k[0]]=!!c[k[0]]});else PF.forEach(k=>{PERF.c[k[0]]=false})}catch(e){PF.forEach(k=>{PERF.c[k[0]]=false})}
function perfCalc(){
  if(PERF.m==='custom')return false;
  if(PERF.m==='on')return true;if(PERF.m==='off')return false;
  try{const n=navigator;return !!((n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency&&n.hardwareConcurrency<=4)||(n.connection&&n.connection.saveData)||PERF.bat)}catch(e){return false}
}
function perfApply(){
  PERF.on=perfCalc();
  PF.forEach(k=>{PERF.f[k[0]]=PERF.m==='custom'?!!PERF.c[k[0]]:PERF.on});
  const d=document.documentElement.dataset,F=PERF.f;
  d.perf=PERF.on?'on':'off';d.pgl=F.glass?'on':'off';d.pui=F.ui?'on':'off';d.pbg=F.bg?'on':'off';d.ptr=F.trans?'on':'off';
  PERF.sig=PF.map(k=>F[k[0]]?1:0).join('');
}
perfApply();
/* the screen is redrawn only when the effective state really changed */
function perfRefresh(){
  const was=PERF.sig;perfApply();
  if(was===PERF.sig)return;try{if(!db)return}catch(e){return}
  try{render()}catch(e){}
  miniSig=null;try{renderMini()}catch(e){}
  if($('#full').classList.contains('open')){fullSig=null;try{renderFull()}catch(e){}}
  try{applyBg();tbgApply();mvEval();fxKick()}catch(e){}
}
function perfSaveC(){try{localStorage.setItem('tracks-perf-c',JSON.stringify(PERF.c))}catch(e){}}
function setPerf(m){
  m=(m==='on'||m==='auto'||m==='custom')?m:'off';
  if(m==='custom'&&PERF.m!=='custom'){PF.forEach(k=>{PERF.c[k[0]]=!!PERF.f[k[0]]});perfSaveC()}/* Custom starts from whatever is active right now */
  PERF.m=m;try{localStorage.setItem('tracks-perf',PERF.m)}catch(e){}perfRefresh()}
function setPerfF(key,lite){PERF.c[key]=!!lite;perfSaveC();if(PERF.m==='custom')perfRefresh()}
try{if(navigator.getBattery)navigator.getBattery().then(b=>{const f=()=>{PERF.bat=!b.charging&&b.level<=.2;if(PERF.m==='auto')perfRefresh()};b.addEventListener('levelchange',f);b.addEventListener('chargingchange',f);f()}).catch(()=>{})}catch(e){}
const PERF_NOTE={off:'Full looks and animations.',auto:'Lightens things on slow devices, Data Saver or low battery.',on:'Solid bars, still covers, simple beat effects and short animations. Playback is not affected.',custom:'Pick which features stay fancy.'};
let lyOn=false;/* lyrics mode of the big player (declared early: the beat-effect loop reads it) */
const ICON={cut:'M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z',norm:'M7 3.5h10L12 9.5zM7 20.5h10L12 14.5zM3.5 11h17v2h-17z',rst:'M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm-6 8c0-1.65.67-3.15 1.76-4.24L6.34 7.34C4.9 8.79 4 10.79 4 13c0 4.08 3.05 7.44 7 7.93v-2.02c-2.83-.48-5-2.94-5-5.91z',fxi:'M10.5 4.5a1.5 1.5 0 013 0v15a1.5 1.5 0 01-3 0zM6 8a1.5 1.5 0 013 0v8a1.5 1.5 0 01-3 0zM15 8a1.5 1.5 0 013 0v8a1.5 1.5 0 01-3 0zM1.5 10.5a1.5 1.5 0 013 0v3a1.5 1.5 0 01-3 0zM19.5 10.5a1.5 1.5 0 013 0v3a1.5 1.5 0 01-3 0z',plist:'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z',tune:'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',edit:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',szs:'M3 3h5v5H3zM9.5 3h5v5h-5zM16 3h5v5h-5zM3 9.5h5v5H3zM9.5 9.5h5v5h-5zM16 9.5h5v5h-5zM3 16h5v5H3zM9.5 16h5v5h-5zM16 16h5v5h-5z',szm:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',szl:'M5 5h14v14H5z',play:'M8 5v14l11-7z',pause:'M6 5h4v14H6zM14 5h4v14h-4z',next:'M6 6l9 6-9 6zM17 6h2v12h-2z',prev:'M18 6l-9 6 9 6zM5 6h2v12H5z',
more:'M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z',down:'M7 10l5 5 5-5z',
shuffle:'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
repeat:'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
repeat1:'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z',
plus:'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
search:'M15.5 14h-.8l-.3-.3A6.5 6.5 0 109.5 16a6.5 6.5 0 004.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 110-9 4.5 4.5 0 010 9z',
close:'M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
filter:'M3 6h18v2H3V6zm4 5h10v2H7v-2zm3 5h4v2h-4v-2z',
folder:'M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z',
addpl:'M14 10H3v2h11v-2zm0-4H3v2h11V6zM3 16h7v-2H3v2zm11-2v3h-3v2h3v3h2v-3h3v-2h-3v-3h-2z',
clock:'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z',
vol:'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8v8a4.5 4.5 0 002.5-4z',
sun:'M12 7a5 5 0 100 10 5 5 0 000-10zM2 13h2v-2H2v2zm18 0h2v-2h-2v2zM11 2v2h2V2h-2zm0 18v2h2v-2h-2zM5.99 4.58L4.58 5.99l1.41 1.41 1.42-1.41-1.42-1.42zm12.02 12.02l-1.41 1.41 1.41 1.42 1.42-1.42-1.42-1.41zM18.01 5.99l1.41-1.41-1.41-1.42-1.42 1.42 1.42 1.41zM5.99 18.01l-1.41-1.41-1.42 1.41 1.42 1.42 1.41-1.42z',moon:'M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.5 5.5 0 01-4.51 2.36 5.5 5.5 0 01-5.5-5.5c0-1.85.92-3.49 2.33-4.48A9.1 9.1 0 0012 3z',volx:'M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',sel:'M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11L2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 11zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 19z',check:'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',palette:'M12 3a9 9 0 000 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4c2 0 3.6-1.6 3.6-3.6C21 6.6 16.9 3 12 3zM6.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',tag:'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z',arrow:'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',chev:'M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z',dots:'M6 10a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4zm-6 0a2 2 0 100 4 2 2 0 000-4z',pencil:'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',image:'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',trash:'M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',up:'M12 8l-6 6 1.4 1.4L12 10.8l4.6 4.6L18 14z',qm:'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z'};
ICON.gear='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';ICON.phone='M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z';ICON.desk='M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z';ICON.devices='M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z';
ICON.album='M12 2a10 10 0 100 20 10 10 0 000-20zM12 4.4a7.6 7.6 0 110 15.2 7.6 7.6 0 010-15.2zM12 5.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM12 7.1a4.9 4.9 0 110 9.8 4.9 4.9 0 010-9.8zM12 8.1a3.9 3.9 0 100 7.8 3.9 3.9 0 000-7.8zM12 10.8a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z';const FLD='M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z';ICON.folderplus=FLD+'M11 9h2v3h3v2h-3v3h-2v-3H8v-2h3z';ICON.filep='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM11 12h2v2h2v2h-2v2h-2v-2H9v-2h2z';ICON.impfld=FLD+'M11 9h2v3h2.5L12 16l-3.5-4H11z';ICON.impalb=FLD+'M12 9a4 4 0 110 8 4 4 0 010-8zM12 11.6a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z';ICON.imppl=FLD+'M13.6 9.5L16 11.4v1.8l-2.4-1.4zM12.2 9.5h1.4v6.5h-1.4zM10.5 14.6a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2z';ICON.spotify='M12 2a10 10 0 100 20 10 10 0 000-20zM6 9Q12.2 6.8 18.2 10l-.7 1.5Q12 8.7 6.7 10.6zM7 12.6Q12 11 16.8 13.6l-.6 1.4Q11.8 12.6 7.5 14zM7.8 15.7Q12 14.6 15.6 16.6l-.5 1.3Q11.8 16.2 8.3 17.1z';ICON.trans='M9 7h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2zM1.5 12L5 8v8zM22.5 12L19 8v8z';ICON.minus='M12 2a10 10 0 100 20 10 10 0 000-20zm5 11H7v-2h10v2z';ICON.reorder='M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z';ICON.unalb='M19 13H5v-2h14v2z';
ICON.mic='M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z';
ICON.swaph='M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z';
ICON.note='M12 3v10.55A4 4 0 1014 17V7h4V3z';
ICON.share='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';
{const R='M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2zm2 0v14h14V5z';ICON.dkt=R+'M5 5h14v3H5z';ICON.dkl=R+'M5 5h3v14H5z';ICON.dkr=R+'M16 5h3v14h-3z';ICON.dkb=R+'M5 16h14v3H5z'}
{const B1='M5 15h3v5H5z',B2='M10.5 10h3v10h-3z',B3='M16 4h3v16h-3z',S1='M5 19h3v1H5z',S2='M10.5 19h3v1h-3z',S3='M16 19h3v1h-3z';
ICON.lvl1=B1+S2+S3;ICON.lvl2=B1+B2+S3;ICON.lvl3=B1+B2+B3}
ICON.wave='M3 10h2v4H3zm4-4h2v12H7zm4-3h2v18h-2zm4 6h2v6h-2zm4 2h2v2h-2z';
ICON.power='M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0119 12c0 3.87-3.13 7-7 7A6.995 6.995 0 017.58 6.58L6.17 5.17A8.932 8.932 0 003 12a9 9 0 0018 0c0-2.74-1.23-5.18-3.17-6.83z';
ICON.stopsq='M6 6h12v12H6z';
ICON.up='M7 14l5-5 5 5z';
ICON.eye='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z';
ICON.eyeoff='M2 4.27L3.27 3 21 20.73 19.73 22l-2.9-2.9A11.4 11.4 0 0112 19.5C7 19.5 2.73 16.39 1 12a11.7 11.7 0 013.6-4.9L2 4.27zM12 7a5 5 0 015 5c0 .65-.13 1.26-.36 1.83L14.8 12A3 3 0 0012 9l-1.1-1.1c.33-.6.7-.9 1.1-.9zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65a3 3 0 003 3c.22 0 .44-.03.65-.08l1.55 1.55A5 5 0 017.53 9.8zM12 4.5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 01-2.67 3.9l-1.43-1.43A9.6 9.6 0 0020.8 12 9.8 9.8 0 0012 6.5c-.7 0-1.4.07-2.05.2L8.4 5a11.9 11.9 0 013.6-.5z';
ICON.reset='M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z';
ICON.out='M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z';
ICON.move='M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2zm4 7l4 4-4 4v-3H8v-2h6v-3z';
const _icC=new Map();
const ic=(n,s)=>{const k=n+'|'+(s||'');let v=_icC.get(k);if(v===void 0){v=`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${s?`style="width:${s}px;height:${s}px"`:''}><path d="${ICON[n]}"/></svg>`;_icC.set(k,v)}return v};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* images that reach an HTML attribute must be real image data (data:image/... or blob:), never free text from a backup, a sync file or a link */
const _SI=new Map(),SI_OK=/^(?:data:image\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*;base64,|data:image\/[a-z0-9.+-]+,|blob:)[^\s"'<>()\\]*$/i;
const safeImg=u=>{if(typeof u!=='string'||!u)return '';let r=_SI.get(u);if(r===undefined){r=SI_OK.test(u)?u:'';if(_SI.size>2000)_SI.clear();_SI.set(u,r)}return r};
const fmt=t=>{if(!t||!isFinite(t))return '0:00';t=Math.round(t);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
/* playback state shared by Trim and Transitions */
let uvol=1,TR=null;
const LP={g:null,u:null,key:null,busy:0,iv:0,vs:null},LPN={id:null,left:0,tail:0,t:0};   /* section loop state, see Section loop */
const XF={arm:0,id:null,pl:null,tm:0,pre:null,preId:null,g:null,gp:0,live:0,iv:0,ov:0,inr:0,mid:0,ended:0,pend:null};
ICON.cut='M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.89-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z';
const cmp=(a,b)=>String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true});
/* search folding: case and accents are ignored ("Beyonce" finds "Beyoncé", "Sigur Ros" finds "Sigur Rós"); punctuation is kept so "AC/DC" still matches as typed */
const FOLDX={'ø':'o','ł':'l','đ':'d','ð':'d','ß':'ss','æ':'ae','œ':'oe','þ':'th','ı':'i'};
const fold=t=>String(t==null?'':t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[øłđðßæœþı]/g,c=>FOLDX[c]);

/* colors */
const hue=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%360;return h};
function hsl2rgb(h,s,l){h=((h%360)+360)%360/360;const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return [f(0),f(8),f(4)].map(v=>Math.round(v*255))}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m;let h=0;if(d){h=M===r?((g-b)/d)%6:M===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}const l=(M+m)/2;return [h,d?d/(1-Math.abs(2*l-1)):0,l]}
function dominant(img){
  const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d');x.drawImage(img,0,0,24,24);
  const d=x.getImageData(0,0,24,24).data,bins=Array.from({length:12},()=>({w:0,r:0,g:0,b:0}));
  for(let i=0;i<d.length;i+=4){const [h,s,l]=rgb2hsl(d[i],d[i+1],d[i+2]),w=s*(1-Math.abs(2*l-1))+.02,b=bins[Math.floor(h/30)%12];b.w+=w;b.r+=d[i]*w;b.g+=d[i+1]*w;b.b+=d[i+2]*w}
  const b=bins.reduce((p,q)=>q.w>p.w?q:p),[h,s]=rgb2hsl(b.r/b.w,b.g/b.w,b.b/b.w);
  return hsl2rgb(h,Math.min(Math.max(s,.45),.85),.52);
}
const colorFromUrl=url=>new Promise(r=>{const i=new Image();i.onload=()=>{try{r(dominant(i))}catch(e){r(null)}};i.onerror=()=>r(null);i.src=url});

/* motion helpers (transform and opacity only, skipped for reduced motion) */
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const EASE='cubic-bezier(.22,.8,.24,1)',EASE_OUT='cubic-bezier(.16,1,.3,1)';
const SP=.6; /* global animation speed factor, lower is faster */
const an=(el,kf,o)=>{if(!el||RM.matches||!el.animate)return null;const k=PERF.f.ui?.3:SP;return el.animate(kf,Object.assign({},o,{duration:Math.max(1,Math.round((o.duration||0)*k)),delay:Math.round((o.delay||0)*k)}))};
const pop=el=>an(el,[{transform:'scale(.55)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.9,.3,1.35)'});
const rowOut=async id=>{const r=document.querySelector('#main .row[data-id="'+id+'"]');const a=an(r,[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(36px)'}],{duration:220,easing:EASE,fill:'forwards'});if(a)try{await a.finished}catch(e){}};
function enterAnim(m,dir){
  an(m,[{opacity:0,transform:'translateX('+(dir*20)+'px)'},{opacity:1,transform:'none'}],{duration:260,easing:EASE});
  if(!PERF.f.ui)[...m.querySelectorAll('.row,.card')].slice(0,8).forEach((el,i)=>an(el,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:260,delay:i*20,easing:EASE_OUT,fill:'backwards'}));
}


/* ===== END 01-core.js ===== */


/* ===== BEGIN 02-state.js ===== */
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


/* ===== END 02-state.js ===== */


/* ===== BEGIN 03-effects.js ===== */
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


/* ===== END 03-effects.js ===== */


/* ===== BEGIN 04-storage.js ===== */
/* storage */
function openDB(){return new Promise((res,rej)=>{try{const r=indexedDB.open('tracks-app',4);
  r.onupgradeneeded=()=>{const d=r.result;['songs','albums','folders','playlists','pfolders','lyrics'].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'})})};
  r.onblocked=()=>{try{toast('Close other traXz tabs to finish updating')}catch(_){}};
  r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>{try{d.close()}catch(_){}if(db===d)db=null;try{toast('traXz was updated in another tab. Reload this page.',true)}catch(_){}};d.onclose=()=>{if(db===d)db=null};res(d)};r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
/* a failed write (storage full, evicted, aborted at commit) used to leave callers waiting forever with no message */
let _dbT=0;
function dbFail(e,mode){console.warn('IndexedDB '+mode+' failed',e);if(mode==='readwrite'&&Date.now()-_dbT>8000){_dbT=Date.now();try{toast('Could not save to this device. Storage may be full.')}catch(_){}}}
function tx(st,mode,fn){return new Promise(res=>{if(!db)return res([]);try{const t=db.transaction(st,mode),q=fn(t.objectStore(st));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>res([]);t.onabort=()=>{dbFail(t.error,mode);res([])}}catch(e){dbFail(e,mode);res([])}})}
const put=(st,v)=>{if(v&&typeof v==='object')v.mod=Date.now();cloudDirty();return tx(st,'readwrite',s=>s.put(v))};
const del=(st,id)=>{const t=tomb();t[st+':'+id]=Date.now();LS('tracks-tomb',JSON.stringify(t));cloudDirty();return tx(st,'readwrite',s=>s.delete(id))};

/* google drive sync */
const GCID=''; /* optional: paste your OAuth client ID here instead of in the app */
const GKEY='AIzaSyCeTST7GKZuNgFZjJb3KVpBOqRS8DU5E-Y'; /* needed for share links: a Google API key limited to the Drive API (see Share song > setup). It is public by design, so restrict it to your site addresses */
ICON.cloud='M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z';
const CL={tok:null,exp:0,fid:null,idx:{},busy:false,again:false,tc:null,st:'',t:null};
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
var NP={q:0,on:true,ly:LS('tracks-npl')!=='0',w:Math.min(900,Math.max(280,+LS('tracks-npw')||360)),sig:null,id:null,T:[],I:-1,user:0,raf:0};
const cid=()=>GCID||LS('tracks-cid')||'';
const tomb=()=>{try{return JSON.parse(LS('tracks-tomb')||'{}')}catch(e){return{}}};
const DV='https://www.googleapis.com/drive/v3/files',DU='https://www.googleapis.com/upload/drive/v3/files';
function cloudDirty(){LS('tracks-dirty','1');if(LS('tracks-cloud')){clearTimeout(CL.t);CL.t=setTimeout(()=>cloudSync(false),4000)}}
function cloudSt(m){CL.st=m;const b=$('#cb');if(b)b.style.color=LS('tracks-cloud')?(/^(Sync failed|Tap)/.test(m)?'#e5484d':'rgb(var(--ac))'):'';const e=$('#cst');if(e)e.textContent=m}
const gis=()=>window.google&&google.accounts?Promise.resolve():new Promise((r,j)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=r;s.onerror=()=>j(new Error('Could not load Google sign-in'));document.head.appendChild(s)});
const redir=()=>location.origin+location.pathname.replace(/index\.html$/,'');
function parseTok(){
  const m=/access_token=([^&]+)/.exec(location.hash),e=/expires_in=(\d+)/.exec(location.hash),st=/[#&]state=([^&]+)/.exec(location.hash);
  let want=null;if(m){try{want=sessionStorage.getItem('tracks-gstate');sessionStorage.removeItem('tracks-gstate')}catch(_){}}
  const ok=!!(m&&want&&st&&st[1]===want);/* a token in the address only counts if it answers a sign-in this tab started */
  if(m&&!ok)history.replaceState(null,'',location.pathname+location.search);
  if(ok){CL.tok=m[1];CL.exp=Date.now()+(+(e&&e[1])||3600)*1000;LS('tracks-tok',JSON.stringify({t:CL.tok,e:CL.exp}));LS('tracks-cloud','1');history.replaceState(null,'',location.pathname+location.search)}
  else{try{const j=JSON.parse(LS('tracks-tok')||'null');if(j&&j.e>Date.now()+60000){CL.tok=j.t;CL.exp=j.e}}catch(x){}}
}
async function token(inter){
  if(CL.tok&&Date.now()<CL.exp-60000)return CL.tok;
  if(!cid())throw new Error('Session expired. Paste a new token or add your client ID');
  if(!inter)throw new Error('reconnect');
  const gst=b64u(crypto.getRandomValues(new Uint8Array(18)));try{sessionStorage.setItem('tracks-gstate',gst)}catch(_){throw new Error('Cannot sign in: browser storage is blocked')}
  location.href='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:cid(),redirect_uri:redir(),response_type:'token',scope:'https://www.googleapis.com/auth/drive.file',state:gst});
  return new Promise(()=>{});
}
async function gapi(url,o={}){const t=await token(false);const r=await fetch(url,{...o,headers:{...(o.headers||{}),Authorization:'Bearer '+t}});if(r.status===401){CL.tok=null;LS('tracks-tok',null);throw new Error('Token expired. Paste a new one')}if(!r.ok)throw new Error('Drive '+r.status);return r}
async function dUp(name,blob,type,id){
  type=type||'application/octet-stream';
  const r=await gapi(DU+(id?'/'+id:'')+'?uploadType=resumable&fields=id',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':type},body:JSON.stringify(id?{}:{name,parents:[CL.fid]})});
  const p=await fetch(r.headers.get('Location'),{method:'PUT',headers:{'Content-Type':type},body:blob});
  if(!p.ok)throw new Error('Upload '+p.status);return (await p.json()).id;
}
async function dIdx(){
  CL.fid=CL.fid||LS('tracks-fid');
  if(CL.fid){try{const j=await (await gapi(DV+'/'+CL.fid+'?fields=trashed')).json();if(j.trashed)CL.fid=null}catch(e){CL.fid=null}}
  if(!CL.fid){
    const q=encodeURIComponent("name='Tracks' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const j=await (await gapi(DV+'?q='+q+'&fields=files(id)')).json();
    CL.fid=j.files[0]?j.files[0].id:(await (await gapi(DV,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Tracks',mimeType:'application/vnd.google-apps.folder'})})).json()).id;
    LS('tracks-fid',CL.fid);
  }
  CL.idx={};let pt='';
  do{const q=encodeURIComponent("'"+CL.fid+"' in parents and trashed=false");
    const j=await (await gapi(DV+'?q='+q+'&fields=nextPageToken,files(id,name)&pageSize=1000'+(pt?'&pageToken='+pt:''))).json();
    j.files.forEach(f=>CL.idx[f.name]=f.id);pt=j.nextPageToken||''}while(pt);
}
const strip=s=>{const {blob,orig,...m}=s;return m};
async function cloudSync(inter){
  if(CL.busy){CL.again=true;return}
  CL.busy=true;
  try{
    cloudSt('Syncing…');await token(inter);await dIdx();
    let rem={};
    if(CL.idx['library.json'])rem=await (await gapi(DV+'/'+CL.idx['library.json']+'?alt=media')).json();
    const tb=tomb();for(const k in rem.tomb||{})tb[k]=Math.max(tb[k]||0,rem.tomb[k]);
    LS('tracks-tomb',JSON.stringify(tb));
    const L={songs,albums,folders,playlists,pfolders},nx={};let ch=false;
    for(const st of ['songs','albums','folders','playlists','pfolders']){
      const lm=new Map(L[st].map(o=>[o.id,o])),m=new Map(lm);
      for(const r of (rem[st]||[])){const l=m.get(r.id);if(!l||(r.mod||0)>(l.mod||0))m.set(r.id,l&&l.blob&&(r.fv||0)<=(l.fv||0)?{...r,blob:l.blob,orig:l.orig}:r)}
      const out=[];
      for(const [id,o] of m){
        const t=tb[st+':'+id];
        if(t&&t>=(o.mod||0)){if(lm.has(id)){await tx(st,'readwrite',s=>s.delete(id));ch=true}continue}
        if(lm.get(id)!==o){await tx(st,'readwrite',s=>s.put(o));ch=true}
        out.push(o);
      }
      nx[st]=out;
    }
    songs=nx.songs.sort((a,b)=>a.added-b.added);albums=nx.albums;folders=nx.folders;playlists=nx.playlists;pfolders=nx.pfolders;
    /* manual lyrics: newest edit wins, same as the other stores */
    {const rl=new Map((rem.lyrics||[]).map(r=>[r.id,r])),sid=new Set(songs.map(x=>x.id));
     for(const r of rl.values()){const l=LYM.get(r.id);
       if(sid.has(r.id)&&(!l||!l.m||(r.mod||0)>(l.mod||0))){LYM.set(r.id,r);await tx('lyrics','readwrite',x=>x.put(r));lyBadge(r.id);if(r.id===lyFor)lyPaint(r);ch=true}}
     for(const l of LYM.values()){if(!l.m)continue;const r=rl.get(l.id);if(!r||(l.mod||0)>(r.mod||0))ch=true}}
    {
      let ru=[];try{ru=JSON.parse(LS('tracks-reup')||'[]')}catch(e){}
      for(const s of songs){
        if(!s.blob)continue;const n='a_'+s.id;
        if(!CL.idx[n]){cloudSt('Uploading '+s.name);CL.idx[n]=await dUp(n,s.blob,s.blob.type);ch=true;ru=ru.filter(x=>x!==s.id)}
        else if(ru.includes(s.id)){cloudSt('Uploading '+s.name);await dUp(n,s.blob,s.blob.type,CL.idx[n]);ch=true;ru=ru.filter(x=>x!==s.id);LS('tracks-reup',JSON.stringify(ru))}   /* replaced file: overwrite the copy in Drive */
      }
      LS('tracks-reup',JSON.stringify(ru));
    }
    for(const k in tb)if(k.startsWith('songs:')){const n='a_'+k.slice(6);if(CL.idx[n]){await gapi(DV+'/'+CL.idx[n],{method:'DELETE'});delete CL.idx[n]}}
    if(LS('tracks-dirty')||ch||!CL.idx['library.json']){
      LS('tracks-dirty',null);
      const lib=JSON.stringify({v:1,songs:songs.map(strip),albums,folders,playlists,pfolders,lyrics:[...LYM.values()].filter(x=>x.m),tomb:tb});
      CL.idx['library.json']=await dUp('library.json',new Blob([lib],{type:'application/json'}),'application/json',CL.idx['library.json']);
    }
    LS('tracks-cloud','1');render();
    cloudSt('Synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  }catch(e){cloudSt(inter||CL.tok?'Sync failed: '+e.message:'Tap to reconnect')}
  CL.busy=false;if(CL.again){CL.again=false;setTimeout(()=>cloudSync(false),500)}
}
async function cloudFetch(s,inter=true){
  await token(inter);
  if(!CL.idx['a_'+s.id])await dIdx();
  if(!CL.idx['a_'+s.id])throw new Error('Song not found in Drive');
  s.blob=await (await gapi(DV+'/'+CL.idx['a_'+s.id]+'?alt=media')).blob();
  await tx('songs','readwrite',x=>x.put(s));
}
async function cloudDownloadAll(){
  if(CL.dl)return;CL.dl=true;const set=m=>{const e=$('#cdl');if(e)e.textContent=m};
  try{
    await token(false);await dIdx();
    const todo=songs.filter(s=>!s.blob);let n=0,bad=0;
    for(const s of todo){set('Downloading '+(++n)+' of '+todo.length+'…');try{await cloudFetch(s,false)}catch(e){if(e.message==='reconnect')throw e;bad++}}
    set(bad?'Done, '+bad+' song(s) could not be downloaded':'All songs are saved for offline play');
  }catch(e){set(e.message==='reconnect'?'Session expired. Press Sync now, then try again':'Download stopped: '+e.message)}
  CL.dl=false;
}
function cloudSheet(){
  const on=LS('tracks-cloud'),miss=songs.filter(s=>!s.blob).length;
  openOv(`<h3>Google Drive</h3><p id="cst" style="margin:0 0 12px;color:var(--mute);font-size:14px">${esc(CL.st||(on?'Connected':'Not connected'))}</p>${on?`<p id="cdl" style="margin:0 0 12px;color:var(--mute);font-size:14px">${songs.length-miss} of ${songs.length} songs saved on this device</p>`:''}${GCID?'':`<input type="text" id="cidi" placeholder="Google OAuth client ID" value="${esc(cid())}" style="margin-bottom:12px">`}<div style="margin:0 0 12px"><p style="margin:0 0 8px;color:var(--mute);font-size:13px">Inside a wrapper app Google blocks sign-in. Sign in at your site in a browser, tap Copy token, and paste it here.</p><input type="text" id="ctk" placeholder="Paste access token" style="margin-bottom:8px"><button class="pill" id="cuse">Use token</button></div><div class="bt">${CL.tok&&Date.now()<CL.exp-60000?'<button class="pill" id="cct">Copy token</button>':''}${on?'<button class="pill" id="cx">Disconnect</button>':''}${on&&miss?`<button class="pill" id="cdb">Download all (${miss})</button>`:''}<button class="pill acc" id="cg">${on?'Sync now':'Connect'}</button></div>`);
  $('#cg').onclick=()=>{const i=$('#cidi');if(i)LS('tracks-cid',i.value.trim());cloudSync(true)};
  const d=$('#cdb');if(d)d.onclick=cloudDownloadAll;
  const cc=$('#cct');if(cc)cc.onclick=()=>navigator.clipboard.writeText(CL.tok).then(()=>cloudSt('Token copied, valid for about 1 hour'),()=>cloudSt('Could not copy'));
  $('#cuse').onclick=()=>{const v=$('#ctk').value.trim().replace(/^Bearer\s+/i,'');if(v.length<20)return cloudSt('Paste the token first');CL.tok=v;CL.exp=Date.now()+55*60000;LS('tracks-tok',JSON.stringify({t:v,e:CL.exp}));cloudSync(false)};
  const x=$('#cx');if(x)x.onclick=()=>{LS('tracks-cloud',null);CL.tok=null;closeOv();cloudSt('Not connected')};
}

/* app updates: a new version waits until the person taps Install in Settings > Backup */
var SWU={reg:null,w:null,asked:false,t:0,check:null};
function swuBadge(){const g=document.getElementById('gear');if(g)g.classList.toggle('swu',!!SWU.w)}
function swuReady(w){
  SWU.w=w;swuBadge();
  if(document.getElementById('swu-bar'))return;/* already showing */
  try{
    const b=document.createElement('div');b.id='swu-bar';b.setAttribute('role','alertdialog');b.setAttribute('aria-label','Update available');
    b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;align-items:center;gap:10px;max-width:92%;padding:10px 12px 10px 18px;border-radius:18px;font:600 14px system-ui,sans-serif;background:rgba(24,24,26,.96);color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 10px 40px rgba(0,0,0,.45)';
    const t=document.createElement('span');t.textContent='A new version of traXz is ready';
    const i=document.createElement('button');i.type='button';i.textContent='Install';i.style.cssText='border:0;border-radius:12px;padding:8px 14px;font:700 14px system-ui,sans-serif;background:rgb(var(--ac,255,90,54));color:#fff;cursor:pointer';
    const l=document.createElement('button');l.type='button';l.textContent='Later';l.style.cssText='border:0;background:none;color:#bbb;padding:8px;font:600 14px system-ui,sans-serif;cursor:pointer';
    i.onclick=()=>{b.remove();swuAct()};l.onclick=()=>b.remove();
    b.append(t,i,l);document.body.appendChild(b);
  }catch(_){}
}
/* follows a worker that is installing and announces it once it is waiting */
function swuWatch(n){if(!n||n._swuw)return;n._swuw=1;const f=()=>{if(n.state==='installed'&&navigator.serviceWorker.controller)swuReady(n)};n.addEventListener('statechange',f);f()}
/* No manual stamping: the page hashes its own latest files (fetched past the cache) and registers the worker as sw.js?v=<hash>.
   A new hash = a new worker URL = the browser installs it, and it waits until the person taps Install. */
async function swuHash(){
  const bufs=[];
  for(const u of ['index.html','style.css','splash.js','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','js/01-foundation.js','js/02-media-ui.js','js/03-player-actions.js','js/04-layout-controls.js','js/05-library-tools.js']){
    const r=await fetch(u+'?nosw=1',{cache:'no-cache'});/* revalidates: a 304 costs almost nothing */
    if(!r.ok)throw new Error(u+' '+r.status);
    bufs.push(new Uint8Array(await r.arrayBuffer()));
  }
  const all=new Uint8Array(bufs.reduce((a,b)=>a+b.length,0));let o=0;
  for(const b of bufs){all.set(b,o);o+=b.length}
  const d=new Uint8Array(await crypto.subtle.digest('SHA-1',all));
  return Array.from(d.slice(0,4),x=>x.toString(16).padStart(2,'0')).join('');
}
async function swuRegister(){
  let v='';
  try{v=await swuHash();try{localStorage.setItem('tracks-swv',v)}catch(_){}}
  catch(_){try{v=localStorage.getItem('tracks-swv')||''}catch(__){}}/* offline: keep whatever version we last knew */
  if(!v){if(SWU.reg)return;v='0'}
  const r=await navigator.serviceWorker.register('sw.js?v='+v,{updateViaCache:'none'});
  if(!SWU.reg){
    SWU.reg=r;
    r.addEventListener('updatefound',()=>swuWatch(r.installing));
  }
  swuWatch(r.installing);
  if(r.waiting&&navigator.serviceWorker.controller)swuReady(r.waiting);
}
SWU.check=swuRegister;
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(SWU.asked){SWU.asked=false;location.reload()}});
  addEventListener('load',()=>setTimeout(()=>swuRegister().catch(e=>console.warn('Service worker registration failed',e)),1500));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&SWU.reg&&Date.now()-SWU.t>300000){SWU.t=Date.now();swuRegister().catch(()=>{})}});
}

/* ===== END 04-storage.js ===== */
