const assert = require('node:assert/strict');
const origin = process.env.LLDB_TEST_ORIGIN || 'http://127.0.0.1:4179';

async function call(action, fields, cookie = '', status = 200) {
  const response = await fetch(origin + '/api/prayer', { method:'POST', headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},
    body:JSON.stringify({ action, ...fields }) });
  const data = await response.json();
  assert.equal(response.status,status,`${action} ${fields?.module || ''}: ${JSON.stringify(data)}`);
  return { ...data, cookie:response.headers.get('set-cookie')?.split(';')[0] };
}

(async () => {
  await call('master-overview', {}, '', 401);
  const [primary, secondary] = await fetch(origin + '/preview-code').then(res=>res.json());
  const { cookie:om } = await call('login',primary);
  const { cookie:ed } = await call('login',secondary);
  const save = (module,operation,fields={},cookie=om,status=200) => call('master-save',{module,operation,...fields},cookie,status);
  const list = module => call('master-list',{module},om);
  const today = new Date().toISOString().slice(0,10);
  const mark = Date.now().toString(36);
  const baseline = await call('master-overview',{},om);
  await call('master-list',{module:'billing'},ed,403);
  const donated = await save('donations','create',{date:today,amount:'12.40',currency:'USD',method:'Efectivo'});
  assert.equal(donated.item.amount,1240);
  assert.ok((await list('reports')).donations.USD>=1240);
  await save('donations','void',{id:donated.item.id,reason:'Prueba local'});
  const { item:c } = await save('affiliates','create',{name:'Cliente de prueba ' + mark});
  const { item:p } = await save('proposals','create',{clientId:c.id,title:'Prueba',text:'Propuesta local sin envío.'});
  for (let step=0; step<3; step++) await save('proposals','advance',{id:p.id,step,reference:'Prueba de la etapa'});
  const { item:i } = await save('billing','create',{clientId:c.id,proposalId:p.id,number:'PRUEBA-'+mark,due:today,amount:'87.34',currency:'USD'});
  assert.equal((await call('master-overview',{},om)).metrics.billing,baseline.metrics.billing+1);
  await save('billing','pay',{id:i.id,date:today,reference:'Pago de prueba'});
  await save('affiliates','status',{id:c.id,status:'active',reason:'Prueba de activación'});
  assert.equal((await list('proposals')).rows.find(row=>row.id===p.id).step,6);
  await save('affiliates','status',{id:c.id,status:'banned',reason:'Prueba de bloqueo'});
  await save('proposals','create',{clientId:c.id,title:'No debe poder crearse',text:'Prueba'},om,400);
  const { item:d } = await save('affiliates','status',{id:c.id,status:'discontinued',reason:'Prueba de baja'});
  assert.equal(d.tasks.length,2);
  await save('affiliates','task',{id:c.id,task:d.tasks[0].id,note:'Constancia de prueba'});
  const { item:bio } = await save('editorial','create',{kind:'Inicio',title:'Texto de prueba',text:'Primera revisión.'});
  await save('editorial','submit',{id:bio.id,revision:bio.revision});
  await save('editorial','approve',{id:bio.id,revision:bio.revision,reviewed:true},ed,403);
  await save('editorial','approve',{id:bio.id,revision:bio.revision,reviewed:true});
  const { item:edited } = await save('editorial','edit',{id:bio.id,revision:bio.revision,title:'Texto de prueba',text:'Cambios posteriores.'});
  assert.equal(edited.approval,null);
  await save('editorial','schedule',{id:edited.id,revision:bio.revision,scheduled:today},om,409);
  const newId = 'prueba-' + mark;
  const { item:one, enrollment } = await save('users','save-user',{id:newId,name:'Lectura de prueba',role:'reader',modules:{prayers:'edit',billing:'edit'}});
  assert.equal(one.modules.billing,'read');
  assert.equal(one.permissions.includes('edit'),false);
  assert.ok(enrollment.password.length>=20);
  const users = await list('users');
  assert.ok(users.rows.some(row=>row.id===newId));
  assert.ok(!JSON.stringify(users).includes(enrollment.password));
  await save('users','disable-user',{id:newId});
  assert.ok((await list('users')).rows.find(row=>row.id===newId).disabled);
  assert.ok((await list('audit')).rows.length>=15);
  await call('master-backup',{},ed,403);
  const backup = await call('master-backup',{},om);
  assert.match(backup.filename,/\.snapshot$/);
  assert.equal(Buffer.from(backup.encrypted,'base64').includes(Buffer.from('Cliente de prueba')),false);
  await call('logout',{},om);
  await call('logout',{},ed);
  console.log('Panel Maestro: permisos, donaciones, estados de afiliados, propuestas, factura, pago, totales, versiones y usuarios verificados.');
})().catch(error=>{console.error(error);process.exitCode=1;});
