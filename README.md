# WaveGuard

Campus-aware phishing defense for the Pepperdine community: a Chrome extension, a campus API, and an IT dashboard.

- **Campus herd immunity.** When a report checks out, every WaveGuard user is warned about it within seconds. Report triage keeps one person from spamming warnings onto everyone's screen (see below).
- **Organizational context.** WaveGuard knows the campus directory and the domains the campus uses, so "Dean Rivera" writing from gmail.com gets flagged.
- **Privacy by design.** Browsing is checked with 4-byte hash prefixes. Plaintext only reaches the server when a user reports something.

Hackathon project. Identity is mocked, and production would use Google Workspace SSO. All directory data is fictional.

## Layout

```
extension/  Chrome MV3 extension (vanilla JS, ES modules, no bundler)
server/     Node + Express + PostgreSQL API
admin/      React + Vite IT dashboard
demo/       mock inbox and fake phishing pages for the live demo
```

## Setup

You need Node 22+, PostgreSQL 14+ and Google Chrome.

```sh
npm install
cp server/.env.example server/.env   # then set DATABASE_URL
npm run db:setup                     # creates the database, schema and fictional seed data
npm run dev                          # starts API, admin dashboard and demo sites together
```

`npm run db:reset` wipes all reports and reseeds the database. Run it before each demo.

### Plain-language explanations (optional)

Set `ANTHROPIC_API_KEY` in `server/.env` to turn on the "Why?" buttons' Claude explanations. `ANTHROPIC_MODEL` defaults to `claude-opus-5`. Without a key, or if the API call fails, "Why?" still works and shows WaveGuard's own reasons. The server reads `server/.env` itself, so an empty `ANTHROPIC_API_KEY` exported by your shell doesn't hide the key.

| Service | URL |
|---|---|
| API | http://localhost:3000 (health check at `/api/health`) |
| IT dashboard | http://localhost:5180 |
| Demo index | http://localhost:8082 |
| Mock inbox | http://mail.localhost:8082 |
| Fake SSO page | http://pepperdine-sso-login.localhost:8082 |
| Fake docs page | http://docs-share-verify.localhost:8082 |

Chrome resolves `*.localhost` names on its own, so the demo works with no extra setup.

### Optional: realistic `.test` hostnames

For a more realistic demo, add these hosts entries:

```sh
echo "127.0.0.1 mail.test pepperdine-sso-login.test docs-share-verify.test" | sudo tee -a /etc/hosts
sudo killall -HUP mDNSResponder
```

Then use `http://pepperdine-sso-login.test:8082` and the other names. The demo server routes on the first part of the hostname, so both forms work.

Chrome tips:
- Turn off "Always use secure connections" under Settings, Privacy and security, Security, in both demo profiles.
- Open demo pages from bookmarks or by clicking links. Chrome may treat a typed `.test` name as a search.

### Report triage

Every report reaches the IT dashboard, but not every report warns everyone. The server decides:

| Situation | Result |
|---|---|
| WaveGuard's own checks also flag it (fake Pepperdine login, lookalike domain, impersonated sender) | Warns everyone right away |
| Anything else, with one reporter | Held for review: only IT sees it |
| A second person reports it | Warns everyone |
| IT clicks **Warn everyone** | Warns everyone |
| 3 people report it, or IT clicks **Confirm phishing** | Blocked |

It also limits each person to 10 reports an hour, and stops counting someone toward a warning once IT has dismissed most of their reports (their reports still reach IT). The policy lives in `server/src/services/triage.js`. Tune it in `server/.env`:

```sh
WAVEGUARD_SHARE_AFTER_REPORTERS=2  # set to 1 for the original "one report warns everyone"
WAVEGUARD_REPORTS_PER_HOUR=10
WAVEGUARD_MUTE_AFTER_DISMISSED=3
```

This branch changes the database schema, so run `npm run db:reset` once after pulling it.

## Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension/` folder.
4. After editing extension code, click the reload icon on the WaveGuard card.

For the herd-immunity demo, create a second Chrome profile and load the extension there too.

## Tests

```sh
npm test
```

This runs `node --test` over the extension's pure logic in `extension/src/lib` and the server services.

## Before a demo

1. Run `npm run dev`, then `npm run db:reset` to clear old reports.
2. In both Chrome profiles, click reload on the WaveGuard card in `chrome://extensions`. Chrome keeps running the old background worker until you do. The side panel shows a red notice if a profile is out of date.
3. Click the WaveGuard icon in each profile to open the side panel. The two "Reporting as" IDs should differ.
4. Open the IT dashboard at http://localhost:5180 next to the browsers. The dot at the top right should say Live.

## Demo script

1. Open the mock inbox. The impersonation email is flagged inline with an explanation.
2. Hover the mismatched link. The tooltip shows the real destination.
3. User A reports the fake SSO link. It appears live on the IT dashboard, marked as warning everyone because WaveGuard's own checks agree.
4. User B clicks the same link and sees a warning page: "Reported by a Pepperdine user."
5. IT confirms the report. It escalates to a full block, and the counter increments.
6. User A reports the Google Drive email. It shows up as "Held for review," and User B isn't warned. User B reports it too, or IT clicks Warn everyone, and it switches to warning users.

## Safety

- The fake SSO page never submits or stores anything. Its form has no action and no named fields.
- The Anthropic API key lives only in `server/.env`. The extension never calls the LLM.
