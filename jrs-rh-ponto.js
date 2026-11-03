/* JRS GUINDASTES · jrs-rh-folha-v1
   Cadastro integrado à frota, ponto manual e conferência para fechamento.
   Não substitui relógio de ponto homologado nem cálculo oficial de folha.
*/
(function(){
'use strict';
const EMPLOYEE_ROLES=['Motorista','Ajudante','Motorista/Operador','Operador de guindaste','Operador de Munck','Operador de empilhadeira','Operador de plataforma','Mecânico','Técnico de segurança','Administrativo','Comercial','Recursos Humanos','Auxiliar administrativo','Gestor','Outros'];
const STATUSES=['Ativo','Férias','Folga','Afastado','Inativo'];
const OCCURRENCES=['Trabalho','Falta','Atestado','Férias','Folga','Feriado','Abono','Afastamento'];
let tab='colaboradores',month=new Date().toISOString().slice(0,7),search='',selectedStaff='all';
const E=x=>esc(x??'');
const staff=()=>{if(!Array.isArray(db.staff))db.staff=[];return db.staff};
const punches=()=>{if(!Array.isArray(db.rhPunches))db.rhPunches=[];return db.rhPunches};
const closings=()=>{if(!Array.isArray(db.rhClosings))db.rhClosings=[];return db.rhClosings};
const getPerson=id=>staff().find(x=>x.id===id);
const isoDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const currentMonth=()=>isoDate(new Date()).slice(0,7);
const displayDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4):'—';
const isValidDate=str=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(str||''))return false;const d=new Date(str+'T12:00:00');return !Number.isNaN(d.getTime())&&isoDate(d)===str};
const goodMonth=str=>/^\d{4}-(0[1-9]|1[0-2])$/.test(str||'');
const clean=str=>String(str||'').trim();
const pad=n=>String(n).padStart(2,'0');
const duration=m=>{const n=Math.max(0,Math.round(m||0));return pad(Math.floor(n/60))+':'+pad(n%60)};
const timeVal=text=>{if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(text||'')))return null;const [h,m]=text.split(':').map(Number);return h*60+m};
const targetOf=person=>{const v=timeVal(person?.dailyTarget||'08:00');return v===null||v<60?480:v};
const normalize=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
function clockStats(record,person){
 if(record.type!=='Trabalho')return {complete:true,worked:null,positive:0,negative:0,label:'Ocorrência',reason:''};
 const entry=timeVal(record.entry),exit=timeVal(record.exit);
 const out=record.breakOut?timeVal(record.breakOut):null;
 const inside=record.breakIn?timeVal(record.breakIn):null;
 if(entry===null||exit===null)return {complete:false,worked:null,positive:0,negative:0,label:'Pendente',reason:'Falta entrada ou saída'};
 if((out===null)!==(inside===null))return {complete:false,worked:null,positive:0,negative:0,label:'Pendente',reason:'Intervalo incompleto'};
 let end=exit;
 if(end<entry)end+=1440;
 const gross=end-entry;
 if(gross<=0||gross>1440)return {complete:false,worked:null,positive:0,negative:0,label:'Revisar',reason:'Jornada fora do intervalo esperado'};
 if(gross>360&&out===null)return {complete:false,worked:null,positive:0,negative:0,label:'Pendente',reason:'Intervalo não informado'};
 let breakMinutes=0;
 if(out!==null){
  let start=out;if(start<entry)start+=1440;
  let finish=inside;if(finish<start)finish+=1440;
  if(start<entry||finish>end||finish<=start)return {complete:false,worked:null,positive:0,negative:0,label:'Revisar',reason:'Intervalo fora da jornada'};
  breakMinutes=finish-start;
 }
 const worked=gross-breakMinutes;
 if(worked<0)return {complete:false,worked:null,positive:0,negative:0,label:'Revisar',reason:'Horário inconsistente'};
 const target=Number.isFinite(record.targetMinutes)?record.targetMinutes:targetOf(person);
 return {complete:true,worked,positive:Math.max(0,worked-target),negative:Math.max(0,target-worked),label:'Conferível',reason:'',breakMinutes};
}
function sortedPunches(staffId,selected=month){
 return punches().filter(p=>p.date.startsWith(selected)&&(staffId==='all'||p.staffId===staffId)).sort((a,b)=>b.date.localeCompare(a.date)||(getPerson(a.staffId)?.name||'').localeCompare(getPerson(b.staffId)?.name||''));
}
function getClosing(staffId,selected=month){return closings().find(x=>x.staffId===staffId&&x.month===selected&&x.closed)}
function summary(person,selected=month){
 const list=sortedPunches(person.id,selected);
 let worked=0,positive=0,negative=0,pending=0;
 const occurrences={};
 for(const p of list){
  occurrences[p.type]=(occurrences[p.type]||0)+1;
  const v=clockStats(p,person);
  if(!v.complete){pending++;continue}
  if(v.worked!==null){worked+=v.worked;positive+=v.positive;negative+=v.negative}
 }
 return {records:list.length,worked,positive,negative,pending,occurrences,closed:!!getClosing(person.id,selected)};
}
const payrollState=id=>getClosing(id)?'<span class="rh-state closed">✓ Conferido</span>':'<span class="rh-state pending">Em aberto</span>';
function filterPersonOptions(selected,withAll){
 return (withAll?'<option value="all">Todos os funcionários</option>':'')+staff().slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(s=>'<option value="'+E(s.id)+'" '+(s.id===selected?'selected':'')+'>'+E(s.name)+' · '+E(s.role)+'</option>').join('');
}
function render(){
 if(!canView('hr'))return '<div class="card">Área restrita ao RH.</div>';
 const people=staff(),active=people.filter(x=>x.status==='Ativo').length;
 const list=sortedPunches('all'),incomplete=list.filter(x=>!clockStats(x,getPerson(x.staffId)).complete).length;
 const isEditor=canEdit('hr');
 const nav=[['colaboradores','Cadastro de colaboradores'],['ponto','Controle de ponto'],['fechamento','Fechamento da folha']];
 return '<section class="rh-module"><div class="rh-heading"><div><span class="rh-overline">JRS GUINDASTES · RECURSOS HUMANOS</span><h1>Gestão de RH e Ponto</h1><p>Cadastro integrado da equipe, lançamentos diários e conferência mensal para fechamento.</p></div><div class="rh-heading-actions">'+(isEditor?'<button class="btn primary" onclick="JRSRH.employeeForm()">＋ Funcionário</button><button class="btn" onclick="JRSRH.punchForm()">＋ Registrar ponto</button>':'')+'</div></div>'
 +'<div class="rh-metrics"><div class="card"><small>Colaboradores</small><b>'+people.length+'</b></div><div class="card"><small>Ativos</small><b>'+active+'</b></div><div class="card"><small>Lançamentos no mês</small><b>'+list.length+'</b></div><div class="card"><small>Pendências para conferir</small><b>'+incomplete+'</b></div></div>'
 +'<div class="rh-tabs" role="group" aria-label="Áreas do RH">'+nav.map(([key,label])=>'<button type="button" class="rh-tab '+(tab===key?'active':'')+'" onclick="JRSRH.setTab(\''+key+'\')">'+label+'</button>').join('')+'</div>'
 +'<div id="rh-tab-content">'+(tab==='colaboradores'?renderPeople():tab==='ponto'?renderPunches():renderClosings())+'</div>'
 +'<p class="rh-privacy-note">**Conferência interna:** os apontamentos são lançados manualmente e os saldos são diferenças frente à jornada de referência informada. Não substituem registro eletrônico oficial, apuração de verbas, banco de horas, regras de CCT ou conferência trabalhista. Nesta versão demonstrativa os dados ficam neste navegador, sem sincronização entre dispositivos e sem proteção adequada para folha real.</p></section>';
}
function renderPeople(){
 const term=search.toLocaleLowerCase('pt-BR');
 const list=staff().filter(x=>!term||[x.name,x.role,x.department,x.employeeCode].join(' ').toLocaleLowerCase('pt-BR').includes(term)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return '<div class="rh-section-header"><div><h2>Colaboradores</h2><p>Os mesmos funcionários usados pela programação da frota.</p></div><input class="search" value="'+E(search)+'" placeholder="Buscar colaborador, função ou setor..." oninput="JRSRH.search(this.value)"></div>'
 +'<div id="rh-people-results">'+peopleList(list)+'</div>';
}
function peopleList(list){
 return '<div class="card tablewrap rh-table-wrap"><table class="table"><thead><tr><th>Colaborador</th><th>Função e setor</th><th>Admissão</th><th>Aniversário</th><th>Jornada ref.</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'
 +(list.length?list.map(x=>'<tr><td><b>'+E(x.name)+'</b><small class="rh-cell-small">'+E(x.employeeCode||'Sem matrícula')+'</small></td><td>'+E(x.role||'—')+'<small class="rh-cell-small">'+E(x.department||'Setor não informado')+'</small></td><td>'+displayDate(x.hireDate)+'</td><td>'+(isValidDate(x.birthDate)?x.birthDate.slice(8,10)+'/'+x.birthDate.slice(5,7):'—')+'</td><td>'+duration(targetOf(x))+'</td><td>'+E(x.status||'Ativo')+'</td><td>'+(canEdit('hr')?'<button class="btn tiny" onclick="JRSRH.employeeForm(\''+E(x.id)+'\')">Editar</button>':'<span class="muted">Leitura</span>')+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">Ainda não há colaboradores. Cadastre aqui ou na seção Funcionários.</td></tr>')+'</tbody></table></div>';
}
function dateField(name,label,value='',type='text',required=false){
 return '<div class="field"><label for="rh-'+name+'">'+label+'</label><input id="rh-'+name+'" name="'+name+'" type="'+type+'" '+(required?'required':'')+' value="'+E(value)+'"></div>';
}
function selectField(name,label,values,current){
 return '<div class="field"><label for="rh-'+name+'">'+label+'</label><select id="rh-'+name+'" name="'+name+'">'+values.map(x=>'<option value="'+E(x)+'" '+(x===current?'selected':'')+'>'+E(x)+'</option>').join('')+'</select></div>';
}
function employeeForm(id){
 if(!requireEdit('hr'))return;
 const person=id?getPerson(id):null;if(id&&!person)return alert('Funcionário não localizado.');
 const p=person||{};
 const roles=Array.from(new Set([...EMPLOYEE_ROLES,p.role].filter(Boolean)));
 const form='<form id="rh-employee-form" class="form-grid">'
 +dateField('name','Nome completo *',p.name||'','text',true)
 +dateField('employeeCode','Matrícula / identificação interna',p.employeeCode||'')
 +selectField('role','Função',roles,p.role||'Motorista')
 +selectField('status','Situação',STATUSES,p.status||'Ativo')
 +dateField('department','Setor / departamento',p.department||'')
 +dateField('phone','Telefone (opcional)',p.phone||'','tel')
 +dateField('hireDate','Data de admissão',p.hireDate||'','date')
 +dateField('birthDate','Data de nascimento (para aniversário)',p.birthDate||'','date')
 +'<div class="field span2"><label for="rh-dailyTarget">Jornada de referência diária (HH:MM) *</label><input id="rh-dailyTarget" name="dailyTarget" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required value="'+E(p.dailyTarget||'08:00')+'"><small>Informe a jornada contratual correta. Ex.: 08:00 ou 08:48. Não é cálculo de horas extras trabalhistas.</small></div>'
 +'<div class="field span2"><label for="rh-notes">Observações operacionais</label><textarea id="rh-notes" name="notes" maxlength="500">'+E(p.notes||'')+'</textarea></div>'
 +'<div class="span2" id="rh-employee-error" role="alert"></div><div class="span2 actions"><button class="btn primary" type="submit">Salvar colaborador</button><button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div></form>';
 openDialog(person?'Editar colaborador · '+p.name:'Novo colaborador · RH',form);
 document.getElementById('rh-employee-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const f=Object.fromEntries(new FormData(event.target));
   for(const k of Object.keys(f))f[k]=clean(f[k]);
   if(f.name.length<2)throw Error('Informe o nome completo.');
   if(!roles.includes(f.role)||!STATUSES.includes(f.status))throw Error('Função ou situação inválida.');
   if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(f.dailyTarget)||targetOf({dailyTarget:f.dailyTarget})<60)throw Error('Informe uma jornada de referência válida (ex.: 08:00).');
   if(f.hireDate&&!isValidDate(f.hireDate))throw Error('Data de admissão inválida.');
   if(f.birthDate&&!isValidDate(f.birthDate))throw Error('Data de nascimento inválida.');
   if(f.employeeCode&&staff().some(x=>x.id!==id&&x.employeeCode&&normalize(x.employeeCode)===normalize(f.employeeCode)))throw Error('Esta matrícula já foi utilizada.');
   if(staff().some(x=>x.id!==id&&normalize(x.name)===normalize(f.name)))throw Error('Já existe colaborador com esse nome. Edite o cadastro existente para evitar duplicidade.');
   if(person)Object.assign(person,f,{updatedAt:new Date().toISOString()});
   else staff().push({id:uid('FUNC'),...f,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
   save();closeDialog();window.render();
  }catch(err){document.getElementById('rh-employee-error').textContent=err.message||'Não foi possível salvar.'}
 });
}
function monthToolbar(){
 return '<div class="rh-month-toolbar"><label>Mês de referência <input type="month" value="'+E(month)+'" onchange="JRSRH.setMonth(this.value)"></label><label>Funcionário <select onchange="JRSRH.setStaff(this.value)">'+filterPersonOptions(selectedStaff,true)+'</select></label></div>';
}
function rowClass(r,person){
 const v=clockStats(r,person);
 return !v.complete?'needs-review':r.type==='Trabalho'?'worked':'occurrence';
}
function punchList(){
 const list=sortedPunches(selectedStaff);
 return '<div class="card tablewrap rh-table-wrap"><table class="table"><thead><tr><th>Dia</th><th>Funcionário</th><th>Ocorrência</th><th>Entrada</th><th>Intervalo</th><th>Saída</th><th>Horas</th><th>Diferença de ref.</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'
 +(list.length?list.map(r=>{
  const person=getPerson(r.staffId),calc=clockStats(r,person),locked=!!getClosing(r.staffId);
  return '<tr class="rh-record '+rowClass(r,person)+'"><td>'+displayDate(r.date)+'</td><td><b>'+E(person?.name||r.staffName||'—')+'</b></td><td>'+E(r.type)+'</td><td>'+E(r.entry||'—')+'</td><td>'+E([r.breakOut,r.breakIn].filter(Boolean).join('–')||'—')+'</td><td>'+E(r.exit||'—')+'</td><td><b>'+(calc.worked===null?'—':duration(calc.worked))+'</b></td><td>'+(calc.complete&&calc.worked!==null?'+'+duration(calc.positive)+' / −'+duration(calc.negative):'—')+'</td><td><span class="rh-record-status '+(!calc.complete?'warn':'ok')+'">'+E(calc.label)+'</span>'+(calc.reason?'<small class="rh-cell-small">'+E(calc.reason)+'</small>':'')+'</td><td>'+(canEdit('hr')&&!locked?'<button class="btn tiny" onclick="JRSRH.punchForm(\''+E(r.staffId)+'\',\''+E(r.date)+'\')">Editar</button>':'<small class="muted">Conferido</small>')+'</td></tr>';
 }).join(''):'<tr><td colspan="10" class="empty">Nenhum ponto registrado para este período. Clique em “Registrar ponto”.</td></tr>')+'</tbody></table></div>';
}
function renderPunches(){
 return '<div class="rh-section-header"><div><h2>Controle diário de ponto</h2><p>Entrada, intervalo, saída e ocorrências por funcionário.</p></div>'+(canEdit('hr')?'<button class="btn primary" onclick="JRSRH.punchForm()">＋ Registrar ponto</button>':'')+'</div>'+monthToolbar()+'<div id="rh-punch-list">'+punchList()+'</div>';
}
function punchForm(staffId,recordDate){
 if(!requireEdit('hr'))return;
 if(!staff().length)return alert('Cadastre um funcionário no RH antes de lançar o ponto.');
 const id=staffId|| (selectedStaff!=='all'?selectedStaff:staff()[0].id);
 const day=recordDate|| (month===currentMonth()?isoDate(new Date()):month+'-01');
 const existing=punches().find(x=>x.staffId===id&&x.date===day);
 if(getClosing(id,day.slice(0,7)))return alert('Este período está fechado para o funcionário. Reabra o fechamento antes de editar.');
 const p=existing||{},person=getPerson(id);
 const initialDay=goodMonth(month)?month:currentMonth();
 const dateValue=isValidDate(day)?day:initialDay+'-01';
 openDialog(existing?'Editar ponto · '+person?.name:'Registrar ponto · RH',
 '<form id="rh-punch-form" class="form-grid">'
 +'<div class="field span2"><label>Funcionário *</label><select name="staffId" required '+(existing?'disabled':'')+'>'+filterPersonOptions(id,false)+'</select></div>'
 +dateField('date','Data do apontamento *',p.date||dateValue,'date',true)
 +selectField('type','Ocorrência',OCCURRENCES,p.type||'Trabalho')
 +dateField('entry','Entrada',p.entry||'','time')
 +dateField('breakOut','Saída para intervalo',p.breakOut||'','time')
 +dateField('breakIn','Retorno do intervalo',p.breakIn||'','time')
 +dateField('exit','Saída final',p.exit||'','time')
 +'<div class="field span2"><label>Observação / justificativa</label><textarea name="note" maxlength="600" rows="3" placeholder="Observação sobre a jornada ou ocorrência">'+E(p.note||'')+'</textarea></div>'
 +'<div class="span2 rh-record-hint">Horários são informados manualmente. A diferença de jornada é uma referência para conferência. Se faltarem marcações, o dia ficará <b>Pendente</b>, sem horas calculadas.</div>'
 +'<div class="span2" id="rh-punch-error" role="alert"></div><div class="span2 actions"><button class="btn primary" type="submit">Salvar ponto</button><button type="button" class="btn" onclick="closeDialog()">Cancelar</button></div></form>');
 document.getElementById('rh-punch-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const f=Object.fromEntries(new FormData(event.target));
   f.staffId=existing?.staffId||f.staffId;
   const target=getPerson(f.staffId);
   if(!target)throw Error('Funcionário não localizado.');
   if(!isValidDate(f.date))throw Error('Data inválida.');
   if(!OCCURRENCES.includes(f.type))throw Error('Ocorrência inválida.');
   if(getClosing(f.staffId,f.date.slice(0,7)))throw Error('Este mês já foi fechado para o funcionário.');
   for(const key of ['entry','breakOut','breakIn','exit'])if(f[key]&&timeVal(f[key])===null)throw Error('Horário inválido no campo '+key+'.');
   const other=punches().find(x=>x.staffId===f.staffId&&x.date===f.date&&x.id!==existing?.id);
   if(other)throw Error('Já existe ponto neste dia. Edite o registro existente.');
   f.note=clean(f.note);
   if(f.type!=='Trabalho'){f.entry='';f.breakOut='';f.breakIn='';f.exit='';}
   const calc=clockStats({...f,targetMinutes:existing?.targetMinutes??targetOf(target)},target);
   if(calc.label==='Revisar')throw Error(calc.reason);
   const record=existing||{id:uid('PTO'),createdAt:new Date().toISOString()};
   Object.assign(record,f,{targetMinutes:existing?.targetMinutes??targetOf(target),staffName:target.name,updatedAt:new Date().toISOString()});
   if(!existing)punches().push(record);
   save();closeDialog();window.render();
  }catch(err){document.getElementById('rh-punch-error').textContent=err.message||'Falha ao registrar o ponto.'}
 });
}
function closingTable(){
 const candidates=staff().filter(x=>selectedStaff==='all'||selectedStaff===x.id).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return '<div class="card tablewrap rh-table-wrap"><table class="table"><thead><tr><th>Colaborador</th><th>Dias lançados</th><th>Horas conferíveis</th><th>Acima da referência</th><th>Abaixo da referência</th><th>Pendências</th><th>Conferência</th><th>Ação</th></tr></thead><tbody>'
 +(candidates.length?candidates.map(person=>{
  const s=summary(person),closed=getClosing(person.id);
  return '<tr><td><b>'+E(person.name)+'</b><small class="rh-cell-small">'+E(person.role)+'</small></td><td>'+s.records+'</td><td><b>'+duration(s.worked)+'</b></td><td>+'+duration(s.positive)+'</td><td>−'+duration(s.negative)+'</td><td>'+s.pending+'</td><td>'+payrollState(person.id)+'</td><td>'+(canEdit('hr')?'<button class="btn tiny '+(closed?'':'primary')+'" onclick="JRSRH.toggleClose(\''+E(person.id)+'\')">'+(closed?'Reabrir':'Conferir / fechar')+'</button>':'—')+'</td></tr>';
 }).join(''):'<tr><td colspan="8" class="empty">Nenhum funcionário encontrado.</td></tr>')+'</tbody></table></div>';
}
function renderClosings(){
 const records=sortedPunches('all'),review=records.filter(x=>!clockStats(x,getPerson(x.staffId)).complete).length;
 const closed=staff().filter(x=>!!getClosing(x.id)).length;
 return '<div class="rh-section-header"><div><h2>Fechamento mensal de ponto</h2><p>Resumo para conferência de folha, com exportação em CSV.</p></div><div class="rh-heading-actions"><button class="btn primary" onclick="JRSRH.exportCSV()">Exportar CSV do mês ↓</button></div></div>'
 +monthToolbar()+'<div class="rh-closing-stats"><div><b>'+closed+'</b><small>Colaboradores conferidos</small></div><div><b>'+review+'</b><small>Registros incompletos</small></div><div><b>'+records.length+'</b><small>Apontamentos no período</small></div></div>'
 +'<div class="rh-warn">O botão “Conferir / fechar” bloqueia alterações daquele funcionário neste mês, mas <b>não calcula salário, DSR, adicionais, descontos ou encargos</b>. Revise registros faltantes, jornadas especiais, feriados, banco de horas e regras da categoria antes da folha oficial.</div>'
 +'<div id="rh-closing-list">'+closingTable()+'</div>';
}
function toggleClose(id){
 if(!requireEdit('hr'))return;
 const person=getPerson(id);if(!person)return alert('Funcionário não localizado.');
 const closed=getClosing(id),s=summary(person);
 if(closed){
  if(!confirm('Reabrir o mês '+month+' de '+person.name+'? Os lançamentos voltarão a ser editáveis.'))return;
  closed.closed=false;closed.reopenedAt=new Date().toISOString();
 }else{
  if(!s.records)return alert('Não há apontamentos neste mês para '+person.name+'. Registre ou confira os dias primeiro.');
  if(s.pending)return alert('Há '+s.pending+' dia(s) com marcações incompletas. Corrija antes de fechar.');
  if(!confirm('Confirma que o RH revisou TODOS os dias do período, inclusive faltas e ausências, para '+person.name+' em '+month+'?\n\nO fechamento bloqueia edições até reabertura; não gera folha de pagamento.'))return;
  const record=closings().find(x=>x.staffId===id&&x.month===month);
  if(record)Object.assign(record,{closed:true,closedAt:new Date().toISOString(),closedBy:window.JRSAccess?.current()?.name||'RH'});
  else closings().push({id:uid('FOL'),staffId:id,month,closed:true,closedAt:new Date().toISOString(),closedBy:window.JRSAccess?.current()?.name||'RH'});
 }
 save();window.render();
}
function csvCell(raw){
 const s=String(raw??'');
 return '"'+(/^[=+\-@\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';
}
function exportCSV(){
 if(!canView('hr'))return;
 const lines=[['Mês','Matrícula','Funcionário','Função','Data','Tipo','Entrada','Saída intervalo','Volta intervalo','Saída final','Horas trabalhadas','Acima jornada referência','Abaixo jornada referência','Referência diária','Pendente','Observação','Fechamento']];
 for(const x of sortedPunches(selectedStaff)){
  const person=getPerson(x.staffId),v=clockStats(x,person);
  lines.push([month,person?.employeeCode||'',person?.name||x.staffName||'',person?.role||'',x.date,x.type,x.entry||'',x.breakOut||'',x.breakIn||'',x.exit||'',v.worked===null?'':duration(v.worked),v.complete?duration(v.positive):'',v.complete?duration(v.negative):'',duration(Number.isFinite(x.targetMinutes)?x.targetMinutes:targetOf(person)),v.complete?'Não':v.reason,x.note||'',getClosing(x.staffId)?'Conferido':'Em aberto']);
 }
 const content='\ufeff'+lines.map(row=>row.map(csvCell).join(';')).join('\r\n');
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='JRS_ponto_'+month+(selectedStaff!=='all'?'_'+selectedStaff:'')+'.csv';
 a.style.display='none';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
window.JRSRH={
 render,employeeForm,punchForm,toggleClose,exportCSV,
 setTab(v){if(['colaboradores','ponto','fechamento'].includes(v)){tab=v;window.render()}},
 setMonth(v){if(goodMonth(v)){month=v;window.render()}},
 setStaff(v){selectedStaff=v;window.render()},
 search(v){search=v;const root=document.getElementById('rh-people-results');if(root)root.innerHTML=peopleList(staff().filter(x=>[x.name,x.role,x.department,x.employeeCode].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))))},
 __test:{clockStats,summary,targetOf,staff,punches,closings,displayDate,timeVal,isValidDate,month:()=>month}
};
})();