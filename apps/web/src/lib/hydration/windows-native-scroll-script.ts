/**
 * Runs before React — strips Lenis classes (stale cached HTML) and restores native scroll.
 * Windows gets extra watchdog; all platforms benefit from overflow unlock.
 */
export const WINDOWS_NATIVE_SCROLL_SCRIPT = `(function(){var html=document.documentElement;var body=document.body;var isWin=/Windows/i.test(navigator.userAgent||"");function unlock(){html.classList.remove("lenis","lenis-smooth","lenis-scrolling","lenis-stopped");html.style.overflowY="auto";html.style.height="auto";if(body){body.style.overflowY="auto";body.style.height="auto";body.style.pointerEvents="auto"}}unlock();if(isWin){window.__splaroNativeScroll=true;try{sessionStorage.removeItem("splaro_chunk_reload")}catch(e){}var n=0;var t=setInterval(function(){unlock();if(++n>30)clearInterval(t)},500)}})();`
