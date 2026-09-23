// WaveGuard service worker (MV3).
// Rules: every listener is registered synchronously at top level, and nothing is
// kept in module variables. The worker is killed when idle, so state goes in chrome.storage.
import { checkUrl, warningPageUrl } from './navigation.js';
import { submitReport } from './report.js';
import { analyzeInbox, checkPage } from './analyze.js';
import { api, postEvent } from './api.js';
import {
  allowOnce, clearAllow, getReporterId, isAllowed, refreshKnownDomains, setReporterId,
} from './storage.js';
import { canonicalizeUrl } from '../lib/normalize.js';
import { hashesForUrl } from '../lib/hash.js';

const isWebUrl = (url) => /^https?:\/\//i.test(url ?? '');
const isExtensionPage = (sender) => sender.url?.startsWith(chrome.runtime.getURL(''));

// ---------- Install / startup ----------
// Clicking the toolbar icon opens the side panel, which (unlike a popup) stays
// open while you browse. Idempotent, so it is safe on every worker start.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => console.warn('[WaveGuard] side panel:', err));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'report-link', title: 'Report this link as phishing', contexts: ['link'],
      targetUrlPatterns: ['http://*/*', 'https://*/*'],
    });
    chrome.contextMenus.create({
      id: 'report-page', title: 'Report this page as phishing', contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });
  });
  getReporterId();
  refreshKnownDomains().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  refreshKnownDomains().catch(() => {});
});

// ---------- Navigation checks (herd immunity) ----------
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !isWebUrl(details.url)) return;
  guardNavigation(details.tabId, details.url).catch((err) => console.warn('[WaveGuard] check failed:', err));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearAllow(tabId).catch(() => {});
});

// fromPageLoad: the content script's safety-net check after a page finished loading
// (covers navigations onBeforeNavigate can miss, like prerendered pages).
async function guardNavigation(tabId, url, { fromPageLoad = false, referrer = '' } = {}) {
  const startTab = chrome.tabs.get(tabId).catch(() => null); // the page we came from, for "Go back"
  const canonical = canonicalizeUrl(url);
  if (await isAllowed(tabId, canonical, { clearIfDifferent: !fromPageLoad })) return { status: 'allowed' };

  const result = await checkUrl(url);
  if (result.status !== 'warn' && result.status !== 'block') return result;

  // The tab is the source of truth: if it is already headed to the warning page
  // (the other check got there first) or the user moved on, do nothing.
  const now = await chrome.tabs.get(tabId).catch(() => null);
  if (!now || canonicalizeUrl(now.pendingUrl || now.url) !== canonical) return result;

  const from = fromPageLoad ? referrer : (await startTab)?.url;
  const back = isWebUrl(from) && canonicalizeUrl(from) !== canonical ? from : '';
  await chrome.tabs.update(tabId, { url: warningPageUrl({ url, status: result.status, back }) });
  postEvent('warned', result.hash);
  return result;
}

// ---------- Right-click reporting ----------
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.menuItemId === 'report-link' ? info.linkUrl : info.pageUrl ?? tab?.url;
  reportWithBadge(tab?.id, { url, reason: 'Reported from the right-click menu' });
});

async function reportWithBadge(tabId, fields) {
  try {
    await submitReport(fields);
    await setBadge(tabId, 'OK', '#1a7f37');
  } catch (err) {
    console.warn('[WaveGuard] report failed:', err);
    await setBadge(tabId, 'ERR', '#c62828');
  }
}

async function setBadge(tabId, text, color) {
  if (tabId == null) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 4000);
}

// ---------- Messages from the popup, warning page and content scripts ----------
const HANDLERS = {
  checkUrl: ({ url }) => checkUrl(url),
  report: ({ report }) => submitReport(report),
  getReporter: async () => ({ reporterId: await getReporterId() }),
  setReporter: async ({ reporterId }) => ({ reporterId: await setReporterId(reporterId) }),

  // Only the warning page may grant "Continue anyway" (never a web page's content script).
  allowOnce: async ({ url }, sender) => {
    const canonical = canonicalizeUrl(url);
    if (!isExtensionPage(sender) || sender.tab?.id == null || !canonical) throw new Error('Not allowed');
    await allowOnce(sender.tab.id, canonical);
    await postEvent('continued', (await hashesForUrl(url))?.urlHash);
    return {};
  },

  analyzeInbox: ({ emails }) => analyzeInbox(emails),
  // Plain-language explanation (the server calls Claude; the extension never holds a key).
  explain: ({ request }) => api('/api/explain', { method: 'POST', body: request, timeoutMs: 35_000 }),
  checkPage: ({ url }) => checkPage(url),

  pageLoaded: ({ url, referrer }, sender) => {
    if (sender.tab?.id == null || sender.frameId !== 0 || !isWebUrl(url)) return null;
    return guardNavigation(sender.tab.id, url, { fromPageLoad: true, referrer });
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = HANDLERS[message?.type];
  if (!handler) return false;
  Promise.resolve()
    .then(() => handler(message, sender))
    .then(
      (result) => sendResponse({ ok: true, result: result ?? null }),
      (err) => sendResponse({ ok: false, error: err.message }),
    );
  return true; // keep the channel open for the async reply
});
