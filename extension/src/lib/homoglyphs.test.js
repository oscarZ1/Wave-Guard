import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skeleton, decodeHost, hasNonAscii } from './homoglyphs.js';

test('look-alike spellings share the same skeleton', () => {
  const real = skeleton('pepperdine');
  assert.equal(skeleton('pepperdlne'), real);
  assert.equal(skeleton('pepperd1ne'), real);
  assert.equal(skeleton('pepperdіne'), real); // Cyrillic і
  assert.equal(skeleton('pеpperdine'), real); // Cyrillic е
  assert.equal(skeleton('pepperdíne'), real); // accented í
  assert.equal(skeleton('rnicrosoft'), skeleton('microsoft'));
  assert.equal(skeleton('g00gle'), skeleton('google'));
});

test('different words keep different skeletons', () => {
  assert.notEqual(skeleton('pepperdine'), skeleton('peppermint'));
  assert.notEqual(skeleton('okta'), skeleton('meta'));
});

test('decodeHost turns punycode into Unicode', () => {
  const ascii = new URL('http://pepperdіne.edu').hostname;
  assert.match(ascii, /^xn--/);
  assert.equal(decodeHost(ascii), 'pepperdіne.edu');
  assert.ok(hasNonAscii(decodeHost(ascii)));
  assert.ok(!hasNonAscii('pepperdine.edu'));
});
