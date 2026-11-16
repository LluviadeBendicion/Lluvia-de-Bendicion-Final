const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const auth = require('../lib/prayer-auth.cjs');
const origin = process.env.LLDB_TEST_ORIGIN || 'http://127.0.0.1:4203';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Usa un entorno de prueba local.');

async function send(action, fields = {}, cookie = '', expected = 200, route = 'prayer') {
  const response = await fetch(`${origin}/api/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ action, ...fields })
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${route}: ${action} · ${data.error || ''}`);
  assert.match(response.headers.get('cache-control'), /no-store/);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function run() {
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const anchor = { id:'omar-rivera', name:'Omar de prueba', role:'master', permissions:[], salt,
    passwordHash:scryptSync(password,salt,32).toString('hex') };
  const configured = { [anchor.id]: anchor };
  const state = { sessions:{}, limits:{}, activity:[] };
  const pending = auth.loadUsers(state, configured)['ever-caraballo'];
  assert.equal(pending.disabled, true);
  const activation = auth.issueRecovery(state, anchor, pending, { currentPassword:password }, 'local');
  const firstPassword = randomBytes(24).toString('base64url');
  assert.equal(auth.recover(state, auth.loadUsers(state,configured),
    { user:pending.id, code:activation, newPassword:firstPassword }, 'local'),true);
  assert.equal(auth.login(state,auth.loadUsers(state,configured), { user:pending.id,password:firstPassword },'local').user.role,'master');

  const [omar, , ever] = await fetch(origin + '/preview-code').then(response => response.json());
  const first = (await send('login', omar)).cookie;
  const second = (await send('login', ever)).cookie;
  const firstOverview = (await send('master-overview', {}, first)).data;
  const secondOverview = (await send('master-overview', {}, second)).data;
  assert.deepEqual(firstOverview.capabilities, secondOverview.capabilities);
  assert.equal(secondOverview.master, true);
  const list = (module, cookie = first, expected = 200) => send('master-list', { module }, cookie, expected);
  const save = (module, operation, fields, cookie = first, expected = 200) =>
    send('master-save', { module, operation, ...fields }, cookie, expected);
  const rows = (await list('users')).data.rows;
  for (const number of [1, 2, 3]) {
    const profile = rows.find(item => item.id === `colaborador-${number}`);
    assert.equal(profile.disabled, true);
    assert.ok(Object.values(profile.capabilities).every(actions => actions.length === 0));
  }

  const profile = { id: 'colaborador-1', name: 'Colaborador 1', role: 'collaborator' };
  const login = password => send('login', { user: profile.id, password });
  await save('users', 'save-user', { ...profile, capabilities: { donations: ['create'] } }, first, 400);
  const { data: { enrollment } } = await save('users', 'save-user', {
    ...profile, capabilities: { donations: ['read'], media: ['read'], editorial: ['read', 'approve'] }
  }, second);
  const readonly = (await login(enrollment.password)).cookie;
  await list('donations', readonly);
  await save('donations', 'create', {}, readonly, 403);
  await list('users', readonly, 403);
  await save('users', 'save-user', profile, readonly, 403);
  await send('session', {}, readonly, 200, 'wallpaper-admin');
  await send('media-publish', {}, readonly, 403, 'wallpaper-admin');
  await send('editorial-publish', { kind: 'prayer' }, readonly, 403, 'wallpaper-admin');
  await send('session', {}, '__Host-lldb-admin=old-session', 401, 'wallpaper-admin');

  let { data: { item: draft } } = await save('editorial', 'create', { kind:'Oración del día', title:'Prueba de autorización', text:'Contenido de prueba.' });
  ({ data: { item:draft } } = await save('editorial','submit',{id:draft.id, revision:draft.revision}));
  await save('editorial','approve',{id:draft.id, revision:draft.revision,reviewed:true},readonly);
  await save('editorial','create',{},readonly,403);
  await save('users','save-user',{...profile, capabilities:{ donations:['read','create'] }},second);
  await send('session',{},readonly,401);
  const creator = (await login(enrollment.password)).cookie;
  const { data: { item: donation } } = await save('donations','create',
    { amount:'1.00',currency:'USD',date:'2026-11-16',method:'Prueba local' },creator);
  await save('donations','void',{id:donation.id,reason:'Prueba'},creator,403);
  await save('users','disable-user',{id:profile.id},second);
  await send('session',{},creator,401);

  const changed = randomBytes(24).toString('base64url');
  await send('profile-password',{currentPassword:'Incorrecta',newPassword:changed},second,400);
  await send('profile-password',{currentPassword:ever.password,newPassword:changed},second);
  await send('session',{},second,401,'wallpaper-admin');
  const newSession = (await send('login',{user:ever.user,password:changed})).cookie;
  const { data: { code } } = await send('issue-recovery',{user:ever.user,currentPassword:omar.password},first);
  const recovered = randomBytes(24).toString('base64url');
  await send('recover',{user:ever.user,code,newPassword:recovered});
  await send('recover',{user:ever.user,code,newPassword:changed},'',400);
  await send('session',{},newSession,401);
  await send('login',{user:ever.user,password:recovered});
  console.log('Acceso probado: administradores, colaboradores, matriz por acción, sesión compartida y recuperación.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
