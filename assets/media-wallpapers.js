(() => {
  const stage = document.querySelector('.wallpaper-stage');
  if (!stage) return;
  const groups = [...stage.querySelectorAll('[data-wallpaper-group]')];
  const phone = stage.querySelector('.wallpaper-phone');
  const boards = [...stage.querySelectorAll('.wallpaper-options')];
  const download = stage.querySelector('[data-wallpaper-download]');
  const share = stage.querySelector('[data-wallpaper-share]');
  const downloadVerse = document.getElementById('wallpaper-download-verse');
  let exporting = false;
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
    downloadVerse.disabled = exporting || !item.reference;
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
    setVerse(selectedVerse, item);
    selectedVerse.hidden = !item.reference;
  }

  function setDownload(link, item) {
    link.href = item.url;
    link.download = decodeURIComponent(item.url.split('/').pop());
  }

  const verseRequests = new Map();
  async function setVerse(panel, item) {
    panel.dataset.nviReference = item.reference || '';
    const verse = panel.querySelector('.wallpaper-verse');
    const reference = panel.querySelector('.wallpaper-reference');
    verse.textContent = item.reference ? 'Consultando versículo NVI…' : '';
    reference.textContent = item.reference ? item.reference + ' · NVI' : '';
    if (!item.reference) return;
    try {
      if (!verseRequests.has(item.reference)) {
        verseRequests.set(item.reference, window.LLDBBible.passage(item.reference).catch(error => {
          verseRequests.delete(item.reference);
          throw error;
        }));
      }
      const data = await verseRequests.get(item.reference);
      if (panel.dataset.nviReference !== item.reference) return;
      verse.textContent = data.text;
      reference.textContent = [data.reference + ' · NVI', data.credit].filter(Boolean).join(' · ');
    } catch (error) {
      if (panel.dataset.nviReference === item.reference) verse.textContent = error.message;
    }
  }

  function hideHover() {
    hover.hidden = true;
    hover.dataset.nviReference = '';
  }

  function showHover(event, item) {
    if (!item || (event.type === 'pointerenter' && event.pointerType !== 'mouse')) return;
    hover.querySelector('img').src = item.url;
    setVerse(hover, item);
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
    downloadVerse.disabled = true;
    selectedVerse.hidden = true;
    selectedVerse.dataset.nviReference = '';
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

  downloadVerse.addEventListener('click', async () => {
    if (!selected?.reference || exporting) return;
    const item = selected;
    const style = window.LLDBVerseStyle;
    const font = style.font();
    const family = style.family();
    exporting = true;
    downloadVerse.disabled = true;
    status.textContent = 'Preparando imagen con el versículo NVI…';
    try {
      const data = await window.LLDBBible.passage(item.reference);
      await document.fonts.load(font + ' 64px ' + family);
      const image = new Image();
      image.src = item.url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Este navegador no permite crear la imagen.');
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      context.drawImage(image, (1080 - image.naturalWidth * scale) / 2, (1920 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      const gradient = context.createLinearGradient(0, 760, 0, 1920);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(.25, 'rgba(0,0,0,.65)');
      gradient.addColorStop(1, 'rgba(0,0,0,.9)');
      context.fillStyle = gradient;
      context.fillRect(0, 760, 1080, 1160);
      const wrap = (text, maxWidth) => {
        const lines = [];
        let line = '';
        for (const word of String(text).split(/\s+/)) {
          const next = line ? line + ' ' + word : word;
          if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word; }
          else line = next;
        }
        if (line) lines.push(line);
        return lines;
      };
      let size = 64;
      let lines;
      do {
        context.font = font + ' ' + size + 'px ' + family;
        lines = wrap(data.text, 900);
        if (lines.length * size * 1.35 <= 650) break;
        size -= 2;
      } while (size >= 28);
      if (size < 28) throw new Error('Elige un versículo más corto para esta imagen.');
      context.fillStyle = '#fff5df';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      let y = 1050;
      for (const line of lines) { context.fillText(line, 540, y); y += size * 1.35; }
      context.font = '600 30px sans-serif';
      context.fillText(data.reference + ' · NVI', 540, y + 24);
      context.font = '22px sans-serif';
      y = 1780;
      for (const line of wrap(data.credit || '', 900)) { context.fillText(line, 540, y); y += 28; }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo crear la imagen.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lldb-' + item.reference.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-nvi.png';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'Imagen con versículo NVI preparada.';
    } catch (error) {
      status.textContent = error.message || 'No pudimos preparar la imagen.';
    } finally {
      exporting = false;
      downloadVerse.disabled = !selected?.reference;
    }
  });

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
