// Report trust levels (abuse resistance):
//   1 report                          → warn
//   3+ distinct reporters             → block (never automatic for allowlisted domains)
//   IT confirm / IT dismiss           → block / dismissed, and reports can't change that
export const AUTO_BLOCK_REPORTERS = 3;

export function computeStatus({ current, distinctReporters, isKnownDomain }) {
  if (current === 'dismissed' || current === 'block') return current;
  if (distinctReporters >= AUTO_BLOCK_REPORTERS && !isKnownDomain) return 'block';
  return 'warn';
}

export function statusForDecision(action) {
  if (action === 'confirm') return 'block';
  if (action === 'dismiss') return 'dismissed';
  return null;
}
