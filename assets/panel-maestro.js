(() => {
  const $ = id => document.getElementById(id);
  const panel = $('private-admin');
  const content = $('master-content');
  const auth = $('master-auth');
  const shell = $('master-shell');
  const message = $('master-status');
  const legacy = $('master-legacy');
  const prayer = $('admin-peticiones');
  const login = $('prayer-login');
  const nav = [...shell.querySelectorAll('[data-master]')];
  const steps = ['Propuesta', 'Envío', 'Aceptación', 'Contrato', 'Facturación', 'Pago', 'Cliente activo'];
  const labels = Object.fromEntries(nav.map(button => [button.dataset.master, button.textContent.trim().replace(/^[^\p{L}]+/u, '')]));
  const currencies = ['USD','MXN','EUR','COP','DOP','CAD'];
  const editorial = ['Inicio','Nosotros · Misión','Nosotros · Visión','Nosotros · Creencias','Oración del día','Versículo del día',
    'Versículo para memorizar','Devocional de la semana','Sermón de la semana','Estudios bíblicos','Videos','Podcasts','Recursos bíblicos','Radio','Contacto'];
  const affiliateLabels = { prospect:'Prospecto', active:'Activo', banned:'Bloqueado (BAN)', discontinued:'Descontinuado' };
  const workflowLabels = { draft:'Borrador', review:'Pendiente de revisión', rejected:'Rechazado', approved:'Autorizado' };
  let user;
  let overview;
  let current = 'overview';
  let navigation = 0;
  let wasHidden = true;
  let contactTimer;

  $('master-login-slot').append(login, $('prayer-admin-status'));
  $('master-prayer-slot').append(prayer);
  $('master-legacy-slot').append(legacy);

  function n(tag, value = '', className = '') {
    const el = document.createElement(tag);
    el.textContent = value;
    el.className = className;
    return el;
  }
  function button(label, handler) {
    const el = n('button', label);
    el.type = 'button';
    el.onclick = async () => {
      el.disabled = true;
      try { await handler(); } catch (error) { showError(error); }
      finally { el.disabled = false; }
    };
    return el;
  }
  function card(title, ...children) {
    const result = n('section', '', 'master-card');
    result.append(n('h3', title), ...children);
    return result;
  }
  function group(...children) {
    const result = n('div', '', 'master-columns');
    result.append(...children);
    return result;
  }
  function note(text) { return n('p', text); }
  function when(value) { return value ? new Date(value).toLocaleString('es') : '—'; }
  function currency(amount, code) { return new Intl.NumberFormat('es', { style:'currency', currency:code, currencyDisplay:'code' }).format(amount / 100); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function showError(error) {
    if (error.status === 401) clearSession(error.message);
    else message.textContent = error.message;
  }
  function can(module, action) { return Boolean(overview.capabilities[module]?.includes(action)); }

  async function api(action, fields = {}) {
    const response = await fetch('/api/prayer', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action, ...fields }) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la acción.'), { status:response.status });
    return data;
  }

  function input(name, label, opts = {}) {
    const holder = n('label', label);
    const element = n(opts.choices ? 'select' : opts.long ? 'textarea' : 'input');
    element.name = name;
    element.required = opts.required !== false;
    if (opts.choices) element.append(...opts.choices.map(item => new Option(Array.isArray(item) ? item[1] : item, Array.isArray(item) ? item[0] : item)));
    else if (opts.long) { element.rows = 4; holder.classList.add('wide'); }
    else element.type = opts.type || 'text';
    if (opts.autocomplete) element.autocomplete = opts.autocomplete;
    if (opts.minlength) element.minLength = opts.minlength;
    if (opts.value !== undefined) element.value = opts.value;
    if (opts.check) { element.type = 'checkbox'; element.checked = Boolean(opts.value); element.required = false; }
    holder.append(element);
    return holder;
  }
  function form(label, fields, send) {
    const result = n('form', '', 'master-form');
    const submit = n('button', label);
    submit.type = 'submit';
    result.append(...fields, submit);
    result.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      try { await send(Object.fromEntries(new FormData(result))); } catch (error) { showError(error); }
      finally { submit.disabled = false; }
    };
    return result;
  }
  function history(title, rows) {
    const record = n('details', '', 'master-record');
    record.append(n('summary', title), ...rows);
    return record;
  }

  const recoveryStatus = n('p');
  recoveryStatus.setAttribute('role', 'status');
  const emailStatus = n('p');
  emailStatus.setAttribute('role', 'status');
  const emailRequest = form('Enviar enlace a mi correo', [input('user','Usuario',{autocomplete:'username'})], async values => {
    emailStatus.textContent = 'Procesando solicitud…';
    try {
      await api('request-email-recovery', values);
      emailStatus.textContent = 'Si tu cuenta tiene un correo de recuperación registrado, recibirás un enlace. Revisa también el correo no deseado.';
    } catch (error) {
      emailStatus.textContent = error.message;
    }
  });
  const manualRecovery = history('Usar un código de recuperación', [
    form('Restablecer contraseña', [
      input('user','Usuario',{autocomplete:'username'}),
      input('code','Código de recuperación',{type:'password',autocomplete:'off'}),
      input('newPassword','Nueva contraseña (mínimo 8 caracteres)',{type:'password',autocomplete:'new-password',minlength:8}),
      input('confirmation','Confirmar nueva contraseña',{type:'password',autocomplete:'new-password'})
    ], async ({ confirmation, ...values }) => {
      recoveryStatus.textContent = '';
      if (confirmation !== values.newPassword) {
        recoveryStatus.textContent = 'Las contraseñas nuevas no coinciden.';
        return;
      }
      try {
        await api('recover', values);
        recovery.querySelector('form').reset();
        recovery.open = false;
        clearSession('Contraseña restablecida. Entra con la nueva contraseña.');
      } catch (error) {
        recoveryStatus.textContent = error.message;
      }
    }), recoveryStatus]);
  const recovery = history('Recuperar acceso', [emailRequest, emailStatus, manualRecovery]);
  $('master-login-slot').append(recovery);

  async function save(operation, fields = {}, module = current) {
    const payload = await api('master-save', { module, operation, ...fields });
    overview = await api('master-overview');
    applySettings();
    showContactAlerts(overview.contactAlerts);
    await open(module);
    message.textContent = 'Cambios guardados.';
    return payload;
  }

  function home() {
    const quick = n('div', '', 'master-actions');
    for (const section of ['prayers','contact','donations','affiliates','billing','users']) {
      const target = nav.find(item => item.dataset.master === section);
      if (!target.hidden) quick.append(button(labels[section], () => open(section)));
    }
    if (quick.children.length) content.append(card('Accesos rápidos', note('Elige un módulo para ver sus registros y acciones.'), quick));
    const metrics = n('div', '', 'master-metrics');
    const items = [
      ['editorial','▤','Contenido pendiente','#287eb5'], ['wallpapers','▧','Wallpapers pendientes','#ab7d26'],
      ['prospects','♟','Afiliados / Prospectos','#977027'], ['active','✓','Clientes activos','#23734e'], ['billing','$','Facturas pendientes','#a95325']
    ];
    for (const [key, icon, title, tint] of items) {
      const tile = n('div', '', 'master-metric');
      tile.style.setProperty('--icon-color', tint);
      const body = n('div');
      body.append(n('small', title), n('strong', overview.metrics[key] === null ? '—' : String(overview.metrics[key])));
      tile.append(n('i', icon), body);
      metrics.append(tile);
    }
    const time = n('div', '', 'master-metric');
    time.style.setProperty('--icon-color', '#277450');
    const now = new Date();
    const zone = overview.settings.timezone || 'America/Chicago';
    const local = n('div');
    local.append(n('small', now.toLocaleDateString('es',{dateStyle:'long',timeZone:zone})), n('strong',now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',timeZone:zone})));
    time.append(n('i','▦'),local);
    metrics.append(time);
    const layout = n('div', '', 'master-dashboard');
    const primary = n('div', '', 'master-primary');
    const shortcuts = n('div', '', 'master-actions');
    for (const [title, section] of [['Generar contenido','assistant'],['Crear Wallpapers','wallpapers'],['Revisar textos','editorial'],['Ayuda general','help']]) {
      const target = nav.find(item => item.dataset.master === section);
      if (!target.hidden) shortcuts.append(button(title, () => open(section)));
    }
    const recent = overview.recent.map(item => note(`${item.title} · ${workflowLabels[item.status]}`));
    const wallpaperStrip = n('div','','master-wallpapers');
    for (const [file,label] of [['luz-del-amanecer-versiculo','Luz del amanecer'],['la-cruz-en-la-cumbre','La cruz en la cumbre'],['camino-de-oracion-versiculo','Camino de oración']]) {
      const tile = n('figure');
      const image = n('img');
      Object.assign(image,{src:`/assets/wallpapers/cristianos/${file}.jpg`,alt:label,loading:'lazy'});
      tile.append(image,n('figcaption',label));
      wallpaperStrip.append(tile);
    }
    const tasks = editorial.slice(4,10).map(title => {
      const row = n('div','','master-record master-home-task');
      row.append(n('strong',title),button('Revisar',()=>open('editorial')));
      return row;
    });
    primary.append(card('ChatGPT / IA', note('Herramientas para preparar contenido, revisarlo y enviarlo a autorización.'), shortcuts),
      card('Especialmente para Ti', ...tasks),
      card('Wallpapers', note('Vista de fondos que ya forman parte del sitio.'),wallpaperStrip,
        note(overview.metrics.wallpapers === null ? 'Acceso restringido.' : `${overview.metrics.wallpapers} pendientes de revisión en este panel.`), button('Ver wallpapers', () => open('wallpapers'))),
      card('Últimos contenidos guardados', ...(recent.length ? recent : [note('Todavía no hay borradores en la cola de revisión.')])));
    const assistant = card('Asistente ChatGPT', note('Abre el asistente existente para generar un borrador o pega texto preparado en Contenido.'),
      button('Abrir asistente', () => open('assistant')), button('Preparar un texto', () => open('editorial')), button('Registrar un wallpaper', () => open('wallpapers')));
    layout.append(primary, assistant);
    content.append(metrics,layout);
  }

  function donation(data, edit) {
    const rows = data.rows.map(item => history(`${item.date} · ${currency(item.amount, item.currency)} · ${item.method}${item.voided ? ' · Anulada' : ''}`, [
      note(item.reference || 'Sin referencia externa'), note(item.voided?.reason || item.note || 'Sin nota'),
      ...(can('donations','delete') && !item.voided ? [form('Anular registro', [input('reason','Motivo de anulación')], values => save('void',{ id:item.id,...values }))] : [])
    ]));
    const log = card('Donaciones registradas', ...(rows.length ? rows : [note('No hay donaciones registradas en este entorno.')]));
    if (!can('donations','create')) return log;
    return group(card('Registrar una donación', note('Registro manual de pagos ya confirmados. No realiza cobros.'),
      form('Guardar donación', [input('date','Fecha',{type:'date',value:today()}),input('amount','Importe'),input('currency','Moneda',{choices:currencies}),
        input('method','Medio',{choices:['Zelle','Cash App','Venmo','PayPal','Tarjeta','Efectivo','Cheque','Otro']}),
        input('reference','Referencia externa',{required:false}),input('note','Nota interna',{long:true,required:false})], values=>save('create',values))),log);
  }

  function affiliates(data, edit) {
    const linked = new Map();
    for (const item of data.messages) {
      if (!linked.has(item.clientId)) linked.set(item.clientId, []);
      linked.get(item.clientId).push(item);
    }
    const rows = data.rows.map(item => {
      const notes = [note(item.contact || 'Sin contacto registrado'), ...item.history.map(event =>
        note(`${when(event.at)} · ${affiliateLabels[event.status]} · ${event.by} · ${event.reason}`))];
      const messages = linked.get(item.id);
      if (messages) notes.push(card('Solicitudes de contacto vinculadas', ...messages.map(message => contactRecord(message, data, edit, 'affiliates'))));
      if (can('affiliates','edit')) notes.push(form('Guardar estado', [input('status','Nuevo estado',{choices:Object.entries(affiliateLabels),value:item.status}),
        input('reason','Motivo')], values=>save('status',{id:item.id,...values})));
      for (const task of item.tasks) {
        notes.push(note(`${task.label} · ${task.done ? 'Registrada ' + when(task.done.at) : 'Pendiente'}`));
        if (can('affiliates','configure') && !task.done) notes.push(form('Registrar cumplimiento', [input('note','Constancia del retiro')], v=>save('task',{id:item.id,task:task.id,...v})));
      }
      const row = history(`${item.name} · ${affiliateLabels[item.status]}`,notes);
      row.dataset.affiliateId = item.id;
      return row;
    });
    const log = card('Expedientes e historial', ...(rows.length ? rows : [note('No hay clientes registrados en este entorno.')]));
    return can('affiliates','create') ? group(card('Añadir prospecto', form('Guardar prospecto', [input('name','Nombre o negocio'),
      input('contact','Contacto interno',{required:false})], values=>save('create',values))),log) : log;
  }

  function contactRecord(item, data, edit, section) {
    const reason = data.contactReasons[item.reason].label;
    const ownerName = id => data.staff.find(account => account.id === id)?.name || id || 'Sin asignar';
    const details = [note(`${when(item.created)} · ${item.email}`), ...(item.phone ? [note(item.phone)] : []),
      ...(item.business ? [note(item.business)] : []), n('pre', item.text), note(`Responsable · ${ownerName(item.owner)}`)];
    if (section === 'contact' && item.clientId && overview.access.affiliates) {
      details.push(button('Abrir expediente en Afiliados', () => open('affiliates', true, { clientId: item.clientId })));
    }
    if (item.clientId && can('proposals','create')) {
      details.push(button('Preparar propuesta', () => open('proposals', true, {
        clientId: item.clientId, title: `Propuesta para ${item.business || item.name}`.slice(0, 160),
        text: `Solicitud de ${item.name}\nMotivo: ${reason}\n\n${item.text}`
      })));
    }
    if (edit) {
      const staff = data.staff.filter(account => item.clientId || account.general);
      const choices = [['','Sin asignar'], ...staff.map(account => [account.id, account.name])];
      if (item.owner && !choices.some(([id]) => id === item.owner)) choices.push([item.owner, ownerName(item.owner)]);
      details.push(form('Guardar seguimiento', [input('status','Estado',{choices:Object.entries(data.contactStates),value:item.status}),
        input('owner','Responsable',{choices,value:item.owner,required:false}),
        input('note','Nota privada',{long:true,required:false})],
      values => save('follow-up', { id:item.id, revision:item.revision, ...values }, section)));
    }
    if (item.notes.length) details.push(history('Notas privadas', item.notes.map(entry => note(`${when(entry.at)} · ${entry.by} · ${entry.text}`))));
    details.push(history('Historial de seguimiento', item.history.map(entry =>
      note(`${when(entry.at)} · ${entry.by} · ${data.contactStates[entry.status]} · ${ownerName(entry.owner)}${entry.noteAdded ? ' · Nota guardada' : ''}`))));
    return history(`${item.name} · ${reason} · ${data.contactStates[item.status]}`, details);
  }

  function contact(data, edit) {
    const filters = n('div', '', 'master-form');
    const query = input('query','Buscar por nombre, correo, negocio o mensaje',{type:'search',required:false});
    const state = input('filter','Estado',{choices:[['','Todos los estados'], ...Object.entries(data.contactStates)]});
    const reason = input('reason','Motivo',{choices:[['','Todos los motivos'], ...Object.entries(data.contactReasons).map(([id, item]) => [id, item.label])]});
    filters.append(query, state, reason);
    const list = n('div');
    const read = holder => holder.lastElementChild.value;
    const normalize = value => value.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const records = data.rows.map(item => ({ item,
      searchable: normalize([item.name,item.email,item.business,item.phone,item.text].join(' ')),
      element: contactRecord(item,data,edit,'contact') }));
    const empty = note(data.rows.length ? 'No hay mensajes que coincidan con la búsqueda.' : 'Todavía no hay mensajes.');
    function refresh() {
      const term = normalize(read(query).trim());
      const hits = records.filter(({item, searchable}) => searchable.includes(term) &&
        (!read(state) || item.status === read(state)) && (!read(reason) || item.reason === read(reason)));
      list.replaceChildren(...(hits.length ? hits.map(({element}) => element) : [empty]));
    }
    filters.addEventListener('input', refresh);
    filters.addEventListener('change', refresh);
    refresh();
    return card('Bandeja de mensajes', filters, list);
  }

  function showContactAlerts(alerts) {
    for (const [id, count] of [['master-contact-count', alerts.pending], ['master-affiliate-contact-count', alerts.affiliatePending]]) {
      const badge = $(id);
      badge.hidden = !count;
      badge.textContent = count ? `· ${count} ${count === 1 ? 'nuevo' : 'nuevos'}` : '';
    }
  }

  function proposals(data, edit, draft) {
    const flow = n('div','','master-flow');
    flow.append(...steps.map((step,index)=>n('span',`${index+1}. ${step}`)));
    const list = data.rows.map(item => history(`${item.title} · ${item.clientName} · ${steps[item.step]}`, [n('pre',item.text),
      ...item.history.map(event=>note(`${when(event.at)} · ${steps[event.step]} · ${event.reference}`)),
      ...(can('proposals','edit') && item.step < 3 ? [form(`Registrar ${steps[item.step+1].toLowerCase()}`, [input('reference','Constancia de la etapa')],
        v=>save('advance',{id:item.id,step:item.step,...v}))] : [])]));
    content.append(flow);
    const log = card('Propuestas y contratos', ...(list.length ? list : [note('No hay propuestas registradas.')]));
    if (!can('proposals','create')) return log;
    if (draft && !data.clients.some(client => client.id === draft.clientId)) {
      return group(card('Crear propuesta', note('El expediente vinculado ya no está habilitado para propuestas.')), log);
    }
    return group(card('Crear propuesta', data.clients.length ? form('Guardar propuesta',[input('clientId','Cliente',{choices:data.clients.map(c=>[c.id,c.name]),value:draft?.clientId}),
      input('title','Título',{value:draft?.title}),input('text','Detalle de la propuesta',{long:true,value:draft?.text})],v=>save('create',v)) : note('Añade un prospecto primero en Afiliados / Clientes.')),log);
  }

  function billing(data, edit) {
    const list = data.rows.map(item => history(`Factura ${item.number} · ${item.clientName} · ${currency(item.amount,item.currency)}`, [
      note(item.payment ? `Pagada el ${item.payment.date} · ${item.payment.reference}` : `Pendiente · Vence el ${item.due}`),
      ...(can('billing','edit') && item.status === 'open' ? [form('Registrar pago recibido',[input('date','Fecha del pago',{type:'date',value:today()}),
        input('reference','Referencia del pago')],v=>save('pay',{id:item.id,...v}))] : [])]));
    const log = card('Facturas registradas', ...(list.length ? list : [note('No hay facturas registradas.')]));
    if (!can('billing','create')) return log;
    const ready = data.contracts.filter(contract=>data.clients.some(client=>client.id===contract.clientId));
    return group(card('Crear factura interna', ready.length ? form('Guardar factura',[input('proposalId','Contrato',{choices:ready.map(row=>[row.id,row.title])}),
      input('number','Número de factura'),input('amount','Importe'),input('currency','Moneda',{choices:currencies}),input('due','Vencimiento',{type:'date'})],
      v=>save('create',{...v,clientId:ready.find(row=>row.id===v.proposalId).clientId})) : note('Registra primero el contrato en Propuestas.')),log);
  }

  function userSettings(data) {
    const section = card('Usuarios y permisos', note('Las contraseñas nuevas se muestran una sola vez.'));
    function matrix(account, locked = false) {
      const wrapper = n('div', '', 'master-permission-scroll');
      const table = n('table', '', 'master-permission-table');
      const head = n('tr');
      head.append(n('th', 'Sección'));
      for (const label of Object.values(data.actionLabels)) head.append(n('th', label));
      const thead = n('thead');
      thead.append(head);
      table.append(thead);
      const rows = n('tbody');
      for (const [module, title] of Object.entries(data.labels)) {
        const row = n('tr');
        const heading = n('th', title);
        heading.scope = 'row';
        row.append(heading);
        for (const [action, label] of Object.entries(data.actionLabels)) {
          const cell = n('td');
          if (data.availableActions[module].includes(action)) {
            const control = n('input');
            control.type = 'checkbox';
            control.name = `cap_${module}_${action}`;
            control.checked = Boolean(account.capabilities?.[module]?.includes(action));
            control.disabled = locked;
            control.setAttribute('aria-label', `${title} · ${label}`);
            control.addEventListener('change', () => {
              const controls = [...row.querySelectorAll('input')];
              if (action === 'read' && !control.checked) controls.forEach(box => box.checked = false);
              else if (control.checked) controls[0].checked = true;
            });
            cell.append(control);
          } else cell.textContent = '—';
          row.append(cell);
        }
        rows.append(row);
      }
      table.append(rows);
      wrapper.append(table);
      return wrapper;
    }
    function editor(account = {}) {
      const fields = [input('id','Usuario',{value:account.id}),input('name','Nombre',{value:account.name}),
        input('role','Rol',{choices:Object.entries(data.roles),value:account.role}),
        input('expires','Vence (para acceso temporal)',{type:'date',required:false,value:account.expires?.slice(0,10)}),
        matrix(account),
        ...[['restricted','Ver peticiones restringidas'],['present','Presentar en la iglesia']].map(([key,label])=>
          input('permission_' + key,label,{check:true,value:account.permissions?.includes(key)}))];
      if (account.id) { fields[0].lastChild.readOnly = true; fields.push(input('reset','Generar credenciales nuevas',{check:true})); }
      const label = account.disabled ? 'Activar cuenta y guardar permisos' : account.id ? 'Guardar usuario' : 'Crear usuario';
      return form(label,fields,async v=>{
        const capabilities = Object.fromEntries(Object.entries(data.availableActions).map(([module, actions]) =>
          [module, actions.filter(action => v[`cap_${module}_${action}`])]));
        const permissions = ['restricted','present'].filter(key=>v['permission_'+key]);
        const { enrollment } = await save('save-user',{id:v.id,name:v.name,role:v.role,expires:v.expires,capabilities,permissions,reset:Boolean(v.reset)});
        if (enrollment) {
          const box = n('div','','master-enrollment');
          box.append(n('strong','Credenciales nuevas'),n('code',`Contraseña: ${enrollment.password}`),
            button('Ocultar credenciales',()=>box.remove()));
          content.prepend(box);
        }
      });
    }
    for (const account of data.rows) {
      if (account.needsActivation) section.append(note(`${account.name} · Pendiente de activar como administrador`));
      else if (account.role === 'master') section.append(history(`${account.name} · Administración completa`, [matrix(account, true)]));
      else section.append(history(`${account.name} · ${data.roles[account.role]}${account.disabled ? ' · Suspendido' : ''}`,[editor(account),
        ...(!account.disabled ? [button('Suspender acceso',()=>save('disable-user',{id:account.id}))] : [])]));
    }
    const accessAccounts = data.rows.filter(account => (!account.disabled || account.needsActivation) && account.id !== user.id);
    if (overview.master && accessAccounts.length) {
      const result = n('p');
      result.setAttribute('role', 'status');
      const password = input('currentPassword','Tu contraseña actual',{type:'password',autocomplete:'current-password'});
      section.append(card('Activar o recuperar otra cuenta', form('Generar código de acceso', [
        input('user','Cuenta',{choices:accessAccounts.map(account => [account.id,account.name])}),
        password
      ], async values => {
        result.textContent = '';
        password.lastElementChild.value = '';
        const { code } = await api('issue-recovery', values);
        result.textContent = 'Comparte este código en privado con el titular. Dura 30 minutos y sirve una vez. ' + code;
      }), result));
    }
    return group(card('Añadir usuario',editor()),section);
  }

  function queue(data, edit, section) {
    const rows = data.rows.map(item => {
      const exact = { id:item.id, revision:item.revision };
      const children = [n('pre',item.text),note(item.scheduled ? `Fecha prevista: ${item.scheduled}` : '')];
      if (can(section,'edit')) {
        children.push(form('Guardar nueva versión',[input('title','Título',{value:item.title}),input('text','Contenido',{long:true,value:item.text})],v=>save('edit',{...exact,...v})));
        if (item.status === 'draft') children.push(button('Enviar a revisión',()=>save('submit',exact)));
        if (item.history.length) children.push(form('Restaurar como borrador nuevo',[input('from','Versión anterior',{choices:item.history.map(row=>[row.revision,`${when(row.at)} · ${row.title}`])})],v=>save('restore',{...exact,...v})));
      }
      if (item.status === 'review' && can(section,'approve')) {
          children.push(button('Rechazar',()=>save('reject',exact)));
          children.push(form('Autorizar versión mostrada',[input('reviewed','Revisé esta vista previa',{check:true})],
            v=>save('approve',{...exact,reviewed:Boolean(v.reviewed)})));
      }
      if (item.status === 'approved' && can(section,'configure')) children.push(form('Guardar fecha prevista',[input('scheduled','Fecha',{type:'date',value:item.scheduled})],v=>save('schedule',{...exact,...v})));
      return history(`${item.title} · ${workflowLabels[item.status]}`,children);
    });
    const log = card('Borradores y revisión',...(rows.length ? rows : [note('No hay borradores guardados.') ]));
    if (!can(section,'create')) return log;
    const fields = [input('title','Título'),input('text',section==='wallpapers'?'Descripción o enlace para revisión':'Texto',{long:true})];
    if (section === 'editorial') fields.unshift(input('kind','Sección',{choices:editorial}));
    return group(card('Crear borrador',note('Guarda, revisa y registra la autorización aquí.'),form('Guardar borrador',fields,v=>save('create',v,section))),log);
  }

  function configuration(data, edit) {
    const cfg = data.settings;
    const logo = n('img');
    Object.assign(logo,{src:'/assets/logo-oficial-definitivo.png',width:100,alt:'Logo oficial de LLDB'});
    const info = card('Información general',can('configuration','configure') ? form('Guardar ajustes del panel',[input('name','Nombre',{value:cfg.name || 'Lluvia de Bendición .Com'}),
      input('slogan','Lema',{value:cfg.slogan || 'Porque queremos que el Señor llueva en ti.'}),input('timezone','Zona horaria',{choices:['America/Chicago','America/New_York','America/Puerto_Rico','America/Los_Angeles','UTC'],value:cfg.timezone || 'America/Chicago'}),
      input('compact','Modo compacto',{check:true,value:cfg.compact})],v=>save('save',{...v,compact:Boolean(v.compact)})) : note(cfg.name || 'Lluvia de Bendición .Com'));
    const roles = n('div','','master-flow');
    roles.append(...['Director Administrativo','Administrador de sección','Editor','Colaborador','Solo lectura','Usuario temporal'].map(title=>n('span',title)));
    content.append(roles);
    return group(info,card('Logo y marca',logo,note('Identidad gráfica oficial.')),
      card('Apariencia y estilo',note('Azul noche, dorado y blanco cálido. Ajusta la densidad de la interfaz con Modo compacto.')),
      card('Publicación y mantenimiento',note('Los ajustes guardados en este entorno se aplican al panel de prueba. La web pública requiere una autorización independiente.')),
      card('Integraciones',note('Donaciones y cobros se registran aquí después de verificarlos en el servicio correspondiente.')),
      card('PWA y redes sociales',note('La aplicación y las redes conservan la configuración publicada del sitio.')));
  }

  function reports(data) {
    return group(...[['donations','Donaciones registradas'],['due','Facturas pendientes'],['paid','Facturas pagadas']].map(([key,title])=>{
      const values = data[key] && Object.entries(data[key]);
      return card(title,...(values?.length ? values.map(([code, amount])=>note(currency(amount,code))) : [note(data[key] ? 'Sin movimientos registrados.' : 'Acceso restringido.')]));
    }));
  }

  function incidents(data, edit) {
    const rows = data.rows.map(item=>history(item.title,[note(item.detail),note(item.resolved ? item.resolved.note : 'Abierto'),
      ...(can('incidents','edit') && !item.resolved ? [form('Registrar resolución',[input('note','Resolución')],v=>save('resolve',{id:item.id,...v}))] : [])]));
    return group(card('Incidentes',...(rows.length?rows:[note('No hay incidentes registrados.')])),
      ...(can('incidents','create')?[card('Nuevo incidente',form('Guardar incidente',[input('title','Título'),input('text','Descripción',{long:true})],v=>save('create',v)))]:[]));
  }

  async function downloadBackup() {
    const result = await api('master-backup');
    const data = Uint8Array.from(atob(result.encrypted), byte => byte.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([data], { type:'application/octet-stream' }));
    const link = n('a');
    Object.assign(link, { href:url, download:result.filename });
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    message.textContent = 'Respaldo cifrado descargado.';
  }

  async function open(section, focus = true, context) {
    const request = ++navigation;
    const tab = nav.find(item=>item.dataset.master===section);
    if (!user || !tab || tab.hidden) return;
    current = section;
    nav.forEach(item=>item.setAttribute('aria-current',String(item===tab)));
    content.replaceChildren();
    message.textContent = '';
    $('master-prayer-slot').hidden = section !== 'prayers';
    const toolSection = ['assistant','media','wallpapers'].includes(section);
    $('master-legacy-slot').hidden = !toolSection;
    legacy.hidden = $('master-legacy-slot').hidden;
    if (toolSection) document.dispatchEvent(new CustomEvent('lldb:master-tools', { detail: { name:user.name, section, capabilities:overview.capabilities } }));
    if (section === 'prayers') { prayer.open = true; return; }
    prayer.open = false;
    if (section === 'overview') { home(); return; }
    content.append(n('h2',labels[section]));
    if (section === 'profile') {
      content.append(card('Cambiar contraseña', form('Guardar contraseña', [
        input('currentPassword','Contraseña actual',{type:'password',autocomplete:'current-password'}),
        input('newPassword','Nueva contraseña (mínimo 8 caracteres)',{type:'password',autocomplete:'new-password',minlength:8}),
        input('confirmation','Confirmar nueva contraseña',{type:'password',autocomplete:'new-password'})
      ], async ({ confirmation, ...values }) => {
        if (confirmation !== values.newPassword) throw new Error('Las contraseñas nuevas no coinciden.');
        await api('profile-password', values);
        document.dispatchEvent(new Event('lldb:master-logout'));
        clearSession('La contraseña cambió. Vuelve a iniciar sesión.');
      })));
      return;
    }
    if (['assistant','media'].includes(section)) return;
    if (section === 'help') { content.append(card('Revisión del panel',note('Usa datos de prueba. Las acciones guardan registros privados y no realizan cobros, envíos externos ni despliegues.'))); return; }
    if (section === 'radio') {
      content.append(card('Radio Interactiva',note('La configuración de la emisora conserva su reproductor original.'),
        button('Preparar cambio de programación',()=>open('editorial'))));
      return;
    }
    const result = await api('master-list',{module:section});
    if (request !== navigation || !user) return;
    const edit = overview.master || overview.access[section] === 'edit';
    const renderers = { donations:donation, affiliates, proposals, billing, users:userSettings, configuration, reports, incidents, contact };
    if (['editorial','wallpapers','testimonies'].includes(section)) content.append(queue(result,edit,section));
    else if (section==='audit') content.append(card('Actividad y respaldos',note('Respaldo de código local: respaldo/panel-maestro-2026-11-16.'),button('Descargar respaldo cifrado',downloadBackup),
      ...(result.rows.length?result.rows.map(item=>note(`${when(item.at)} · ${item.by} · ${item.operation}`)):[note('No hay cambios registrados.')])));
    else content.append(renderers[section](result,edit,context));
    if (context?.clientId && section === 'affiliates') {
      const row = [...content.querySelectorAll('[data-affiliate-id]')].find(node => node.dataset.affiliateId === context.clientId);
      if (row) { row.open = true; row.scrollIntoView({ block: 'nearest' }); }
    }
    if (focus) content.focus({preventScroll:true});
  }

  async function start(account) {
    overview = await api('master-overview');
    if (panel.classList.contains('hidden')) return;
    user = account;
    $('master-account-name').textContent = account.name;
    $('master-logout').hidden = false;
    auth.hidden = true;
    shell.hidden = false;
    applySettings();
    for (const tab of nav) {
      const key = tab.dataset.master;
      tab.hidden = !(['overview','help','profile'].includes(key) || overview.master || overview.access[key]);
    }
    showContactAlerts(overview.contactAlerts);
    clearInterval(contactTimer);
    if (overview.access.contact || overview.access.affiliates) {
      contactTimer = setInterval(async () => {
        const account = user;
        try {
          const alerts = await api('contact-alerts');
          if (account && user === account) showContactAlerts(alerts);
        } catch (error) {
          if (error.status === 401 && account && user === account) clearSession(error.message);
        }
      }, 30000);
    }
    await open('overview',false);
  }

  function applySettings() {
    panel.classList.toggle('master-compact',Boolean(overview.settings.compact));
    panel.querySelector('.master-brand strong').textContent = overview.settings.name || 'Lluvia de Bendición .Com';
    panel.querySelector('.master-brand em').textContent = overview.settings.slogan || 'Porque queremos que el Señor llueva en ti.';
  }

  function clearSession(reason = '') {
    navigation++;
    clearInterval(contactTimer);
    user = null;
    overview = null;
    login.hidden = false;
    for (const form of recovery.querySelectorAll('form')) form.reset();
    recovery.open = false;
    manualRecovery.open = false;
    emailStatus.textContent = '';
    recoveryStatus.textContent = '';
    auth.hidden = false;
    shell.hidden = true;
    $('master-logout').hidden = true;
    $('master-account-name').textContent = '';
    $('prayer-admin-status').textContent = reason;
    content.replaceChildren();
    prayer.open = false;
  }
  document.addEventListener('lldb:master-login', event=>start(event.detail).catch(error=>clearSession(error.message)));
  document.addEventListener('lldb:master-session-expired', () => clearSession('Tu sesión terminó. Vuelve a iniciar sesión.'));
  nav.forEach(tab=>tab.addEventListener('click',()=>open(tab.dataset.master).catch(showError)));
  $('master-logout').onclick = async () => { try { await api('logout'); document.dispatchEvent(new Event('lldb:master-logout')); clearSession('Sesión cerrada.'); } catch (error) { showError(error); } };
  new MutationObserver(() => {
    const hidden = panel.classList.contains('hidden');
    if (hidden === wasHidden) return;
    wasHidden = hidden;
    if (hidden) { clearSession(); return; }
    api('session').then(({user})=>start(user)).catch(()=>login.elements.user.focus());
  }).observe(panel,{attributes:true,attributeFilter:['class']});
})();
