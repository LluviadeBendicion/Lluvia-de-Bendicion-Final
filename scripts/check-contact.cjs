const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const origin = process.env.LLDB_TEST_ORIGIN || 'http://127.0.0.1:4193';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Estas pruebas escriben en el entorno local.');

async function call(action, data, status = 200, cookie = '', requestOrigin = origin) {
  const response = await fetch(origin + '/api/prayer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin, Cookie: cookie },
    body: JSON.stringify({ action, ...data })
  });
  assert.match(response.headers.get('cache-control'), /no-store/);
  const body = await response.json();
  assert.equal(response.status, status, body.error);
  return { body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function main() {
  const [director, editor] = await fetch(origin + '/preview-code').then(response => response.json());
  const { cookie: master } = await call('login', director);
  const { cookie: prayerEditor } = await call('login', editor);
  const message = {
    requestId: randomUUID(), name: 'Revisión de Contacto', email: 'contacto-prueba@example.invalid',
    business: 'Negocio de prueba', phone: '+1 (202) 555-0100', reason: 'affiliate-info',
    message: 'Consulta de afiliación de prueba.', consent: true
  };
  await call('contact-submit', { ...message, consent: false }, 400);
  await call('contact-submit', { ...message, email: 'inválido' }, 400);
  await call('contact-submit', { ...message, phone: 'número inválido' }, 400);
  await call('contact-submit', { ...message, website: 'spam' }, 400);
  await call('contact-submit', { ...message, reason: 'inexistente' }, 400);
  await call('contact-submit', message, 403, '', 'https://example.invalid');
  await call('master-list', { module: 'contact' }, 401);
  await call('master-list', { module: 'contact' }, 403, prayerEditor);
  const second = { ...message, requestId: randomUUID(), business: '  NEGOCIO   DE PRUEBA  ', email: message.email.toUpperCase(),
    reason: 'radio', message: 'Otra consulta del mismo negocio.' };
  const general = { ...message, requestId: randomUUID(), reason: 'general', message: 'Consulta general de prueba.' };
  const results = await Promise.all([
    call('contact-submit', message, 201), call('contact-submit', message, 201),
    call('contact-submit', second, 201), call('contact-submit', general, 201)
  ]);
  for (const result of results) assert.deepEqual(result.body, { received: true });
  await call('contact-submit', { ...message, message: 'Distinto contenido con mismo identificador' }, 409);
  const { body: inbox } = await call('master-list', { module: 'contact' }, 200, master);
  const { body: affiliates } = await call('master-list', { module: 'affiliates' }, 200, master);
  const qualified = inbox.rows.filter(row => row.email === message.email);
  assert.equal(qualified.length, 3);
  const first = qualified.find(row => row.id === message.requestId);
  assert.equal(first.clientId, qualified.find(row => row.id === second.requestId).clientId);
  assert.ok(first.clientId);
  assert.equal(affiliates.rows.filter(row => row.email === message.email).length, 1);
  assert.equal(affiliates.messages.filter(row => row.clientId === first.clientId).length, 2);
  const ordinary = qualified.find(row => row.id === general.requestId);
  assert.equal(ordinary.clientId, '');
  assert.equal(ordinary.business, '');
  assert.equal(first.text, message.message);
  assert.equal(first.owner, 'omar-rivera');
  assert.ok(first.consent.at);
  const { body: alerts } = await call('contact-alerts', {}, 200, master);
  assert.ok(alerts.pending >= 3 && alerts.affiliatePending >= 2);
  const staffId = 'contact-test-' + randomUUID().slice(0, 8);
  const { body: { enrollment } } = await call('master-save', {
    module: 'users', operation: 'save-user', id: staffId, name: 'Afiliados de prueba', role: 'section-admin',
    modules: { affiliates: 'edit' }
  }, 200, master);
  const { cookie: affiliateUser } = await call('login', { user: staffId, password: enrollment.password });
  await call('master-list', { module: 'contact' }, 403, affiliateUser);
  await call('master-save', { module: 'affiliates', operation: 'follow-up', id: ordinary.id,
    revision: ordinary.revision, status: 'review', owner: '' }, 404, affiliateUser);
  const follow = { module: 'affiliates', operation: 'follow-up', id: first.id,
    revision: first.revision, status: 'review', owner: staffId, note: 'Nota privada de prueba.' };
  await call('master-save', follow, 200, affiliateUser);
  await call('master-save', follow, 409, affiliateUser);
  const { body: updated } = await call('master-list', { module: 'contact' }, 200, master);
  const saved = updated.rows.find(row => row.id === first.id);
  assert.equal(saved.owner, staffId);
  assert.equal(saved.status, 'review');
  assert.equal(saved.notes.at(-1).text, follow.note);
  assert.equal(saved.history.at(-1).by, staffId);
  await call('master-save', { module: 'proposals', operation: 'create', clientId: saved.clientId,
    title: 'Propuesta privada de prueba', text: saved.text }, 200, master);
  const { body: prayer } = await call('inbox', {}, 200, master);
  assert.ok(!prayer.cases.some(row => row.id === first.id));
  console.log('Contacto: validación, almacenamiento privado, reintentos, prospecto único, alertas, permisos, seguimiento y propuesta verificados.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
