// Every heuristic returns { triggered, severity, reason }.
// Reasons are plain English for a non-technical reader.

export const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

export function clean() {
  return { triggered: false, severity: 'low', reason: '' };
}

export function flag(severity, reason) {
  if (!(severity in SEVERITY_RANK)) throw new Error(`unknown severity: ${severity}`);
  return { triggered: true, severity, reason };
}
