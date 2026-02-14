/* pipeline.js — Automatic post-submit pipeline
   Chains: download images → extract text (OCR)
   Runs in background (fire-and-forget), never blocks the API response. */

const { Capitulo, Imagem } = require('./models');
const { downloadCapituloImages, allDownloaded } = require('./downloader');
const { extractImageText } = require('./translator');

/**
 * Run the automatic pipeline for a newly submitted chapter.
 * Called without await (fire-and-forget) from the API route.
 *
 * Flow:
 *   1. Download all images (concurrency 3, retry 1)
 *   2. Check if ALL images downloaded successfully
 *   3. If yes → extract text (OCR) from each image sequentially
 *   4. Update capitulo.pipelineStatus at each stage
 *
 * @param {number} capituloId
 */
async function runAfterSubmit(capituloId) {
  const label = `[pipeline cap=${capituloId}]`;
  let cap;
  try {
    cap = await Capitulo.findByPk(capituloId);
    if (!cap) { console.error(label, 'capitulo not found'); return; }

    // ── Step 1: Download ───────────────────────────────
    console.log(label, 'starting download…');
    cap.pipelineStatus = 'downloading';
    await cap.save();

    await downloadCapituloImages(capituloId, { retry: 2, concurrency: 3 });

    // ── Step 2: Verify downloads ───────────────────────
    const ok = await allDownloaded(capituloId);
    if (!ok) {
      const failed = await Imagem.count({ where: { capituloId, status: 'failed' } });
      console.warn(label, `download incomplete — ${failed} image(s) failed`);
      cap.pipelineStatus = 'error';
      await cap.save();
      return;
    }
    console.log(label, 'all images downloaded');

    // ── Step 3: Extract text (OCR) ─────────────────────
    cap.pipelineStatus = 'extracting';
    await cap.save();

    const images = await Imagem.findAll({
      where: { capituloId, status: 'downloaded' },
      order: [['order', 'ASC']]
    });

    let extractedCount = 0;
    for (const img of images) {
      try {
        await extractImageText(img.id);
        extractedCount++;
        console.log(label, `extracted ${extractedCount}/${images.length} (img ${img.id})`);
      } catch (err) {
        // Log but continue with remaining images
        console.error(label, `extraction failed for img ${img.id}:`, err.message);
      }
    }

    // ── Done ───────────────────────────────────────────
    cap.pipelineStatus = 'done';
    await cap.save();
    console.log(label, `pipeline complete — ${extractedCount}/${images.length} extracted`);

  } catch (err) {
    console.error(label, 'pipeline error:', err);
    try {
      if (cap) { cap.pipelineStatus = 'error'; await cap.save(); }
    } catch (e) { /* ignore save error */ }
  }
}

module.exports = { runAfterSubmit };
