/* background.js — Leitor Extension Service Worker
   Opens Side Panel on icon click, proxies fetch requests */

// Open side panel when user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Proxy fetch & persist selections
chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if (msg?.action === 'fetch-from-background') {
    fetch(msg.url, msg.options)
      .then(async r => {
        const body = await r.text();
        sendResp({ ok: r.ok, status: r.status, statusText: r.statusText, body });
      })
      .catch(err => sendResp({ ok: false, error: String(err) }));
    return true;
  }

  if (msg?.action === 'selected' && msg.html) {
    chrome.storage.local.set({
      last_selection: { html: msg.html, url: msg.url || '', selector: msg.selector || '', ts: Date.now() }
    }).catch(() => {});
  }
});
