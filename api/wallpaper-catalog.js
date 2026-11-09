const { readdir } = require('node:fs/promises');
const { join, extname } = require('node:path');
const { wallpapers } = require('./media-config.json');

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const order = new Intl.Collator('es', { numeric: true });

async function listWallpapers(collection) {
  const folder = join(process.cwd(), 'assets', 'wallpapers', collection);
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter(entry => entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase()))
    .sort((left, right) => order.compare(right.name, left.name))
    .map(({ name }) => ({
      title: name.slice(0, -extname(name).length).replace(/[_-]+/g, ' '),
      url: '/assets/wallpapers/' + collection + '/' + encodeURIComponent(name)
    }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  try {
    const [originals, affiliates] = await Promise.all([
      listWallpapers('originales'),
      listWallpapers('afiliados')
    ]);
    res.setHeader('Vercel-CDN-Cache-Control', 's-maxage=60');
    return res.status(200).json({ christian: wallpapers.christian, originals, affiliates });
  } catch {
    return res.status(500).json({ error: 'No se pudo cargar el catálogo de fondos.' });
  }
};
