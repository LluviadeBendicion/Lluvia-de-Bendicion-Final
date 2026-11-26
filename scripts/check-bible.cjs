const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const api = fs.readFileSync('api/bible.js','utf8');
async function run(query, catalog, result, key='test') {
  const calls=[];
  const context={module:{exports:{}},process:{env:{API_BIBLE_KEY:key}},URLSearchParams,AbortSignal,Date,
    fetch:async url=>{calls.push(url);return {ok:true,status:200,json:async()=>({data:calls.length===1?catalog:result})}}};
  vm.runInNewContext(api,context);
  const response={code:200,setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this},end(){}};
  await context.module.exports({method:'GET',query},response);
  return {response,calls};
}
(async()=>{
 const catalog=[{id:'rvr',name:'Reina-Valera 1960'},{id:'niv',name:'New International Version'},{id:'nvi',name:'Nueva Versión Internacional (Spanish New International Version) 2015',abbreviation:'NVI-S'}];
 for(const [ref,route] of [['GEN.1.1','verses'],['PSA.46','chapters'],['ISA.40.28-ISA.40.31','passages']]){
  const {response,calls}=await run({ref},catalog,{reference:ref,content:'Texto de prueba',copyright:'Crédito del proveedor'});
  assert.equal(response.code,200);assert.equal(response.data.version,'NVI');assert.equal(response.data.credit,'Crédito del proveedor');
  assert.ok(calls[1].includes('/nvi/'+route+'/'+ref));
 }
 const search=await run({q:'esperanza'},catalog,{verses:[{id:'ROM.15.13',reference:'Romanos 15:13',text:'Texto de prueba'}]});
 const page=await run({q:'amor y paz',offset:'20'},catalog,{total:42,verses:[{id:'ROM.15.13',reference:'Romanos 15:13',text:'Texto de prueba'}]});
 assert.equal(page.response.data.offset,20);assert.equal(page.response.data.total,42);assert.equal(page.response.data.hasMore,true);
 assert.ok(page.calls[1].includes('offset=20'));assert.ok(page.calls[1].includes('query=amor+y+paz'));
 const last=await run({q:'amor',offset:'40'},catalog,{total:41,verses:[{id:'ROM.15.13',reference:'Romanos 15:13',text:'Texto de prueba'}]});
 assert.equal(last.response.data.hasMore,false);
 const empty=await run({q:'sin coincidencias'},catalog,{total:0,verses:[]});
 assert.equal(empty.response.data.hasMore,false);assert.equal(empty.response.data.verses.length,0);
 for(const offset of ['-20','1.5','abc',['20']]) assert.equal((await run({q:'amor',offset},catalog,{})).response.code,400);
 assert.equal(search.response.data.verses.length,1);assert.ok(search.calls[1].includes('/nvi/search?query=esperanza'));
 assert.equal((await run({ref:'GEN.1.1'},catalog,{},'')).response.code,503);
 assert.equal((await run({ref:'GEN.1.1'},catalog.slice(0,2),{})).response.code,503);
 assert.equal((await run({ref:'GEN.1.1',q:'fe'},catalog,{})).response.code,400);
 const options=[['PSA','Salmos'],['PRO','Proverbios'],['ISA','Isaías'],['PHP','Filipenses'],['JAS','Santiago'],['1JN','1 Juan']].map(([value,textContent])=>({value,textContent}));
 const browser={window:{},document:{querySelectorAll:()=>options},URLSearchParams};
 vm.runInNewContext(fs.readFileSync('assets/biblia-nvi.js','utf8'),browser);
 for(const [reference,id] of [['Salmo 46:1','PSA.46.1'],['Proverbios 3:5','PRO.3.5'],['Isaías 40:28-31','ISA.40.28-ISA.40.31'],['Filipenses 4:6-7','PHP.4.6-PHP.4.7'],['Santiago 2:14–17','JAS.2.14-JAS.2.17'],['1 Juan 1:9','1JN.1.9']]) assert.equal(browser.window.LLDBBible.referenceId(reference),id);
 assert.throws(()=>browser.window.LLDBBible.referenceId('Isaías 40:31-28'));
 console.log('NVI: lectura, capítulos, rangos, concordancia, selección exclusiva, errores y referencias verificados.');
})().catch(error=>{console.error(error);process.exitCode=1});
