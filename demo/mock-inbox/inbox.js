// Demo inbox behavior: point demo links at whichever local hostnames you're using
// (.test via /etc/hosts, or .localhost), and switch between messages.
(() => {
  const tld = location.hostname.endsWith('.test') ? 'test' : 'localhost';
  const port = location.port ? `:${location.port}` : '';
  for (const a of document.querySelectorAll('a[data-demo-host]')) {
    a.href = `http://${a.dataset.demoHost}.${tld}${port}${a.dataset.demoPath ?? '/'}`;
  }

  const rows = [...document.querySelectorAll('[data-list-id]')];
  const open = (id) => {
    for (const row of rows) row.classList.toggle('selected', row.dataset.listId === id);
    for (const article of document.querySelectorAll('article[data-message-id]')) {
      article.hidden = article.dataset.messageId !== id;
    }
    document.querySelector(`[data-list-id="${id}"]`)?.classList.remove('unread');
    history.replaceState(null, '', `#${id}`);
  };
  for (const row of rows) row.addEventListener('click', () => open(row.dataset.listId));
  for (const a of document.querySelectorAll('.folders a, .compose')) a.addEventListener('click', (e) => e.preventDefault());
  open(location.hash.slice(1) && document.querySelector(`[data-list-id="${location.hash.slice(1)}"]`) ? location.hash.slice(1) : rows[0].dataset.listId);
})();
