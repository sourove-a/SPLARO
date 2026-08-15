/** Runs before React — strip legacy query, drop old banners. Never auto-reloads. */
export const CHUNK_RECOVERY_SCRIPT = `(function(){
  function nukeLegacyBanner(){
    var el=document.getElementById("splaro-boot-fallback");
    if(el)el.remove();
  }
  nukeLegacyBanner();
  try{
    var u=new URL(location.href);
    if(u.searchParams.has("_splaro")){
      u.searchParams.delete("_splaro");
      var q=u.searchParams.toString();
      history.replaceState(null,"",u.pathname+(q?"?"+q:"")+u.hash);
    }
  }catch(e){}
  window.__splaroBootOk=function(){nukeLegacyBanner()};
})();
`
