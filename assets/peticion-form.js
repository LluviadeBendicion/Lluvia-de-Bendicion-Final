(() => {
  const form = document.getElementById('peticion-form');
  const { category, privacy, consent, method, contact } = form.elements;
  const submit = form.querySelector('[type=submit]');
  const list = form.querySelector('.peticion-lista-motivos');
  const result = form.querySelector('.peticion-resultado');

  function refreshFields() {
    const checks = [...list.querySelectorAll('input')];
    for (const input of checks) {
      input.disabled = input.value === category.value;
      if (input.disabled) input.checked = false;
    }
    document.getElementById('peticion-apoyo').hidden = ![category.value, ...checks.filter(input => input.checked).map(input => input.value)].includes('Pensamientos de suicidio');
    const shared = privacy.value === 'church' || privacy.value === 'anonymous';
    document.getElementById('peticion-consentimiento').hidden = !shared;
    if (!shared) consent.checked = false;
    const follow = form.elements.follow.value === 'yes';
    document.getElementById('peticion-seguimiento').hidden = !follow;
    method.required = follow;
    method.disabled = !follow;
    if (!follow) { method.value = ''; contact.value = ''; }
    const hasMethod = follow && Boolean(method.value);
    contact.required = hasMethod;
    contact.disabled = !hasMethod;
    const label = document.getElementById('peticion-contacto');
    label.hidden = !hasMethod;
    label.querySelector('span').textContent = method.value === 'email' ? 'Correo electrónico' : 'Número con código de área o país';
    contact.type = method.value === 'email' ? 'email' : 'tel';
    contact.autocomplete = contact.type;
  }

  form.addEventListener('change', event => {
    if (event.target === method) contact.value = '';
    refreshFields();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(form);
    const submitted = Object.fromEntries(fields);
    submitted.follow = submitted.follow === 'yes';
    submitted.consent = consent.checked;
    submitted.additional = fields.getAll('additional');
    submit.disabled = true;
    result.textContent = 'Enviando tu petición…';
    try {
      const response = await fetch('/api/prayer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitted, action: 'submit' }) });
      const data = await response.json();
      if (!response.ok || !data.received) throw new Error(data.error || 'No pudimos recibir tu petición. Inténtalo de nuevo.');
      result.textContent = 'Hemos recibido tu petición de oración. Gracias por confiar en nosotros. Que Dios te bendiga.';
      form.reset();
      refreshFields();
    } catch (error) {
      result.textContent = error.message;
    } finally {
      submit.disabled = false;
      result.focus();
    }
  });

  fetch('/assets/peticion-opciones.json').then(response => {
    if (!response.ok) throw new Error();
    return response.json();
  }).then(options => {
    for (const name of options.categories) {
      category.append(new Option(name, name));
      const label = document.createElement('label');
      const input = document.createElement('input');
      Object.assign(input, { type: 'checkbox', name: 'additional', value: name });
      label.append(input, name);
      list.append(label);
    }
    for (const [id, name] of Object.entries(options.privacy)) privacy.append(new Option(name, id));
    privacy.value = 'confidential';
    for (const [id, name] of Object.entries(options.methods)) method.append(new Option(name, id));
    refreshFields();
    submit.disabled = false;
  }).catch(() => { result.textContent = 'No se pudo cargar el formulario. Recarga la página e inténtalo de nuevo.'; });
})();
