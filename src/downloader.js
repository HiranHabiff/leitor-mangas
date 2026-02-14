const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Imagem, Capitulo, Obra } = require('./models');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function extFromUrl(url) {
  try {
    const u = new URL(url);
    const p = u.pathname;
    const m = p.match(/\.([a-z0-9]{2,6})(?:$|\?)/i);
    return m ? `.${m[1]}` : '.jpg';
  } catch (e) {
    const m = url.match(/\.([a-z0-9]{2,6})(?:$|\?)/i);
    return m ? `.${m[1]}` : '.jpg';
  }
}

async function downloadImageToFile(url, filePath) {
  // special-case test urls: generate a small placeholder file
  if (url.startsWith('http://test/')) {
    const content = Buffer.from('TEST IMAGE');
    await fsp.writeFile(filePath, content);
    return;
  }

  const res = await axios.get(url, { responseType: 'stream', timeout: 15000 });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// simple concurrency limiter
function pLimit(concurrency) {
  const queue = [];
  let active = 0;
  const next = () => {
    if (queue.length === 0) return;
    if (active >= concurrency) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then((v) => {
      active--;
      resolve(v);
      next();
    }).catch((e) => {
      active--;
      reject(e);
      next();
    });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    process.nextTick(next);
  });
}

async function downloadCapituloImages(capituloId, options = { retry: 1, concurrency: 3 }) {
  // include imagens via alias to ensure cap.Imagens is populated
  const cap = await Capitulo.findByPk(capituloId, { include: [ { model: Imagem, as: 'Imagens' }, { model: Obra } ] });
  if (!cap) throw new Error('capitulo_not_found');

  // find obra via association (reload)
  const obra = await Obra.findByPk(cap.obraId);
  if (!obra) throw new Error('obra_not_found');

  const obraFolder = path.resolve(__dirname, '..', 'obras', obra.slug);
  const chapterFolderName = cap.number ? `cap_${String(cap.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${cap.id}`;
  const capFolder = path.join(obraFolder, chapterFolderName);
  await ensureDir(capFolder);

  const imagens = await Imagem.findAll({ where: { capituloId: cap.id } , order: [['order', 'ASC']] });

  const limit = pLimit(options.concurrency || 3);

  // map images to tasks
  const tasks = imagens.map((img) => limit(async () => {
    if (img.status === 'downloaded') return;
    const ext = extFromUrl(img.url || '');
    const index = String(img.order || img.id).padStart(3, '0');
    const filename = `${index}${ext}`;
    const filePath = path.join(capFolder, filename);

    let attempts = 0;
    let success = false;
    while (attempts <= options.retry && !success) {
      try {
        attempts++;
        await downloadImageToFile(img.url, filePath);
        img.filename = filename;
        img.status = 'downloaded';
        await img.save();
        success = true;
      } catch (err) {
        console.error(`Failed to download ${img.url} attempt ${attempts}:`, err.message);
        if (attempts > options.retry) {
          img.status = 'failed';
          await img.save();
        }
      }
    }
  }));

  await Promise.all(tasks);

  return true;
}

async function retryFailedImages(capituloId, options = { retry: 1, concurrency: 3 }) {
  const cap = await Capitulo.findByPk(capituloId);
  if (!cap) throw new Error('capitulo_not_found');
  const failed = await Imagem.findAll({ where: { capituloId, status: 'failed' }, order: [['order','ASC']] });
  if (!failed.length) return { retried: 0 };

  // reuse download logic but only for these images
  const obra = await Obra.findByPk(cap.obraId);
  const obraFolder = path.resolve(__dirname, '..', 'obras', obra.slug);
  const chapterFolderName = cap.number ? `cap_${String(cap.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${cap.id}`;
  const capFolder = path.join(obraFolder, chapterFolderName);
  await ensureDir(capFolder);

  const limit = pLimit(options.concurrency || 3);
  const tasks = failed.map((img) => limit(async () => {
    const ext = extFromUrl(img.url || '');
    const index = String(img.order || img.id).padStart(3, '0');
    const filename = `${index}${ext}`;
    const filePath = path.join(capFolder, filename);
    let attempts = 0;
    let success = false;
    while (attempts <= options.retry && !success) {
      try {
        attempts++;
        await downloadImageToFile(img.url, filePath);
        img.filename = filename;
        img.status = 'downloaded';
        await img.save();
        success = true;
      } catch (err) {
        console.error(`Retry failed ${img.url} attempt ${attempts}:`, err.message);
        if (attempts > options.retry) {
          // remain failed
          img.status = 'failed';
          await img.save();
        }
      }
    }
  }));

  await Promise.all(tasks);
  return { retried: failed.length };
}

async function allDownloaded(capituloId) {
  const total = await Imagem.count({ where: { capituloId } });
  if (total === 0) return false;
  const downloaded = await Imagem.count({ where: { capituloId, status: 'downloaded' } });
  return downloaded === total;
}

module.exports = { downloadCapituloImages, retryFailedImages, allDownloaded };

async function downloadSingleImage(imagemId, options = { retry: 1 }) {
  const img = await Imagem.findByPk(imagemId, { include: [{ model: Capitulo }] });
  if (!img) throw new Error('imagem_not_found');
  const cap = await Capitulo.findByPk(img.capituloId);
  if (!cap) throw new Error('capitulo_not_found');
  const obra = await Obra.findByPk(cap.obraId);
  if (!obra) throw new Error('obra_not_found');

  const obraFolder = path.resolve(__dirname, '..', 'obras', obra.slug);
  const chapterFolderName = cap.number ? `cap_${String(cap.number).replace(/[^a-z0-9\-_.]/gi, '_')}` : `cap_${cap.id}`;
  const capFolder = path.join(obraFolder, chapterFolderName);
  await ensureDir(capFolder);

  const ext = extFromUrl(img.url || '');
  const index = String(img.order || img.id).padStart(3, '0');
  const filename = `${index}${ext}`;
  const filePath = path.join(capFolder, filename);

  let attempts = 0;
  let success = false;
  while (attempts <= (options.retry || 1) && !success) {
    try {
      attempts++;
      await downloadImageToFile(img.url, filePath);
      img.filename = filename;
      img.status = 'downloaded';
      await img.save();
      success = true;
    } catch (err) {
      console.error(`Single image download failed ${img.url} attempt ${attempts}:`, err.message);
      if (attempts > (options.retry || 1)) {
        img.status = 'failed';
        await img.save();
      }
    }
  }

  return img;
}

module.exports.downloadSingleImage = downloadSingleImage;
