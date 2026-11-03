'use strict';
/* JRS GUINDASTES — backend seguro Infleet GraphQL
 * Token Infleet exclusivamente no ambiente do servidor.
 * Autenticação independente do login local demonstrativo da JRS.
 */
const http=require('node:http');
const crypto=require('node:crypto');
const GRAPHQL='https://api.infleet.com.br/v1/graphql';
const APP_ORIGIN=process.env.JRS_APP_ORIGIN||'https://jrs-smart-rental.onrender.com';
const API='/api/integracoes/infleet';
const LOGIN_TTL=4*60*60*1000, CACHE_TTL=90*1000;
const sessions=new Map(),attempts=new Map();
let cached=null,inflight=null;

const Q_VEHICLES='query JRSListVehicles { listVehicles(limit: 100, offset: 0) { id plate displayName model odometer horimeter } }';
const Q_POSITIONS='query JRSVehiclePositions($filter: ListVehiclePositionsFilterInput!) { listVehiclePositions(filter: $filter) { id address fixTime speed ignition valid driver { name } } }';
const now=()=>Date.now();
const hash=s=>crypto.createHash('sha256').update(String(s)).digest();
const same=(a,b)=>crypto.timingSafeEqual(hash(a),hash(b));
const ready=()=>Boolean(process.env.INFLEET_API_TOKEN?.trim()&&process.env.JRS_INFLEET_ACCESS_PASSWORD?.length>=12);
const normPlate=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20);
const string=(v,max=160)=>typeof v==='string'?v.slice(0,max):'';
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;

function json(res,status,data,origin) {
 const out=JSON.stringify(data);
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(out),
  'Cache-Control':'no-store','Vary':'Origin','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
  ...(origin===APP_ORIGIN?{'Access-Control-Allow-Origin':APP_ORIGIN}:{})});
 res.end(out);
}
function body(req){
 return new Promise((resolve,reject)=>{
  let text='';let rejected=false;
  req.on('data',chunk=>{text+=chunk.toString('utf8');if(text.length>2048&&!rejected){rejected=true;reject(Error('Entrada muito grande.'));}});
  req.on('end',()=>{if(rejected)return;try{resolve(JSON.parse(text))}catch{reject(Error('JSON inválido.'))}});
  req.on('error',reject);
 });
}
function validSession(req){
 const h=String(req.headers.authorization||'');
 if(!h.startsWith('Bearer '))return false;
 const token=h.slice(7);
 if(!/^[0-9a-f]{64}$/.test(token))return false;
 const key=hash(token).toString('hex'),expires=sessions.get(key);
 if(!expires||expires<now()){sessions.delete(key);return false}
 return true;
}
async function graphql(query,variables,fetcher) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetcher(GRAPHQL,{method:'POST',redirect:'error',signal:controller.signal,
   headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+process.env.INFLEET_API_TOKEN},
   body:JSON.stringify({query,variables})});
  if([401,403].includes(response.status))throw Object.assign(Error('Token da Infleet inválido ou sem permissão.'),{status:502});
  if(response.status===429)throw Object.assign(Error('Infleet limitou as consultas. Tente depois.'),{status:503});
  if(!response.ok)throw Object.assign(Error('Falha na comunicação com a Infleet.'),{status:502});
  const result=await response.json();
  if(result.errors?.length){
   console.error('Erro no esquema GraphQL Infleet:',result.errors.map(x=>String(x.message||'Erro').slice(0,200)).join(' | '));
   throw Object.assign(Error('Consulta GraphQL rejeitada. Confirme permissões e esquema com a Infleet.'),{status:502});
  }
  if(!result.data||typeof result.data!=='object')throw Object.assign(Error('Resposta inválida da Infleet.'),{status:502});
  return result.data;
 }catch(err){if(err.name==='AbortError')throw Object.assign(Error('Consulta excedeu o tempo permitido.'),{status:504});throw err}
 finally{clearTimeout(timer)}
}
function latest(positions){
 return (Array.isArray(positions)?positions:[]).filter(x=>x&&Number.isFinite(Date.parse(x.fixTime||'')))
 .sort((a,b)=>Date.parse(b.fixTime)-Date.parse(a.fixTime))[0]||null;
}
async function readFleet(fetcher=fetch) {
 const response=await graphql(Q_VEHICLES,undefined,fetcher);
 if(!Array.isArray(response.listVehicles))throw Object.assign(Error('Formato de veículos inesperado.'),{status:502});
 const original=response.listVehicles;
 const vehicles=original.slice(0,100).filter(v=>v&&typeof v.id==='string').map(v=>({
  id:v.id.slice(0,120),plate:normPlate(v.plate),name:string(v.displayName||v.model||'Veículo',150),
  odometerKm:num(v.odometer),engineHours:num(v.horimeter),
  position:{label:'',recordedAt:'',speedKmh:null,ignition:null,valid:null}
 }));
 const startAt=new Date(now()-60*60*1000).toISOString(),endAt=new Date().toISOString();
 let failedPositions=0;
 // The GraphQL position query has no documented pagination; cap to 30 vehicles and 1h.
 for(let i=0;i<Math.min(30,vehicles.length);i+=3){
  await Promise.all(vehicles.slice(i,i+3).map(async vehicle=>{
   try{
    const result=await graphql(Q_POSITIONS,{filter:{vehicleId:vehicle.id,fixTime:{startAt,endAt}}},fetcher);
    if(!Array.isArray(result.listVehiclePositions))throw Error('Consulta de posições sem lista.');
    const p=latest(result.listVehiclePositions);
    if(!p)return;
    vehicle.position={label:string(p.address,180),recordedAt:string(p.fixTime,50),
     speedKmh:num(p.speed),ignition:typeof p.ignition==='boolean'?p.ignition:null,
     valid:typeof p.valid==='boolean'?p.valid:null};
    vehicle.driver=string(p.driver?.name,150);
   }catch(err){failedPositions++;console.error('Consulta de posição Infleet indisponível:',err.message)}
  }));
 }
 return {provider:'Infleet',fetchedAt:new Date().toISOString(),vehicles,
  partial:original.length>=100||vehicles.length>30||failedPositions>0,
  message:failedPositions?'Algumas posições não puderam ser consultadas.':original.length>=100?'Consulta limitada aos 100 primeiros veículos.':''};
}
async function cachedFleet(fetcher) {
 if(cached&&now()-cached.at<CACHE_TTL)return cached.data;
 if(inflight)return inflight;
 inflight=readFleet(fetcher).then(data=>{cached={at:now(),data};return data}).finally(()=>{inflight=null});
 return inflight;
}
function createServer({fetcher=fetch}={}) {
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origin!==APP_ORIGIN)return json(res,403,{error:'Origem não autorizada.'});
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='OPTIONS'&&path.startsWith(API)){
   res.writeHead(204,{'Access-Control-Allow-Origin':origin===APP_ORIGIN?APP_ORIGIN:'',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':'Authorization, Content-Type',
    'Access-Control-Max-Age':'600','Vary':'Origin'});return res.end();
  }
  if(path==='/health'&&req.method==='GET')return json(res,200,{status:'ok',service:'JRS Infleet API'},origin);
  if(!path.startsWith(API))return json(res,404,{error:'Rota não encontrada.'},origin);
  if(path===API+'/config'&&req.method==='GET')return json(res,200,{provider:'Infleet',configured:ready(),auth:'required'},origin);
  if(path===API+'/login'&&req.method==='POST'){
   if(!ready())return json(res,503,{error:'Configure INFLEET_API_TOKEN e JRS_INFLEET_ACCESS_PASSWORD na Render.'},origin);
   const ip=String(req.socket.remoteAddress||'unknown');
   const track=attempts.get(ip)||{count:0,start:now()};
   if(now()-track.start>15*60*1000){track.count=0;track.start=now()}
   if(track.count>=8)return json(res,429,{error:'Muitas tentativas. Aguarde 15 minutos.'},origin);
   let input;try{input=await body(req)}catch{return json(res,400,{error:'Entrada inválida.'},origin)}
   if(!input||typeof input.password!=='string'||!same(input.password,process.env.JRS_INFLEET_ACCESS_PASSWORD)){
    track.count++;attempts.set(ip,track);
    return json(res,401,{error:'Senha de integração inválida.'},origin);
   }
   attempts.delete(ip);
   for(const [key,expiry] of sessions)if(expiry<now())sessions.delete(key);
   const token=crypto.randomBytes(32).toString('hex');
   sessions.set(hash(token).toString('hex'),now()+LOGIN_TTL);
   return json(res,200,{provider:'Infleet',sessionToken:token,expiresInSeconds:LOGIN_TTL/1000},origin);
  }
  if(!ready())return json(res,503,{provider:'Infleet',error:'Integração ainda não configurada.'},origin);
  if(!validSession(req))return json(res,401,{provider:'Infleet',error:'Autenticação necessária.'},origin);
  if(path===API+'/status'&&req.method==='GET')return json(res,200,{provider:'Infleet',connected:true,auth:'server'},origin);
  if(path===API+'/frota'&&req.method==='GET'){
   try{return json(res,200,await cachedFleet(fetcher),origin)}
   catch(err){return json(res,err.status||502,{provider:'Infleet',error:err.message||'Falha de comunicação.'},origin)}
  }
  return json(res,405,{error:'Método não permitido.'},origin);
 });
}
if(require.main===module){
 const port=Number(process.env.PORT)||10000;
 createServer().listen(port,'0.0.0.0',()=>console.log('JRS Infleet API pronta na porta '+port+'; configuração '+(ready()?'presente':'pendente')));
}
module.exports={createServer,readFleet,latest,normPlate,Q_VEHICLES,Q_POSITIONS};
