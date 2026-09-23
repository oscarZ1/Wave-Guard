import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, registrableDomain, hostnameOf, subdomainPart, isIpAddress } from './normalize.js';

test('canonicalizeUrl drops scheme, fragment and default port, lowercases host', () => {
  assert.equal(canonicalizeUrl('HTTPS://Login.Example.COM:443/a/b?x=1#frag'), 'login.example.com/a/b?x=1');
  assert.equal(canonicalizeUrl('http://example.com'), 'example.com/');
  assert.equal(canonicalizeUrl('http://pepperdine-sso-login.test:8082/'), 'pepperdine-sso-login.test:8082/');
});

test('canonicalizeUrl gives http and https the same form', () => {
  assert.equal(canonicalizeUrl('http://evil.com/login'), canonicalizeUrl('https://evil.com/login'));
});

test('canonicalizeUrl rejects non-web URLs and junk', () => {
  assert.equal(canonicalizeUrl('mailto:someone@pepperdine.edu'), null);
  assert.equal(canonicalizeUrl('chrome-extension://abc/warning.html'), null);
  assert.equal(canonicalizeUrl('not a url'), null);
  assert.equal(canonicalizeUrl(undefined), null);
});

test('registrableDomain keeps the part one owner controls', () => {
  assert.equal(registrableDomain('login.secure.evil.com'), 'evil.com');
  assert.equal(registrableDomain('pepperdine.edu.secure-login.com'), 'secure-login.com');
  assert.equal(registrableDomain('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(registrableDomain('pepperdine-login.github.io'), 'pepperdine-login.github.io');
  assert.equal(registrableDomain('pepperdine-sso-login.localhost'), 'pepperdine-sso-login.localhost');
  assert.equal(registrableDomain('Example.COM.'), 'example.com');
});

test('registrableDomain leaves IPs and single labels alone', () => {
  assert.equal(registrableDomain('127.0.0.1'), '127.0.0.1');
  assert.equal(registrableDomain('localhost'), 'localhost');
  assert.equal(registrableDomain(null), null);
});

test('hostnameOf, subdomainPart and isIpAddress', () => {
  assert.equal(hostnameOf('https://Mail.Test:8082/x'), 'mail.test');
  assert.equal(hostnameOf('ftp://x.com'), null);
  assert.equal(subdomainPart('a.b.evil.com'), 'a.b');
  assert.equal(subdomainPart('evil.com'), '');
  assert.ok(isIpAddress('10.0.0.1'));
  assert.ok(!isIpAddress('pepperdine.edu'));
});
