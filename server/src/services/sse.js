// Server-Sent Events for the live dashboard. Every change sends one "changed"
// event; the dashboard refetches. Module state is fine here (this is the server).
const clients = new Set();

export function sseHandler(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

export function broadcast(data = {}) {
  const message = `event: changed\ndata: ${JSON.stringify({ at: new Date().toISOString(), ...data })}\n\n`;
  for (const res of clients) res.write(message);
}

// Comment lines keep proxies and browsers from closing idle streams.
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25_000).unref();
