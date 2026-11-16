(() => {
  const $ = id => document.getElementById(id);
  const login = $('present-login');
  const controls = $('present-controls');
  const select = $('present-select');
  const quote = $('present-quote');
  const status = $('present-status');
  let items = [];

  async function api(action, data = {}) {
    const response = await fetch('/api/prayer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }) });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error || 'No se pudo cargar la presentación.'), { status: response.status });
    return payload;
  }

  function render() {
    const selected = items.find(item => item.id === select.value);
    quote.textContent = selected?.text || '';
    quote.hidden = !selected;
    $('present-prev').disabled = items.length < 2;
    $('present-next').disabled = items.length < 2;
  }

  async function load() {
    try {
      ({ items } = await api('presentation'));
      const current = select.value;
      select.replaceChildren(new Option('Selecciona una petición', ''), ...items.map((item, i) => new Option('Petición ' + (i + 1), item.id)));
      if (items.some(item => item.id === current)) select.value = current;
      controls.hidden = false;
      login.hidden = true;
      status.textContent = items.length ? '' : 'No hay peticiones autorizadas para presentar.';
    } catch (error) {
      items = [];
      controls.hidden = true;
      login.hidden = error.status !== 401;
      status.textContent = error.message;
    }
    render();
  }

  function step(delta) {
    const at = items.findIndex(item => item.id === select.value);
    if (items.length) select.value = items[(at < 0 ? 0 : (at + delta + items.length) % items.length)].id;
    render();
  }
  select.onchange = render;
  $('present-prev').onclick = () => step(-1);
  $('present-next').onclick = () => step(1);
  $('present-refresh').onclick = load;
  $('present-exit').onclick = async () => {
    try { await api('logout'); await load(); } catch (error) { status.textContent = error.message; }
  };
  login.onsubmit = async event => {
    event.preventDefault();
    try { await api('login', Object.fromEntries(new FormData(login))); login.reset(); await load(); }
    catch (error) { status.textContent = error.message; }
  };
  setInterval(() => { if (!controls.hidden && !document.hidden) load(); }, 10000);
  load();
})();
