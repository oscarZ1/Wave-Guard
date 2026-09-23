// WaveGuard side panel (opens from the toolbar icon and stays open while you browse).
import { API_BASE } from '../background/config.js';
import { send } from '../shared/send.js';
import { hostnameOf } from '../lib/normalize.js';
import { decodeHost } from '../lib/homoglyphs.js';

const $ = (id) => document.getElementById(id);
const WARNING_PAGE = chrome.runtime.getURL('src/pages/warning.html');

const STATUS_TEXT = {
  clean: 'No reports from Pepperdine users',
  warn: 'Reported as phishing by a Pepperdine user',
  block: 'Blocked by Pepperdine IT',
  unknown: "Can't reach the campus server",
};

// Page state for this panel only (the service worker itself stays stateless).
let target = null;
let refreshSeq = 0;

// The page to report: the active tab, or the flagged site behind a warning page.
async function currentTarget() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  if (url.startsWith(WARNING_PAGE)) return new URL(url).searchParams.get('url');
  return /^https?:\/\//.test(url) ? url : null;
}

async function showStatus(url, seq) {
  const pill = $('site-status');
  let status = 'unknown';
  try {
    ({ status } = await send('checkUrl', { url }));
  } catch { /* shown as unknown */ }
  if (seq !== refreshSeq) return; // the user already moved to another tab
  pill.textContent = STATUS_TEXT[status] ?? STATUS_TEXT.unknown;
  pill.className = `pill ${status in STATUS_TEXT ? status : ''}`;
}

async function refreshSite() {
  const seq = ++refreshSeq;
  const next = await currentTarget();
  if (seq !== refreshSeq) return;
  if (next !== target) {
    $('report-result').textContent = '';
    $('report-result').className = 'result';
  }
  target = next;

  const host = target ? decodeHost(hostnameOf(target)) : null;
  $('site-host').textContent = host ?? 'This page';
  $('report').disabled = !target;
  $('report').textContent = target ? `Report ${host} as phishing` : 'Report this page as phishing';
  if (target) {
    $('site-status').textContent = 'Checking…';
    $('site-status').className = 'pill';
    showStatus(target, seq);
  } else {
    $('site-status').textContent = 'WaveGuard only checks websites';
    $('site-status').className = 'pill';
  }
}

$('report').addEventListener('click', async () => {
  const reported = target;
  if (!reported) return;
  const result = $('report-result');
  $('report').disabled = true;
  result.className = 'result';
  result.textContent = 'Sending report…';
  try {
    await send('report', { report: { url: reported, reason: 'Reported from the WaveGuard panel' } });
    result.className = 'result ok';
    result.textContent = 'Thanks! Everyone at Pepperdine using WaveGuard will now be warned about this site.';
    showStatus(reported, refreshSeq);
  } catch (err) {
    result.className = 'result error';
    result.textContent = `Report failed: ${err.message}`;
  } finally {
    $('report').disabled = !target;
  }
});

$('reporter-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const saved = await send('setReporter', { reporterId: $('reporter').value });
    $('reporter-label').textContent = saved.reporterId;
  } catch (err) {
    $('reporter-label').textContent = err.message;
  }
});

async function init() {
  const { id: windowId } = await chrome.windows.getCurrent();
  // Follow the active tab in this window as the user browses.
  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) refreshSite();
  });
  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (tab.active && tab.windowId === windowId && (change.url || change.status === 'complete')) refreshSite();
  });
  refreshSite();

  try {
    const { reporterId } = await send('getReporter');
    $('reporter-label').textContent = reporterId;
    $('reporter').value = reporterId;
  } catch {
    // The panel loads fresh from disk, but Chrome keeps running the old background
    // worker until the extension is reloaded, so an out-of-date worker can't answer.
    $('stale').hidden = false;
  }

  try {
    const health = await (await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) })).json();
    $('server').textContent = health.ok ? 'Connected to the campus server.' : `Server error: ${health.error}`;
  } catch {
    $('server').textContent = `Campus server unreachable at ${API_BASE}.`;
  }
}

init();
