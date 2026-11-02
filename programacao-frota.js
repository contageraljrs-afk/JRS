/* JRS Guindastes — programação semanal da frota | jrs-fleet-weekly-board-v1
   Reprodução digital da lousa operacional: dias por coluna, equipamentos por linha.
   Preserva todos os cadastros. Os registros são locais enquanto não houver backend.
*/
(function(){
'use strict';
const DEFAULT_ROWS=[
 ['G1','Guindastes'],['G2','Guindastes'],['G3','Guindastes'],['G4','Guindastes'],
 ['M1','Muncks'],['M2','Muncks'],['M3','Muncks'],['M4','Muncks'],['M5','Muncks'],['M6','Muncks'],
 ['CM','Carreta / cavalo'],['EMP 01','Empilhadeiras'],['EMP 02','Empilhadeiras']
];
const STATUSES=['Programado','Em operação','Concluído','Manutenção','Indisponível','Folga','Feriado'];
const GROUPS=['Guindastes','Muncks','Carreta / cavalo','Empilhadeiras','Plataformas','Veículos','Outros'];
const GROUP_ICONS={'Guindastes':'🏗','Muncks':'🚛','Carreta / cavalo':'🚚','Empilhadeiras':'📦','Plataformas':'⚙','Veículos':'🚙','Outros':'◈'};
const DAY_NAMES=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
let referenceWeek=monday(new Date());
let showWeekend=false;
function monday(date){
 const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 d.setDate(d.getDate()-((d.getDay()+6)%7));
 return d;
}
function localISO(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')}
function weekDates(){
 return Array.from({length:showWeekend?7:5},(_,i)=>{
  const d=new Date(referenceWeek.getFullYear(),referenceWeek.getMonth(),referenceWeek.getDate()+i);
  return {day:DAY_NAMES[i],date:localISO(d),human:String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'),dateObject:d};
 });
}
function ensureData(){
 let changed=false;
 if(!Array.isArray(db.fleetBoardRows)){
  db.fleetBoardRows=DEFAULT_ROWS.map(([label,group])=>({id:'board-'+label.replace(/\s/g,'-'),label,group,equipmentId:'',vehicleId:'',active:true}));
  changed=true;
 }
 if(!Array.isArray(db.fleetBoardEntries)){db.fleetBoardEntries=[];changed=true;}
 if(changed)save();
}
function rows(){ensureData();return db.fleetBoardRows.filter(r=>r.active!==false);}
function entries(){ensureData();return db.fleetBoardEntries;}
function rowById(id){return db.fleetBoardRows.find(r=>r.id===id)}
function linkedVehicle(row){return row.vehicleId?db.vehicles.find(v=>v.id===row.vehicleId):null;}
function linkedEquipment(row){
 if(row.equipmentId)return db.equipment.find(e=>e.id===row.equipmentId);
 const vehicle=linkedVehicle(row);
 return vehicle?db.equipment.find(e=>e.vehicleId===vehicle.id||e.vehiclePlate===vehicle.plate):null;
}
function linkedNames(row){
 const e=linkedEquipment(row);return e?[e.name]:[];
}
function dailySchedule(row,date){
 const manual=entries().filter(e=>e.rowId===row.id&&e.date===date).map(e=>({...e,type:'manual'}));
 const names=linkedNames(row);
 if(!names.length)return manual;
 const booking=(db.bookings||[]).filter(b=>names.includes(b.equipment)&&b.start<=date&&b.end>=date&&b.status!=='Cancelada').map(b=>({
  id:'booking-'+b.id,kind:'Reserva',type:'booking',date,rowId:row.id,client:b.client,description:'Locação confirmada',status:b.status||'Reservado',startTime:'',endTime:'',location:''
 }));
 const op=(db.operations||[]).filter(o=>names.includes(o.equipment)&&o.date===date&&o.status!=='Cancelada').map(o=>({
  id:'operation-'+o.id,kind:'Operação',type:'operation',date,rowId:row.id,client:o.client,description:o.notes||'Operação agendada',status:o.status||'Agendada',location:o.location||'',driver:o.operator||'',startTime:o.time||''
 }));
 return manual.concat(booking,op).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
}
function safeStatusClass(status){
 if(status==='Manutenção')return 'maintenance';
 if(status==='Indisponível'||status==='Folga'||status==='Feriado')return 'unavailable';
 if(status==='Concluído')return 'completed';
 if(status==='Em operação'||status==='Em andamento')return 'running';
 return 'booked';
}
function cellCard(record,editable){
 const title=record.client||record.location||record.description||record.status||'Programação';
 const detail=[record.location,record.description].filter(Boolean).filter((x,i,arr)=>x!==title&&arr.indexOf(x)===i).join(' · ');
 const prefix=record.startTime||'';
 const text='<span class="fboard-item-title">'+esc(title)+'</span>'+
  (detail?'<span class="fboard-item-detail">'+esc(detail)+'</span>':'')+
  (record.driver?'<span class="fboard-item-driver">◉ Motorista: '+esc(record.driver)+'</span>':'')+
  (record.helper?'<span class="fboard-item-helper">◉ Ajudante: '+esc(record.helper)+'</span>':'')+
  (record.bringItems?'<span class="fboard-item-bring"><span class="fboard-bring-icon" aria-hidden="true">⚠</span><span><strong>O que precisa levar:</strong> '+esc(record.bringItems)+'</span></span>':'')+
  (prefix?'<span class="fboard-item-time">'+esc(prefix)+(record.endTime?'–'+esc(record.endTime):'')+'</span>':'');
 if(record.type==='manual'){
  return editable?'<button type="button" class="fboard-item '+safeStatusClass(record.status)+'" title="'+esc(record.status)+' · Editar" onclick="JRSBoard.edit(\''+esc(record.rowId)+'\',\''+esc(record.date)+'\',\''+esc(record.id)+'\')">'+text+'</button>':
   '<div class="fboard-item '+safeStatusClass(record.status)+'" title="'+esc(record.status)+'">'+text+'</div>';
 }
 const mod=record.type==='booking'?'bookings':'operations';
 return '<button type="button" class="fboard-item '+safeStatusClass(record.status)+' fboard-linked" title="Registro existente em '+(mod==='bookings'?'Reservas':'Operações')+'" onclick="go(\''+mod+'\')"><span class="fboard-linked-tag">'+(mod==='bookings'?'RESERVA':'OPERAÇÃO')+'</span>'+text+'</button>';
}
function equipmentHint(row){
 const vehicle=linkedVehicle(row),eq=linkedEquipment(row);
 const label=eq?.name||vehicle?.makeModel||'Vincular equipamento';
 const plate=vehicle?.plate||eq?.vehiclePlate||'';
 return '<span class="fboard-row-hint" title="'+esc(label+(plate?' · '+plate:''))+'">'+esc(label)+(plate?'<span class="fboard-row-plate">'+esc(plate)+'</span>':'')+'</span>';
}
function render(isHome){
 if(!canView('operations'))return '<div class="card empty">Acesso à programação não autorizado.</div>';
 ensureData();
 const dates=weekDates(),first=dates[0],last=dates[dates.length-1],editable=canEdit('operations');
 const displayed=rows();
 const records=displayed.flatMap(r=>dates.flatMap(d=>dailySchedule(r,d.date)));
 const booked=records.filter(x=>x.status!=='Folga'&&x.status!=='Feriado'&&x.status!=='Indisponível').length;
 const today=localISO(new Date());
 const header='<div class="fboard-top"><div><span class="fboard-eyebrow">CENTRAL OPERACIONAL · PROGRAMAÇÃO</span><h2>'+ (isHome?'Programação da frota':'Lousa de programação semanal')+'</h2><p>Veja onde cada equipamento estará, para qual cliente e em qual horário.</p></div><div class="fboard-top-actions">'+
  (isHome?'<button type="button" class="btn fboard-manage" onclick="go(\'fleetboard\')">Abrir lousa completa ↗</button>':'')+
  (editable?'<button type="button" class="btn primary" onclick="JRSBoard.addEntry()">＋ Programar serviço</button>':'')+
  '</div></div>';
 const controls='<div class="fboard-controls"><div class="fboard-week-nav"><button type="button" class="btn tiny" onclick="JRSBoard.move(-1)" aria-label="Semana anterior">‹</button>'+
  '<button type="button" class="btn tiny" onclick="JRSBoard.today()">Esta semana</button>'+
  '<button type="button" class="btn tiny" onclick="JRSBoard.move(1)" aria-label="Próxima semana">›</button>'+
  '<strong>'+esc(first.human)+' a '+esc(last.human)+' · '+first.dateObject.getFullYear()+'</strong></div>'+
  '<div class="fboard-controls-right"><span class="fboard-counter">'+booked+' programação(ões)</span>'+
  '<label class="fboard-weekend-toggle"><input type="checkbox" '+(showWeekend?'checked':'')+' onchange="JRSBoard.weekend(this.checked)"> Sáb. e dom.</label>'+
  (!isHome&&editable?'<button type="button" class="btn tiny" onclick="JRSBoard.manage()">Gerenciar linhas</button>':'')+
  '<button type="button" class="btn tiny" onclick="window.print()">Imprimir</button></div></div>';
 const cols='<tr><th class="fboard-corner"><span>EQUIPAMENTOS</span><small>FROTA JRS</small></th>'+dates.map(d=>'<th class="fboard-date-head '+(d.date===today?'fboard-is-today':'')+'"><b>'+d.day+'</b><span>'+d.human+'</span></th>').join('')+'</tr>';
 let lastGroup='';
 const htmlRows=displayed.map(row=>{
  let groupHeader='';
  if(row.group!==lastGroup){
   lastGroup=row.group;
   groupHeader='<tr class="fboard-group-row"><th colspan="'+(dates.length+1)+'"><span>'+esc(GROUP_ICONS[row.group]||'◈')+' '+esc(row.group||'Outros')+'</span></th></tr>';
  }
  const cells=dates.map(d=>{
   const records=dailySchedule(row,d.date);
   const items=records.map(r=>cellCard(r,editable)).join('');
   return '<td class="fboard-day-cell '+(d.date===today?'fboard-is-today':'')+'"><div class="fboard-day-inner">'+items+
    (editable?'<button type="button" class="fboard-add" onclick="JRSBoard.edit(\''+esc(row.id)+'\',\''+d.date+'\')" aria-label="Adicionar programação para '+esc(row.label)+' no dia '+d.human+'">＋</button>':'')+
    '</div></td>';
  }).join('');
  return groupHeader+'<tr class="fboard-equipment-row"><th scope="row" class="fboard-equipment-label"><span class="fboard-row-code">'+esc(row.label)+'</span>'+equipmentHint(row)+
  (editable?'<button type="button" class="fboard-link-row" onclick="JRSBoard.editRow(\''+esc(row.id)+'\')" title="Editar ou vincular equipamento">✎</button>':'')+
  '</th>'+cells+'</tr>';
 }).join('');
 return '<section class="fboard-section '+(isHome?'fboard-home':'fboard-full')+'">'+header+controls+
 '<div class="fboard-scroll" role="region" aria-label="Lousa de programação da frota" tabindex="0"><table class="fboard-table"><thead>'+cols+'</thead><tbody>'+htmlRows+'</tbody></table></div>'+
 '<div class="fboard-footer"><div class="fboard-legend"><span><i class="fboard-swatch booked"></i> Programado</span><span><i class="fboard-swatch running"></i> Em operação</span><span><i class="fboard-swatch maintenance"></i> Manutenção</span><span><i class="fboard-swatch unavailable"></i> Folga / Feriado</span></div>'+
 '<small>Toque em um dia para programar. Reservas e operações aparecem nas linhas vinculadas aos seus equipamentos. Os dados permanecem neste navegador.</small></div></section>';
}
function move(offset){referenceWeek=new Date(referenceWeek.getFullYear(),referenceWeek.getMonth(),referenceWeek.getDate()+7*offset);renderPage()}
function today(){referenceWeek=monday(new Date());renderPage()}
function weekend(value){showWeekend=Boolean(value);renderPage()}
function renderPage(){if(typeof window.render==='function')window.render();}
function openEntry(rowId,date,id){
 if(!requireEdit('operations'))return;
 ensureData();
 const existing=id?entries().find(e=>e.id===id):null;
 if(id&&!existing)return alert('Programação não encontrada.');
 const row=rowById(existing?.rowId||rowId||rows()[0]?.id);
 if(!row)return alert('Cadastre ou ative um equipamento na lousa antes de programar.');
 const days=weekDates();
 const day=existing?.date||date||localISO(new Date());
 const defaults=existing||{};
 const vehicle=linkedVehicle(row);
 const equipment=linkedEquipment(row);
 const autofillDriver=vehicle?.driver||equipment?.driver||'';
 const field=(name,label,value,kind='text',extra='')=>'<div class="field"><label for="board-'+name+'">'+label+'</label><input id="board-'+name+'" name="'+name+'" type="'+kind+'" '+extra+' value="'+esc(value||'')+'"></div>';
 const opts=(name,label,values,current)=>'<div class="field"><label for="board-'+name+'">'+label+'</label><select id="board-'+name+'" name="'+name+'">'+values.map(s=>'<option value="'+esc(s)+'" '+(s===current?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></div>';
 const rowList=rows().map(r=>'<option value="'+esc(r.id)+'" '+(r.id===row.id?'selected':'')+'>'+esc(r.label+' · '+r.group)+'</option>').join('');
 const html='<div class="fboard-dialog-summary">Lousa operacional · Preenchimento manual. Alterações no quadro não criam automaticamente reservas.</div>'+
 '<form id="fleetScheduleForm" class="form-grid">'+
 '<div class="field"><label for="board-row">Equipamento / linha</label><select name="rowId" id="board-row" required>'+rowList+'</select></div>'+
 field('date','Data',day,'date','required')+
 opts('status','Situação',STATUSES,defaults.status||'Programado')+
 field('client','Cliente / empresa',defaults.client,'text','maxlength="110" placeholder="Ex.: PLT FIVE"')+
 field('location','Local / obra',defaults.location,'text','maxlength="150" placeholder="Cidade, endereço ou obra"')+
 field('description','Serviço / programação',defaults.description,'text','maxlength="180" placeholder="Içamento, transporte, remoção..."')+
 field('driver','Motorista / operador',defaults.driver??autofillDriver,'text','maxlength="100"')+
 field('helper','Ajudante',defaults.helper||'','text','maxlength="120" placeholder="Nome do ajudante (opcional)"')+
 '<div class="field span2 fboard-bring-form"><div class="fboard-bring-label"><label for="board-bringItems">O que precisa levar</label><span class="fboard-bring-warning">⚠ INFORMAÇÃO IMPORTANTE</span></div>'+
 '<textarea id="board-bringItems" name="bringItems" maxlength="350" rows="2" placeholder="Ex.: PEGA PALLET, LEVAR CINTAS OU MANILHAS">'+esc(defaults.bringItems||'')+'</textarea><small>Esta instrução aparecerá em vermelho na programação semanal.</small></div>'+
 field('startTime','Saída / início',defaults.startTime,'time')+
 field('endTime','Retorno / fim',defaults.endTime,'time')+
 '<div class="field span2"><label for="board-notes">Observações e instruções</label><textarea id="board-notes" name="notes" maxlength="800" placeholder="Informações que ficariam escritas na lousa...">'+esc(defaults.notes||'')+'</textarea></div>'+
 '<div class="span2" id="boardFormError" role="alert"></div>'+
 '<div class="span2 actions"><button type="submit" class="btn primary">'+(existing?'Salvar alterações':'Adicionar à programação')+'</button>'+
 (existing?'<button type="button" class="btn fboard-delete" onclick="JRSBoard.delete(\''+esc(existing.id)+'\')">Excluir programação</button>':'')+
 '<button class="btn" type="button" onclick="closeDialog()">Cancelar</button></div></form>';
 openDialog(existing?'Editar programação · '+row.label:'Nova programação · '+row.label,html);
 const el=document.getElementById('fleetScheduleForm');
 el.addEventListener('submit',e=>{
  e.preventDefault();
  const error=document.getElementById('boardFormError');
  try{
   const data=Object.fromEntries(new FormData(el));
   if(!rowById(data.rowId))throw Error('Selecione uma linha válida da frota.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||Number.isNaN(new Date(data.date+'T12:00:00').getTime()))throw Error('Data inválida.');
   if(!STATUSES.includes(data.status))throw Error('Situação inválida.');
   for(const key of ['client','location','description','driver','helper','bringItems','notes'])data[key]=String(data[key]||'').trim();
   if(!['Manutenção','Indisponível','Folga','Feriado'].includes(data.status)&&!data.client&&!data.location&&!data.description)throw Error('Informe o cliente, local ou serviço para programar.');
   if(data.startTime&&data.endTime&&data.endTime<data.startTime)throw Error('O horário final não pode ser anterior ao horário inicial.');
   if(existing)Object.assign(existing,data,{updatedAt:new Date().toISOString()});
   else entries().push({...data,id:uid('PROG'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
   save();closeDialog();renderPage();
  }catch(err){error.textContent=err.message||'Não foi possível salvar a programação.';}
 });
}
function deleteEntry(id){
 if(!requireEdit('operations'))return;
 const e=entries().find(x=>x.id===id);
 if(!e)return alert('Programação não encontrada.');
 if(!confirm('Excluir esta programação de '+e.date+'? Nenhuma reserva ou operação da agenda será removida.'))return;
 db.fleetBoardEntries=db.fleetBoardEntries.filter(x=>x.id!==id);
 save();closeDialog();renderPage();
}
function rowForm(rowId){
 if(!requireEdit('operations'))return;
 ensureData();
 const row=rowId?rowById(rowId):null;
 if(rowId&&!row)return alert('Linha da frota não encontrada.');
 const def=row||{label:'',group:'Outros',vehicleId:'',equipmentId:'',active:true};
 const vehicleOptions=[{id:'',text:'Nenhum veículo vinculado'}].concat((canView('vehicles')?db.vehicles:[]).map(v=>({id:v.id,text:v.plate+' · '+(v.makeModel||'Modelo não informado')})));
 const equipmentOptions=[{id:'',text:'Nenhum equipamento vinculado'}].concat(db.equipment.map(e=>({id:e.id,text:e.name+(e.serial?' · '+e.serial:'')})));
 const opts=(values,selected)=>values.map(v=>'<option value="'+esc(v.id)+'" '+(v.id===selected?'selected':'')+'>'+esc(v.text)+'</option>').join('');
 const html='<p class="fboard-dialog-summary">Vincule os códigos da lousa (G1, M1 etc.) aos cadastros reais da JRS. Isso permite que reservas e operações apareçam automaticamente no quadro.</p>'+
 '<form id="fleetBoardRowForm" class="form-grid">'+
 '<div class="field"><label for="fboard-code">Identificação na lousa *</label><input id="fboard-code" name="label" maxlength="24" required value="'+esc(def.label)+'" placeholder="Ex.: M7, G5, Carreta"></div>'+
 '<div class="field"><label for="fboard-category">Grupo *</label><select name="group" id="fboard-category">'+GROUPS.map(g=>'<option '+(g===def.group?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></div>'+
 '<div class="field span2"><label for="fboard-vehicle">Veículo vinculado</label><select id="fboard-vehicle" name="vehicleId">'+opts(vehicleOptions,def.vehicleId||'')+'</select></div>'+
 '<div class="field span2"><label for="fboard-eq">Equipamento do catálogo</label><select id="fboard-eq" name="equipmentId">'+opts(equipmentOptions,def.equipmentId||'')+'</select></div>'+
 '<div class="span2"><div class="fboard-dialog-summary">É possível manter uma linha sem vínculo e preenchê-la manualmente. Alterar o vínculo não apaga sua programação.</div></div>'+
 '<div class="span2 actions"><button type="submit" class="btn primary">'+(row?'Salvar linha':'Adicionar linha')+'</button>'+
 (row?'<button type="button" class="btn fboard-delete" onclick="JRSBoard.removeRow(\''+esc(row.id)+'\')">Remover linha</button>':'')+
 '<button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div><p class="span2" id="fboard-row-error" role="alert"></p></form>';
 openDialog(row?'Configurar · '+row.label:'Adicionar equipamento à lousa',html);
 document.getElementById('fleetBoardRowForm').addEventListener('submit',e=>{
  e.preventDefault();const error=document.getElementById('fboard-row-error');
  try{
   const data=Object.fromEntries(new FormData(e.target));
   data.label=String(data.label||'').trim().toUpperCase();
   if(!data.label||!GROUPS.includes(data.group))throw Error('Preencha a identificação e o grupo.');
   if(db.fleetBoardRows.some(r=>r.id!==rowId&&r.label.toUpperCase()===data.label))throw Error('Este código já está sendo usado em outra linha.');
   if(data.vehicleId&&!db.vehicles.some(v=>v.id===data.vehicleId))throw Error('Veículo não encontrado.');
   if(data.equipmentId&&!db.equipment.some(v=>v.id===data.equipmentId))throw Error('Equipamento não encontrado.');
   if(row)Object.assign(row,data);
   else db.fleetBoardRows.push({id:uid('LIN'),...data,active:true});
   save();closeDialog();renderPage();
  }catch(err){error.textContent=err.message||'Não foi possível configurar a linha.';}
 });
}
function removeRow(id){
 if(!requireEdit('operations'))return;
 const row=rowById(id);
 if(!row)return;
 if(entries().some(e=>e.rowId===id)){alert('Esta linha tem programações registradas. Exclua ou transfira os registros antes de remover a linha.');return;}
 if(!confirm('Remover a linha '+row.label+' da lousa? O cadastro do veículo/equipamento continuará no sistema.'))return;
 db.fleetBoardRows=db.fleetBoardRows.filter(r=>r.id!==id);
 save();closeDialog();renderPage();
}
function manage(){
 if(!requireEdit('operations'))return;ensureData();
 openDialog('Gerenciar linhas da lousa','<p class="fboard-dialog-summary">Essas são as identificações que aparecem na coluna esquerda. Associe cada linha a um equipamento da JRS e acrescente novas linhas quando necessário.</p>'+
 '<div class="fboard-manage-list">'+rows().map(r=>'<div class="fboard-manage-row"><div><b>'+esc(r.label)+'</b><small>'+esc(r.group)+'</small></div><button class="btn tiny" onclick="JRSBoard.editRow(\''+esc(r.id)+'\')">Editar / Vincular</button></div>').join('')+'</div>'+
 '<div class="actions" style="margin-top:15px"><button class="btn primary" onclick="JRSBoard.editRow()">＋ Adicionar linha</button><button class="btn" onclick="closeDialog()">Fechar</button></div>');
}
function addEntry(){openEntry(rows()[0]?.id,localISO(new Date()))}
window.JRSBoard={
 render,move,today,weekend,edit:openEntry,addEntry,delete:deleteEntry,editRow:rowForm,removeRow,manage,
 __debug:{weekDates,rows,entries,dailySchedule,monday}
};
})();
