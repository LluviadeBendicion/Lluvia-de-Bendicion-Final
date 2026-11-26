(() => {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function referenceId(reference) {
    const match = String(reference).trim().match(/^(.+?)\s+(\d{1,3})(?::(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?$/);
    if (!match) throw new Error('Referencia bíblica no reconocida.');
    let name = normalize(match[1]);
    if (name === 'salmo') name = 'salmos';
    const option = [...document.querySelectorAll('#resources-reading select[name="book"] option')].find(item => normalize(item.textContent) === name);
    if (!option || Number(match[2]) < 1 || (match[3] && Number(match[3]) < 1) || (match[4] && Number(match[4]) < Number(match[3]))) throw new Error('Referencia bíblica no válida.');
    const chapter = option.value + '.' + Number(match[2]);
    const start = chapter + (match[3] ? '.' + Number(match[3]) : '');
    return match[4] ? start + '-' + chapter + '.' + Number(match[4]) : start;
  }
  async function request(params) {
    const response = await fetch('/api/bible?' + new URLSearchParams(params), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No pudimos consultar la NVI. Intenta de nuevo.');
    if (data.version !== 'NVI') throw new Error('La respuesta no corresponde a la NVI.');
    return data;
  }
  const passage = reference => request({ ref: referenceId(reference) });
  async function appendPassage(container, reference) {
    const revision = (Number(container.dataset.nviRevision) || 0) + 1;
    container.dataset.nviRevision = revision;
    const reading = document.createElement('span');
    reading.style.whiteSpace = 'pre-line';
    reading.style.display = 'block';
    reading.textContent = 'Consultando lectura NVI…';
    container.append(reading);
    try {
      const data = await passage(reference);
      if (Number(container.dataset.nviRevision) === revision) reading.textContent = ['NVI', data.text, data.credit].filter(Boolean).join('\n\n');
    } catch (error) {
      if (Number(container.dataset.nviRevision) === revision) reading.textContent = error.message;
    }
  }
  window.LLDBBible = { request, passage, referenceId, appendPassage };
})();
