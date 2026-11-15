module.exports = async function bible(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const { ref, q } = req.query;
  if (!(typeof ref === 'string' && /^[1-3]?[A-Z]{2,3}\.[1-9]\d{0,2}(?:\.[1-9]\d{0,2})?$/.test(ref)) &&
      !(typeof q === 'string' && q.trim() && q.length <= 160 && ref === undefined)) {
    return res.status(400).json({ error: 'Escribe una referencia o una palabra válida.' });
  }
  const key = process.env.API_BIBLE_KEY;
  const bibleId = process.env.API_BIBLE_RVR1960_ID;
  if (!key || !bibleId || !/^[a-zA-Z0-9-]+$/.test(bibleId)) {
    return res.status(503).json({ error: 'La lectura en Reina-Valera 1960 está pendiente de activación.' });
  }

  const route = ref ? (ref.split('.').length === 3 ? '/verses/' : '/chapters/') + ref : '/search';
  const params = ref ? { 'content-type': 'text', 'include-verse-numbers': 'true' } : { query: q.trim(), limit: '20' };
  const copyright = 'Reina-Valera 1960® © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988.';
  try {
    const response = await fetch('https://rest.api.bible/v1/bibles/' + bibleId + route + '?' + new URLSearchParams(params), {
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
      return res.json({ reference: data.reference, text: data.content, credit: data.copyright || copyright });
    }
    const verses = (data?.verses || []).filter(verse => typeof verse.id === 'string' && typeof verse.text === 'string')
      .map(({ id, reference, text }) => ({ id, reference, text }));
    return res.json({ verses, credit: data?.copyright || copyright });
  } catch {
    return res.status(502).json({ error: 'El servicio bíblico no está disponible en este momento.' });
  }
};
