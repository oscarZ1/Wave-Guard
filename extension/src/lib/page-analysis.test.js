import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePage } from './page-analysis.js';

test('the fake SSO page is dangerous', () => {
  const r = analyzePage('http://pepperdine-sso-login.localhost:8082/');
  assert.equal(r.verdict, 'danger');
  assert.equal(r.findings[0].kind, 'brand');
});

test('a look-alike domain is dangerous', () => {
  assert.equal(analyzePage('https://pepperdlne.edu/login').verdict, 'danger');
});

test('a fan site using the name is caution', () => {
  assert.equal(analyzePage('https://pepperdine-alumni-fans.com/').verdict, 'caution');
});

test('real campus sites, unrelated sites and non-web pages are safe', () => {
  for (const url of ['https://www.pepperdine.edu/', 'https://en.wikipedia.org/wiki/Pepperdine_University', 'http://mail.localhost:8082/', 'chrome://newtab/']) {
    assert.equal(analyzePage(url).verdict, 'safe', url);
  }
});
