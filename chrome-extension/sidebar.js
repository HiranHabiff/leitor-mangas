/* sidebar.js — Leitor Side Panel logic
   Uses Leitor.* utilities from shared.js */

const $ = id => document.getElementById(id);

/* ── State ─────────────────────────────────────────── */
let lastSelector = null;

/* ── Init ──────────────────────────────────────────── */
async function init() {
  const obraSel   = $('obra');
  const capIn     = $('capitulo');
  const urlIn     = $('url');
  const imgList   = $('image-list');
  const imgCount  = $('img-count');
  const sendBtn   = $('btn-send');
  const statusEl  = $('status');

  // --- Load obras ---
  await Leitor.loadObras(obraSel, setStatus);

  // --- Populate URL from active tab ---
  await refreshUrl();

  // --- Restore last selection ---
  try {
    const s = await chrome.storage.local.get('last_selection');
    if (s?.last_selection?.html) {
      Leitor.renderTags(imgList, s.last_selection.html, onTagsChanged);
      lastSelector = s.last_selection.selector || null;
      setStatus('Seleção anterior carregada', 'success');
    }
  } catch {}

  // --- Navigate to image on click ---
  Leitor.setOnNavigate(async (url) => {
    const tab = await Leitor.getCurrentTab();
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { action: 'scroll-to-image', url });
  });

  // --- Wire events ---
  obraSel.addEventListener('change', () => {
    const idx = obraSel.selectedIndex;
    const name = idx >= 0 ? obraSel.options[idx].textContent : '';
    chrome.storage.local.set({ default_obra: { id: obraSel.value, name } }).catch(() => {});
  });

  $('btn-select').addEventListener('click', startSelect);
  $('btn-refresh').addEventListener('click', refreshSelection);
  $('btn-clear').addEventListener('click', () => {
    imgList.innerHTML = '';
    lastSelector = null;
    onTagsChanged();
    setStatus('Lista limpa');
  });

  $('refresh-url').addEventListener('click', async () => {
    await refreshUrl();
    setStatus('URL atualizada', 'success');
  });

  sendBtn.addEventListener('click', doSend);

  // --- Settings panel ---
  const settingsPanel = $('settings-panel');
  const serverInput   = $('server-base');

  $('btn-settings').addEventListener('click', async () => {
    const hidden = settingsPanel.hidden;
    settingsPanel.hidden = !hidden;
    if (!hidden) return;
    const base = await Leitor.getServerBase();
    serverInput.value = base;
  });

  $('btn-close-settings').addEventListener('click', () => { settingsPanel.hidden = true; });

  $('btn-save-settings').addEventListener('click', async () => {
    const val = serverInput.value.trim().replace(/\/+$/, '');
    if (!val) return;
    await chrome.storage.sync.set({ leitor_server_base: val });
    settingsPanel.hidden = true;
    setStatus('Servidor salvo: ' + val, 'success');
    await Leitor.loadObras(obraSel, setStatus);
  });

  // --- Auto-refresh URL on tab changes ---
  try {
    chrome.tabs.onActivated.addListener(() => refreshUrl());
    chrome.tabs.onUpdated.addListener((_id, info) => {
      if (info?.status === 'complete' || info?.url) refreshUrl();
    });
  } catch {}

  // --- Listen for content script messages ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;

    // Selection completed by content script
    if (msg.action === 'selected' && msg.html) {
      Leitor.renderTags(imgList, msg.html, onTagsChanged);
      lastSelector = msg.selector || null;
      if (msg.url) urlIn.value = msg.url;
      setStatus('Container selecionado', 'success');
    }

    // SPA navigation detected
    if (msg.action === 'page-url-changed' && msg.url) {
      urlIn.value = msg.url;
    }
  });
}

/* ── URL helpers ───────────────────────────────────── */
async function refreshUrl() {
  const tab = await Leitor.getCurrentTab();
  if (!tab) return;
  try {
    chrome.tabs.sendMessage(tab.id, { action: 'get-page-url' }, resp => {
      if (!chrome.runtime.lastError && resp?.url) $('url').value = resp.url;
      else if (tab.url) $('url').value = tab.url;
    });
  } catch { if (tab.url) $('url').value = tab.url; }
}

/* ── Selection ─────────────────────────────────────── */
async function startSelect() {
  const tab = await Leitor.getCurrentTab();
  if (!tab) return setStatus('Aba ativa não encontrada', 'error');
  chrome.tabs.sendMessage(tab.id, { action: 'start-select' }, resp => {
    if (chrome.runtime.lastError) setStatus('Erro: ' + chrome.runtime.lastError.message, 'error');
    else setStatus('Clique no container de imagens na página', 'loading');
  });
}

async function refreshSelection() {
  if (!lastSelector) return setStatus('Nenhuma seleção para atualizar', 'error');
  const tab = await Leitor.getCurrentTab();
  if (!tab) return setStatus('Aba ativa não encontrada', 'error');
  chrome.tabs.sendMessage(tab.id, { action: 'refresh-selection', selector: lastSelector }, resp => {
    if (chrome.runtime.lastError) {
      setStatus('Erro: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    if (resp?.ok && resp.html) {
      Leitor.renderTags($('image-list'), resp.html, onTagsChanged);
      lastSelector = resp.selector || lastSelector;
      if (resp.url) $('url').value = resp.url;
      setStatus(`Lista atualizada — ${resp.count || 0} imagens`, 'success');
    } else if (resp?.error) {
      setStatus('Erro: ' + resp.error, 'error');
    } else {
      setStatus('Lista atualizada', 'success');
    }
  });
}

/* ── Send Chapter ──────────────────────────────────── */
async function doSend() {
  const sendBtn = $('btn-send');
  const urls = Leitor.getTagUrls($('image-list'));
  sendBtn.classList.add('loading');
  sendBtn.disabled = true;

  const ok = await Leitor.sendChapter({
    obraId: $('obra').value,
    capNumber: $('capitulo').value,
    url: $('url').value,
    imageUrls: urls
  }, setStatus);

  sendBtn.classList.remove('loading');
  updateSendEnabled();

  if (ok) {
    // Auto-increment chapter number
    const cap = $('capitulo');
    cap.value = (parseInt(cap.value, 10) || 0) + 1;
  }
}

/* ── Tag list change handler ───────────────────────── */
function onTagsChanged() {
  const count = Leitor.getTagUrls($('image-list')).length;
  $('img-count').textContent = count;
  updateSendEnabled();
}

function updateSendEnabled() {
  const hasObra = !!$('obra').value;
  const hasCap  = !!$('capitulo').value;
  const hasImgs = Leitor.getTagUrls($('image-list')).length > 0;
  $('btn-send').disabled = !(hasObra && hasCap && hasImgs);
}

/* ── Status helper ─────────────────────────────────── */
function setStatus(msg, kind) {
  const el = $('status');
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
  el.hidden = !msg;
  // Auto-hide success messages
  if (kind === 'success') setTimeout(() => { if (el.textContent === msg) { el.hidden = true; } }, 4000);
}

// --- Enable/disable send reactively ---
document.addEventListener('DOMContentLoaded', () => {
  init();
  // Also wire change events for validation
  $('obra')?.addEventListener('change', updateSendEnabled);
  $('capitulo')?.addEventListener('input', updateSendEnabled);
});

