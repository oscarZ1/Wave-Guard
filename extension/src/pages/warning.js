import { canonicalizeUrl, hostnameOf } from '../lib/normalize.js';
import { decodeHost } from '../lib/homoglyphs.js';
import { send } from '../shared/send.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const target = canonicalizeUrl(params.get('url')) ? params.get('url') : null;
const back = params.get('back');
const safeBack = back && canonicalizeUrl(back) && canonicalizeUrl(back) !== canonicalizeUrl(target) ? back : null;
const site = target ? decodeHost(hostnameOf(target)) : 'this site';

function render(status, reportCount = 0) {
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
