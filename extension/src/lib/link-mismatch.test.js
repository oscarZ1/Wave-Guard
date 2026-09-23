import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLinkMismatch, domainFromLinkText } from './link-mismatch.js';

test('flags link text that names a different site', () => {
  const r = checkLinkMismatch('https://drive.google.com/file/d/1aB2/view', 'http://docs-share-verify.test:8082/');
  assert.equal(r.triggered, true);
  assert.equal(r.severity, 'high');
  assert.match(r.reason, /drive\.google\.com/);
  assert.match(r.reason, /docs-share-verify\.test/);
  assert.equal(checkLinkMismatch('pepperdine.edu/login', 'https://pepperdine-sso-login.test/').triggered, true);
});

test('allows the same site or a different subdomain of it', () => {
  assert.equal(checkLinkMismatch('www.pepperdine.edu', 'https://pepperdine.edu/x').triggered, false);
  assert.equal(checkLinkMismatch('https://accounts.google.com', 'https://drive.google.com/x').triggered, false);
});

test('ignores link text that is not an address', () => {
  assert.equal(checkLinkMismatch('Click here', 'https://evil.com').triggered, false);
  assert.equal(checkLinkMismatch('report.pdf', 'https://evil.com').triggered, false);
  assert.equal(checkLinkMismatch('pepperdine.edu', 'mailto:x@pepperdine.edu').triggered, false);
});

test('domainFromLinkText reads addresses written many ways', () => {
  assert.equal(domainFromLinkText('https://Drive.Google.com/x'), 'drive.google.com');
  assert.equal(domainFromLinkText('<www.pepperdine.edu>'), 'www.pepperdine.edu');
  assert.equal(domainFromLinkText('pepperdine.edu.'), 'pepperdine.edu');
  assert.equal(domainFromLinkText('see the portal'), null);
});
