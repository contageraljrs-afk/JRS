/* JRS GUINDASTES · Ordens de Serviço Comerciais v2
 * OS independente ou vinculada posteriormente à proposta (1:1 por proposta).
 * Dados armazenados localmente, como nos demais módulos JRS.
 */
(function(){
'use strict';
const STATUS=['Aguardando confirmação','Programada','Em execução','Concluída','Cancelada'];
let search='',statusFilter='Todos';
const E=v=>esc(v??'');
const proposals=()=>Array.isArray(db.proposals)?db.proposals:[];
const orders=()=>{if(!Array.isArray(db.commercialOrders))db.commercialOrders=[];return db.commercialOrders};
const getProposal=id=>proposals().find(p=>p.id===id)||null;
const getOrder=id=>orders().find(o=>o.id===id)||null;
const byProposal=id=>orders().find(o=>o.proposalId===id)||null;
const trim=s=>String(s??'').trim();
const dateOK=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00');return Number.isFinite(d.getTime())&&d.getFullYear()===Number(s.slice(0,4))&&d.getMonth()+1===Number(s.slice(5,7))&&d.getDate()===Number(s.slice(8,10))};
const dateText=s=>dateOK(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'Não informada';
const timeOK=s=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s||'');
const mapsUrl=address=>'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(address)+'&travelmode=driving';
const wazeUrl=address=>'https://www.waze.com/ul?q='+encodeURIComponent(address)+'&navigate=yes';
const routeLinks=(address,className='')=>{
 const addressText=trim(address);if(!addressText)return '';
 return '<div class="cos-routes '+E(className)+'">'+
  '<a target="_blank" rel="noopener noreferrer" href="'+E(mapsUrl(addressText))+'">📍 Abrir no Google Maps ↗</a>'+
  '<a target="_blank" rel="noopener noreferrer" href="'+E(wazeUrl(addressText))+'">🚗 Abrir no Waze ↗</a></div>';
};
function fullAddress(p){
 let addr=trim(p?.address);
 const city=trim(p?.city),state=trim(p?.state);
 if(city&&!addr.toLocaleLowerCase('pt-BR').includes(city.toLocaleLowerCase('pt-BR')))addr+=(addr?', ':'')+city;
 if(state&&!addr.toUpperCase().includes(state.toUpperCase()+' ')&&!addr.toUpperCase().endsWith(' '+state)&&!addr.toUpperCase().endsWith('/'+state))addr+=(addr?' / ':'')+state;
 return addr;
}
function defaults(p){
 return {proposalId:p?.id||'',client:trim(p?.tenant),requester:trim(p?.contact),responsiblePhone:trim(p?.phone),
  address:fullAddress(p),serviceDescription:trim(p?.scope),itemsToBring:'',equipment:trim(p?.equipment),
  serviceDate:dateOK(p?.startDate)?p.startDate:'',departureTime:'',arrivalTime:timeOK(p?.startTime)?p.startTime:'',
  driver:'',helper:'',notes:'',status:p?.status==='Aprovada'?'Programada':'Aguardando confirmação'};
}
const validRefs=()=>proposals().slice().sort((a,b)=>(b.issueDate||'').localeCompare(a.issueDate||'')).map(p=>({id:p.id,label:(p.number||p.id)+' · '+(p.tenant||'Cliente não informado')+' · '+(p.status||'Sem situação')}));
function render(){
 if(!canView('commercialOS'))return '<div class="card">Você não tem acesso às Ordens de Serviço comerciais.</div>';
 const records=orders(),scheduled=records.filter(o=>o.status==='Programada').length,active=records.filter(o=>o.status==='Em execução').length;
 return '<section class="cos-page"><div class="cos-head"><div><span class="eyebrow">JRS GUINDASTES · COMERCIAL E OPERAÇÕES</span><h1>Ordens de Serviço Comerciais</h1><p>Crie a OS mesmo sem proposta e vincule uma proposta depois. Organize hora de saída, destino, responsável, serviço e materiais.</p></div>'+(canEdit('commercialOS')?'<button class="btn primary" type="button" onclick="JRSCommercialOS.open()">＋ Nova Ordem de Serviço</button>':'')+'</div>'
 +'<div class="cos-stats"><div class="card"><small>OS vinculadas</small><strong>'+records.length+'</strong></div><div class="card"><small>Programadas</small><strong>'+scheduled+'</strong></div><div class="card"><small>Em execução</small><strong>'+active+'</strong></div></div>'
 +'<div class="cos-hint"><b>Fluxo comercial:</b> crie uma OS <b>com ou sem proposta</b>. Se ainda não houver proposta, selecione <b>Sem proposta — vincular depois</b>. Quando precisar, use <b>Vincular proposta</b> na OS. Cada proposta pode ter uma OS comercial vinculada; a OS de vistoria continua separada.</div>'
 +'<div class="cos-toolbar"><input class="search" aria-label="Pesquisar ordem de serviço" placeholder="Buscar OS, proposta, cliente ou endereço..." value="'+E(search)+'" oninput="JRSCommercialOS.search(this.value)">'+
 '<select aria-label="Filtrar ordens" onchange="JRSCommercialOS.filter(this.value)"><option value="Todos">Todas as situações</option>'+STATUS.map(s=>'<option '+(statusFilter===s?'selected':'')+'>'+E(s)+'</option>').join('')+'</select></div><div id="cos-result">'+tableRows()+'</div></section>';
}
function tableRows(){
 const q=search.toLocaleLowerCase('pt-BR').trim();
 const items=orders().filter(o=>(statusFilter==='Todos'||o.status===statusFilter)&&(!q||[o.id,o.proposalNumber,o.client,o.requester,o.address,o.serviceDescription].join(' ').toLocaleLowerCase('pt-BR').includes(q)))
 .sort((a,b)=>(b.serviceDate||'').localeCompare(a.serviceDate||'')||(b.updatedAt||'').localeCompare(a.updatedAt||''));
 return '<div class="card tablewrap cos-table-wrap"><table class="table cos-table"><thead><tr><th>OS / Proposta</th><th>Cliente / contato</th><th>Saída</th><th>Endereço / rota</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+
 (items.length?items.map(o=>'<tr><td><b>'+E(o.number||o.id)+'</b><small>'+E(o.proposalNumber||getProposal(o.proposalId)?.number||(o.proposalId?'Proposta não localizada':'Sem proposta vinculada'))+'</small></td><td><b>'+E(o.client||'—')+'</b><small>'+E(o.requester||'Sem solicitante')+(o.responsiblePhone?' · '+E(o.responsiblePhone):'')+'</small></td>'+
 '<td><b>'+dateText(o.serviceDate)+'</b><small>Saída: '+E(o.departureTime||'—')+'</small></td>'+
 '<td><span class="cos-address">'+E(o.address||'Endereço pendente')+'</span>'+routeLinks(o.address,'cos-table-links')+'</td>'+
 '<td><span class="cos-status '+(o.status==='Concluída'?'complete':o.status==='Cancelada'?'cancel':o.status==='Aguardando confirmação'?'waiting':'progress')+'">'+E(o.status||'—')+'</span></td>'+
 '<td><div class="actions cos-action-buttons"><button type="button" class="btn tiny" onclick="JRSCommercialOS.view(\''+E(o.id)+'\')">Ver OS</button><button type="button" class="btn tiny" onclick="JRSCommercialOS.print(\''+E(o.id)+'\')">Imprimir / PDF</button>'+(canEdit('commercialOS')?'<button type="button" class="btn tiny" onclick="JRSCommercialOS.open(null,\''+E(o.id)+'\')">Editar</button>'+(o.proposalId?'':'<button type="button" class="btn tiny cos-link-later" onclick="JRSCommercialOS.link(\''+E(o.id)+'\')">Vincular proposta</button>'):'')+'</div></td></tr>').join(''):
 '<tr><td colspan="6" class="empty">Nenhuma OS comercial registrada. Crie uma OS mesmo que a proposta ainda não exista.</td></tr>')+'</tbody></table></div>';
}
function field(name,title,value,opt={}){
 const id='cos-'+name;const max=opt.max||180;
 let input='';
 if(opt.multi)input='<textarea id="'+id+'" name="'+name+'" rows="'+(opt.rows||3)+'" maxlength="'+max+'" '+(opt.required?'required':'')+' placeholder="'+E(opt.placeholder||'')+'">'+E(value)+'</textarea>';
 else if(opt.options)input='<select id="'+id+'" name="'+name+'">'+opt.options.map(s=>'<option value="'+E(s)+'" '+(s===value?'selected':'')+'>'+E(s)+'</option>').join('')+'</select>';
 else input='<input id="'+id+'" name="'+name+'" type="'+(opt.type||'text')+'" maxlength="'+max+'" value="'+E(value)+'" '+(opt.required?'required':'')+' placeholder="'+E(opt.placeholder||'')+'">';
 return '<div class="field'+(opt.full?' span2':'')+'"><label for="'+id+'">'+E(title)+(opt.required?' *':'')+'</label>'+input+'</div>';
}
function proposalPicker(id,locked){
 return '<div class="field span2"><label for="cos-proposalId">Proposta comercial (opcional)</label>'+
 '<select id="cos-proposalId" name="proposalId" '+(locked?'disabled':'')+'><option value="">Sem proposta — vincular depois</option>'+
 validRefs().map(x=>'<option value="'+E(x.id)+'" '+(id===x.id?'selected':'')+'>'+E(x.label)+'</option>').join('')+
 '</select>'+(locked?'<input type="hidden" name="proposalId" value="'+E(id)+'">':'')+
 '<small>'+(locked?'Esta OS já está vinculada à proposta indicada. O vínculo é preservado ao editar.':'Você pode salvar a OS sem proposta e fazer o vínculo mais tarde, sem perder os dados da operação.')+'</small></div>';
}
function staffDatalist(name,role){
 return '<datalist id="cos-people-'+name+'">'+(db.staff||[]).filter(s=>s.status==='Ativo'&&(role==='driver'?/motorista|operador/i.test(s.role||''):/ajudante/i.test(s.role||''))).map(s=>'<option value="'+E(s.name)+'"></option>').join('')+'</datalist>';
}
function open(proposalId,orderId){
 if(!requireEdit('commercialOS'))return;
 const p=proposalId?getProposal(proposalId):null;
 if(proposalId&&!p)return alert('A proposta vinculada não foi encontrada.');
 const old=orderId?getOrder(orderId):p?byProposal(p.id):null;
 if(orderId&&!old)return alert('A Ordem de Serviço não foi encontrada.');
 const d=old||defaults(p);
 const HTML='<div class="cos-form-intro"><b>'+E(old?'Editar OS '+(old.number||old.id):'Preparar Ordem de Serviço comercial')+'</b><p>Você pode preparar a OS <b>sem proposta</b> e vincular depois. Confira as instruções antes de liberar a operação. A <b>hora de saída</b> é independente da chegada na obra.</p></div>'+
 '<form id="cos-form" class="form-grid">'+proposalPicker(old?.proposalId||p?.id||'',Boolean(old?.proposalId))+
 '<div class="span2 cos-section"><h3>01 · Identificação e contato</h3></div>'+
 field('client','Nome do cliente / empresa',d.client,{required:true,max:150})+
 field('requester','Quem solicitou o serviço',d.requester,{required:true,max:120})+
 field('responsiblePhone','Contato do responsável (telefone / WhatsApp)',d.responsiblePhone,{required:true,max:40,type:'tel'})+
 field('status','Situação da OS',d.status,{options:STATUS})+
 '<div class="span2 cos-section"><h3>02 · Saída, destino e operação</h3></div>'+
 field('serviceDate','Data da operação',d.serviceDate,{required:true,type:'date'})+
 field('departureTime','Hora de saída da equipe',d.departureTime,{required:true,type:'time'})+
 field('arrivalTime','Horário previsto no local (opcional)',d.arrivalTime,{type:'time'})+
 field('equipment','Equipamento / recurso',d.equipment,{max:250})+
 field('address','Endereço completo do serviço',d.address,{multi:true,required:true,full:true,max:500,rows:2,placeholder:'Rua, número, bairro, cidade e UF'})+
 field('serviceDescription','O que será feito no local',d.serviceDescription,{multi:true,required:true,full:true,max:1300,rows:4})+
 '<div class="span2 cos-section"><h3>03 · Equipe e materiais</h3></div>'+
 field('driver','Motorista / operador (opcional)',d.driver,{max:120})+
 field('helper','Ajudante (opcional)',d.helper,{max:120})+
 staffDatalist('driver','driver')+staffDatalist('helper','helper')+
 field('itemsToBring','O QUE PRECISA LEVAR',d.itemsToBring,{multi:true,required:true,full:true,max:1100,rows:3,placeholder:'Ex.: PEGA PALLET, cintas, manilhas, madeira para patolas...'})+
 field('notes','Orientações adicionais / observações',d.notes,{multi:true,full:true,max:900,rows:3})+
 '<div class="span2 cos-form-helper">As rotas do Google Maps e do Waze são geradas a partir do endereço informado. Confira o destino antes de iniciar a viagem. O link não confirma a localização da obra.</div>'+
 '<div class="span2" id="cos-error" role="alert"></div>'+
 '<div class="span2 actions cos-form-actions"><button type="submit" class="btn primary">Salvar Ordem de Serviço</button>'+(old?'<button type="button" class="btn" onclick="JRSCommercialOS.print(\''+E(old.id)+'\')">Imprimir / PDF</button>':'')+
 '<button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div></form>';
 openDialog(old?'Editar OS comercial · '+(old.number||old.id):'Nova Ordem de Serviço comercial',HTML);
 if(!old){
  const select=document.getElementById('cos-proposalId');
  let previousDefaults=defaults(p);
  select.addEventListener('change',event=>{
   const current=defaults(getProposal(event.target.value));
   for(const name of ['client','requester','responsiblePhone','address','serviceDescription','equipment','serviceDate','arrivalTime','status']){
    const control=document.getElementById('cos-'+name);
    // Never erase fields the commercial team already typed manually.
    if(control&&(!trim(control.value)||control.value===previousDefaults[name]))control.value=current[name]||'';
   }
   previousDefaults=current;
  });
 }
 for(const name of ['driver','helper']){
  const input=document.getElementById('cos-'+name);
  if(input)input.setAttribute('list','cos-people-'+name);
 }
 const form=document.getElementById('cos-form');
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const err=document.getElementById('cos-error');
  try{
   const raw=Object.fromEntries(new FormData(form));
   const linkedId=trim(raw.proposalId);
   const currentP=linkedId?getProposal(linkedId):null;
   if(linkedId&&!currentP)throw Error('A proposta selecionada não foi encontrada.');
   if(old?.proposalId&&old.proposalId!==linkedId)throw Error('Esta OS já possui uma proposta vinculada. O vínculo existente foi preservado.');
   if(currentP){
    const linked=byProposal(currentP.id);
    if(linked&&linked.id!==old?.id)throw Error('Esta proposta já está vinculada a outra OS. Abra o registro existente.');
   }
   const data={proposalId:currentP?.id||'',proposalNumber:currentP?trim(currentP.number||currentP.id):''};
   for(const name of ['client','requester','responsiblePhone','address','serviceDescription','itemsToBring','notes','equipment','driver','helper'])data[name]=trim(raw[name]);
   for(const name of ['serviceDate','departureTime','arrivalTime','status'])data[name]=trim(raw[name]);
   if(!data.client||!data.requester||!data.responsiblePhone||!data.address||!data.serviceDescription||!data.itemsToBring)throw Error('Preencha cliente, solicitante, contato, endereço, serviço e o que precisa levar.');
   if(!dateOK(data.serviceDate))throw Error('Informe uma data de operação válida.');
   if(!timeOK(data.departureTime))throw Error('Informe a hora de saída da equipe.');
   if(data.arrivalTime&&!timeOK(data.arrivalTime))throw Error('Horário previsto de chegada inválido.');
   if(!STATUS.includes(data.status))throw Error('Situação da OS inválida.');
   const record=old||{id:uid('OS-COM'),createdAt:new Date().toISOString()};
   if(!old){
    const year=new Date().getFullYear(),start=orders().length+1;
    let seq=start,number;
    do{number='OS-'+year+'-'+String(seq++).padStart(4,'0')}
    while(orders().some(x=>x.number===number));
    record.number=number;
   }
   Object.assign(record,data,{updatedAt:new Date().toISOString()});
   if(!old)orders().push(record);
   save();closeDialog();window.render();
  }catch(e){err.textContent=e.message||'Falha ao salvar Ordem de Serviço.'}
 });
}
function link(id){
 if(!requireEdit('commercialOS'))return;
 const order=getOrder(id);
 if(!order)return alert('Ordem de Serviço não encontrada.');
 if(order.proposalId)return alert('Esta OS já possui uma proposta vinculada.');
 const free=validRefs().filter(x=>!byProposal(x.id));
 if(!free.length)return alert('Não há propostas livres para vincular. Cadastre uma nova proposta ou confira as já vinculadas.');
 openDialog('Vincular proposta à OS · '+(order.number||order.id),
 '<div class="cos-form-intro"><b>Vincular proposta depois</b><p>Essa operação mantém a OS <b>'+E(order.number||order.id)+'</b> e todos os dados registrados. Nenhuma informação operacional será substituída.</p></div>'+
 '<form id="cos-link-form" class="form-grid"><div class="field span2"><label for="cos-link-proposal">Selecione a proposta *</label><select id="cos-link-proposal" name="proposalId" required><option value="">Selecione a proposta</option>'+
 free.map(x=>'<option value="'+E(x.id)+'">'+E(x.label)+'</option>').join('')+'</select></div>'+
 '<div class="span2" id="cos-link-error" role="alert"></div><div class="span2 actions"><button class="btn primary" type="submit">Confirmar vínculo</button><button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div></form>');
 document.getElementById('cos-link-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const selected=trim(new FormData(event.target).get('proposalId'));
   const proposal=getProposal(selected);
   if(!proposal)throw Error('Selecione uma proposta comercial válida.');
   if(order.proposalId)throw Error('Esta OS já possui uma proposta vinculada.');
   if(byProposal(proposal.id))throw Error('Esta proposta já possui outra OS vinculada.');
   order.proposalId=proposal.id;
   order.proposalNumber=trim(proposal.number||proposal.id);
   order.updatedAt=new Date().toISOString();
   save();closeDialog();window.render();
  }catch(error){document.getElementById('cos-link-error').textContent=error.message||'Não foi possível vincular a proposta.';}
 });
}
function prefillFromProposal(id){
 if(!requireEdit('commercialOS'))return;
 open(id);
}
function view(id){
 if(!canView('commercialOS'))return;
 const o=getOrder(id);if(!o)return alert('Ordem de Serviço não encontrada.');
 const details=[
  ['Número da OS',o.number||o.id],['Proposta vinculada',o.proposalNumber||getProposal(o.proposalId)?.number||(o.proposalId?'Proposta não localizada':'Sem proposta vinculada')],
  ['Cliente',o.client],['Solicitante',o.requester],['Contato responsável',o.responsiblePhone],
  ['Data da operação',dateText(o.serviceDate)],['HORA DE SAÍDA',o.departureTime],
  ['Chegada prevista',o.arrivalTime],['Equipamento',o.equipment],['Endereço do serviço',o.address],
  ['Serviço a executar',o.serviceDescription],['Motorista / operador',o.driver],
  ['Ajudante',o.helper],['O QUE PRECISA LEVAR',o.itemsToBring],
  ['Observações',o.notes],['Situação',o.status]
 ];
 openDialog('OS comercial · '+(o.number||o.id),'<div class="cos-detail">'+details.map(([title,value])=>
  '<div class="cos-detail-item '+(title==='O QUE PRECISA LEVAR'?'alert':'')+'"><small>'+E(title)+'</small><strong>'+E(value||'—').replace(/\r?\n/g,'<br>')+'</strong></div>').join('')+'</div>'+
 '<div class="cos-detail-routes">'+routeLinks(o.address)+'</div>'+
 '<div class="actions cos-form-actions">'+(canEdit('commercialOS')?'<button type="button" class="btn" onclick="JRSCommercialOS.open(null,\''+E(o.id)+'\')">Editar OS</button>'+(o.proposalId?'':'<button type="button" class="btn cos-link-later" onclick="JRSCommercialOS.link(\''+E(o.id)+'\')">Vincular proposta</button>'):'')+
 '<button type="button" class="btn primary" onclick="JRSCommercialOS.print(\''+E(o.id)+'\')">Imprimir / Salvar PDF</button><button type="button" class="btn" onclick="closeDialog()">Fechar</button></div>');
}
function osForProposal(p){
 if(!p||!p.id)return '';
 const existing=byProposal(p.id);
 return '<button type="button" class="btn tiny cos-linked-button" onclick="JRSCommercialOS.'+
 (canEdit('commercialOS')?'open':'view')+'(\''+E(canEdit('commercialOS')?p.id:(existing?.id||''))+'\')" '+(!existing&&!canEdit('commercialOS')?'disabled':'')+'>'+
 (existing?'OS '+E(existing.number||existing.id):'＋ Vincular OS')+'</button>';
}
function print(id){
 if(!canView('commercialOS'))return;
 const o=getOrder(id);if(!o)return alert('Ordem de Serviço não encontrada.');
 const win=window.open('','_blank');
 if(!win)return alert('Permita janelas pop-up para imprimir a OS.');
 const linkA=mapsUrl(o.address),linkB=wazeUrl(o.address);
 const logo=typeof window.JRS_LOGO_NORMAL_PNG==='string'&&window.JRS_LOGO_NORMAL_PNG.startsWith('data:image/png;base64,')?
 '<img class="os-logo" src="'+window.JRS_LOGO_NORMAL_PNG+'" alt="JRS GUINDASTES">':'<span class="os-logo-fallback">JRS <b>GUINDASTES</b></span>';
 const element=(label,value,alert=false)=>'<div class="os-box '+(alert?'os-bring':'')+'"><small>'+E(label)+'</small><strong>'+E(value||'—').replace(/\r?\n/g,'<br>')+'</strong></div>';
 const body='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+E(o.number||'OS')+' · JRS Guindastes</title><style>'+
 '*{box-sizing:border-box}body{margin:0;background:#f0f1ee;color:#212721;font:12px/1.55 Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#1f2622;color:white;padding:12px 20px;z-index:1}.toolbar button{background:#f6c831;border:0;border-radius:6px;font-weight:800;cursor:pointer;padding:10px 16px}.sheet{max-width:830px;margin:20px auto;background:white;padding:38px 42px;box-shadow:0 8px 28px #1024151c}.head{border-bottom:4px solid #ecc025;padding-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px}.os-logo{max-width:210px;max-height:80px;object-fit:contain}.os-logo-fallback{font-weight:900;font-size:25px;letter-spacing:-1px}.os-logo-fallback b{color:#aa8b09}.number{text-align:right}.number small{font-size:9px;color:#6d7c6e;letter-spacing:1px}.number h1{font-size:16px;margin:5px 0;color:#1c2e21}.number span{font-size:11px}.os-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:24px 0}.os-box{border:1px solid #e2e7df;border-radius:5px;padding:10px 12px;break-inside:avoid;overflow-wrap:anywhere}.os-box small{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#788577;font-weight:800;margin-bottom:5px}.os-box strong{display:block;font-size:12px;color:#25392a;white-space:normal}.os-box.wide{grid-column:1/-1}.os-box.emphasis{border:2px solid #d8b532;background:#fff9e7}.os-box.emphasis strong{font-size:20px}.os-box.os-bring{grid-column:1/-1;background:#fff3f1;border:2px solid #d3483e}.os-box.os-bring strong,.os-box.os-bring small{color:#af2820}.routes{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.routes a{display:inline-block;padding:9px 14px;border-radius:6px;border:1px solid #c5d7c7;background:#f3f9f3;color:#205c31;text-decoration:none;font-weight:800}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:64px}.signatures div{text-align:center;border-top:1px solid #374a3b;padding-top:8px;font-size:10px}.foot{border-top:1px solid #e3e7e2;font-size:9px;color:#818d83;padding-top:13px;margin-top:32px}.warning{font-size:10px;padding:9px 12px;color:#9f712b;background:#fffaec;border:1px solid #f3e2b7}@media(max-width:600px){.sheet{padding:18px}.os-grid{grid-template-columns:1fr}.number{text-align:left}.head{flex-direction:column;align-items:flex-start}.os-box.wide,.os-box.os-bring{grid-column:1}.signatures{gap:10px}}@media print{body{background:#fff}.toolbar{display:none}.sheet{margin:0;padding:0;box-shadow:none;max-width:none}@page{size:A4;margin:12mm}}</style></head><body>'+
 '<div class="toolbar"><b>JRS GUINDASTES · ORDEM DE SERVIÇO</b><button type="button" onclick="window.print()">Imprimir / Salvar PDF</button></div>'+
 '<article class="sheet"><header class="head">'+logo+'<div class="number"><small>ORDEM DE SERVIÇO COMERCIAL</small><h1>'+E(o.number||o.id)+'</h1><span>Proposta vinculada: '+E(o.proposalNumber||getProposal(o.proposalId)?.number||(o.proposalId?'Proposta não localizada':'Sem proposta vinculada'))+'</span></div></header>'+
 '<div class="os-grid">'+element('Nome do cliente',o.client)+element('Solicitado por',o.requester)+element('Telefone / WhatsApp responsável',o.responsiblePhone)+element('Situação',o.status)+
 '<div class="os-box emphasis"><small>DATA DA OPERAÇÃO</small><strong>'+dateText(o.serviceDate)+'</strong></div>'+
 '<div class="os-box emphasis"><small>HORA DE SAÍDA DA EQUIPE</small><strong>'+E(o.departureTime||'—')+'</strong></div>'+
 element('Horário previsto no local',o.arrivalTime)+element('Equipamento / recurso',o.equipment)+
 '<div class="os-box wide">'+elementInner('Endereço completo',o.address)+'</div>'+
 '<div class="os-box wide">'+elementInner('Serviço a executar',o.serviceDescription)+'</div>'+
 element('Motorista / Operador',o.driver)+element('Ajudante',o.helper)+
 element('O QUE PRECISA LEVAR',o.itemsToBring,true)+
 '<div class="os-box wide">'+elementInner('Orientações adicionais',o.notes)+'</div></div>'+
 '<h3 style="font-size:12px;color:#3b4b3c">ACESSO AO LOCAL · ROTAS</h3>'+
 '<div class="routes"><a target="_blank" rel="noopener noreferrer" href="'+E(linkA)+'">📍 Navegar pelo Google Maps ↗</a><a target="_blank" rel="noopener noreferrer" href="'+E(linkB)+'">🚗 Navegar pelo Waze ↗</a></div>'+
 '<p class="warning">Confira o endereço, horário de saída, restrições de acesso, equipamentos necessários e planejamento operacional antes do deslocamento. Os links direcionam ao destino digitado, sem validar o local.</p>'+
 '<div class="signatures"><div>Comercial / responsável pela OS</div><div>Recebimento / responsável pela operação</div></div>'+
 '<div class="foot">JRS GUINDASTES · Documento operacional vinculado à proposta '+E(o.proposalNumber||'Sem proposta vinculada')+'. Registro salvo neste navegador. Emissão: '+E(new Date().toLocaleString('pt-BR'))+'</div></article></body></html>';
 win.document.open();win.document.write(body);win.document.close();win.focus();
}
function elementInner(label,value){return '<small>'+E(label)+'</small><strong>'+E(value||'—').replace(/\r?\n/g,'<br>')+'</strong>'}
window.JRSCommercialOS={
 render,open,link,view,print,osForProposal,prefillFromProposal,
 search(v){search=String(v??'');const node=document.getElementById('cos-result');if(node)node.innerHTML=tableRows()},
 filter(v){statusFilter=STATUS.includes(v)?v:'Todos';const node=document.getElementById('cos-result');if(node)node.innerHTML=tableRows()},
 __test:{orders,defaults,byProposal,fullAddress,mapsUrl,wazeUrl,dateOK,timeOK,tableRows,routeLinks}
};
})();