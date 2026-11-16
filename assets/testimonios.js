(() => {
  const mural = document.querySelector('.testimonio-mural');
  const title = mural.querySelector('#testimony-title');
  const location = mural.querySelector('#testimony-location');
  const theme = mural.querySelector('#testimony-theme');
  const people = mural.querySelector('.testimonio-personas');
  const exampleLabel = mural.querySelector('#testimony-example-label');
  const body = mural.querySelector('#testimony-body');
  const attribution = mural.querySelector('#testimony-meta');
  const themes = [...mural.querySelectorAll('[data-testimony-category]')];
  const arrows = [...mural.querySelectorAll('[data-testimony]')];
  const dots = [...mural.querySelectorAll('.testimonio-puntos span')];
  let category = '';
  let position = 0;
  let visibleItems = [];

  function categoryKey(value) {
    return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
      .trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function authorName(item) {
    return item?.author && item?.initial ? `${item.author} ${item.initial}.` : '';
  }

  function renderPeople() {
    const focused = people.contains(document.activeElement) ? document.activeElement.dataset.position : null;
    people.hidden = !category || visibleItems.length === 0;
    mural.toggleAttribute('data-people', !people.hidden);
    people.replaceChildren();
    if (people.hidden) return;
    visibleItems.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.position = index;
      button.setAttribute('aria-pressed', String(index === position));
      const name = document.createElement('strong');
      name.textContent = authorName(item) || item.title || `Testimonio ${index + 1}`;
      button.append(name);
      if (item.location) {
        const place = document.createElement('span');
        place.textContent = item.location;
        button.append(place);
      }
      button.addEventListener('click', () => {
        position = index;
        render();
      });
      people.append(button);
      if (focused === String(index)) button.focus({preventScroll:true});
    });
  }

  function render() {
    const testimony = officialContent.testimonies;
    const enabled = testimony?.enabled !== false;
    const entries = enabled && Array.isArray(testimony?.items) ? testimony.items : [];
    const examples = enabled && Array.isArray(testimony?.examples) ? testimony.examples : [];
    const matchesCategory = item => item?.text && (!category || categoryKey(item.category || item.note) === category);
    const published = entries.filter(matchesCategory);
    const showingExamples = published.length === 0;
    visibleItems = showingExamples ? examples.filter(matchesCategory) : published;
    position = Math.min(position, Math.max(0, visibleItems.length - 1));
    const item = visibleItems[position];
    const isExample = showingExamples && Boolean(item);
    const author = authorName(item);
    const details = item && !isExample && !author ? [item.reference, item.note].filter(Boolean).join(' · ') : '';
    mural.toggleAttribute('data-example', isExample);
    title.textContent = author || item?.title || '';
    title.hidden = !title.textContent;
    location.textContent = item?.location ? 'Desde ' + item.location : '';
    location.hidden = !location.textContent;
    const itemTheme = themes.find(button => button.dataset.testimonyCategory === categoryKey(item?.category || item?.note));
    theme.textContent = itemTheme?.innerText.replace(/\s+/g, ' ').trim() || '';
    theme.hidden = !theme.textContent;
    exampleLabel.hidden = !isExample;
    body.textContent = item?.text || (category
      ? 'Aún no hay testimonios publicados para este tema.'
      : 'Pronto compartiremos testimonios de nuestra comunidad.');
    attribution.textContent = details;
    attribution.hidden = !details;
    body.parentElement.scrollTop = 0;
    arrows.forEach(button => { button.disabled = visibleItems.length < 2; });
    const selected = themes.findIndex(button => button.dataset.testimonyCategory === category);
    dots.forEach((dot, index) => dot.classList.toggle('activo', index === (selected >= 0 ? selected : position % dots.length)));
    themes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.testimonyCategory === category)));
    renderPeople();
  }

  themes.forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.testimonyCategory;
    category = category === selected ? '' : selected;
    position = 0;
    render();
  }));
  arrows.forEach(button => button.addEventListener('click', () => {
    const count = visibleItems.length;
    if (count < 2) return;
    position = (position + Number(button.dataset.testimony) + count) % count;
    render();
  }));
  officialContentReady.then(render);
})();
