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

