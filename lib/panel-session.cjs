const { openStore } = require('./prayer-store.cjs');
const { Invalid } = require('./prayer-domain.cjs');
const { parseUsers } = require('./prayer-auth.cjs');

const siteOrigins = new Set(['https://www.lluviadebendicion.com', 'https://lluviadebendicion.com']);

function context() {
  const local = process.env.LLDB_PRAYER_LOCAL === '1' && !process.env.VERCEL;
  if (!local && process.env.LLDB_PRAYER_ENABLED !== '1') throw new Invalid('El servicio privado no está habilitado.', 503);
  return {
    local, store: openStore({ key: process.env.LLDB_PRAYER_KEY,
      token: process.env.LLDB_PRAYER_PRIVATE_BLOB_READ_WRITE_TOKEN || process.env.LLDB_PRAYER_PRIVATE_BLOB_TOKEN,
      file: local ? process.env.LLDB_PRAYER_LOCAL_FILE : null }),
    users: parseUsers(process.env.LLDB_PRAYER_USERS)
  };
}

function allowedOrigin(origin, local) {
  return local ? origin === `http://127.0.0.1:${process.env.LLDB_PRAYER_LOCAL_PORT || '4179'}` : siteOrigins.has(origin);
}

module.exports = { context, allowedOrigin };
