const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const fs = require('fs').promises;

const { Obra, Capitulo, Imagem } = require('../models');
const { Extraction } = require('../models');
const { downloadCapituloImages } = require('../downloader');

// POST /obras/:obraId/capitulos
// body: { link, number }
router.post('/', async (req, res) => {
  try {
    const obraId = req.params.obraId;
    const { link, number } = req.body;
    if (!link) return res.status(400).json({ error: 'link is required' });

    const obra = await Obra.findByPk(obraId);
    if (!obra) return res.status(404).json({ error: 'obra_not_found' });

    // create capitulo
    const capitulo = await Capitulo.create({ number: number || null, link, obraId: obra.id });

    // create folder for chapter
    const chapterFolderName = number ? `cap_${String(number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${capitulo.id}`;
    const obraFolder = path.resolve(__dirname, '..', '..', 'obras', obra.slug);
    const capFolder = path.join(obraFolder, chapterFolderName);
    await fs.mkdir(capFolder, { recursive: true });

    return res.status(201).json({ capitulo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// endpoint to download images for a chapter
// POST /obras/:obraId/capitulos/:capituloId/download
router.post('/:capituloId/download', async (req, res) => {
  try {
    const capituloId = req.params.capituloId;
    await downloadCapituloImages(capituloId, { retry: 1 });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Download error', err);
    return res.status(500).json({ error: err.message || 'download_failed' });
  }
});

// retry failed images for a chapter
router.post('/:capituloId/retry', async (req, res) => {
  try {
    const capituloId = req.params.capituloId;
    const result = await require('../downloader').retryFailedImages(capituloId, { retry: 1, concurrency: 3 });
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('Retry error', err);
    return res.status(500).json({ error: err.message || 'retry_failed' });
  }
});

// POST /obras/:obraId/capitulos/:capituloId/imagens/:imagemId/extract
router.post('/:capituloId/imagens/:imagemId/extract', async (req, res) => {
  try {
    const { obraId, capituloId, imagemId } = req.params;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const img = await Imagem.findByPk(imagemId);
    if (!img || img.capituloId != cap.id) return res.status(404).json({ error: 'imagem_not_found' });

    const translator = require('../translator');
    const extractions = await translator.extractImageText(imagemId);
    return res.json({ ok: true, extractions });
  } catch (err) {
    console.error('extract error', err);
    return res.status(500).json({ error: err.message || 'extract_failed' });
  }
});

// POST /obras/:obraId/capitulos/:capituloId/imagens/:imagemId/translate
router.post('/:capituloId/imagens/:imagemId/translate', async (req, res) => {
  try {
    const { obraId, capituloId, imagemId } = req.params;
  // default to Brazilian Portuguese unless client specifies otherwise
  const target = req.body && req.body.target ? req.body.target : 'pt-BR';
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const img = await Imagem.findByPk(imagemId);
    if (!img || img.capituloId != cap.id) return res.status(404).json({ error: 'imagem_not_found' });

    // find extractions for this image
    const exts = await Extraction.findAll({ where: { imagemId } });
    if (!exts.length) return res.status(400).json({ error: 'no_extractions' });

    const translator = require('../translator');
    const ids = exts.map(e => e.id);
    const translated = await translator.translateExtractions(ids, target);
    return res.json({ ok: true, translated });
  } catch (err) {
    console.error('translate error', err);
    return res.status(500).json({ error: err.message || 'translate_failed' });
  }
});

// GET extractions for an image
router.get('/:capituloId/imagens/:imagemId/extractions', async (req, res) => {
  try {
    const { obraId, capituloId, imagemId } = req.params;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const img = await Imagem.findByPk(imagemId);
    if (!img || img.capituloId != cap.id) return res.status(404).json({ error: 'imagem_not_found' });

    const exts = await Extraction.findAll({ where: { imagemId } });
    return res.json({ ok: true, extractions: exts });
  } catch (err) {
    console.error('get extractions error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET image file for reader (stream filesystem file)
router.get('/:capituloId/imagens/:imagemId/file', async (req, res) => {
  try {
    const { obraId, capituloId, imagemId } = req.params;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const img = await Imagem.findByPk(imagemId);
    if (!img || img.capituloId != cap.id) return res.status(404).json({ error: 'imagem_not_found' });

    const obra = await require('../models').Obra.findByPk(obraId);
    if (!obra) return res.status(404).json({ error: 'obra_not_found' });

    const chapterFolderName = cap.number ? `cap_${String(cap.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${cap.id}`;
    const obraFolder = require('path').resolve(__dirname, '..', '..', 'obras', obra.slug);
    const pathMod = require('path');
    const filePath = pathMod.join(obraFolder, chapterFolderName, img.filename || '');
    const fsSync = require('fs');
    if (!img.filename || !fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: 'file_not_found' });
    }
    return res.sendFile(filePath);
  } catch (err) {
    console.error('file serve error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

// status endpoint for a chapter: total, downloaded, pending, failed
router.get('/:capituloId/status', async (req, res) => {
  try {
    const capituloId = req.params.capituloId;
    const imagens = await Imagem.findAll({ where: { capituloId } });
    const total = imagens.length;
    const downloaded = imagens.filter(i => i.status === 'downloaded').length;
    const pending = imagens.filter(i => i.status === 'pending').length;
    const failed = imagens.filter(i => i.status === 'failed').length;
    return res.json({ total, downloaded, pending, failed });
  } catch (err) {
    console.error('Status error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Server-side cap-level extract: extract text for all images in a chapter sequentially
// POST /obras/:obraId/capitulos/:capituloId/extract
router.post('/:capituloId/extract', async (req, res) => {
  try {
    const { obraId, capituloId } = req.params;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const imagens = await Imagem.findAll({ where: { capituloId: cap.id }, order: [['order','ASC']] });
    const translator = require('../translator');
    const results = [];
    for (const img of imagens) {
      try {
        const exts = await translator.extractImageText(img.id);
        results.push({ imagemId: img.id, extracted: Array.isArray(exts) ? exts.length : 0 });
      } catch (e) {
        console.error('cap extract error for image', img.id, e);
        results.push({ imagemId: img.id, error: (e && e.message) || 'extract_error' });
      }
    }
    return res.json({ ok: true, results });
  } catch (err) {
    console.error('cap-level extract error', err);
    return res.status(500).json({ error: err.message || 'extract_failed' });
  }
});

// DELETE /obras/:obraId/capitulos/:capituloId -> delete capitulo, imagens and chapter folder
router.delete('/:capituloId', async (req, res) => {
  try {
    const capituloId = req.params.capituloId;
    const obraId = req.params.obraId;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });

    const obra = await Obra.findByPk(obraId);
    if (!obra) return res.status(404).json({ error: 'obra_not_found' });

    const chapterFolderName = cap.number ? `cap_${String(cap.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${cap.id}`;
    const obraFolder = path.resolve(__dirname, '..', '..', 'obras', obra.slug);
    const capFolder = path.join(obraFolder, chapterFolderName);
    try {
      await fs.rm(capFolder, { recursive: true, force: true });
    } catch (fsErr) {
      console.warn('Could not remove cap folder:', fsErr.message || fsErr);
    }

    await Imagem.destroy({ where: { capituloId: cap.id } });
    await Capitulo.destroy({ where: { id: cap.id } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('delete capitulo error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /obras/:obraId/capitulos/:capituloId/imagens/:imagemId/retry
router.post('/:capituloId/imagens/:imagemId/retry', async (req, res) => {
  try {
    const { obraId, capituloId, imagemId } = req.params;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const img = await Imagem.findByPk(imagemId);
    if (!img || img.capituloId != cap.id) return res.status(404).json({ error: 'imagem_not_found' });

    const result = await require('../downloader').downloadSingleImage(imagemId, { retry: 1 });
    return res.json({ ok: true, imagem: result });
  } catch (err) {
    console.error('single image retry error', err);
    return res.status(500).json({ error: err.message || 'retry_failed' });
  }
});

// DELETE /obras/:obraId/capitulos/:capituloId/imagens/:imagemId
router.delete('/:capituloId/imagens/:imagemId', async (req, res) => {
  try {
    const { obraId, capituloId, imagemId } = req.params;
    const cap = await Capitulo.findOne({ where: { id: capituloId, obraId } });
    if (!cap) return res.status(404).json({ error: 'capitulo_not_found' });
    const img = await Imagem.findByPk(imagemId);
    if (!img || img.capituloId != cap.id) return res.status(404).json({ error: 'imagem_not_found' });

    const obra = await Obra.findByPk(obraId);
    if (!obra) return res.status(404).json({ error: 'obra_not_found' });

    // attempt to remove file from disk if present
    try {
      if (img.filename) {
        const chapterFolderName = cap.number ? `cap_${String(cap.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${cap.id}`;
        const obraFolder = path.resolve(__dirname, '..', '..', 'obras', obra.slug);
        const filePath = path.join(obraFolder, chapterFolderName, img.filename || '');
        await fs.unlink(filePath).catch(() => {});
      }
    } catch (fsErr) {
      console.warn('Could not remove image file:', fsErr && fsErr.message ? fsErr.message : fsErr);
    }

    // remove extractions related to this image, then the image record
    try { await Extraction.destroy({ where: { imagemId: img.id } }); } catch (e) { /* ignore */ }
    await Imagem.destroy({ where: { id: img.id } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('delete imagem error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /obras/:obraId/capitulos/poll — lightweight polling for real-time chapter updates
router.get('/poll', async (req, res) => {
  try {
    const obraId = req.params.obraId;
    const capitulos = await Capitulo.findAll({
      where: { obraId },
      include: [{ model: Imagem, as: 'Imagens' }],
      order: [[require('sequelize').literal('CAST("number" AS INTEGER)'), 'DESC'], ['id', 'DESC']]
    });

    const result = [];
    for (const cap of capitulos) {
      const imagens = cap.Imagens || [];
      const total = imagens.length;
      const downloaded = imagens.filter(i => i.status === 'downloaded').length;
      const pending = imagens.filter(i => i.status === 'pending').length;
      const failed = imagens.filter(i => i.status === 'failed').length;

      // extraction / translation counts
      let imagesWithExtractions = 0, allExtracted = false;
      let imagesWithTranslations = 0, allTranslated = false;
      if (total > 0) {
        const imgIds = imagens.map(i => i.id);
        const exts = await Extraction.findAll({ where: { imagemId: imgIds } });
        const extSet = new Set(exts.map(e => e.imagemId));
        const trSet = new Set(exts.filter(e => e.translatedText).map(e => e.imagemId));
        imagesWithExtractions = extSet.size;
        imagesWithTranslations = trSet.size;
        allExtracted = imagesWithExtractions === total;
        allTranslated = imagesWithTranslations === total;
      }

      result.push({
        id: cap.id,
        number: cap.number,
        link: cap.link,
        pipelineStatus: cap.pipelineStatus || 'idle',
        isRead: !!cap.isRead,
        _status: { total, downloaded, pending, failed },
        _extractions: { imagesWithExtractions, allExtracted },
        _translations: { imagesWithTranslations, allTranslated }
      });
    }

    return res.json({ totalCaps: result.length, capitulos: result });
  } catch (err) {
    console.error('poll error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
