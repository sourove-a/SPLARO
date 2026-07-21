/** Runs before React — silent recovery for stale deploys / SW / missing chunks.
 *  Never shows a customer-facing "Site updated" banner (legacy #splaro-boot-fallback is removed).
 *  Never appends ?_splaro= (not indexable; reload uses cache clear + location.reload). */
export const CHUNK_RECOVERY_SCRIPT = `(function(){
  var KEY="splaro_chunk_reload";
  var MAX=2;
  var meta=document.querySelector('meta[name="splaro-build"]');
  var htmlBuild=meta&&meta.getAttribute("content");
  var IS_DEV=htmlBuild==="development";
  var reloading=false;

  function resetCounter(){try{sessionStorage.removeItem(KEY)}catch(e){}}

  /** Drop legacy deploy-recovery banner if stale HTML still injected it. */
  function nukeLegacyBanner(){
    var el=document.getElementById("splaro-boot-fallback");
    if(el)el.remove();
  }
  nukeLegacyBanner();
  if(typeof MutationObserver!=="undefined"){
    try{
      var mo=new MutationObserver(function(){nukeLegacyBanner()});
      mo.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(function(){mo.disconnect()},8000);
    }catch(e){}
  }

  /** Strip ?_splaro from the address bar without a navigation (SEO + share hygiene). */
  function stripSplaroParam(){
    try{
      var u=new URL(location.href);
      if(!u.searchParams.has("_splaro"))return;
      u.searchParams.delete("_splaro");
      var q=u.searchParams.toString();
      history.replaceState(null,"",u.pathname+(q?"?"+q:"")+u.hash);
      resetCounter();
    }catch(e){}
  }
  stripSplaroParam();

  function clearSiteCaches(){
    var tasks=[];
    if("caches" in window){
      tasks.push(caches.keys().then(function(keys){
        return Promise.all(keys.map(function(n){return caches.delete(n)}));
      }).catch(function(){}));
    }
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){
      tasks.push(navigator.serviceWorker.getRegistrations().then(function(regs){
        return Promise.all(regs.map(function(r){return r.unregister()}));
      }).catch(function(){}));
    }
    return Promise.all(tasks);
  }

  function reloadOnce(){
    if(IS_DEV||reloading)return;
    try{
      var n=parseInt(sessionStorage.getItem(KEY)||"0",10)||0;
      if(n>=MAX)return;
      sessionStorage.setItem(KEY,String(n+1));
    }catch(e){return}
    reloading=true;
    clearSiteCaches().finally(function(){
      try{location.reload()}catch(e){location.href=location.pathname+location.search+location.hash}
    });
  }

  function isChunkMsg(m){return/loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(m||"")}
  function isChunkUrl(u){return/\\/_next\\/static\\//.test(u||"")}

  window.addEventListener("error",function(e){
    if(IS_DEV)return;
    var t=e.target;
    if(t&&(t.tagName==="SCRIPT"||t.tagName==="LINK")&&isChunkUrl(t.src||t.href||""))reloadOnce();
    if(isChunkMsg(e.message))reloadOnce();
  },true);

  window.addEventListener("unhandledrejection",function(e){
    if(IS_DEV)return;
    var r=e.reason;
    var m=r&&r.message?r.message:String(r||"");
    if(isChunkMsg(m))reloadOnce();
  });

  window.__splaroBootOk=function(){resetCounter();nukeLegacyBanner()};

  function checkBuildId(){
    if(IS_DEV||!htmlBuild||htmlBuild==="production")return;
    fetch("/api/build-id",{cache:"no-store",credentials:"same-origin"})
      .then(function(r){return r.json()})
      .then(function(d){
        if(!d||!d.buildId)return;
        if(d.buildId==="production"||d.buildId==="development")return;
        if(htmlBuild!==d.buildId)reloadOnce();
      })
      .catch(function(){});
  }
  checkBuildId();
})();
`
