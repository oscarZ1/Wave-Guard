// For extension pages (popup, warning page): message the service worker and
// unwrap its { ok, result, error } reply.
export async function send(type, payload = {}) {
  const reply = await chrome.runtime.sendMessage({ type, ...payload });
  if (!reply?.ok) throw new Error(reply?.error ?? 'WaveGuard did not respond');
  return reply.result;
}
