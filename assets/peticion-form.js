(() => {
  const form = document.getElementById('peticion-form');
  const { anonymous, first, last, forWhom, recipient, otherTopic, confidential, consent, method, contact } = form.elements;
  const submit = form.querySelector('[type=submit]');
  const list = form.querySelector('.peticion-lista-motivos');
  const result = form.querySelector('.peticion-resultado');
  const dropdown = form.querySelector('.peticion-topicos');
  const summary = dropdown.querySelector('summary');
  const summaryText = document.getElementById('peticion-topicos-resumen');
  const selectedText = document.getElementById('peticion-topicos-elegidos');

  function refreshFields() {
    const topics = [...list.querySelectorAll('input:checked')].map(input => input.value);
    summaryText.textContent = topics.length ? `${topics.length} ${topics.length === 1 ? 'tópico seleccionado' : 'tópicos seleccionados'}` : 'Selecciona un tópico';
    selectedText.textContent = topics.join(' · ');
    document.getElementById('peticion-apoyo').hidden = !topics.includes('Pensamientos de suicidio');
    document.getElementById('peticion-solicitante').hidden = anonymous.checked;
    first.disabled = anonymous.checked;
    last.disabled = anonymous.checked;
    recipient.disabled = forWhom.value !== 'other';
    document.getElementById('peticion-beneficiario').hidden = recipient.disabled;
    otherTopic.disabled = !topics.includes('Otro');
    otherTopic.required = !otherTopic.disabled;
    document.getElementById('peticion-otro').hidden = otherTopic.disabled;
    document.getElementById('peticion-consentimiento').hidden = confidential.checked;
    consent.disabled = confidential.checked;
    if (confidential.checked) consent.checked = false;
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
  dropdown.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dropdown.open) {
      dropdown.open = false;
      summary.focus();
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const fields = new FormData(form);
    const submitted = Object.fromEntries(fields);
    submitted.topics = fields.getAll('topics');
    if (submitted.topics.length === 0) {
      result.textContent = 'Selecciona al menos un tópico de oración.';
      dropdown.open = true;
      list.querySelector('input').focus();
      return;
    }
    submitted.follow = submitted.follow === 'yes';
    submitted.anonymous = anonymous.checked;
    submitted.confidential = confidential.checked;
    submitted.consent = consent.checked;
    submit.disabled = true;
    result.textContent = 'Enviando tu petición…';
    try {
      const response = await fetch('/api/prayer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitted, action: 'submit' }) });
      const data = await response.json();
      if (!response.ok || !data.received) throw new Error(data.error || 'No pudimos recibir tu petición. Inténtalo de nuevo.');
      result.textContent = 'Hemos recibido tu petición. Estaremos orando por ti. Confiamos en que Dios escucha cada oración presentada con fe.';
      form.reset();
      dropdown.open = false;
      refreshFields();
    } catch (error) {
      result.textContent = error.message;
    } finally {
      submit.disabled = false;
      result.focus();
    }
  });

  fetch('/assets/peticion-opciones.json?v=topicos').then(response => {
    if (!response.ok) throw new Error();
    return response.json();
  }).then(options => {
    for (const name of options.categories) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      Object.assign(input, { type: 'checkbox', name: 'topics', value: name });
      label.append(input, name);
      list.append(label);
    }
    for (const [id, name] of Object.entries(options.methods)) method.append(new Option(name, id));
    refreshFields();
    submit.disabled = false;
  }).catch(() => { result.textContent = 'No se pudo cargar el formulario. Recarga la página e inténtalo de nuevo.'; });
})();
