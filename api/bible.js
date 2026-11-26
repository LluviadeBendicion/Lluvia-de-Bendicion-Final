const provider = 'https://rest.api.bible/v1/bibles';
let editionLookup;
let editionExpires = 0;

function isNvi(edition) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const names = [edition.name, edition.nameLocal, edition.abbreviation, edition.abbreviationLocal].map(normalize);
  return typeof edition.id === 'string' && /^[a-zA-Z0-9-]+$/.test(edition.id) &&
    names.some(name => /\bnvi(?:[\s-]*s)?\b|nueva\s+version\s+internacional/.test(name));
}

async function discoverEdition(key) {
  const response = await fetch(provider + '?language=spa', {
    headers: { 'api-key': key }, redirect: 'error', signal: AbortSignal.timeout(10000)
  });
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    return { rejected: true };
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Catalog unavailable');
  }
  const { data } = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid catalog');
  return { id: data.find(isNvi)?.id };
}

function getEdition(key) {
  if (!editionLookup || Date.now() >= editionExpires) {
    editionExpires = Date.now() + 5 * 60 * 1000;
    editionLookup = discoverEdition(key).catch(error => {
      editionLookup = undefined;
      throw error;
    });
  }
  return editionLookup;
}

module.exports = async function bible(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const { ref, q } = req.query;
  if (ref !== undefined && q !== undefined) return res.status(400).json({ error: 'Consulta una referencia o una palabra, no ambas.' });
  const chapterOrVerse = /^[1-3]?[A-Z]{2,3}\.[1-9]\d{0,2}(?:\.[1-9]\d{0,2})?$/;
  const passage = /^[1-3]?[A-Z]{2,3}\.[1-9]\d{0,2}\.[1-9]\d{0,2}-[1-3]?[A-Z]{2,3}\.[1-9]\d{0,2}\.[1-9]\d{0,2}$/;
  if (!(typeof ref === 'string' && (chapterOrVerse.test(ref) || passage.test(ref))) &&
      !(typeof q === 'string' && q.trim() && q.length <= 160 && ref === undefined)) {
    return res.status(400).json({ error: 'Escribe una referencia o una palabra válida.' });
  }
  const key = process.env.API_BIBLE_KEY;
  if (!key) {
    return res.status(503).json({ error: 'La lectura en Nueva Versión Internacional (NVI) está pendiente de activación.' });
  }

  let route = '/search';
  if (ref) {
    if (passage.test(ref)) route = '/passages/' + ref;
    else route = (ref.split('.').length === 3 ? '/verses/' : '/chapters/') + ref;
  }
  const params = ref ? { 'content-type': 'text', 'include-verse-numbers': 'true' } : { query: q.trim(), limit: '20' };
  const copyright = 'Nueva Versión Internacional (NVI) © Biblica, Inc. Usado con permiso. Todos los derechos reservados.';
  try {
    const edition = await getEdition(key);
    if (edition.rejected) return res.status(503).json({ error: 'API.Bible rechazó la clave guardada.' });
    if (!edition.id) return res.status(503).json({ error: 'La cuenta de API.Bible todavía no tiene acceso a Nueva Versión Internacional (NVI).' });
    const response = await fetch(provider + '/' + edition.id + route + '?' + new URLSearchParams(params), {
      headers: { 'api-key': key }, redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) return res.status(404).json({ error: 'No se encontró esa referencia.' });
      return res.status(502).json({ error: 'El servicio bíblico no pudo completar la consulta. Intenta de nuevo.' });
    }
    const { data } = await response.json();
    if (ref) {
      if (typeof data?.content !== 'string') throw new Error('Missing scripture');
      return res.json({ version: 'NVI', reference: data.reference, text: data.content, credit: data.copyright || copyright });
    }
    const verses = (data?.verses || []).filter(verse => typeof verse.id === 'string' && typeof verse.text === 'string')
      .map(({ id, reference, text }) => ({ id, reference, text }));
    return res.json({ version: 'NVI', verses, credit: data?.copyright || copyright });
  } catch {
    return res.status(502).json({ error: 'El servicio bíblico no está disponible en este momento.' });
  }
};
