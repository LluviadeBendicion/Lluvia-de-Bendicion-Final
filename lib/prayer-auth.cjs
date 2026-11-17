const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { hash, Invalid } = require('./prayer-domain.cjs');

const roles = ['master', 'section-admin', 'editor', 'collaborator', 'reader', 'temporary'];
const permissions = ['read', 'edit', 'restricted', 'export', 'present'];
const allowedUser = /^[a-z0-9][a-z0-9-]{1,63}$/;
const dummySalt = 'b44ec7623656c949a2094e665d8321392';
const dummyHash = Buffer.alloc(32);
const masterIds = new Set(['omar-rivera', 'ever-caraballo']);

function parseUsers(config) {
  const list = JSON.parse(config || '[]');
  if (!Array.isArray(list)) throw new Error('PRAYER_USERS_UNCONFIGURED');
  const users = Object.create(null);
  for (const entry of list) {
    const { id, name, role, salt, passwordHash } = entry;
    if (!allowedUser.test(id) || Object.hasOwn(users, id) || typeof name !== 'string' || !name || !roles.includes(role) ||
        !/^[\da-f]{32}$/i.test(salt) || !/^[\da-f]{64}$/i.test(passwordHash) ||
        (role === 'master' && !masterIds.has(id)) || (id === 'omar-rivera' && role !== 'master') ||
        (role === 'temporary' && !Number.isFinite(Date.parse(entry.expires)))) throw new Error('PRAYER_USERS_INVALID');
    users[id] = { ...entry, permissions: (entry.permissions || []).filter(value => permissions.includes(value)) };
  }
  if (!users['omar-rivera']) throw new Error('PRAYER_USERS_UNCONFIGURED');
  return users;
}

function isActive(user) { return Boolean(user && !user.disabled && (!user.expires || Date.parse(user.expires) > Date.now())); }
function verifyCredentials(user, password) {
  const supplied = scryptSync(password, user?.salt || dummySalt, 32);
  const correct = timingSafeEqual(supplied, user?.passwordHash ? Buffer.from(user.passwordHash, 'hex') : dummyHash);
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

function userId(value) {
  const username = typeof value === 'string' && value.length <= 80 ? value.trim().toLowerCase() : '';
  if (/^omar\s+rivera$/.test(username) || username === 'omar') return 'omar-rivera';
  if (/^ever\s+caraballo$/.test(username) || username === 'ever') return 'ever-caraballo';
  return allowedUser.test(username) ? username : '';
}

function login(state, users, body, address) {
  const id = userId(body.user) || 'invalid';
  const password = typeof body.password === 'string' && body.password.length <= 256 ? body.password : '';
  const bucket = 'login:' + hash(id + ':' + address);
  const addressBucket = 'attempts:' + hash(address);
  const user = users[id];
  const maximum = user?.role === 'master' ? 10 : 5;
  if (!rate(state, addressBucket, 25, 900000) || !rate(state, bucket, maximum, 900000)) return { locked: true };
  if (!verifyCredentials(user, password)) {
    if (state.limits[bucket].count === maximum) log(state, 'bloqueo temporal por intentos fallidos', id);
    return { failed: true };
  }
  delete state.limits[bucket];
  if (--state.limits[addressBucket].count === 0) delete state.limits[addressBucket];
  const token = randomBytes(32).toString('hex');
  state.sessions[hash(token)] = { id, until: Date.now() + 1800000, key: hash(user.passwordHash) };
  log(state, 'inicio de sesión', id);
  return { token, user };
}

function revokeSessions(state, id) {
  for (const [key, session] of Object.entries(state.sessions)) if (session.id === id) delete state.sessions[key];
}

function newCredentials(user, newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < 15 || newPassword.length > 256) {
    throw new Invalid('La nueva contraseña debe tener entre 15 y 256 caracteres.');
  }
  if (verifyCredentials(user, newPassword)) throw new Invalid('Elige una contraseña diferente.');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(newPassword, salt, 32).toString('hex');
  return { salt, passwordHash };
}

function replacePassword(state, user, newPassword) {
  const credentials = newCredentials(user, newPassword);
  state.passwordChanges ||= {};
  state.passwordChanges[user.id] = { source: user.sourcePasswordHash || user.passwordHash, ...credentials };
  if (state.recovery) delete state.recovery[user.id];
  if (state.emailRecovery) delete state.emailRecovery[user.id];
  revokeSessions(state, user.id);
}

function loadUsers(state, configured) {
  const users = Object.create(null);
  users['ever-caraballo'] = { id: 'ever-caraballo', name: 'Ever Caraballo', role: 'master', permissions: [], disabled: true };
  for (const number of [1, 2, 3]) {
    const id = `colaborador-${number}`;
    users[id] = { id, name: `Colaborador ${number}`, role: 'collaborator', permissions: [], disabled: true };
  }
  Object.assign(users, configured, state.master?.users);
  if (state.enrolledEver) users['ever-caraballo'] = state.enrolledEver;
  for (const id of masterIds) {
    if (configured[id]?.role === 'master' && (id !== 'ever-caraballo' || !state.enrolledEver || isActive(configured[id]))) {
      users[id] = configured[id];
    }
  }
  for (const [id, user] of Object.entries(users)) {
    const change = state.passwordChanges?.[id];
    if (change && change.source === user.passwordHash) {
      users[id] = { ...user, salt: change.salt, passwordHash: change.passwordHash, sourcePasswordHash: change.source };
    }
  }
  return users;
}

function needsEverActivation(user) {
  return user?.id === 'ever-caraballo' && (!isActive(user) || user.role !== 'master');
}

function changePassword(state, user, body, address) {
  if (!rate(state, 'password:' + hash(user.id + ':' + address), 6, 900000)) return false;
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 256 ||
      !verifyCredentials(user, body.currentPassword)) return false;
  replacePassword(state, user, body.newPassword);
  log(state, 'cambio de contraseña', user.id);
  return true;
}

function issueRecovery(state, user, target, body, address) {
  if (user.role !== 'master') throw new Invalid('Solo los administradores pueden recuperar accesos.', 403);
  if (!rate(state, 'password:' + hash(user.id + ':' + address), 6, 900000)) return null;
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 256 ||
      !verifyCredentials(user, body.currentPassword)) return null;
  const activate = needsEverActivation(target);
  if (!target || target.id === user.id || (!activate && (!isActive(target) || !target.passwordHash))) {
    throw new Invalid('Selecciona otra cuenta activa para recuperar el acceso.');
  }
  const code = randomBytes(32).toString('base64url');
  state.recovery ||= {};
  state.recovery[target.id] = { codeHash: hash(code), until: Date.now() + 30 * 60 * 1000,
    issuedFor: hash(target.passwordHash || ''), activate };
  log(state, 'recuperación de acceso solicitada', user.id, target.id);
  return code;
}

function recover(state, users, body, address) {
  if (!rate(state, 'recovery:' + hash(address), 10, 900000)) return false;
  const user = typeof body.user === 'string' && Object.hasOwn(users, body.user) ? users[body.user] : null;
  const reset = user && state.recovery?.[user.id];
  if (!reset || (reset.activate ? !needsEverActivation(user) : !isActive(user)) || reset.until <= Date.now() ||
      reset.issuedFor !== hash(user.passwordHash || '') ||
      typeof body.code !== 'string' || body.code.length !== 43 ||
      !timingSafeEqual(Buffer.from(reset.codeHash, 'hex'), Buffer.from(hash(body.code), 'hex'))) return false;
  completeRecovery(state, user, body.newPassword, reset.activate);
  return true;
}

function completeRecovery(state, user, password, activate) {
  if (activate) {
    const credentials = newCredentials(user, password);
    state.enrolledEver = { id: user.id, name: 'Ever Caraballo', role: 'master', permissions: [], ...credentials };
    if (state.recovery) delete state.recovery[user.id];
    if (state.emailRecovery) delete state.emailRecovery[user.id];
    revokeSessions(state, user.id);
  } else replacePassword(state, user, password);
  log(state, 'acceso recuperado', user.id);
}

function requestEmailRecovery(state, users, config, username, address) {
  if (!rate(state, 'email-recovery-ip:' + hash(address), 8, 3600000)) return null;
  const id = userId(username);
  const user = users[id];
  const email = config.recipients[id];
  const activate = needsEverActivation(user);
  if (!email || (!activate && (!isActive(user) || user.role !== 'master'))) return null;
  if (!rate(state, 'email-recovery-user:' + id, 4, 3600000)) return null;
  const code = randomBytes(32).toString('base64url');
  state.emailRecovery ||= {};
  const active = (state.emailRecovery[id] || []).filter(entry => entry.until > Date.now()).slice(-3);
  active.push({ codeHash: hash(code), until: Date.now() + 30 * 60 * 1000,
    issuedFor: hash(user.passwordHash || ''), emailHash: hash(email), activate });
  state.emailRecovery[id] = active;
  log(state, 'solicitud de recuperación por correo', user.id);
  return { id, email, code };
}

function recoverByEmail(state, users, config, body, address) {
  if (!rate(state, 'redeem-email-recovery:' + hash(address), 10, 900000)) return false;
  const id = userId(body.user);
  const user = users[id];
  const email = config.recipients[id];
  if (!user || !email || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.code)) return false;
  const supplied = Buffer.from(hash(body.code), 'hex');
  const reset = (state.emailRecovery?.[id] || []).find(entry =>
    entry.until > Date.now() && timingSafeEqual(Buffer.from(entry.codeHash, 'hex'), supplied));
  if (!reset || reset.emailHash !== hash(email) || reset.issuedFor !== hash(user.passwordHash || '') ||
      (reset.activate ? !needsEverActivation(user) : !isActive(user) || user.role !== 'master')) return false;
  completeRecovery(state, user, body.newPassword, reset.activate);
  delete state.limits['login:' + hash(id + ':' + address)];
  return true;
}

function recoverOmarOnce(state, users, encoded, body, address) {
  if (!encoded || body.user !== 'omar-rivera' || typeof body.code !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(body.code)) return false;
  const [until, digest] = encoded.split('.');
  if (!/^\d{13}$/.test(until) || Number(until) <= Date.now() || !/^[a-f0-9]{64}$/.test(digest || '') ||
      state.usedOmarRecovery === digest) return false;
  const user = users['omar-rivera'];
  if (!isActive(user) || user.role !== 'master' ||
      !timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(hash(body.code), 'hex'))) return false;
  completeRecovery(state, user, body.newPassword, false);
  state.usedOmarRecovery = digest;
  delete state.limits['login:' + hash(user.id + ':' + address)];
  delete state.limits['attempts:' + hash(address)];
  return true;
}

module.exports = { parseUsers, isActive, rate, sessionToken, setCookie, sessionUser, log, login,
  loadUsers, revokeSessions, changePassword, issueRecovery, recover, needsEverActivation,
  requestEmailRecovery, recoverByEmail, recoverOmarOnce };
