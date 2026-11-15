(() => {
  const view = document.getElementById('estudios');
  const screen = document.getElementById('resources-screen');
  const power = document.getElementById('resources-power');
  const powerLabel = document.getElementById('resources-power-label');
  const back = document.getElementById('resources-back');
  const welcome = screen.querySelector('.resources-welcome');
  const panels = [...screen.querySelectorAll('.resources-panel')];
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
  let activePanel = null;
  let passageId = 'GEN.1.1';
  let readingRevision = 0;
  let searchRevision = 0;

  function setPower(on) {
    power.setAttribute('aria-expanded', String(on));
    powerLabel.textContent = on ? 'Apagar pantalla' : 'Encender pantalla';
    screen.hidden = !on;
  }

  function project(selected, focus = true) {
    const previous = activePanel;
    activePanel = selected;
    if (selected) {
      setPower(true);
      screen.dataset.focused = selected.id;
    } else {
      delete screen.dataset.focused;
    }
    welcome.hidden = Boolean(selected);
    back.hidden = !selected;
    for (const panel of panels) {
      panel.hidden = Boolean(selected && selected !== panel);
      panel.querySelector('.resources-expand').hidden = Boolean(selected);
      panel.querySelector('.resources-intro').hidden = selected !== panel;
      const body = panel.querySelector('.resources-reading');
      if (body) body.hidden = selected !== panel;
    }
    screen.scrollTop = 0;
    if (focus && !screen.hidden) {
      const target = selected ? back : previous?.querySelector('.resources-expand') || welcome;
      target.focus({ preventScroll: getComputedStyle(screen).position === 'absolute' });
    }
  }

  function turnOff() {
    setPower(false);
    project(null, false);
  }

  power.addEventListener('click', () => {
    if (screen.hidden) {
      setPower(true);
      project(null);
    } else {
      turnOff();
    }
  });
  back.addEventListener('click', () => project(null));
  for (const panel of panels) {
    panel.querySelector('.resources-expand').addEventListener('click', () => project(panel));
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
    if (!view.classList.contains('active') && !screen.hidden) turnOff();
  }).observe(view, { attributes: true, attributeFilter: ['class'] });

  async function request(params) {
    const response = await fetch('/api/bible?' + new URLSearchParams(params), { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'El servicio bíblico no respondió.');
    return data;
  }

  function localKey(kind) {
    return 'lldb-recursos:' + kind + ':' + passageId;
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
    const current = ++readingRevision;
    project(bible);
    passageStatus.textContent = 'Consultando…';
    actions.forEach(button => { button.disabled = true; });
    try {
      const data = ref === 'GEN.1.1' ? openingVerse : await request({ ref });
      if (current === readingRevision) showPassage(data, ref);
    } catch (error) {
      if (current === readingRevision) {
        passageStatus.textContent = error.message || 'Intenta de nuevo.';
      }
    } finally {
      if (current === readingRevision) actions.forEach(button => { button.disabled = false; });
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
  search.addEventListener('submit', async event => {
    event.preventDefault();
    const q = search.elements.quicksearch.value.trim();
    if (!q) return;
    const current = ++searchRevision;
    project(concordance);
    searchOutput.textContent = 'Buscando…';
    searchCredit.textContent = '';
    try {
      const data = await request({ q });
      if (current !== searchRevision) return;
      searchOutput.textContent = data.verses.length ? '' : 'No encontramos coincidencias.';
      for (const verse of data.verses) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = verse.reference;
        button.dataset.bibleRef = verse.id;
        const text = document.createElement('p');
        text.textContent = verse.text;
        searchOutput.append(button, text);
      }
      searchCredit.textContent = data.credit || '';
    } catch (error) {
      if (current === searchRevision) searchOutput.textContent = error.message || 'Intenta de nuevo.';
    }
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
})();
