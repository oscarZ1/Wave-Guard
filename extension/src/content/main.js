// WaveGuard content script. Classic script (no imports): all network calls and
// heuristics go through the service worker via chrome.runtime.sendMessage.
(() => {
  if (window.top !== window) return;
  // Safety net: re-check the page once it has loaded, in case the navigation
  // check was skipped (for example, a page Chrome prerendered).
  chrome.runtime.sendMessage({ type: 'pageLoaded', url: location.href, referrer: document.referrer }).catch(() => {});
})();
