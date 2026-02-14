/* ============================================================
   Leitor — UI Controller (ui.js)
   Toast notifications, dark mode, search, CRUD, status polling
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // --- Theme Toggle ---
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('leitor-theme', next);
    });
  }

  // --- Toast Notifications ---
  const toastIcons = {
    success: '<i class="bi bi-check-circle-fill toast-icon"></i>',
    error:   '<i class="bi bi-x-circle-fill toast-icon"></i>',
    info:    '<i class="bi bi-info-circle-fill toast-icon"></i>',
    warning: '<i class="bi bi-exclamation-triangle-fill toast-icon"></i>',
  };
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(message); return; }
    const toast = document.createElement('div');
    toast.className = `leitor-toast toast-${type}`;
    toast.innerHTML = `
      ${toastIcons[type] || toastIcons.info}
      <span class="toast-body">${message}</span>
      <button class="toast-close" aria-label="Fechar">&times;</button>
    `;
    container.appendChild(toast);
    const closeBtn = toast.querySelector('.toast-close');
    const remove = () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    };
    closeBtn.addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  }

  // --- Scroll-to-top button ---
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
    });
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // --- Search / Filter Obras on Index ---
  const searchInput = document.getElementById('searchObras');
  const obraGrid = document.getElementById('obraGrid');
  const noResults = document.getElementById('noSearchResults');
  if (searchInput && obraGrid) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const cards = Array.from(obraGrid.querySelectorAll('.obra-card'));
      let visible = 0;
      cards.forEach(card => {
        const title = card.dataset.obraTitle || '';
        const slug = card.dataset.obraSlug || '';
        const match = !q || title.includes(q) || slug.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (noResults) noResults.style.display = visible === 0 ? '' : 'none';
    });
  }

  // --- Create Obra ---
  const formObra = document.getElementById('form-new-obra');
  if (formObra) {
    formObra.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(formObra);
      const body = { title: fd.get('title') };
      try {
        const res = await fetch('/obras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
          showToast('Obra criada com sucesso!', 'success');
          setTimeout(() => location.reload(), 600);
        } else {
          showToast('Erro ao criar obra', 'error');
        }
      } catch (err) {
        showToast('Erro de conexão', 'error');
      }
    });
  }

  // --- Create Capitulo ---
  const formCap = document.getElementById('form-new-capitulo');
  if (formCap) {
    formCap.addEventListener('submit', async (e) => {
      e.preventDefault();
      const obraId = formCap.dataset.obraId;
      const fd = new FormData(formCap);
      const body = { number: fd.get('number'), link: fd.get('link'), html: fd.get('html') };
      try {
        const res = await fetch(`/obras/${obraId}/capitulos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
          showToast('Capítulo criado com sucesso!', 'success');
          setTimeout(() => location.reload(), 600);
        } else {
          showToast('Erro ao criar capítulo', 'error');
        }
      } catch (err) {
        showToast('Erro de conexão', 'error');
      }
    });
  }

  // --- Delete Obra ---
  document.querySelectorAll('.btn-delete-obra').forEach(btn => {
    btn.addEventListener('click', async () => {
      const obraId = btn.dataset.obraId;
      const ok = await showConfirm('Confirma excluir a obra e todos os seus capítulos e arquivos?');
      if (!ok) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/obras/${obraId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Obra excluída', 'success');
          setTimeout(() => { location.href = '/'; }, 600);
        } else {
          showToast('Erro ao excluir obra', 'error');
          btn.disabled = false;
        }
      } catch (err) {
        showToast('Erro de conexão', 'error');
        btn.disabled = false;
      }
    });
  });

  // --- Download images ---
  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', async () => {
      const capId = btn.dataset.capId;
      setBtnLoading(btn, true, 'Baixando...');
      const obraId = location.pathname.split('/').pop();
      const res = await fetch(`/obras/${obraId}/capitulos/${capId}/download`, { method: 'POST' });
      if (!res.ok) { showToast('Erro no download', 'error'); btn.disabled = false; return; }
      const progressWrap = document.getElementById(`progress-wrap-${capId}`);
      const progressEl = document.getElementById(`progress-${capId}`);
      if (progressWrap) { progressWrap.classList.remove('d-none'); progressWrap.parentElement.classList.remove('d-none'); }

      const poll = async () => {
        const s = await fetch(`/obras/${obraId}/capitulos/${capId}/status`);
        if (!s.ok) return;
        const data = await s.json();
        const { total, downloaded, failed } = data;
        const pct = total ? Math.round((downloaded / total) * 100) : 0;
        if (progressEl) { progressEl.style.width = pct + '%'; progressEl.textContent = pct + '%'; }
        if ((downloaded + failed) >= total) {
          if (failed > 0) showToast(`Download concluído com ${failed} falha(s)`, 'warning');
          else showToast('Download concluído!', 'success');
          setBtnLoading(btn, false);
          setTimeout(() => location.reload(), 800);
        } else {
          setTimeout(poll, 1000);
        }
      };
      poll();
    });
  });

  // --- Retry failed ---
  document.querySelectorAll('.btn-retry').forEach(btn => {
    btn.addEventListener('click', async () => {
      const capId = btn.dataset.capId;
      setBtnLoading(btn, true, 'Retry...');
      const obraId = location.pathname.split('/').pop();
      const res = await fetch(`/obras/${obraId}/capitulos/${capId}/retry`, { method: 'POST' });
      if (!res.ok) { showToast('Erro no retry', 'error'); btn.disabled = false; return; }
      const progressWrap = document.getElementById(`progress-wrap-${capId}`);
      const progressEl = document.getElementById(`progress-${capId}`);
      if (progressWrap) { progressWrap.classList.remove('d-none'); progressWrap.parentElement.classList.remove('d-none'); }

      const pollRetry = async () => {
        const s = await fetch(`/obras/${obraId}/capitulos/${capId}/status`);
        if (!s.ok) return;
        const data = await s.json();
        const { total, downloaded, failed } = data;
        const pct = total ? Math.round((downloaded / total) * 100) : 0;
        if (progressEl) { progressEl.style.width = pct + '%'; progressEl.textContent = pct + '%'; }
        if ((downloaded + failed) >= total) {
          showToast('Retry concluído', 'success');
          setBtnLoading(btn, false);
          setTimeout(() => location.reload(), 800);
        } else {
          setTimeout(pollRetry, 1000);
        }
      };
      pollRetry();
    });
  });

  // --- Delete Capitulo ---
  document.querySelectorAll('.btn-delete-cap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const capId = btn.dataset.capId;
      const obraId = btn.dataset.obraId;
      const ok = await showConfirm('Confirma excluir este capítulo e os arquivos associados?');
      if (!ok) return;
      setBtnLoading(btn, true, 'Excluindo...');
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Capítulo excluído', 'success');
          setTimeout(() => location.reload(), 600);
        } else {
          showToast('Erro ao excluir capítulo', 'error');
          setBtnLoading(btn, false);
        }
      } catch (err) {
        showToast('Erro de conexão', 'error');
        setBtnLoading(btn, false);
      }
    });
  });

  // --- Per-image retry ---
  document.querySelectorAll('.btn-retry-img').forEach(btn => {
    btn.addEventListener('click', async () => {
      const imgId = btn.dataset.imgId;
      const capId = btn.dataset.capId;
      const obraId = btn.dataset.obraId || location.pathname.split('/').pop();
      setBtnLoading(btn, true, 'Retry...');
      const statusContainer = btn.closest('li')?.querySelector('.img-status');
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/retry`, { method: 'POST' });
        if (!res.ok) throw new Error('retry_failed');
        const j = await res.json();
        const img = j.imagem;
        if (statusContainer) {
          statusContainer.innerHTML = img.status === 'downloaded'
            ? '<i class="bi bi-check-circle-fill text-success"></i>'
            : '<i class="bi bi-x-circle-fill text-danger"></i>';
        }
        showToast('Imagem reprocessada', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast('Erro ao refazer imagem', 'error');
      } finally {
        setBtnLoading(btn, false);
      }
    });
  });

  // --- Per-image delete ---
  document.querySelectorAll('.btn-delete-img').forEach(btn => {
    btn.addEventListener('click', async () => {
      const imgId = btn.dataset.imgId;
      const capId = btn.dataset.capId;
      const obraId = btn.dataset.obraId || location.pathname.split('/').pop();
      const ok = await showConfirm('Confirma excluir esta imagem?');
      if (!ok) return;
      setBtnLoading(btn, true, 'Excluindo...');
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete_failed');
        try { const li = btn.closest('li'); if (li) li.remove(); } catch (e) {}
        showToast('Imagem excluída', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast('Erro ao excluir imagem', 'error');
        setBtnLoading(btn, false);
      }
    });
  });

  // --- Per-image extract ---
  document.querySelectorAll('.btn-extract-img').forEach(btn => {
    btn.addEventListener('click', async () => {
      const imgId = btn.dataset.imgId;
      const capId = btn.dataset.capId;
      const obraId = btn.dataset.obraId || location.pathname.split('/').pop();
      setBtnLoading(btn, true, 'Extraindo...');
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/extract`, { method: 'POST' });
        if (!res.ok) throw new Error('extract_failed');
        showToast('Extração concluída', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast('Erro na extração', 'error');
      } finally {
        setBtnLoading(btn, false);
      }
    });
  });

  // --- Per-image translate ---
  document.querySelectorAll('.btn-translate-img').forEach(btn => {
    btn.addEventListener('click', async () => {
      const imgId = btn.dataset.imgId;
      const capId = btn.dataset.capId;
      const obraId = btn.dataset.obraId || location.pathname.split('/').pop();
      setBtnLoading(btn, true, 'Traduzindo...');
      try {
        const target = getCapTarget(capId);
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
        if (!res.ok) throw new Error('translate_failed');
        showToast('Tradução concluída', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast('Erro na tradução', 'error');
      } finally {
        setBtnLoading(btn, false);
      }
    });
  });

  // --- Cap-level extract ---
  document.querySelectorAll('.btn-extract-cap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const capId = btn.dataset.capId;
      const obraId = location.pathname.split('/').pop();
      setBtnLoading(btn, true, 'Extraindo capítulo...');
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}/extract`, { method: 'POST' });
        if (!res.ok) throw new Error('cap_extract_failed');
        showToast('Extração do capítulo concluída', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast('Erro ao extrair capítulo', 'error');
      } finally {
        setBtnLoading(btn, false);
      }
    });
  });

  // --- Cap-level translate ---
  document.querySelectorAll('.btn-translate-cap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const capId = btn.dataset.capId;
      const obraId = location.pathname.split('/').pop();
      setBtnLoading(btn, true, 'Traduzindo capítulo...');
      const container = document.getElementById(`cap-imgs-${capId}`);
      if (!container) { btn.disabled = false; return; }
      const imgBtns = Array.from(container.querySelectorAll('.btn-translate-img'));
      const target = getCapTarget(capId);
      for (const ib of imgBtns) {
        const imgId = ib.dataset.imgId;
        ib.disabled = true;
        try {
          await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
        } catch (err) {
          console.error('cap translate image error', err, imgId);
        } finally {
          ib.disabled = false;
        }
      }
      showToast('Tradução do capítulo concluída', 'success');
      setBtnLoading(btn, false);
      setTimeout(() => location.reload(), 600);
    });
  });

  // --- View Extractions Modal ---
  document.querySelectorAll('.btn-view-extractions').forEach(btn => {
    btn.addEventListener('click', async () => {
      const imgId = btn.dataset.imgId;
      const capId = btn.dataset.capId;
      const obraId = btn.dataset.obraId || location.pathname.split('/').pop();
      btn.disabled = true;
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/extractions`);
        if (!res.ok) throw new Error('fetch_extractions_failed');
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data && data.extractions) ? data.extractions : [];
        const body = document.getElementById('extractionsModalBody');
        body.innerHTML = '';
        if (!arr.length) {
          body.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-icon"><i class="bi bi-file-earmark"></i></div><div class="empty-title">Nenhuma extração</div></div>';
        } else {
          arr.forEach((ex, idx) => {
            const card = document.createElement('div');
            card.className = 'card mb-2';
            card.innerHTML = `<div class="card-body" style="padding:14px">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <strong style="font-size:0.82rem">#${idx+1}</strong>
                <span style="font-size:0.72rem; color:var(--text-muted)">conf: ${ex.confidence || '-'} · lang: ${ex.language || '-'}</span>
              </div>
              <p class="mb-1" style="font-size:0.85rem"><strong>Texto:</strong> ${escapeHtml(ex.text || '')}</p>
              <p class="mb-1" style="font-size:0.85rem"><strong>Traduzido:</strong> ${escapeHtml(ex.translatedText || '-')}</p>
              <pre class="mb-0" style="font-size:0.7rem; color:var(--text-muted); background:var(--border-color); padding:6px; border-radius:4px; overflow-x:auto">bbox: ${JSON.stringify(ex.bbox || {})}</pre>
            </div>`;
            body.appendChild(card);
          });
        }
        const modalEl = document.getElementById('extractionsModal');
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
      } catch (err) {
        showToast('Erro ao buscar extrações', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // --- Helpers ---
  function getCapTarget(capId) {
    const sel = document.querySelector(`.cap-lang-select[data-cap-id="${capId}"]`);
    return sel ? sel.value : 'pt-BR';
  }

  async function fetchExtractionsStatus(obraId, capId, imgId) {
    try {
      const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/extractions`);
      if (!res.ok) return { total: 0, translated: 0 };
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data && data.extractions) ? data.extractions : [];
      const total = arr.length;
      const translated = arr.filter(x => x.translatedText).length;
      return { total, translated };
    } catch (err) {
      return { total: 0, translated: 0 };
    }
  }

  function updateImgExtractionUI(imgId, st) {
    const exSpan = document.getElementById(`img-extraction-status-${imgId}`);
    const trSpan = document.getElementById(`img-translation-status-${imgId}`);
    if (exSpan) exSpan.textContent = `Ex: ${st.total}`;
    if (trSpan) trSpan.textContent = `Tr: ${st.translated}/${st.total}`;
  }

  // Initialize extraction/translation status for visible images
  document.querySelectorAll('[id^="img-extraction-status-"]').forEach(async (el) => {
    const id = el.id.replace('img-extraction-status-', '');
    const capEl = el.closest('.cap-collapse');
    const capId = capEl ? capEl.id.replace('cap-imgs-', '') : null;
    const obraId = location.pathname.split('/').pop();
    if (!capId) return;
    const st = await fetchExtractionsStatus(obraId, capId, id);
    updateImgExtractionUI(id, st);
  });

  // Cap-level action checks
  (function scheduleCapChecks(){
    const seen = new Set();
    document.querySelectorAll('[id^="img-extraction-status-"]').forEach(el => {
      const capEl = el.closest('.cap-collapse');
      const capId = capEl ? capEl.id.replace('cap-imgs-', '') : null;
      if (capId && !seen.has(capId)) {
        seen.add(capId);
        setTimeout(() => { try { checkAndToggleCapActions(capId); } catch (e) {} }, 300);
      }
    });
  })();

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]);
  }

  function setBtnLoading(btn, loading, text) {
    if (!btn) return;
    try {
      if (loading) {
        if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
        btn.disabled = true;
        const label = text || btn.innerText || '';
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${label}`;
      } else {
        btn.disabled = false;
        if (btn.dataset.origHtml) {
          btn.innerHTML = btn.dataset.origHtml;
          delete btn.dataset.origHtml;
        }
      }
    } catch (err) { /* ignore */ }
  }

  // Initialize cap status icons/progress
  document.querySelectorAll('[id^="progress-wrap-"]').forEach(el => {
    const capId = el.id.replace('progress-wrap-', '');
    updateCapStatus(capId);
  });

  async function updateCapStatus(capId) {
    try {
      const obraId = location.pathname.split('/').pop();
      const s = await fetch(`/obras/${obraId}/capitulos/${capId}/status`);
      if (!s.ok) return;
      const data = await s.json();
      const { total, downloaded, failed, pending } = data;
      const statusIconEl = document.getElementById(`status-icon-${capId}`);
      const progressWrap = document.getElementById(`progress-wrap-${capId}`);
      const progressEl = document.getElementById(`progress-${capId}`);
      const pct = total ? Math.round((downloaded / total) * 100) : 0;
      const mainIconEl = statusIconEl ? statusIconEl.querySelector('.cap-main-icon') : null;
      if ((pending && pending > 0) || (downloaded < total && total > 0)) {
        if (progressWrap) { progressWrap.classList.remove('d-none'); progressWrap.parentElement.classList.remove('d-none'); }
        if (progressEl) { progressEl.style.width = pct + '%'; progressEl.textContent = pct + '%'; }
        if (mainIconEl) mainIconEl.innerHTML = '';
      } else {
        if (progressWrap) { progressWrap.parentElement.classList.add('d-none'); }
        if (mainIconEl) {
          if (total === 0) mainIconEl.innerHTML = '<i class="bi bi-dash text-muted"></i>';
          else if (failed > 0) mainIconEl.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>';
          else if (downloaded === total) mainIconEl.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
          else mainIconEl.innerHTML = '<i class="bi bi-dash text-muted"></i>';
        }
      }
    } catch (err) { /* ignore */ }
  }

  async function checkAndToggleCapActions(capId) {
    try {
      const obraId = location.pathname.split('/').pop();
      const container = document.getElementById(`cap-imgs-${capId}`);
      if (!container) return;
      const imgEls = Array.from(container.querySelectorAll('[id^="img-extraction-status-"]'));
      if (!imgEls.length) return;
      const ids = imgEls.map(el => el.id.replace('img-extraction-status-', ''));
      const results = await Promise.all(ids.map(id => fetchExtractionsStatus(obraId, capId, id)));
      const allExtracted = results.length > 0 && results.every(r => r.total && r.total > 0);
      const allTranslated = results.length > 0 && results.every(r => r.total && r.translated && r.translated >= r.total);
      const controls = document.getElementById(`cap-controls-${capId}`);
      if (!controls) return;
      const select = controls.querySelector('.cap-lang-select');
      const translateBtn = controls.querySelector('.btn-translate-cap');
      const extractBtn = controls.querySelector('.btn-extract-cap');
      if (allExtracted) {
        if (select) select.style.display = '';
        if (translateBtn) translateBtn.style.display = '';
        if (extractBtn) extractBtn.style.display = 'none';
      } else {
        if (select) select.style.display = 'none';
        if (translateBtn) translateBtn.style.display = 'none';
        if (extractBtn) extractBtn.style.display = '';
      }
      if (allTranslated) {
        if (select) select.style.display = 'none';
        if (translateBtn) translateBtn.style.display = 'none';
      }
    } catch (err) { /* ignore */ }
  }

  function showConfirm(message) {
    return new Promise((resolve) => {
      const modalEl = document.getElementById('confirmModal');
      const msgEl = document.getElementById('confirmModalMessage');
      const okBtn = document.getElementById('confirmOk');
      const cancelBtn = document.getElementById('confirmCancel');
      if (!modalEl || !msgEl) return resolve(window.confirm(message));
      msgEl.textContent = message;
      const bsModal = new bootstrap.Modal(modalEl);
      const cleanup = () => {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
      };
      const onOk = () => { cleanup(); bsModal.hide(); resolve(true); };
      const onCancel = () => { cleanup(); bsModal.hide(); resolve(false); };
      const onHidden = () => { cleanup(); resolve(false); };
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modalEl.addEventListener('hidden.bs.modal', onHidden);
      bsModal.show();
    });
  }

  // Collapse caret rotation
  document.querySelectorAll('.cap-collapse').forEach((el) => {
    el.addEventListener('show.bs.collapse', () => {
      const btn = document.querySelector(`button[data-bs-target="#${el.id}"]`);
      if (btn) btn.querySelector('i')?.classList.add('rotated');
    });
    el.addEventListener('hide.bs.collapse', () => {
      const btn = document.querySelector(`button[data-bs-target="#${el.id}"]`);
      if (btn) btn.querySelector('i')?.classList.remove('rotated');
    });
  });

  // ===== Obra page: real-time polling for chapter updates =====
  (function initObraPolling() {
    const capSection = document.getElementById('capitulos');
    if (!capSection) return; // not on obra page
    const obraId = capSection.dataset.obraId;
    if (!obraId) return;

    // track known cap count to detect new chapters
    let knownCapCount = document.querySelectorAll('.cap-card').length;

    const POLL_INTERVAL = 5000; // 5 seconds

    async function pollCapitulos() {
      try {
        const res = await fetch(`/obras/${obraId}/capitulos/poll`);
        if (!res.ok) return;
        const data = await res.json();

        // new chapter added → full reload to render complete card
        if (data.totalCaps !== knownCapCount) {
          location.reload();
          return;
        }

        // update each chapter card in-place
        const caps = data.capitulos || [];

        // update summary bar totals
        let totalImgs = 0, totalDown = 0, totalExtracted = 0, totalTranslated = 0;

        caps.forEach(cap => {
          const s = cap._status || {};
          const ext = cap._extractions || {};
          const tr = cap._translations || {};
          totalImgs += s.total || 0;
          totalDown += s.downloaded || 0;
          totalExtracted += ext.imagesWithExtractions || 0;
          totalTranslated += tr.imagesWithTranslations || 0;

          // find the card
          const card = document.querySelector(`.btn-read-cap[data-cap-id="${cap.id}"]`);
          if (!card) return;
          const capCard = card.closest('.cap-card');
          if (!capCard) return;

          // --- Update "Ler" / "Lido" button ---
          if (cap.isRead) {
            card.classList.remove('btn-primary');
            card.classList.add('btn-secondary');
            const icon = card.querySelector('i');
            card.innerHTML = '';
            if (icon) card.appendChild(icon);
            card.appendChild(document.createTextNode(' Lido'));
          } else {
            card.classList.remove('btn-secondary');
            card.classList.add('btn-primary');
            const icon = card.querySelector('i');
            card.innerHTML = '';
            if (icon) card.appendChild(icon);
            card.appendChild(document.createTextNode(' Ler'));
          }

          // --- Update badges ---
          const badgeContainer = capCard.querySelector('.d-flex.align-items-center.gap-2.mb-2');
          if (!badgeContainer) return;

          // remove all existing status-badge elements (we'll re-render)
          badgeContainer.querySelectorAll('.status-badge').forEach(b => b.remove());

          const total = s.total || 0;
          const downloaded = s.downloaded || 0;
          const pending = s.pending || 0;
          const failed = s.failed || 0;

          // download status badge
          if (total === 0) {
            appendBadge(badgeContainer, 'badge-muted', '<i class="bi bi-dash"></i> Sem imagens');
          } else if (downloaded === total && failed === 0) {
            appendBadge(badgeContainer, 'badge-success', `<i class="bi bi-check-circle-fill"></i> ${downloaded}/${total}`);
          } else if (failed > 0) {
            appendBadge(badgeContainer, 'badge-danger', `<i class="bi bi-x-circle-fill"></i> ${failed} falha(s)`);
          } else if (pending > 0 || downloaded < total) {
            appendBadge(badgeContainer, 'badge-warning', `<i class="bi bi-clock-fill"></i> ${downloaded}/${total}`);
          }

          // pipeline status badge
          const ps = cap.pipelineStatus || 'idle';
          if (ps === 'downloading') {
            appendBadge(badgeContainer, 'badge-warning', '<i class="bi bi-cloud-arrow-down-fill"></i> Baixando…');
          } else if (ps === 'extracting') {
            appendBadge(badgeContainer, 'badge-info', '<i class="bi bi-cpu-fill"></i> Extraindo…');
          } else if (ps === 'error') {
            appendBadge(badgeContainer, 'badge-danger', '<i class="bi bi-exclamation-triangle-fill"></i> Pipeline erro');
          } else if (ps === 'done') {
            appendBadge(badgeContainer, 'badge-success', '<i class="bi bi-check-all"></i> Pipeline OK');
          }

          // extraction badge
          if (ext.allExtracted) {
            appendBadge(badgeContainer, 'badge-info', '<i class="bi bi-file-earmark-check"></i> Extraído');
          } else if ((ext.imagesWithExtractions || 0) > 0) {
            appendBadge(badgeContainer, 'badge-info', '<i class="bi bi-file-earmark-text"></i> Parcial');
          }

          // translation badge
          if (tr.allTranslated) {
            appendBadge(badgeContainer, 'badge-success', '<i class="bi bi-translate"></i> Traduzido');
          } else if ((tr.imagesWithTranslations || 0) > 0) {
            appendBadge(badgeContainer, 'badge-warning', '<i class="bi bi-translate"></i> Parcial');
          }

          // --- Update progress bar ---
          const progressEl = document.getElementById(`progress-${cap.id}`);
          const progressWrap = document.getElementById(`progress-wrap-${cap.id}`);
          if (progressEl && progressWrap) {
            const pct = total ? Math.round((downloaded / total) * 100) : 0;
            progressEl.style.width = pct + '%';
            progressEl.textContent = pct + '%';
            if (pending > 0 || (downloaded < total && total > 0)) {
              progressWrap.classList.remove('d-none');
              progressWrap.parentElement.classList.remove('d-none');
            } else {
              progressWrap.parentElement.classList.add('d-none');
            }
          }
        });

        // update summary bar
        updateSummaryValues(caps.length, totalImgs, totalDown, totalExtracted, totalTranslated);

      } catch (err) {
        // silent fail — next poll will retry
      }
    }

    function appendBadge(container, cls, html) {
      const span = document.createElement('span');
      span.className = `status-badge ${cls}`;
      span.innerHTML = html;
      container.appendChild(span);
    }

    function updateSummaryValues(totalCaps, totalImgs, totalDown, totalExtracted, totalTranslated) {
      const items = document.querySelectorAll('.summary-item');
      if (items.length >= 5) {
        items[0].querySelector('.summary-value').textContent = totalCaps;
        items[1].querySelector('.summary-value').textContent = totalImgs;
        items[2].querySelector('.summary-value').textContent = totalDown;
        items[3].querySelector('.summary-value').textContent = totalExtracted;
        items[4].querySelector('.summary-value').textContent = totalTranslated;
      }
    }

    // Start polling
    setInterval(pollCapitulos, POLL_INTERVAL);
  })();

});
