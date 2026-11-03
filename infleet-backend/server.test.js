'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createServer,readFleet,normPlate,Q_VEHICLES,Q_POSITIONS}=require('./server');
process.env.INFLEET_API_TOKEN='INFLEET_TEST_TOKEN_NEVER_EXPOSED';
process.env.JRS_INFLEET_ACCESS_PASSWORD='SENHA_SUPER_SEGURA_TESTE_2026';

function mockGraphQL(url,options){
 assert.equal(url,'https://api.infleet.com.br/v1/graphql');
 assert.equal(options.headers.Authorization,'Bearer INFLEET_TEST_TOKEN_NEVER_EXPOSED');
 const {query,variables}=JSON.parse(options.body);
 if(query.includes('listVehicles')){
  return Promise.resolve(new Response(JSON.stringify({data:{listVehicles:[
   {id:'infleet1',plate:'ABC-1D23',displayName:'Munck JRS',model:'Guindauto',odometer:28100,horimeter:387.5},
   {id:'infleet2',plate:'DEF8900',displayName:'Guindaste JRS',odometer:null,horimeter:null}
  ]}}),{status:200,headers:{'Content-Type':'application/json'}}));
 }
 assert(query.includes('listVehiclePositions'));
 assert.equal(typeof variables.filter.vehicleId,'string');
 const result=variables.filter.vehicleId==='infleet1'?[
  {id:'p1',address:'Hortolândia SP',fixTime:new Date().toISOString(),speed:37,ignition:true,valid:true,driver:{name:'João'}},
  {id:'p0',address:'Local antigo',fixTime:new Date(Date.now()-60000).toISOString(),speed:0,ignition:false,valid:false}
 ]:[];
 return Promise.resolve(new Response(JSON.stringify({data:{listVehiclePositions:result}}),{status:200}));
}
test('Consultas são enviadas ao endpoint GraphQL e normalizadas, sem CPF ou token no resultado',async()=>{
 const r=await readFleet(mockGraphQL);
 assert.equal(r.provider,'Infleet');
 assert.equal(r.vehicles.length,2);
 assert.equal(r.vehicles[0].plate,'ABC1D23');
 assert.equal(r.vehicles[0].position.label,'Hortolândia SP');
 assert.equal(r.vehicles[0].position.speedKmh,37);
 assert.equal(r.vehicles[0].driver,'João');
 assert.equal(r.vehicles[1].position.recordedAt,'');
 assert.equal(r.partial,false);
 assert(!JSON.stringify(r).includes('INFLEET_TEST_TOKEN'));
});
test('Servidor exige senha de integração separada e sessão de duração limitada',async t=>{
 const server=createServer({fetcher:mockGraphQL});
 await new Promise(res=>server.listen(0,'127.0.0.1',res));
 t.after(()=>new Promise(res=>server.close(res)));
 const url='http://127.0.0.1:'+server.address().port+'/api/integracoes/infleet';
 const origin='https://jrs-smart-rental.onrender.com';
 const request=(path,options={})=>fetch(url+path,{...options,headers:{Origin:origin,...options.headers}});
 const config=await (await request('/config')).json();
 assert.deepEqual(config,{provider:'Infleet',configured:true,auth:'required'});
 assert.equal((await request('/status')).status,401);
 const wrong=await request('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'errada'})});
 assert.equal(wrong.status,401);
 const login=await request('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'SENHA_SUPER_SEGURA_TESTE_2026'})});
 assert.equal(login.status,200);
 const {sessionToken}=await login.json();
 assert.match(sessionToken,/^[0-9a-f]{64}$/);
 assert.equal((await request('/status',{headers:{Authorization:'Bearer '+sessionToken}})).status,200);
 const response=await request('/frota',{headers:{Authorization:'Bearer '+sessionToken}});
 assert.equal(response.status,200);
 const body=await response.text();
 assert(body.includes('Munck JRS'));
 assert(!body.includes('INFLEET_TEST_TOKEN'));
 assert(!body.includes('SENHA_SUPER_SEGURA_TESTE_2026'));
 const denied=await fetch(url+'/frota',{headers:{Origin:'https://site-nao-autorizado.example',Authorization:'Bearer '+sessionToken}});
 assert.equal(denied.status,403);
 assert.equal(normPlate('ABC-1D23'),'ABC1D23');
 assert(Q_VEHICLES.includes('listVehicles')&&Q_POSITIONS.includes('listVehiclePositions'));
});
