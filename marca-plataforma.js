/* Plataforma de Locações · personalização da marca (interface, não dados de clientes).
   Preserva as chaves de armazenamento e a base demonstrativa já existentes. */
(function(){
'use strict';
const KEY='equipment_rental_platform_brand_v1';
const defaults={systemName:'Gestão de Locações',companyName:'',tagline:'Tecnologia para locação de equipamentos',logo:''};
let editingImage=null;
const maxImageBytes=5*1024*1024;
function read(){
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'null');
  if(v&&typeof v==='object'&&!Array.isArray(v))return {
   systemName:typeof v.systemName==='string'&&v.systemName.trim()?v.systemName.slice(0,70):defaults.systemName,
   companyName:typeof v.companyName==='string'?v.companyName.slice(0,110):'',
   tagline:typeof v.tagline==='string'?v.tagline.slice(0,110):defaults.tagline,
   logo:typeof v.logo==='string'&&/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v.logo)&&v.logo.length<=650000?v.logo:''
  };
 }catch(_){}
 return {...defaults};
}
let state=read();
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const by=id=>document.getElementById(id);
function name(){return state.systemName||defaults.systemName}
function company(){return state.companyName||'Empresa locadora'}
function tagline(){return state.tagline||defaults.tagline}
function logoData(){return state.logo||''}
function apply(){
 if(typeof document==='undefined')return;
 document.title=name()+' | Plataforma de Locação de Equipamentos';
 document.documentElement.style.setProperty('--platform-name',JSON.stringify(name()));
 document.body?.classList.toggle('has-platform-logo',!!state.logo);
 document.querySelectorAll('.platform-brand-name').forEach(el=>el.textContent=name());
 document.querySelectorAll('.platform-brand-tagline').forEach(el=>el.textContent=tagline());
 document.querySelectorAll('.platform-company-name').forEach(el=>el.textContent=company());
 document.querySelectorAll('.jrs-official-logo').forEach(el=>{
  if(state.logo){el.src=state.logo;el.alt='Logotipo '+name();el.hidden=false;}
  else{el.removeAttribute('src');el.hidden=true;el.alt='';}
 });
 const icon=by('platform-favicon')||document.createElement('link');
 if(!icon.id){icon.id='platform-favicon';icon.rel='icon';document.head.appendChild(icon)}
 if(state.logo){icon.href=state.logo;}
 else icon.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#222923"/><path d="M14 42h36M20 42V22h24v20M20 27h24M25 20l7-8 7 8" fill="none" stroke="#f2c32c" stroke-width="4" stroke-linecap="round"/></svg>');
 // Compatibilidade com geração de documentos existentes.
 window.JRS_LOGO_NORMAL_PNG=state.logo||'';
 window.JRS_LOGO_SIDEBAR_PNG=state.logo||'';
}
function panel(){
 return '<div class="card platform-settings" style="margin-bottom:18px"><div class="platform-settings-heading"><div><span class="eyebrow">IDENTIDADE VISUAL DO SOFTWARE</span><h3>Minha marca</h3><p>Configure o nome e o logotipo do seu próprio sistema de locação de equipamentos, sem alterar os cadastros existentes.</p></div><span class="pill">PERSONALIZÁVEL</span></div>'+
 '<div class="platform-brand-preview"><div class="platform-preview-art" id="platform-preview-art">'+
 (state.logo?'<img src="'+state.logo+'" alt="Prévia do logotipo">':'<span>'+esc(name())+'</span>')+'</div><div><b id="platform-preview-name">'+esc(name())+'</b><small id="platform-preview-tagline">'+esc(tagline())+'</small></div></div>'+
 '<div class="form-grid">'+
 '<div class="field"><label for="platform-name">Nome do sistema *</label><input id="platform-name" maxlength="70" value="'+esc(name())+'" placeholder="Digite o nome da sua plataforma"></div>'+
 '<div class="field"><label for="platform-company">Empresa locadora (em propostas e OS)</label><input id="platform-company" maxlength="110" value="'+esc(state.companyName)+'" placeholder="Nome da empresa que utiliza o sistema"></div>'+
 '<div class="field span2"><label for="platform-tagline">Slogan / descrição da plataforma</label><input id="platform-tagline" maxlength="110" value="'+esc(tagline())+'" placeholder="Tecnologia para locação de equipamentos"></div>'+
 '<div class="field span2"><label for="platform-logo-file">Logotipo da plataforma</label><input id="platform-logo-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="PlatformBrand.pickLogo(this)" aria-describedby="platform-logo-note"><small id="platform-logo-note">PNG transparente recomendado. Também aceita JPG e WebP; até 5 MB por arquivo. O sistema reduz o tamanho antes de salvar.</small></div>'+
 '</div><div class="actions platform-brand-actions"><button class="btn primary" type="button" onclick="PlatformBrand.save()">Salvar marca</button><button class="btn" type="button" onclick="PlatformBrand.clearLogo()">Remover logotipo</button></div>'+
 '<div id="platform-brand-status" role="status" class="platform-brand-status"></div><p class="platform-brand-limitation">A personalização é salva <b>somente neste navegador</b>. Para usar a mesma marca e compartilhar dados entre clientes/dispositivos, será necessário configurar armazenamento e autenticação no servidor.</p></div>';
}
function setStatus(text,error){
 const el=by('platform-brand-status');if(!el)return;el.textContent=text;el.style.color=error?'#af3333':'#236342';
}
function preview(){
 const preview=by('platform-preview-art');if(!preview)return;
 preview.replaceChildren();
 const value=editingImage===null?state.logo:editingImage;
 if(value){
  const img=document.createElement('img');img.src=value;img.alt='Prévia do logotipo';preview.appendChild(img);
 }else{
  const span=document.createElement('span');span.textContent=by('platform-name')?.value.trim()||defaults.systemName;preview.appendChild(span);
 }
 if(by('platform-preview-name'))by('platform-preview-name').textContent=by('platform-name')?.value.trim()||defaults.systemName;
 if(by('platform-preview-tagline'))by('platform-preview-tagline').textContent=by('platform-tagline')?.value.trim()||defaults.tagline;
}
async function pickLogo(input){
 const file=input.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setStatus('Use uma imagem PNG, JPG ou WebP.',true);return;}
 if(file.size>maxImageBytes){setStatus('Arquivo muito grande. O limite é 5 MB.',true);return;}
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise((res,rej)=>{image.onload=res;image.onerror=()=>rej(Error('Não foi possível abrir a imagem.'));image.src=url;});
  const maxWidth=760,maxHeight=330;
  let scale=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight),result='';
  for(let i=0;i<4;i++){
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext('2d');if(!context)throw Error('Erro ao preparar o logotipo.');
   context.drawImage(image,0,0,canvas.width,canvas.height);
   result=canvas.toDataURL('image/webp',0.82-i*0.08);
   if(result.length<500000)break;
   scale*=0.75;
  }
  if(result.length>=500000)throw Error('O logotipo ficou grande demais. Tente uma imagem mais simples.');
  editingImage=result;preview();
  setStatus('Logotipo preparado. Clique em “Salvar marca” para aplicar.',false);
 }catch(error){setStatus(error.message||'Erro ao carregar o logotipo.',true)}
 finally{URL.revokeObjectURL(url);input.value='';}
}
function clearLogo(){
 editingImage='';
 preview();
 setStatus('Logotipo removido da prévia. Clique em “Salvar marca” para confirmar.',false);
}
function save(){
 if(window.JRSAccess&&typeof window.JRSAccess.canEdit==='function'&&!window.JRSAccess.canEdit('settings')){
  setStatus('Seu perfil não tem permissão para alterar as configurações.',true);return;
 }
 const systemName=by('platform-name')?.value.trim()||'';
 const companyName=by('platform-company')?.value.trim()||'';
 const taglineValue=by('platform-tagline')?.value.trim()||'';
 if(systemName.length<2||systemName.length>70){setStatus('Informe o nome do sistema (2 a 70 caracteres).',true);return}
 if(companyName.length>110||taglineValue.length>110){setStatus('Nome ou slogan muito extenso.',true);return}
 const newState={systemName,companyName,tagline:taglineValue,logo:editingImage===null?state.logo:editingImage};
 try{
  localStorage.setItem(KEY,JSON.stringify(newState));
  state=newState;editingImage=null;apply();setStatus('Identidade visual salva neste navegador.',false);
 }catch(e){setStatus('Não foi possível salvar. O armazenamento local pode estar cheio. Use um logotipo menor.',true)}
}
window.PlatformBrand={name,company,tagline,logoData,apply,panel,pickLogo,clearLogo,save,__test:{read,preview,defaults,settingsKey:KEY}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);
else apply();
})();