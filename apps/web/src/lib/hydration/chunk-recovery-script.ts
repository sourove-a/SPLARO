/** Runs before React — auto-reloads when stale deploy HTML references missing webpack chunks.
 *  No customer-facing banner (never show "Site updated" / Refresh on production). */
export const CHUNK_RECOVERY_SCRIPT = `(function(){
  var KEY="splaro_chunk_reload";
  var MAX=3;
  var meta=document.querySelector('meta[name="splaro-build"]');
  var htmlBuild=meta&&meta.getAttribute("content");
  var IS_DEV=htmlBuild==="development";
  function resetCounter(){try{sessionStorage.removeItem(KEY)}catch(e){}}
  function reloadOnce(){
    if(IS_DEV)return;
    try{
      var n=parseInt(sessionStorage.getItem(KEY)||"0",10)||0;
      if(n>=MAX)return;
      sessionStorage.setItem(KEY,String(n+1));
    }catch(e){return}
    var u=new URL(location.href);
    u.searchParams.set("_splaro",Date.now().toString(36));
    function go(){location.replace(u.toString())}
    if("caches" in window){
      caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})}).finally(go);
    }else go();
  }
  function isChunkMsg(m){return/loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(m||"")}
  function isChunkUrl(u){return/\\/_next\\/static\\//.test(u||"")}
  if(new URL(location.href).searchParams.has("_splaro"))resetCounter();
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
  window.__splaroBootOk=function(){resetCounter()};
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
