/* JRS GUINDASTES - galeria local de equipamentos, versão 1.
   As imagens permanecem no IndexedDB deste navegador; não são enviadas ao GitHub. */
(function(){
'use strict';
const dbName='jrs-equipment-images-v1';
const limit=10;
let connection=null;
const cache=new Map();
function database(){
 if(connection)return connection;
 connection=new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error('O navegador não permite salvar fotos.'));
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('images')){
    const st=db.createObjectStore('images',{keyPath:'id'});
    st.createIndex('equipment','equipmentId',{unique:false});
   }
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Não foi possível abrir o armazenamento de imagens.'));
 });
 return connection;
}
function request(req){
 return new Promise((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Falha ao ler fotos.'));
 });
}
function write(action){
 return database().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction('images','readwrite');
  try{action(tx.objectStore('images'))}catch(e){tx.abort();return reject(e)}
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||Error('Não foi possível salvar a foto.'));
  tx.onabort=()=>reject(tx.error||Error('Salvamento cancelado.'));
 }));
}
function dropCache(id){
 const old=cache.get(id);
 cache.delete(id);
 if(old)old.then(files=>files.forEach(f=>URL.revokeObjectURL(f.url))).catch(()=>{});
}
function all(id){
 if(cache.has(id))return cache.get(id);
 const p=database().then(async db=>{
  const tx=db.transaction('images','readonly');
  const rows=await request(tx.objectStore('images').index('equipment').getAll(id));
  return rows.sort((a,b)=>a.createdAt-b.createdAt).map(a=>({id:a.id,url:URL.createObjectURL(a.blob)}));
 }).catch(e=>{cache.delete(id);throw e});
 cache.set(id,p);return p;
}
function selectCover(images,coverId){return images.find(x=>x.id===coverId)||images[0]}
async function compress(file){
 if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Selecione foto JPG, PNG ou WebP.');
 if(file.size>16*1024*1024)throw Error('A imagem original deve ter até 16 MB.');
 const source=URL.createObjectURL(file);
 try{
  const im=new Image();
  await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('Falha ao carregar imagem.'));im.src=source});
  const size=Math.min(1,1400/im.naturalWidth,1000/im.naturalHeight);
  const cvs=document.createElement('canvas');
  cvs.width=Math.max(1,Math.floor(im.naturalWidth*size));
  cvs.height=Math.max(1,Math.floor(im.naturalHeight*size));
  const ctx=cvs.getContext('2d');if(!ctx)throw Error('Canvas indisponível.');
  ctx.drawImage(im,0,0,cvs.width,cvs.height);
  const blob=await new Promise((resolve,reject)=>cvs.toBlob(b=>b?resolve(b):reject(Error('Falha na compactação.')),'image/webp',0.76));
  if(blob.size>1500000)throw Error('Imagem ainda muito grande. Tente outra foto.');
  return blob;
 }finally{URL.revokeObjectURL(source)}
}
async function hydrate(coverFn){
 const nodes=[...document.querySelectorAll('[data-eq-photo]')];
 await Promise.all(nodes.map(async node=>{
  const id=node.getAttribute('data-eq-photo');
  try{
   const images=await all(id),selected=selectCover(images,coverFn(id));
   if(!node.isConnected)return;
   let img=node.querySelector('.jrs-card-photo');
   if(!selected){if(img)img.remove();node.classList.remove('jrs-has-photo');return;}
   if(!img){img=document.createElement('img');img.className='jrs-card-photo';img.alt='Foto do equipamento';node.prepend(img)}
   img.src=selected.url;node.classList.add('jrs-has-photo');
  }catch(e){/* mantém a arte ilustrativa se o armazenamento não estiver disponível */}
 }));
}
async function draw(id,getCover,setCover){
 const root=document.getElementById('recordPhotoGallery');
 if(!root)return;
 root.innerHTML='<div class="jrs-photo-head"><div><h3>Fotos do equipamento</h3><small>Adicione até 10 fotos. Escolha a imagem de capa.</small></div><label class="btn primary">＋ Adicionar fotos<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label></div><p class="jrs-photo-help">As fotos ficam guardadas somente neste navegador (modo demonstrativo).</p><div class="jrs-photo-thumbs"></div><p class="jrs-photo-message" role="status"></p>';
 const thumbs=root.querySelector('.jrs-photo-thumbs');
 const info=root.querySelector('.jrs-photo-message');
 const input=root.querySelector('input[type=file]');
 input.addEventListener('change',async()=>{
  const chosen=[...input.files];input.value='';
  if(!chosen.length)return;
  input.disabled=true;info.textContent='Salvando fotos...';
  let count=0;
  try{
   const saved=await all(id);
   if(saved.length+chosen.length>limit)throw Error('Limite de 10 fotos por equipamento. Remova alguma antes de adicionar.');
   for(const file of chosen){
    const blob=await compress(file);
    const photoId='IMG-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
    await write(store=>store.put({id:photoId,equipmentId:id,blob,createdAt:Date.now()+count}));
    count++;
   }
   dropCache(id);
   await draw(id,getCover,setCover);
   const fresh=document.querySelector('.jrs-photo-message');
   if(fresh)fresh.textContent=count+' foto(s) salva(s) neste dispositivo.';
   await hydrate(getCover);
  }catch(e){
   dropCache(id);
   await draw(id,getCover,setCover);
   const fresh=document.querySelector('.jrs-photo-message');
   if(fresh)fresh.textContent=e.message||'Erro ao adicionar fotos.';
  }finally{input.disabled=false}
 });
 try{
  const saved=await all(id);
  if(!root.isConnected)return;
  if(!saved.length){thumbs.innerHTML='<div class="jrs-photo-empty">📷 Nenhuma foto cadastrada. Clique em Adicionar fotos.</div>';return;}
  for(const item of saved){
   const cell=document.createElement('div');cell.className='jrs-photo-thumb';
   const image=document.createElement('img');image.src=item.url;image.alt='Foto cadastrada';cell.appendChild(image);
   const actions=document.createElement('div');actions.className='jrs-photo-actions';
   const main=document.createElement('button');main.type='button';main.className='btn tiny '+(selectCover(saved,getCover(id))?.id===item.id?'primary':'');
   main.textContent=selectCover(saved,getCover(id))?.id===item.id?'✓ Foto principal':'Definir como capa';
   main.onclick=async()=>{setCover(id,item.id);await draw(id,getCover,setCover);await hydrate(getCover)};
   const remove=document.createElement('button');remove.type='button';remove.className='btn tiny';remove.textContent='Remover';
   remove.onclick=async()=>{
    if(!confirm('Remover esta foto do equipamento?'))return;
    try{
     await write(store=>store.delete(item.id));
     if(getCover(id)===item.id)setCover(id,'');
     dropCache(id);await draw(id,getCover,setCover);await hydrate(getCover);
    }catch(e){info.textContent=e.message||'Não foi possível remover a foto.'}
   };
   actions.append(main,remove);cell.appendChild(actions);thumbs.appendChild(cell);
  }
 }catch(e){thumbs.textContent=e.message||'Não foi possível carregar a galeria.'}
}

async function removeAll(equipmentId){
 const db=await database();
 const transaction=db.transaction('images','readonly');
 const keys=await request(transaction.objectStore('images').index('equipment').getAllKeys(equipmentId));
 if(keys.length){await write(store=>{keys.forEach(id=>store.delete(id));});}
 dropCache(equipmentId);
 return keys.length;
}

window.JRSPhotos={hydrate,draw,removeAll};
})();
