// Inbox adapter for demo/mock-inbox. Every adapter implements:
//   id                      short name
//   matches(document)       true if this adapter understands the page
//   extract()               → [{ id, root, listItem?, senderName, senderEmail, subject, excerpt, links: [{ el, text, href }] }]
//   insertBanner(msg, host) place a warning banner for one message
//   insertChip(msg, host)   place a small status pill in the message list (optional)
//   insertVerified(msg, host) place a "verified sender" pill in the message header (optional)
// A Gmail adapter can be added later by registering another object with the same shape.
(() => {
  const WG = (globalThis.WaveGuard ??= { adapters: [] });
  const ROOT = '[data-mock-inbox]';

  WG.adapters.push({
    id: 'mock-inbox',
    matches: (doc) => Boolean(doc.querySelector(ROOT)),
    extract: () => [...document.querySelectorAll(`${ROOT} article[data-message-id]`)].map((root) => ({
      id: root.dataset.messageId,
      root,
      listItem: document.querySelector(`${ROOT} [data-list-id="${CSS.escape(root.dataset.messageId)}"]`),
      senderName: root.dataset.senderName ?? '',
      senderEmail: root.dataset.senderEmail ?? '',
      subject: root.querySelector('.subject')?.textContent.trim() ?? '',
      excerpt: (root.querySelector('.body')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
      links: [...root.querySelectorAll('.body a[href]')].map((el) => ({ el, text: el.textContent.trim(), href: el.href })),
    })),
    insertBanner: (msg, host) => msg.root.querySelector('.body')?.before(host),
    insertChip: (msg, host) => msg.listItem?.querySelector('.row-from')?.append(host),
    insertVerified: (msg, host) => msg.root.querySelector('.sender-name')?.after(host),
  });
})();
