// WaveGuard service worker (MV3).
// Rules: register every listener synchronously at top level, and keep no state in
// module variables. The worker is killed when idle; persist to chrome.storage.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[WaveGuard] installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ping') {
    sendResponse({ ok: true });
  }
  return false;
});
