// Report trust levels (abuse resistance):
//   1 report                          → pending: only IT sees it, unless triage shares it (see triage.js)
//   shared by triage or by IT         → warn
//   3+ distinct reporters             → block (never automatic for allowlisted domains)
//   IT confirm / IT dismiss           → block / dismissed, and reports can't change that
export const AUTO_BLOCK_REPORTERS = 3;

// shareWithCommunity defaults to true, which keeps the original "one report warns" rule
// for callers that don't run triage.
export function computeStatus({ current, distinctReporters, isKnownDomain, shareWithCommunity = true }) {
  if (current === 'dismissed' || current === 'block') return current;
  if (distinctReporters >= AUTO_BLOCK_REPORTERS && !isKnownDomain) return 'block';
  if (current === 'warn' || shareWithCommunity) return 'warn'; // once shared, stays shared
  return 'pending';
}

export function statusForDecision(action) {
  if (action === 'confirm') return 'block';
  if (action === 'dismiss') return 'dismissed';
  if (action === 'share') return 'warn';
  return null;
}
