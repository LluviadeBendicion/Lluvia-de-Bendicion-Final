const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { hash, Invalid } = require('./prayer-domain.cjs');

const roles = ['master', 'section-admin', 'editor', 'collaborator', 'reader', 'temporary'];
const permissions = ['read', 'edit', 'restricted', 'export', 'present'];
const allowedUser = /^[a-z0-9][a-z0-9-]{1,63}$/;
const dummySalt = 'b44ec7623656c949a2094e665d8321392';
const dummyHash = Buffer.alloc(32);

function parseUsers(config) {
  const list = JSON.parse(config || '[]');
  if (!Array.isArray(list)) throw new Error('PRAYER_USERS_UNCONFIGURED');
  const users = Object.create(null);
  for (const entry of list) {
    const { id, name, role, salt, passwordHash } = entry;
    if (!allowedUser.test(id) || Object.hasOwn(users, id) || typeof name !== 'string' || !name || !roles.includes(role) ||
        !/^[\da-f]{32}$/i.test(salt) || !/^[\da-f]{64}$/i.test(passwordHash) ||
        (role === 'master') !== (id === 'omar-rivera') ||
        (role === 'temporary' && !Number.isFinite(Date.parse(entry.expires)))) throw new Error('PRAYER_USERS_INVALID');
    users[id] = { ...entry, permissions: (entry.permissions || []).filter(value => permissions.includes(value)) };
  }
  if (!users['omar-rivera']) throw new Error('PRAYER_USERS_UNCONFIGURED');
  return users;
}

function isActive(user) { return Boolean(user && !user.disabled && (!user.expires || Date.parse(user.expires) > Date.now())); }
function verifyCredentials(user, password) {
  const supplied = scryptSync(password, user?.salt || dummySalt, 32);
  const correct = timingSafeEqual(supplied, user ? Buffer.from(user.passwordHash, 'hex') : dummyHash);
  return correct && isActive(user);
}

function rate(state, key, maximum, period) {
  const now = Date.now();
  for (const [id, limit] of Object.entries(state.limits)) if (limit.until <= now) delete state.limits[id];
  for (const [id, session] of Object.entries(state.sessions)) if (session.until <= now) delete state.sessions[id];
  const entry = state.limits[key] ||= { count: 0, until: now + period };
  if (entry.count >= maximum) return false;
  entry.count++;
  return true;
}

function sessionToken(req, local) {
  const key = local ? 'lldb-prayer-preview' : '__Host-lldb-prayer';
  return (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${key}=([a-f0-9]{64})(?:;|$)`))?.[1] || '';
}

function setCookie(res, token, local) {
  const key = local ? 'lldb-prayer-preview' : '__Host-lldb-prayer';
  res.setHeader('Set-Cookie', `${key}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 1800 : 0}${local ? '' : '; Secure'}`);
}

function sessionUser(state, users, token) {
  const session = token && state.sessions[hash(token)];
  const user = session && users[session.id];
  if (!session || session.until <= Date.now() || !isActive(user)) throw new Invalid('Inicia sesión para continuar.', 401);
  if (session.key !== hash(user.passwordHash)) throw new Invalid('La sesión expiró.', 401);
  return user;
}

function log(state, event, who, id) {
  state.activity.push({ at: new Date().toISOString(), event, who, ...(id && { id }) });
  if (state.activity.length > 3000) state.activity.splice(0, state.activity.length - 3000);
}

function login(state, users, body, address) {
  const username = typeof body.user === 'string' && body.user.length <= 80 ? body.user.trim().toLowerCase() : '';
  const id = allowedUser.test(username) ? username : 'invalid';
  const password = typeof body.password === 'string' && body.password.length <= 256 ? body.password : '';
  const bucket = 'login:' + hash(id + ':' + address);
  const addressBucket = 'attempts:' + hash(address);
  const isRateLimited = id !== 'omar-rivera';
  if (isRateLimited && (!rate(state, addressBucket, 25, 900000) || !rate(state, bucket, 5, 900000))) return { locked: true };
  const user = users[id];
  if (!verifyCredentials(user, password)) {
    if (isRateLimited && state.limits[bucket].count === 5) log(state, 'bloqueo temporal por intentos fallidos', id);
    return { failed: true };
  }
  if (isRateLimited) {
    delete state.limits[bucket];
    if (--state.limits[addressBucket].count === 0) delete state.limits[addressBucket];
  }
  const token = randomBytes(32).toString('hex');
  state.sessions[hash(token)] = { id, until: Date.now() + 1800000, key: hash(user.passwordHash) };
  log(state, 'inicio de sesión', id);
  return { token, user };
}

module.exports = { parseUsers, isActive, rate, sessionToken, setCookie, sessionUser, log, login };
