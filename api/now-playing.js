const crypto = require('node:crypto');
const { put, list } = require('@vercel/blob');

const PATH = 'radio/zararadio-now-playing.json';
const MAX_AGE_MS = 20 * 60 * 1000;

function authorized(header, expected) {
  if (!expected || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const secret = Buffer.from(expected);
  return actual.length === secret.length && crypto.timingSafeEqual(actual, secret);
}
function validString(s, max) {
  return typeof s === 'string' && s.length > 0 && s.length <= max && !/[\x00-\x1f]/.test(s);
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ status: 'unconfigured' });
  }
  if (req.method === 'POST') {
    if (!authorized(req.headers.authorization, process.env.LLDB_NOW_PLAYING_TOKEN)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (Number(req.headers['content-length'] || 0) > 2048) {
      return res.status(413).json({ error: 'Too large' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !validString(body.title, 160) || typeof body.artist !== 'string' ||
        body.artist.length > 160 || !validString(body.date, 10) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
        !/^\d{2}:\d{2}:\d{2}$/.test(body.time || '')) {
      return res.status(400).json({ error: 'Invalid metadata' });
    }
    const data = { title: body.title, artist: body.artist, updatedAt: new Date().toISOString() };
    try {
      await put(PATH, JSON.stringify(data), {
        access: 'public', allowOverwrite: true,
        contentType: 'application/json', addRandomSuffix: false,
        cacheControlMaxAge: 60
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('now-playing write failed', error);
      return res.status(500).json({ error: 'Storage unavailable' });
    }
  }
  try {
    const { blobs } = await list({ prefix: PATH, limit: 10 });
    const entry = blobs.find(b => b.pathname === PATH);
    if (!entry) return res.status(200).json({ status: 'unavailable' });
    const response = await fetch(entry.downloadUrl || entry.url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Read failed');
    const data = await response.json();
    if (!data.updatedAt || Date.now() - Date.parse(data.updatedAt) > MAX_AGE_MS) {
      return res.status(200).json({ status: 'stale' });
    }
    return res.status(200).json({ status: 'playing', title: data.title, artist: data.artist, updatedAt: data.updatedAt });
  } catch (error) {
    console.error('now-playing read failed', error);
    return res.status(503).json({ status: 'unavailable' });
  }
};
