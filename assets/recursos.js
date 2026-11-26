(() => {
  const view = document.getElementById('estudios');
  const screen = document.getElementById('resources-screen');
  const power = document.getElementById('resources-power');
  const powerLabel = document.getElementById('resources-power-label');
  const back = document.getElementById('resources-back');
  const welcome = screen.querySelector('.resources-welcome');
  const launcher = screen.querySelector('.resources-launcher');
  const launchButtons = [...launcher.querySelectorAll('button')];
  const panelGroup = screen.querySelector('.resources-panels');
  const panels = [...panelGroup.querySelectorAll('.resources-panel')];
  const bible = document.getElementById('library-bible');
  const concordance = document.getElementById('library-search');
  const reading = document.getElementById('resources-reading');
  const search = document.getElementById('resources-search');
  const heading = document.getElementById('resources-results-title');
  const output = document.getElementById('resources-output');
  const credit = document.getElementById('resources-credit');
  const passageStatus = document.getElementById('resources-passage-status');
  const searchOutput = document.getElementById('resources-search-output');
  const searchCredit = document.getElementById('resources-search-credit');
  const note = document.getElementById('resources-note-form');
  const noteButton = bible.querySelector('[data-passage-action="note"]');
  const favorite = bible.querySelector('[data-passage-action="favorite"]');
  const actions = [...bible.querySelectorAll('[data-passage-action]')];
  const openingVerse = { reference: heading.textContent, text: output.textContent, credit: credit.textContent };
  let loaded = false;
  let activePanel = null;
  let welcomeTimer;
  let passageId = 'GEN.1.1';
  let readingRevision = 0;
  let searchRevision = 0;

  function setPower(on) {
    power.setAttribute('aria-expanded', String(on));
    powerLabel.textContent = on ? 'Apagar pantalla' : 'Encender pantalla';
    screen.hidden = !on;
  }

  function project(selected, focus = true) {
    window.clearTimeout(welcomeTimer);
    welcome.hidden = true;
    const previous = activePanel;
    activePanel = selected;
    if (selected === bible && !loaded) { loaded = true; read(passageId); return; }
    if (selected) {
      setPower(true);
      screen.dataset.focused = selected.id;
    } else {
      delete screen.dataset.focused;
    }
    launcher.hidden = Boolean(selected);
    back.hidden = !selected;
    panelGroup.hidden = !selected;
    for (const panel of panels) {
      panel.hidden = selected !== panel;
    }
    screen.scrollTop = 0;
    if (focus && !screen.hidden) {
      const target = selected ? back : launchButtons.find(button => button.getAttribute('aria-controls') === previous?.id) || launchButtons[0];
      target.focus({ preventScroll: getComputedStyle(screen).position === 'absolute' });
    }
  }

  function turnOff() {
    setPower(false);
    project(null, false);
  }

  function showWelcome(focus = false) {
    setPower(true);
    welcome.hidden = false;
    launcher.hidden = true;
    welcomeTimer = window.setTimeout(() => {
      project(null, focus && document.activeElement === power);
    }, 1450);
  }

  power.addEventListener('click', () => {
    if (screen.hidden) {
      showWelcome(true);
    } else {
      turnOff();
    }
  });
  back.addEventListener('click', () => project(null));
  for (const button of launchButtons) {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => project(panel));
  }
  document.querySelectorAll('[data-library-entry]').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.dataset.libraryEntry);
      requestAnimationFrame(() => {
        if (view.classList.contains('active')) project(panel);
      });
    });
  });
  new MutationObserver(() => {
    if (view.classList.contains('active')) {
      if (screen.hidden) showWelcome();
    } else if (!screen.hidden) {
      turnOff();
    }
  }).observe(view, { attributes: true, attributeFilter: ['class'] });
  if (view.classList.contains('active')) showWelcome();

  async function request(params) {
    return window.LLDBBible.request(params);
  }

  function localKey(kind) {
    return 'lldb-recursos:NVI:' + kind + ':' + passageId;
  }

  function savedValue(kind) {
    try {
      return localStorage.getItem(localKey(kind)) || '';
    } catch {
      return '';
    }
  }

  function showPassage(data, ref) {
    passageId = ref;
    heading.textContent = data.reference || 'Lectura bíblica';
    output.textContent = data.text;
    credit.textContent = data.credit || '';
    passageStatus.textContent = '';
    note.hidden = true;
    noteButton.setAttribute('aria-expanded', 'false');
    favorite.setAttribute('aria-pressed', String(Boolean(savedValue('favorite'))));
  }

  async function read(ref) {
    loaded = true;
    const current = ++readingRevision;
    project(bible);
    passageStatus.textContent = 'Consultando…';
    actions.forEach(button => { button.disabled = true; });
    let succeeded = false;
    try {
      const data = await request({ ref });
      if (current === readingRevision) { showPassage(data, ref); succeeded = true; }
    } catch (error) {
      if (current === readingRevision) {
        output.textContent = '';
        credit.textContent = '';
        passageStatus.textContent = error.message || 'Intenta de nuevo.';
      }
    } finally {
      if (current === readingRevision) actions.forEach(button => { button.disabled = !succeeded; });
    }
  }

  reading.addEventListener('submit', event => {
    event.preventDefault();
    const { book, chapter, verse } = reading.elements;
    const entered = verse.value.trim();
    const match = entered.match(/^([1-9]\d{0,2})(?:\s*[-–—]\s*([1-9]\d{0,2}))?$/);
    if (entered && (!match || Number(match[2]) < Number(match[1]))) {
      verse.setCustomValidity('Escribe un versículo o un rango ascendente, por ejemplo 1–3.');
      verse.reportValidity();
      return;
    }
    const chapterId = book.value + '.' + chapter.value;
    const ref = match ? chapterId + '.' + match[1] : chapterId;
    read(match?.[2] && match[1] !== match[2] ? ref + '-' + chapterId + '.' + match[2] : ref);
  });
  reading.elements.verse.addEventListener('input', event => event.target.setCustomValidity(''));

  searchOutput.addEventListener('click', event => {
    const result = event.target.closest('[data-bible-ref]');
    if (result) read(result.dataset.bibleRef);
  });
  const previousSearch = document.getElementById('resources-search-previous');
  const nextSearch = document.getElementById('resources-search-next');
  const searchPage = document.getElementById('resources-search-page');
  let currentQuery = '';
  let searchOffset = 0;
  let hasMore = false;
  let searching = false;
  function searchControls() {
    previousSearch.disabled = searching || searchOffset === 0;
    nextSearch.disabled = searching || !hasMore;
  }
  async function find(query, offset = 0) {
    const q = query.trim();
    if (!q) return;
    const current = ++searchRevision;
    currentQuery = q;
    search.elements.quicksearch.value = q;
    project(concordance);
    searching = true;
    searchControls();
    searchOutput.textContent = 'Buscando en la NVI…';
    searchCredit.textContent = '';
    searchPage.textContent = '';
    try {
      const data = await request({ q, offset: String(offset) });
      if (current !== searchRevision) return;
      searchOffset = offset;
      hasMore = data.hasMore;
      searchOutput.textContent = data.verses.length ? '' : 'No encontramos coincidencias.';
      for (const verse of data.verses) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = verse.reference + ' · NVI';
        button.dataset.bibleRef = verse.id;
        const text = document.createElement('p');
        text.textContent = verse.text;
        searchOutput.append(button, text);
      }
      searchCredit.textContent = data.credit || '';
      searchPage.textContent = 'Página ' + (offset / 20 + 1) + (data.total === null ? '' : ' · ' + data.total + ' coincidencias');
    } catch (error) {
      if (current === searchRevision) {
        searchOffset = offset;
        hasMore = false;
        searchOutput.textContent = error.message || 'Intenta de nuevo.';
      }
    } finally {
      if (current === searchRevision) { searching = false; searchControls(); }
    }
  }
  search.addEventListener('submit', event => {
    event.preventDefault();
    find(search.elements.quicksearch.value);
  });
  previousSearch.addEventListener('click', () => find(currentQuery, Math.max(0, searchOffset - 20)));
  nextSearch.addEventListener('click', () => find(currentQuery, searchOffset + 20));
  const bibleSearch = document.getElementById('resources-bible-search');
  bibleSearch.addEventListener('submit', event => {
    event.preventDefault();
    const query = bibleSearch.elements.query.value.trim();
    if (!query) return;
    let ref;
    try { ref = window.LLDBBible.referenceId(query); } catch { /* Buscar palabras y frases en concordancia. */ }
    if (ref) read(ref);
    else find(query);
  });

  bible.querySelector('.resources-actions').addEventListener('click', async event => {
    const button = event.target.closest('[data-passage-action]');
    if (!button) return;
    const action = button.dataset.passageAction;
    const text = [heading.textContent, output.textContent, credit.textContent].filter(Boolean).join('\n');
    try {
      if (action === 'note') {
        note.hidden = !note.hidden;
        button.setAttribute('aria-expanded', String(!note.hidden));
        if (!note.hidden) {
          note.elements.note.value = savedValue('note');
          note.elements.note.focus();
        }
      } else if (action === 'favorite') {
        const selected = button.getAttribute('aria-pressed') !== 'true';
        if (selected) localStorage.setItem(localKey('favorite'), '1');
        else localStorage.removeItem(localKey('favorite'));
        button.setAttribute('aria-pressed', String(selected));
        passageStatus.textContent = selected ? 'Guardado en este dispositivo.' : 'Eliminado de favoritos.';
      } else if (action === 'share' && navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        passageStatus.textContent = 'Pasaje copiado.';
      }
    } catch (error) {
      if (error.name !== 'AbortError') passageStatus.textContent = 'No se pudo completar esta acción.';
    }
  });
  note.addEventListener('submit', event => {
    event.preventDefault();
    try {
      localStorage.setItem(localKey('note'), note.elements.note.value);
      note.hidden = true;
      noteButton.setAttribute('aria-expanded', 'false');
      passageStatus.textContent = 'Nota guardada en este dispositivo.';
      noteButton.focus();
    } catch {
      passageStatus.textContent = 'No pudimos guardar la nota en este dispositivo.';
    }
  });
  showPassage(openingVerse, passageId);
  actions.forEach(button => { button.disabled = true; });
})();
