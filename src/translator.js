const fs = require('fs');
const path = require('path');
const { Imagem, Extraction } = require('./models');

let visionClient = null;
let translateClient = null;

function ensureClients() {
  if (visionClient && translateClient) return;
  try {
    const vision = require('@google-cloud/vision');
    const { v2 } = require('@google-cloud/translate');
    visionClient = new vision.ImageAnnotatorClient();
    translateClient = new v2.Translate();
  } catch (e) {
    throw new Error('google_clients_not_installed_or_configured: ' + e.message);
  }
}

// Extract text blocks from an image using Cloud Vision
async function extractImageText(imagemId, options = { mode: 'DOCUMENT_TEXT_DETECTION' }) {
  const img = await Imagem.findByPk(imagemId);
  if (!img) throw new Error('imagem_not_found');

  ensureClients();

  // Support images stored locally or by URL
  const request = {};
  if (img.url && img.url.startsWith('http')) {
    request.image = { source: { imageUri: img.url } };
  } else {
    // local file
    const filePath = path.resolve(__dirname, '..', 'obras', img.filename || '');
    const content = fs.readFileSync(filePath);
    request.image = { content: content.toString('base64') };
  }
  request.features = [{ type: options.mode }];

  const [result] = await visionClient.annotateImage(request);
  // result.fullTextAnnotation or textAnnotations depending on mode
  const annotations = result.fullTextAnnotation || result.textAnnotations || {};

  // Parse blocks/paragraphs/words into extractions. We'll use 'pages.blocks' if available.
  const blocks = [];
  if (result.fullTextAnnotation && result.fullTextAnnotation.pages) {
    result.fullTextAnnotation.pages.forEach(page => {
      (page.blocks || []).forEach(block => {
        const text = (block.paragraphs || []).map(p => (p.words || []).map(w => (w.symbols||[]).map(s=>s.text).join('')).join(' ')).join('\n');
        const bbox = block.boundingBox || null;
        blocks.push({ text, bbox, confidence: block.confidence || null });
      });
    });
  } else if (result.textAnnotations && result.textAnnotations.length) {
    // first element is full text
    const full = result.textAnnotations[0];
    blocks.push({ text: full.description || '', bbox: full.boundingPoly || null, confidence: null });
  }

  // Persist blocks as extractions
  const created = [];
  for (const b of blocks) {
    const ex = await Extraction.create({ imagemId: img.id, bbox: b.bbox, text: b.text, confidence: b.confidence, language: null, status: 'done' });
    created.push(ex);
  }

  return created;
}

// Translate an array of extractions (by ids) into targetLang using Translation API v2
async function translateExtractions(extractionIds, targetLang = 'pt-BR') {
  ensureClients();
  const exts = await Extraction.findAll({ where: { id: extractionIds } });
  const texts = exts.map(e => e.text || '');
  if (!texts.length) return [];

  const [translations] = await translateClient.translate(texts, targetLang);
  // translations can be string or array
  const arr = Array.isArray(translations) ? translations : [translations];

  const results = [];
  for (let i = 0; i < exts.length; i++) {
    const ex = exts[i];
    ex.translatedText = arr[i];
    ex.translatedLang = targetLang;
    ex.translateStatus = 'done';
    await ex.save();
    results.push(ex);
  }
  return results;
}

module.exports = { extractImageText, translateExtractions };
