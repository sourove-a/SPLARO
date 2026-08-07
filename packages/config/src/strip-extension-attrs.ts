/**
 * Inline script run before React hydration.
 * Browser extensions inject attrs/DOM into forms (e.g. Shark wallet `data-sharkid`),
 * which causes server/client HTML mismatches. Strip those immediately.
 *
 * Do NOT strip `data-1p-ignore` / `data-lpignore` — those are intentional markers we
 * set on nav/search fields so password managers do not dump the admin email into
 * "Filter menu…" when API-key password fields are nearby (AI Command Brain).
 */
export const STRIP_EXTENSION_ATTRS_SCRIPT = `(function(){var attrs=["data-sharkid","data-sharklabel","data-bwignore","data-dashlane-rid","data-dashlane-classification","data-kwimpalastatus","data-kwimpalaid","fdprocessedid","bis_register","bis_skin_checked"];var tags=["shark-icon-container"];function strip(){attrs.forEach(function(name){document.querySelectorAll("["+name+"]").forEach(function(node){node.removeAttribute(name)})});tags.forEach(function(tag){document.querySelectorAll(tag).forEach(function(node){node.remove()})})}strip();if(typeof MutationObserver!=="undefined"){var observer=new MutationObserver(strip);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:attrs});window.addEventListener("load",function(){window.setTimeout(function(){observer.disconnect()},8000)})}})();`
