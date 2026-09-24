import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLink } from './link-analysis.js';

test('a mismatched link names its real destination', () => {
  const r = analyzeLink({ text: 'https://drive.google.com/file/d/1/view', href: 'http://docs-share-verify.localhost:8082/?file=x' });
  assert.equal(r.host, 'docs-share-verify.localhost');
  assert.equal(r.verdict, 'danger');
  assert.equal(r.findings[0].kind, 'link-mismatch');
});

test('a fake sign-in link is flagged for misusing the Pepperdine name', () => {
  const r = analyzeLink({ text: 'Keep my current password', href: 'http://pepperdine-sso-login.localhost:8082/?session=1' });
  assert.equal(r.verdict, 'danger');
  assert.deepEqual(r.findings.map((f) => f.kind), ['link-brand']);
});

test('herd-immunity status adds a reported finding', () => {
  const r = analyzeLink({ text: 'Open', href: 'https://example.org/x' }, { status: 'block' });
  assert.equal(r.verdict, 'danger');
  assert.match(r.findings[0].reason, /IT confirmed/);
});

test('official campus links and ordinary links are safe', () => {
  const lib = analyzeLink({ text: 'library.pepperdine.edu/rooms', href: 'https://library.pepperdine.edu/rooms' });
  assert.equal(lib.verdict, 'safe');
  assert.equal(lib.official, true);
  const other = analyzeLink({ text: 'Read more', href: 'https://example.org/story' }, { status: 'clean' });
  assert.equal(other.verdict, 'safe');
  assert.equal(other.official, false);
});

test('non-web links return null', () => {
  assert.equal(analyzeLink({ text: 'Email us', href: 'mailto:help@pepperdine.edu' }), null);
  assert.equal(analyzeLink(null), null);
});
