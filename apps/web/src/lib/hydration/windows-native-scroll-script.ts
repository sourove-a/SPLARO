/**
 * Boot-time (before React):
 * - Strip stale Lenis / pointer locks (bfcache / HMR dead-click guard)
 * - Force top on hard reload WITHOUT smooth scroll (smooth + scrollTo = white flash)
 * - Tag OS + scroll profile + native scroll engine (no late Lenis mount)
 * - Set data-perf=lite before paint, from device capability
 *
 * NEVER lock overflow here — that freezes the page ("hang") until React mounts.
 *
 * `data-perf` used to be `win || saveData`, so every Windows machine painted in
 * lite mode: no glass, no reveals, no card or hover motion. `DesktopPerfParity`
 * already removes the flag once it confirms the device is not low-power — but
 * that runs in a layout effect, and on a cold first visit hydration lands many
 * seconds after the page is legible. For that whole window a capable Windows
 * desktop rendered flat and inert, which is what "nothing works on Windows"
 * looked like from the outside.
 *
 * The signals below are the ones DesktopPerfParity itself trusts — save-data,
 * reduced-motion, touch/small viewport, and genuinely small memory or core
 * count — so the pre-paint guess now agrees with the post-hydration decision
 * and there is no flip. Scroll engine handling above is deliberately untouched:
 * Windows stays on native scroll, and motion policy is a separate question
 * from scroll policy.
 */
export const WINDOWS_NATIVE_SCROLL_SCRIPT = `(function(){var html=document.documentElement;var body=document.body;html.style.backgroundColor="#ffffff";if(body)body.style.backgroundColor="#ffffff";html.style.scrollBehavior="auto";function hardUnlock(){html.classList.remove("lenis","lenis-smooth","lenis-scrolling","lenis-stopped");html.setAttribute("data-scroll-engine","native");html.removeAttribute("data-lenis-ready");html.removeAttribute("data-scroll-lock");html.style.overflowY="";html.style.height="";html.style.pointerEvents="";if(body){body.style.overflowY="";body.style.height="";body.style.pointerEvents=""}}function softUnlock(){html.classList.remove("lenis-scrolling","lenis-stopped");html.style.overflowY="";html.style.height="";html.style.pointerEvents="";if(body){body.style.overflowY="";body.style.height="";body.style.pointerEvents=""}}hardUnlock();if("scrollRestoration" in history)history.scrollRestoration="manual";try{window.scrollTo({top:0,left:0,behavior:"instant"})}catch(e){window.scrollTo(0,0)}var n=0;var bootGuard=setInterval(function(){if(html.getAttribute("data-splaro-booted")==="1"){clearInterval(bootGuard);html.style.scrollBehavior="";return}softUnlock();n+=1;if(n>=24)clearInterval(bootGuard)},100);var ua=navigator.userAgent||"";var win=/Windows/i.test(ua);var ios=/iPhone|iPad|iPod/i.test(ua);var mac=/Macintosh|Mac OS/i.test(ua)&&!ios;var fine=window.matchMedia("(pointer: fine)").matches;var coarse=window.matchMedia("(pointer: coarse)").matches;var mobileLayout=window.matchMedia("(max-width: 1023px)").matches;if(win)html.setAttribute("data-os","windows");else if(ios)html.setAttribute("data-os","ios");else if(mac)html.setAttribute("data-os","mac");if(coarse||mobileLayout)html.setAttribute("data-scroll-profile","mobile");else if(win)html.setAttribute("data-scroll-profile","windows");else html.setAttribute("data-scroll-profile","mac");if(win)html.setAttribute("data-scroll-hints","thin");var saveData=navigator.connection&&navigator.connection.saveData;var mem=navigator.deviceMemory;var cores=navigator.hardwareConcurrency;var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;var weak=saveData||reduce||(coarse||mobileLayout)||(mem!==undefined&&mem<=2)||(cores!==undefined&&cores<=2);if(weak)html.setAttribute("data-perf","lite");if(fine)html.setAttribute("data-pointer-fine","true")})();`
