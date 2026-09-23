// Runs on every page. Classic script: all network calls and heuristics go through
// the service worker, and UI helpers come from banner.js.
(() => {
  if (window.top !== window) return;
  const WG = globalThis.WaveGuard;

  // Safety net: re-check the page once it has loaded, in case the navigation
  // check was skipped (for example, a page Chrome prerendered).
  chrome.runtime.sendMessage({ type: 'pageLoaded', url: location.href, referrer: document.referrer }).catch(() => {});

  // Local heuristics (nothing leaves the browser): does this page misuse the Pepperdine
  // name or imitate a campus domain?
  WG?.ui?.send('checkPage', { url: location.href }).then((page) => {
    if (!page || page.verdict === 'safe') return;
    const banner = WG.ui.banner({
      verdict: page.verdict,
      title: 'This is not an official Pepperdine website',
      reasons: page.findings.map((f) => f.reason),
      note: "Don't enter your Pepperdine password or personal information on this page.",
      dismissible: true,
      actions: [{
        label: 'Report this site',
        primary: true,
        onClick: async (ui) => {
          ui.setStatus('Sending report…');
          try {
            await WG.ui.send('report', { report: { url: location.href, reason: `Reported from a page warning: ${page.findings[0].reason}`.slice(0, 500) } });
            ui.setStatus('Reported. Thank you!');
          } catch (err) {
            ui.setStatus(`Report failed: ${err.message}`, true);
          }
        },
      }, WG.ui.explainAction(() => ({
        kind: 'website',
        site: location.host,
        signals: page.findings.map((f) => ({ reason: f.reason, severity: f.severity })),
      }))],
    });
    Object.assign(banner.host.style, {
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
      width: 'min(680px, calc(100vw - 24px))', zIndex: '2147483647',
      boxShadow: '0 12px 32px rgba(0, 0, 0, .18)', borderRadius: '10px',
    });
    document.documentElement.append(banner.host);
  }).catch(() => {});
})();
