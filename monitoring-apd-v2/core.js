'use strict';
const CONFIG=window.KMB_SUPABASE_CONFIG||{}, db=window.supabase&&CONFIG.url&&CONFIG.publishableKey?window.supabase.createClient(CONFIG.url,CONFIG.publishableKey):null;
const TYPES=['HELM','KAOS','SEPATU'], PICS={HELM:'helm.svg',KAOS:'kaos.svg',SEPATU:'sepatu.svg'}, ICONS={HELM:'🪖',KAOS:'👕',SEPATU:'🥾'};
const EMPTY=()=>({stockIn:[],receipts:[],returns:[]});
let state=EMPTY(),revision=0,people=[],page='dashboard',chosen='',user=null,role='',term='',siteFilter='ALL',saving=false;
const el=id=>document.getElementById(id);
const H=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE'),uid=()=>crypto.randomUUID(),arr=x=>Array.isArray(x)?x:[];
const fmt=d=>d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
const key=x=>String(x||'').trim().replace(/\s+/g,' ').toUpperCase();
const can=()=>role==='owner'||role==='editor', person=k=>people.find(p=>p.id===k);
const n=x=>Number(x)||0;
function monthsAfter(date,num){if(!date)return '';let [y,m,d]=date.split('-').map(Number);if(!y||!m||!d)return '';let a=new Date(y,m-1+Number(num),1);let max=new Date(a.getFullYear(),a.getMonth()+1,0).getDate();a.setDate(Math.min(d,max));return a.getFullYear()+'-'+String(a.getMonth()+1).padStart(2,'0')+'-'+String(a.getDate()).padStart(2,'0')}
function days(d){return d?Math.round((new Date(d+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000):999999}
function notice(msg,cls){el('notice').innerHTML='<div class="notice '+(cls||'')+'">'+H(msg)+'</div>'}
function parseData(d){return {stockIn:arr(d?.stockIn),receipts:arr(d?.receipts),returns:arr(d?.returns)}}
function buildPeople(raw){let found=new Set(),out=[];for(const [records,status] of [[arr(raw.mpActive),'AKTIF'],[arr(raw.mpOut),'OUT']])for(const x of records){const name=String(x.Nama||'').trim(),id=key(name);if(!id||found.has(id))continue;found.add(id);out.push({id,name,position:String(x.Jabatan||'—'),site:String(x['Tempat Bekerja']||'Belum ditentukan'),status})}return out.sort((a,b)=>a.name.localeCompare(b.name,'id'))}
function returnsFor(id,d=state){return arr(d.returns).filter(x=>x.receiptId===id).reduce((s,x)=>s+n(x.qty),0)}
function held(r,d=state){return Math.max(0,n(r.qty)-returnsFor(r.id,d))}
function owned(pid,type,d=state){return arr(d.receipts).filter(r=>r.person===pid&&(!type||r.type===type)).reduce((a,r)=>a+held(r,d),0)}
function lastIssued(pid,type){return state.receipts.filter(r=>r.person===pid&&r.type===type&&r.source!=='OLD'&&held(r)>0).sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)))[0]}
function nextDue(pid,type){const x=lastIssued(pid,type);return x?monthsAfter(x.date,x.months):''}
function stock(type,d=state){const v={NEW:0,REUSE:0,destroyed:0};d.stockIn.filter(x=>x.type===type).forEach(x=>v[x.grade==='REUSE'?'REUSE':'NEW']+=n(x.qty));d.receipts.filter(x=>x.type===type&&(x.source==='NEW'||x.source==='REUSE')).forEach(x=>v[x.source]-=n(x.qty));d.returns.forEach(x=>{const receipt=d.receipts.find(r=>r.id===x.receiptId);if(receipt?.type===type){if(x.action==='REUSE')v.REUSE+=n(x.qty);else if(x.action==='DESTROY')v.destroyed+=n(x.qty)}});return v}
function validate(d){
 for(const x of d.stockIn)if(!TYPES.includes(x.type)||!['NEW','REUSE'].includes(x.grade)||!x.date||!Number.isInteger(n(x.qty))||n(x.qty)<1)return 'Periksa tanggal, jenis, kondisi, dan jumlah stok masuk.';
 for(const x of d.receipts){if(!TYPES.includes(x.type)||!['OLD','NEW','REUSE'].includes(x.source)||!x.date||!x.person||!Number.isInteger(n(x.qty))||n(x.qty)<1)return 'Isi data penerimaan APD dengan benar.';if(x.source!=='OLD'&&(!Number.isInteger(n(x.months))||n(x.months)<1||n(x.months)>120))return 'Jatah penggantian harus antara 1–120 bulan.'}
 const used={};for(const r of d.returns){const x=d.receipts.find(t=>t.id===r.receiptId);if(!x||!r.date||r.date<x.date||!['REUSE','DESTROY'].includes(r.action)||!Number.isInteger(n(r.qty))||n(r.qty)<1)return 'Periksa transaksi pengembalian APD.';used[x.id]=(used[x.id]||0)+n(r.qty);if(used[x.id]>n(x.qty))return 'Jumlah pengembalian melebihi APD yang pernah diterima.'}
 const ev=[];d.stockIn.forEach(x=>ev.push({date:x.date,type:x.type,grade:x.grade,qty:n(x.qty),priority:0}));d.returns.filter(x=>x.action==='REUSE').forEach(x=>{const r=d.receipts.find(t=>t.id===x.receiptId);ev.push({date:x.date,type:r.type,grade:'REUSE',qty:n(x.qty),priority:1})});d.receipts.filter(x=>x.source!=='OLD').forEach(x=>ev.push({date:x.date,type:x.type,grade:x.source,qty:-n(x.qty),priority:2}));ev.sort((a,b)=>a.date.localeCompare(b.date)||a.priority-b.priority);
 const balances={};TYPES.forEach(t=>balances[t]={NEW:0,REUSE:0});for(const x of ev){balances[x.type][x.grade]+=x.qty;if(balances[x.type][x.grade]<0)return 'Stok '+x.type+' '+(x.grade==='NEW'?'baru':'bekas layak')+' tidak cukup pada '+fmt(x.date)+'. Gunakan Catat APD Lama untuk penerimaan historis.'}
 return '';
}
function flag(x){let c=x==='LAYAK'?'good':x==='TIDAK LAYAK'||x==='OUT'?'bad':x==='BELUM DIPERIKSA'?'warn':'blue';return '<span class="tag '+c+'">'+H(x)+'</span>'}
async function loadAll(){
 if(!user||!role)return;
 try{const [a,b]=await Promise.all([db.from('app_state_public').select('data').eq('app_id','kmb').single(),db.from('apd_state').select('data,revision').eq('id','main').single()]);if(a.error)throw a.error;if(b.error)throw b.error;people=buildPeople(a.data.data||{});state=parseData(b.data.data);revision=Number(b.data.revision);render()}catch(e){notice('Sinkronisasi gagal: '+e.message,'error')}
}
async function checkRole(){if(!user)return;const {data,error}=await db.from('app_access_roles').select('role').eq('app_id','apd').eq('email',user.email).maybeSingle();role=error?'':data?.role||'';if(!role)notice('Akun belum memiliki akses APD. Hubungi pemilik.','error');render()}
async function login(){const email=prompt('Email akun KMB:');if(!email)return;const password=prompt('Password akun KMB:');if(!password)return;const {error}=await db.auth.signInWithPassword({email:email.trim(),password});if(error)return notice('Login gagal: '+error.message,'error');const {data}=await db.auth.getUser();user=data.user;await checkRole();await loadAll()}
async function logout(){await db.auth.signOut();user=null;role='';people=[];state=EMPTY();page='dashboard';render()}
async function init(){if(!db){el('app').innerHTML='<div class="empty">Konfigurasi database tidak tersedia.</div>';return}const {data}=await db.auth.getUser();user=data.user;if(user){await checkRole();await loadAll()}else render()}
async function persist(next,message){
 if(!can()||saving)return notice('Akun tidak berhak mengedit atau sedang menyimpan.','error');
 const err=validate(next);if(err)return notice(err,'error');saving=true;
 try{const {data,error}=await db.from('apd_state').update({data:next,revision:revision+1,updated_at:new Date().toISOString(),updated_by:user.email}).eq('id','main').eq('revision',revision).select('revision');if(error)throw error;if(!data?.length)throw Error('Ada perubahan dari perangkat lain. Sinkronkan sebelum mengedit lagi.');state=next;revision=Number(data[0].revision);closeModal();render();notice(message||'Data berhasil disimpan.','success')}catch(e){notice('Gagal menyimpan: '+e.message,'error');await loadAll()}finally{saving=false}
}
function navigate(x){page=x;chosen='';term='';siteFilter='ALL';el('sidebar').classList.remove('open');render()}
function openPerson(id){chosen=id;page='detail';render()}
function showModal(title,body){el('modalTitle').textContent=title;el('modalBody').innerHTML=body;el('modalBack').hidden=false}
function closeModal(){el('modalBack').hidden=true;el('modalBody').innerHTML=''}
function buttons(title){return '<div class="formactions"><button type="button" class="btn" onclick="closeModal()">Batal</button><button class="btn dark" type="submit">'+title+'</button></div>'}
function downloadBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='APD_KMB_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
