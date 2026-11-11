(() => {
  const panel = document.getElementById('private-admin');
  const trigger = document.getElementById('secret-admin-trigger');
  const login = document.getElementById('wallpaper-admin-login');
  const upload = document.getElementById('wallpaper-admin-upload');
  const status = document.getElementById('wallpaper-admin-status');
  const password = document.getElementById('wallpaper-admin-key');
  const existingField = document.getElementById('wallpaper-admin-existing');
  const fileField = document.getElementById('wallpaper-admin-file');
  const fields = upload.elements;
  const otherTools = document.getElementById('wallpaper-admin-other-tools');
  let clicks = 0;
  let lastClick = 0;
  let catalog = {};
  let catalogRequest;

  function showLogin() {
    login.reset();
    login.hidden = false;
    upload.reset();
    upload.hidden = true;
    otherTools.hidden = true;
    if (!panel.classList.contains('hidden')) login.elements.user.focus();
  }

  function showEditor(name) {
    login.hidden = true;
    upload.hidden = false;
    otherTools.hidden = false;
    refreshMode();
    if (!panel.classList.contains('hidden')) fields.mode.focus();
    status.textContent = 'Sesión iniciada como ' + name + '.';
  }

  async function request(body) {
    const response = await fetch('/api/wallpaper-admin', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || 'No se pudo completar la solicitud. Intenta de nuevo.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  trigger.addEventListener('click', async () => {
    if (!document.querySelector('#inicio.active')) return;
    const now = Date.now();
    if (now - lastClick > 1600) clicks = 0;
    lastClick = now;
    if (++clicks !== 5) return;
    clicks = 0;
    panel.classList.remove('hidden');
    showLogin();
    status.textContent = '';
    try {
      const { name } = await request({ action: 'session' });
      if (!panel.classList.contains('hidden')) showEditor(name);
    } catch (error) {
      if (error.status !== 401 && !panel.classList.contains('hidden')) status.textContent = error.message;
    }
  });

  new MutationObserver(() => {
    if (!panel.classList.contains('hidden')) return;
    showLogin();
    status.textContent = '';
    trigger.focus({ preventScroll: true });
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });

  document.getElementById('wallpaper-admin-logout').addEventListener('click', async () => {
    try {
      await request({ action: 'logout' });
      showLogin();
      status.textContent = 'Sesión cerrada.';
    } catch (error) {
      status.textContent = error.message;
    }
  });

  login.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = login.querySelector('[type="submit"]');
    submit.disabled = true;
    const body = { action: 'login', user: login.elements.user.value, password: password.value };
    password.value = '';
    status.textContent = 'Verificando acceso…';
    try {
      const { name } = await request(body);
      if (!panel.classList.contains('hidden')) showEditor(name);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  async function loadCatalog() {
    if (!catalogRequest) {
      catalogRequest = fetch('/api/wallpaper-catalog', { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error('No se pudo abrir el catálogo.');
          return response.json();
        }).finally(() => { catalogRequest = null; });
    }
    return catalogRequest;
  }

  function fillMetadata() {
    const item = (catalog[fields.collection.value] || []).find(entry => entry.url === fields.existing.value);
    fields.title.value = item?.title || '';
    fields.verse.value = item?.verse || '';
    fields.reference.value = item?.reference || '';
  }

  async function refreshMode() {
    const edit = fields.mode.value === 'edit';
    existingField.hidden = !edit;
    fields.existing.disabled = !edit;
    fields.existing.required = edit;
    fileField.hidden = edit;
    fields.image.disabled = edit;
    fields.image.required = !edit;
    if (!edit) return;
    try {
      catalog = await loadCatalog();
      if (fields.mode.value !== 'edit') return;
      const items = catalog[fields.collection.value] || [];
      fields.existing.replaceChildren(new Option('Selecciona un fondo', ''));
      for (const item of items) fields.existing.add(new Option(item.title, item.url));
      fillMetadata();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  fields.mode.addEventListener('change', () => {
    fields.title.value = '';
    fields.verse.value = '';
    fields.reference.value = '';
    refreshMode();
  });
  fields.collection.addEventListener('change', refreshMode);
  fields.existing.addEventListener('change', fillMetadata);

  function encode(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result.split(',', 2)[1]));
      reader.addEventListener('error', () => reject(new Error('No se pudo leer el archivo.')));
      reader.readAsDataURL(file);
    });
  }

  upload.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(upload);
    const action = data.get('mode');
    const file = data.get('image');
    if (action === 'publish' && (!file?.size || file.size > 3 * 1024 * 1024)) {
      status.textContent = 'Selecciona una imagen de hasta 3 MB.';
      return;
    }
    const submit = upload.querySelector('[type="submit"]');
    submit.disabled = true;
    status.textContent = action === 'edit' ? 'Guardando los cambios…' : 'Subiendo el fondo…';
    try {
      await request({
        action, collection: data.get('collection'), title: data.get('title'),
        verse: data.get('verse'), reference: data.get('reference'),
        ...(action === 'edit' ? { url: data.get('existing') } : { image: await encode(file) })
      });
      if (action === 'publish') {
        upload.reset();
        fields.collection.value = data.get('collection');
        refreshMode();
      }
      status.textContent = 'Cambios guardados. La galería se actualizará cuando termine la publicación.';
    } catch (error) {
      if (error.status === 401) showLogin();
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
})();
