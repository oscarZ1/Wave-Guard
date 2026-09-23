// Folds characters that look alike into one "skeleton", so pepperdіne (Cyrillic і),
// pepperd1ne and pepperdlne all compare equal to pepperdine.
import { toUnicode } from './vendor/punycode.js';

const CHAR_MAP = {
  // Cyrillic
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't',
  у: 'y', х: 'x', і: 'l', ї: 'l', ј: 'j', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w',
  // Greek
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'l', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  // Armenian and Latin extras
  ո: 'n', ս: 'u', օ: 'o', ı: 'l', ɡ: 'g', ǀ: 'l',
  // Digits and symbols used as letters
  0: 'o', 1: 'l', 3: 'e', 5: 's', '|': 'l', '!': 'l',
  // i, l and I are near-identical in many fonts
  i: 'l',
};

// Multi-letter tricks, applied after single characters are folded.
const SEQUENCES = [
  ['rn', 'm'],
  ['vv', 'w'],
  ['cl', 'd'],
];

export function decodeHost(host) {
  try {
    return toUnicode(String(host).toLowerCase());
  } catch {
    return String(host).toLowerCase();
  }
}

export function hasNonAscii(text) {
  return /[^\x00-\x7f]/.test(text);
}

export function skeleton(text) {
  const folded = decodeHost(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents: é → e
    .toLowerCase();
  let out = Array.from(folded, (ch) => CHAR_MAP[ch] ?? ch).join('');
  for (const [from, to] of SEQUENCES) out = out.replaceAll(from, to);
  return out;
}
