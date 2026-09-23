import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEmail } from './email-analysis.js';

const rivera = {
  name: 'Alex Rivera', title: 'Dean of Students',
  official_emails: ['alex.rivera@pepperdine.edu', 'deanofstudents@pepperdine.edu'],
  verify_channel: 'Office line (310) 555-0142',
};
const itSecurity = { name: 'IT Security', title: 'Information Security Office', official_emails: ['security@pepperdine.edu'] };
const library = { name: 'Payson Library', title: 'Library Services', official_emails: ['library@pepperdine.edu'] };

// The four demo emails from demo/mock-inbox.
test('demo email 1: the real library email is safe and verified', () => {
  const r = analyzeEmail({
    senderName: 'Payson Library', senderEmail: 'library@pepperdine.edu',
    links: [{ text: 'library.pepperdine.edu/rooms', href: 'https://library.pepperdine.edu/rooms' }],
  }, { directoryEntry: library });
  assert.equal(r.verdict, 'safe');
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.verifiedSender, { name: 'Payson Library', title: 'Library Services' });
});

test('demo email 2: "Dean Alex Rivera" from gmail.com is flagged as impersonation', () => {
  const r = analyzeEmail({ senderName: 'Dean Alex Rivera', senderEmail: 'dean.alex.rivera.office@gmail.com', links: [] }, { directoryEntry: rivera });
  assert.equal(r.verdict, 'danger');
  assert.equal(r.title, 'This email is pretending to be Alex Rivera');
  assert.equal(r.findings[0].kind, 'impersonation');
  assert.match(r.findings[0].reason, /gmail\.com/);
  assert.equal(r.verifiedSender, null);
});

test('demo email 3: link text says Google Drive but opens another site', () => {
  const r = analyzeEmail({
    senderName: 'Google Drive', senderEmail: 'drive-shares-noreply@docs-share-verify.test',
    links: [{ text: 'https://drive.google.com/file/d/1Xy7spring/view', href: 'http://docs-share-verify.localhost:8082/?file=spring' }],
  }, { directoryEntry: null });
  assert.equal(r.verdict, 'danger');
  assert.equal(r.title, 'This email hides where its link really goes');
  assert.deepEqual(r.flaggedLinks.map((l) => [l.index, l.realHost]), [[0, 'docs-share-verify.localhost']]);
});

test('demo email 4: fake IT Security email with a look-alike domain and a fake sign-in link', () => {
  const r = analyzeEmail({
    senderName: 'Pepperdine IT Security', senderEmail: 'it-security@pepperdlne.edu',
    links: [{ text: 'Keep my password', href: 'http://pepperdine-sso-login.localhost:8082/?session=8f2a' }],
  }, { directoryEntry: itSecurity });
  assert.equal(r.verdict, 'danger');
  const kinds = r.findings.map((f) => f.kind);
  assert.ok(kinds.includes('impersonation'), kinds);
  assert.ok(kinds.includes('sender-lookalike'), kinds);
  assert.ok(kinds.includes('link-brand'), kinds);
  assert.equal(r.flaggedLinks[0].realHost, 'pepperdine-sso-login.localhost');
});

test('herd-immunity reports show up on links and senders', () => {
  const r = analyzeEmail({
    senderName: 'Someone', senderEmail: 'someone@example.org',
    links: [{ text: 'Open', href: 'https://example.org/x' }],
  }, { linkStatuses: ['warn'], senderStatus: 'block' });
  assert.equal(r.verdict, 'danger');
  assert.equal(r.title, 'Pepperdine users reported this email as phishing');
  assert.ok(r.findings.some((f) => f.kind === 'reported-link' && /reported this link/.test(f.reason)));
  assert.ok(r.findings.some((f) => f.kind === 'reported-sender' && /IT confirmed/.test(f.reason)));
});

test('an ordinary email from outside with a normal link is safe but not verified', () => {
  const r = analyzeEmail({
    senderName: 'Newsletter', senderEmail: 'news@example.org',
    links: [{ text: 'Read more', href: 'https://example.org/story' }],
  });
  assert.equal(r.verdict, 'safe');
  assert.equal(r.verifiedSender, null);
  assert.deepEqual(r.flaggedLinks, []);
});

test('duplicate reasons are merged and high findings come first', () => {
  const r = analyzeEmail({
    senderName: 'Alex Rivera', senderEmail: 'arivera@pepperdine.edu',
    links: [
      { text: 'pepperdine.edu', href: 'https://pepperdine-login.test/a' },
      { text: 'pepperdine.edu', href: 'https://pepperdine-login.test/a' },
    ],
  }, { directoryEntry: rivera });
  const reasons = r.findings.map((f) => f.reason);
  assert.equal(new Set(reasons).size, reasons.length);
  assert.equal(r.findings.at(-1).severity, 'medium'); // unofficial campus address sorts last
});
