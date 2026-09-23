// Serves the demo sites on one port, routed by the first label of the Host header.
// Works with /etc/hosts names (pepperdine-sso-login.test) and with *.localhost,
// which Chrome resolves to 127.0.0.1 without any hosts entry.
import express from 'express';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.DEMO_PORT) || 8082;
const dir = (name) => fileURLToPath(new URL(`./${name}/`, import.meta.url));

const SITES = {
  mail: 'mock-inbox',
  'pepperdine-sso-login': 'fake-sso',
  'docs-share-verify': 'docs-share',
};
const statics = Object.fromEntries(
  Object.values(SITES).map((folder) => [folder, express.static(dir(folder))]),
);

const app = express();

app.use((req, res, next) => {
  const host = (req.headers.host ?? '').toLowerCase().replace(/:\d+$/, '');
  const folder = SITES[host.split('.')[0]];
  if (folder) return statics[folder](req, res, next);
  next();
});

// Plain localhost: index page with links to every demo host.
app.get('/', (req, res) => {
  const links = Object.keys(SITES)
    .map((label) => {
      const a = `http://${label}.localhost:${PORT}/`;
      const b = `http://${label}.test:${PORT}/`;
      return `<li><b>${SITES[label]}</b>: <a href="${a}">${a}</a> · <a href="${b}">${b}</a> (needs /etc/hosts)</li>`;
    })
    .join('');
  res.type('html').send(`<!doctype html><title>WaveGuard demo</title>
    <body style="font-family:system-ui;padding:24px"><h1>WaveGuard demo sites</h1><ul>${links}</ul></body>`);
});

app.listen(PORT, () => console.log(`Demo sites on http://localhost:${PORT} (try http://mail.localhost:${PORT})`));
