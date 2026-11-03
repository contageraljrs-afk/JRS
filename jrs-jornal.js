/* PLATAFORMA DE LOCAÇÕES · jrs-jornal-interno-v1
   Jornal corporativo com publicações e celebrações automáticas do cadastro integrado.
   Não cria aniversários nem avisos fictícios.
*/
(function(){
'use strict';
const TYPES=['Aviso','Dica do RH','Segurança','Comunicado','Evento','Conquista','Endomarketing'];
let articleFilter='Todos';
const E=v=>esc(v??'');
const news=()=>{if(!Array.isArray(db.jrsJournal))db.jrsJournal=[];return db.jrsJournal};
const staff=()=>Array.isArray(db.staff)?db.staff:[];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dateValid=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00');return d.getFullYear()===Number(s.slice(0,4))&&d.getMonth()+1===Number(s.slice(5,7))&&d.getDate()===Number(s.slice(8,10))};
const niceDate=s=>dateValid(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const shortDate=s=>dateValid(s)?s.slice(8,10)+'/'+s.slice(5,7):'—';
const localDay=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const roleNames={Aviso:'AVISO IMPORTANTE','Dica do RH':'DICA DO RH',Segurança:'SEGURANÇA','Comunicado':'COMUNICADO',Evento:'EVENTO',Conquista:'CONQUISTA',Endomarketing:'NOSSA EQUIPE'};
function visibleNews(){
 const current=today();
 return news().filter(p=>p.published&&(!p.publishDate||p.publishDate<=current)&&(!p.expiresOn||p.expiresOn>=current))
 .sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(b.publishDate||b.createdAt||'').localeCompare(a.publishDate||a.createdAt||''));
}
function anniversaryEvents(days=50){
 const now=new Date(),todayDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const end=new Date(todayDate);end.setDate(end.getDate()+days);
 const result=[];
 for(const person of staff()){
  if(person.status==='Inativo'||!person.name)continue;
  for(const config of [{key:'birthDate',type:'birthday'},{key:'hireDate',type:'tenure'}]){
   const when=person[config.key];
   if(!dateValid(when))continue;
   const month=Number(when.slice(5,7))-1,day=Number(when.slice(8,10));
   for(const year of [todayDate.getFullYear(),todayDate.getFullYear()+1]){
    let event=new Date(year,month,day);
    if(month===1&&day===29&&event.getMonth()!==1)event=new Date(year,1,28);
    if(event<todayDate||event>end)continue;
    const years=year-Number(when.slice(0,4));
    if(config.type==='tenure'&&years<1)continue;
    result.push({id:config.type+'-'+person.id+'-'+year,staffId:person.id,name:person.name,role:person.role||'',type:config.type,date:localDay(event),years,daysAway:Math.round((event-todayDate)/86400000)});
    break;
   }
  }
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'pt-BR'));
}
function newsCard(post,full=false){
 const category=roleNames[post.type]||'INTERNO';
 const description=full?post.body:(post.body.length>180?post.body.slice(0,177)+'…':post.body);
 return '<article class="jrs-paper-article"><div class="jrs-paper-article-meta"><span class="jrs-paper-tag '+(post.type==='Aviso'?'urgent':'')+'">'+E(category)+'</span><span>'+niceDate(post.publishDate||post.createdAt?.slice(0,10))+'</span>'+(post.pinned?'<span class="jrs-paper-pin">★ Destaque</span>':'')+'</div><h3>'+E(post.title)+'</h3><p>'+E(description).replace(/\n/g,'<br>')+'</p>'+(full&&canEdit('hr')?'<div class="jrs-paper-article-actions"><button class="btn tiny" onclick="JRSJournal.open(\''+E(post.id)+'\')">Editar</button><button class="btn tiny" onclick="JRSJournal.toggle(\''+E(post.id)+'\')">Despublicar</button><button class="btn tiny jrs-paper-delete" onclick="JRSJournal.remove(\''+E(post.id)+'\')">Excluir</button></div>':'')+'</article>';
}
function eventCard(event){
 return '<div class="jrs-paper-person"><div class="jrs-paper-person-icon">'+(event.type==='birthday'?'🎂':'🏅')+'</div><div><b>'+E(event.name)+'</b><small>'+E(event.type==='birthday'?'Aniversário · '+shortDate(event.date):event.years+' ano'+(event.years>1?'s':'')+' de empresa · '+shortDate(event.date))+'</small></div>'+(event.daysAway===0?'<span class="jrs-paper-today">Hoje</span>':'')+'</div>';
}
function home(){
 const current=today(),posts=visibleNews(),events=anniversaryEvents(40);
 const birthdays=events.filter(e=>e.type==='birthday').slice(0,4);
 const tenures=events.filter(e=>e.type==='tenure').slice(0,4);
 const lead=posts[0],rest=posts.slice(1,4);
 return '<section class="jrs-paper-home" aria-label="Mural interno da empresa">'
 +'<div class="jrs-paper-masthead"><div class="jrs-paper-wordmark"><span>COMUNICAÇÃO INTERNA · EDIÇÃO '+current.slice(0,7).replace('-','/')+'</span><h2>MURAL <strong>INTERNO</strong></h2><p>Gente, conquistas, segurança e novidades da nossa equipe.</p></div><div class="jrs-paper-mast-right"><span>'+new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})+'</span><button type="button" class="btn" onclick="go(\'jornal\')">Ler jornal completo ↗</button></div></div>'
 +'<div class="jrs-paper-main-grid"><div class="jrs-paper-lead"><span class="jrs-paper-overline">EM DESTAQUE</span>'+(lead?newsCard(lead,false):'<div class="jrs-paper-lead-empty"><h3>Novidades da equipe</h3><p>O mural reúne avisos, dicas de RH e segurança, aniversários e conquistas de quem faz parte da nossa história.</p>'+(canEdit('hr')?'<button class="btn" onclick="JRSJournal.open()">＋ Publicar primeiro aviso</button>':'')+'</div>')+
 (rest.length?'<div class="jrs-paper-briefs">'+rest.map(p=>'<span><b>'+E(p.type)+'</b> '+E(p.title)+'</span>').join('')+'</div>':'')+
 '</div><div class="jrs-paper-celebrations"><div class="jrs-paper-birthday"><div class="jrs-paper-subhead"><span>🎉</span><h3>Aniversariantes</h3><small>Próximos 40 dias</small></div>'+(birthdays.length?birthdays.map(eventCard).join(''):'<p class="jrs-paper-empty">Nenhum aniversário informado para os próximos dias.</p>')+'</div><div class="jrs-paper-tenure"><div class="jrs-paper-subhead"><span>🏆</span><h3>Tempo de empresa</h3></div>'+(tenures.length?tenures.map(eventCard).join(''):'<p class="jrs-paper-empty">Cadastre as datas de admissão no RH para celebrar a equipe.</p>')+'</div></div></div>'
 +'<div class="jrs-paper-bottom"><span><b>EM FOCO</b> · Avisos, dicas, conquistas e segurança para todos.</span><button type="button" onclick="go(\'jornal\')">Ver todas as publicações ↗</button></div></section>';
}
function page(){
 if(!canView('jornal'))return '<div class="card">Você não possui acesso ao Mural interno.</div>';
 const all=visibleNews().filter(p=>articleFilter==='Todos'||p.type===articleFilter),drafts=news().filter(p=>!p.published);
 const birthdays=anniversaryEvents(50).filter(e=>e.type==='birthday');
 const tenures=anniversaryEvents(50).filter(e=>e.type==='tenure');
 return '<div class="jrs-paper-page"><div class="jrs-paper-page-head"><div><span class="jrs-paper-overline">COMUNICAÇÃO INTERNA · PLATAFORMA DE LOCAÇÕES</span><h1>Mural interno</h1><p>Notícias da empresa, dicas, avisos e reconhecimento da nossa equipe.</p></div>'+(canEdit('hr')?'<button class="btn primary" onclick="JRSJournal.open()">＋ Nova publicação</button>':'')+'</div>'
 +'<div class="jrs-paper-page-cards"><div class="card"><b>'+all.length+'</b><small>Publicações disponíveis</small></div><div class="card"><b>'+birthdays.length+'</b><small>Aniversários próximos</small></div><div class="card"><b>'+tenures.length+'</b><small>Aniversários de empresa</small></div></div>'
 +'<div class="jrs-paper-page-columns"><section><div class="jrs-paper-list-header"><h2>Publicações</h2><select onchange="JRSJournal.filter(this.value)"><option>Todos</option>'+TYPES.map(t=>'<option '+(articleFilter===t?'selected':'')+'>'+E(t)+'</option>').join('')+'</select></div>'
 +(all.length?all.map(x=>newsCard(x,true)).join(''):'<div class="jrs-paper-none">Nenhum aviso publicado nesta categoria.'+(canEdit('hr')?' Clique em Nova publicação para começar.':'')+'</div>')+
 (canEdit('hr')&&drafts.length?'<div class="jrs-paper-drafts"><h3>Rascunhos / despublicados</h3>'+drafts.map(x=>'<div><b>'+E(x.title)+'</b><button class="btn tiny" onclick="JRSJournal.open(\''+E(x.id)+'\')">Editar</button><button class="btn tiny" onclick="JRSJournal.toggle(\''+E(x.id)+'\')">Publicar</button></div>').join('')+'</div>':'')+'</section>'
 +'<aside><div class="jrs-paper-aside-card"><h3>🎂 Aniversários</h3>'+(birthdays.length?birthdays.map(eventCard).join(''):'<p class="jrs-paper-empty">Sem datas cadastradas para os próximos dias.</p>')+'</div>'
 +'<div class="jrs-paper-aside-card"><h3>🏅 Tempo de empresa</h3>'+(tenures.length?tenures.map(eventCard).join(''):'<p class="jrs-paper-empty">As datas de admissão aparecem aqui após o cadastro no RH.</p>')+'</div></aside></div>'
 +'<p class="jrs-paper-disclaimer">As datas comemorativas são calculadas a partir dos colaboradores cadastrados. A publicação de dados pessoais deve respeitar as regras e autorizações internas de comunicação.</p></div>';
}
function open(id){
 if(!requireEdit('hr'))return;
 const existing=id?news().find(x=>x.id===id):null;
 if(id&&!existing)return alert('Publicação não encontrada.');
 const x=existing||{};
 openDialog(existing?'Editar notícia · Mural interno':'Nova publicação · Mural interno',
 '<form id="jrs-paper-form" class="form-grid">'
 +'<div class="field"><label for="paper-type">Categoria</label><select id="paper-type" name="type">'+TYPES.map(t=>'<option '+((x.type||'Aviso')===t?'selected':'')+'>'+E(t)+'</option>').join('')+'</select></div>'
 +'<div class="field"><label for="paper-date">Publicar a partir de</label><input id="paper-date" name="publishDate" type="date" value="'+E(x.publishDate||today())+'" required></div>'
 +'<div class="field span2"><label for="paper-title">Título *</label><input id="paper-title" name="title" maxlength="125" required value="'+E(x.title||'')+'" placeholder="Ex.: Informativo do RH / Aviso para equipe"></div>'
 +'<div class="field span2"><label for="paper-body">Mensagem *</label><textarea id="paper-body" name="body" maxlength="3500" rows="6" required placeholder="Escreva o comunicado, dica ou informação...">'+E(x.body||'')+'</textarea></div>'
 +'<div class="field"><label for="paper-expire">Retirar do mural após (opcional)</label><input id="paper-expire" name="expiresOn" type="date" value="'+E(x.expiresOn||'')+'"></div>'
 +'<div class="field jrs-paper-checkboxes"><label><input type="checkbox" name="pinned" '+(x.pinned?'checked':'')+'> Fixar como destaque</label><label><input type="checkbox" name="published" '+(x.published||!existing?'checked':'')+'> Publicar no Mural interno</label></div>'
 +'<div class="span2" id="paper-error" role="alert"></div><div class="span2 actions"><button class="btn primary" type="submit">Salvar publicação</button><button class="btn" type="button" onclick="closeDialog()">Cancelar</button></div></form>');
 document.getElementById('jrs-paper-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const data=Object.fromEntries(new FormData(event.target));
   data.title=String(data.title||'').trim();data.body=String(data.body||'').trim();
   data.pinned=data.pinned==='on';data.published=data.published==='on';
   if(!TYPES.includes(data.type))throw Error('Categoria inválida.');
   if(data.title.length<3||data.body.length<4)throw Error('Informe título e mensagem.');
   if(!dateValid(data.publishDate)||(data.expiresOn&&!dateValid(data.expiresOn)))throw Error('Data de publicação ou validade inválida.');
   if(data.expiresOn&&data.expiresOn<data.publishDate)throw Error('A data de retirada não pode ser anterior à publicação.');
   const target=existing||{id:uid('JORNAL'),createdAt:new Date().toISOString()};
   Object.assign(target,data,{updatedAt:new Date().toISOString()});
   if(!existing)news().push(target);
   save();closeDialog();render();
  }catch(err){document.getElementById('paper-error').textContent=err.message||'Não foi possível salvar.'}
 });
}
function toggle(id){
 if(!requireEdit('hr'))return;
 const x=news().find(x=>x.id===id);if(!x)return;
 x.published=!x.published;x.updatedAt=new Date().toISOString();save();render();
}
function remove(id){
 if(!requireEdit('hr'))return;
 const x=news().find(x=>x.id===id);if(!x)return;
 if(!confirm('Excluir definitivamente a publicação "'+x.title+'"?'))return;
 db.jrsJournal=news().filter(x=>x.id!==id);save();render();
}
window.JRSJournal={home,page,open,toggle,remove,filter(v){articleFilter=v;render()},__test:{visibleNews,anniversaryEvents,news,shortDate,today}};
})();