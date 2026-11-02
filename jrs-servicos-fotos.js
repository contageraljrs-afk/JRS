/* JRS · Imagens de vistorias/manutencoes: IndexedDB local, limite de 12 fotos por registro. */
(function(){
'use strict';
const NAME='jrs-work-media-v1',MAX=12;
let connection=null;const cache=new Map();
function database(){
 if(connection)return connection;
 connection=new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(Error('Este navegador não permite guardar fotos.'));
  const req=indexedDB.open(NAME,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('photos')){const st=db.createObjectStore('photos',{keyPath:'id'});st.createIndex('record','record',{unique:false});}
  };
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Não foi possível acessar as fotos.'));
 });
 return connection;
}
function wait(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Falha ao ler uma foto.'))})}
async function read(record){
 const db=await database(),tx=db.transaction('photos','readonly');
 return (await wait(tx.objectStore('photos').index('record').getAll(record))).sort((a,b)=>a.created-b.created);
}
async function saveOne(item){
 const db=await database();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('photos','readwrite');
  tx.objectStore('photos').put(item);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Erro ao salvar foto.'));
 });
}
async function erase(id){
 const db=await database();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('photos','readwrite');
  tx.objectStore('photos').delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Erro ao remover foto.'));
 });
}
function clear(record){
 const old=cache.get(record);cache.delete(record);
 if(old)old.then(items=>items.forEach(x=>URL.revokeObjectURL(x.url))).catch(()=>{});
}
async function items(record){
 if(cache.has(record))return cache.get(record);
 const promise=read(record).then(rows=>rows.map(row=>({...row,url:URL.createObjectURL(row.blob)}))).catch(err=>{cache.delete(record);throw err});
 cache.set(record,promise);return promise;
}
async function compress(file){
 if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Apenas JPG, PNG ou WebP.');
 if(file.size>16_000_000)throw Error('Cada foto precisa ter no máximo 16 MB.');
 const src=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('Falha ao abrir a foto.'));img.src=src});
  const rate=Math.min(1,1500/img.naturalWidth,1200/img.naturalHeight);
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.naturalWidth*rate));cv.height=Math.max(1,Math.round(img.naturalHeight*rate));
  const ctx=cv.getContext('2d');if(!ctx)throw Error('Não foi possível processar esta imagem.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
  const blob=await new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(Error('Falha ao compactar foto.')),'image/webp',.76));
  if(blob.size>1_600_000)throw Error('Foto ainda muito grande depois da compactação.');
  return blob;
 }finally{URL.revokeObjectURL(src)}
}
async function upload(record,files){
 const list=Array.from(files||[]);
 if(!list.length)return 0;
 const prev=await read(record);
 if(prev.length+list.length>MAX)throw Error('Limite de '+MAX+' fotos por registro.');
 let added=0;
 for(const file of list){
  const blob=await compress(file);
  const id='SV-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
  await saveOne({id,record,blob,created:Date.now()+added,fileName:file.name||'Foto'});
  added++;
 }
 clear(record);return added;
}
async function remove(record,id){
 await erase(id);clear(record);
}
function asData(blob){
 return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(String(f.result));f.onerror=()=>reject(Error('Falha ao preparar foto para PDF.'));f.readAsDataURL(blob)});
}
async function printable(record){
 const photos=await read(record);
 return Promise.all(photos.map(async p=>({src:await asData(p.blob),fileName:p.fileName})));
}
window.JRSWorkPhotos={upload,items,remove,printable,MAX,__test:{read}};
})();