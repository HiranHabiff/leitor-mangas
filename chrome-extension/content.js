/* content.js — Leitor Extension Content Script
   Runs on every page. Provides:
   • SPA history emitter (pushState / replaceState / popstate)
   • Image-container selection mode (hover → click)
   • Image URL extraction from a DOM element
   • CSS-selector computation for future refreshes
   All sidebar/UI logic now lives in sidebar.js (native Side Panel). */

let selectionMode = false;
let _hoverHandler, _clickHandler, _mouseoutHandler;
let _overlay = null; // floating badge showing image count during selection

/* ── History Emitter ───────────────────────────────── */
(function setupHistoryEmitter() {
  try {
    let lastHref = location.href;
    const notify = (url) => {
      if (url === lastHref) return;
      lastHref = url;
      try { chrome.runtime.sendMessage({ action: 'page-url-changed', url }); } catch {}
    };
    ['pushState', 'replaceState'].forEach(fn => {
      const orig = history[fn];
      history[fn] = function () {
        const res = orig.apply(this, arguments);
        try { notify(location.href); } catch {}
        return res;
      };
    });
    window.addEventListener('popstate',   () => { try { notify(location.href); } catch {} });
    window.addEventListener('hashchange', () => { try { notify(location.href); } catch {} });
  } catch {}
})();

/* ── Message Listeners ─────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResp) => {
  if (!msg) return;

  // Start element selection mode (called from sidebar)
  if (msg.action === 'start-select' || msg.action === 'start-select-standalone') {
    startSelectStandalone();
    sendResp?.({ status: 'started' });
    return;
  }

  // Return current page URL (accurate even after pushState)
  if (msg.action === 'get-page-url') {
    sendResp?.({ url: location.href });
    return;
  }

  // Scroll to a specific image on the page
  if (msg.action === 'scroll-to-image' && msg.url) {
    scrollToImage(msg.url);
    sendResp?.({ ok: true });
    return;
  }

  // Refresh selection using a saved CSS selector
  if (msg.action === 'refresh-selection') {
    let selector = msg.selector;
    if (!selector) { sendResp?.({ ok: false, error: 'no_selector' }); return; }
    // Sanitize legacy selectors that contain unescaped Tailwind classes
    selector = sanitizeSelector(selector);
    try {
      const el = document.querySelector(selector);
      if (!el) { sendResp?.({ ok: false, error: 'element_not_found' }); return; }
      const pageUrl = location.href;
      const urls = extractImageUrls(el, pageUrl);
      const html = urls.length ? urls.join('\n') : el.innerHTML;
      // Recompute a clean selector for future use
      const cleanSelector = computeCssSelector(el);
      persistAndNotify(html, pageUrl, cleanSelector || selector);
      sendResp?.({ ok: true, count: urls.length, html, url: pageUrl, selector: cleanSelector || selector });
    } catch (e) { sendResp?.({ ok: false, error: String(e) }); }
    return;
  }
});

/* ── Image Extraction ──────────────────────────────── */
function resolveUrl(url, base) {
  try { return new URL(url, base).href; } catch { return url; }
}

function extractImageUrls(el, base) {
  const urls = new Set();
  const add = u => { if (!u) return; u = String(u).trim(); if (u) urls.add(resolveUrl(u, base || location.href)); };

  try {
    // <img> tags
    el.querySelectorAll('img').forEach(img => {
      add(img.getAttribute('src') || img.getAttribute('data-src') || img.src);
      const srcset = img.getAttribute('srcset');
      if (srcset) srcset.split(',').forEach(p => add(p.trim().split(/\s+/)[0]));
    });

    // <source> inside <picture>
    el.querySelectorAll('source').forEach(s => {
      const ss = s.getAttribute('src') || s.getAttribute('srcset');
      if (ss) ss.split(',').forEach(p => add(p.trim().split(/\s+/)[0]));
    });

    // Inline background-image
    el.querySelectorAll('[style]').forEach(n => {
      const m = /background-image\s*:\s*url\(([^)]+)\)/i.exec(n.getAttribute('style') || '');
      if (m?.[1]) add(m[1].replace(/^['"]|['"]$/g, ''));
    });

    // Computed background-image (including the root element)
    [el, ...el.querySelectorAll('*')].forEach(n => {
      try {
        const bg = getComputedStyle(n).backgroundImage;
        if (bg && bg !== 'none') {
          const m = /url\(([^)]+)\)/i.exec(bg);
          if (m?.[1]) add(m[1].replace(/^['"]|['"]$/g, ''));
        }
      } catch {}
    });
  } catch {
    try { el.querySelectorAll?.('img').forEach(img => add(img.src)); } catch {}
  }

  return Array.from(urls);
}

/* ── CSS Selector Builder ──────────────────────────── */
function escapeCssIdent(str) {
  // Escape characters that are invalid in CSS identifiers
  return str.replace(/([^\w-])/g, '\\$1');
}

function sanitizeSelector(sel) {
  // Strip class names with special chars (e.g. Tailwind md:w-[800px]) from saved selectors
  // Split on ' > ', clean each segment, rejoin
  return sel.split(' > ').map(seg => {
    // Separate tag+classes from :nth-child() pseudo-class
    const nthMatch = seg.match(/(.*?)(:nth-child\(\d+\))$/);
    const base = nthMatch ? nthMatch[1] : seg;
    const nth = nthMatch ? nthMatch[2] : '';
    // Split into tag and class parts
    const dotParts = base.split('.');
    const tag = dotParts[0]; // e.g. 'div' or 'main'
    const classes = dotParts.slice(1).filter(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c));
    return tag + (classes.length ? '.' + classes.join('.') : '') + nth;
  }).join(' > ');
}

function computeCssSelector(el) {
  try {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + escapeCssIdent(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let part = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).filter(Boolean);
        // Skip classes with special chars that would break selectors (Tailwind responsive/arbitrary)
        const safe = classes.filter(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c));
        if (safe.length) part += '.' + safe.join('.');
      }
      const parent = el.parentNode;
      if (parent) {
        const siblings = Array.from(parent.children);
        if (siblings.filter(c => c.tagName === el.tagName).length > 1) {
          part += ':nth-child(' + (siblings.indexOf(el) + 1) + ')';
        }
      }
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  } catch { return ''; }
}

/* ── Selection Mode ────────────────────────────────── */
function startSelectStandalone() {
  stopSelectMode();
  selectionMode = true;
  showOverlay('Clique no container de imagens');

  _hoverHandler = e => {
    const el = e.target;
    if (el === _overlay) return;
    el.__leitor_old = el.style.outline;
    el.style.outline = '3px dashed #f39c12';
    // Update overlay with image count preview
    const count = el.querySelectorAll?.('img')?.length || 0;
    updateOverlay(count ? `${count} imagens encontradas — clique para selecionar` : 'Clique para selecionar');
    e.stopPropagation();
  };

  _mouseoutHandler = e => {
    const el = e.target;
    if (el.__leitor_old !== undefined) { el.style.outline = el.__leitor_old; delete el.__leitor_old; }
  };

  _clickHandler = e => {
    e.preventDefault();
    e.stopPropagation();
    const container = e.target;
    const pageUrl = location.href;
    const selector = computeCssSelector(container);
    const urls = extractImageUrls(container, pageUrl);
    const html = urls.length ? urls.join('\n') : container.innerHTML;

    persistAndNotify(html, pageUrl, selector);
    stopSelectMode();
    showOverlay(`${urls.length} imagens selecionadas`, 2000);
  };

  document.addEventListener('mouseover', _hoverHandler, true);
  document.addEventListener('mouseout',  _mouseoutHandler, true);
  document.addEventListener('click',     _clickHandler, true);
  window.addEventListener('keyup', escListener);
}

function escListener(e) { if (e.key === 'Escape') { stopSelectMode(); hideOverlay(); } }

function stopSelectMode() {
  selectionMode = false;
  if (_hoverHandler)    document.removeEventListener('mouseover', _hoverHandler, true);
  if (_mouseoutHandler) document.removeEventListener('mouseout',  _mouseoutHandler, true);
  if (_clickHandler)    document.removeEventListener('click',     _clickHandler, true);
  window.removeEventListener('keyup', escListener);
  // Remove leftover outlines
  document.querySelectorAll('*').forEach(el => {
    if (el.__leitor_old !== undefined) { el.style.outline = el.__leitor_old; delete el.__leitor_old; }
  });
}

/* ── Floating Overlay Badge ────────────────────────── */
function showOverlay(text, autoHideMs) {
  hideOverlay();
  _overlay = document.createElement('div');
  Object.assign(_overlay.style, {
    all: 'initial', position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2147483647', padding: '8px 18px', borderRadius: '8px',
    background: 'rgba(44,62,80,.92)', color: '#fff', fontFamily: 'system-ui, sans-serif',
    fontSize: '14px', fontWeight: '600', pointerEvents: 'none', whiteSpace: 'nowrap',
    boxShadow: '0 4px 16px rgba(0,0,0,.25)', transition: 'opacity .3s'
  });
  _overlay.textContent = text;
  document.documentElement.appendChild(_overlay);
  if (autoHideMs) setTimeout(hideOverlay, autoHideMs);
}

function updateOverlay(text) { if (_overlay) _overlay.textContent = text; }

function hideOverlay() {
  if (_overlay) { try { _overlay.remove(); } catch {} _overlay = null; }
}

/* ── Scroll to Image ────────────────────────────────── */
function scrollToImage(url) {
  // Find image by src, data-src, or background-image
  const imgs = document.querySelectorAll('img');
  let target = null;
  for (const img of imgs) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src;
    if (src && (src === url || img.src === url)) { target = img; break; }
  }
  // Fallback: check background-image
  if (!target) {
    for (const el of document.querySelectorAll('[style]')) {
      if ((el.getAttribute('style') || '').includes(url)) { target = el; break; }
    }
  }
  if (!target) { showOverlay('Imagem não encontrada na página', 2000); return; }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Highlight with animation
  target.style.transition = 'outline .2s ease, outline-offset .2s ease';
  target.style.outline = '3px solid #4361ee';
  target.style.outlineOffset = '4px';
  setTimeout(() => {
    target.style.outline = '';
    target.style.outlineOffset = '';
    target.style.transition = '';
  }, 2000);
}

/* ── Helpers ───────────────────────────────────────── */
function persistAndNotify(html, url, selector) {
  const data = { html, url: url || '', selector: selector || '', ts: Date.now() };
  try { chrome.storage.local.set({ last_selection: data }); } catch {}
  try { chrome.runtime.sendMessage({ action: 'selected', html, url, selector }); } catch {}
}

// Cleanup on unload
window.addEventListener('beforeunload', stopSelectMode);
