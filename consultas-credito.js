/* JRS GUINDASTES — consultas reais de crédito.
 * Tela com um campo CPF/CNPJ. Não exibe scores, protestos ou restrições fictícios.
 * Integração: requer serviço AUTENTICADO no servidor, com contrato de birô de crédito.
 * Quando configurado: window.JRS_CREDIT_PROVIDER_ENABLED===true e rota SAME-ORIGIN
 * POST /api/consultas-credito (o servidor deve exigir sessão autenticada e autorização).
 * Resposta esperada:
 * {provider,consultedAt,score:{value,min,max},protests:{status:"found"|"none"|"unavailable",count?},
 *  restrictions:{status:"found"|"none"|"unavailable",count?}}
 * Um status ausente ou inválido nunca deve ser tratado como ausência de registros.
 * Não guarda CPFs/CNPJs pesquisados nem relatórios de crédito no localStorage.
 */
(function(){
'use strict';
let requestedDocument='';
let currentReport=null;
let currentError='';
let isLoading=false;
const endpoint='/api/consultas-credito';
const enabled=()=>window.JRS_CREDIT_PROVIDER_ENABLED===true;
const normalize=v=>cleanClientDoc(v);
const displayDoc=v=>formatClientDoc(v);
const statusNames={found:'Com registros',none:'Sem registros encontrados',unavailable:'Não disponível no relatório'};
function readCategory(value){
 const state=value&&typeof value==='object'?value.status:null;
 if(!Object.prototype.hasOwnProperty.call(statusNames,state))return {text:'Não informado pelo provedor',kind:'unknown'};
 const count=Number.isInteger(value.count)&&value.count>=0?value.count:null;
 if(state==='found')return {text:'Com registros'+(count!==null?' ('+count+')':''),kind:'negative'};
 if(state==='none')return {text:'Sem registros encontrados',kind:'positive'};
 return {text:statusNames.unavailable,kind:'unknown'};
}
function baseCards(){
 return '<div class="credit-result-grid"><div class="credit-result-card"><small>Score de crédito</small><strong>—</strong><p>Não consultado</p></div>'
 +'<div class="credit-result-card"><small>Protestos</small><strong>—</strong><p>Não consultado</p></div>'
 +'<div class="credit-result-card"><small>Restrições / nome negativado</small><strong>—</strong><p>Não consultado</p></div></div>';
}
function show(){
 if(!canView('credit'))return '<div class="card">Acesso restrito ao cadastro de clientes.</div>';
 const doc=displayDoc(requestedDocument);
 return '<div class="headline"><div><span class="eyebrow">JRS GUINDASTES · CONSULTAS</span><h1>Consulta de crédito</h1><p class="subtitle">Score, protestos e restrições por CPF ou CNPJ.</p></div></div>'
 +'<section class="credit-simple-hero"><div class="credit-hero-eyebrow">CONSULTA DE DOCUMENTO</div><h2>Consulte a situação de crédito.</h2><p>Digite o CPF ou CNPJ para solicitar os dados a um birô de crédito contratado.</p>'
 +'<form id="creditLookupForm" onsubmit="JRSCreditUI.search(event)" class="credit-simple-form"><div class="credit-input-area"><label for="creditDocumentInput">CPF OU CNPJ</label>'
 +'<input id="creditDocumentInput" name="document" type="text" maxlength="18" value="'+esc(doc)+'" placeholder="000.000.000-00 ou 00.000.000/0000-00" autocapitalize="characters" autocomplete="off" spellcheck="false" required oninput="JRSCreditUI.input(this)"></div>'
 +'<button class="btn primary credit-consult-button" type="submit" '+(isLoading?'disabled':'')+'>'+(isLoading?'Consultando...':'Consultar')+'</button></form>'
 +'<div class="credit-privacy-note">Use somente para finalidade autorizada. O aplicativo não envia o documento a terceiros enquanto a integração não estiver habilitada.</div></section>'
 +'<section class="credit-simple-results"><div class="credit-result-header"><div><span class="eyebrow">RESULTADO DA CONSULTA</span><h3>Situação do documento</h3></div>'
 +'<span class="credit-connection-tag '+(enabled()?'connected':'unconnected')+'">'+(enabled()?'Integração configurada':'Integração não conectada')+'</span></div>'
 +'<div id="creditLookupStatus" role="status" aria-live="polite">'+statusHtml()+'</div>'
 +'<div id="creditLookupOutput">'+(currentReport?reportHtml(currentReport):baseCards())+'</div>'
 +'</section>';
}
function statusHtml(){
 if(currentError)return '<div class="credit-action-message credit-message-error">'+esc(currentError)+'</div>';
 if(isLoading)return '<div class="credit-action-message">Solicitando consulta ao provedor de crédito...</div>';
 if(currentReport)return '<div class="credit-action-message credit-message-success">Consulta retornada pelo serviço conectado.</div>';
 if(!enabled())return '<div class="credit-action-message"><b>Ainda não conectado a um birô de crédito.</b> Para ver o score e verificar protestos ou negativações reais, é necessário contratar um relatório que inclua esses dados e conectar a API oficial ao servidor do sistema. Nenhuma pesquisa externa foi realizada.</div>';
 return '<div class="credit-action-message">Informe o CPF ou CNPJ e clique em Consultar.</div>';
}
function reportHtml(data){
 const score=data.score&&typeof data.score==='object'?data.score:null;
 const hasScore=Number.isFinite(score?.value)&&Number.isFinite(score?.min)&&Number.isFinite(score?.max)&&score.max>score.min&&score.value>=score.min&&score.value<=score.max;
 const val=hasScore?score.value:'—';
 const scoreRange=hasScore?'Escala: '+score.min+' a '+score.max:'Score não fornecido pelo serviço';
 const protests=readCategory(data.protests),restrictions=readCategory(data.restrictions);
 const provider=typeof data.provider==='string'?data.provider:'Provedor contratado';
 const time=data.consultedAt&&Number.isFinite(Date.parse(data.consultedAt))?new Date(data.consultedAt).toLocaleString('pt-BR'):'Data não informada';
 const card=(title,value,desc,kind)=>'<div class="credit-result-card '+(kind||'')+'"><small>'+esc(title)+'</small><strong>'+esc(value)+'</strong><p>'+esc(desc)+'</p></div>';
 return '<div class="credit-result-grid">'
 +card('Score de crédito',val,scoreRange,'')
 +card('Protestos',protests.kind==='unknown'?'—':protests.kind==='negative'?'Sim':'Não',protests.text,protests.kind)
 +card('Restrições / nome negativado',restrictions.kind==='unknown'?'—':restrictions.kind==='negative'?'Sim':'Não',restrictions.text,restrictions.kind)
 +'</div><p class="credit-result-source">Fonte: '+esc(provider)+' · Consulta: '+esc(time)+'. A cobertura depende do relatório contratado. Ausência de apontamentos no relatório não equivale a certidão universal de inexistência de dívidas.</p>';
}
function update(){
 const st=document.getElementById('creditLookupStatus');
 const out=document.getElementById('creditLookupOutput');
 if(st)st.innerHTML=statusHtml();
 if(out)out.innerHTML=currentReport?reportHtml(currentReport):baseCards();
 const button=document.querySelector('#creditLookupForm button[type=submit]');
 if(button){button.disabled=isLoading;button.textContent=isLoading?'Consultando...':'Consultar';}
}
function onInput(element){
 element.value=displayDoc(element.value);
 requestedDocument=normalize(element.value);
 currentError='';
 currentReport=null;
 update();
}
async function search(event){
 event.preventDefault();
 if(isLoading)return;
 const input=document.getElementById('creditDocumentInput');
 if(!input)return;
 requestedDocument=normalize(input.value);
 currentReport=null;currentError='';
 if(!clientDocCheck(requestedDocument)){
  currentError='CPF ou CNPJ inválido. Confira o número e os dígitos verificadores.';
  update();return;
 }
 if(!enabled()){
  currentError='Consulta não realizada: o aplicativo ainda não possui uma conexão autorizada com Serasa, SPC ou outro birô. O documento foi validado, mas não foi consultado.';
  update();return;
 }
 isLoading=true;update();
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({document:requestedDocument})});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Acesso não autorizado para consultar crédito.':'Consulta indisponível no provedor. Verifique a integração e o contrato.');
  const body=await response.json();
  if(!body||typeof body!=='object'||(!('score' in body)&&!('protests' in body)&&!('restrictions' in body)))throw Error('O provedor não retornou um relatório válido.');
  currentReport=body;
 }catch(e){currentError=e.message||'Não foi possível concluir a consulta.';}
 finally{isLoading=false;update();}
}
function forClient(id){
 if(!canView('credit'))return;
 const customer=db.clients.find(c=>c.id===id);
 requestedDocument=customer?normalize(clientDocumentOf(customer)):'';
 currentError='';currentReport=null;
 go('credit');
}
window.JRSCreditUI={render:show,search,input:onInput,forClient};
})();
