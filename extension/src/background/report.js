import { api } from './api.js';
import { getReporterId } from './storage.js';

// fields: { url?, sender_email?, sender_display_name?, excerpt?, reason? }
export async function submitReport(fields) {
  const reporter_id = await getReporterId();
  return api('/api/reports', { method: 'POST', body: { ...fields, reporter_id }, timeoutMs: 5000 });
}
