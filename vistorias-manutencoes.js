/* JRS Guindastes: Vistorias, Ordens de Serviço e Manutenções — jrs-os-maintenance-v1 */
(function(){
'use strict';
let inspectQuery='',maintenanceQuery='';
const IST=['Agendada','Em vistoria','Concluída','Necessita adequações','Cancelada'];
const MST=['Agendada','Em execução','Aguardando peças','Concluída','Cancelada'];
const TYPES=['Preventiva','Corretiva','Preditiva','Revisão periódica','Emergencial','Outra'];
const e=x=>esc(x??'');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const date=d=>d?fmt(d):'—';
const inspections=()=>{if(!Array.isArray(db.inspections))db.inspections=[];return db.inspections};
const maintenances=()=>{if(!Array.isArray(db.maintenances))db.maintenances=[];return db.maintenances};
const field=(name,label,value='',opt={})=>{
 const cls='field'+(opt.full?' span2':'');
 let control='';
 const id='jrs-srv-'+name;
 if(opt.options)control='<select id="'+id+'" name="'+name+'" '+(opt.required?'required':'')+'>'+opt.options.map(v=>'<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(v)+'</option>').join('')+'</select>';
 else if(opt.multi)control='<textarea id="'+id+'" name="'+name+'" maxlength="'+(opt.max||900)+'" rows="'+(opt.rows||3)+'" '+(opt.required?'required':'')+' placeholder="'+e(opt.placeholder||'')+'">'+e(value)+'</textarea>';
 else control='<input id="'+id+'" name="'+name+'" type="'+(opt.type||'text')+'" '+(opt.required?'required':'')+' maxlength="'+(opt.max||200)+'" '+(opt.type==='number'?'min="0" step="0.01"':'')+' value="'+e(value)+'" placeholder="'+e(opt.placeholder||'')+'">';
 return '<div class="'+cls+'"><label for="'+id+'">'+e(label)+(opt.required?' *':'')+'</label>'+control+'</div>';
};
function suggestions(name,label,value,list,opts={}){
 const html=field(name,label,value,opts);const token='id="jrs-srv-'+name+'"';
 return html.replace(token,token+' list="jrs-options-'+name+'"').replace('</div>','<datalist id="jrs-options-'+name+'">'+list.map(x=>'<option value="'+e(x)+'"></option>').join('')+'</datalist></div>');
}
function assets(){
 const eq=(db.equipment||[]).map(x=>({id:'E:'+x.id,label:x.name+(x.vehiclePlate?' · '+x.vehiclePlate:'')}));
 const vehicles=canView('vehicles')?(db.vehicles||[]).filter(v=>!(db.equipment||[]).some(e=>e.vehicleId===v.id||(e.vehiclePlate&&v.plate&&e.vehiclePlate.toUpperCase()===v.plate.toUpperCase()))).map(v=>({id:'V:'+v.id,label:(v.makeModel||'Veículo')+(v.plate?' · '+v.plate:'')})):[];
 return eq.concat(vehicles).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
function assetRef(ref){return assets().find(x=>x.id===ref)?.label||''}
function assetRecord(ref){
 return ref?.startsWith('E:')?(db.equipment||[]).find(x=>'E:'+x.id===ref):ref?.startsWith('V:')?(db.vehicles||[]).find(x=>'V:'+x.id===ref):null;
}
function selector(ref,required){
 return '<div class="field span2"><label for="jrs-srv-asset">Equipamento / veículo'+(required?' *':'')+'</label><select id="jrs-srv-asset" name="asset" '+(required?'required':'')+'><option value="">'+(required?'Selecione um equipamento':'A definir')+'</option>'+assets().map(x=>'<option value="'+e(x.id)+'" '+(x.id===ref?'selected':'')+'>'+e(x.label)+'</option>').join('')+'</select></div>';
}
function mediaSection(record,kind){
 return '<div class="span2 srv-media"><div class="srv-media-head"><div><b>Fotos '+(kind==='inspection'?'da vistoria':'da manutenção')+'</b><small>Adicione até 12 imagens (JPG, PNG, WebP). Fotos antes e depois podem ser incluídas.</small></div><label class="btn srv-file-label">＋ Selecionar fotos<input id="srv-files" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label></div><p>As fotos ficam guardadas neste navegador. Nos registros novos, são anexadas quando você salva.</p><div class="srv-photo-grid" id="srv-photo-grid">'+(record?'Carregando imagens...':'Nenhuma foto salva ainda.')+'</div><div id="srv-media-info" role="status"></div></div>';
}
async function renderPhotos(key){
 const grid=document.getElementById('srv-photo-grid');if(!grid)return;
 try{
  const photos=await window.JRSWorkPhotos.items(key);
  if(!grid.isConnected)return;
  grid.innerHTML='';
  if(!photos.length){grid.innerHTML='<div class="srv-empty-photo">Nenhuma foto neste registro.</div>';return}
  photos.forEach(item=>{
   const cell=document.createElement('div');cell.className='srv-photo-tile';
   const image=document.createElement('img');image.src=item.url;image.alt='Foto do serviço';image.loading='lazy';cell.appendChild(image);
   const button=document.createElement('button');button.type='button';button.className='btn tiny';button.textContent='Remover';button.onclick=async()=>{
    if(!confirm('Excluir esta foto?'))return;
    try{await window.JRSWorkPhotos.remove(key,item.id);await renderPhotos(key)}
    catch(ex){alert(ex.message||'Falha ao excluir a foto.')}
   };cell.appendChild(button);grid.appendChild(cell);
  });
 }catch(ex){grid.textContent=ex.message||'Não foi possível abrir fotos.'}
}
function hookupMedia(key){
 if(!key)return;
 renderPhotos(key);
 const input=document.getElementById('srv-files');
 input.addEventListener('change',async()=>{
  const files=Array.from(input.files||[]);input.value='';
  if(!files.length)return;
  input.disabled=true;const message=document.getElementById('srv-media-info');
  if(message)message.textContent='Salvando fotos...';
  try{
   const total=await window.JRSWorkPhotos.upload(key,files);
   await renderPhotos(key);if(message)message.textContent=total+' foto(s) anexada(s).';
  }catch(ex){if(message)message.textContent=ex.message||'Falha ao anexar.'}
  finally{input.disabled=false}
 });
}
const badge=v=>'<span class="srv-tag '+(/Concluíd/.test(v)?'ok':/Cancel/.test(v)?'off':/peças|adequações/i.test(v)?'warn':'active')+'">'+e(v)+'</span>';
const mainHeader=(title,description,action,button)=>'<div class="srv-top"><div><span class="eyebrow">JRS GUINDASTES · GESTÃO OPERACIONAL</span><h1>'+title+'</h1><p>'+description+'</p></div>'+(action?'<button class="btn primary" onclick="'+action+'">＋ '+button+'</button>':'')+'</div>';
const stats=arr=>'<div class="srv-metrics"><div class="card"><small>Registros</small><strong>'+arr.length+'</strong></div><div class="card"><small>Em andamento</small><strong>'+arr.filter(x=>!['Concluída','Cancelada'].includes(x.status)).length+'</strong></div><div class="card"><small>Concluídos</small><strong>'+arr.filter(x=>x.status==='Concluída').length+'</strong></div></div>';
function inspectionRows(){
 const term=inspectQuery.toLowerCase();
 const found=inspections().filter(x=>!term||[x.id,x.client,x.site,x.assetLabel,x.service].join(' ').toLowerCase().includes(term)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 return table(['Nº vistoria','Cliente / local','Equipamento','Data','Situação','Ações'],found.map(x=>
  '<tr><td><b>'+e(x.id)+'</b></td><td><b>'+e(x.client)+'</b><small class="srv-table-sub">'+e(x.site)+'</small></td><td>'+e(assetRef(x.asset)||x.assetLabel||'A definir')+'</td><td>'+date(x.date)+'</td><td>'+badge(x.status)+'</td><td><div class="actions srv-row-buttons"><button class="btn tiny" onclick="JRSWork.detailInspection(\''+e(x.id)+'\')">Ver</button>'+(canEdit('inspections')?'<button class="btn tiny" onclick="JRSWork.inspectionForm(\''+e(x.id)+'\')">Editar / fotos</button>':'')+'<button class="btn tiny srv-pdf" onclick="JRSWork.printOS(\''+e(x.id)+'\')">Gerar OS / PDF</button></div></td></tr>'));
}
function maintenanceRows(){
 const term=maintenanceQuery.toLowerCase();
 const found=maintenances().filter(x=>!term||[x.id,x.mechanic,x.description,x.type,x.assetLabel].join(' ').toLowerCase().includes(term)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 return table(['Registro','Equipamento','Manutenção','Mecânico','Data','Situação','Ações'],found.map(x=>
  '<tr><td><b>'+e(x.id)+'</b></td><td>'+e(assetRef(x.asset)||x.assetLabel)+'</td><td><b>'+e(x.type)+'</b><small class="srv-table-sub">'+e(x.description)+'</small></td><td>'+e(x.mechanic)+'</td><td>'+date(x.date)+'</td><td>'+badge(x.status)+'</td><td><div class="actions srv-row-buttons"><button class="btn tiny" onclick="JRSWork.detailMaintenance(\''+e(x.id)+'\')">Ver</button>'+(canEdit('maintenance')?'<button class="btn tiny" onclick="JRSWork.maintenanceForm(\''+e(x.id)+'\')">Editar / fotos</button>':'')+'</div></td></tr>'));
}
function viewInspections(){
 if(!canView('inspections'))return '<div class="card">Acesso não autorizado.</div>';
 const rows=inspections();
 return mainHeader('Vistorias e ordens de serviço','Fotos, condições da obra, materiais necessários e OS para impressão/PDF.',canEdit('inspections')?"JRSWork.inspectionForm()":null,'Nova vistoria')
 +stats(rows)+'<p class="srv-help">A Ordem de Serviço reúne os dados da vistoria, equipe necessária, materiais e fotografias. Os dados são armazenados neste navegador.</p>'
 +'<div class="srv-search"><input class="search" placeholder="Buscar vistoria, cliente, OS ou obra..." value="'+e(inspectQuery)+'" oninput="JRSWork.filterInspect(this.value)"></div><div id="srv-inspection-list">'+inspectionRows()+'</div>';
}
function viewMaintenance(){
 if(!canView('maintenance'))return '<div class="card">Acesso não autorizado.</div>';
 const rows=maintenances();
 return mainHeader('Manutenções de equipamentos','Mecânicos, reparos, peças, custos, situação e fotografias de cada manutenção.',canEdit('maintenance')?"JRSWork.maintenanceForm()":null,'Registrar manutenção')
 +stats(rows)+'<p class="srv-help">Equipamentos em manutenção ficam indisponíveis para locação. Após a conclusão, a liberação permanece manual para maior segurança.</p>'
 +'<div class="srv-search"><input class="search" placeholder="Buscar manutenção, mecânico, peças ou equipamento..." value="'+e(maintenanceQuery)+'" oninput="JRSWork.filterMaintain(this.value)"></div><div id="srv-maintenance-list">'+maintenanceRows()+'</div>';
}
function inspectionForm(id){
 if(!requireEdit('inspections'))return;
 const obj=id?inspections().find(x=>x.id===id):null;
 if(id&&!obj)return alert('Vistoria não localizada.');
 const x=obj||{},staff=(db.staff||[]).filter(x=>x.status==='Ativo').map(x=>x.name),clients=(db.clients||[]).map(x=>x.name);
 const form='<form id="srv-form" class="form-grid">'+
 field('date','Data da vistoria',x.date||today(),{type:'date',required:true})+
 field('status','Situação',x.status||'Agendada',{options:IST})+
 suggestions('client','Cliente / empresa',x.client||'',clients,{required:true})+
 suggestions('inspector','Responsável pela vistoria',x.inspector||'',staff,{required:true})+
 selector(x.asset||'',false)+
 field('site','Local da obra / vistoria',x.site||'',{required:true,full:true})+
 field('serviceDate','Data prevista do serviço',x.serviceDate||'',{type:'date'})+
 field('serviceTime','Horário previsto',x.serviceTime||'',{type:'time'})+
 field('service','Serviço a ser executado',x.service||'',{multi:true,required:true,full:true,max:900})+
 field('load','Carga, peso, dimensões e raio de operação',x.load||'',{multi:true,full:true})+
 field('access','Condições de acesso e apoio',x.access||'',{multi:true,full:true})+
 field('equipmentNeeded','Equipamentos e acessórios necessários',x.equipmentNeeded||'',{multi:true,required:true,full:true})+
 field('crewNeeded','Equipe necessária',x.crewNeeded||'',{multi:true,full:true})+
 field('itemsToBring','O que precisa levar',x.itemsToBring||'',{multi:true,full:true,placeholder:'Ex.: PEGA PALLET, cintas, manilhas'})+
 field('safety','Riscos e medidas de segurança',x.safety||'',{multi:true,full:true})+
 field('notes','Observações e orientações técnicas',x.notes||'',{multi:true,full:true})+
 mediaSection(obj,'inspection')+'<div id="srv-error" role="alert" class="span2"></div><div class="span2 actions"><button type="submit" class="btn primary" id="srv-submit">Salvar vistoria</button>'+
 (obj?'<button class="btn srv-pdf" type="button" onclick="JRSWork.printOS(\''+e(obj.id)+'\')">Gerar OS / PDF</button>':'')+
 '<button class="btn" type="button" onclick="closeDialog()">Cancelar</button></div></form>';
 openDialog(obj?'Editar vistoria '+obj.id:'Nova vistoria',form);
 if(obj)hookupMedia('inspection:'+obj.id);
 document.getElementById('srv-form').addEventListener('submit',ev=>submitInspection(ev,obj));
}
async function submitInspection(ev,obj){
 ev.preventDefault();
 const button=document.getElementById('srv-submit');button.disabled=true;
 try{
  const data=Object.fromEntries(new FormData(ev.target));
  for(const key of Object.keys(data))if(typeof data[key]==='string')data[key]=data[key].trim();
  if(!data.client||!data.inspector||!data.site||!data.service||!data.equipmentNeeded||!data.date)throw Error('Preencha cliente, responsável, local, serviço e equipamentos necessários.');
  if(!IST.includes(data.status))throw Error('Situação inválida.');
  if(data.asset&&!assetRecord(data.asset))throw Error('Selecione um equipamento cadastrado.');
  data.assetLabel=data.asset?assetRef(data.asset):'A definir';
  const photos=Array.from(document.getElementById('srv-files')?.files||[]);
  const record=obj||{id:uid('VIS'),createdAt:new Date().toISOString()};
  Object.assign(record,data,{updatedAt:new Date().toISOString()});
  if(!obj)inspections().push(record);
  save();
  if(photos.length)try{await window.JRSWorkPhotos.upload('inspection:'+record.id,photos)}catch(err){alert('Vistoria salva, mas algumas fotos não foram anexadas: '+err.message)}
  closeDialog();render();if(!obj)inspectionForm(record.id);
 }catch(ex){document.getElementById('srv-error').textContent=ex.message||'Erro ao salvar.'}
 finally{button.disabled=false}
}
function syncAsset(ref,wasActive=false){
 const a=assetRecord(ref);if(!a)return;
 const working=maintenances().some(x=>x.asset===ref&&['Em execução','Aguardando peças'].includes(x.status));
 if(ref.startsWith('E:')){
  if(working)a.status='Manutenção';
  else if(wasActive&&a.status==='Manutenção')a.status='Indisponível';
  const linked=(db.vehicles||[]).find(v=>v.id===a.vehicleId);
  if(linked&&working)linked.fleetStatus='Em manutenção';
  else if(linked&&wasActive&&linked.fleetStatus==='Em manutenção')linked.fleetStatus='Não verificado';
 }else if(ref.startsWith('V:')){
  if(working)a.fleetStatus='Em manutenção';
  else if(wasActive&&a.fleetStatus==='Em manutenção')a.fleetStatus='Não verificado';
 }
}
function maintenanceForm(id){
 if(!requireEdit('maintenance'))return;
 const obj=id?maintenances().find(x=>x.id===id):null;
 if(id&&!obj)return alert('Manutenção não localizada.');
 const x=obj||{},staff=(db.staff||[]).filter(x=>x.status==='Ativo'&&/mecânic/i.test(x.role||'')).map(x=>x.name);
 const form='<form id="srv-form" class="form-grid">'+
 selector(x.asset||'',true)+
 field('date','Data da manutenção',x.date||today(),{type:'date',required:true})+
 field('type','Tipo de manutenção',x.type||'Corretiva',{options:TYPES})+
 suggestions('mechanic','Mecânico / responsável',x.mechanic||'',staff,{required:true})+
 field('status','Situação',x.status||'Agendada',{options:MST})+
 field('description','Motivo / falha identificada',x.description||'',{multi:true,full:true,required:true})+
 field('diagnosis','Diagnóstico técnico',x.diagnosis||'',{multi:true,full:true})+
 field('workDone','Serviços realizados',x.workDone||'',{multi:true,full:true,max:1200,rows:4})+
 field('parts','Peças e materiais usados',x.parts||'',{multi:true,full:true})+
 field('hourMeter','Horímetro / quilometragem',x.hourMeter||'')+
 field('cost','Custo informado (R$)',x.cost??'',{type:'number'})+
 field('completedDate','Data de conclusão',x.completedDate||'',{type:'date'})+
 field('nextDue','Próxima manutenção',x.nextDue||'',{type:'date'})+
 field('notes','Observações / testes realizados',x.notes||'',{multi:true,full:true})+
 mediaSection(obj,'maintenance')+'<div id="srv-error" role="alert" class="span2"></div><div class="span2 actions"><button type="submit" class="btn primary" id="srv-submit">Salvar manutenção</button><button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div></form>';
 openDialog(obj?'Editar manutenção '+obj.id:'Registrar manutenção',form);
 if(obj)hookupMedia('maintenance:'+obj.id);
 document.getElementById('srv-form').addEventListener('submit',ev=>submitMaintenance(ev,obj));
}
async function submitMaintenance(ev,obj){
 ev.preventDefault();const button=document.getElementById('srv-submit');button.disabled=true;
 try{
  const data=Object.fromEntries(new FormData(ev.target));
  for(const key of Object.keys(data))if(typeof data[key]==='string')data[key]=data[key].trim();
  if(!data.asset||!assetRecord(data.asset)||!data.mechanic||!data.description||!data.date)throw Error('Informe equipamento, mecânico, motivo e data.');
  if(!MST.includes(data.status)||!TYPES.includes(data.type))throw Error('Tipo ou situação inválida.');
  const cost=data.cost===''?0:Number(data.cost);
  if(!Number.isFinite(cost)||cost<0||cost>1e10)throw Error('Informe um custo válido.');
  data.cost=cost;data.assetLabel=assetRef(data.asset);
  const previous=obj?.asset||'',activeStates=['Em execução','Aguardando peças'];
  const previousWasActive=!!obj&&activeStates.includes(obj.status),files=Array.from(document.getElementById('srv-files')?.files||[]);
  const record=obj||{id:uid('MAN'),createdAt:new Date().toISOString()};
  Object.assign(record,data,{updatedAt:new Date().toISOString()});
  if(!obj)maintenances().push(record);
  if(previous&&previous!==data.asset)syncAsset(previous,previousWasActive);
  syncAsset(data.asset,previous===data.asset&&previousWasActive);save();
  if(files.length)try{await window.JRSWorkPhotos.upload('maintenance:'+record.id,files)}catch(err){alert('Manutenção salva, mas algumas fotos não foram anexadas: '+err.message)}
  closeDialog();render();if(!obj)maintenanceForm(record.id);
 }catch(ex){document.getElementById('srv-error').textContent=ex.message||'Erro ao salvar.'}
 finally{button.disabled=false}
}
function detailFields(arr){
 return '<div class="srv-detail-grid">'+arr.map(([name,value])=>'<div><small>'+e(name)+'</small><b>'+e(value||'—')+'</b></div>').join('')+'</div>';
}
async function detailPhotos(key){
 const grid=document.getElementById('srv-detail-photos');if(!grid)return;
 try{
  const photos=await window.JRSWorkPhotos.items(key);if(!grid.isConnected)return;
  grid.innerHTML='';
  if(!photos.length)grid.innerHTML='<span class="muted">Sem fotos anexadas.</span>';
  else photos.forEach(photo=>{const img=document.createElement('img');img.src=photo.url;img.alt='Registro fotográfico';grid.appendChild(img)});
 }catch(err){grid.textContent=err.message||'Fotos indisponíveis.'}
}
function detailInspection(id){
 if(!canView('inspections'))return;
 const x=inspections().find(v=>v.id===id);if(!x)return;
 openDialog('Vistoria · '+x.id,
 detailFields([['Cliente',x.client],['Data',date(x.date)],['Responsável',x.inspector],['Local',x.site],['Equipamento',assetRef(x.asset)||x.assetLabel],['Serviço',x.service],['Carga / medidas',x.load],['Acesso',x.access],['Equipamentos e acessórios',x.equipmentNeeded],['Equipe necessária',x.crewNeeded],['O que precisa levar',x.itemsToBring],['Riscos e segurança',x.safety],['Observações técnicas',x.notes],['Status',x.status]])+
 '<div class="srv-detail-media"><b>Fotos da vistoria</b><div id="srv-detail-photos"></div></div>'+
 '<div class="actions">'+(canEdit('inspections')?'<button class="btn" onclick="JRSWork.inspectionForm(\''+e(x.id)+'\')">Editar / fotos</button>':'')+
 '<button class="btn primary" onclick="JRSWork.printOS(\''+e(x.id)+'\')">Gerar OS / PDF</button></div>');
 detailPhotos('inspection:'+id);
}
function detailMaintenance(id){
 if(!canView('maintenance'))return;
 const x=maintenances().find(v=>v.id===id);if(!x)return;
 openDialog('Manutenção · '+x.id,
 detailFields([['Equipamento',assetRef(x.asset)||x.assetLabel],['Data',date(x.date)],['Tipo',x.type],['Mecânico',x.mechanic],['Situação',x.status],['Motivo',x.description],['Diagnóstico',x.diagnosis],['Serviços feitos',x.workDone],['Peças e insumos',x.parts],['Horímetro / km',x.hourMeter],['Custo',money(x.cost)],['Conclusão',date(x.completedDate)],['Próxima manutenção',date(x.nextDue)],['Observações',x.notes]])+
 '<div class="srv-detail-media"><b>Fotos da manutenção</b><div id="srv-detail-photos"></div></div>'+
 (canEdit('maintenance')?'<div class="actions"><button class="btn primary" onclick="JRSWork.maintenanceForm(\''+e(x.id)+'\')">Editar / fotos</button></div>':''));
 detailPhotos('maintenance:'+id);
}
function printPart(label,value){
 return '<section class="jrs-os-part"><h3>'+e(label)+'</h3><div>'+e(value||'Não informado').replace(/\n/g,'<br>')+'</div></section>';
}
async function printOS(id){
 if(!canView('inspections'))return;
 const x=inspections().find(r=>r.id===id);if(!x)return alert('Vistoria não encontrada.');
 const tab=window.open('','_blank');
 if(!tab)return alert('Libere janelas pop-up para gerar a Ordem de Serviço.');
 tab.document.write('<!doctype html><title>Preparando OS</title><p>Preparando documento com fotos...</p>');tab.document.close();
 let photos=[],warning='';
 try{photos=await window.JRSWorkPhotos.printable('inspection:'+id)}catch(err){warning='Fotos não disponíveis: '+(err.message||'erro ao abrir armazenamento')}
 const meta=[['Cliente',x.client],['Local / obra',x.site],['Data da vistoria',date(x.date)],['Responsável',x.inspector],['Equipamento previsto',assetRef(x.asset)||x.assetLabel||'A definir'],['Serviço previsto',date(x.serviceDate)+(x.serviceTime?' · '+x.serviceTime:'')],['Status',x.status]];
 const fields=[['01 · SERVIÇO A EXECUTAR',x.service],['02 · CARGA / DIMENSÕES / PESO / RAIO',x.load],['03 · CONDIÇÕES DE ACESSO',x.access],['04 · EQUIPAMENTOS E ACESSÓRIOS NECESSÁRIOS',x.equipmentNeeded],['05 · EQUIPE NECESSÁRIA',x.crewNeeded],['06 · O QUE PRECISA LEVAR',x.itemsToBring],['07 · RISCOS E SEGURANÇA',x.safety],['08 · RECOMENDAÇÕES / OBSERVAÇÕES',x.notes]];
 const css='@import url(https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap);*{box-sizing:border-box}body{font-family:Manrope,Arial,sans-serif;color:#213024;background:#f3f5f1;margin:0;font-size:11px;line-height:1.5}.printbar{position:sticky;top:0;background:#17251b;color:white;padding:13px 20px;display:flex;justify-content:space-between;gap:12px;align-items:center}.printbar button{border:0;background:#f4c822;font:800 12px Manrope;padding:11px 17px;border-radius:6px;cursor:pointer}.sheet{max-width:820px;background:#fff;margin:18px auto;padding:33px 39px;box-shadow:0 7px 24px #1232}.oshead{display:flex;justify-content:space-between;gap:15px;border-bottom:4px solid #efc520;padding-bottom:20px}.oshead h1{font-size:24px;letter-spacing:-1px;margin:0}.os-logo{display:block;width:215px;max-width:100%;height:auto;object-fit:contain;margin-bottom:8px}.oshead strong{color:#c69d00}.oshead small{color:#7c8a7e;font-size:9px;letter-spacing:1px}.number{text-align:right}.number b{display:block;font-size:14px;margin-top:6px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0}.meta>div{border:1px solid #e2e8df;padding:10px;border-radius:5px}.meta small{display:block;color:#758575;font-size:9px}.meta b{display:block;margin-top:4px;overflow-wrap:anywhere}.jrs-os-part{margin:13px 0;page-break-inside:avoid}.jrs-os-part h3{margin:0;border-left:4px solid #e8bc1b;background:#ecf0e9;padding:8px;font-size:10px}.jrs-os-part>div{border:1px solid #e1e8df;border-top:0;padding:9px;overflow-wrap:anywhere}.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.photo{border:1px solid #dce5db;padding:6px;break-inside:avoid}.photo img{width:100%;height:185px;object-fit:contain;background:#f8faf7}.photo small{display:block;padding:4px 0;font-size:9px}.signature{margin-top:55px;display:grid;grid-template-columns:1fr 1fr;gap:30px}.signature div{border-top:1px solid #364439;text-align:center;padding-top:7px}.footer{font-size:9px;color:#899589;border-top:1px solid #e0e6df;margin-top:38px;padding-top:12px}.warning{color:#ae332c;background:#fff2f1;padding:10px}@media print{body{background:#fff}.printbar{display:none}.sheet{max-width:none;box-shadow:none;margin:0;padding:0}@page{size:A4;margin:13mm}}@media(max-width:650px){.sheet{padding:20px}.meta,.photos{grid-template-columns:1fr}.oshead{flex-direction:column}.number{text-align:left}}';
 const logo=typeof window.JRS_LOGO_NORMAL_PNG==='string'&&window.JRS_LOGO_NORMAL_PNG.startsWith('data:image/png;base64,')?'<img class="os-logo" src="'+window.JRS_LOGO_NORMAL_PNG+'" alt="Logo JRS Guindastes">':'<h1>JRS <strong>GUINDASTES</strong></h1>';
 const content='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OS '+e(x.id)+' | JRS GUINDASTES</title><style>'+css+'</style></head><body>'+
 '<div class="printbar"><b>JRS GUINDASTES · ORDEM DE SERVIÇO</b><button onclick="window.print()">Imprimir / Salvar PDF</button></div>'+
 '<article class="sheet"><div class="oshead"><div>'+logo+'<small>FORÇA E COMPROMISSO EM CADA OPERAÇÃO</small></div><div class="number"><small>ORDEM DE SERVIÇO · VISTORIA TÉCNICA</small><b>'+e(x.id)+'</b><span>'+date(x.date)+'</span></div></div>'+
 '<div class="meta">'+meta.map(([k,v])=>'<div><small>'+e(k)+'</small><b>'+e(v||'—')+'</b></div>').join('')+'</div>'+
 fields.map(([k,v])=>printPart(k,v)).join('')+
 (warning?'<div class="warning">'+e(warning)+'</div>':'')+
 '<section class="jrs-os-part"><h3>09 · EVIDÊNCIAS FOTOGRÁFICAS</h3><div class="photos">'+(photos.length?photos.map((p,i)=>'<div class="photo"><img src="'+p.src+'" alt="Foto '+(i+1)+' da vistoria"><small>Foto '+(i+1)+' · '+e(p.fileName||'Vistoria')+'</small></div>').join(''):'<p>Nenhuma foto anexada.</p>')+'</div></section>'+
 '<div class="signature"><div>Responsável pela vistoria</div><div>Responsável pelo serviço / cliente</div></div>'+
 '<p class="footer">JRS GUINDASTES · Informações originadas da vistoria '+e(x.id)+'. Verifique planejamento técnico, documentos e autorizações antes da operação.</p></article></body></html>';
 tab.document.open();tab.document.write(content);tab.document.close();tab.focus();
}
window.JRSWork={inspections:viewInspections,maintenance:viewMaintenance,inspectionForm,maintenanceForm,detailInspection,detailMaintenance,printOS,
 filterInspect(v){inspectQuery=v;const dom=document.getElementById('srv-inspection-list');if(dom)dom.innerHTML=inspectionRows()},
 filterMaintain(v){maintenanceQuery=v;const dom=document.getElementById('srv-maintenance-list');if(dom)dom.innerHTML=maintenanceRows()},
 __test:{inspections,maintenances,assets,assetRecord,syncAsset}};
})();