/**
 * Runs before React on Windows — strips stale Lenis classes from cached HTML
 * and restores native scroll (fixes "dead site" after deploy on Win Chrome/Brave).
 */
export const WINDOWS_NATIVE_SCROLL_SCRIPT = `(function(){var ua=navigator.userAgent||"";if(!/Windows/i.test(ua))return;var html=document.documentElement;var body=document.body;html.classList.remove("lenis","lenis-smooth","lenis-scrolling","lenis-stopped");html.style.overflowY="auto";html.style.height="auto";if(body){body.style.overflowY="auto";body.style.height="auto";body.style.pointerEvents="auto"}window.__splaroNativeScroll=true;try{sessionStorage.removeItem("splaro_chunk_reload")}catch(e){}})();`
