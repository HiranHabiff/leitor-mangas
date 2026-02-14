/* shared.js — Leitor Extension shared utilities
   Imported by sidebar.js via <script> tag */

const Leitor = (() => {
  const DEFAULT_SERVER = 'http://localhost:3000';

  async function getServerBase() {
    try {
      const cfg = await chrome.storage.sync.get({ leitor_server_base: DEFAULT_SERVER });
      return (cfg?.leitor_server_base || DEFAULT_SERVER).replace(/\/+$/, '');
    } catch { return DEFAULT_SERVER; }
  }

  async function getCurrentTab() {
    return new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs?.[0] || null));
    });
  }

  /* ---------- Obras ---------- */
  async function loadObras(selectEl, statusFn) {
    selectEl.innerHTML = '<option value="" disabled selected>Carregando obras…</option>';
    try {
      const server = await getServerBase();
      const url = `${server}/obras`;

      // Use background proxy to avoid CORS
      const resp = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'fetch-from-background', url }, r => resolve(r));
      });
      if (!resp?.ok) throw new Error(resp?.error || `HTTP ${resp?.status}`);

      const snippet = (resp.body || '').trim().slice(0, 200);
      if (snippet.startsWith('<') || /<html|<!doctype/i.test(snippet)) throw new Error('Server returned HTML instead of JSON');

      const parsed = JSON.parse(resp.body);
      const list = Array.isArray(parsed) ? parsed : parsed?.obras || [];

      selectEl.innerHTML = '<option value="" disabled>Selecione uma obra</option>';
      list.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id || o.slug || o.name;
        opt.textContent = o.title || o.name || opt.value;
        selectEl.appendChild(opt);
      });

      // Restore saved default
      try {
        const s = await chrome.storage.local.get('default_obra');
        const def = s?.default_obra;
        if (def?.id) {
          const found = Array.from(selectEl.options).find(o => o.value == def.id);
          if (found) selectEl.value = def.id;
          else {
            const added = document.createElement('option');
            added.value = def.id; added.textContent = def.name || def.id;
            selectEl.insertBefore(added, selectEl.options[1]);
            selectEl.value = def.id;
          }
        }
      } catch {}
    } catch (err) {
      selectEl.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
      statusFn?.('Erro ao carregar obras: ' + err.message, 'error');
    }
  }

  /* ---------- Send Chapter ---------- */
  async function sendChapter({ obraId, capNumber, url, imageUrls }, statusFn) {
    if (!obraId || !capNumber || !imageUrls?.length) {
      statusFn?.('Preencha obra, capítulo e selecione imagens', 'error');
      return false;
    }
    statusFn?.('Enviando…', 'loading');
    try {
      const server = await getServerBase();
      const payload = {
        obra_id: obraId,
        capitulo_numero: Number(capNumber) || null,
        url: url || '',
        imagens_url: imageUrls
      };
      const resp = await fetch(`${server}/api/chapters/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`${resp.status} — ${body}`);
      }
      statusFn?.('Capítulo enviado com sucesso!', 'success');
      return true;
    } catch (err) {
      statusFn?.('Erro ao enviar: ' + err.message, 'error');
      return false;
    }
  }

  /* ---------- Tag List (image URL list) ---------- */
  let _onNavigate = null;
  function setOnNavigate(fn) { _onNavigate = fn; }

  function renderTags(hostEl, text, onChange) {
    const list = (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    hostEl.innerHTML = '';
    list.forEach(u => appendTag(hostEl, u, onChange));
    onChange?.();
  }

  function appendTag(hostEl, url, onChange) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.draggable = true;
    tag.dataset.url = url;

    // Thumbnail
    const thumb = document.createElement('img');
    thumb.className = 'tag-thumb';
    thumb.src = url;
    thumb.alt = '';
    thumb.loading = 'lazy';
    thumb.onerror = () => { thumb.style.display = 'none'; };

    // URL text
    const span = document.createElement('span');
    span.className = 'tag-url';
    span.title = url;
    span.textContent = shortenUrl(url);

    // Remove button
    const btn = document.createElement('button');
    btn.className = 'tag-remove';
    btn.type = 'button';
    btn.innerHTML = '&times;';
    btn.title = 'Remover';
    btn.addEventListener('click', () => { tag.remove(); onChange?.(); });

    // Click thumbnail or URL text to navigate to image in page
    const navigate = () => { _onNavigate?.(url); };
    thumb.addEventListener('click', navigate);
    span.addEventListener('click', navigate);

    tag.append(thumb, span, btn);

    // Drag & drop reorder
    tag.addEventListener('dragstart', e => {
      tag.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tag.addEventListener('dragend', () => {
      tag.classList.remove('dragging');
      onChange?.();
    });
    tag.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = hostEl.querySelector('.dragging');
      if (!dragging || dragging === tag) return;
      const rect = tag.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) hostEl.insertBefore(dragging, tag);
      else hostEl.insertBefore(dragging, tag.nextSibling);
    });

    hostEl.appendChild(tag);
  }

  function getTagUrls(hostEl) {
    return Array.from(hostEl.querySelectorAll('.tag')).map(t => t.dataset.url).filter(Boolean);
  }

  function shortenUrl(u) {
    if (!u) return '';
    const s = String(u);
    if (s.length <= 55) return s;
    return s.slice(0, 24) + '…' + s.slice(-24);
  }

  /* ---------- Persist selection ---------- */
  function persistSelection(html, url, selector) {
    chrome.storage.local.set({
      last_selection: { html, url: url || '', selector: selector || '', ts: Date.now() }
    }).catch(() => {});
  }

  return { getServerBase, getCurrentTab, loadObras, sendChapter, renderTags, appendTag, getTagUrls, shortenUrl, persistSelection, setOnNavigate };
})();
