// Flags suspicious emails inline. Uses whichever registered adapter matches the page,
// sends plain data (no DOM) to the service worker for analysis, then renders the results.
(() => {
  const WG = globalThis.WaveGuard;
  if (!WG?.ui || window.top !== window) return;
  const adapter = WG.adapters.find((a) => {
    try { return a.matches(document); } catch { return false; }
  });
  if (!adapter) return;

  const scanned = new WeakSet(); // message elements already analyzed (lives with this page)

  async function scan() {
    const messages = adapter.extract().filter((m) => !scanned.has(m.root));
    if (!messages.length) return;
    messages.forEach((m) => scanned.add(m.root));
    const emails = messages.map((m) => ({
      id: m.id, senderName: m.senderName, senderEmail: m.senderEmail,
      links: m.links.map((l) => ({ text: l.text, href: l.href })),
    }));
    let results;
    try {
      results = await WG.ui.send('analyzeInbox', { emails });
    } catch (err) {
      console.warn('[WaveGuard] inbox analysis failed:', err);
      messages.forEach((m) => scanned.delete(m.root)); // retry on the next change
      return;
    }
    results.forEach((analysis, i) => render(messages[i], analysis));
  }

  function render(msg, analysis) {
    if (analysis.verdict === 'safe') {
      if (analysis.verifiedSender && adapter.insertVerified) {
        const who = [analysis.verifiedSender.name, analysis.verifiedSender.title].filter(Boolean).join(', ');
        adapter.insertVerified(msg, WG.ui.chip('✓ Verified Pepperdine sender', 'safe', `Matches the campus directory: ${who}`));
      }
      return;
    }

    adapter.insertChip?.(msg, WG.ui.chip(analysis.verdict === 'danger' ? '⚠ Phishing risk' : '⚠ Be careful', analysis.verdict));

    const banner = WG.ui.banner({
      verdict: analysis.verdict,
      title: analysis.title,
      reasons: analysis.findings.map((f) => f.reason),
      note: analysis.verdict === 'danger' ? "Don't reply, click links or send money until you've checked another way." : '',
      actions: [{ label: 'Report this email', primary: true, onClick: (ui) => report(msg, analysis, ui) }],
    });
    adapter.insertBanner(msg, banner.host);

    // Mark risky links and show where they really go on hover.
    for (const flagged of analysis.flaggedLinks) {
      const link = msg.links[flagged.index]?.el;
      if (!link) continue;
      link.title = `WaveGuard: this link really goes to ${flagged.realHost}`;
      link.style.outline = '2px dashed #c62828';
      link.style.outlineOffset = '2px';
    }
  }

  async function report(msg, analysis, ui) {
    const flagged = analysis.flaggedLinks[0];
    const url = flagged ? msg.links[flagged.index].href : (msg.links[0]?.href ?? null);
    ui.setStatus('Sending report…');
    try {
      await WG.ui.send('report', {
        report: {
          url,
          sender_email: msg.senderEmail || null,
          sender_display_name: msg.senderName || null,
          excerpt: msg.excerpt,
          reason: `Reported from the inbox: ${analysis.findings[0]?.reason ?? 'suspicious email'}`.slice(0, 500),
        },
      });
      ui.setStatus('Reported. Everyone at Pepperdine using WaveGuard will now be warned.');
    } catch (err) {
      ui.setStatus(`Report failed: ${err.message}`, true);
    }
  }

  scan();
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();
