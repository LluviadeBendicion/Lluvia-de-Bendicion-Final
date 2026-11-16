(() => {
  const classroom = document.querySelector('.special-classroom');
  const choices = [...classroom.querySelectorAll('[data-resource]')];
  const board = document.getElementById('special-board');
  const title = document.getElementById('special-board-title');
  const writing = board.querySelector('.special-chalk-text');
  const back = classroom.querySelector('.special-return');
  const navigation = board.querySelector('.special-pages');
  const previous = navigation.querySelector('[data-page="previous"]');
  const next = navigation.querySelector('[data-page="next"]');
  const pageLabel = navigation.querySelector('[role="status"]');
  const mobile = window.matchMedia('(max-width: 760px)');
  const keys = {
    oracion: 'dailyPrayer',
    versiculo: 'dailyVerse',
    memorizar: 'memoryVerse',
    devocional: 'weeklyDevotional'
  };
  const defaultPrayer = 'Señor, gracias por este nuevo día. Guía mis pasos, fortalece mi fe y enséñame a compartir tu amor con quienes me rodean. Dame sabiduría para mis decisiones, paz para mi corazón y un espíritu dispuesto a servir. En el nombre de Jesús, amén.';
  let selected = null;
  let fullText = '';
  let pages = [];
  let page = 0;

  function showPage(index) {
    page = index;
    writing.textContent = pages[page];
    navigation.toggleAttribute('data-single', pages.length < 2);
    pageLabel.textContent = pages.length > 1 ? (page + 1) + ' / ' + pages.length : '';
    previous.disabled = page === 0;
    next.disabled = page === pages.length - 1;
  }

  function paginate() {
    if (!selected || !board.clientWidth) return;
    writing.textContent = fullText;
    pages = [fullText];
    if (!mobile.matches && writing.scrollHeight > writing.clientHeight + 1) {
      const words = fullText.match(/\S+\s*/gu) || [''];
      pages = [];
      for (let start = 0; start < words.length;) {
        let low = start + 1;
        let high = words.length;
        let end = low;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          writing.textContent = words.slice(start, middle).join('').trimEnd();
          if (writing.scrollHeight <= writing.clientHeight + 1) {
            end = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
        pages.push(words.slice(start, end).join('').trimEnd());
        start = end;
      }
    }
    showPage(Math.min(page, pages.length - 1));
  }

  function renderChoice() {
    const key = selected.dataset.resource;
    const entry = officialContent[keys[key]] || {};
    const text = entry.text || entry.content || (key === 'oracion' ? defaultPrayer : '');
    fullText = entry.enabled !== false && text
      ? [entry.title, text, entry.reference, entry.note].filter(Boolean).join('\n\n')
      : 'Contenido en preparación.';
    paginate();
  }

  choices.forEach(button => {
    button.addEventListener('click', () => {
      selected = button;
      page = 0;
      classroom.dataset.reading = button.dataset.resource;
      title.textContent = button.textContent;
      board.hidden = false;
      back.hidden = false;
      renderChoice();
      title.focus({ preventScroll: true });
    });
  });

  function closeReading() {
    if (!selected) return;
    const lastChoice = selected;
    selected = null;
    delete classroom.dataset.reading;
    board.hidden = true;
    back.hidden = true;
    lastChoice.focus({ preventScroll: true });
  }

  back.addEventListener('click', closeReading);
  classroom.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeReading();
  });
  previous.addEventListener('click', () => showPage(page - 1));
  next.addEventListener('click', () => showPage(page + 1));
  window.addEventListener('resize', paginate);
  document.fonts.load('20px Kalam').then(paginate, paginate);
  officialContentReady.then(() => { if (selected) renderChoice(); });
})();
