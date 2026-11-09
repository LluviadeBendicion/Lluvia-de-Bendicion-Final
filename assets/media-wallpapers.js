(() => {
  const stage = document.querySelector('.wallpaper-stage');
  if (!stage) return;
  const groups = [...stage.querySelectorAll('[data-wallpaper-group]')];
  const phone = stage.querySelector('.wallpaper-phone');
  const options = stage.querySelector('.wallpaper-options');
  const download = stage.querySelector('[data-wallpaper-download]');
  const share = stage.querySelector('[data-wallpaper-share]');
  const favorite = stage.querySelector('[data-wallpaper-favorite]');
  const status = document.getElementById('wallpaper-status');
  const favoriteKey = 'lldb-wallpaper-favorites';
  let catalogRequest;
  let activeGroup;
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
    const image = document.createElement('img');
    image.src = item.url;
    image.alt = item.title;
    phone.replaceChildren(image);
    download.href = item.url;
    download.download = decodeURIComponent(item.url.split('/').pop());
    download.removeAttribute('aria-disabled');
    share.disabled = false;
    favorite.disabled = false;
    favorite.setAttribute('aria-pressed', String(favorites.includes(item.url)));
    options.querySelectorAll('button').forEach(tile => {
      tile.setAttribute('aria-pressed', String(tile === button));
    });
    status.textContent = item.title + ' · listo para descargar.';
  }

  async function chooseCollection(button) {
    const key = button.dataset.wallpaperGroup;
    activeGroup = key;
    stage.dataset.collection = key;
    groups.forEach(group => group.setAttribute('aria-pressed', String(group === button)));
    selected = null;
    phone.classList.remove('hidden');
    options.classList.remove('hidden');
    phone.replaceChildren();
    options.replaceChildren();
    download.removeAttribute('href');
    download.setAttribute('aria-disabled', 'true');
    share.disabled = true;
    favorite.disabled = true;
    favorite.setAttribute('aria-pressed', 'false');
    status.textContent = 'Cargando colección…';

    let items;
    try {
      const catalog = await loadCatalog();
      items = Array.isArray(catalog[key]) ? catalog[key] : [];
    } catch {
      if (activeGroup === key) status.textContent = 'No pudimos cargar esta colección. Intenta de nuevo.';
      return;
    }
    if (activeGroup !== key) return;
    for (const item of items) {
      if (typeof item?.title !== 'string' || typeof item.url !== 'string' ||
          !item.url.startsWith('/assets/wallpapers/')) continue;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.setAttribute('aria-label', item.title);
      const thumbnail = document.createElement('img');
      thumbnail.src = item.url;
      thumbnail.alt = '';
      thumbnail.loading = 'lazy';
      tile.append(thumbnail);
      tile.addEventListener('click', () => selectWallpaper(item, tile));
      options.append(tile);
    }
    const first = options.querySelector('button');
    if (first) first.click();
    else {
      const message = document.createElement('p');
      message.textContent = 'Próximamente';
      phone.append(message);
      options.classList.add('hidden');
      status.textContent = button.textContent.trim() + ' · todavía no hay fondos publicados.';
    }
  }

  groups.forEach(button => button.addEventListener('click', () => chooseCollection(button)));
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
