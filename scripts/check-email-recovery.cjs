const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const auth = require('../lib/prayer-auth.cjs');
const { emailConfig, sendRecoveryEmail } = require('../lib/recovery-email.cjs');

async function run() {
  const env = { LLDB_RECOVERY_RESEND_KEY:'local-test', LLDB_RECOVERY_FROM_EMAIL:'panel@example.invalid',
    LLDB_RECOVERY_OMAR_EMAIL:'omar@example.invalid', LLDB_RECOVERY_EVER_EMAIL:'ever@example.invalid' };
  const settings = emailConfig(env);
  assert.equal(emailConfig({ ...env, LLDB_RECOVERY_EVER_EMAIL:env.LLDB_RECOVERY_OMAR_EMAIL }), null);
  assert.equal(emailConfig({ ...env, LLDB_RECOVERY_EVER_EMAIL:'' }).recipients['ever-caraballo'], '');
  const original = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const configured = { 'omar-rivera': { id:'omar-rivera',name:'Omar de prueba',role:'master',permissions:[],
    salt,passwordHash:scryptSync(original,salt,32).toString('hex') } };
  const state = { sessions:{}, limits:{}, activity:[] };
  const users = () => auth.loadUsers(state, configured);
  const oldSession = auth.login(state, users(), { user:' Omar Rivera ', password:original }, 'local').token;
  assert.ok(oldSession);
  assert.equal(auth.requestEmailRecovery(state, users(), settings, 'usuario-inexistente', 'local'), null);
  for (const [name, id] of [['Omar Rivera','omar-rivera'], ['Ever','ever-caraballo']]) {
    const ticket = auth.requestEmailRecovery(state, users(), settings, name, 'local');
    assert.equal(ticket.id,id);
    assert.equal(ticket.email,settings.recipients[id]);
    const password = randomBytes(24).toString('base64url');
    assert.equal(JSON.stringify(state).includes(ticket.code),false);
    await sendRecoveryEmail(settings, ticket, async (url, request) => {
      assert.equal(url,'https://api.resend.com/emails');
      const message = JSON.parse(request.body);
      assert.deepEqual(message.to,[settings.recipients[id]]);
      const link = new URL(message.text.match(/https:\/\/\S+/)[0]);
      assert.equal(link.origin,'https://www.lluviadebendicion.com');
      assert.equal(link.pathname,'/recuperar-acceso');
      assert.equal(link.search,'');
      assert.equal(new URLSearchParams(link.hash.slice(1)).get('enlace'),ticket.code);
      assert.ok(!request.headers['Idempotency-Key'].includes(ticket.code));
      return new Response('{}',{status:200});
    });
    const request = { user:name, code:ticket.code, newPassword:password };
    const changed = { ...settings, recipients:{ ...settings.recipients, [id]:'otro@example.invalid' } };
    assert.equal(auth.recoverByEmail(state,users(),changed,request,'local'),false);
    assert.equal(auth.recoverByEmail(state,users(),settings,{ ...request, code:randomBytes(32).toString('base64url') },'local'),false);
    assert.equal(auth.recoverByEmail(state,users(),settings,request,'local'),true);
    assert.equal(auth.recoverByEmail(state,users(),settings,request,'local'),false);
    assert.equal(auth.login(state,users(),{user:name,password},'local').user.role,'master');
  }
  assert.throws(() => auth.sessionUser(state,users(),oldSession),error => error.status === 401);
  assert.equal(auth.login(state,users(),{user:'omar',password:original},'local').failed,true);
  const expired = auth.requestEmailRecovery(state,users(),settings,'Ever','local');
  state.emailRecovery[expired.id][0].until = Date.now() - 1;
  assert.equal(auth.recoverByEmail(state,users(),settings,{user:'Ever',code:expired.code,newPassword:original},'local'),false);
  const emergency = randomBytes(32).toString('base64url');
  const { hash } = require('../lib/prayer-domain.cjs');
  const once = `${Date.now() + 60000}.${hash(emergency)}`;
  const shortPassword = randomBytes(6).toString('base64url');
  const bootstrap = { user:'omar-rivera',code:emergency,newPassword:shortPassword };
  assert.equal(auth.recoverOmarOnce(state,users(),once,{ ...bootstrap,user:'ever-caraballo' },'local'),false);
  assert.throws(() => auth.recoverOmarOnce(state,users(),once,{ ...bootstrap,newPassword:shortPassword.slice(1) },'local'),
    /entre 8 y 256/);
  assert.equal(auth.recoverOmarOnce(state,users(),once,bootstrap,'local'),true);
  assert.equal(auth.recoverOmarOnce(state,users(),once,bootstrap,'local'),false);
  assert.ok(auth.login(state,users(),{user:'omar',password:shortPassword},'local').token);
  console.log('Omar y Ever: inicio de sesión, entrega simulada, activación por correo, vencimiento, uso único y revocación.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
