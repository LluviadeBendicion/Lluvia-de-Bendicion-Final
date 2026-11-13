const { randomUUID, createHash, createHmac, timingSafeEqual } = require('node:crypto');

const admins = {
  'omar-rivera': { name: 'Omar Rivera', passwordKey: 'LLDB_OMAR_PASSWORD' },
  'ever-caraballo': { name: 'Ever Caraballo', passwordKey: 'LLDB_EVER_PASSWORD' }
};
const allowedOrigins = new Set(['https://www.lluviadebendicion.com', 'https://lluviadebendicion.com']);
const sessionCookie = '__Host-lldb-admin';
const sessionSeconds = 3600;
const attempts = new Map();

function signature(secret, value) {
  return createHmac('sha256', secret).update(value).digest();
}

function passwordMatches(secret, supplied, expected) {
  return timingSafeEqual(signature(secret, supplied), signature(secret, expected));
}

function cookie(res, value, lifetime) {
  res.setHeader('Set-Cookie', sessionCookie + '=' + value +
    '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + lifetime);
}

function sessionUser(req, token) {
  const value = (req.headers.cookie || '').split('; ').find(entry => entry.startsWith(sessionCookie + '='));
  const parts = value?.slice(sessionCookie.length + 1).split('.') || [];
  const [user, expiry, signed] = parts;
  if (parts.length !== 3 || !Object.hasOwn(admins, user) ||
      !/^\d{10}$/.test(expiry) || Number(expiry) <= Math.floor(Date.now() / 1000) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signed)) return null;
  const password = process.env[admins[user].passwordKey];
  if (!password) return null;
  const expected = signature(token, 'session:' + user + '.' + expiry + ':' + password);
  return timingSafeEqual(expected, Buffer.from(signed, 'base64url')) ? user : null;
}

function allowAttempt(req) {
  const now = Date.now();
  const address = (req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const previous = attempts.get(address);
  if (previous && previous.until > now) {
    if (++previous.count > 8) throw new RequestError(429, 'Demasiados intentos. Espera un minuto.');
    return;
  }
  if (attempts.size >= 1000) {
    for (const [key, value] of attempts) {
      if (value.until <= now) attempts.delete(key);
    }
    if (attempts.size >= 1000) throw new RequestError(429, 'Espera un minuto e intenta de nuevo.');
  }
  attempts.set(address, { count: 1, until: now + 60000 });
}
const repository = '/repos/LluviadeBendicion/Lluvia-de-Bendicion-Final';
const configPath = 'api/media-config.json';
const collections = { christian: 'cristianos', originals: 'originales', affiliates: 'afiliados' };
const mediaTypes = {
  originals: { mp4: ['video/mp4'] },
  podcasts: { mp3: ['audio/mpeg'], m4a: ['audio/mp4', 'audio/x-m4a'] }
};
const mediaLimit = 250 * 1024 * 1024;

function mediaUrl(value, kind) {
  let url;
  try { url = new URL(value); } catch {}
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || value.length > 2048) {
    throw new RequestError(400, 'Ingresa un enlace HTTPS válido.');
  }
  if (kind === 'facebook') {
    if (!['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(url.hostname) ||
        !(/\/(?:videos|reel)\/\d+(?:\/|$)/i.test(url.pathname) ||
          (['/watch', '/watch/', '/video.php'].includes(url.pathname) && /^\d+$/.test(url.searchParams.get('v') || '')))) {
      throw new RequestError(400, 'Pega el enlace público de Facebook con /videos/, /reel/ o watch/?v=.');
    }
  } else if (!Object.hasOwn(mediaTypes[kind], url.pathname.split('.').pop().toLowerCase())) {
    throw new RequestError(400, 'El enlace debe apuntar directamente al archivo de video o audio.');
  }
  url.hash = '';
  return url.href;
}

async function mediaUpload(body) {
  const { kind, extension, size } = body;
  if (!Object.hasOwn(mediaTypes, kind) || !Object.hasOwn(mediaTypes[kind], extension) ||
      !Number.isSafeInteger(size) || size < 1 || size > mediaLimit) {
    throw new RequestError(400, 'Selecciona un archivo permitido de hasta 250 MB.');
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new RequestError(503, 'Falta conectar Vercel Blob. Puedes publicar con un enlace directo mientras tanto.');
  const { generateClientTokenFromReadWriteToken } = await import('@vercel/blob/client');
  const pathname = 'lldb-media/' + kind + '/' + randomUUID() + '.' + extension;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token, pathname, allowedContentTypes: mediaTypes[kind][extension],
    maximumSizeInBytes: size, validUntil: Date.now() + 30 * 60 * 1000,
    addRandomSuffix: false, allowOverwrite: false
  });
  return { pathname, clientToken, contentType: mediaTypes[kind][extension][0] };
}

function parseMedia(body) {
  const { kind, title, url } = body;
  if (!(kind === 'facebook' || Object.hasOwn(mediaTypes, kind)) ||
      typeof title !== 'string' || !title.trim() || title.length > 100 || typeof url !== 'string') {
    throw new RequestError(400, 'Selecciona una sección, un título y un archivo o enlace.');
  }
  return { collection: kind, item: { title: title.trim(), url: mediaUrl(url.trim(), kind) }, media: true };
}

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
    if (status === 401) throw new RequestError(503, 'La credencial de publicación de GitHub necesita actualizarse.');
    if (status === 403 || status === 404) {
      throw new RequestError(502, 'GitHub rechazó el acceso de publicación. Revisa la configuración en Vercel.');
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

function parseEdit(body) {
  const { collection, title, verse = '', reference = '', url } = body;
  if (!Object.hasOwn(collections, collection) || typeof title !== 'string' || !title.trim() ||
      title.length > 100 || typeof verse !== 'string' || verse.length > 250 ||
      typeof reference !== 'string' || reference.length > 90 || typeof url !== 'string' ||
      !url.startsWith('/assets/wallpapers/' + collections[collection] + '/') ||
      !/^[A-Za-z0-9%-][A-Za-z0-9_%.+-]*\.(?:jpe?g|png|webp|avif)$/i.test(url.split('/').pop()) ||
      url.split('/').length !== 5 || /%2f|%5c/i.test(url)) {
    throw new RequestError(400, 'Selecciona un fondo válido y escribe un título.');
  }
  return { collection, item: { title: title.trim(), verse: verse.trim(), reference: reference.trim(), url } };
}

async function publish(token, upload, adminName) {
  const { collection, item, image, media } = upload;
  let imageSha;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await github(repository + '/git/ref/heads/main', token);
    const parent = ref.object.sha;
    const [base, configFile] = await Promise.all([
      github(repository + '/git/commits/' + parent, token),
      github(repository + '/contents/' + configPath + '?ref=' + parent, token)
    ]);
    const config = JSON.parse(Buffer.from(configFile.content, 'base64').toString('utf8'));
    const target = media
      ? collection === 'podcasts' ? config.podcasts : config.videos[collection === 'facebook' ? 'facebookServices' : 'lldbOriginals']
      : config.wallpapers;
    const key = media ? 'items' : collection;
    const entries = target[key] || [];
    const existing = entries.find(entry => entry.url === item.url);
    if ((image || media) && existing) return existing;
    if (!media && !image && !existing) {
      if (collection === 'christian') throw new RequestError(404, 'No se encontró ese fondo en el catálogo.');
      const path = item.url.slice(1);
      const file = await github(repository + '/contents/' + path + '?ref=' + parent, token);
      if (file.type !== 'file' || file.path !== decodeURIComponent(path)) {
        throw new RequestError(404, 'No se encontró ese fondo en el catálogo.');
      }
    }
    target[key] = image || media || !existing
      ? [item, ...entries]
      : entries.map(entry => entry.url === item.url ? { ...entry, ...item } : entry);
    if (image && !imageSha) {
      const blob = await github(repository + '/git/blobs', token, 'POST', { content: image, encoding: 'base64' });
      imageSha = blob.sha;
    }
    const tree = await github(repository + '/git/trees', token, 'POST', {
      base_tree: base.tree.sha,
      tree: [
        ...(imageSha ? [{ path: item.url.slice(1), mode: '100644', type: 'blob', sha: imageSha }] : []),
        { path: configPath, mode: '100644', type: 'blob', content: JSON.stringify(config, null, 2) + '\n' }
      ]
    });
    const commit = await github(repository + '/git/commits', token, 'POST', {
      message: (media ? 'Publicar contenido en ' + collection : (image ? 'Publicar' : 'Editar') + ' fondo en ' + collections[collection]) + ' · ' + adminName,
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
  if (!allowedOrigins.has(req.headers.origin)) return res.status(403).json({ error: 'Origen no autorizado.' });
  try {
    const body = req.body;
    if (!body || !['login', 'logout', 'session', 'publish', 'edit', 'media-upload', 'media-publish'].includes(body.action)) {
      throw new RequestError(400, 'Acción inválida.');
    }
    if (body.action === 'logout') {
      cookie(res, '', 0);
      return res.status(200).json({ ok: true });
    }
    const token = process.env.LLDB_WALLPAPER_GITHUB_TOKEN;
    if (!token) throw new RequestError(503, 'Falta activar el panel en Vercel.');
    if (body.action === 'login') {
      allowAttempt(req);
      const { user, password } = body;
      if (!Object.hasOwn(admins, user) || typeof password !== 'string' || !password || password.length > 256) {
        throw new RequestError(401, 'Usuario o contraseña incorrectos.');
      }
      const expected = process.env[admins[user].passwordKey];
      if (!expected || !passwordMatches(token, password, expected)) {
        throw new RequestError(401, 'Usuario o contraseña incorrectos.');
      }
      const expiry = Math.floor(Date.now() / 1000) + sessionSeconds;
      const value = user + '.' + expiry;
      const signed = signature(token, 'session:' + value + ':' + expected).toString('base64url');
      cookie(res, value + '.' + signed, sessionSeconds);
      return res.status(200).json({ name: admins[user].name });
    }
    const user = sessionUser(req, token);
    if (!user) throw new RequestError(401, 'Inicia sesión con tu usuario y contraseña.');
    const name = admins[user].name;
    if (body.action === 'session') return res.status(200).json({ name });
    if (body.action === 'media-upload') return res.status(200).json(await mediaUpload(body));
    const item = await publish(token, body.action === 'media-publish' ? parseMedia(body)
      : body.action === 'publish' ? parseUpload(body) : parseEdit(body), name);
    return res.status(202).json({ item });
  } catch (error) {
    return res.status(error.status || 502).json({
      error: error.status ? error.message : 'No se pudo conectar con GitHub. Intenta de nuevo.'
    });
  }
};
