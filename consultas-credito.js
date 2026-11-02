/* jrs-credit-consultations-v1
   Histórico de avaliação comercial manual. NÃO consulta birôs nem calcula score. */
(function(){
'use strict';
const statuses=['Em análise','Documentação pendente','Aprovado internamente','Aprovação condicionada','Não recomendado'];
const bureauResults=['Não consultado','Consulta externa pendente','Sem apontamentos informados','Com apontamentos informados'];
let search='',filter='Todos';
const clientById=id=>db.clients.find(c=>c.id===id);
const list=()=>Array.isArray(db.creditReviews)?db.creditReviews:(db.creditReviews=[]);
const nameOf=r=>clientById(r.clientId)?.name||r.clientName||'Cliente não encontrado';
const date=iso=>iso?new Date(iso+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const numbers=r=>{
 const revenue=Number(r.revenue||0),obligations=Number(r.obligations||0),requested=Number(r.requested||0),existing=Number(r.exposure||0);
 return {balance:revenue-obligations,ratio:revenue>0?Math.round(obligations/revenue*1000)/10:null,total:requested+existing};
};
const options=(values,chosen)=>values.map(v=>'<option '+(v===chosen?'selected':'')+'>'+esc(v)+'</option>').join('');
function customerDocument(c){
 if(!c)return 'Não informado';
 const raw=cleanClientDoc(clientDocumentOf(c));
 if(!raw)return 'Não cadastrado';
 return clientDocKind(raw)==='CPF'?'***.***.'+raw.slice(-5,-2)+'-'+raw.slice(-2):'**.***.***/****-'+raw.slice(-2);
}
function statusChip(value){
 const cls=value==='Aprovado internamente'?'good':value==='Aprovação condicionada'?'warn':value==='Não recomendado'?'review':'pending';
 return '<span class="credit-chip '+cls+'">'+esc(value||'Em análise')+'</span>';
}
function tableRows(rows){
 return '<div class="card tablewrap credit-list"><table class="table"><thead><tr><th>Data</th><th>Cliente</th><th>Valor em análise</th><th>Parecer</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>'
 +(rows.length?rows.map(r=>'<tr><td>'+date(r.date)+'</td><td><b>'+esc(nameOf(r))+'</b></td><td>'+money(r.requested)+'</td><td>'+statusChip(r.status)+'</td><td>'+esc(r.reviewer||'—')+'</td><td><div class="actions"><button class="btn tiny" onclick="JRSCreditUI.detail(\''+esc(r.id)+'\')">Consultar</button>'+(canEdit('credit')?'<button class="btn tiny" onclick="JRSCreditUI.open(\''+esc(r.clientId)+'\',\''+esc(r.id)+'\')">Editar</button>':'')+'</div></td></tr>').join(''):'<tr><td colspan="6" class="empty">Nenhuma consulta registrada.</td></tr>')
 +'</tbody></table></div>';
}
function getFiltered(){
 const term=search.trim().toLowerCase();
 return list().slice().sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))
 .filter(r=>(filter==='Todos'||r.status===filter)&&(!term||[nameOf(r),r.reviewer,r.status,r.source].join(' ').toLowerCase().includes(term)));
}
function refresh(){const el=document.getElementById('creditDataResults');if(el)el.innerHTML=tableRows(getFiltered());}
function show(){
 if(!canView('credit'))return '<div class="card">Acesso restrito ao cadastro de clientes.</div>';
 const rows=list(),pending=rows.filter(r=>['Em análise','Documentação pendente'].includes(r.status)).length;
 const closed=rows.length-pending,customers=new Set(rows.map(r=>r.clientId)).size;
 return '<div class="headline"><div><span class="eyebrow">JRS GUINDASTES · GESTÃO COMERCIAL</span><h1>Consultas de crédito</h1><p class="subtitle">Histórico de análises e pareceres internos vinculados aos clientes.</p></div>'+(canEdit('credit')?'<button class="btn primary" onclick="JRSCreditUI.open()">＋ Nova análise</button>':'')+'</div>'
 +'<div class="credit-hero"><div><span>CONSULTAS E PARECERES</span><h2>Conheça melhor cada negociação.</h2><p>Acompanhe dados informados pela equipe, fontes de consulta e condições comerciais antes de aprovar internamente uma locação.</p></div><div class="credit-hero-icon">◫</div></div>'
 +'<div class="credit-kpis"><div class="card"><small>Análises registradas</small><strong>'+rows.length+'</strong></div><div class="card"><small>Em andamento</small><strong>'+pending+'</strong></div><div class="card"><small>Pareceres concluídos</small><strong>'+closed+'</strong></div><div class="card"><small>Clientes avaliados</small><strong>'+customers+'</strong></div></div>'
 +'<div class="credit-notice"><b>Pré-análise manual — não é consulta ao Serasa ou SPC.</b><p>O sistema não acessa bases externas, não verifica restrições e não atribui score. O parecer é registrado por uma pessoa. Este ambiente usa armazenamento local no navegador; não cadastre informações financeiras reais ou sensíveis antes da implantação de um servidor seguro.</p></div>'
 +'<div class="credit-list-heading"><div><h3>Histórico das análises</h3><small>Consulte os pareceres salvos por cliente</small></div></div>'
 +'<div class="credit-search"><input class="search" placeholder="Buscar cliente ou responsável..." value="'+esc(search)+'" oninput="JRSCreditUI.setSearch(this.value)"><select onchange="JRSCreditUI.setFilter(this.value)"><option>Todos</option>'+options(statuses,filter)+'</select></div>'
 +'<div id="creditDataResults">'+tableRows(getFiltered())+'</div>';
}
function formLive(){
 const form=document.getElementById('creditForm');if(!form)return;
 const num=name=>Number(form.elements.namedItem(name).value||0);
 const revenue=num('revenue'),obligations=num('obligations'),requested=num('requested'),exposure=num('exposure');
 const target=document.getElementById('creditPreview');if(!target)return;
 const ratio=revenue>0?Math.round(obligations/revenue*1000)/10:null;
 target.innerHTML='<div><small>Saldo mensal estimado</small><b>'+money(revenue-obligations)+'</b></div><div><small>Comprometimento informado</small><b>'+(ratio===null?'Não calculado':ratio+'%')+'</b></div><div><small>Exposição total informada</small><b>'+money(requested+exposure)+'</b></div>';
}
function open(clientId,reviewId){
 if(!requireEdit('credit'))return;
 if(!db.clients.length){alert('Cadastre um cliente primeiro na Carteira de Clientes.');return;}
 const saved=reviewId?list().find(x=>x.id===reviewId):null;
 if(reviewId&&!saved){alert('Análise não localizada.');return;}
 const id=saved?.clientId||clientId||db.clients[0].id,customer=clientById(id);
 if(!customer){alert('Cliente não localizado.');return;}
 const original=saved||{};
 const financial=[
 ['requested','Valor solicitado (R$)'],
 ['revenue','Faturamento/renda mensal informado (R$)'],
 ['obligations','Compromissos mensais informados (R$)'],
 ['exposure','Exposição financeira existente (R$)']
 ];
 const body='<div class="credit-modal-summary"><b>'+esc(customer.name)+'</b><small>CPF/CNPJ: '+esc(customerDocument(customer))+'</small></div>'
 +'<div class="credit-modal-warning">Não é uma consulta automática nem uma decisão de crédito. Informe apenas dados de demonstração neste ambiente local.</div>'
 +'<form id="creditForm" class="form-grid">'
 +'<div class="field span2"><label>Cliente cadastrado *</label><select name="clientId" required '+(saved?'disabled':'')+'>'+db.clients.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===id?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div>'
 +'<div class="field"><label>Data da análise *</label><input name="date" type="date" required value="'+esc(original.date||new Date().toISOString().slice(0,10))+'"></div>'
 +'<div class="field"><label>Responsável pelo parecer *</label><input name="reviewer" maxlength="100" required value="'+esc(original.reviewer||'')+'" placeholder="Nome do analista"></div>'
 +financial.map(([key,label])=>'<div class="field"><label>'+label+'</label><input name="'+key+'" type="number" min="0" max="1000000000000" step="0.01" inputmode="decimal" required value="'+(original[key]??'')+'" oninput="JRSCreditUI.preview()"></div>').join('')
 +'<div id="creditPreview" class="credit-metrics-live span2"></div>'
 +'<div class="field"><label>Fonte da consulta externa (opcional)</label><input name="source" maxlength="120" value="'+esc(original.source||'')+'" placeholder="Ex.: relatório obtido pela equipe"></div>'
 +'<div class="field"><label>Data da consulta externa</label><input name="sourceDate" type="date" value="'+esc(original.sourceDate||'')+'"></div>'
 +'<div class="field"><label>Apontamentos registrados manualmente</label><select name="bureauResult">'+options(bureauResults,original.bureauResult||'Não consultado')+'</select></div>'
 +'<div class="field"><label>Parecer interno *</label><select name="status">'+options(statuses,original.status||'Em análise')+'</select></div>'
 +'<div class="field span2"><label>Justificativa e próximos passos (sem documentos pessoais)</label><textarea name="notes" maxlength="900" placeholder="Observações comerciais...">'+esc(original.notes||'')+'</textarea></div>'
 +'<label class="credit-ack span2"><input name="ack" type="checkbox" required><span>Confirmo a finalidade autorizada e que estou preenchendo um parecer manual, sem verificação automática.</span></label>'
 +'<div id="creditFormError" class="span2" role="alert"></div>'
 +'<div class="span2 actions"><button class="btn primary" type="submit">'+(saved?'Salvar alterações':'Registrar análise')+'</button><button class="btn" type="button" onclick="closeDialog()">Cancelar</button></div></form>';
 openDialog(saved?'Editar consulta de crédito':'Nova consulta de crédito',body);
 document.getElementById('dialog').classList.add('credit-dialog');
 formLive();
 const form=document.getElementById('creditForm');
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const error=document.getElementById('creditFormError');
  try{
   const data=Object.fromEntries(new FormData(form));
   const chosen=clientById(saved?.clientId||data.clientId);
   if(!chosen)throw Error('Cliente não localizado.');
   if(!data.ack)throw Error('Confirme a finalidade da avaliação.');
   for(const [key] of financial){const n=Number(data[key]);if(data[key]===''||!Number.isFinite(n)||n<0||n>1e12)throw Error('Informe valores financeiros válidos.');data[key]=n;}
   if(!data.reviewer?.trim())throw Error('Informe o analista responsável.');
   if(!statuses.includes(data.status)||!bureauResults.includes(data.bureauResult))throw Error('Situação inválida.');
   if(data.bureauResult==='Sem apontamentos informados'||data.bureauResult==='Com apontamentos informados'){
    if(!data.source)throw Error('Informe a fonte dos apontamentos externos registrados.');
   }
   if(data.sourceDate&&!data.source)throw Error('Informe a fonte para a data de consulta.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw Error('Informe a data da análise.');
   delete data.ack;delete data.clientId;
   data.reviewer=data.reviewer.trim();data.source=data.source.trim();data.notes=data.notes.trim();
   if(saved)Object.assign(saved,data,{updatedAt:new Date().toISOString()});
   else list().push({...data,id:uid('CR'),clientId:chosen.id,clientName:chosen.name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
   save();closeDialog();render();
  }catch(ex){error.textContent=ex.message||'Não foi possível salvar a análise.';}
 });
}
function detail(id){
 if(!canView('credit'))return;
 const r=list().find(x=>x.id===id);if(!r)return alert('Análise não localizada.');
 const customer=clientById(r.clientId),n=numbers(r);
 const entries=[['Data da análise',date(r.date)],['Cliente',nameOf(r)],['CPF/CNPJ',customerDocument(customer)],['Responsável',r.reviewer||'—'],['Valor solicitado',money(r.requested)],['Renda/faturamento mensal',money(r.revenue)],['Compromissos mensais',money(r.obligations)],['Exposição anterior',money(r.exposure)],['Saldo mensal estimado',money(n.balance)],['Comprometimento mensal',n.ratio===null?'Não calculado':n.ratio+'%'],['Exposição total',money(n.total)],['Fonte da consulta externa',r.source||'Não informada'],['Data da consulta externa',date(r.sourceDate)],['Apontamentos informados',r.bureauResult||'Não consultado'],['Parecer',r.status]];
 openDialog('Análise de crédito — '+nameOf(r),
 '<p class="credit-modal-warning">Relatório interno. Nenhuma consulta externa foi realizada pelo aplicativo e nenhum score foi calculado.</p>'
 +'<div class="credit-detail-grid">'+entries.map(([k,v])=>'<div><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('')+'</div>'
 +'<div class="credit-detail-note"><b>Justificativa registrada</b><p>'+esc(r.notes||'Nenhuma observação.').replace(/\n/g,'<br>')+'</p></div>'
 +(canEdit('credit')?'<div class="actions" style="margin-top:16px"><button class="btn primary" onclick="JRSCreditUI.open(\''+esc(r.clientId)+'\',\''+esc(r.id)+'\')">Editar parecer</button></div>':''));
}
function forClient(clientId){
 if(!canView('credit'))return;
 go('credit');
 if(canEdit('credit'))open(clientId);
}
window.JRSCreditUI={render:show,refresh,open,detail,forClient,preview:formLive,setSearch(x){search=x;refresh()},setFilter(x){filter=x;refresh()}};
})();
