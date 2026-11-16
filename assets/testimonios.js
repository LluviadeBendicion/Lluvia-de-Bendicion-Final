(() => {
  const mural = document.querySelector('.testimonio-mural');
  const title = mural.querySelector('#testimony-title');
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

  function render() {
    const testimony = officialContent.testimonies;
    const entries = testimony?.enabled !== false && Array.isArray(testimony?.items) ? testimony.items : [];
    visibleItems = entries.filter(item => item?.text &&
      (!category || categoryKey(item.category || item.note) === category));
    position = Math.min(position, Math.max(0, visibleItems.length - 1));
    const item = visibleItems[position];
    const details = item ? [item.reference, item.note].filter(Boolean).join(' · ') : '';
    title.textContent = item?.title || '';
    title.hidden = !title.textContent;
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
