/* JRS GUINDASTES · jrs-employees-and-availability-v1
 * Cadastro interno de colaboradores e disponibilidade ESTIMADA por dia.
 * Considera escalas da lousa, operações, reservas e situação cadastrada;
 * não afirma disponibilidade em tempo real. Dados permanecem neste navegador.
 */
(function(){
'use strict';
const ROLES=['Motorista','Ajudante','Motorista/Operador','Operador de guindaste','Operador de Munck','Operador de empilhadeira','Operador de plataforma','Mecânico','Técnico de segurança','Administrativo','Comercial','Outros'];
const STATUSES=['Ativo','Férias','Folga','Afastado','Inativo'];
let searchTerm='',roleFilter='Todos';
function staffList(){if(!Array.isArray(db.staff))db.staff=[];return db.staff;}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ')}
function group(role){
 if(role==='Ajudante')return 'helpers';
 if(role==='Motorista'||role==='Motorista/Operador')return 'drivers';
 return 'other';
}
function registeredDriverNames(){return staffList().filter(s=>group(s.role)==='drivers'&&s.status==='Ativo').map(s=>s.name)}
function registeredHelperNames(){return staffList().filter(s=>group(s.role)==='helpers'&&s.status==='Ativo').map(s=>s.name)}
function roleIcon(role){return group(role)==='drivers'?'🚛':group(role)==='helpers'?'⛑':'👤'}
function personStatus(st){
 const cls=st==='Ativo'?'positive':st==='Férias'||st==='Folga'?'away':'negative';
 return '<span class="jrs-employee-state '+cls+'">'+esc(st||'Não informado')+'</span>';
}
function render(){
 if(!canView('staff'))return '<div class="card">Você não tem permissão para acessar os funcionários.</div>';
 const list=staffList(),filtered=list.filter(s=>(roleFilter==='Todos'||roleFilter===s.role)&&(!searchTerm||[s.name,s.role,s.phone,s.notes].join(' ').toLocaleLowerCase('pt-BR').includes(searchTerm.toLocaleLowerCase('pt-BR')))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const active=list.filter(s=>s.status==='Ativo').length;
 const nDrivers=list.filter(s=>s.status==='Ativo'&&group(s.role)==='drivers').length;
 const nHelpers=list.filter(s=>s.status==='Ativo'&&group(s.role)==='helpers').length;
 return '<div class="jrs-employee-title"><div><span class="eyebrow">JRS GUINDASTES · GESTÃO DE EQUIPE</span><h1>Funcionários da empresa</h1><p class="subtitle">Cadastre motoristas, ajudantes, operadores e colaboradores. A disponibilidade aparece na programação semanal.</p></div>'
 +(canEdit('staff')?'<button class="btn primary" type="button" onclick="JRSStaff.open()">＋ Novo funcionário</button>':'')+'</div>'
 +'<div class="jrs-employee-metrics"><div class="card"><small>Funcionários cadastrados</small><b>'+list.length+'</b></div><div class="card"><small>Em atividade</small><b>'+active+'</b></div><div class="card"><small>Motoristas ativos</small><b>'+nDrivers+'</b></div><div class="card"><small>Ajudantes ativos</small><b>'+nHelpers+'</b></div></div>'
 +'<div class="jrs-employee-note">Disponibilidade é calculada com base nas escalas registradas e no status cadastrado, não por GPS ou ponto em tempo real. Cadastre os funcionários para preencher o painel acima da lousa.</div>'
 +'<div class="card jrs-employee-panel"><div class="jrs-employee-panel-head"><h3>Cadastro da equipe</h3><span>'+filtered.length+' resultado(s)</span></div>'
 +'<div class="jrs-employee-filters"><input class="search" aria-label="Buscar funcionário" placeholder="Buscar por nome, função ou telefone..." value="'+esc(searchTerm)+'" oninput="JRSStaff.search(this.value)"><select aria-label="Filtrar por função" onchange="JRSStaff.filter(this.value)"><option value="Todos">Todas as funções</option>'+ROLES.map(role=>'<option '+(roleFilter===role?'selected':'')+'>'+esc(role)+'</option>').join('')+'</select></div>'
 +'<div id="jrsEmployeeList" class="jrs-employee-list">'+rowsHTML(filtered)+'</div></div>';
}
function rowsHTML(list){
 if(!list.length)return '<div class="jrs-staff-empty">Nenhum funcionário encontrado. Use <b>Novo funcionário</b> para começar.</div>';
 return list.map(s=>'<div class="jrs-employee-row"><span class="jrs-employee-avatar">'+roleIcon(s.role)+'</span><div class="jrs-employee-info"><b>'+esc(s.name)+'</b><small>'+esc(s.role)+(s.phone?' · '+esc(s.phone):'')+'</small>'+(s.notes?'<small class="jrs-employee-observation">'+esc(s.notes)+'</small>':'')+'</div>'+personStatus(s.status||'Ativo')+
 (canEdit('staff')?'<button class="btn tiny" type="button" onclick="JRSStaff.open(\''+esc(s.id)+'\')">Editar</button>':'')+'</div>').join('');
}
function refresh(){
 const result=document.getElementById('jrsEmployeeList');
 if(!result)return;
 const filtered=staffList().filter(s=>(roleFilter==='Todos'||roleFilter===s.role)&&(!searchTerm||[s.name,s.role,s.phone,s.notes].join(' ').toLocaleLowerCase('pt-BR').includes(searchTerm.toLocaleLowerCase('pt-BR')))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 result.innerHTML=rowsHTML(filtered);
}
function open(id){
 if(!requireEdit('staff'))return;
 const employee=id?staffList().find(x=>x.id===id):null;
 if(id&&!employee)return alert('Funcionário não encontrado.');
 const original=employee||{name:'',role:'Motorista',status:'Ativo',phone:'',notes:''};
 const options=(arr,current)=>arr.map(s=>'<option value="'+esc(s)+'" '+(s===current?'selected':'')+'>'+esc(s)+'</option>').join('');
 openDialog(employee?'Editar funcionário · '+employee.name:'Cadastrar funcionário',
 '<p class="jrs-employee-form-intro">Cadastre apenas dados necessários para organizar a equipe. Não é necessário inserir CPF, salário ou dados de saúde.</p>'
 +'<form id="jrsEmployeeForm" class="form-grid">'
 +'<div class="field span2"><label for="jrs-emp-name">Nome completo *</label><input id="jrs-emp-name" name="name" maxlength="120" required placeholder="Nome do colaborador" value="'+esc(original.name)+'"></div>'
 +'<div class="field"><label for="jrs-emp-role">Função *</label><select id="jrs-emp-role" name="role" required>'+options(ROLES,original.role)+'</select></div>'
 +'<div class="field"><label for="jrs-emp-status">Situação *</label><select id="jrs-emp-status" name="status" required>'+options(STATUSES,original.status)+'</select></div>'
 +'<div class="field span2"><label for="jrs-emp-phone">Telefone (opcional)</label><input id="jrs-emp-phone" name="phone" type="tel" maxlength="25" placeholder="(19) 99999-9999" value="'+esc(original.phone)+'"></div>'
 +'<div class="field span2"><label for="jrs-emp-notes">Observações operacionais</label><textarea id="jrs-emp-notes" name="notes" maxlength="450" placeholder="Ex.: disponibilidade de turno, função adicional...">'+esc(original.notes)+'</textarea></div>'
 +'<div class="span2" id="jrsEmployeeError" role="alert"></div>'
 +'<div class="span2 actions"><button class="btn primary" type="submit">'+(employee?'Salvar alterações':'Cadastrar funcionário')+'</button>'
 +(employee&&employee.status!=='Inativo'?'<button type="button" class="btn" onclick="JRSStaff.deactivate(\''+esc(employee.id)+'\')">Desativar</button>':'')+
 '<button class="btn" type="button" onclick="closeDialog()">Cancelar</button></div></form>');
 document.getElementById('jrsEmployeeForm').addEventListener('submit',e=>{
  e.preventDefault();const err=document.getElementById('jrsEmployeeError');
  try{
   const values=Object.fromEntries(new FormData(e.target));
   const name=String(values.name||'').trim(),phone=String(values.phone||'').trim(),notes=String(values.notes||'').trim();
   if(name.length<2)throw Error('Informe o nome completo do funcionário.');
   if(!ROLES.includes(values.role)||!STATUSES.includes(values.status))throw Error('Função ou situação inválida.');
   if(staffList().some(s=>s.id!==id&&norm(s.name)===norm(name)))throw Error('Já existe um funcionário cadastrado com esse nome.');
   if(employee)Object.assign(employee,{name,role:values.role,status:values.status,phone,notes,updatedAt:new Date().toISOString()});
   else staffList().push({id:uid('FUNC'),name,role:values.role,status:values.status,phone,notes,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
   save();closeDialog();window.render();
  }catch(error){err.textContent=error.message||'Falha ao salvar funcionário.';}
 });
}
function deactivate(id){
 if(!requireEdit('staff'))return;
 const person=staffList().find(s=>s.id===id);if(!person)return;
 if(!confirm('Desativar '+person.name+'? O cadastro e os históricos serão preservados.'))return;
 person.status='Inativo';person.updatedAt=new Date().toISOString();save();closeDialog();window.render();
}
function assignedNames(date){
 const found=new Set();
 const add=(text)=>{
  String(text||'').split(/[,;\n]+/).forEach(piece=>{
   const value=norm(piece);
   if(value)found.add(value);
  });
 };
 for(const e of (db.fleetBoardEntries||[])){
  if(e.date!==date)continue;
  if(['Cancelada','Indisponível'].includes(e.status))continue;
  add(e.driver);add(e.helper);
 }
 for(const e of (db.operations||[])){
  if(e.date!==date||e.status==='Cancelada')continue;
  add(e.operator);add(e.driver);add(e.helper);
 }
 return found;
}
function resourceAvailability(date,boardRows){
 const assigned=assignedNames(date),staff=staffList();
 const drivers=staff.filter(s=>group(s.role)==='drivers');
 const helpers=staff.filter(s=>group(s.role)==='helpers');
 const split=members=>({
  available:members.filter(x=>x.status==='Ativo'&&!assigned.has(norm(x.name))),
  busy:members.filter(x=>x.status==='Ativo'&&assigned.has(norm(x.name))),
  blocked:members.filter(x=>x.status!=='Ativo')
 });
 const busyEq=new Set();
 // Do not treat a generic/unnamed row as the concrete vehicle's identity.
 const validRows=(boardRows||[]).filter(r=>r.active!==false);
 for(const row of validRows){
  if(!(db.fleetBoardEntries||[]).some(e=>e.date===date&&e.rowId===row.id&&e.status!=='Cancelada'))continue;
  const linkedVehicle=row.vehicleId?(db.vehicles||[]).find(v=>v.id===row.vehicleId):null;
  const eq=row.equipmentId?db.equipment.find(e=>e.id===row.equipmentId):
   row.vehicleId?db.equipment.find(e=>e.vehicleId===row.vehicleId||(linkedVehicle&&e.vehiclePlate&&String(e.vehiclePlate).toUpperCase()===String(linkedVehicle.plate||'').toUpperCase())):null;
  if(eq)busyEq.add(eq.id);
  if(row.vehicleId)busyEq.add('V:'+row.vehicleId);
 }
 for(const e of db.equipment||[]){
  if((db.bookings||[]).some(b=>b.equipment===e.name&&b.status!=='Cancelada'&&b.start<=date&&b.end>=date))busyEq.add(e.id);
  if((db.operations||[]).some(o=>o.equipment===e.name&&o.date===date&&o.status!=='Cancelada'))busyEq.add(e.id);
 }
 const equipment=[];
 for(const e of db.equipment||[]){
  if(e.active===false)continue;
  const linked=e.vehicleId?(db.vehicles||[]).find(v=>v.id===e.vehicleId):
   e.vehiclePlate?(db.vehicles||[]).find(v=>String(v.plate||'').toUpperCase()===String(e.vehiclePlate).toUpperCase()):null;
  equipment.push({id:e.id,name:e.name||e.serial||'Equipamento',status:e.status||'Indisponível',busy:busyEq.has(e.id)||!!(linked&&busyEq.has('V:'+linked.id)),type:'equipment'});
 }
 // Avoid listing the same vehicle twice when linked into equipment catalog.
 for(const v of db.vehicles||[]){
  if((db.equipment||[]).some(e=>e.vehicleId===v.id||(e.vehiclePlate&&v.plate&&String(e.vehiclePlate).toUpperCase()===String(v.plate).toUpperCase())))continue;
  equipment.push({id:'V:'+v.id,name:(v.makeModel||'Veículo')+(v.plate?' · '+v.plate:''),status:v.fleetStatus==='Em atividade'?'Disponível':(v.fleetStatus||'Não verificado'),busy:busyEq.has('V:'+v.id),type:'vehicle'});
 }
 const equipmentResult={
  available:equipment.filter(e=>e.status==='Disponível'&&!e.busy),
  busy:equipment.filter(e=>e.busy),
  blocked:equipment.filter(e=>e.status!=='Disponível'&&!e.busy)
 };
 return {drivers:split(drivers),helpers:split(helpers),equipment:equipmentResult,assignedNames:assigned};
}
function availabilityPanel(date,boardRows){
 const data=resourceAvailability(date,boardRows);
 const iso=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'';
 const dateLabel=iso?new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}):'Selecione um dia';
 const summary=(key,title,icon,items)=>{
  const list=items.available;
  const chips=list.length?list.slice(0,9).map(i=>'<span class="jrs-available-chip" title="'+esc(i.name)+'">'+esc(i.name)+'</span>').join('')+
   (list.length>9?'<span class="jrs-available-more">+'+(list.length-9)+' outros</span>':''):
   '<span class="jrs-availability-empty">'+(items.busy.length||items.blocked.length?'Nenhum livre nesta data':'Nenhum cadastrado como ativo/disponível')+'</span>';
  return '<div class="jrs-availability-card"><div class="jrs-availability-card-top"><span class="jrs-availability-icon">'+icon+'</span><div><small>'+title+'</small><strong>'+list.length+' <span>livre(s)</span></strong></div></div>'+
   '<div class="jrs-available-chips">'+chips+'</div>'+
   '<div class="jrs-availability-foot"><span>'+items.busy.length+' escalado(s)</span><span>'+items.blocked.length+' indisponível(is) / não verificado(s)</span></div></div>';
 };
 return '<section class="jrs-availability-section" aria-label="Disponibilidade estimada da equipe e frota">'+
 '<div class="jrs-availability-head"><div><span class="jrs-availability-eyebrow">DISPONIBILIDADE DA OPERAÇÃO</span><h3>Quem está disponível?</h3><p>Confira os recursos que não constam em escala ou reserva no dia selecionado.</p></div>'+
 '<div class="jrs-availability-date"><label for="jrsAvailabilityDate">CONSULTAR DATA</label><input id="jrsAvailabilityDate" type="date" value="'+esc(date)+'" onchange="JRSBoard.pickDate(this.value)" /></div></div>'+
 '<div class="jrs-availability-grid">'+
 summary('drivers','Motoristas','🚛',data.drivers)+
 summary('helpers','Ajudantes','⛑',data.helpers)+
 summary('equipment','Equipamentos e veículos','🏗',data.equipment)+
 '</div>'+
 '<div class="jrs-availability-caption"><span class="jrs-availability-dot"></span><span>Disponibilidade <b>estimada</b>, calculada pelos cadastros, situações e compromissos desta data. Equipamentos precisam estar marcados como “Disponível”. Escalas sem identificação de funcionário e vínculos de frota incompletos não podem ser verificados automaticamente.</span>'+
 (canEdit('staff')?'<button type="button" class="btn tiny" onclick="go(\'staff\')">Gerenciar funcionários ↗</button>':'')+'</div></section>';
}
window.JRSStaff={render,open,deactivate,availabilityPanel,resourceAvailability,registeredDriverNames,registeredHelperNames,search(s){searchTerm=s;refresh()},filter(v){roleFilter=v;refresh()},__debug:{group,norm,assignedNames,staffList,rowsHTML}};
})();
