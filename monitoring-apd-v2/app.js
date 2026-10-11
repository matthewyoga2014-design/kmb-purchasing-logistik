'use strict';

const cfg=window.KMB_SUPABASE_CONFIG||{};
const db=window.supabase&&cfg.url&&cfg.publishableKey?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const TYPES=['HELM','KAOS','SEPATU'];
const ART={HELM:{label:'Helm Safety',url:'helm.svg'},KAOS:{label:'Kaos Kerja',url:'kaos.svg'},SEPATU:{label:'Sepatu Safety',url:'sepatu.svg'}};
const EMPTY=()=>({stockIn:[],receipts:[],returns:[]});
let state=EMPTY(),revision=0,people=[],page='dashboard',chosen='',user=null,role='',saving=false,term='',siteFilter='ALL';
const el=id=>document.getElementById(id);
const H=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE');
const fmt=s=>s?new Date(String(s)+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
const uid=()=>crypto.randomUUID();
const cleanName=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('id-ID');
const can=()=>role==='owner'||role==='editor';
const arr=x=>Array.isArray(x)?x:[];
const qty=x=>Number(x)||0;
function addMonths(date,months){
 const [y,m,d]=String(date||'').split('-').map(Number);
 if(!y||!m||!d)return '';
 const n=Math.max(1,Math.min(120,Number(months)||6));
 const dt=new Date(y,m-1+n,1),last=new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate();
 dt.setDate(Math.min(d,last));
 return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function daysUntil(d){if(!d)return Infinity;return Math.round((new Date(d+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000)}
function showNotice(message,type){const x=el('notice');if(!x)return;x.innerHTML='<div class="notice '+(type||'')+'">'+H(message)+'</div>';window.scrollTo({top:0,behavior:'smooth'})}
function normalize(v){return {stockIn:arr(v?.stockIn),receipts:arr(v?.receipts),returns:arr(v?.returns)}}
function parsePeople(mp){
 const seen=new Set(),out=[];
 for(const [list,status] of [[arr(mp.mpActive),'AKTIF'],[arr(mp.mpOut),'OUT']]){
  for(const p of list){const name=String(p.Nama||p.nama||'').trim(),id=cleanName(name);
   if(!id||seen.has(id))continue;
   seen.add(id);out.push({id,name,position:String(p.Jabatan||'—'),site:String(p['Tempat Bekerja']||'Belum ditentukan'),status});
  }
 }
 return out.sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
function person(id){return people.find(x=>x.id===id)}
function personName(id){return person(id)?.name||id}
function personSite(id){return person(id)?.site||'—'}
function returnedQty(id,d=state){return arr(d.returns).filter(x=>x.receiptId===id).reduce((a,t)=>a+qty(t.qty),0)}
function heldLot(r,d=state){return Math.max(0,qty(r.qty)-returnedQty(r.id,d))}
function held(id,type,d=state){return arr(d.receipts).filter(r=>r.person===id&&(!type||r.type===type)).reduce((a,r)=>a+heldLot(r,d),0)}
function latest(id,type,d=state){return arr(d.receipts).filter(r=>r.person===id&&r.type===type&&r.source!=='OLD').sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)))[0]}
function due(id,type){const r=latest(id,type);return r?addMonths(r.date,r.months):''}
function stock(type,d=state){
 const v={NEW:0,REUSE:0,DESTROYED:0};
 arr(d.stockIn).filter(x=>x.type===type).forEach(x=>v[x.grade==='REUSE'?'REUSE':'NEW']+=qty(x.qty));
 arr(d.receipts).filter(x=>x.type===type).forEach(x=>{if(x.source==='NEW'||x.source==='REUSE')v[x.source]-=qty(x.qty)});
 arr(d.returns).forEach(x=>{const r=d.receipts.find(y=>y.id===x.receiptId);if(r&&r.type===type){if(x.action==='REUSE')v.REUSE+=qty(x.qty);else if(x.action==='DESTROY')v.DESTROYED+=qty(x.qty)}});
 return v;
}
function labelStatus(s){const color=s==='LAYAK'||s==='AKTIF'?'good':s==='TIDAK LAYAK'||s==='OUT'||s==='MUSNAH'?'bad':s==='BELUM DIPERIKSA'||s==='SEGERA'?'warn':'blue';return '<span class="tag '+color+'">'+H(s)+'</span>'}
function icon(type){return '<div class="art"><img src="'+ART[type].url+'" alt="'+ART[type].label+'"></div>'}
function validate(d){
 for(const x of d.stockIn)if(!TYPES.includes(x.type)||!['NEW','REUSE'].includes(x.grade)||!Number.isInteger(Number(x.qty))||Number(x.qty)<1||!x.date)return 'Tanggal, jenis dan jumlah stok masuk harus valid (minimal 1).';
 for(const x of d.receipts){
  if(!TYPES.includes(x.type)||!['OLD','NEW','REUSE'].includes(x.source)||!Number.isInteger(Number(x.qty))||Number(x.qty)<1||!x.date||!x.person)return 'Data penerimaan APD belum lengkap.';
  if(x.source!=='OLD'&&(!Number.isInteger(Number(x.months))||Number(x.months)<1||Number(x.months)>120))return 'Jatah penggantian harus 1–120 bulan.';
 }
 const back={};
 for(const x of d.returns){
  const r=d.receipts.find(y=>y.id===x.receiptId);
  if(!r||!x.date||x.date<r.date)return 'Tanggal pengembalian tidak valid atau catatan asal tidak ada.';
  if(!['REUSE','DESTROY'].includes(x.action)||!Number.isInteger(Number(x.qty))||Number(x.qty)<1)return 'Jumlah/kondisi pengembalian tidak valid.';
  back[r.id]=(back[r.id]||0)+Number(x.qty);
  if(back[r.id]>Number(r.qty))return 'Jumlah pengembalian melebihi APD yang diterima karyawan.';
 }
 const events=[];
 d.stockIn.forEach(x=>events.push({date:x.date,p:0,type:x.type,grade:x.grade,n:+x.qty}));
 d.returns.filter(x=>x.action==='REUSE').forEach(x=>{const r=d.receipts.find(y=>y.id===x.receiptId);events.push({date:x.date,p:1,type:r.type,grade:'REUSE',n:+x.qty})});
 d.receipts.filter(x=>x.source==='NEW'||x.source==='REUSE').forEach(x=>events.push({date:x.date,p:2,type:x.type,grade:x.source,n:-x.qty}));
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.p-b.p);
 const balances={};TYPES.forEach(t=>balances[t]={NEW:0,REUSE:0});
 for(const x of events){balances[x.type][x.grade]+=x.n;if(balances[x.type][x.grade]<0)return 'Stok '+x.type+' '+(x.grade==='NEW'?'baru':'bekas layak')+' tidak mencukupi pada '+fmt(x.date)+'. APD lama perlu dicatat sebagai kepemilikan karyawan, bukan pengeluaran gudang.'}
 return '';
}

document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
el('mobileMenu').onclick=()=>el('sidebar').classList.toggle('open');
el('authBtn').onclick=()=>user?logout():login();
el('refreshBtn').onclick=()=>loadAll();
el('modalClose').onclick=()=>closeModal();
el('modalBack').onclick=e=>{if(e.target===el('modalBack'))closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
document.addEventListener('input',e=>{
 if(e.target.id==='searchPerson'){
  const focus=e.target,at=focus.selectionStart;
  term=focus.value;render();const inp=el('searchPerson');
  if(inp){inp.focus();inp.setSelectionRange(at,at)}
 }
});
document.addEventListener('change',e=>{if(e.target.id==='filterSite'){siteFilter=e.target.value;render()}});
init();
