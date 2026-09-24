// Link hover tooltip: where a link really goes, why it's risky, and how old its domain is.
// Inside an email (a matching inbox adapter) it shows for every link; elsewhere only for
// risky links, so normal browsing stays quiet. Classic script; UI in a Shadow DOM.
(() => {
  const WG = globalThis.WaveGuard;
  if (!WG?.ui || window.top !== window) return;

  const inEmail = WG.adapters.some((a) => {
    try { return a.matches(document); } catch { return false; }
  });
  const SHOW_DELAY_MS = 300;

  // Page-lifetime caches (this is the page's content script, not the service worker).
  const infoCache = new Map(); // "text\nhref" → Promise<link info>
  const ageCache = new Map();  // hostname → Promise<domain info>
  let active = null;
  let timer = null;
  let tip = null;

  const STYLE = `
    :host { all: initial; }
    .tip { position: fixed; z-index: 2147483647; pointer-events: none; max-width: 360px; box-sizing: border-box;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b1f29; background: #fff;
      border: 1px solid #d5d9e2; border-left: 5px solid #1a7f37; border-radius: 10px; padding: 10px 12px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, .18); }
    .tip.danger { border-left-color: #c62828; }
    .tip.caution { border-left-color: #d99a00; }
    .top { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; color: #5f6878; text-transform: uppercase; }
    .brand { background: #00205b; color: #fff; border-radius: 4px; padding: 1px 5px; letter-spacing: .06em; }
    .host { font: 600 14px ui-monospace, SFMono-Regular, Menlo, monospace; margin: 4px 0 6px; overflow-wrap: anywhere; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 3px 0; }
    .ok { color: #1a7f37; font-weight: 600; }
    .age { margin-top: 6px; color: #3a4252; }
    .age.warn { color: #a01414; font-weight: 600; }
  `;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function ensureTip() {
    if (tip) return tip;
    const host = document.createElement('div');
    host.setAttribute('data-waveguard', 'tooltip');
    const root = host.attachShadow({ mode: 'open' });
    const box = el('div', 'tip');
    box.setAttribute('role', 'tooltip');
    box.hidden = true;
    root.append(el('style', null, STYLE), box);
    document.documentElement.append(host);
    tip = { host, box };
    return tip;
  }

  function ageLine(age) {
    switch (age?.status) {
      case 'ok': {
        const d = age.age_days;
        const when = d < 1 ? 'today'
          : d < 60 ? `${d} day${d === 1 ? '' : 's'} ago`
          : d < 730 ? `${Math.round(d / 30)} months ago`
          : `in ${new Date(age.registered).getFullYear()} (${Math.floor(d / 365)} years ago)`;
        return d < 30
          ? { text: `Registered ${when}. Brand-new sites are a common phishing sign.`, warn: true }
          : { text: `Registered ${when}.` };
      }
      case 'hosted': return { text: `Hosted on ${age.platform}, a free service anyone can publish on.`, warn: true };
      case 'local': return { text: 'Not a public web address, so it has no registration record.' };
      case 'unknown': return { text: "This address's registration date isn't published." };
      case 'skipped': return null;
      default: return { text: 'Registration date unavailable right now.' };
    }
  }

  function render(info, link, age) {
    const { box } = ensureTip();
    const children = [
      el('div', 'top', null),
      el('div', 'host', info.host),
    ];
    children[0].append(el('span', 'brand', 'WaveGuard'), el('span', null, 'This link goes to'));
    if (info.findings.length) {
      const list = el('ul');
      for (const f of info.findings) list.append(el('li', null, f.reason));
      children.push(list);
    } else {
      children.push(el('div', 'ok', info.official ? '✓ Official Pepperdine website' : '✓ No warning signs found'));
    }
    if (info.verdict !== 'safe') {
      const line = age === undefined ? { text: 'Checking when this site was registered…' } : ageLine(age);
      if (line) children.push(el('div', line.warn ? 'age warn' : 'age', line.text));
    }
    box.className = `tip ${info.verdict}`;
    box.replaceChildren(...children);
    box.hidden = false;
    position(box, link);
  }

  // Below the link, flipped above if there's no room; kept inside the viewport.
  function position(box, link) {
    const r = link.getBoundingClientRect();
    const { width, height } = box.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = r.bottom + 8;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 8) : below;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function hide() {
    clearTimeout(timer);
    active = null;
    if (tip) tip.box.hidden = true;
  }

  async function show(link) {
    const text = link.textContent.trim().slice(0, 300);
    const href = link.href;
    const key = `${text}\n${href}`;
    if (!infoCache.has(key)) infoCache.set(key, WG.ui.send('linkInfo', { text, href }).catch(() => null));
    const info = await infoCache.get(key);
    if (active !== link || !info) return;
    if (!inEmail && info.verdict === 'safe') return; // stay quiet on everyday links

    render(info, link, info.verdict === 'safe' ? null : undefined);
    if (info.verdict === 'safe') return;
    const hostKey = new URL(href).hostname;
    if (!ageCache.has(hostKey)) ageCache.set(hostKey, WG.ui.send('domainAge', { text, href }).catch(() => ({ status: 'unavailable' })));
    const age = await ageCache.get(hostKey);
    if (active === link) render(info, link, age);
  }

  function linkFrom(target) {
    const link = target instanceof Element ? target.closest('a[href]') : null;
    return link && /^https?:/i.test(link.href) ? link : null;
  }

  function schedule(link, delay) {
    clearTimeout(timer);
    active = link;
    timer = setTimeout(() => show(link), delay);
  }

  document.addEventListener('mouseover', (e) => {
    const link = linkFrom(e.target);
    if (link && link !== active) schedule(link, SHOW_DELAY_MS);
  }, true);
  document.addEventListener('mouseout', (e) => {
    const link = linkFrom(e.target);
    if (link && link === active && !link.contains(e.relatedTarget)) hide();
  }, true);
  document.addEventListener('focusin', (e) => {
    const link = linkFrom(e.target);
    if (link) schedule(link, 0);
  }, true);
  document.addEventListener('focusout', (e) => {
    if (linkFrom(e.target) === active) hide();
  }, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
})();
