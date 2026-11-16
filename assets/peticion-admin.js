(() => {
  const $ = id => document.getElementById(id);
  const shell = $('admin-peticiones');
  const login = $('prayer-login');
  const dashboard = $('prayer-dashboard');
  const status = $('prayer-admin-status');
  const filters = $('prayer-filters');
  const detail = $('prayer-detail');
  const selected = new Set();
  let inbox;
  let options;

  function element(tag, value = '') {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  }

  function action(label, handler) {
    const button = element('button', label);
    button.type = 'button';
    button.onclick = async () => {
      button.disabled = true;
      try { await handler(); } catch (error) { displayError(error); }
      finally { button.disabled = false; }
    };
    return button;
  }

  function displayError(error) {
    if (error.status === 401) {
      dashboard.hidden = true;
      login.hidden = false;
      clearPrivate();
    }
    status.textContent = error.message;
  }

  async function api(action, args = {}) {
    const response = await fetch('/api/prayer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...args }) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la acción.'), { status: response.status });
    return data;
  }

  function clearPrivate() {
    inbox = null;
    selected.clear();
    $('prayer-counts').replaceChildren();
    $('prayer-cases').replaceChildren();
    $('prayer-reminders').replaceChildren();
    $('prayer-activity').querySelector('ul').replaceChildren();
    detail.replaceChildren();
  }

  function can(permission) { return inbox.user.role === 'master' || inbox.user.permissions.includes(permission); }
  function staff(id) { return inbox.staff.find(user => user.id === id)?.name || id || 'Sin asignar'; }
  function displayDate(raw) { return raw ? new Date(raw).toLocaleString('es') : '—'; }
  function requesterName(item) { return item.requester || [item.first, item.last].filter(Boolean).join(' ') || 'Anónimo'; }
  function topicsOf(item) { return [item.category, ...(item.additional || [])].filter(Boolean); }

  function populate(select, entries) {
    const value = select.value;
    select.replaceChildren(...entries.map(([key, text]) => new Option(text, key)));
    if (entries.some(([key]) => key === value)) select.value = value;
  }

  async function loadInbox() {
    options ||= await fetch('/assets/peticion-opciones.json?v=topicos').then(response => response.json());
    inbox = await api('inbox');
    dashboard.hidden = false;
    login.hidden = true;
    $('prayer-admin-user').textContent = inbox.user.name;
    $('prayer-export').hidden = !can('export');
    const screen = dashboard.querySelector('a');
    screen.hidden = !can('present');
    const topics = new Set([...options.categories, ...inbox.cases.flatMap(topicsOf)]);
    populate(filters.elements.category, [['', 'Todos'], ...Array.from(topics, name => [name, name])]);
    populate(filters.elements.state, [['', 'Todos'], ...Object.entries(options.prayerStatuses)]);
    populate(filters.elements.owner, [['', 'Todos'], ...inbox.staff.map(user => [user.id, user.name])]);
    renderInbox();
  }

  function renderInbox() {
    if (!inbox) return;
    const records = inbox.cases;
    const stages = Object.entries(options.prayerStatuses).map(([code, label]) => [label, records.filter(item => item.prayerStatus === code).length]);
    const counters = [['Total', records.length], ...stages, ['Urgentes', records.filter(item => item.urgent).length],
      ['Confidenciales', records.filter(item => item.privacy === 'confidential').length]];
    $('prayer-counts').replaceChildren(...counters.map(([label, count]) => element('span', `${label}: ${count}`)));
    const today = new Date().toISOString().slice(0, 10);
    const due = records.filter(item => item.next && item.next <= today && item.prayerStatus !== 'answered' && item.state !== 'archived');
    $('prayer-reminders').replaceChildren(...(due.length ? [element('p', `${due.length} seguimientos programados para hoy o pendientes.`),
      ...due.map(item => action(`${requesterName(item)} · ${item.next}`, () => openCase(item.id)))] : []));
    const filter = Object.fromEntries(new FormData(filters));
    const query = filter.query.trim().toLocaleLowerCase('es');
    const filtered = records.filter(item => {
      const day = item.received.slice(0, 10);
      return (!query || `${requesterName(item)} ${item.id}`.toLocaleLowerCase('es').includes(query)) &&
        (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to) && (!filter.category || topicsOf(item).includes(filter.category)) &&
        (!filter.state || item.prayerStatus === filter.state) && (!filter.owner || item.owner === filter.owner);
    }).sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.received.localeCompare(a.received));
    const rows = filtered.map(item => {
      const row = element('div');
      row.className = 'prayer-row';
      if (can('export')) {
        const check = element('input');
        check.type = 'checkbox';
        check.checked = selected.has(item.id);
        check.setAttribute('aria-label', `Marcar expediente de ${requesterName(item)} para exportación`);
        check.onchange = () => check.checked ? selected.add(item.id) : selected.delete(item.id);
        row.append(check);
      }
      row.append(element('strong', `${item.urgent ? 'Urgente · ' : ''}${requesterName(item)}`),
        element('span', `${topicsOf(item).join(', ')} · ${options.prayerStatuses[item.prayerStatus]} · ${staff(item.owner)}`),
        action('Ver expediente', () => openCase(item.id)));
      return row;
    });
    $('prayer-cases').replaceChildren(...(rows.length ? rows : [element('p', 'No hay peticiones que coincidan con los filtros.')]));
    const activity = $('prayer-activity');
    activity.hidden = inbox.user.role !== 'master';
    activity.querySelector('ul').replaceChildren(...inbox.activity.map(event => element('li',
      `${displayDate(event.at)} · ${event.who} · ${event.event}`)));
  }

  async function openCase(id) {
    const { item } = await api('detail', { id });
    renderDetail(item);
    detail.focus();
  }

  function field(text, name, type, value = '', config = {}) {
    const label = element('label', text);
    const input = element(type === 'textarea' || type === 'select' ? type : 'input');
    if (input.tagName === 'INPUT') input.type = type;
    input.name = name;
    Object.assign(input, config);
    if (type !== 'checkbox') input.value = value;
    if (type === 'textarea') { label.className = 'prayer-wide'; input.rows = 4; }
    label.append(input);
    return label;
  }

  function renderDetail(item) {
    const meta = element('dl');
    const lines = {
      'Número de caso': item.id, 'Recibida': displayDate(item.received),
      'Lugar': [item.city, item.region, item.country].filter(Boolean).join(', ') || '—',
      'Para quién': item.forWhom === 'self' ? 'La persona que solicita' : 'Otra persona',
      ...(item.recipient ? { 'Nombre de la persona por quien se ora': item.recipient } : {}),
      'Tópicos de oración': topicsOf(item).join(', '),
      ...(item.otherTopic ? { 'Motivo especificado': item.otherTopic } : {}),
      'Privacidad': options.privacy[item.privacy],
      'Consentimiento': item.consent ? displayDate(item.consent.at) : 'Sin consentimiento para presentar',
      'Seguimiento autorizado': item.method ? `${options.methods[item.method]} · ${item.contact}` : 'No solicitado',
      'Estado': options.prayerStatuses[item.prayerStatus], 'Revisión interna': options.states[item.state], 'Responsable': staff(item.owner),
      'Urgencia': item.urgent ? 'Urgente' : item.restricted ? 'Restringida' : 'Regular', 'Próximo seguimiento': item.next || '—'
    };
    for (const [key, value] of Object.entries(lines)) meta.append(element('dt', key), element('dd', value));
    const original = element('p', item.text);
    original.className = 'prayer-original';
    detail.replaceChildren(element('h3', requesterName(item)), meta, element('h4','Texto original'), original);
    const history = [
      ['Notas internas', item.notes.map(entry => `${displayDate(entry.at)} · ${staff(entry.by)} · ${entry.text}`)],
      ['Historial de contacto', item.contacts.map(entry => `${entry.occurred} · ${staff(entry.by)} · ${options.methods[entry.medium]} · ${entry.result} ${entry.note} ${entry.next ? `· Próximo ${entry.next}` : ''}`)],
      ['Historial de cambios y versiones', item.history.map(entry => {
        const change = entry.action === 'prayer-status' ? 'Estado de oración' : entry.action;
        const stage = entry.action === 'prayer-status' ? options.prayerStatuses[entry.prayerStatus] : options.states[entry.state];
        return `${displayDate(entry.at)} · ${staff(entry.by)} · ${change} · ${stage}${entry.draft ? ' · ' + entry.draft.text : ''}`;
      })]
    ];
    for (const [label, entries] of history) {
      if (!entries.length) continue;
      const group = element('details');
      const list = element('ul');
      list.append(...entries.map(entry => element('li', entry)));
      group.append(element('summary', label), list);
      detail.append(group);
    }
    if (!can('edit')) return;
    async function update(operation, fields = {}, message = 'Cambios guardados.') {
      const data = await api('modify', { id: item.id, version: item.version, operation, ...fields });
      await loadInbox();
      if (data.item) { renderDetail(data.item); detail.focus(); } else detail.replaceChildren();
      status.textContent = message;
    }

    function smallForm(label, fields, handler) {
      const form = element('form');
      const submit = element('button', label);
      submit.type = 'submit';
      form.append(...fields, submit);
      form.onsubmit = async event => {
        event.preventDefault();
        submit.disabled = true;
        try { await handler(Object.fromEntries(new FormData(form))); } catch (error) { displayError(error); }
        finally { submit.disabled = false; }
      };
      detail.append(form);
    }

    const shortcuts = element('div');
    shortcuts.className = 'prayer-actions';
    shortcuts.append(action('Aprobar internamente', () => update('state', { state: 'approved' })),
      action('Rechazar para publicación', () => update('state', { state: 'rejected' })),
      action('Archivar', () => update('state', { state: 'archived' })));
    if (!item.urgent) shortcuts.append(action('Marcar como urgente', () => update('urgent', { urgent: true })));
    detail.append(shortcuts);
    const prayerStatus = field('Estado de oración', 'prayerStatus', 'select');
    populate(prayerStatus.lastChild, Object.entries(options.prayerStatuses));
    prayerStatus.lastChild.value = item.prayerStatus;
    smallForm('Cambiar estado de oración', [prayerStatus], values => update('prayer-status', values));
    const state = field('Revisión interna', 'state', 'select');
    populate(state.lastChild, Object.entries(options.states));
    state.lastChild.value = item.state;
    smallForm('Cambiar revisión interna', [state], values => update('state', values));
    const owner = field('Responsable', 'owner', 'select');
    const assigned = inbox.staff.filter(user => user.role === 'master' || (user.permissions.includes('read') && user.permissions.includes('edit') &&
      (!(item.restricted || item.privacy === 'confidential') || user.permissions.includes('restricted'))));
    populate(owner.lastChild, [['', 'Sin asignar'], ...assigned.map(user => [user.id, user.name])]);
    owner.lastChild.value = item.owner;
    smallForm('Asignar responsable', [owner], values => update('assign', values));
    smallForm('Guardar nota interna', [field('Nota interna', 'text', 'textarea', '', { required: true, maxLength: 2000 })], values => update('note', values));
    smallForm('Guardar recordatorio', [field('Próximo seguimiento', 'next', 'date', item.next)], values => update('remind', values));
    if (item.method) smallForm('Registrar contacto', [field('Fecha de contacto', 'occurred', 'date'),
      field('Resultado', 'result', 'text', '', { required: true, maxLength: 500 }), field('Notas privadas', 'note', 'textarea', '', { maxLength: 2000 }),
      field('Próximo contacto', 'next', 'date', item.next)], values => update('follow', { ...values, medium: item.method }));
    if (item.consent && !item.restricted && !item.urgent && !['rejected','archived'].includes(item.state)) {
      detail.append(element('h4', 'Presentación para la iglesia'));
      smallForm('Guardar borrador para presentar', [field('Versión sin datos personales', 'text', 'textarea', item.draft?.text || '',
        { required: true, maxLength: 2000 })], values => update('draft', values));
      if (item.draft) {
        const preview = element('details');
        const quote = element('p', item.draft.text);
        quote.className = 'prayer-original';
        preview.append(element('summary', 'Ver vista previa de la versión guardada'), quote);
        detail.append(preview);
        if (item.state === 'approved') {
          const exact = { draftId: item.draft.id, attest: true };
          const checks = () => [field('Confirmo que revisé esta versión exacta y no contiene datos que identifiquen a nadie.',
            'attest', 'checkbox', '', { required: true })];
          if (!item.draft.requested) smallForm('Solicitar autorización de Omar', checks(), () => update('request', exact));
          else detail.append(element('p', `Autorización solicitada el ${displayDate(item.draft.requested.at)}.`));
          if (inbox.user.role === 'master' && item.draft.requested && !item.draft.approved) {
            smallForm('Autorizar versión exacta', checks(), () => update('authorize', exact));
          }
          if (inbox.user.role === 'master' && item.draft.approved) {
            detail.append(element('p', `Autorizada el ${displayDate(item.draft.approved.at)} por ${staff(item.draft.approved.by)}.`),
              action('Publicar en pantalla de iglesia', () => update('publish', exact, 'La versión autorizada ya está disponible para presentar.')));
          }
        }
      }
    }
    if (item.active) {
      if (can('present')) smallForm('Guardar orden', [field('Orden de presentación', 'order', 'number', item.active.order,
        { required: true, min: 0, max: 9999 })], values => update('order', { order: Number(values.order) }));
      if (inbox.user.role === 'master') detail.append(action('Retirar de la presentación', () => update('withdraw')));
    }
  }

  filters.addEventListener('input', renderInbox);
  filters.addEventListener('submit', event => event.preventDefault());
  shell.addEventListener('toggle', () => {
    if (!shell.open) return;
    loadInbox().catch(error => { if (error.status !== 401) displayError(error); });
  });
  login.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = login.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const { user } = await api('login', Object.fromEntries(new FormData(login)));
      login.reset();
      document.dispatchEvent(new CustomEvent('lldb:master-login', { detail: user }));
      await loadInbox();
      status.textContent = 'Sesión iniciada.';
    } catch (error) { displayError(error); }
    finally { submit.disabled = false; }
  });
  $('prayer-refresh').onclick = () => loadInbox().catch(displayError);
  document.addEventListener('lldb:master-logout', () => { clearPrivate(); dashboard.hidden = true; });
  $('admin-close').addEventListener('click', () => { shell.open = false; clearPrivate(); login.hidden = false; dashboard.hidden = true; });
  $('prayer-logout').onclick = async () => {
    try {
      await api('logout');
      clearPrivate();
      login.hidden = false;
      dashboard.hidden = true;
      status.textContent = 'Sesión cerrada.';
    } catch (error) { displayError(error); }
  };
  $('prayer-export').onclick = async () => {
    try {
      const data = await api('export', { ids: [...selected] });
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = element('a');
      Object.assign(link, { href: objectUrl, download: `peticiones-${new Date().toISOString().slice(0, 10)}.json` });
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      status.textContent = 'Se exportaron los expedientes autorizados.';
    } catch (error) { displayError(error); }
  };
})();
