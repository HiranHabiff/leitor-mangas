const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

const { Obra, Capitulo, Imagem } = require('../models');
const { runAfterSubmit } = require('../pipeline');

// POST /api/chapters/submit
// body: { obra_id, capitulo_numero, url, imagens_url: [] }
router.post('/chapters/submit', async (req, res) => {
  try {
    const { obra_id, capitulo_numero, url, imagens_url } = req.body || {};
    if (!obra_id) return res.status(400).json({ error: 'obra_id is required' });
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (!Array.isArray(imagens_url)) return res.status(400).json({ error: 'imagens_url must be an array' });

    // find obra by id or slug
    let obra = null;
    if (Number(obra_id)) {
      obra = await Obra.findByPk(obra_id);
    }
    if (!obra) {
      obra = await Obra.findOne({ where: { slug: obra_id } });
    }
    if (!obra) return res.status(404).json({ error: 'obra_not_found' });

    // create capitulo
    const capitulo = await Capitulo.create({ number: capitulo_numero || null, link: url, obraId: obra.id });

    // create folder for chapter on disk (mirror existing behavior)
    const chapterFolderName = capitulo.number ? `cap_${String(capitulo.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${capitulo.id}`;
    const obraFolder = path.resolve(__dirname, '..', '..', 'obras', obra.slug);
    const capFolder = path.join(obraFolder, chapterFolderName);
    try { await fs.mkdir(capFolder, { recursive: true }); } catch (e) { /* ignore */ }

    // create image records
    const images = [];
    for (let i = 0; i < imagens_url.length; i++) {
      const u = imagens_url[i];
      const img = await Imagem.create({ filename: '', order: i + 1, url: u, status: 'pending', capituloId: capitulo.id });
      images.push(img);
    }

    // Fire-and-forget: start download → extraction pipeline in background
    runAfterSubmit(capitulo.id).catch(err => console.error('pipeline fire-and-forget error', err));

    return res.status(201).json({ capitulo, images });
  } catch (err) {
    console.error('api/chapters/submit error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
