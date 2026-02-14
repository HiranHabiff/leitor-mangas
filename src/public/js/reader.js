/* ============================================================
   Leitor — Reader Controller (reader.js)
   Sidebar, keyboard shortcuts, fullscreen, progress, overlays
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* ---------- DOM references ---------- */
  const baseWidthPct = 50;
  const centerHCheck = document.getElementById('center-horizontal');
  const centerVCheck = document.getElementById('center-vertical');
  const widthRange = document.getElementById('reader-width');
  const widthValue = document.getElementById('widthValue');
  const images = Array.from(document.querySelectorAll('.reader-img'));
  const readerEl = document.getElementById('reader');

  const boxBgPicker = document.getElementById('box-bg-color');
  const textColorPicker = document.getElementById('text-color');
  const textBgPicker = document.getElementById('text-bg-color');

  const toggleOverlays = document.getElementById('toggle-overlays');
  const overlayOpacity = document.getElementById('overlay-opacity');

  const sidebar = document.getElementById('readerSidebar');
  const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const readerContent = document.querySelector('.reader-content');

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const kbdHelp = document.getElementById('kbdHelp');
  const showKbdHelp = document.getElementById('showKbdHelp');

  const progressText = document.getElementById('readerProgressText');

  let boxBgColor = boxBgPicker?.value || '#ffffff';
  let textColor = textColorPicker?.value || '#111111';
  let textBgColor = textBgPicker?.value || '#ffffff';

  let currentWidthPct = parseFloat(widthRange?.value) || baseWidthPct;

  /* ---------- Sidebar collapse/expand ---------- */
  function setSidebarCollapsed(collapsed) {
    if (!sidebar) return;
    if (collapsed) {
      sidebar.classList.add('collapsed');
      if (readerContent) readerContent.classList.add('expanded');
      if (sidebarToggle) sidebarToggle.classList.add('visible');
    } else {
      sidebar.classList.remove('collapsed');
      if (readerContent) readerContent.classList.remove('expanded');
      if (sidebarToggle) sidebarToggle.classList.remove('visible');
    }
    // reflow overlays after sidebar animation
    setTimeout(() => {
      images.forEach(img => { repositionOverlayForImg(img); updateBoxesForImg(img); });
      requestAnimationFrame(() => updateOverlayFonts());
    }, 350);
  }

  sidebarCollapseBtn?.addEventListener('click', () => setSidebarCollapsed(true));
  sidebarToggle?.addEventListener('click', () => setSidebarCollapsed(false));

  /* ---------- Fullscreen ---------- */
  fullscreenBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  /* ---------- Keyboard help ---------- */
  function toggleKbdHelp() { if (kbdHelp) kbdHelp.classList.toggle('visible'); }
  showKbdHelp?.addEventListener('click', toggleKbdHelp);

  /* ---------- Keyboard shortcuts ---------- */
  document.addEventListener('keydown', (e) => {
    // ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
      case 'ArrowLeft': {
        const url = readerEl?.dataset.prevCapUrl;
        if (url) window.location.href = url;
        break;
      }
      case 'ArrowRight': {
        const url = readerEl?.dataset.nextCapUrl;
        if (url) window.location.href = url;
        break;
      }
      case 't':
      case 'T':
        if (toggleOverlays) {
          toggleOverlays.checked = !toggleOverlays.checked;
          toggleOverlays.dispatchEvent(new Event('change'));
        }
        break;
      case 's':
      case 'S':
        if (sidebar) setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
        break;
      case 'f':
      case 'F':
        fullscreenBtn?.click();
        break;
      case 'Home':
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case '?':
        toggleKbdHelp();
        break;
      case 'Escape':
        if (kbdHelp?.classList.contains('visible')) { kbdHelp.classList.remove('visible'); }
        else if (sidebar && !sidebar.classList.contains('collapsed')) { setSidebarCollapsed(true); }
        break;
    }
  });

  /* ---------- Progress indicator (scroll-based) ---------- */
  const imageWraps = Array.from(document.querySelectorAll('.reader-image-wrap'));
  const totalImages = imageWraps.length;
  let lastProgress = 0;
  if (progressText) progressText.textContent = `0 / ${totalImages}`;

  if (totalImages > 0) {
    const updateProgress = () => {
      const viewportMid = window.scrollY + window.innerHeight * 0.4;
      let current = 0;
      for (let i = 0; i < imageWraps.length; i++) {
        const rect = imageWraps[i].getBoundingClientRect();
        const top = rect.top + window.scrollY;
        if (top <= viewportMid) current = i + 1;
        else break;
      }
      if (current !== lastProgress) {
        lastProgress = current;
        if (progressText) progressText.textContent = `${current} / ${totalImages}`;
      }
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ---------- Width slider ---------- */
  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(255,255,0,${alpha})`;
    const h = hex.replace('#','');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function applyStyles() {
    const widthPct = currentWidthPct || baseWidthPct;
    if (widthValue) widthValue.textContent = Math.round(widthPct);
    images.forEach(img => {
      const computedPct = Math.max(5, Math.min(300, Math.round(widthPct * 100) / 100));
      img.style.transition = 'none';
      img.style.width = computedPct + '%';
      img.style.objectFit = 'contain';
    });
    requestAnimationFrame(() => {
      images.forEach(img => {
        const wrap = img.closest('.reader-image-wrap');
        if (wrap) { repositionOverlayForImg(img); updateBoxesForImg(img); }
      });
      requestAnimationFrame(() => updateOverlayFonts());
    });
  }

  widthRange?.addEventListener('input', (e) => {
    currentWidthPct = parseFloat(e.target.value) || baseWidthPct;
    applyStyles();
  });

  /* ---------- Color pickers ---------- */
  boxBgPicker?.addEventListener('input', (e) => {
    boxBgColor = e.target.value;
    const alpha = (parseInt(overlayOpacity?.value||100,10)/100);
    document.querySelectorAll('.ex-overlay').forEach(box => box.style.background = hexToRgba(boxBgColor, alpha));
  });
  textColorPicker?.addEventListener('input', (e) => {
    textColor = e.target.value;
    document.querySelectorAll('.ex-overlay .ex-text').forEach(span => span.style.color = textColor);
  });
  textBgPicker?.addEventListener('input', (e) => {
    textBgColor = e.target.value;
    document.querySelectorAll('.ex-overlay .ex-text').forEach(span => span.style.background = textBgColor);
  });

  applyStyles();

  function setOverlayOpacity(val) {
    const alpha = (parseInt(val, 10) || 100) / 100;
    document.querySelectorAll('.ex-overlay').forEach(el => {
      el.style.background = hexToRgba(boxBgColor, alpha);
    });
  }
  overlayOpacity?.addEventListener('input', (e) => setOverlayOpacity(e.target.value));

  centerHCheck?.addEventListener('change', () => {
    applyCenteringToAll();
    requestAnimationFrame(() => updateOverlayFonts());
  });
  centerVCheck?.addEventListener('change', () => {
    applyCenteringToAll();
    requestAnimationFrame(() => updateOverlayFonts());
  });

  /* ---------- Load extractions for each image ---------- */
  async function loadExtractionsForImg(img) {
    const obraId = readerEl?.dataset.obraId;
    const capId = readerEl?.dataset.capId;
    if (!obraId || !capId) return;
    const imgId = img.dataset.imgId;
    const wrap = img.closest('.reader-image-wrap');
    const overlay = wrap && wrap.querySelector('.reader-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    repositionOverlayForImg(img);
    try {
      const res = await fetch(`/obras/${obraId}/capitulos/${capId}/imagens/${imgId}/extractions`);
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data && data.extractions) ? data.extractions : [];
      if (!arr.length) return;

      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      if (!naturalW || !naturalH) return;

      arr.forEach((ex) => {
        const bbox = ex.bbox || {};
        const verts = bbox.vertices || (bbox.boundingPoly && bbox.boundingPoly.vertices) || [];
        if (!verts || !verts.length) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        verts.forEach(v => {
          const x = (typeof v.x === 'number') ? v.x : 0;
          const y = (typeof v.y === 'number') ? v.y : 0;
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        });
        if (!isFinite(minX)) return;

        const box = document.createElement('div');
        box.className = 'ex-overlay';
        box.style.position = 'absolute';
        box.dataset.minx = minX; box.dataset.miny = minY;
        box.dataset.maxx = maxX; box.dataset.maxy = maxY;
        box.dataset.naturalw = naturalW; box.dataset.naturalh = naturalH;
        box.style.left = '0px'; box.style.top = '0px';
        box.style.width = '0px'; box.style.height = '0px';
        box.style.pointerEvents = 'auto';
        const alpha = (parseInt(overlayOpacity?.value||100,10)/100);
        box.style.background = hexToRgba(boxBgColor, alpha);

        const span = document.createElement('span');
        span.className = 'ex-text';
        span.textContent = ex.translatedText || ex.text || '';
        span.style.color = textColor;
        span.style.background = textBgColor || 'transparent';
        box.appendChild(span);

        // popover
        const pop = document.createElement('div');
        pop.className = 'ex-popover';
        pop.style.display = 'none'; pop.style.position = 'absolute';
        pop.style.zIndex = 9999; pop.style.pointerEvents = 'none';
        pop.textContent = ex.translatedText || ex.text || '';
        overlay.appendChild(pop);

        box.addEventListener('mouseenter', () => {
          try {
            pop.style.display = '';
            const overlayRect = overlay.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();
            const relLeft = boxRect.left - overlayRect.left + boxRect.width / 2;
            pop.style.left = '0px'; pop.style.top = '0px';
            pop.style.maxWidth = Math.min(800, overlayRect.width - 20) + 'px';
            requestAnimationFrame(() => {
              const popRect = pop.getBoundingClientRect();
              const desiredLeft = Math.round(relLeft - popRect.width / 2);
              const clampedLeft = Math.max(4, Math.min(desiredLeft, overlayRect.width - popRect.width - 4));
              let desiredTop = boxRect.top - overlayRect.top - popRect.height - 8;
              if (desiredTop < 0) desiredTop = boxRect.top - overlayRect.top + boxRect.height + 8;
              pop.style.left = clampedLeft + 'px';
              pop.style.top = Math.max(4, desiredTop) + 'px';
              pop.style.opacity = '1';
            });
          } catch (e) { /* ignore */ }
        });
        box.addEventListener('mouseleave', () => {
          try { pop.style.display = 'none'; pop.style.opacity = '0'; } catch (e) {}
        });

        box.style.fontSize = '12px'; box.style.padding = '2px';
        box.style.overflow = 'visible'; box.style.whiteSpace = 'normal';
        box.style.display = toggleOverlays && !toggleOverlays.checked ? 'none' : 'flex';
        box.style.alignItems = centerVCheck?.checked ? 'center' : 'flex-start';
        box.style.justifyContent = centerHCheck?.checked ? 'center' : 'flex-start';
        box.style.textAlign = centerHCheck?.checked ? 'center' : 'left';
        overlay.appendChild(box);
      });
      requestAnimationFrame(() => { updateBoxesForImg(img); updateOverlayFonts(); });
    } catch (err) {
      console.error('load extractions error', err);
    }
  }

  /* ---------- Box repositioning ---------- */
  function updateBoxesForImg(img) {
    const wrap = img.closest('.reader-image-wrap');
    if (!wrap) return;
    const overlay = wrap.querySelector('.reader-overlay');
    if (!overlay) return;
    const boxes = Array.from(overlay.querySelectorAll('.ex-overlay'));
    const displayedW = overlay.clientWidth || img.clientWidth || img.width;
    const displayedH = overlay.clientHeight || img.clientHeight || img.height;
    boxes.forEach(box => {
      try {
        const minX = parseFloat(box.dataset.minx || 0);
        const minY = parseFloat(box.dataset.miny || 0);
        const maxX = parseFloat(box.dataset.maxx || 0);
        const maxY = parseFloat(box.dataset.maxy || 0);
        const naturalW = parseFloat(box.dataset.naturalw || displayedW);
        const naturalH = parseFloat(box.dataset.naturalh || displayedH);
        box.style.left = Math.round((minX / naturalW) * displayedW) + 'px';
        box.style.top = Math.round((minY / naturalH) * displayedH) + 'px';
        box.style.width = Math.max(2, Math.round(((maxX - minX) / naturalW) * displayedW)) + 'px';
        box.style.height = Math.max(2, Math.round(((maxY - minY) / naturalH) * displayedH)) + 'px';
      } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Attach loaders ---------- */
  images.forEach(img => {
    if (img.complete && img.naturalWidth) loadExtractionsForImg(img);
    else img.addEventListener('load', () => loadExtractionsForImg(img));
  });

  /* ---------- Toggle overlays ---------- */
  toggleOverlays?.addEventListener('change', () => {
    const show = toggleOverlays.checked;
    document.querySelectorAll('.ex-overlay').forEach(el => el.style.display = show ? 'flex' : 'none');
  });

  setOverlayOpacity(overlayOpacity?.value || 100);

  /* ---------- Font fitting ---------- */
  function updateOverlayFonts() {
    const MIN_FONT = 12, MAX_FONT = 200;
    document.querySelectorAll('.ex-overlay').forEach(box => {
      try {
        const span = box.querySelector('.ex-text');
        if (!span) return;
        const style = window.getComputedStyle(box);
        const padH = (parseFloat(style.paddingLeft)||0) + (parseFloat(style.paddingRight)||0);
        const padV = (parseFloat(style.paddingTop)||0) + (parseFloat(style.paddingBottom)||0);
        const rect = box.getBoundingClientRect();
        const availW = Math.max(4, rect.width - padH);
        const availH = Math.max(4, rect.height - padV);
        span.style.display = 'inline-block'; span.style.whiteSpace = 'normal';
        span.style.width = availW + 'px'; span.style.lineHeight = '1';
        let lo = MIN_FONT, hi = MAX_FONT, best = MIN_FONT;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          span.style.fontSize = mid + 'px';
          if (span.scrollHeight <= availH + 0.1 && span.scrollWidth <= availW + 0.1) { best = mid; lo = mid + 1; }
          else hi = mid - 1;
        }
        const fs = Math.max(MIN_FONT, best);
        span.style.fontSize = fs + 'px';
        box.style.fontSize = fs + 'px';
        box.style.lineHeight = '1';
      } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Overlay positioning ---------- */
  function repositionOverlayForImg(img) {
    const wrap = img.closest('.reader-image-wrap');
    if (!wrap) return;
    const overlay = wrap.querySelector('.reader-overlay');
    if (!overlay) return;
    const imgRect = img.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    const scale = Math.min(img.clientWidth / naturalW, img.clientHeight / naturalH);
    const innerW = naturalW * scale;
    const innerH = naturalH * scale;
    const offsetX = Math.max(0, (img.clientWidth - innerW) / 2);
    const offsetY = Math.max(0, (img.clientHeight - innerH) / 2);
    const left = (imgRect.left - wrapRect.left) + offsetX;
    const top = (imgRect.top - wrapRect.top) + offsetY;
    overlay.style.position = 'absolute';
    overlay.style.left = Math.round(left) + 'px';
    overlay.style.top = Math.round(top) + 'px';
    overlay.style.width = Math.round(innerW) + 'px';
    overlay.style.height = Math.round(innerH) + 'px';
  }

  function applyCenteringToAll() {
    const centerH = centerHCheck?.checked;
    const centerV = centerVCheck?.checked;
    document.querySelectorAll('.ex-overlay').forEach(box => {
      box.style.alignItems = centerV ? 'center' : 'flex-start';
      box.style.justifyContent = centerH ? 'center' : 'flex-start';
      box.style.textAlign = centerH ? 'center' : 'left';
    });
  }

  /* ---------- Resize handler ---------- */
  window.addEventListener('resize', () => {
    images.forEach(img => { repositionOverlayForImg(img); updateBoxesForImg(img); });
    requestAnimationFrame(() => updateOverlayFonts());
  });
});
