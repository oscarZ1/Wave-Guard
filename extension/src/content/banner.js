// Shared UI for WaveGuard content scripts. All content scripts of an extension share
// one isolated world, so this file defines helpers on globalThis.WaveGuard for the rest.
// Everything renders inside a Shadow DOM so page CSS can't break it, and all text is
// set with textContent (email and page content is attacker-controlled).
(() => {
  const WG = (globalThis.WaveGuard ??= { adapters: [] });
  if (WG.ui) return;

  const STYLE = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; }
    .wg { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b1f29;
      border-radius: 10px; border: 1px solid; border-left-width: 5px; padding: 12px 14px; margin: 0 0 14px; background: #fff; }
    .wg.danger { background: #fdecec; border-color: #f3b5b5; border-left-color: #c62828; }
    .wg.caution { background: #fff6dd; border-color: #f0d98a; border-left-color: #d99a00; }
    .head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
    .danger .head { color: #a01414; }
    .caution .head { color: #7a5200; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      background: #00205b; color: #fff; border-radius: 4px; padding: 2px 6px; }
    ul { margin: 8px 0 0; padding-left: 20px; }
    li { margin: 3px 0; }
    .note { margin: 8px 0 0; color: #3a4252; }
    .actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
    button { font: inherit; font-size: 13px; cursor: pointer; border-radius: 7px; padding: 6px 12px;
      border: 1px solid #c9ced8; background: #fff; color: #1b1f29; }
    button.primary { background: #00205b; border-color: #00205b; color: #fff; font-weight: 600; }
    button:disabled { opacity: .6; cursor: default; }
    .status { font-size: 13px; color: #1a7f37; font-weight: 600; }
    .status.error { color: #b42318; }
    .close { margin-left: auto; border: 0; background: transparent; font-size: 18px; line-height: 1; padding: 2px 6px; color: #6b7280; }
    .chip { display: inline-flex; align-items: center; gap: 4px; font: 600 12px/1.6 system-ui, -apple-system, sans-serif;
      border-radius: 999px; padding: 0 9px; white-space: nowrap; }
    .chip.danger { background: #fde0e0; color: #a01414; }
    .chip.caution { background: #fff1c2; color: #7a5200; }
    .chip.safe { background: #e7f6ec; color: #1a7f37; }
  `;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'className') node.className = value;
      else node.setAttribute(key, value);
    }
    node.append(...children.filter(Boolean));
    return node;
  }

  function shadowHost(inline = false) {
    const host = document.createElement(inline ? 'span' : 'div');
    host.setAttribute('data-waveguard', '');
    const root = host.attachShadow({ mode: 'open' });
    root.append(el('style', { text: STYLE }));
    return { host, root };
  }

  // opts: { verdict: 'danger'|'caution', title, reasons: [], note?, actions?: [{ label, primary?, onClick(ui) }], dismissible? }
  // → { host, setStatus(text, isError?) }
  function banner(opts) {
    const { host, root } = shadowHost();
    const status = el('span', { className: 'status', role: 'status' });
    const ui = {
      host,
      setStatus(text, isError = false) {
        status.textContent = text;
        status.className = isError ? 'status error' : 'status';
      },
    };
    const head = el('div', { className: 'head' }, [
      el('span', { className: 'brand', text: 'WaveGuard' }),
      el('span', { text: `${opts.verdict === 'danger' ? '⚠️' : '⚠'} ${opts.title}` }),
      opts.dismissible ? el('button', { className: 'close', 'aria-label': 'Dismiss', text: '×' }) : null,
    ]);
    head.querySelector('.close')?.addEventListener('click', () => host.remove());
    const buttons = (opts.actions ?? []).map((action) => {
      const b = el('button', { className: action.primary ? 'primary' : '', text: action.label });
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await action.onClick(ui); } finally { b.disabled = false; }
      });
      return b;
    });
    root.append(el('div', { className: `wg ${opts.verdict}`, role: 'alert' }, [
      head,
      opts.reasons?.length ? el('ul', {}, opts.reasons.map((r) => el('li', { text: r }))) : null,
      opts.note ? el('p', { className: 'note', text: opts.note }) : null,
      buttons.length || opts.actions ? el('div', { className: 'actions' }, [...buttons, status]) : null,
    ]));
    return ui;
  }

  // Small inline pill, e.g. in an inbox list row. verdict: 'danger' | 'caution' | 'safe'
  function chip(text, verdict, tooltip) {
    const { host, root } = shadowHost(true);
    host.style.display = 'inline-block';
    host.style.marginLeft = '6px';
    root.append(el('span', { className: `chip ${verdict}`, text, ...(tooltip ? { title: tooltip } : {}) }));
    return host;
  }

  // Ask the service worker; resolves to the result or throws with its error message.
  async function send(type, payload = {}) {
    const reply = await chrome.runtime.sendMessage({ type, ...payload });
    if (!reply?.ok) throw new Error(reply?.error ?? 'WaveGuard did not respond');
    return reply.result;
  }

  WG.ui = { banner, chip, send };
})();
