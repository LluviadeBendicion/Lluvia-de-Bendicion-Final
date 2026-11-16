const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.LLDB_PRAYER_LOCAL_PORT || '4179');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto de vista previa no válido.');
process.env.LLDB_PRAYER_LOCAL_PORT = String(port);
const full = true;
let prayer;
let toolsAdmin;
let demoUsers;
if (full) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lldb-peticiones-'));
  process.env.LLDB_PRAYER_LOCAL = '1';
  process.env.LLDB_PRAYER_LOCAL_FILE = path.join(directory, 'prayer.snapshot');
  process.env.LLDB_PRAYER_KEY = crypto.randomBytes(32).toString('base64');
  delete process.env.LLDB_WALLPAPER_GITHUB_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.OPENAI_API_KEY;
  demoUsers = [
    { id: 'omar-rivera', name: 'Omar · Vista previa', role: 'master', permissions: [] },
    { id: 'editor-prueba', name: 'Editor · Vista previa', role: 'editor', permissions: ['read', 'edit', 'present'] },
    { id: 'ever-caraballo', name: 'Ever · Vista previa', role: 'master', permissions: [] }
  ].map(user => {
    const password = 'VistaPrevia-' + crypto.randomBytes(8).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    return { ...user, password, salt, passwordHash: crypto.scryptSync(password, salt, 32).toString('hex') };
  });
  process.env.LLDB_PRAYER_USERS = JSON.stringify(demoUsers.map(({ password, ...entry }) => entry));
  prayer = require(path.join(root, 'api/prayer.js'));
  toolsAdmin = require(path.join(root, 'api/wallpaper-admin.js'));
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.m4a': 'audio/mp4', '.mp4': 'video/mp4'
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = decodeURIComponent(url.pathname);
  if (full && route === '/acceso') {
    return res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' }).end(`<!doctype html>
      <html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso de prueba · LLDB</title>
      <style>body{font:17px/1.5 system-ui;color:#fff0d8;background:#081524;max-width:640px;margin:auto;padding:2rem 1rem}a{color:#ffd78c}code{font-size:1.1em}</style>
      <h1>Panel Maestro · Acceso de prueba</h1><p>Utiliza este entorno con datos de prueba.</p>
      <ol><li><a href="/#inicio" target="_blank" rel="noopener">Abrir el sitio de prueba en Inicio</a>.</li>
      <li>Al pie de la página, hacer cinco clics seguidos en <strong>LLDB</strong>.</li><li>En el panel, entrar con estos datos de prueba.</li></ol>
      <label>Cuenta de prueba <select id="account"><option value="omar-rivera">Omar Rivera</option><option value="ever-caraballo">Ever Caraballo</option></select></label>
      <p>Usuario: <code id="user"></code><br>Contraseña: <code id="password"></code></p>
      <script>async function load(){const accounts=await fetch('/preview-code').then(res=>res.json());const picker=document.getElementById('account');function show(){const demo=accounts.find(account=>account.user===picker.value);for(const key of ['user','password'])document.getElementById(key).textContent=demo[key]}picker.onchange=show;show()}load()</script></html>`);
  }
  if (full && route === '/preview-code') {
    const credentials = demoUsers.map(({ id, password }) => ({ user: id, password }));
    return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(credentials, null, 2));
  }
  if (full && ['/api/prayer','/api/wallpaper-admin'].includes(route)) {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 20000) return res.writeHead(413).end();
      chunks.push(chunk);
    }
    req.body = Buffer.concat(chunks).toString('utf8');
    res.status = code => { res.statusCode = code; return res; };
    res.json = payload => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.end(JSON.stringify(payload)); };
    if (route === '/api/prayer') return prayer(req, res);
    try { req.body = JSON.parse(req.body); } catch { req.body = null; }
    return toolsAdmin(req, res);
  }
  if (req.method !== 'GET' || (route.startsWith('/api/') && !route.endsWith('.json')) || route.startsWith('/lib/') || route.startsWith('/scripts/')) {
    return res.writeHead(404).end();
  }
  const file = path.resolve(root, '.' + (route === '/' ? '/index.html' : route));
  const type = types[path.extname(file)];
  const info = file.startsWith(root + path.sep) && type && fs.statSync(file, { throwIfNoEntry: false });
  if (!info?.isFile()) return res.writeHead(404).end();
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end) return res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
    res.writeHead(206, { 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${info.size}` });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Length': info.size });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/#peticiones`));
