/* JRS GUINDASTES — consultas reais de crédito.
 * Tela com um campo CPF/CNPJ. Não exibe scores, protestos ou restrições fictícios.
 * Integração: requer serviço AUTENTICADO no servidor, com contrato de birô de crédito.
 * Quando configurado: backend autenticado na mesma origem.
 * GET /api/consultas-credito/status responde {provider:'Assertiva',enabled:true,auth:'server'}.
 * As credenciais Assertiva devem permanecer só no servidor.
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
/* jrs-assertiva-integration-ui-v1 */
let backendEnabled=false;
const enabled=()=>backendEnabled;
async function refreshProvider(){
 try {
  const r=await fetch('/api/consultas-credito/status',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(r.ok){
   const status=await r.json();
   backendEnabled=status?.enabled===true&&status?.provider==='Assertiva'&&status?.auth==='server';
  }
 }catch(_){backendEnabled=false}
 update();
}
Promise.resolve().then(refreshProvider);
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
 return '<div class="headline"><div><span class="eyebrow">JRS GUINDASTES · ASSERTIVA ANÁLISE 360</span><h1>Consultas de crédito</h1><p class="subtitle">Score, protestos e restrições por CPF/CNPJ via Assertiva.</p></div></div>'
 +'<section class="credit-simple-hero"><div class="credit-hero-eyebrow">ASSERTIVA · ANÁLISE 360</div><h2>Consulta de score e restrições.</h2><p>Insira o CPF ou CNPJ para consultar informações da Assertiva quando a integração da JRS estiver autorizada e ativa.</p>'
 +'<form id="creditLookupForm" onsubmit="JRSCreditUI.search(event)" class="credit-simple-form"><div class="credit-input-area"><label for="creditDocumentInput">CPF OU CNPJ</label>'
 +'<input id="creditDocumentInput" name="document" type="text" maxlength="18" value="'+esc(doc)+'" placeholder="000.000.000-00 ou 00.000.000/0000-00" autocapitalize="characters" autocomplete="off" spellcheck="false" required oninput="JRSCreditUI.input(this)"></div>'
 +'<button class="btn primary credit-consult-button" type="submit" '+(isLoading?'disabled':'')+'>'+(isLoading?'Consultando...':'Consultar')+'</button></form>'
 +'<div class="credit-privacy-note">Consulta sujeita às permissões da conta Assertiva e à finalidade de uso autorizada. Nenhum dado é enviado ao provedor sem a conexão autenticada.</div></section>'
 +'<section class="credit-provider-access"><div><small>PROVEDOR DE CRÉDITO</small><b>Assertiva Análise 360</b><p>Já tem acesso? Consulte pelo portal oficial enquanto a API do aplicativo não estiver conectada.</p></div><a href="https://painel.assertivasolucoes.com.br/" target="_blank" rel="noopener noreferrer" class="btn credit-provider-link">Acessar painel Assertiva ↗</a></section>'
 +'<section class="credit-simple-results"><div class="credit-result-header"><div><span class="eyebrow">RESULTADO DA CONSULTA</span><h3>Situação do documento</h3></div>'
 +'<span class="credit-connection-tag '+(enabled()?'connected':'unconnected')+'">'+(enabled()?'API Assertiva conectada':'API Assertiva pendente')+'</span></div>'
 +'<div id="creditLookupStatus" role="status" aria-live="polite">'+statusHtml()+'</div>'
 +'<div id="creditLookupOutput">'+(currentReport?reportHtml(currentReport):baseCards())+'</div>'
 +'</section>';
}
function statusHtml(){
 if(currentError)return '<div class="credit-action-message credit-message-error">'+esc(currentError)+'</div>';
 if(isLoading)return '<div class="credit-action-message">Solicitando consulta ao provedor de crédito...</div>';
 if(currentReport)return '<div class="credit-action-message credit-message-success">Consulta retornada pelo serviço conectado.</div>';
 if(!enabled())return '<div class="credit-action-message"><b>A API Assertiva ainda não está conectada à JRS.</b> Para consultar aqui dentro, a empresa precisa ter acesso ao produto Análise 360 e ativar as credenciais no servidor. Se já possui conta, utilize acima o botão Acessar painel Assertiva. Nenhuma consulta de CPF/CNPJ foi realizada pelo aplicativo.</div>';
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
 const badge=document.querySelector('.credit-connection-tag');
 if(badge){badge.className='credit-connection-tag '+(enabled()?'connected':'unconnected');badge.textContent=enabled()?'API Assertiva conectada':'API Assertiva pendente'}
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
  currentError='Consulta não realizada: a API Assertiva ainda não foi conectada à JRS. O documento foi validado, mas não houve consulta de score, protestos ou restrições. Use o acesso ao painel oficial acima.';
  update();return;
 }
 isLoading=true;update();
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({document:requestedDocument})});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Acesso não autorizado para consultar crédito.':'Consulta indisponível no provedor. Verifique a integração e o contrato.');
  const body=await response.json();
  if(!body||typeof body!=='object'||body.provider!=='Assertiva'||!('score' in body)||!('protests' in body)||!('restrictions' in body))throw Error('O relatório Assertiva não tem o formato esperado para esta integração.');
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
