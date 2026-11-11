(() => {
  const panel = document.getElementById('private-admin');
  const trigger = document.getElementById('secret-admin-trigger');
  const login = document.getElementById('wallpaper-admin-login');
  const upload = document.getElementById('wallpaper-admin-upload');
  const status = document.getElementById('wallpaper-admin-status');
  const key = document.getElementById('wallpaper-admin-key');
  let token = '';
  let clicks = 0;
  let lastClick = 0;
  let session = 0;

  function endSession() {
    session++;
    token = '';
    login.reset();
    upload.reset();
    login.hidden = false;
    upload.hidden = true;
    status.textContent = '';
  }

  trigger.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastClick > 1600) clicks = 0;
    lastClick = now;
    if (++clicks !== 5) return;
    clicks = 0;
    panel.classList.remove('hidden');
    key.focus();
  });

  new MutationObserver(() => {
    if (panel.classList.contains('hidden')) {
      endSession();
      trigger.focus({ preventScroll: true });
    }
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });

  document.getElementById('wallpaper-admin-logout').addEventListener('click', () => {
    endSession();
    key.focus();
  });

  async function request(credential, body) {
    const response = await fetch('/api/wallpaper-admin', {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' },
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

  function encode(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result.split(',', 2)[1]));
      reader.addEventListener('error', () => reject(new Error('No se pudo leer el archivo.')));
      reader.readAsDataURL(file);
    });
  }

  login.addEventListener('submit', async event => {
    event.preventDefault();
    const attempt = session;
    const credential = key.value.trim();
    const submit = login.querySelector('[type="submit"]');
    submit.disabled = true;
    key.value = '';
    status.textContent = 'Verificando acceso…';
    try {
      await request(credential, { action: 'login' });
      if (attempt !== session) return;
      token = credential;
      login.hidden = true;
      upload.hidden = false;
      upload.elements.collection.focus();
      status.textContent = 'Acceso verificado.';
    } catch (error) {
      if (attempt === session) status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  upload.addEventListener('submit', async event => {
    event.preventDefault();
    if (!token) return;
    const attempt = session;
    const data = new FormData(upload);
    const file = data.get('image');
    if (!file?.size || file.size > 3 * 1024 * 1024) {
      status.textContent = 'Selecciona una imagen de hasta 3 MB.';
      return;
    }
    const submit = upload.querySelector('[type="submit"]');
    const credential = token;
    submit.disabled = true;
    status.textContent = 'Subiendo el fondo…';
    try {
      const image = await encode(file);
      if (attempt !== session) return;
      await request(credential, {
        action: 'publish', image, collection: data.get('collection'), title: data.get('title'),
        verse: data.get('verse'), reference: data.get('reference')
      });
      if (attempt !== session) return;
      upload.reset();
      upload.elements.collection.value = data.get('collection');
      status.textContent = 'Fondo guardado. Aparecerá en la galería cuando termine la publicación del sitio.';
    } catch (error) {
      if (attempt !== session) return;
      if (error.status === 401) {
        endSession();
        key.focus();
      }
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
})();
