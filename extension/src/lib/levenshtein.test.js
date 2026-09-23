import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein } from './levenshtein.js';

test('levenshtein counts edits', () => {
  assert.equal(levenshtein('pepperdine', 'pepperdine'), 0);
  assert.equal(levenshtein('pepperdine', 'peperdine'), 1);
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
});
