/* traX launch splash: the logo writes itself fast, then fades into the app */
(function(){
  var sp=document.getElementById('tsp');if(!sp)return;
  var T=0.50,ready=false,wrote=false,gone=false,rm=false;
  try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  function go(){if(gone)return;gone=true;sp.classList.add('go');setTimeout(function(){var d=document.getElementById('tspcss');sp.remove();if(d)d.remove()},350)}
  function tryGo(){if(ready&&wrote)go()}
  window.splashReady=function(){ready=true;tryGo()};
  function start(){
    if(rm){sp.classList.add('rm');wrote=true;setTimeout(tryGo,200);return}
    sp.classList.add('run');
    setTimeout(function(){wrote=true;tryGo()},T*1000+60);
  }
  requestAnimationFrame(function(){requestAnimationFrame(start)});
  setTimeout(function(){ready=true;wrote=true;go()},9000);
})();
