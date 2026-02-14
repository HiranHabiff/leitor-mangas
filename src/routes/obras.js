const express = require('express');
const router = express.Router();
const slugify = require('slugify');
const path = require('path');
const fs = require('fs').promises;

const { Obra, Capitulo, Imagem } = require('../models');

// Criar obra
// body: { title }
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const slug = slugify(title, { lower: true, strict: true });

    // cria registro no banco
    const [obra, created] = await Obra.findOrCreate({ where: { slug }, defaults: { title, slug } });

    // cria pasta em obras/<slug>
    const obraFolder = path.resolve(__dirname, '..', '..', 'obras', slug);
    await fs.mkdir(obraFolder, { recursive: true });

    return res.status(created ? 201 : 200).json({ obra });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Listar obras (GET /obras)
router.get('/', async (req, res) => {
  try {
    const obras = await Obra.findAll({ order: [['createdAt','DESC']] });
    return res.json({ obras });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Get obra com capitulos (GET /obras/:id)
router.get('/:id', async (req, res) => {
  try {
    const obra = await Obra.findByPk(req.params.id, { include: { all: true } });
    if (!obra) return res.status(404).json({ error: 'not_found' });
    return res.json({ obra });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /obras/:id  -> delete obra, its capitulos, imagens and filesystem folder
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const obra = await Obra.findByPk(id);
    if (!obra) return res.status(404).json({ error: 'not_found' });

    // remove files on disk
    const obraFolder = path.resolve(__dirname, '..', '..', 'obras', obra.slug);
    try {
      await fs.rm(obraFolder, { recursive: true, force: true });
    } catch (fsErr) {
      // log and continue
      console.warn('Could not fully remove obra folder:', fsErr.message || fsErr);
    }

    // remove DB records (images -> capitulos -> obra)
    const capitulos = await Capitulo.findAll({ where: { obraId: obra.id } });
    for (const c of capitulos) {
      await Imagem.destroy({ where: { capituloId: c.id } });
    }
    await Capitulo.destroy({ where: { obraId: obra.id } });
    await Obra.destroy({ where: { id: obra.id } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('delete obra error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
