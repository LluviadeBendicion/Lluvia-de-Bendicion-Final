const { createHash } = require('node:crypto');

const ownerId = 305439423;
const repository = '/repos/LluviadeBendicion/Lluvia-de-Bendicion-Final';
const configPath = 'api/media-config.json';
const collections = { christian: 'cristianos', originals: 'originales', affiliates: 'afiliados' };
const maxBytes = 3 * 1024 * 1024;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function github(path, token, method = 'GET', payload) {
  const response = await fetch('https://api.github.com' + path, {
    method,
    redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    const status = response.status;
    await response.body?.cancel();
    if (status === 401) throw new RequestError(401, 'La clave de GitHub es inválida o venció.');
    if (status === 403 || status === 404) {
      throw new RequestError(403, 'Revisa que la clave tenga acceso al repositorio y permiso Contents: Read and write.');
    }
    throw new RequestError(status === 409 || status === 422 ? 409 : 502, 'GitHub no pudo completar la publicación.');
  }
  return response.json();
}

function detectExtension(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) &&
      bytes.subarray(-2).equals(Buffer.from([255, 217]))) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.subarray(12, 16).toString('ascii') === 'IHDR' &&
      bytes.subarray(-8, -4).toString('ascii') === 'IEND') return 'png';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.subarray(12, 16).toString('ascii')) &&
      bytes.readUInt32LE(4) + 8 === bytes.length) return 'webp';
  return null;
}

function parseUpload(body) {
  const { collection, title, verse = '', reference = '', image } = body;
  if (!Object.hasOwn(collections, collection) ||
      typeof title !== 'string' || !title.trim() || title.length > 100 ||
      typeof verse !== 'string' || verse.length > 250 ||
      typeof reference !== 'string' || reference.length > 90) {
    throw new RequestError(400, 'Selecciona una colección y escribe un título válido.');
  }
  if (typeof image !== 'string' || !image || image.length > Math.ceil(maxBytes / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    throw new RequestError(400, 'Selecciona un JPG, PNG o WebP de hasta 3 MB.');
  }
  const bytes = Buffer.from(image, 'base64');
  const extension = detectExtension(bytes);
  if (bytes.length > maxBytes || !extension) {
    throw new RequestError(400, 'El archivo debe ser un JPG, PNG o WebP válido de hasta 3 MB.');
  }
  const item = { title: title.trim(), verse: verse.trim(), reference: reference.trim() };
  const slug = item.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'fondo';
  const digest = createHash('sha256').update(bytes).update(JSON.stringify(item)).digest('hex').slice(0, 24);
  item.url = '/assets/wallpapers/' + collections[collection] + '/' + slug + '-' + digest + '.' + extension;
  return { collection, item, image };
}

async function publish(token, upload) {
  const { collection, item, image } = upload;
  let imageSha;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await github(repository + '/git/ref/heads/main', token);
    const parent = ref.object.sha;
    const [base, configFile] = await Promise.all([
      github(repository + '/git/commits/' + parent, token),
      github(repository + '/contents/' + configPath + '?ref=' + parent, token)
    ]);
    const config = JSON.parse(Buffer.from(configFile.content, 'base64').toString('utf8'));
    const entries = config.wallpapers[collection] || [];
    if (entries.some(entry => entry.url === item.url)) return item;
    config.wallpapers[collection] = [item, ...entries];
    if (!imageSha) {
      const blob = await github(repository + '/git/blobs', token, 'POST', { content: image, encoding: 'base64' });
      imageSha = blob.sha;
    }
    const tree = await github(repository + '/git/trees', token, 'POST', {
      base_tree: base.tree.sha,
      tree: [
        { path: item.url.slice(1), mode: '100644', type: 'blob', sha: imageSha },
        { path: configPath, mode: '100644', type: 'blob', content: JSON.stringify(config, null, 2) + '\n' }
      ]
    });
    const commit = await github(repository + '/git/commits', token, 'POST', {
      message: 'Publicar fondo en ' + collections[collection],
      tree: tree.sha,
      parents: [parent]
    });
    try {
      await github(repository + '/git/refs/heads/main', token, 'PATCH', { sha: commit.sha, force: false });
      return item;
    } catch (error) {
      if (error.status !== 409) throw error;
    }
  }
  throw new RequestError(409, 'Hubo otra publicación al mismo tiempo. Intenta de nuevo.');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const token = /^Bearer (github_pat_[A-Za-z0-9_]{20,240})$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Usa una clave de GitHub de acceso limitado.' });
  try {
    const body = req.body;
    if (!body || !['login', 'publish'].includes(body.action)) throw new RequestError(400, 'Acción inválida.');
    const account = await github('/user', token);
    if (account.id !== ownerId) throw new RequestError(403, 'El acceso está reservado para la cuenta propietaria.');
    if (body.action === 'login') {
      await github(repository + '/git/ref/heads/main', token);
      return res.status(200).json({ ok: true });
    }
    const item = await publish(token, parseUpload(body));
    return res.status(202).json({ item });
  } catch (error) {
    return res.status(error.status || 502).json({
      error: error.status ? error.message : 'No se pudo conectar con GitHub. Intenta de nuevo.'
    });
  }
};
