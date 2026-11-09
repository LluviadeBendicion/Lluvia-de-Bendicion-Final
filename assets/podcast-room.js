(() => {
  const stage = document.querySelector('.podcast-stage');
  if (!stage) return;
  const audio = stage.querySelector('audio');
  const episodes = stage.querySelector('.podcast-episodes');
  const listing = stage.querySelector('details');
  const status = stage.querySelector('[role="status"]');
  const lights = stage.querySelector('[data-podcast-lights]');
  const soundCheck = stage.querySelector('[data-podcast-test]');
  let hasCatalog = false;
  let isLoading = false;

  function dimLights(dimmed) {
    stage.classList.toggle('is-listening', dimmed);
    lights.setAttribute('aria-pressed', String(dimmed));
    const label = dimmed ? 'Subir las luces' : 'Atenuar las luces';
    lights.setAttribute('aria-label', label);
    lights.title = label;
  }

  function startListening(url, title, selectedButton = null) {
    audio.hidden = false;
    audio.src = url;
    audio.setAttribute('aria-label', title);
    episodes.querySelectorAll('button').forEach(entry => {
      entry.setAttribute('aria-pressed', String(entry === selectedButton));
    });
    status.textContent = title;
    audio.play().catch(() => {});
  }

  async function loadEpisodes() {
    if (hasCatalog || isLoading) return;
    isLoading = true;
    status.textContent = 'Cargando episodios…';
    try {
      const response = await fetch('/api/media-config.json');
      if (!response.ok) throw new Error('Catálogo no disponible');
      const config = await response.json();
      const items = Array.isArray(config.podcasts?.items) ? config.podcasts.items : [];
      for (const item of items) {
        if (typeof item?.title !== 'string' || typeof item.url !== 'string' ||
            !/^(?:https:\/\/|\/(?!\/))/.test(item.url)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.title;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => startListening(item.url, item.title, button));
        episodes.append(button);
      }
      hasCatalog = true;
      status.textContent = episodes.childElementCount
        ? 'Elige un episodio para escuchar.'
        : 'Pronto podrás escuchar aquí los episodios de LLDB.';
    } catch {
      status.textContent = 'No pudimos cargar los episodios. Cierra y abre la lista para volver a intentar.';
    } finally {
      isLoading = false;
    }
  }

  lights.addEventListener('click', () => dimLights(!stage.classList.contains('is-listening')));
  soundCheck.addEventListener('click', () => {
    startListening('/assets/podcast-prueba.m4a', 'Prueba de sonido · introducción de LLDB');
  });
  listing.addEventListener('toggle', () => { if (listing.open) loadEpisodes(); });
  audio.addEventListener('play', () => dimLights(true));
  audio.addEventListener('ended', () => dimLights(false));
  audio.addEventListener('error', () => {
    dimLights(false);
    status.textContent = 'No se pudo reproducir este episodio.';
  });
  const section = stage.closest('.view');
  if (section) {
    new MutationObserver(() => {
      if (!section.classList.contains('active')) {
        audio.pause();
        dimLights(false);
      }
    }).observe(section, { attributes: true, attributeFilter: ['class'] });
  }
})();
