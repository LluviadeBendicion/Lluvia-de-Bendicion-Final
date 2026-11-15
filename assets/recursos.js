(() => {
  const reading = document.getElementById('resources-reading');
  const search = document.getElementById('resources-search');
  const results = document.getElementById('resources-results');
  const heading = document.getElementById('resources-results-title');
  const output = document.getElementById('resources-output');
  const credit = document.getElementById('resources-credit');
  let revision = 0;

  async function consult(params) {
    const current = ++revision;
    results.hidden = false;
    heading.textContent = params.q ? 'Concordancia bíblica' : 'Lectura bíblica';
    output.textContent = 'Consultando…';
    credit.textContent = '';
    results.scrollIntoView({ block: 'nearest' });
    try {
      const response = await fetch('/api/bible?' + new URLSearchParams(params));
      const data = await response.json();
      if (current !== revision) return;
      if (!response.ok) throw new Error(data.error);
      credit.textContent = data.credit || '';
      if (params.ref) {
        heading.textContent = data.reference || 'Lectura bíblica';
        output.textContent = data.text;
        return;
      }
      output.textContent = data.verses.length ? '' : 'No encontramos coincidencias.';
      for (const verse of data.verses) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = verse.reference;
        button.addEventListener('click', () => consult({ ref: verse.id }));
        const text = document.createElement('p');
        text.textContent = verse.text;
        output.append(button, text);
      }
    } catch (error) {
      if (current === revision) output.textContent = error.message || 'Intenta de nuevo.';
    }
  }

  reading.addEventListener('submit', event => {
    event.preventDefault();
    const { book, chapter, verse } = reading.elements;
    consult({ ref: [book.value, chapter.value, verse.value].filter(Boolean).join('.') });
  });
  search.addEventListener('submit', event => {
    event.preventDefault();
    const q = search.elements.quicksearch.value.trim();
    if (q) consult({ q });
  });
})();
