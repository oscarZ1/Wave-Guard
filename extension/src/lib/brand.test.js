import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBrandInWrongPlace } from './brand.js';

test('brand in a subdomain of another site is high', () => {
  const r = checkBrandInWrongPlace('https://pepperdine.edu.secure-login.com/auth');
  assert.equal(r.triggered, true);
  assert.equal(r.severity, 'high');
  assert.match(r.reason, /secure-login\.com/);
});

test('brand in the site name plus a sign-in word is high', () => {
  const r = checkBrandInWrongPlace('http://pepperdine-sso-login.test:8082/');
  assert.equal(r.severity, 'high');
  assert.equal(checkBrandInWrongPlace('https://pepperd1ne-login.web.app/').severity, 'high');
});

test('brand in the site name alone is medium', () => {
  const r = checkBrandInWrongPlace('https://pepperdine-alumni-fans.com/');
  assert.equal(r.triggered, true);
  assert.equal(r.severity, 'medium');
});

test('brand in the path only counts next to sign-in words', () => {
  assert.equal(checkBrandInWrongPlace('https://evil.com/pepperdine/login').severity, 'medium');
  assert.equal(checkBrandInWrongPlace('https://en.wikipedia.org/wiki/Pepperdine_University').triggered, false);
});

test('official campus sites are never flagged', () => {
  for (const url of ['https://www.pepperdine.edu/login', 'https://pepperdinewaves.com/', 'https://pepperdine.instructure.com/login']) {
    assert.equal(checkBrandInWrongPlace(url).triggered, false, url);
  }
});

test('non-web URLs are ignored', () => {
  assert.equal(checkBrandInWrongPlace('mailto:pepperdine@evil.com').triggered, false);
});
