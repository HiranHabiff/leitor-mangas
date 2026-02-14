const express = require('express');
const router = express.Router();
const { Obra, Capitulo, Imagem, Extraction, sequelize } = require('../models');

// Home - list obras with simple pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(5, parseInt(req.query.limit || '10', 10));
    const offset = (page - 1) * limit;

    const { count, rows } = await Obra.findAndCountAll({ order: [['createdAt','DESC']], limit, offset });
    const totalPages = Math.ceil(count / limit) || 1;
    res.render('index', { obras: rows, currentPage: page, totalPages, limit });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// View obra and chapters
router.get('/obra/:id', async (req, res) => {
  try {
  // explicitly include images using the 'Imagens' alias
    const obra = await Obra.findByPk(req.params.id);
    if (!obra) return res.status(404).send('Obra não encontrada');

    // fetch capitulos ordered in the database: try numeric order by `number`, fallback to id
    // We use CAST to coerce numeric strings for ordering; then id desc as tiebreaker
    const capitulos = await Capitulo.findAll({
      where: { obraId: obra.id },
      include: [{ model: Imagem, as: 'Imagens' }],
      order: [[sequelize.literal('CAST("number" AS INTEGER)'), 'DESC'], ['id', 'DESC']]
    });

    // compute status summary + extraction/translation summary for each capitulo
    if (capitulos && capitulos.length) {
      // debug: log how many images were included per capítulo (helps diagnose missing images)
      try {
        console.log('DEBUG: capitulos fetched for obra', obra.id, 'count=', capitulos.length);
        capitulos.forEach(c => console.log(`DEBUG: cap id=${c.id} imagens=${(c.Imagens||[]).length}`));
      } catch (dbgErr) {
        // ignore debug logging errors
      }

      const enriched = [];
      for (const cap of capitulos) {
        const imagens = cap.Imagens || [];
        const total = imagens.length;
        const downloaded = imagens.filter(i => i.status === 'downloaded').length;
        const pending = imagens.filter(i => i.status === 'pending').length;
        const failed = imagens.filter(i => i.status === 'failed').length;
        cap.dataValues._status = { total, downloaded, pending, failed };

        // gather extraction/translation info for images in this capítulo
        if (imagens && imagens.length) {
          const imgIds = imagens.map(i => i.id);
          // fetch extractions for any of these images
          const exts = await Extraction.findAll({ where: { imagemId: imgIds } });
          const imgsWithExt = new Set(exts.map(e => e.imagemId));
          // images with at least one translatedText
          const imgsWithTranslated = new Set(exts.filter(e => e.translatedText).map(e => e.imagemId));

          // annotate each image for template convenience
          imagens.forEach(img => {
            img.dataValues._extracted = imgsWithExt.has(img.id);
            img.dataValues._translated = imgsWithTranslated.has(img.id);
          });

          const imagesWithExtractions = imgsWithExt.size;
          const imagesWithTranslations = imgsWithTranslated.size;
          const allExtracted = (total > 0) && (imagesWithExtractions === total);
          const allTranslated = (total > 0) && (imagesWithTranslations === total);
          cap.dataValues._extractions = { imagesWithExtractions, allExtracted, totalExtractions: exts.length };
          cap.dataValues._translations = { imagesWithTranslations, allTranslated };
          try {
            console.log(`DEBUG: cap ${cap.id} extractions=${JSON.stringify(cap.dataValues._extractions)} translations=${JSON.stringify(cap.dataValues._translations)}`);
          } catch (e) {
            // ignore
          }
        } else {
          cap.dataValues._extractions = { imagesWithExtractions: 0, allExtracted: false, totalExtractions: 0 };
          cap.dataValues._translations = { imagesWithTranslations: 0, allTranslated: false };
        }

        enriched.push(cap);
      }
      obra.Capitulos = enriched;
    } else {
      obra.Capitulos = [];
    }

    res.render('obra', { obra });
  } catch (err) {
    res.status(500).send('Erro interno');
  }
});

// Reader view for a chapter
router.get('/obra/:id/cap/:capId/reader', async (req, res) => {
  try {
    const obra = await Obra.findByPk(req.params.id);
    if (!obra) return res.status(404).send('Obra não encontrada');
  const cap = await Capitulo.findOne({ where: { id: req.params.capId, obraId: obra.id } });
  if (!cap) return res.status(404).send('Capítulo não encontrado');

  // Mark chapter as read
  if (!cap.isRead) {
    await cap.update({ isRead: true });
  }

  const imagens = await Imagem.findAll({ where: { capituloId: cap.id }, order: [['order','ASC']] });

  // fetch all chapters for prev/next navigation
  const allCaps = await Capitulo.findAll({
    where: { obraId: obra.id },
    order: [[sequelize.literal('CAST("number" AS INTEGER)'), 'ASC'], ['id', 'ASC']],
    attributes: ['id', 'number']
  });
  const capIdx = allCaps.findIndex(c => c.id === cap.id);
  const prevCap = capIdx > 0 ? allCaps[capIdx - 1] : null;
  const nextCap = capIdx < allCaps.length - 1 ? allCaps[capIdx + 1] : null;

    res.render('reader', { obra, cap, imagens, prevCap, nextCap });
  } catch (err) {
    console.error('reader route error', err);
    res.status(500).send('Erro interno');
  }
});

module.exports = router;
