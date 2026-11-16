const { createHash, randomUUID } = require('node:crypto');
const options = require('../assets/peticion-opciones.json');

class Invalid extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function field(raw, max, label, required = false) {
  if (raw != null && typeof raw !== 'string') throw new Invalid(`Revisa el campo ${label}.`);
  const value = (raw || '').trim();
  if (value.length > max || (required && !value)) throw new Invalid(`Revisa el campo ${label}.`);
  return value;
}
const shareable = privacy => privacy === 'church' || privacy === 'anonymous';
const risks = ['Pensamientos de suicidio', 'Depresión', 'Pensamientos negativos'];
const iso = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');

function submission(body) {
  const first = field(body.first, 80, 'nombre', true);
  const last = field(body.last, 80, 'apellido', true);
  const city = field(body.city, 100, 'ciudad');
  const region = field(body.region, 100, 'estado');
  const country = field(body.country, 100, 'país');
  const text = field(body.text, 6000, 'petición', true);
  const category = body.category;
  const additional = body.additional ?? [];
  if (!options.categories.includes(category) || !Array.isArray(additional) || additional.length > 19 ||
      additional.includes(category) || new Set(additional).size !== additional.length ||
      additional.some(value => !options.categories.includes(value))) throw new Invalid('Selecciona motivos de oración válidos.');
  if (!Object.hasOwn(options.privacy, body.privacy)) throw new Invalid('Elige una opción de privacidad.');
  if (!['self', 'other'].includes(body.forWhom)) throw new Invalid('Indica por quién pides oración.');
  if (typeof body.follow !== 'boolean') throw new Invalid('Indica si deseas seguimiento.');
  const consent = shareable(body.privacy) && body.consent === true;
  let method = '';
  let contact = '';
  if (body.follow) {
    method = body.method;
    if (!Object.hasOwn(options.methods, method)) throw new Invalid('Elige cómo podemos comunicarnos contigo.');
    contact = field(body.contact, 150, 'contacto', true);
    if (method === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) :
      !/^\+?[\d\s().-]+$/.test(contact) || contact.replace(/\D/g, '').length < 7 || contact.replace(/\D/g, '').length > 15) {
      throw new Invalid('Ingresa un dato de contacto válido.');
    }
  }
  const restricted = [category, ...additional].some(value => risks.includes(value));
  return {
    id: randomUUID(), received: iso(), version: 1, first, last, city, region, country, text,
    category, additional, forWhom: body.forWhom, privacy: body.privacy,
    consent: consent ? { at: iso(), scope: body.privacy, noticeVersion: 1 } : null,
    method, contact, restricted, urgent: [category, ...additional].includes('Pensamientos de suicidio'),
    owner: '', state: 'new', next: '', notes: [], contacts: [], history: [], draft: null, active: null
  };
}

function permitted(user, permission) { return user.role === 'master' || user.permissions.includes(permission); }
function visible(user, item) {
  return permitted(user, 'read') && (!(item.restricted || item.privacy === 'confidential') || permitted(user, 'restricted'));
}

function date(raw) {
  if (!raw) return '';
  if (typeof raw !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(raw)) throw new Invalid('Ingresa una fecha válida.');
  const parsed = new Date(raw);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== raw) throw new Invalid('Ingresa una fecha válida.');
  return raw;
}

function eligible(item) {
  return shareable(item.privacy) && Boolean(item.consent) && !item.restricted && !item.urgent;
}

function sanitizedText(item, raw) {
  const value = field(raw, 2000, 'texto para presentar', true);
  const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const cleaned = ' ' + normalize(value).replace(/[^\p{L}\d]+/gu, ' ') + ' ';
  const identity = [item.first, item.last, item.city, item.contact].filter(Boolean);
  if (/https?:|www\.|[\w.%+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){7}/i.test(value) ||
      identity.some(part => cleaned.includes(' ' + normalize(part).replace(/[^\p{L}\d]+/gu, ' ').trim() + ' '))) {
    throw new Invalid('Quita nombres, lugares concretos y datos de contacto del texto para presentar.');
  }
  return value;
}

function mutate(item, input, user, users) {
  if (!visible(user, item) || !permitted(user, 'edit')) throw new Invalid('No tienes permiso para modificar este expediente.', 403);
  if (item.version !== input.version) throw new Invalid('El expediente cambió. Ábrelo de nuevo e inténtalo otra vez.', 409);
  const at = iso();
  const action = input.operation;
  switch (action) {
    case 'state':
      if (!Object.hasOwn(options.states, input.state)) throw new Invalid('Selecciona un estado válido.');
      item.state = input.state;
      if (['rejected', 'archived'].includes(input.state)) { item.active = null; item.draft = null; }
      break;
    case 'urgent':
      if (typeof input.urgent !== 'boolean' || (!input.urgent && item.restricted)) throw new Invalid('La urgencia de un caso sensible no se puede quitar aquí.');
      item.urgent = input.urgent;
      if (item.urgent) {
        item.restricted = true;
        item.active = null;
        item.draft = null;
        if (item.owner && !visible(users[item.owner] || { permissions: [] }, item)) item.owner = '';
      }
      break;
    case 'assign':
      if (input.owner !== '' && (!Object.hasOwn(users, input.owner) || !visible(users[input.owner], item) || !permitted(users[input.owner], 'edit'))) {
        throw new Invalid('Selecciona a una persona con permiso para este expediente.');
      }
      item.owner = input.owner;
      break;
    case 'note':
      item.notes.push({ at, by: user.id, text: field(input.text, 2000, 'nota interna', true) });
      break;
    case 'follow':
      if (!item.method || input.medium !== item.method) throw new Invalid('Solo puede registrarse contacto por el medio que la persona autorizó.');
      item.next = date(input.next);
      item.contacts.push({ at, by: user.id, medium: input.medium, occurred: date(input.occurred) || at.slice(0, 10),
        result: field(input.result, 500, 'resultado', true), note: field(input.note, 2000, 'notas privadas'), next: item.next });
      item.state = 'following';
      break;
    case 'remind':
      item.next = date(input.next);
      break;
    case 'draft': {
      if (!eligible(item) || ['archived', 'rejected'].includes(item.state)) throw new Invalid('Este expediente no puede preparar una versión para compartir.');
      const text = sanitizedText(item, input.text);
      item.draft = { text, id: hash(randomUUID() + text), by: user.id, at, requested: null, approved: null };
      break;
    }
    case 'request':
      if (!eligible(item) || !item.draft || item.state !== 'approved' || input.draftId !== item.draft.id || input.attest !== true) {
        throw new Invalid('Aprueba internamente el caso y revisa la vista previa sin datos personales antes de solicitar autorización.');
      }
      item.draft.requested = { at, by: user.id, id: item.draft.id };
      item.draft.approved = null;
      break;
    case 'authorize':
    case 'publish':
      if (user.role !== 'master') throw new Invalid('Solo Omar puede autorizar o publicar.', 403);
      if (!eligible(item) || item.state !== 'approved' || !item.draft || item.draft.requested?.id !== input.draftId ||
          item.draft.id !== input.draftId) throw new Invalid('Solicita autorización para la versión vigente.');
      if (action === 'authorize') {
        if (input.attest !== true) throw new Invalid('Confirma que revisaste el texto exacto de la vista previa.');
        sanitizedText(item, item.draft.text);
        item.draft.approved = { at, by: user.id, id: item.draft.id };
      } else {
        if (item.draft.approved?.id !== item.draft.id) throw new Invalid('La versión vigente todavía no está autorizada.');
        item.active = { id: item.draft.id, text: item.draft.text, at, by: user.id, order: item.active?.order || 0 };
      }
      break;
    case 'order':
      if (!permitted(user, 'present') || !item.active || !Number.isSafeInteger(input.order) || input.order < 0 || input.order > 9999) {
        throw new Invalid('Selecciona un orden de 0 a 9999 para una petición publicada.');
      }
      item.active.order = input.order;
      break;
    case 'withdraw':
      if (user.role !== 'master') throw new Invalid('Solo Omar puede retirar una presentación.', 403);
      item.active = null;
      if (item.draft) { item.draft.approved = null; item.draft.requested = null; }
      break;
    default: throw new Invalid('Acción inválida.');
  }
  item.version++;
  item.history.push({ at, by: user.id, action, version: item.version, state: item.state, owner: item.owner,
    draft: item.draft ? { ...item.draft } : null });
  return item;
}

module.exports = { Invalid, submission, permitted, visible, mutate, eligible, hash, iso };
