(() => {
  const form = document.getElementById('contacto-form');
  const result = document.getElementById('contacto-resultado');
  const businessLabel = document.getElementById('contacto-negocio');
  const { reason, business, consent } = form.elements;
  const submit = form.querySelector('[type=submit]');
  let reasons;
  let affiliateEntry = false;
  let previous;

  function refreshBusiness() {
    businessLabel.hidden = !reasons?.[reason.value]?.commercial;
    business.disabled = businessLabel.hidden;
  }

  function preselectAffiliate() {
    if (!reasons || !affiliateEntry) return;
    reason.value = 'affiliate-info';
    affiliateEntry = false;
    refreshBusiness();
  }

  document.querySelector('[data-contact-affiliate]').addEventListener('click', () => {
    affiliateEntry = true;
    preselectAffiliate();
  });
  reason.addEventListener('change', refreshBusiness);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const fields = Object.fromEntries(new FormData(form));
    fields.consent = consent.checked;
    const fingerprint = JSON.stringify(fields);
    if (previous?.fingerprint !== fingerprint) previous = { fingerprint, id: crypto.randomUUID() };
    submit.disabled = true;
    result.textContent = 'Enviando tu mensaje…';
    try {
      const response = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'contact-submit', requestId: previous.id, ...fields }) });
      const data = await response.json();
      if (!response.ok || !data.received) {
        if (response.status === 409) previous = null;
        result.textContent = data.error || 'No pudimos confirmar el envío. Puedes intentarlo de nuevo.';
        return;
      }
      result.textContent = '¡Gracias por comunicarte con LluviaDeBendicion.com! Hemos recibido tu mensaje y nos pondremos en contacto contigo tan pronto como sea posible. ¡Dios te bendiga!';
      form.reset();
      previous = null;
      refreshBusiness();
    } catch {
      result.textContent = 'No pudimos confirmar el envío. Revisa tu conexión y vuelve a intentarlo.';
    } finally {
      submit.disabled = false;
      result.focus();
    }
  });

  fetch('/assets/contacto-motivos.json').then(response => {
    if (!response.ok) throw new Error();
    return response.json();
  }).then(data => {
    reasons = data;
    reason.append(...Object.entries(reasons).map(([key, item]) => new Option(item.label, key)));
    preselectAffiliate();
    refreshBusiness();
    submit.disabled = false;
  }).catch(() => { result.textContent = 'No pudimos cargar los motivos de contacto. Recarga la página para intentarlo de nuevo.'; });
})();
