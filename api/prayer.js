const { openStore } = require('../lib/prayer-store.cjs');
const { Invalid, submission, permitted, visible, mutate, eligible, hash, iso } = require('../lib/prayer-domain.cjs');
const auth = require('../lib/prayer-auth.cjs');
const master = require('../lib/master-domain.cjs');

const acceptedOrigins = new Set(['https://www.lluviadebendicion.com', 'https://lluviadebendicion.com']);
const safeUser = user => ({ id: user.id, name: user.name, role: user.role, permissions: user.permissions });
const allUsers = (state, configured) => Object.assign(Object.create(null), configured, state.master?.users || {});

function config() {
  const local = process.env.LLDB_PRAYER_LOCAL === '1' && !process.env.VERCEL;
  if (!local && process.env.LLDB_PRAYER_ENABLED !== '1') throw new Invalid('La recepción de peticiones aún no está habilitada.', 503);
  return {
    local, store: openStore({ key: process.env.LLDB_PRAYER_KEY,
      token: process.env.LLDB_PRAYER_PRIVATE_BLOB_READ_WRITE_TOKEN || process.env.LLDB_PRAYER_PRIVATE_BLOB_TOKEN,
      file: local ? process.env.LLDB_PRAYER_LOCAL_FILE : null }),
    users: auth.parseUsers(process.env.LLDB_PRAYER_USERS)
  };
}

module.exports = async function prayer(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const { local, store, users: configuredUsers } = config();
    if (req.method !== 'POST') throw new Invalid('Método no permitido.', 405);
    const origin = req.headers.origin;
    const loopback = `http://127.0.0.1:${process.env.LLDB_PRAYER_LOCAL_PORT || '4179'}`;
    if (!acceptedOrigins.has(origin) && !(local && origin === loopback)) throw new Invalid('Origen no permitido.', 403);
    if (Number(req.headers['content-length']) > 20_000 || !(req.headers['content-type'] || '').startsWith('application/json')) {
      throw new Invalid('Solicitud inválida.', 400);
    }
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { throw new Invalid('Solicitud inválida.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 20_000) {
      throw new Invalid('Solicitud inválida.');
    }
    const address = (req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const token = auth.sessionToken(req, local);
    const action = body.action;

    if (action === 'submit') {
      if (body.website) throw new Invalid('No se pudo recibir la petición.');
      const item = submission(body);
      const accepted = await store.change(state => {
        if (!auth.rate(state, 'submit:' + hash(address), 8, 3600000)) return false;
        state.cases[item.id] = item;
        return true;
      });
      if (!accepted) throw new Invalid('Llegaste al límite de peticiones por el momento. Inténtalo más tarde.', 429);
      return res.status(201).json({ received: true });
    }

    if (action === 'login') {
      const result = await store.change(state => auth.login(state, allUsers(state, configuredUsers), body, address));
      if (result.locked) throw new Invalid('Acceso temporalmente bloqueado. Espera 15 minutos.', 429);
      if (result.failed) throw new Invalid('Revisa tu usuario y contraseña.', 401);
      auth.setCookie(res, result.token, local);
      return res.status(200).json({ user: safeUser(result.user) });
    }

    if (action === 'logout') {
      if (token) await store.change(state => { delete state.sessions[hash(token)]; });
      auth.setCookie(res, '', local);
      return res.status(200).json({ ok: true });
    }

    if (action === 'modify' || action === 'export' || action === 'master-save') {
      const result = await store.change(state => {
        const users = allUsers(state, configuredUsers);
        const user = auth.sessionUser(state, users, token);
        if (action === 'master-save') return master.save(state, user, body, users);
        if (action === 'export') {
          if (!permitted(user, 'export')) throw new Invalid('No tienes permiso para exportar.', 403);
          const selected = Array.isArray(body.ids) ? new Set(body.ids.slice(0, 100)) : new Set();
          const cases = Object.values(state.cases).filter(item => selected.has(item.id) && visible(user, item));
          if (!cases.length) throw new Invalid('Selecciona los expedientes autorizados para exportar.');
          auth.log(state, 'exportación de ' + cases.length + ' expedientes', user.id);
          return { cases, exported: iso() };
        }
        const item = Object.hasOwn(state.cases, body.id) && state.cases[body.id];
        if (!item || !visible(user, item)) throw new Invalid('Expediente no disponible.', 404);
        mutate(item, body, user, users);
        auth.log(state, body.operation, user.id, item.id);
        // Marking a case as urgent can remove an editor's own visibility.
        return { item: visible(user, item) ? item : null };
      });
      return res.status(200).json(result);
    }

    const state = await store.read();
    const users = allUsers(state, configuredUsers);
    const user = auth.sessionUser(state, users, token);
    if (action === 'master-backup') {
      if (user.role !== 'master') throw new Invalid('No tienes permiso para crear respaldos.', 403);
      const backup = store.backup(state);
      if (backup.length > 2_500_000) throw new Invalid('El respaldo supera el límite de descarga del panel.', 413);
      return res.status(200).json({ filename: `lldb-respaldo-${iso().slice(0,10)}.snapshot`, encrypted: backup.toString('base64') });
    }
    if (action === 'master-overview' || action === 'master-list') return res.status(200).json(master.list(state, user, action, body, users));
    if (action === 'session') return res.status(200).json({ user: safeUser(user) });
    if (action === 'presentation') {
      if (!permitted(user, 'present')) throw new Invalid('No tienes permiso de presentación.', 403);
      const items = Object.values(state.cases).filter(item => item.active && eligible(item))
        .sort((a, b) => a.active.order - b.active.order || a.received.localeCompare(b.received))
        .map(item => ({ id: item.active.id, text: item.active.text }));
      return res.status(200).json({ items });
    }
    if (action === 'inbox') {
      if (!permitted(user, 'read')) throw new Invalid('No tienes permiso para consultar peticiones.', 403);
      const cases = Object.values(state.cases).filter(item => visible(user, item));
      const summaries = cases.map(({ id, first, last, received, category, state, owner, urgent, privacy, next, active }) =>
        ({ id, first, last, received, category, state, owner, urgent, privacy, next, presented: !!active }));
      const staff = Object.values(users).filter(auth.isActive).map(safeUser);
      const activity = user.role === 'master' ? state.activity.slice(-50).reverse() : [];
      return res.status(200).json({ cases: summaries, staff, activity, user: safeUser(user) });
    }
    if (action === 'detail') {
      const item = Object.hasOwn(state.cases, body.id) && state.cases[body.id];
      if (!item || !visible(user, item)) throw new Invalid('Expediente no disponible.', 404);
      return res.status(200).json({ item });
    }
    throw new Invalid('Acción inválida.');
  } catch (error) {
    const status = error instanceof Invalid ? error.status : 503;
    return res.status(status).json({ error: error instanceof Invalid ? error.message : 'El servicio no está disponible. Inténtalo más tarde.' });
  }
};
