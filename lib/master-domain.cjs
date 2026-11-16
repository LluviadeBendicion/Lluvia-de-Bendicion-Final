const { randomUUID, randomBytes, scryptSync } = require('node:crypto');
const { Invalid, iso } = require('./prayer-domain.cjs');

const modules = ['prayers', 'donations', 'affiliates', 'billing', 'proposals', 'editorial', 'wallpapers', 'testimonies', 'reports', 'configuration', 'incidents'];
const labels = {
  prayers: 'Peticiones de oración', donations: 'Donaciones', affiliates: 'Afiliados', billing: 'Facturación',
  proposals: 'Propuestas', editorial: 'Contenido', wallpapers: 'Wallpapers', testimonies: 'Testimonios', reports: 'Reportes',
  configuration: 'Configuración', incidents: 'Control de incidentes'
};
const roles = { 'section-admin': 'Administrador de sección', editor: 'Editor', collaborator: 'Colaborador', reader: 'Solo lectura', temporary: 'Usuario temporal' };
const steps = ['Propuesta', 'Envío', 'Aceptación', 'Contrato', 'Facturación', 'Pago', 'Cliente activo'];
const currencies = ['USD', 'MXN', 'EUR', 'COP', 'DOP', 'CAD'];

function database(state) {
  return state.master ||= { donations: {}, affiliates: {}, billing: {}, proposals: {}, editorial: {}, incidents: {}, settings: {}, users: {}, audit: [] };
}

function rights(user, module) {
  if (user.role === 'master') return 'edit';
  const access = user.modules?.[module] || (module === 'prayers' && user.permissions.includes('read') ? (user.permissions.includes('edit') ? 'edit' : 'read') : '');
  if (access === 'edit' && !['reader', 'collaborator'].includes(user.role)) return 'edit';
  return ['read', 'edit'].includes(access) ? 'read' : '';
}

function requireAccess(user, module, write = false) {
  const access = rights(user, module);
  if (!access || (write && access !== 'edit')) throw new Invalid('No tienes permiso para este módulo.', 403);
}

function text(raw, label, max = 160, required = true) {
  if (raw != null && typeof raw !== 'string') throw new Invalid(`Revisa ${label}.`);
  const data = (raw || '').trim();
  if ((required && !data) || data.length > max) throw new Invalid(`Revisa ${label}.`);
  return data;
}

function date(raw) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Invalid('Indica una fecha válida.');
  const day = new Date(raw);
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== raw) throw new Invalid('Indica una fecha válida.');
  return raw;
}

function money(body) {
  if (!currencies.includes(body.currency)) throw new Invalid('Elige una moneda válida.');
  const raw = text(body.amount, 'el importe', 14).replace(',', '.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)) throw new Invalid('Ingresa un importe válido con hasta dos decimales.');
  const [units, fraction = ''] = raw.split('.');
  const amount = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount <= 0) throw new Invalid('El importe debe ser mayor que cero.');
  return { amount, currency: body.currency };
}

function record(collection, id) {
  const item = typeof id === 'string' && Object.hasOwn(collection, id) && collection[id];
  if (!item) throw new Invalid('El registro no está disponible.', 404);
  return item;
}

function asClient(db, id, changes = false) {
  const client = record(db.affiliates, id);
  if (changes && ['banned', 'discontinued'].includes(client.status)) throw new Invalid('El cliente está bloqueado o descontinuado.');
  return client;
}

function event(db, user, op, recordId) {
  db.audit.push({ at: iso(), by: user.id, operation: op, recordId });
  if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
}

function totals(records) {
  return records.reduce((sum, row) => { sum[row.currency] = (sum[row.currency] || 0) + row.amount; return sum; }, {});
}

function staffEntry(user) {
  return { id: user.id, name: user.name, role: user.role, permissions: user.permissions || [], modules: user.modules || {},
    expires: user.expires || '', disabled: Boolean(user.disabled) };
}

function list(state, user, action, body, users) {
  const db = database(state);
  if (action === 'master-overview') {
    const pending = items => Object.values(items).filter(item => ['draft', 'review'].includes(item.status));
    const queue = pending(db.editorial);
    const affiliates = Object.values(db.affiliates);
    return { access: Object.fromEntries(modules.map(module => [module, rights(user, module)])),
      metrics: {
        editorial: rights(user, 'editorial') ? queue.filter(item => item.kind !== 'wallpapers').length : null,
        wallpapers: rights(user, 'wallpapers') ? queue.filter(item => item.kind === 'wallpapers').length : null,
        prospects: rights(user, 'affiliates') ? affiliates.filter(item => item.status === 'prospect').length : null,
        active: rights(user, 'affiliates') ? affiliates.filter(item => item.status === 'active').length : null,
        billing: rights(user, 'billing') ? Object.values(db.billing).filter(item => item.status === 'open').length : null
      },
      recent: queue.filter(item => rights(user, item.kind === 'wallpapers' || item.kind === 'testimonies' ? item.kind : 'editorial')).slice(-6).reverse(),
      master: user.role === 'master', settings: db.settings };
  }
  if (action !== 'master-list') throw new Invalid('Acción inválida.');
  const module = body.module;
  if (module === 'users') {
    requireAccess(user, 'users');
    return { rows: Object.values(users).map(staffEntry), roles, labels };
  }
  if (module === 'audit') {
    requireAccess(user, 'audit');
    return { rows: db.audit.slice(-150).reverse() };
  }
  requireAccess(user, module);
  if (module === 'reports') return { donations: rights(user, 'donations') ? totals(Object.values(db.donations).filter(row => !row.voided)) : null,
    due: rights(user, 'billing') ? totals(Object.values(db.billing).filter(row => row.status === 'open')) : null,
    paid: rights(user, 'billing') ? totals(Object.values(db.billing).filter(row => row.status === 'paid')) : null };
  if (module === 'configuration') return { settings: db.settings };
  if (['editorial','wallpapers','testimonies'].includes(module)) return { rows: Object.values(db.editorial).filter(item => {
    if (module === 'editorial') return !['wallpapers','testimonies'].includes(item.kind);
    return item.kind === module;
  }).reverse() };
  const rows = Object.values(db[module] || {}).reverse();
  const clients = ['billing','proposals'].includes(module) ? Object.values(db.affiliates).filter(item => !['banned','discontinued'].includes(item.status))
    .map(({ id, name }) => ({ id, name })) : [];
  const contracts = module === 'billing' ? Object.values(db.proposals).filter(item => item.step === 3)
    .map(({ id, clientId, title }) => ({ id, clientId, title })) : [];
  return { rows, clients, contracts };
}

function manageUser(state, db, user, body, users) {
  requireAccess(user, 'users', true);
  const id = text(body.id, 'el usuario', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || id === 'omar-rivera') throw new Invalid('El usuario indicado no puede modificarse.');
  const existing = users[id];
  if (body.operation === 'disable-user') {
    if (!existing) throw new Invalid('Usuario no disponible.');
    db.users[id] = { ...existing, disabled: true };
    for (const [key, session] of Object.entries(state.sessions)) if (session.id === id) delete state.sessions[key];
    event(db, user, body.operation, id);
    return { item: staffEntry(db.users[id]) };
  }
  if (body.operation !== 'save-user') throw new Invalid('Acción inválida.');
  const role = body.role;
  if (!Object.hasOwn(roles, role)) throw new Invalid('Selecciona un rol válido.');
  const profile = { id, name: text(body.name, 'el nombre'), role, disabled: false,
    expires: body.expires ? date(body.expires) + 'T23:59:59Z' : '' };
  if (role === 'temporary' && (!profile.expires || Date.parse(profile.expires) <= Date.now())) {
    throw new Invalid('Indica una fecha futura para el acceso temporal.');
  }
  profile.modules = {};
  for (const module of modules) {
    const allowed = body.modules?.[module];
    if (['read','edit'].includes(allowed)) profile.modules[module] = role === 'reader' ? 'read' : allowed;
  }
  profile.permissions = profile.modules.prayers ? ['read', ...(profile.modules.prayers === 'edit' && role !== 'collaborator' ? ['edit'] : []),
    ...(['restricted','export','present'].filter(key => Array.isArray(body.permissions) && body.permissions.includes(key))) ] : [];
  let enrollment;
  if (existing && body.reset !== true) {
    for (const key of ['salt','passwordHash']) profile[key] = existing[key];
  } else {
    const password = randomBytes(15).toString('base64url');
    profile.salt = randomBytes(16).toString('hex');
    profile.passwordHash = scryptSync(password, profile.salt, 32).toString('hex');
    enrollment = { password };
  }
  db.users[id] = profile;
  for (const [key, session] of Object.entries(state.sessions)) if (session.id === id) delete state.sessions[key];
  event(db, user, body.operation, id);
  return { item: staffEntry(profile), enrollment };
}

function save(state, user, body, users) {
  const db = database(state);
  const { module, operation } = body;
  if (module === 'users') return manageUser(state, db, user, body, users);
  requireAccess(user, module, true);
  const now = iso();
  const base = { id: randomUUID(), created: now, createdBy: user.id };
  let item;
  switch (`${module}:${operation}`) {
    case 'donations:create':
      item = { ...base, ...money(body), date: date(body.date), method: text(body.method, 'el medio', 60),
        reference: text(body.reference, 'la referencia', 160, false), note: text(body.note, 'la nota', 500, false), voided: false };
      db.donations[item.id] = item;
      break;
    case 'donations:void':
      item = record(db.donations, body.id);
      if (item.voided) throw new Invalid('La donación ya está anulada.');
      item.voided = { at: now, by: user.id, reason: text(body.reason, 'el motivo', 500) };
      break;
    case 'affiliates:create':
      item = { ...base, name: text(body.name, 'el nombre'), contact: text(body.contact, 'el contacto', 160, false),
        status: 'prospect', history: [], tasks: [] };
      db.affiliates[item.id] = item;
      break;
    case 'affiliates:status':
      item = record(db.affiliates, body.id);
      if (!['prospect','active','banned','discontinued'].includes(body.status) || body.status === item.status) throw new Invalid('Selecciona un estado diferente.');
      if (['banned','discontinued'].includes(item.status) && user.role !== 'master') throw new Invalid('Solo Omar puede reactivar este cliente.', 403);
      if (body.status === 'active' && !Object.values(db.billing).some(invoice => invoice.clientId === item.id && invoice.status === 'paid')) {
        throw new Invalid('Registra primero el pago de este cliente.');
      }
      item.status = body.status;
      item.history.push({ at: now, by: user.id, status: item.status, reason: text(body.reason, 'el motivo', 500) });
      if (item.status === 'active') {
        for (const proposal of Object.values(db.proposals).filter(row => row.clientId === item.id && row.step === 5)) {
          proposal.step = 6;
          proposal.history.push({ at: now, by: user.id, step: 6, reference: 'Cliente activo' });
        }
      }
      if (item.status === 'discontinued') item.tasks = ['Retirar flyer y video con autorización', 'Retirar menciones y comerciales de ZaraRadio']
        .map(label => ({ id: randomUUID(), label, created: now, done: null }));
      break;
    case 'affiliates:task': {
      item = record(db.affiliates, body.id);
      if (user.role !== 'master') throw new Invalid('Solo Omar puede registrar el retiro autorizado.', 403);
      const task = item.tasks.find(row => row.id === body.task && !row.done);
      if (!task) throw new Invalid('Esta tarea ya no está pendiente.');
      task.done = { at: now, by: user.id, note: text(body.note, 'la constancia del retiro', 500) };
      break;
    }
    case 'proposals:create': {
      const client = asClient(db, body.clientId, true);
      item = { ...base, clientId: client.id, clientName: client.name, title: text(body.title, 'el título'),
        text: text(body.text, 'la propuesta', 5000), step: 0, history: [] };
      db.proposals[item.id] = item;
      break;
    }
    case 'proposals:advance':
      item = record(db.proposals, body.id);
      asClient(db, item.clientId, true);
      if (item.step !== body.step || item.step >= 3) throw new Invalid('Consulta la etapa vigente antes de avanzar.', 409);
      item.step++;
      item.history.push({ at: now, by: user.id, step: item.step, reference: text(body.reference, 'la constancia de la etapa', 500) });
      break;
    case 'billing:create': {
      const client = asClient(db, body.clientId, true);
      const proposal = record(db.proposals, body.proposalId);
      if (proposal.clientId !== client.id || proposal.step !== 3) throw new Invalid('Selecciona una propuesta con contrato registrado.');
      const number = text(body.number, 'el número de factura', 60);
      if (Object.values(db.billing).some(row => row.number.toLowerCase() === number.toLowerCase())) throw new Invalid('Ese número de factura ya existe.');
      item = { ...base, ...money(body), number, clientId: client.id, clientName: client.name, proposalId: proposal.id,
        due: date(body.due), status: 'open' };
      db.billing[item.id] = item;
      proposal.step = 4;
      proposal.history.push({ at: now, by: user.id, step: 4, reference: item.number });
      break;
    }
    case 'billing:pay':
      item = record(db.billing, body.id);
      asClient(db, item.clientId, true);
      if (item.status !== 'open') throw new Invalid('La factura ya no está pendiente.');
      item.status = 'paid';
      item.payment = { date: date(body.date), reference: text(body.reference, 'la referencia del pago'), by: user.id, at: now };
      if (item.proposalId && db.proposals[item.proposalId]) {
        const proposal = db.proposals[item.proposalId];
        proposal.step = 5;
        proposal.history.push({ at: now, by: user.id, step: 5, reference: item.payment.reference });
      }
      break;
    case 'configuration:save':
      item = { language: 'es', timezone: text(body.timezone, 'la zona horaria', 100), compact: Boolean(body.compact),
        name: text(body.name, 'el nombre del sitio'), slogan: text(body.slogan, 'el lema') };
      try { new Intl.DateTimeFormat('es', { timeZone: item.timezone }); } catch { throw new Invalid('Ingresa una zona horaria reconocida.'); }
      db.settings = { ...item, savedAt: now };
      break;
    case 'incidents:create':
      item = { ...base, title: text(body.title, 'el título'), detail: text(body.text, 'la descripción', 2000), resolved: null };
      db.incidents[item.id] = item;
      break;
    case 'incidents:resolve':
      item = record(db.incidents, body.id);
      item.resolved = { at: now, by: user.id, note: text(body.note, 'la resolución', 500) };
      break;
    default:
      if (!['editorial','wallpapers','testimonies'].includes(module)) throw new Invalid('Acción inválida.');
      return saveEditorial(db, user, body, now, base);
  }
  event(db, user, `${module}:${operation}`, item.id);
  return { item };
}

function saveEditorial(db, user, body, now, base) {
  const { module, operation } = body;
  let item;
  if (operation === 'create') {
    const kind = module === 'editorial' ? text(body.kind, 'la sección', 80) : module;
    if (module === 'editorial' && ['wallpapers','testimonies'].includes(kind)) throw new Invalid('Abre el módulo correspondiente.');
    item = { ...base, kind, title: text(body.title, 'el título'), text: text(body.text, 'el contenido', 14000),
      status: 'draft', revision: randomUUID(), history: [] };
    db.editorial[item.id] = item;
  } else {
    item = record(db.editorial, body.id);
    const expected = ['wallpapers','testimonies'].includes(item.kind) ? item.kind : 'editorial';
    if (module !== expected || item.revision !== body.revision) throw new Invalid('El borrador cambió. Actualiza la lista.', 409);
    item.history.push({ at: now, by: user.id, revision: item.revision, status: item.status,
      title: item.title, text: item.text, approval: item.approval || null });
    if (operation === 'edit' || operation === 'restore') {
      const source = operation === 'restore' ? item.history.find(row => row.revision === body.from) : body;
      if (!source) throw new Invalid('Esa versión no está disponible.');
      item.title = text(source.title, 'el título');
      item.text = text(source.text, 'el contenido', 14000);
      item.revision = randomUUID();
      item.status = 'draft';
      item.approval = null;
      item.scheduled = '';
    } else if (operation === 'submit' && item.status === 'draft') item.status = 'review';
    else if (operation === 'reject' && item.status === 'review') item.status = 'rejected';
    else if (operation === 'approve' && item.status === 'review' && user.role === 'master' && body.reviewed === true) {
      item.status = 'approved';
      item.approval = { by: user.id, at: now, revision: item.revision };
    } else if (operation === 'schedule' && item.status === 'approved' && item.approval?.revision === item.revision && user.role === 'master') {
      item.scheduled = date(body.scheduled);
    } else throw new Invalid('Esta acción requiere una revisión o autorización vigente.', 403);
  }
  event(db, user, `${module}:${operation}`, item.id);
  return { item };
}

module.exports = { database, list, save, labels, roles, steps, currencies };
