(() => {
  const stage = document.querySelector('.wallpaper-stage');
  if (!stage) return;
  const groups = [...stage.querySelectorAll('[data-wallpaper-group]')];
  const phone = stage.querySelector('.wallpaper-phone');
  const boards = [...stage.querySelectorAll('.wallpaper-options')];
  const download = stage.querySelector('[data-wallpaper-download]');
  const share = stage.querySelector('[data-wallpaper-share]');
  const favorite = stage.querySelector('[data-wallpaper-favorite]');
  const status = document.getElementById('wallpaper-status');
  const view = stage.closest('.view');
  const hover = view.querySelector('.wallpaper-hover');
  const selectedVerse = view.querySelector('.wallpaper-selection-verse');
  const favoriteKey = 'lldb-wallpaper-favorites';
  const wallpapersByTile = new WeakMap();
  let catalogRequest;
  let catalogReady = false;
  let selected;
  let favorites = [];
  try {
    const saved = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
    if (Array.isArray(saved)) favorites = saved;
  } catch {}

  function loadCatalog() {
    if (!catalogRequest) {
      catalogRequest = fetch('/api/wallpaper-catalog')
        .then(response => {
          if (!response.ok) throw new Error('Catálogo no disponible');
          return response.json();
        })
        .catch(error => {
          catalogRequest = null;
          throw error;
        });
    }
    return catalogRequest;
  }

  function selectWallpaper(item, button) {
    selected = item;
    hideHover();
    const image = document.createElement('img');
    image.src = item.url;
    image.alt = item.title;
    phone.replaceChildren(image);
    setDownload(download, item);
    download.removeAttribute('aria-disabled');
    share.disabled = false;
    favorite.disabled = false;
    favorite.setAttribute('aria-pressed', String(favorites.includes(item.url)));
    stage.querySelectorAll('.wallpaper-options button').forEach(tile => {
      tile.setAttribute('aria-pressed', String(tile === button));
    });
    status.textContent = item.title + ' · listo para descargar.';
    selectedVerse.textContent = [item.verse, item.reference].filter(Boolean).join(' · ');
  }

  function setDownload(link, item) {
    link.href = item.url;
    link.download = decodeURIComponent(item.url.split('/').pop());
  }

  function hideHover() {
    hover.hidden = true;
  }

  function showHover(event, item) {
    if (!item || (event.type === 'pointerenter' && event.pointerType !== 'mouse')) return;
    hover.querySelector('img').src = item.url;
    hover.querySelector('.wallpaper-verse').textContent = item.verse || '';
    hover.querySelector('.wallpaper-reference').textContent = item.reference || '';
    hover.hidden = false;
    const anchor = event.currentTarget.getBoundingClientRect();
    const { width, height } = hover.getBoundingClientRect();
    const gap = 12;
    const left = anchor.right + width + gap <= window.innerWidth
      ? anchor.right + gap
      : Math.max(gap, anchor.left - width - gap);
    const top = Math.max(gap, Math.min(anchor.top, window.innerHeight - height - gap));
    hover.style.left = left + 'px';
    hover.style.top = top + 'px';
  }

  function activateCollection(button) {
    stage.dataset.collection = button.dataset.wallpaperGroup;
    groups.forEach(group => group.setAttribute('aria-pressed', String(group === button)));
  }

  function clearSelection() {
    selected = null;
    selectedVerse.textContent = '';
    hideHover();
    phone.replaceChildren();
    download.removeAttribute('href');
    download.setAttribute('aria-disabled', 'true');
    share.disabled = true;
    favorite.disabled = true;
    favorite.setAttribute('aria-pressed', 'false');
    stage.querySelectorAll('.wallpaper-options button[aria-pressed="true"]').forEach(tile => {
      tile.setAttribute('aria-pressed', 'false');
    });
  }

  function populateBoards(catalog) {
    if (catalogReady) return;
    for (const board of boards) {
      const key = board.dataset.wallpaperBoard;
      const group = groups.find(button => button.dataset.wallpaperGroup === key);
      const items = Array.isArray(catalog[key]) ? catalog[key] : [];
      for (const item of items) {
        if (typeof item?.title !== 'string' || typeof item.url !== 'string' ||
            !item.url.startsWith('/assets/wallpapers/')) continue;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.setAttribute('aria-label', item.title);
        tile.setAttribute('aria-pressed', 'false');
        const thumbnail = document.createElement('img');
        thumbnail.src = item.url;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        tile.append(thumbnail);
        tile.addEventListener('pointerenter', event => showHover(event, item));
        tile.addEventListener('pointerleave', hideHover);
        tile.addEventListener('focus', event => {
          if (tile.matches(':focus-visible')) showHover(event, item);
        });
        tile.addEventListener('blur', hideHover);
        wallpapersByTile.set(tile, item);
        tile.addEventListener('click', () => {
          activateCollection(group);
          selectWallpaper(item, tile);
        });
        board.append(tile);
      }
      if (!board.firstChild) {
        const message = document.createElement('p');
        message.textContent = 'Sin fondos publicados';
        board.append(message);
      }
    }
    catalogReady = true;
  }

  async function chooseCollection(button) {
    const key = button.dataset.wallpaperGroup;
    activateCollection(button);
    clearSelection();
    status.textContent = 'Cargando colección…';
    try {
      populateBoards(await loadCatalog());
    } catch {
      if (stage.dataset.collection === key) status.textContent = 'No pudimos cargar esta colección. Intenta de nuevo.';
      return;
    }
    if (stage.dataset.collection !== key) return;
    const board = boards.find(panel => panel.dataset.wallpaperBoard === key);
    const first = board.querySelector('button');
    if (first) selectWallpaper(wallpapersByTile.get(first), first);
    else status.textContent = button.textContent.trim() + ' · todavía no hay fondos publicados.';
  }

  groups.forEach(button => button.addEventListener('click', () => chooseCollection(button)));
  phone.addEventListener('pointerenter', event => showHover(event, selected));
  phone.addEventListener('pointerleave', hideHover);
  window.addEventListener('scroll', hideHover, { capture: true, passive: true });
  window.addEventListener('resize', hideHover);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideHover(); });
  function openGallery() {
    if (view.classList.contains('active')) {
      if (!stage.dataset.collection) chooseCollection(groups[0]);
    } else {
      hideHover();
    }
  }
  new MutationObserver(openGallery).observe(view, { attributes: true, attributeFilter: ['class'] });
  openGallery();
  share.addEventListener('click', async () => {
    if (!selected) return;
    const url = new URL(selected.url, location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: selected.title, url });
      else {
        await navigator.clipboard.writeText(url);
        status.textContent = 'Enlace del fondo copiado.';
      }
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'No se pudo compartir el fondo.';
    }
  });
  favorite.addEventListener('click', () => {
    if (!selected) return;
    const saved = !favorites.includes(selected.url);
    favorites = saved ? [...favorites, selected.url] : favorites.filter(url => url !== selected.url);
    favorite.setAttribute('aria-pressed', String(saved));
    try { localStorage.setItem(favoriteKey, JSON.stringify(favorites)); } catch {}
    status.textContent = saved ? 'Fondo guardado como favorito.' : 'Fondo retirado de favoritos.';
  });
})();
