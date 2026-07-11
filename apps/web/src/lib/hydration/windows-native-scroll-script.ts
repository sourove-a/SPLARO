/**
 * Boot-time: strip stale Lenis locks + mark desktop/mouse scroll hints for thin scrollbars.
 */
export const WINDOWS_NATIVE_SCROLL_SCRIPT = `(function(){var html=document.documentElement;var body=document.body;function unlock(){html.classList.remove("lenis","lenis-smooth","lenis-scrolling","lenis-stopped");html.style.overflowY="";html.style.height="";if(body){body.style.overflowY="";body.style.height="";body.style.pointerEvents=""}}unlock();var fine=window.matchMedia("(pointer: fine)").matches;if(/Windows/i.test(navigator.userAgent)){html.setAttribute("data-scroll-hints","thin")}if(fine){html.setAttribute("data-pointer-fine","true")}})();`
