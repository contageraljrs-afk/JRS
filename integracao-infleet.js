/* JRS GUINDASTES · Infleet (jrs-infleet-connector-v1)
 * Visão de frota, placas vinculadas e dados de telemetria SOMENTE quando
 * houver backend autenticado, proxy GraphQL Infleet e permissão no servidor.
 * Nada de tokens no navegador, resultados fabricados ou polling frequente.
 */
(function(){
'use strict';
const API='/api/integracoes/infleet';
const PORTAL='https://app.infleet.com.br/';
const HELP='https://help.infleet.com.br/pt-BR/articles/16447926-como-integrar-seus-sistemas-a-infleet-api-graphql-e-webhook';
let connection={checked:false,checking:false,ready:false,error:'',lastFetch:''};
let readings=[],loading=false,loadError='',tab='frota',search='',generation=0;
const E=x=>esc(x??'');
const clean=x=>String(x??'').trim();
const plate=x=>clean(x).toUpperCase().replace(/[^A-Z0-9]/g,'');
const dateTime=x=>{if(!x||!Number.isFinite(Date.parse(x)))return 'Não informada';return new Date(x).toLocaleString('pt-BR')};
const currentVehicles=()=>Array.isArray(db.vehicles)?db.vehicles:[];
const equipment=()=>Array.isArray(db.equipment)?db.equipment:[];
const linkStore=()=>{if(!Array.isArray(db.infleetLinks))db.infleetLinks=[];return db.infleetLinks;};
const jsCall=(method,arg)=>E('JRSInfleet.'+method+'('+JSON.stringify(arg)+')');
function localAssets(){
 const vehicles=currentVehicles().map(v=>({key:'V:'+v.id,plate:plate(v.plate),display:v.plate||'Sem placa',name:v.makeModel||v.model||'Veículo',group:'Veículo',status:v.fleetStatus||'Não informado'}));
 const extras=equipment().filter(x=>{
  const linked=currentVehicles().some(v=>(x.vehicleId&&x.vehicleId===v.id)||(x.vehiclePlate&&v.plate&&plate(x.vehiclePlate)===plate(v.plate)));
  return !linked;
 }).map(x=>({key:'E:'+x.id,plate:plate(x.vehiclePlate||x.plate),display:x.vehiclePlate||x.plate||'Sem placa',name:x.name||'Equipamento',group:'Equipamento',status:x.status||'Não informado'}));
 return vehicles.concat(extras);
}
function lookupLocal(key){return localAssets().find(x=>x.key===key)||null}
function getLink(key){return linkStore().find(x=>x.localKey===key)||null}
function safeReading(r){
 if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id.trim())return null;
 const str=(v,max=150)=>typeof v==='string'?v.slice(0,max):'';
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const p=r.position&&typeof r.position==='object'?r.position:{};
 return {
  id:r.id.slice(0,120),plate:plate(r.plate),name:str(r.name),
  driver:str(r.driver),
  location:str(p.label||r.location,180),
  timestamp:str(p.recordedAt||r.recordedAt,55),
  speedKmh:number(p.speedKmh??r.speedKmh),
  ignition:typeof p.ignition==='boolean'?p.ignition:typeof r.ignition==='boolean'?r.ignition:null,
  odometerKm:number(r.odometerKm),engineHours:number(r.engineHours),
  positionValid:typeof p.valid==='boolean'?p.valid:null
 };
}
function listReading(local){
 const link=getLink(local.key);
 const byId=link?.infleetId?readings.filter(r=>r.id===link.infleetId):[];
 const byPlate=local.plate?readings.filter(r=>r.plate===local.plate):[];
 if(byId.length===1){
  if(local.plate&&byId[0].plate&&byId[0].plate!==local.plate)return {reading:null,warning:'ID cadastrado corresponde a outra placa. Revise o vínculo.'};
  return {reading:byId[0],warning:''};
 }
 if(byId.length>1)return {reading:null,warning:'ID duplicado no relatório. Necessária conferência.'};
 if(link?.infleetId)return {reading:null,warning:'ID informado ainda não foi encontrado na Infleet.'};
 if(byPlate.length===1)return {reading:byPlate[0],warning:''};
 if(byPlate.length>1)return {reading:null,warning:'Placa duplicada na Infleet. Informe o ID para vincular.'};
 return {reading:null,warning:local.plate?'Sem correspondência nesta consulta.':'Cadastre a placa ou informe o ID Infleet.'};
}
function isRecent(r){
 if(!r.timestamp||!Number.isFinite(Date.parse(r.timestamp)))return false;
 const delay=Date.now()-Date.parse(r.timestamp);
 return delay>=0&&delay<=60*60*1000;
}
function render(){
 if(!canView('infleet'))return '<div class="card">Seu perfil não possui acesso à frota.</div>';
 if(!connection.checked&&!connection.checking)Promise.resolve().then(checkConnection);
 const assets=localAssets();
 const linked=connection.ready?assets.filter(a=>!!listReading(a).reading).length:null;
 const fresh=connection.ready?assets.filter(a=>{const r=listReading(a).reading;return r&&isRecent(r)}).length:null;
 return '<section class="infleet-module">'
  +'<div class="infleet-heading"><div><span class="eyebrow">JRS GUINDASTES · GESTÃO DE FROTAS</span><h1>Integração Infleet</h1><p>Veículos, equipamentos e dados de rastreamento em uma central, vinculados à frota da JRS.</p></div><a class="btn infleet-portal" href="'+PORTAL+'" target="_blank" rel="noopener noreferrer">Acessar Infleet ↗</a></div>'
  +'<div class="infleet-banner"><div><b>INFLEET</b><span>TELEMETRIA E MONITORAMENTO</span></div><div class="infleet-api-status '+(connection.ready?'ready':'pending')+'"><span class="infleet-light"></span>'+(connection.ready?'API autenticada pelo servidor':connection.checking?'Verificando API...':'API não conectada')+'</div></div>'
  +'<div class="infleet-stats"><div class="card"><small>Ativos cadastrados na JRS</small><strong>'+assets.length+'</strong><span>Veículos + equipamentos não vinculados</span></div><div class="card"><small>Correspondências Infleet</small><strong>'+(linked===null?'—':linked)+'</strong><span>'+(linked===null?'Aguardando API autenticada':'Por placa ou ID externo')+'</span></div><div class="card"><small>Leituras recentes</small><strong>'+(fresh===null?'—':fresh)+'</strong><span>Atualizadas há até 60 minutos</span></div></div>'
  +'<div class="infleet-status-note" role="status" aria-live="polite">'+statusText()+'</div>'
  +'<div class="infleet-actions"><button type="button" class="btn" onclick="JRSInfleet.refresh()" '+(loading||connection.checking?'disabled':'')+'>'+(loading||connection.checking?'Consultando...':'↻ Verificar conexão / atualizar')+'</button><a href="'+HELP+'" target="_blank" rel="noopener noreferrer" class="infleet-docs-link">Documentação oficial ↗</a></div>'
  +'<div class="infleet-tabs"><button type="button" class="'+(tab==='frota'?'active':'')+'" onclick="JRSInfleet.setTab(\'frota\')">Frota JRS</button><button type="button" class="'+(tab==='config'?'active':'')+'" onclick="JRSInfleet.setTab(\'config\')">Conectar API</button></div>'
  +(tab==='frota'?renderFleet():renderSetup())+'</section>';
}
function statusText(){
 if(connection.error)return '<b>Conexão não disponível.</b> '+E(connection.error);
 if(!connection.ready)return '<b>Infleet ainda não conectada.</b> A JRS pode abrir o portal oficial e organizar os vínculos, mas não há posições, velocidade ou eventos reais dentro deste aplicativo até ativar a API autenticada no servidor. Nenhuma consulta à frota foi realizada.';
 if(loadError)return '<b>API conectada.</b> '+E(loadError);
 return '<b>Dados recebidos da Infleet.</b> Atualização manual em '+E(dateTime(connection.lastFetch))+'. A última posição de cada veículo pode estar atrasada e não significa disponibilidade para locação.';
}
function renderFleet(){
 const assets=localAssets();
 const term=search.toLocaleLowerCase('pt-BR').trim();
 const filtered=assets.filter(x=>!term||[x.name,x.display,x.group].join(' ').toLocaleLowerCase('pt-BR').includes(term));
 return '<div class="infleet-list-top"><div><h2>Frota cadastrada</h2><p>Correspondência automática por placa, quando a API estiver ativa. Veículos sem correspondência podem ser vinculados por ID.</p></div><input class="search" placeholder="Buscar placa ou equipamento..." value="'+E(search)+'" oninput="JRSInfleet.search(this.value)" aria-label="Buscar veículo Infleet"></div>'
 +'<div id="infleet-fleet-results">'+tableHTML(filtered)+'</div>'
 +'<p class="infleet-footnote">O rastreamento Infleet não altera automaticamente a programação, a disponibilidade para locação ou a situação de manutenção. Dados de posição são exibidos apenas após autenticação segura no servidor.</p>';
}
function tableHTML(assets){
 if(!assets.length)return '<div class="card infleet-no-vehicles">Nenhum veículo ou equipamento cadastrado. Vá para Veículos e frota ou Equipamentos e registre sua frota primeiro.</div>';
 return '<div class="card tablewrap infleet-table-wrap"><table class="table infleet-table"><thead><tr><th>Veículo / equipamento JRS</th><th>Placa</th><th>Vínculo Infleet</th><th>Última informação</th><th>Velocidade / ignição</th><th>Ações</th></tr></thead><tbody>'+
 assets.map(a=>{
 const link=getLink(a.key),match=connection.ready?listReading(a):{reading:null,warning:''};
 const r=match.reading,latest=r?dateTime(r.timestamp):'—';
 const stale=r&&!isRecent(r)?'<small class="infleet-warning">Leitura antiga ou sem data</small>':'';
 const loc=r?(r.positionValid===false?'Posição marcada como inválida':r.location||'Local não informado'):'Não consultado';
 const plateCell='<span class="infleet-plate">'+E(a.display)+'</span>';
 return '<tr><td><b>'+E(a.name)+'</b><small>'+E(a.group)+' · '+E(a.status)+'</small></td><td>'+plateCell+'</td><td>'+(r?'<span class="infleet-state linked">Correspondente</span>':'<span class="infleet-state pending">'+(link?.infleetId?'ID informado (não validado)':'Não vinculado')+'</span>')+
 (connection.ready&&match.warning?'<small class="infleet-warning">'+E(match.warning)+'</small>':'')+'</td><td><b>'+E(loc)+'</b><small>'+E(latest)+'</small>'+stale+(r?.driver?'<small>Motorista: '+E(r.driver)+'</small>':'')+'</td>'+
 '<td>'+(r?'<b>'+(r.speedKmh===null?'—':E(r.speedKmh.toLocaleString('pt-BR')+' km/h'))+'</b><small>'+(r.ignition===null?'Ignição não informada':r.ignition?'Ignição ligada':'Ignição desligada')+'</small>'+(r.engineHours!==null?'<small>Horímetro: '+E(r.engineHours.toLocaleString('pt-BR'))+' h</small>':'')+(r.odometerKm!==null?'<small>Odômetro: '+E(r.odometerKm.toLocaleString('pt-BR'))+' km</small>':''):'—')+'</td><td>'+(canEdit('infleet')?'<button type="button" class="btn tiny" onclick="'+jsCall('editLink',a.key)+'">'+(link?.infleetId?'Editar vínculo':'Vincular ID')+'</button>':'<small>Somente leitura</small>')+'</td></tr>';
 }).join('')+'</tbody></table></div>';
}
function renderSetup(){
 return '<div class="infleet-setup"><div class="infleet-setup-intro"><h2>Como ativar a integração de verdade</h2><p>O aplicativo JRS está publicado como site estático na Render. Para sincronizar dados da Infleet com segurança, será necessário um backend autenticado. O token da Infleet <b>não deve ser inserido nesta tela, em JavaScript ou no GitHub</b>.</p></div>'
 +'<div class="infleet-steps"><div><span>01</span><section><h3>Solicite acesso de API à Infleet</h3><p>A empresa precisa solicitar um <b>Bearer token</b> à Infleet, liberado para a sua conta e os veículos correspondentes. A documentação oficial fica em <a href="https://docs.api.infleet.com.br/boas-vindas" target="_blank" rel="noopener noreferrer">docs.api.infleet.com.br</a>.</p></section></div>'
 +'<div><span>02</span><section><h3>Implante o conector seguro da JRS</h3><p>Um servidor com autenticação real guardará o token como segredo do ambiente. Ele consultará a API GraphQL da Infleet e entregará apenas dados normalizados a funcionários autorizados.</p></section></div>'
 +'<div><span>03</span><section><h3>Vincule os veículos e valide os resultados</h3><p>O sistema verificará placas e IDs da Infleet. Faça um teste inicial com uma placa e confira horários e posições antes de liberar a frota inteira.</p></section></div>'
 +'<div><span>04</span><section><h3>Webhooks, se desejar acompanhamento contínuo</h3><p>Para telemetria em tempo real, configure no painel Infleet um endpoint HTTPS autenticado e com deduplicação de eventos. A API serve para consultas sob demanda; o webhook, para histórico contínuo.</p></section></div></div>'
 +'<div class="infleet-setup-actions"><a class="btn primary" href="'+PORTAL+'" target="_blank" rel="noopener noreferrer">Abrir painel Infleet ↗</a><a class="btn" href="'+HELP+'" target="_blank" rel="noopener noreferrer">Ler guia de integração ↗</a></div>'
 +'<p class="infleet-footnote">A integração com Markponto é independente: o ponto pertence ao RH; a Infleet pertence à gestão da frota. As duas podem coexistir sem compartilhar credenciais.</p></div>';
}
function editLink(localKey){
 if(!requireEdit('infleet'))return;
 const local=lookupLocal(localKey);if(!local)return alert('Veículo não encontrado.');
 const old=getLink(localKey);
 const opt=connection.ready?'<div class="infleet-match-examples"><b>Veículos disponíveis na consulta:</b><p>'+readings.slice(0,15).map(r=>E(r.name||'Infleet')+' · '+E(r.plate)+' · ID '+E(r.id)).join('<br>')+'</p></div>':'';
 openDialog('Vincular à Infleet · '+local.name,'<div class="infleet-dialog-lead"><b>'+E(local.name)+'</b><span>Placa: '+E(local.display)+'</span><p>Esse vínculo é opcional. Com a API ativa, o aplicativo tentará relacionar automaticamente os veículos pela placa. Use o ID externo somente quando necessário.</p></div>'+
 '<form id="infleet-link-form"><div class="field"><label for="infleet-ext-id">ID do veículo na Infleet</label><input id="infleet-ext-id" name="infleetId" maxlength="120" autocomplete="off" spellcheck="false" placeholder="Cole o ID obtido no painel Infleet" value="'+E(old?.infleetId||'')+'"></div>'+opt+
 '<p class="infleet-dialog-note">O ID será armazenado apenas neste navegador. O vínculo só será considerado confirmado quando retornar no relatório oficial da API.</p><div class="actions"><button type="submit" class="btn primary">Salvar vínculo</button><button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div></form>');
 document.getElementById('infleet-link-form').addEventListener('submit',event=>{
  event.preventDefault();const value=clean(new FormData(event.target).get('infleetId'));
  if(value.length>120)return alert('ID inválido.');
  if(value&&linkStore().some(x=>x.localKey!==localKey&&x.infleetId===value))return alert('Esse ID Infleet já foi associado a outro veículo JRS.');
  db.infleetLinks=linkStore().filter(x=>x.localKey!==localKey);
  if(value)db.infleetLinks.push({localKey,infleetId:value,updatedAt:new Date().toISOString()});
  save();closeDialog();window.render();
 });
}
async function statusJSON(path){
 const response=await fetch(API+path,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('Servidor de integração ainda não configurado.');
 const type=response.headers?.get?.('content-type')||'';
 if(!type.includes('application/json'))throw Error('Resposta não é uma API de integração válida.');
 return response.json();
}
async function checkConnection(force=false){
 if(connection.checking||loading)return;
 if(connection.checked&&!force)return;
 connection.checking=true;connection.error='';const seq=++generation;
 try{
  const response=await statusJSON('/status');
  if(seq!==generation)return;
  connection.ready=response?.connected===true&&response?.provider==='Infleet'&&response?.auth==='server';
  if(!connection.ready){readings=[];connection.lastFetch='';}
 }catch(_){if(seq!==generation)return;connection.ready=false;readings=[];connection.lastFetch='';}
 finally{if(seq===generation){connection.checked=true;connection.checking=false;rerenderIfVisible();}}
 if(seq===generation&&connection.ready)await loadFleet();
}
async function loadFleet(){
 if(!connection.ready||loading)return;
 loading=true;loadError='';const seq=++generation;
 try{
  const response=await statusJSON('/frota');
  if(seq!==generation)return;
  if(response?.provider!=='Infleet'||!Array.isArray(response.vehicles)||response.vehicles.length>2000)throw Error('Formato do relatório Infleet inválido.');
  const normalized=response.vehicles.map(safeReading).filter(Boolean);
  const ids=new Set();readings=normalized.filter(v=>{if(ids.has(v.id))return false;ids.add(v.id);return true;});
  connection.lastFetch=typeof response.fetchedAt==='string'&&Number.isFinite(Date.parse(response.fetchedAt))?response.fetchedAt:new Date().toISOString();
 }catch(err){if(seq!==generation)return;readings=[];loadError=err.message||'Não foi possível obter dados da frota.';}
 finally{if(seq===generation){loading=false;rerenderIfVisible();}}
}
function rerenderIfVisible(){
 const main=document.getElementById('page');
 if(main&&main.querySelector('.infleet-module')&&typeof window.render==='function')window.render();
}
async function refresh(){
 if(connection.checking||loading)return;
 connection.checked=false;connection.ready=false;readings=[];
 rerenderIfVisible();await checkConnection(true);
}
window.JRSInfleet={
 render,refresh,editLink,setTab(v){tab=v==='config'?'config':'frota';window.render()},
 search(v){search=String(v||'');const t=document.getElementById('infleet-fleet-results');if(t)t.innerHTML=tableHTML(localAssets().filter(x=>[x.name,x.display,x.group].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))));},
 __test:{localAssets,plate,safeReading,listReading,isRecent,checkConnection,loadFleet,connection:()=>({...connection}),readings:()=>readings.slice()}
};
})();