const assert = require('node:assert/strict');
const origin = process.env.LLDB_TEST_ORIGIN || 'http://127.0.0.1:4179';

async function call(action, body = {}, cookie = '', status = 200, requestOrigin = origin) {
  const response = await fetch(origin + '/api/prayer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin, Cookie: cookie },
    body: JSON.stringify({ action, ...body })
  });
  const data = await response.json();
  assert.equal(response.status, status, `${action}: ${JSON.stringify(data)}`);
  assert.match(response.headers.get('cache-control'), /no-store/);
  return { ...data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function main() {
  const { categories } = require('../assets/peticion-opciones.json');
  assert.equal(categories.length, 20);
  assert.equal(new Set(categories).size, 20);
  const marker = Math.random().toString(36).slice(2);
  const publicCase = { first: 'Celina', last: 'Prueba ' + marker, city: 'Waco', region: 'Texas', country: 'Estados Unidos',
    text: `Texto original de prueba ${marker}.`, category: 'Trabajo', additional: ['Familia'], privacy: 'anonymous', consent: true,
    forWhom: 'other', follow: true, method: 'email', contact: 'peticion@example.invalid' };
  await call('inbox', {}, '', 401);
  await call('presentation', {}, '', 401);
  await call('submit', { ...publicCase, last: '' }, '', 400);
  await call('submit', publicCase, '', 403, 'https://example.invalid');
  const created = await Promise.all([
    call('submit', publicCase, '', 201),
    call('submit', { ...publicCase, first: 'Caso sensible', additional: ['Pensamientos de suicidio'], privacy: 'church' }, '', 201),
    call('submit', { ...publicCase, first: 'Confidencial', privacy: 'confidential', follow: false }, '', 201)
  ]);
  created.forEach(data => assert.equal(data.received, true));
  const [masterCredentials, editorCredentials] = await fetch(origin + '/preview-code').then(response => response.json());
  const { cookie: master } = await call('login', masterCredentials);
  const { cookie: editor } = await call('login', editorCredentials);
  await call('login', editorCredentials, '', 401);
  const records = (await call('inbox', {}, master)).cases.filter(item => item.last.includes(marker));
  assert.equal(records.length, 3);
  const normal = records.find(item => item.first === 'Celina');
  const risk = records.find(item => item.urgent);
  const confidential = records.find(item => item.privacy === 'confidential');
  const editorInbox = await call('inbox', {}, editor);
  assert.equal(editorInbox.cases.filter(item => item.last.includes(marker)).length, 1);
  await call('detail', { id: risk.id }, editor, 404);
  await call('detail', { id: confidential.id }, editor, 404);
  let { item } = await call('detail', { id: normal.id }, editor);
  const change = async (operation, fields = {}, user = editor, status = 200) => {
    const result = await call('modify', { id: item.id, version: item.version, operation, ...fields }, user, status);
    if (result.item) item = result.item;
  };
  await change('assign', { owner: editorCredentials.user });
  await change('follow', { medium: 'email', result: 'Contacto de prueba registrado', next: '2026-12-05' });
  assert.equal(item.contacts[0].next, '2026-12-05');
  await change('state', { state: 'approved' });
  await change('draft', { text: 'Celina pidió oración.' }, editor, 400);
  await change('draft', { text: 'Oremos por una familia que busca empleo y estabilidad.' });
  let draftId = item.draft.id;
  await change('publish', { draftId }, master, 400);
  await change('request', { draftId, attest: true });
  await change('authorize', { draftId, attest: true }, editor, 403);
  await change('authorize', { draftId, attest: true }, master);
  await change('draft', { text: 'Oremos por quienes atraviesan una temporada difícil mientras buscan empleo.' });
  await change('publish', { draftId }, master, 400);
  draftId = item.draft.id;
  await change('request', { draftId, attest: true });
  await change('authorize', { draftId, attest: true }, master);
  await change('publish', { draftId }, master);
  assert.equal(item.text, publicCase.text);
  assert.deepEqual((await call('presentation', {}, master)).items.find(record => record.id === draftId), { id: draftId, text: item.draft.text });
  await change('withdraw', {}, master);
  assert.ok(!(await call('presentation', {}, master)).items.some(record => record.id === draftId));
  await call('export', { ids: [item.id] }, editor, 403);
  assert.equal((await call('export', { ids: [item.id] }, master)).cases.length, 1);
  for (const restricted of [risk, confidential]) {
    await call('modify', { id: restricted.id, version: 1, operation: 'draft', text: 'No se debe presentar.' }, master, 400);
  }
  for (let attempt = 0; attempt < 5; attempt++) await call('login', { user: 'usuario-inexistente', password: 'incorrecta', code: '000000' }, '', 401);
  await call('login', { user: 'usuario-inexistente', password: 'incorrecta', code: '000000' }, '', 429);
  await call('logout', {}, master);
  await call('inbox', {}, master, 401);
  console.log('Peticiones: envío concurrente, privacidad, TOTP, bloqueo, seguimiento, autorización por versión, presentación, retiro y exportación verificados.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
