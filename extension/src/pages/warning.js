import { canonicalizeUrl, hostnameOf } from '../lib/normalize.js';
import { decodeHost } from '../lib/homoglyphs.js';
import { send } from '../shared/send.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const target = canonicalizeUrl(params.get('url')) ? params.get('url') : null;
const back = params.get('back');
const safeBack = back && canonicalizeUrl(back) && canonicalizeUrl(back) !== canonicalizeUrl(target) ? back : null;
const site = target ? decodeHost(hostnameOf(target)) : 'this site';
let current = { status: 'warn', reportCount: 0 }; // page state, for the "Why?" request

function render(status, reportCount = 0) {
  current = { status, reportCount };
  document.body.dataset.status = status;
  $('site').textContent = site;
  if (status === 'block') {
    $('badge').textContent = '⛔ Blocked';
    $('title').textContent = 'Blocked: confirmed phishing';
    $('message').textContent = `Pepperdine IT confirmed that ${site} is a phishing site built to steal logins. WaveGuard blocked it to protect you.`;
    $('continue').textContent = 'Ignore the warning and continue (not recommended)';
  } else {
    const who = reportCount > 1 ? `${reportCount} Pepperdine users` : 'a Pepperdine user';
    $('badge').textContent = '⚠️ Warning';
    $('title').textContent = `Reported as phishing by ${who}`;
    $('message').textContent = `Someone at Pepperdine reported ${site} as a phishing site. IT hasn't reviewed it yet, so be careful.`;
    $('continue').textContent = 'Continue anyway';
  }
}

$('back').addEventListener('click', async () => {
  if (safeBack) return location.replace(safeBack);
  const tab = await chrome.tabs.getCurrent();
  chrome.tabs.update(tab.id, { url: 'chrome://newtab/' });
});

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderExplanation(ex) {
  const box = $('explain');
  const fromClaude = ex.source === 'claude';
  box.replaceChildren(el('p', ex.summary));
  if (ex.red_flags?.length) {
    const list = el('ul');
    for (const flag of ex.red_flags) {
      const li = el('li');
      li.append(el('strong', flag.text), document.createTextNode(flag.why ? ` ${flag.why}` : ''));
      list.append(li);
    }
    box.append(list);
  }
  const todo = el('p');
  todo.append(el('strong', 'What to do: '), document.createTextNode(ex.what_to_do));
  box.append(todo, el('p', fromClaude ? "Explained by Claude from WaveGuard's checks." : "From WaveGuard's checks (AI explanation unavailable right now).", 'source'));
  box.hidden = false;
}

// Sends only the site's host, its report status and local warning signs (never the full address).
$('why').addEventListener('click', async () => {
  if (!target) return;
  $('why').disabled = true;
  $('why').textContent = 'Explaining…';
  try {
    const page = await send('checkPage', { url: target }).catch(() => null);
    const who = current.reportCount > 1 ? `${current.reportCount} Pepperdine users` : 'a Pepperdine user';
    const signals = [
      { reason: current.status === 'block' ? 'Pepperdine IT confirmed this site is phishing.' : `Reported as phishing by ${who}. IT has not reviewed it yet.`, severity: 'high' },
      ...(page?.findings ?? []).map((f) => ({ reason: f.reason, severity: f.severity })),
    ];
    renderExplanation(await send('explain', {
      request: { kind: 'website', site: new URL(target).host, status: current.status, report_count: current.reportCount, signals },
    }));
    $('why').hidden = true;
  } catch (err) {
    $('why').disabled = false;
    $('why').textContent = `Couldn't explain (${err.message}). Try again`;
  }
});

$('continue').addEventListener('click', async () => {
  if (!target) return;
  $('continue').disabled = true;
  try {
    await send('allowOnce', { url: target }); // wait, so the next check sees the allowance
    location.replace(target);
  } catch {
    $('continue').disabled = false;
  }
});

// Params give the first paint; then ask for the live status so an IT confirm or
// dismiss shows up on reload.
render(params.get('status') === 'block' ? 'block' : 'warn');
if (!target) {
  $('message').textContent = 'WaveGuard could not read the address of this page.';
  $('continue').hidden = true;
} else {
  send('checkUrl', { url: target })
    .then((live) => {
      if (live.status === 'clean') return location.replace(target); // IT dismissed it
      if (live.status === 'warn' || live.status === 'block') render(live.status, live.reportCount);
    })
    .catch(() => {});
}
