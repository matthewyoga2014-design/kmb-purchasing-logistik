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


async function loadPeople(){
 const {data,error}=await db.from('app_state_public').select('data').eq('app_id','kmb').single();
 if(error)throw Error('Tidak dapat memuat karyawan KMB: '+error.message);
 people=parsePeople(data.data||{});
}
async function loadApd(){
 const {data,error}=await db.from('apd_state').select('data,revision').eq('id','main').single();
 if(error)throw Error('Tidak dapat memuat Monitoring APD: '+error.message);
 state=normalize(data.data);revision=Number(data.revision)||0;
}
async function loadAll(){
 if(!user||!role)return;
 try{await Promise.all([loadPeople(),loadApd()]);render()}catch(e){showNotice(e.message,'error')}
}
async function findRole(){
 if(!user){role='';render();return}
 const {data,error}=await db.from('app_access_roles').select('role').eq('app_id','apd').eq('email',user.email.toLowerCase()).maybeSingle();
 if(error){role='';showNotice('Gagal memeriksa akses: '+error.message,'error')}
 else{role=data?.role||'';if(!role)showNotice('Akun belum diberi akses Monitoring APD. Hubungi pemilik.','error')}
 render();
}
async function init(){
 if(!db){el('app').innerHTML='<div class="empty">Konfigurasi Supabase belum tersedia.</div>';return}
 try{
  const {data,error}=await db.auth.getSession();if(error)throw error;
  user=data.session?.user||null;
  if(user){await findRole();if(role)await loadAll()}else render();
  db.auth.onAuthStateChange((event,session)=>{
   const next=session?.user||null;
   if(next?.id!==user?.id){user=next;role='';if(user)findRole().then(()=>{if(role)loadAll()});else{state=EMPTY();people=[];render()}}
  });
 }catch(e){showNotice('Login bermasalah: '+e.message,'error');render()}
}
async function login(){
 if(!db)return;
 const email=prompt('Email akun KMB:');if(!email)return;
 const password=prompt('Password akun KMB:');if(!password)return;
 const {error}=await db.auth.signInWithPassword({email:email.trim(),password});
 if(error)return showNotice('Gagal masuk: '+error.message,'error');
 const {data}=await db.auth.getUser();user=data.user;
 await findRole();if(role)await loadAll();
}
async function logout(){if(db)await db.auth.signOut();user=null;role='';state=EMPTY();people=[];page='dashboard';render()}
async function persist(next,message){
 if(!can()||saving)return showNotice('Hanya Owner/Editor dapat menyimpan data.','error');
 const issue=validate(next);if(issue)return showNotice('Tidak dapat menyimpan: '+issue,'error');
 saving=true;
 try{
  const {data,error}=await db.from('apd_state').update({data:next,revision:revision+1,updated_at:new Date().toISOString(),updated_by:user.email}).eq('id','main').eq('revision',revision).select('revision');
  if(error)throw error;
  if(!data?.length)throw Error('Ada perubahan dari perangkat lain. Tekan Sinkronkan lalu ulangi.');
  state=next;revision=Number(data[0].revision);
  closeModal();render();showNotice(message||'Data berhasil disimpan.','success');
 }catch(e){showNotice('Gagal simpan: '+e.message,'error');await loadAll()}
 finally{saving=false}
}
function navigate(v){page=v;chosen='';term='';siteFilter='ALL';el('sidebar').classList.remove('open');render()}
function openPerson(id){chosen=id;page='detail';render()}
function heading(eyebrow,name,description,buttons){
 return '<div class="head"><div><span class="eyebrow">'+H(eyebrow)+'</span><h2>'+H(name)+'</h2><p>'+H(description)+'</p></div>'+(buttons||'')+'</div>';
}
function render(){
 el('roleText').textContent=role?(role==='owner'?'Pemilik':role==='editor'?'Editor':'Pelihat'):'Belum Masuk';
 el('userText').textContent=user?.email||'';
 el('authBtn').textContent=user?'Keluar':'Masuk';
 el('accessNav').hidden=role!=='owner';
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===page||(page==='detail'&&n.dataset.page==='people')));
 if(!user||!role){
  el('pageTitle').textContent='Monitoring APD KMB';
  el('app').innerHTML=heading('MONITORING SYSTEM','Monitoring APD KMB','Mengikuti daftar karyawan Monitoring Manpower KMB.')+'<section class="panel" style="max-width:650px;margin:34px auto;text-align:center;padding:43px 25px"><div style="font-size:50px">🪖 &nbsp; 👕 &nbsp; 🥾</div><h2>Pengelolaan APD Karyawan</h2><p class="muted" style="line-height:1.8">Kelola APD lama, stok gudang, jadwal penggantian dan pengembalian saat resign. Masuk menggunakan akun KMB.</p><button class="btn dark" onclick="login()">Masuk Akun KMB</button></section>';return;
 }
 if(page==='dashboard'){el('pageTitle').textContent='Dashboard Monitoring APD';el('app').innerHTML=dashboard()}
 else if(page==='people'||page==='out'){el('pageTitle').textContent=page==='people'?'Manpower Aktif':'Manpower Keluar';el('app').innerHTML=peoplePage(page==='out')}
 else if(page==='detail'){const p=person(chosen);el('pageTitle').textContent='Detail APD · '+(p?.name||'');el('app').innerHTML=p?detailPage(p):'<div class="empty">Karyawan tidak ditemukan; silakan sinkronkan.</div>'}
 else if(page==='stock'){el('pageTitle').textContent='Stok APD Gudang';el('app').innerHTML=stockPage()}
 else if(page==='history'){el('pageTitle').textContent='Riwayat Transaksi APD';el('app').innerHTML=historyPage()}
 else if(page==='guide'){el('pageTitle').textContent='Tata Cara';el('app').innerHTML=guidePage()}
 else if(page==='access'){el('pageTitle').textContent='Pengaturan Akses';el('app').innerHTML=accessPage()}
}
function schedules(){
 const result=[];
 for(const p of people.filter(x=>x.status==='AKTIF'))for(const t of TYPES){
  const x=latest(p.id,t);
  if(!x||held(p.id,t)<1)continue;
  const d=addMonths(x.date,x.months);
  result.push({p,t,x,d,days:daysUntil(d)});
 }
 return result.sort((a,b)=>a.d.localeCompare(b.d));
}
function dashboard(){
 const totalHeld=people.reduce((a,p)=>a+held(p.id),0);
 const warehouse=TYPES.reduce((a,t)=>{const s=stock(t);return a+s.NEW+s.REUSE},0);
 const list=schedules(),overdue=list.filter(x=>x.days<=0).length,soon=list.filter(x=>x.days>0&&x.days<=30).length;
 const metrics=[['Total Stok Gudang',warehouse,'APD siap dibagikan','▤','#2865b5','#e9f0fd'],['APD Dipegang',totalHeld,'Termasuk APD lama','♙','#158257','#e7f7ef'],['Jatuh Tempo',overdue,'Perlu penggantian APD','!','#c93c4b','#fdecef'],['Ganti ≤ 30 Hari',soon,'Jadwal mendekat','◷','#c88822','#fff1d9']];
 const cards='<div class="kpis">'+metrics.map(m=>'<div class="card metric" style="--accent:'+m[4]+';--symbg:'+m[5]+'"><div><small>'+m[0]+'</small><b>'+m[1]+'</b><p>'+m[2]+'</p></div><span class="sym">'+m[3]+'</span></div>').join('')+'</div>';
 const products='<div class="cards3">'+TYPES.map(t=>{const s=stock(t);return '<div class="card product">'+icon(t)+'<div><span class="eyebrow">PERLENGKAPAN APD</span><h3>'+ART[t].label+'</h3><div class="big">'+(s.NEW+s.REUSE)+'</div><small>Baru '+s.NEW+' · Bekas layak '+s.REUSE+'</small></div></div>'}).join('')+'</div>';
 const maximum=Math.max(1,...TYPES.map(t=>{const s=stock(t);return s.NEW+s.REUSE+people.reduce((a,p)=>a+held(p.id,t),0)}));
 const bars=TYPES.map(t=>{const s=stock(t),owned=people.reduce((a,p)=>a+held(p.id,t),0),val=s.NEW+s.REUSE;return '<div class="progress-row"><b>'+ART[t].label+'</b><div><div class="bar"><span style="width:'+(val/maximum*100)+'%"></span></div><div class="bar" style="margin-top:6px"><span class="yellow" style="width:'+(owned/maximum*100)+'%"></span></div></div><b>'+val+' / '+owned+'</b></div>'}).join('');
 const dueRows=list.slice(0,8).map(x=>'<tr><td><button class="link" onclick="openPerson(\''+H(x.p.id)+'\')">'+H(x.p.name)+'</button></td><td>'+x.t+'</td><td>'+fmt(x.x.date)+'</td><td>'+fmt(x.d)+'</td><td>'+labelStatus(x.days<=0?'JATUH TEMPO':x.days<=30?'SEGERA':'TERJADWAL')+'</td></tr>').join('')||'<tr><td colspan="5" class="muted">Belum ada jadwal penggantian. Jadwal dibuat saat karyawan menerima APD baru/bekas dari gudang.</td></tr>';
 return heading('OVERVIEW','Dashboard Monitoring APD','Memantau stok, kepemilikan, dan jadwal penggantian APD secara otomatis.','<div class="date-pill">● '+fmt(today())+'</div>')+cards+products+
 '<div class="twocol"><section class="panel"><div class="section-head"><div><h3>Monitoring Stok & APD Karyawan</h3><p>Grafik atas: stok gudang · Bawah: jumlah dipegang karyawan</p></div></div>'+bars+'<div class="flex wrap"><span class="tag blue">■ Stok Gudang</span><span class="tag warn">■ Dipegang Karyawan</span></div></section>'+
 '<section class="panel"><div class="section-head"><div><h3>Ringkasan Pengelolaan</h3><p>Data terhubung dengan Manpower KMB</p></div></div><div class="stat-row"><div class="mini-stat"><small>Aktif</small><b>'+people.filter(x=>x.status==='AKTIF').length+'</b></div><div class="mini-stat"><small>Keluar</small><b>'+people.filter(x=>x.status==='OUT').length+'</b></div><div class="mini-stat"><small>Riwayat Lama</small><b>'+state.receipts.filter(x=>x.source==='OLD').length+'</b></div><div class="mini-stat"><small>Dimusnahkan</small><b>'+state.returns.filter(x=>x.action==='DESTROY').reduce((a,x)=>a+qty(x.qty),0)+'</b></div></div><div class="notice">APD lama hanya dicatat sebagai stok yang dipegang karyawan. <b>Tidak mengurangi stok gudang dan tidak menentukan jatah penggantian.</b></div><button class="btn dark" onclick="navigate(\'people\')">Kelola APD Karyawan →</button></section></div>'+
 '<section class="panel" style="margin-top:18px"><div class="section-head"><div><h3>Jadwal Penggantian APD</h3><p>Perhitungan menggunakan penerimaan terbaru.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Karyawan</th><th>APD</th><th>Terakhir Diterima</th><th>Jatah Ganti</th><th>Status</th></tr></thead><tbody>'+dueRows+'</tbody></table></div></section>';
}
function renderPeopleRows(out){
 const source=people.filter(p=>p.status===(out?'OUT':'AKTIF'));
 const current=source.filter(p=>(siteFilter==='ALL'||p.site===siteFilter)&&(!term||(p.name+' '+p.position+' '+p.site).toLowerCase().includes(term.toLowerCase())));
 return current.map(p=>'<tr><td><button class="link" onclick="openPerson(\''+H(p.id)+'\')">'+H(p.name)+'</button><div class="muted">'+H(p.position)+'</div></td><td>'+H(p.site)+'</td><td>'+labelStatus(p.status)+'</td>'+TYPES.map(t=>'<td><b>'+held(p.id,t)+'</b><div class="muted">'+(due(p.id,t)?fmt(due(p.id,t)):'Belum dijadwalkan')+'</div></td>').join('')+'<td><button class="btn slim dark" onclick="openPerson(\''+H(p.id)+'\')">Detail & Edit</button></td></tr>').join('')||'<tr><td colspan="7">Tidak ada karyawan yang cocok.</td></tr>';
}
function peoplePage(out){
 const source=people.filter(x=>x.status===(out?'OUT':'AKTIF')),sites=[...new Set(source.map(p=>p.site))].sort();
 return heading('DATABASE',out?'Manpower Keluar & Pengembalian':'Manpower Aktif & Kepemilikan APD',out?'Periksa dan catat APD yang dikembalikan saat resign.':'Klik nama karyawan untuk mencatat APD lama atau membagikan APD baru.')+
 '<section class="panel"><div class="section-head"><div><h3>Data Manpower KMB ('+source.length+')</h3><p>Nama, jabatan, jobsite, dan status langsung mengikuti Monitoring Manpower KMB.</p></div></div><div class="row-tools"><input id="searchPerson" placeholder="Cari nama, jabatan, jobsite…" value="'+H(term)+'"><select id="filterSite"><option value="ALL">Semua Jobsite</option>'+sites.map(x=>'<option value="'+H(x)+'" '+(siteFilter===x?'selected':'')+'>'+H(x)+'</option>').join('')+'</select><button class="btn" onclick="loadAll()">↻ Sinkronkan Manpower</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Nama & Jabatan</th><th>Jobsite</th><th>Status</th><th>Helm</th><th>Kaos</th><th>Sepatu</th><th>Aksi</th></tr></thead><tbody id="personRows">'+renderPeopleRows(out)+'</tbody></table></div></section>';
}


function detailPage(p){
 const pieces=TYPES.map(t=>{
  const lots=state.receipts.filter(x=>x.person===p.id&&x.type===t).sort((a,b)=>b.date.localeCompare(a.date));
  const latestDist=latest(p.id,t),lastDate=due(p.id,t),oldStock=lots.filter(x=>x.source==='OLD').reduce((a,x)=>a+heldLot(x),0);
  const rows=lots.map(r=>{
   const remain=heldLot(r);
   const back=state.returns.filter(x=>x.receiptId===r.id);
   const source=r.source==='OLD'?'APD LAMA':r.source==='NEW'?'APD BARU':'APD BEKAS LAYAK';
   const history=back.map(x=>'<small>↳ '+fmt(x.date)+' · '+x.qty+' unit '+(x.action==='REUSE'?'dikembalikan layak → stok bekas':'tidak layak → musnah')+(can()?'<button class="btn slim" onclick="editReturn(\''+H(x.id)+'\')">Edit</button>':'')+'</small>').join('');
   return '<div class="lot"><div style="flex:1"><strong>'+source+' · '+fmt(r.date)+' · '+r.qty+' unit '+labelStatus(r.condition||'BELUM DIPERIKSA')+'</strong><small>Masih dimiliki: <b>'+remain+' unit</b>'+(r.source==='OLD'?' · APD lama tidak menjadi acuan tanggal ganti':' · Jatah '+r.months+' bulan · Jadwal '+fmt(addMonths(r.date,r.months)))+'</small><small>'+H(r.note||'')+'</small>'+history+'</div><div class="toolbarend">'+(can()?'<button class="btn slim" onclick="receiptForm(\''+H(p.id)+'\',\''+t+'\',\''+H(r.id)+'\')">✎ Edit APD</button>':'')+(can()&&p.status==='OUT'&&remain>0?'<button class="btn slim dark" onclick="returnForm(\''+H(r.id)+'\')">↩ Pengembalian</button>':'')+'</div></div>';
  }).join('')||'<div class="notice">Belum ada riwayat. Gunakan Catat APD Lama untuk APD yang telah dimiliki, atau Bagikan APD untuk stok gudang.</div>';
  return '<section class="panel" style="margin-bottom:16px"><div class="section-head"><div><h3>'+(t==='HELM'?'🪖':t==='KAOS'?'👕':'🥾')+' '+ART[t].label+'</h3><p>Dipegang '+held(p.id,t)+' unit · Stok lama '+oldStock+' unit</p></div><div class="toolbarend">'+(can()?'<button class="btn slim" onclick="receiptForm(\''+H(p.id)+'\',\''+t+'\',\'\',\'OLD\')">+ Catat APD Lama</button><button class="btn slim dark" onclick="receiptForm(\''+H(p.id)+'\',\''+t+'\',\'\',\'NEW\')">+ Tambah APD</button>':'')+'</div></div>'+
  '<div class="stat-row"><div class="mini-stat"><small>Total Dipegang</small><b>'+held(p.id,t)+'</b></div><div class="mini-stat"><small>Stok APD Lama</small><b>'+oldStock+'</b></div><div class="mini-stat"><small>Terakhir Terima Baru/Bekas</small><b style="font-size:13px">'+fmt(latestDist?.date)+'</b></div><div class="mini-stat"><small>Jadwal Ganti</small><b style="font-size:13px">'+fmt(lastDate)+'</b></div></div><div class="lot-list">'+rows+'</div></section>';
 }).join('');
 return '<div class="flex between wrap" style="margin-bottom:13px"><button class="btn" onclick="navigate(\''+(p.status==='OUT'?'out':'people')+'\')">← Kembali</button><button class="btn" onclick="loadAll()">↻ Sinkronkan</button></div><div class="personhero"><span class="eyebrow" style="color:#f4d56b">DETAIL APD KARYAWAN</span><h2>'+H(p.name)+'</h2><p>'+H(p.position)+' · '+H(p.site)+' · '+p.status+'</p><p>Jumlah APD dipegang: <b>'+held(p.id)+' unit</b>. '+(p.status==='OUT'?'Periksa APD yang dikembalikan saat resign.':'APD lama dan distribusi gudang dikelola terpisah.')+'</p></div>'+pieces;
}
function stockPage(){
 const cards='<div class="cards3">'+TYPES.map(t=>{const x=stock(t);return '<div class="card product">'+icon(t)+'<div><h3>'+ART[t].label+'</h3><div class="big">'+(x.NEW+x.REUSE)+'</div><small>Baru '+x.NEW+' · Bekas layak '+x.REUSE+' · Musnah '+x.DESTROYED+'</small></div></div>'}).join('')+'</div>';
 const rows=[...state.stockIn].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>'<tr><td>'+fmt(x.date)+'</td><td>'+x.type+'</td><td>'+labelStatus(x.grade==='NEW'?'BARU':'LAYAK')+'</td><td><b>'+x.qty+'</b></td><td>'+H(x.location||'Gudang')+'</td><td>'+H(x.note||'—')+'</td><td>'+(can()?'<button class="btn slim" onclick="stockForm(\''+H(x.id)+'\')">✎ Edit Stok</button>':'–')+'</td></tr>').join('')||'<tr><td colspan="7">Belum ada stok masuk. Stok awal 0; input manual ketika barang diterima gudang.</td></tr>';
 return heading('INVENTORY','Stok APD Gudang','Stok gudang terpisah dari APD lama milik karyawan.',can()?'<button class="btn dark" onclick="stockForm()">+ Tambah Stok Masuk</button>':'')+cards+
 '<div class="notice">APD yang <b>sudah dipakai karyawan</b> dicatat melalui Manpower → Detail → Catat APD Lama. Jangan masukkan ke stok gudang.</div><section class="panel"><div class="section-head"><h3>Riwayat Stok Masuk</h3><button class="btn" onclick="loadAll()">↻ Sinkronkan</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kondisi</th><th>Qty</th><th>Gudang</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function historyPage(){
 const rows=[];
 state.stockIn.forEach(x=>rows.push({date:x.date,type:x.type,label:x.grade==='NEW'?'STOK BARU MASUK':'STOK BEKAS MASUK',count:x.qty,name:x.location||'Gudang',call:"stockForm('"+H(x.id)+"')"}));
 state.receipts.forEach(x=>rows.push({date:x.date,type:x.type,label:x.source==='OLD'?'APD LAMA':x.source==='NEW'?'TERIMA BARU':'TERIMA BEKAS',count:x.qty,name:personName(x.person),call:"receiptForm('"+H(x.person)+"','"+x.type+"','"+H(x.id)+"')"}));
 state.returns.forEach(x=>{const r=state.receipts.find(a=>a.id===x.receiptId);if(r)rows.push({date:x.date,type:r.type,label:x.action==='REUSE'?'KEMBALI LAYAK':'DIMUSNAHKAN',count:x.qty,name:personName(r.person),call:"editReturn('"+H(x.id)+"')"})});
 rows.sort((a,b)=>b.date.localeCompare(a.date));
 return heading('AUDIT TRAIL','Riwayat Monitoring APD','Riwayat stok, penerimaan lama, distribusi, dan pengembalian.','<button class="btn" onclick="backup()">⇩ Backup Data</button>')+'<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Aktivitas</th><th>Jumlah</th><th>Karyawan / Gudang</th><th>Aksi</th></tr></thead><tbody>'+(rows.map(x=>'<tr><td>'+fmt(x.date)+'</td><td>'+x.type+'</td><td>'+x.label+'</td><td>'+x.count+'</td><td>'+H(x.name)+'</td><td>'+(can()?'<button class="btn slim" onclick="'+x.call+'">✎ Edit</button>':'–')+'</td></tr>').join('')||'<tr><td colspan="6">Belum ada transaksi.</td></tr>')+'</tbody></table></div></section>';
}
function guidePage(){
 const guides=[
 ['1. Sinkronkan Manpower','Daftar karyawan aktif, keluar, jabatan, dan jobsite otomatis diambil dari Monitoring Manpower KMB.'],
 ['2. Catat APD Lama','Buka Manpower → karyawan → Catat APD Lama. Isi kapan APD dahulu diterima, jumlah yang masih dipegang, dan kondisi layak/tidak layak. Tidak perlu stok gudang.'],
 ['3. Tambah Stok Gudang','Buka Stok APD → Tambah Stok Masuk. Stok awal 0, catat barang yang benar-benar tersedia, baik baru maupun bekas layak.'],
 ['4. Tambah APD kepada Karyawan','Buka detail karyawan → Tambah APD. Pilih baru/bekas layak, tanggal penerimaan, jumlah dan jatah ganti dalam bulan. Stok gudang otomatis berkurang.'],
 ['5. Jadwal Penggantian Otomatis','Jadwal = tanggal penerimaan baru/bekas terakhir + jatah penggantian bulan. APD lama tetap stok karyawan dan tidak menentukan jadwal ganti.'],
 ['6. Karyawan Keluar','Jika status OUT dari Manpower KMB, klik Pengembalian pada riwayat. Pilih layak pakai untuk dikembalikan sebagai stok bekas atau tidak layak untuk dimusnahkan.'],
 ['7. Salah Input','Klik Edit pada stok masuk, APD lama, APD baru, atau pengembalian. Sistem menolak perubahan yang membuat saldo menjadi negatif.']
 ];
 return heading('PANDUAN','Tata Cara Monitoring APD','Dibuat sederhana dan terpisah antara milik karyawan dan stok gudang.')+'<section class="panel">'+guides.map(x=>'<div class="guide-step"><strong>'+x[0]+'</strong><p>'+x[1]+'</p></div>').join('')+'</section>';
}
function accessPage(){
 if(role!=='owner')return '<div class="empty">Hanya Owner.</div>';
 return heading('SECURITY','Pengaturan Akses','Akses APD terpisah dari Monitoring Manpower KMB.')+'<section class="panel"><h3>Tambahkan Editor / Viewer</h3><form onsubmit="addRole(event)"><div class="formgrid"><label>Email Pengguna<input name="email" type="email" required placeholder="email akun KMB"></label><label>Peran<select name="role"><option value="editor">Editor — input dan edit</option><option value="viewer">Viewer — hanya melihat</option></select></label></div><div class="formactions"><button class="btn dark" type="submit">Simpan Akses</button></div></form><p class="muted">Akun email harus sudah terdaftar di sistem login KMB. Pengaturan ini tidak mengubah akses Manpower.</p></section>';
}


function modal(title,body){
 el('modalTitle').textContent=title;el('modalBody').innerHTML=body;el('modalBack').hidden=false;
}
function closeModal(){el('modalBack').hidden=true;el('modalBody').innerHTML=''}
function formButtons(label){return '<div class="formactions"><button class="btn" type="button" onclick="closeModal()">Batal</button><button class="btn dark" type="submit">'+H(label)+'</button></div>'}
function stockForm(id){
 if(!can())return;
 const x=state.stockIn.find(t=>t.id===id)||{date:today(),type:'HELM',grade:'NEW',qty:1,location:'',note:''};
 modal(id?'Edit Stok Gudang':'Tambah Stok Masuk','<div class="notice">Hanya untuk barang yang ada di gudang. <b>APD lama yang dimiliki karyawan tidak dicatat sebagai stok gudang.</b></div><form onsubmit="saveStock(event,\''+H(id||'')+'\')"><div class="formgrid"><label>Tanggal Stok Masuk<input name="date" type="date" required value="'+H(x.date)+'"></label><label>Jenis APD<select name="type">'+TYPES.map(t=>'<option '+(x.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Kondisi Stok<select name="grade"><option value="NEW" '+(x.grade==='NEW'?'selected':'')+'>Barang Baru</option><option value="REUSE" '+(x.grade==='REUSE'?'selected':'')+'>Barang Bekas Layak (Stok Awal)</option></select></label><label>Jumlah Unit<input name="qty" type="number" min="1" step="1" required value="'+x.qty+'"></label><label>Lokasi Gudang<input name="location" value="'+H(x.location||'')+'"></label><label>Keterangan<input name="note" value="'+H(x.note||'')+'"></label></div>'+formButtons(id?'Simpan Perubahan Stok':'Simpan Stok Masuk')+'</form>');
}
function saveStock(e,id){
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),next=structuredClone(state);
 const value={id:id||uid(),date:f.date,type:f.type,grade:f.grade,qty:Number(f.qty),location:f.location,note:f.note};
 if(id){const i=next.stockIn.findIndex(x=>x.id===id);if(i<0)return showNotice('Transaksi stok tidak ditemukan.','error');next.stockIn[i]=value}
 else next.stockIn.push(value);
 persist(next,'Stok APD berhasil disimpan. Dashboard diperbarui.');
}
function receiptForm(personId,type,id,defaultSource){
 if(!can())return;
 const p=person(personId);
 if(!p)return showNotice('Karyawan tidak ditemukan. Tekan Sinkronkan.','error');
 const r=state.receipts.find(x=>x.id===id)||{person:personId,type,date:today(),qty:1,source:defaultSource||'OLD',condition:'BELUM DIPERIKSA',months:6,note:''};
 modal(id?'Edit Penerimaan · '+p.name:(r.source==='OLD'?'Catat APD Lama · ':'Tambah APD · ')+p.name,
 '<div class="notice"><b>APD LAMA:</b> Sudah dimiliki karyawan, tidak mengurangi gudang dan tidak membuat jadwal ganti. <b>APD BARU / BEKAS:</b> Diambil dari gudang, stok berkurang dan jadwal ganti otomatis.</div>'+
 '<form onsubmit="saveReceipt(event,\''+H(id||'')+'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(p.name)+'"><input type="hidden" name="person" value="'+H(p.id)+'"></label><label>Jobsite<input readonly value="'+H(p.site)+'"></label>'+
 '<label>Jenis APD<select name="type">'+TYPES.map(t=>'<option '+(r.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
 '<label>Asal APD<select name="source" id="receiptSource" onchange="receiptMode()"><option value="OLD" '+(r.source==='OLD'?'selected':'')+'>APD Lama yang Sudah Dimiliki</option><option value="NEW" '+(r.source==='NEW'?'selected':'')+'>APD Baru dari Gudang</option><option value="REUSE" '+(r.source==='REUSE'?'selected':'')+'>APD Bekas Layak dari Gudang</option></select></label>'+
 '<label>Tanggal Diterima<input name="date" type="date" required value="'+H(r.date)+'"></label><label>Jumlah yang Diterima<input name="qty" type="number" min="1" step="1" required value="'+r.qty+'"></label>'+
 '<label>Kondisi APD Saat Ini<select name="condition"><option '+(r.condition==='BELUM DIPERIKSA'?'selected':'')+'>BELUM DIPERIKSA</option><option '+(r.condition==='LAYAK'?'selected':'')+'>LAYAK</option><option '+(r.condition==='TIDAK LAYAK'?'selected':'')+'>TIDAK LAYAK</option></select></label>'+
 '<label id="monthsWrap">Jatah Penggantian (bulan)<input name="months" type="number" min="1" max="120" step="1" value="'+(r.months||6)+'"><span class="muted" style="font-size:10px">Tanggal penerimaan + jumlah bulan = jatah penggantian.</span></label>'+
 '<label class="wide">Keterangan / Bukti<input name="note" value="'+H(r.note||'')+'"></label></div><div class="notice" id="receiptHint"></div>'+formButtons(id?'Simpan Perubahan APD':'Simpan Penerimaan APD')+'</form>');
 receiptMode();
}
function receiptMode(){
 const old=el('receiptSource')?.value==='OLD';
 const m=el('monthsWrap'),hint=el('receiptHint');
 if(m)m.hidden=old;
 if(hint)hint.innerHTML=old?'APD lama menjadi <b>stok milik karyawan</b>, tanpa perlu stok gudang. Kondisi dan tanggal tetap dapat diedit.':'Stok gudang akan <b>dikurangi</b> sesuai jumlah penerimaan. Jadwal penggantian dihitung otomatis.';
}
function saveReceipt(e,id){
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),next=structuredClone(state);
 const value={id:id||uid(),person:f.person,type:f.type,date:f.date,qty:Number(f.qty),source:f.source,months:f.source==='OLD'?0:Number(f.months||6),condition:f.condition,note:f.note};
 if(id){const i=next.receipts.findIndex(x=>x.id===id);if(i<0)return showNotice('Riwayat APD tidak ditemukan.','error');next.receipts[i]=value}
 else next.receipts.push(value);
 persist(next,'Penerimaan APD tersimpan. Jumlah yang dimiliki karyawan dan jadwal ganti diperbarui.');
}
function returnForm(receiptId){
 if(!can())return;
 const r=state.receipts.find(x=>x.id===receiptId),p=person(r?.person);
 if(!r||!p)return;
 if(p.status!=='OUT')return showNotice('Pengembalian karena resign dilakukan setelah status karyawan OUT pada Monitoring Manpower KMB.','error');
 const left=heldLot(r);
 if(left<1)return showNotice('Semua unit APD dari catatan ini sudah diproses.','error');
 modal('Pengembalian APD · '+p.name,
 '<div class="notice"><b>LAYAK:</b> Stok APD bekas layak bertambah dan bisa dibagikan lagi. <b>TIDAK LAYAK:</b> Barang dicatat dimusnahkan, tidak menambah stok.</div>'+
 '<form onsubmit="saveReturn(event,\''+H(r.id)+'\',\'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(p.name)+'"></label><label>APD<input readonly value="'+r.type+'"></label>'+
 '<label>Tanggal Kembali<input name="date" type="date" required min="'+H(r.date)+'" value="'+today()+'"></label>'+
 '<label>Jumlah Kembali (maks '+left+')<input name="qty" type="number" min="1" max="'+left+'" step="1" required value="'+left+'"></label>'+
 '<label>Kondisi Pemeriksaan<select name="action"><option value="REUSE">LAYAK — Masuk Gudang Bekas Layak</option><option value="DESTROY">TIDAK LAYAK — Musnahkan</option></select></label>'+
 '<label>Keterangan<input name="note" placeholder="Hasil pemeriksaan"></label></div>'+formButtons('Simpan Pengembalian')+'</form>');
}
function editReturn(id){
 if(!can())return;
 const x=state.returns.find(a=>a.id===id),r=state.receipts.find(a=>a.id===x?.receiptId);
 if(!x||!r)return;
 modal('Edit Pengembalian APD','<div class="notice">Koreksi transaksi pengembalian sebelumnya. Saldo gudang akan dihitung ulang.</div>'+
 '<form onsubmit="saveReturn(event,\''+H(r.id)+'\',\''+H(x.id)+'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(personName(r.person))+'"></label><label>APD<input readonly value="'+r.type+'"></label>'+
 '<label>Tanggal Kembali<input name="date" type="date" min="'+H(r.date)+'" value="'+H(x.date)+'" required></label>'+
 '<label>Jumlah Kembali<input name="qty" type="number" min="1" step="1" value="'+x.qty+'" required></label>'+
 '<label>Kondisi Pemeriksaan<select name="action"><option value="REUSE" '+(x.action==='REUSE'?'selected':'')+'>LAYAK — Gudang Bekas Layak</option><option value="DESTROY" '+(x.action==='DESTROY'?'selected':'')+'>TIDAK LAYAK — Musnahkan</option></select></label>'+
 '<label>Keterangan<input name="note" value="'+H(x.note||'')+'"></label></div>'+formButtons('Simpan Perubahan Pengembalian')+'</form>');
}
function saveReturn(e,receiptId,id){
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),next=structuredClone(state);
 const value={id:id||uid(),receiptId,date:f.date,qty:Number(f.qty),action:f.action,note:f.note};
 if(id){const i=next.returns.findIndex(x=>x.id===id);if(i<0)return showNotice('Data kembali tidak ditemukan.','error');next.returns[i]=value}else next.returns.push(value);
 persist(next,'Pengembalian disimpan. APD layak menjadi stok bekas, dan APD tidak layak tercatat dimusnahkan.');
}
async function addRole(e){
 e.preventDefault();if(role!=='owner')return;
 const d=Object.fromEntries(new FormData(e.target));
 if(d.email.trim().toLowerCase()===user.email.toLowerCase()&&d.role!=='owner')return showNotice('Hak pemilik tidak boleh diturunkan.','error');
 const {error}=await db.from('app_access_roles').upsert({app_id:'apd',email:d.email.trim().toLowerCase(),role:d.role},{onConflict:'app_id,email'});
 if(error)showNotice('Gagal menambahkan akses: '+error.message,'error');else{e.target.reset();showNotice('Hak akses Monitoring APD berhasil disimpan.','success')}
}
function backup(){
 const blob=new Blob([JSON.stringify({date:today(),state},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Backup_APD_KMB_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
