'use strict';

const cfg=window.KMB_SUPABASE_CONFIG||{};
const db=window.supabase&&cfg.url&&cfg.publishableKey?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const TYPES=['HELM','KAOS','SEPATU'];
const VARIANTS={HELM:['Putih','Kuning','Biru'],KAOS:['S','M','L','XL'],SEPATU:['6','7','8','9','10']};
const variant=x=>x.variant||'BELUM DIISI';
const vLabel=t=>t==='HELM'?'Warna Helm (All Size)':t==='KAOS'?'Ukuran Kaos':'Ukuran Sepatu';
const vOptions=(t,v)=>'<option value="">Pilih '+vLabel(t)+'</option>'+VARIANTS[t].map(z=>'<option value="'+z+'" '+(z===v?'selected':'')+'>'+z+'</option>').join('')+(v==='BELUM DIISI'?'<option value="BELUM DIISI" selected>Belum diisi (data lama)</option>':'');
const vForm=(t,v)=>'<label id="variantWrap">'+vLabel(t)+'<select name="variant" id="apdVariant" required>'+vOptions(t,v)+'</select></label>';
function syncVariant(){const t=el('apdTypeSelect')?.value,x=el('apdVariant'),w=el('variantWrap');if(!x)return;w.firstChild.textContent=vLabel(t);x.innerHTML=vOptions(t,'')}
function variantStocks(t,d=state){const z={};[...VARIANTS[t],'BELUM DIISI'].forEach(v=>z[v]={NEW:0,REUSE:0});d.stockIn.filter(x=>x.type===t).forEach(x=>z[variant(x)][x.grade]+=qty(x.qty));d.receipts.filter(x=>x.type===t&&(x.source==='NEW'||x.source==='REUSE')).forEach(x=>z[variant(x)][x.source]-=qty(x.qty));d.returns.filter(x=>x.action==='REUSE').forEach(x=>{const r=d.receipts.find(y=>y.id===x.receiptId);if(r?.type===t)z[variant(r)].REUSE+=qty(x.qty)});return z}

const ART={HELM:{label:'Helm Safety',url:'helm.svg'},KAOS:{label:'Kaos Kerja',url:'kaos.svg'},SEPATU:{label:'Sepatu Safety',url:'sepatu.svg'}};
const EMPTY=()=>({stockIn:[],receipts:[],returns:[],limits:{HELM:0,KAOS:0,SEPATU:0},images:{},personOverrides:{}});
let editingDashboardLayout=false,layoutDraft=null;
const DASH_SECTIONS=['kpi','trend','composition','products','activity','schedule'];
const DASH_NAMES={kpi:'Kartu Ringkasan',trend:'Diagram Tren Distribusi',composition:'Diagram Komposisi',products:'Kartu Stok APD',activity:'Aktivitas Terbaru',schedule:'Tabel Jadwal Penggantian'};
const defaultLayout=()=>DASH_SECTIONS.map(id=>({id,wide:id==='kpi'||id==='schedule'}));
function normalizedLayout(v){const data=Array.isArray(v)?v:[];const ordered=data.filter(x=>x&&DASH_SECTIONS.includes(x.id)).map(x=>({id:x.id,wide:!!x.wide}));for(const item of defaultLayout())if(!ordered.some(x=>x.id===item.id))ordered.push(item);return ordered}
let state=EMPTY(),revision=0,people=[],deleteAudit=[],accessUsers=[],page='dashboard',chosen='',user=null,role='',saving=false,term='',siteFilter='ALL';
const el=id=>document.getElementById(id);
const H=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE');
const fmt=s=>s?new Date(String(s)+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'—';
const uid=()=>crypto.randomUUID();
const cleanName=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('id-ID');
const can=()=>role==='owner'||role==='editor';
const ownerOnly=()=>role==='owner';
const ownerPages=['stock','images','access','deleted'];
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
function normalize(v){return {stockIn:arr(v?.stockIn),receipts:arr(v?.receipts),returns:arr(v?.returns),limits:{HELM:Math.max(0,Number(v?.limits?.HELM)||0),KAOS:Math.max(0,Number(v?.limits?.KAOS)||0),SEPATU:Math.max(0,Number(v?.limits?.SEPATU)||0)},images:Object.fromEntries(TYPES.filter(t=>typeof v?.images?.[t]==='string'&&v.images[t].startsWith('data:image/')).map(t=>[t,v.images[t]])),personOverrides:v?.personOverrides&&typeof v.personOverrides==='object'&&!Array.isArray(v.personOverrides)?v.personOverrides:{},dashboardLayout:normalizedLayout(v?.dashboardLayout)}}
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

function applyPersonOverrides(){
 const overrides=state.personOverrides||{};
 people=people.map(p=>{
  const v=overrides[p.id];
  return v?{...p,name:String(v.name||p.name),position:String(v.position||p.position),site:String(v.site||p.site),status:v.status==='OUT'?'OUT':v.status==='AKTIF'?'AKTIF':p.status}:p;
 });
}
function personEditForm(id){
 if(!can())return showNotice('Hanya Pemilik/Editor yang dapat mengubah data manpower.','error');
 const p=person(id);if(!p)return showNotice('Manpower tidak ditemukan.','error');
 modal('Edit Data Manpower · '+p.name,'<div class="notice">Perubahan ini berlaku untuk Monitoring APD saja dan tidak mengubah database Monitoring Manpower KMB.</div><form onsubmit="savePersonEdit(event,\''+H(p.id)+'\')"><div class="formgrid"><label>Nama Karyawan<input name="name" value="'+H(p.name)+'" required></label><label>Jabatan<input name="position" value="'+H(p.position)+'" required></label><label>Jobsite<input name="site" value="'+H(p.site)+'" required></label><label>Status<select name="status"><option value="AKTIF" '+(p.status==='AKTIF'?'selected':'')+'>Aktif</option><option value="OUT" '+(p.status==='OUT'?'selected':'')+'>Tidak Aktif / Keluar</option></select></label></div>'+formButtons('Simpan Perubahan Manpower')+'</form>');
}
async function savePersonEdit(e,id){
 e.preventDefault();if(!can())return;
 const p=person(id);if(!p)return showNotice('Manpower tidak ditemukan.','error');
 const f=Object.fromEntries(new FormData(e.target));
 const name=String(f.name||'').trim(),position=String(f.position||'').trim(),site=String(f.site||'').trim();
 if(!name||!position||!site||!['AKTIF','OUT'].includes(f.status))return showNotice('Data manpower belum lengkap.','error');
 const next=structuredClone(state);
 next.personOverrides={...(next.personOverrides||{}),[id]:{name,position,site,status:f.status}};
 await persist(next,'Data manpower berhasil diperbarui di Monitoring APD.');
 applyPersonOverrides();render();
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
function icon(type){return '<div class="art"><img src="'+H(state.images?.[type]||ART[type].url)+'" alt="'+H(ART[type].label)+'" loading="lazy"></div>'}
function validate(d){
 for(const x of d.stockIn)if(!TYPES.includes(x.type)||!['NEW','REUSE'].includes(x.grade)||!Number.isInteger(Number(x.qty))||Number(x.qty)<1||!x.date)return 'Tanggal, jenis dan jumlah stok masuk harus valid (minimal 1).';
 for(const x of d.receipts){
  if(!TYPES.includes(x.type)||!['OLD','NEW','REUSE','EXTERNAL'].includes(x.source)||!Number.isInteger(Number(x.qty))||Number(x.qty)<1||!x.date||!x.person)return 'Data penerimaan APD belum lengkap.';
  if(x.source!=='OLD'&&(!Number.isInteger(Number(x.months))||Number(x.months)<1||Number(x.months)>120))return 'Jatah penggantian harus 1–120 bulan.';
 }
 for(const x of [...d.stockIn,...d.receipts])if(x.variant&&x.variant!=='BELUM DIISI'&&!VARIANTS[x.type]?.includes(x.variant))return 'Ukuran atau warna APD tidak valid.';
 const back={};
 for(const x of d.returns){
  const r=d.receipts.find(y=>y.id===x.receiptId);
  if(!r||!x.date||x.date<r.date)return 'Tanggal pengembalian tidak valid atau catatan asal tidak ada.';
  if(!['REUSE','DESTROY'].includes(x.action)||!Number.isInteger(Number(x.qty))||Number(x.qty)<1)return 'Jumlah/kondisi pengembalian tidak valid.';
  back[r.id]=(back[r.id]||0)+Number(x.qty);
  if(back[r.id]>Number(r.qty))return 'Jumlah pengembalian melebihi APD yang diterima karyawan.';
 }
 const events=[];
 d.stockIn.forEach(x=>events.push({date:x.date,p:0,type:x.type,variant:variant(x),grade:x.grade,n:+x.qty}));
 d.returns.filter(x=>x.action==='REUSE').forEach(x=>{const r=d.receipts.find(y=>y.id===x.receiptId);events.push({date:x.date,p:1,type:r.type,variant:variant(r),grade:'REUSE',n:+x.qty})});
 d.receipts.filter(x=>x.source==='NEW'||x.source==='REUSE').forEach(x=>events.push({date:x.date,p:2,type:x.type,variant:variant(x),grade:x.source,n:-x.qty}));
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.p-b.p);
 const balances={};TYPES.forEach(t=>balances[t]={NEW:0,REUSE:0});
 const detail={};for(const x of events){balances[x.type][x.grade]+=x.n;const k=x.type+'|'+x.variant+'|'+x.grade;detail[k]=(detail[k]||0)+x.n;if(detail[k]<0)return 'Stok '+x.type+' ('+x.variant+') tidak mencukupi pada '+fmt(x.date)+'.'}
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
 try{await Promise.all([loadPeople(),loadApd(),...(role==='owner'?[loadAccessUsers(),loadDeleteAudit()]:[])]);applyPersonOverrides();render()}catch(e){showNotice(e.message,'error')}
}
async function loadDeleteAudit(){if(!ownerOnly())return;const {data,error}=await db.from('apd_delete_audit').select('kind,record_id,record_data,deleted_by,deleted_at').order('deleted_at',{ascending:false}).limit(1000);if(error)throw Error('Riwayat hapus tidak dapat dimuat: '+error.message);deleteAudit=data||[]}
async function loadAccessUsers(){if(role!=='owner')return;const {data,error}=await db.from('app_access_roles').select('email,role').eq('app_id','apd').order('email');if(error)throw Error('Daftar akses tidak bisa dimuat: '+error.message);accessUsers=data||[]}
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
 if(!ownerOnly()&&JSON.stringify(next.dashboardLayout)!==JSON.stringify(state.dashboardLayout))return showNotice('Hanya Pemilik dapat mengubah layout Dashboard.','error');
 if(!ownerOnly()&&(JSON.stringify(next.stockIn)!==JSON.stringify(state.stockIn)||JSON.stringify(next.limits)!==JSON.stringify(state.limits)||JSON.stringify(next.images)!==JSON.stringify(state.images)))return showNotice('Koreksi stok gudang, stok minimum, dan gambar APD hanya boleh dilakukan Pemilik. Hubungi Pemilik untuk konfirmasi.','error');
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
function navigate(v){if(ownerPages.includes(v)&&!ownerOnly())return showNotice('Halaman ini khusus Pemilik. Hubungi Pemilik untuk koreksi stok atau perubahan data.','error');page=v;chosen='';term='';siteFilter='ALL';el('sidebar').classList.remove('open');render()}
function openPerson(id){chosen=id;page='detail';render()}
function heading(eyebrow,name,description,buttons){
 return '<div class="head"><div><span class="eyebrow">'+H(eyebrow)+'</span><h2>'+H(name)+'</h2><p>'+H(description)+'</p></div>'+(buttons||'')+'</div>';
}
function render(){
 el('roleText').textContent=role?(role==='owner'?'Pemilik':role==='editor'?'Editor':'Pelihat'):'Belum Masuk';
 el('userText').textContent=user?.email||'';
 el('authBtn').textContent=user?'Keluar':'Masuk';
 document.querySelectorAll('.nav[data-page="stock"],.nav[data-page="images"],.nav[data-page="access"],.nav[data-page="deleted"]').forEach(n=>n.hidden=!ownerOnly());
 el('exportExcelBtn').hidden=!ownerOnly();
 if(ownerPages.includes(page)&&!ownerOnly())page='dashboard';
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===page||(page==='detail'&&n.dataset.page==='people')));
 if(!user||!role){
  el('pageTitle').textContent='Monitoring APD KMB';
  el('app').innerHTML=heading('MONITORING SYSTEM','Monitoring APD KMB','Mengikuti daftar karyawan Monitoring Manpower KMB.')+'<section class="panel" style="max-width:650px;margin:34px auto;text-align:center;padding:43px 25px"><div style="font-size:50px">🪖 &nbsp; 👕 &nbsp; 🥾</div><h2>Pengelolaan APD Karyawan</h2><p class="muted" style="line-height:1.8">Kelola APD lama, stok gudang, jadwal penggantian dan pengembalian saat resign. Masuk menggunakan akun KMB.</p><button class="btn dark" onclick="login()">Masuk Akun KMB</button></section>';return;
 }
 if(page==='deleted'){el('pageTitle').textContent='Riwayat Hapus APD';el('app').innerHTML=deletedPage()}
 else if(page==='dashboard'){el('pageTitle').textContent='Dashboard Monitoring APD';el('app').innerHTML=dashboard();setupDashboardLayout()}
 else if(page==='people'||page==='out'){el('pageTitle').textContent=page==='people'?'Manpower Aktif':'Manpower Keluar';el('app').innerHTML=peoplePage(page==='out')}
 else if(page==='detail'){const p=person(chosen);el('pageTitle').textContent='Detail APD · '+(p?.name||'');el('app').innerHTML=p?detailPage(p):'<div class="empty">Karyawan tidak ditemukan; silakan sinkronkan.</div>'}
 else if(page==='stock'){el('pageTitle').textContent='Stok APD Gudang';el('app').innerHTML=stockPage()}
 else if(page==='history'){el('pageTitle').textContent='Riwayat Transaksi APD';el('app').innerHTML=historyPage()}
 else if(page==='guide'){el('pageTitle').textContent='Tata Cara';el('app').innerHTML=guidePage()}
 else if(page==='access'){el('pageTitle').textContent='Pengaturan Pemilik';el('app').innerHTML=accessPage()}
 else if(page==='images'){el('pageTitle').textContent='Gambar APD Utama';el('app').innerHTML=imagesPage()}
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

let dashboardPeriod='bulanan',dashboardYear=new Date().getFullYear();
function setDashboardPeriod(value){if(['harian','mingguan','bulanan','tahunan'].includes(value)){dashboardPeriod=value;render()}}
function setDashboardYear(value){dashboardYear=Number(value)||new Date().getFullYear();render()}
function distributed(){return state.receipts.filter(r=>r.source==='NEW'||r.source==='REUSE')}
function trendBuckets(){
 const mon=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],items=[];
 const now=new Date(today()+'T12:00:00');
 const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 if(dashboardPeriod==='bulanan')for(let m=0;m<12;m++){const k=dashboardYear+'-'+String(m+1).padStart(2,'0');items.push({label:mon[m],from:k+'-01',to:k+'-31'})}
 if(dashboardPeriod==='tahunan')for(let y=dashboardYear-4;y<=dashboardYear;y++)items.push({label:String(y),from:y+'-01-01',to:y+'-12-31'});
 if(dashboardPeriod==='harian')for(let i=9;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);items.push({label:d.getDate()+'/'+(d.getMonth()+1),from:iso(d),to:iso(d)})}
 if(dashboardPeriod==='mingguan'){const mon0=new Date(now);mon0.setDate(mon0.getDate()-(mon0.getDay()+6)%7);for(let i=7;i>=0;i--){const d=new Date(mon0);d.setDate(d.getDate()-i*7);const e=new Date(d);e.setDate(e.getDate()+6);items.push({label:d.getDate()+'/'+(d.getMonth()+1),from:iso(d),to:iso(e)})}}
 return items;
}
function trendChart(){
 const b=trendBuckets(),cols={HELM:'#f7b825',KAOS:'#ff596a',SEPATU:'#753df5'},hist=distributed();
 const series=TYPES.map(t=>({type:t,color:cols[t],values:b.map(k=>hist.filter(r=>r.type===t&&r.date>=k.from&&r.date<=k.to).reduce((a,r)=>a+qty(r.qty),0))}));
 const max=Math.max(1,...series.flatMap(x=>x.values)),tick=Math.max(1,Math.ceil(max/4)),w=640,h=218,L=41,R=11,T=13,B=35;
 const x=i=>L+(w-L-R)*i/Math.max(1,b.length-1),y=n=>T+(h-T-B)*(1-n/(tick*4));
 const grid=[0,1,2,3,4].map(i=>'<line x1="'+L+'" x2="'+(w-R)+'" y1="'+y(i*tick)+'" y2="'+y(i*tick)+'" stroke="#e8eaf3" stroke-dasharray="3 4"/><text x="'+(L-8)+'" y="'+(y(i*tick)+4)+'" text-anchor="end" fill="#99a4b5" font-size="11">'+i*tick+'</text>').join('');
 const labels=b.map((k,i)=>'<text x="'+x(i)+'" y="'+(h-8)+'" fill="#8a96aa" font-size="10" text-anchor="middle">'+k.label+'</text>').join('');
 const lines=series.map(z=>{const pts=z.values.map((v,i)=>[x(i),y(v)]),d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '),area=d+' L'+x(b.length-1)+' '+y(0)+' L'+x(0)+' '+y(0)+' Z';return '<path d="'+area+'" fill="url(#area-'+z.type+')" /><path d="'+d+'" fill="none" stroke="'+z.color+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+pts.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3.6" fill="'+z.color+'" stroke="#fff" stroke-width="2"/>').join('')}).join('');
 return '<div class="apd-chart"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Tren distribusi APD berdasarkan riwayat asli"><defs>'+series.map(z=>'<linearGradient id="area-'+z.type+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+z.color+'" stop-opacity=".23"/><stop offset="1" stop-color="'+z.color+'" stop-opacity="0"/></linearGradient>').join('')+'</defs>'+grid+labels+lines+'</svg></div><div class="apd-chart-legend">'+series.map(z=>'<span><i style="background:'+z.color+'"></i>'+ART[z.type].label+'</span>').join('')+'</div>';
}
function composition(){
 const sums=TYPES.map(t=>distributed().filter(r=>r.type===t).reduce((a,r)=>a+qty(r.qty),0)),total=sums.reduce((a,b)=>a+b,0);
 const colors=['#fac32f','#ff5768','#7841f6'];let parts=[],current=0;
 if(total)sums.forEach((n,i)=>{const portion=n/total*100;if(portion){parts.push(colors[i]+' '+current+'% '+(current+portion)+'%');current+=portion}});
 const fill=total?'conic-gradient('+parts.join(',')+')':'conic-gradient(#e9edf4 0% 100%)';
 return '<div class="apd-donut-wrap"><div class="apd-donut" style="background:'+fill+'"><div class="apd-donut-center"><b>'+total.toLocaleString('id-ID')+'</b><small>Total Distribusi</small></div></div><div class="apd-donut-legend">'+TYPES.map((t,i)=>'<div class="apd-donut-row"><i style="background:'+colors[i]+'"></i><div><b>'+ART[t].label+'</b><small>'+sums[i]+' unit</small></div><strong>'+(total?Math.round(sums[i]/total*100):0)+'%</strong></div>').join('')+'</div></div>';
}
function recentActivity(){
 const items=[];
 if(ownerOnly())state.stockIn.forEach(x=>items.push({date:x.date,title:'Stok masuk',description:x.qty+' '+ART[x.type].label+' ('+(x.grade==='NEW'?'baru':'bekas')+')',icon:'▣',color:'blue'}));
 state.receipts.forEach(x=>items.push({date:x.date,title:x.source==='OLD'?'Pencatatan APD lama':'APD dibagikan',description:x.qty+' '+ART[x.type].label+' · '+personName(x.person),icon:'➤',color:'purple'}));
 state.returns.forEach(x=>{const r=state.receipts.find(t=>t.id===x.receiptId);if(r)items.push({date:x.date,title:x.action==='REUSE'?'Pengembalian APD layak':'APD dimusnahkan',description:x.qty+' '+ART[r.type].label+' · '+personName(r.person),icon:'↻',color:'red'})});
 items.sort((a,b)=>b.date.localeCompare(a.date));
 return items.slice(0,5).map(x=>'<div class="apd-activity"><span class="apd-activity-icon '+x.color+'">'+x.icon+'</span><div><b>'+H(x.title)+'</b><small>'+H(x.description)+'</small></div><time>'+fmt(x.date)+'</time></div>').join('')||'<div class="apd-activity-empty"><strong>Belum ada aktivitas APD</strong><small>Transaksi stok dan pembagian APD akan tampil di sini otomatis.</small></div>';
}

function toggleDashboardLayout(){
 if(!ownerOnly())return;
 if(editingDashboardLayout){editingDashboardLayout=false;layoutDraft=null}
 else{editingDashboardLayout=true;layoutDraft=normalizedLayout(state.dashboardLayout)}
 render();
}
function moveDash(id,change){if(!ownerOnly()||!editingDashboardLayout)return;const i=layoutDraft.findIndex(x=>x.id===id),j=i+change;if(i<0||j<0||j>=layoutDraft.length)return;[layoutDraft[i],layoutDraft[j]]=[layoutDraft[j],layoutDraft[i]];render()}
function wideDash(id){if(!ownerOnly()||!editingDashboardLayout)return;const x=layoutDraft.find(x=>x.id===id);if(x){x.wide=!x.wide;render()}}
function resetDash(){if(!ownerOnly()||!editingDashboardLayout)return;if(confirm('Kembalikan susunan dashboard ke awal? Perubahan belum disimpan.')){layoutDraft=defaultLayout();render()}}
async function saveDash(){if(!ownerOnly()||!editingDashboardLayout)return;const d=structuredClone(state);d.dashboardLayout=normalizedLayout(layoutDraft);await persist(d,'Layout Dashboard berhasil disimpan untuk semua pengguna.');if(JSON.stringify(state.dashboardLayout)===JSON.stringify(d.dashboardLayout)){editingDashboardLayout=false;layoutDraft=null;render()}}
function setupDashboardLayout(){
 const root=document.querySelector('.apd-dashboard');if(!root)return;
 const selectors={kpi:'.apd-gradient-kpis',trend:'.apd-trend-panel',composition:'.apd-composition-panel',products:'.apd-product-panel',activity:'.apd-activities-panel',schedule:'.apd-schedules'};
 const parts={};for(const [id,selector] of Object.entries(selectors)){parts[id]=root.querySelector(selector);if(!parts[id])return}
 const layout=editingDashboardLayout&&ownerOnly()?normalizedLayout(layoutDraft):normalizedLayout(state.dashboardLayout);
 const toolbar=document.createElement('div');toolbar.className='apd-layout-toolbar';
 if(ownerOnly()){toolbar.innerHTML=editingDashboardLayout?'<strong>Mode Edit Layout</strong><span>Geser komponen atau gunakan tombol panah. Klik Simpan setelah selesai.</span><button class="btn slim" onclick="resetDash()">Reset</button><button class="btn slim" onclick="toggleDashboardLayout()">Batal</button><button class="btn slim dark" onclick="saveDash()">Simpan Layout</button>':'<button class="btn dark" onclick="toggleDashboardLayout()">✎ Edit Layout Dashboard</button>';root.insertBefore(toolbar,root.children[1])}
 const grid=document.createElement('div');grid.className='apd-editable-layout'+(editingDashboardLayout&&ownerOnly()?' is-editing':'');root.appendChild(grid);
 layout.forEach((cfg,i)=>{
  const item=document.createElement('div');item.className='apd-layout-item'+(cfg.wide?' apd-layout-wide':'');item.dataset.section=cfg.id;
  if(editingDashboardLayout&&ownerOnly()){
   item.draggable=true;
   item.ondragstart=e=>{e.dataTransfer.setData('text/plain',cfg.id);e.dataTransfer.effectAllowed='move'};
   item.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move'};
   item.ondrop=e=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain');if(!DASH_SECTIONS.includes(from)||from===cfg.id)return;const a=layoutDraft.findIndex(x=>x.id===from),b=layoutDraft.findIndex(x=>x.id===cfg.id);if(a<0||b<0)return;layoutDraft.splice(b,0,layoutDraft.splice(a,1)[0]);render()};
   const ctrl=document.createElement('div');ctrl.className='apd-layout-controls';ctrl.innerHTML='<b>⠿ '+DASH_NAMES[cfg.id]+'</b><span><button class="btn slim" onclick="moveDash(\''+cfg.id+'\',-1)" '+(i===0?'disabled':'')+'>↑</button><button class="btn slim" onclick="moveDash(\''+cfg.id+'\',1)" '+(i===layout.length-1?'disabled':'')+'>↓</button><button class="btn slim" onclick="wideDash(\''+cfg.id+'\')">'+(cfg.wide?'½ Lebar':'Lebar Penuh')+'</button></span>';item.appendChild(ctrl);
  }
  item.appendChild(parts[cfg.id]);grid.appendChild(item);
 });
 root.querySelectorAll('.apd-analytics,.apd-bottom-panels').forEach(x=>{if(!x.children.length)x.remove()});
}
function dashboard(){
 const w=TYPES.reduce((a,t)=>{const z=stock(t);return a+z.NEW+z.REUSE},0);
 const count=distributed().reduce((a,t)=>a+qty(t.qty),0),dueCount=schedules().filter(x=>x.days<=0).length,active=people.filter(p=>p.status==='AKTIF').length;
 const kpis=[['Total Stok APD',w,'Seluruh jenis APD di gudang','▣','purple'],['APD Dibagikan',count,'Penerimaan baru dan bekas','➤','blue'],['Jadwal Ganti',dueCount,'APD sudah jatuh tempo','↻','pink'],['Karyawan Aktif',active,'Tersinkron dari Manpower','♙','orange']];
 const cards='<div class="apd-gradient-kpis">'+kpis.map(a=>'<div class="apd-kpi apd-kpi-'+a[4]+'"><span class="apd-kpi-icon">'+a[3]+'</span><div><b>'+a[1].toLocaleString('id-ID')+'</b><strong>'+a[0]+'</strong><small>'+a[2]+'</small></div><span class="apd-kpi-bars">▥</span></div>').join('')+'</div>';
 const controls='<div class="apd-chart-controls">'+['harian','mingguan','bulanan','tahunan'].map(t=>'<button type="button" class="'+(dashboardPeriod===t?'current':'')+'" onclick="setDashboardPeriod(\''+t+'\')">'+t[0].toUpperCase()+t.slice(1)+'</button>').join('')+'</div>';
 const years=[...new Set([new Date().getFullYear(),dashboardYear,...state.receipts.map(x=>Number(x.date?.slice(0,4))||0)])].filter(y=>y>2000).sort((a,b)=>b-a);
 const year='<select class="apd-select-year" aria-label="Tahun grafik" onchange="setDashboardYear(this.value)">'+years.map(y=>'<option value="'+y+'" '+(y===dashboardYear?'selected':'')+'>'+y+'</option>').join('')+'</select>';
 const analytics='<div class="apd-analytics"><section class="panel apd-trend-panel"><div class="section-head"><div><h3><span class="apd-panel-icon">▥</span> Tren Distribusi APD</h3><p>Berpatokan pada transaksi pembagian tercatat</p></div><div class="apd-chart-actions">'+controls+year+'</div></div>'+trendChart()+'</section><section class="panel apd-composition-panel"><div class="section-head"><div><h3><span class="apd-panel-icon">▥</span> Komposisi Distribusi APD</h3><p>Total pembagian berdasarkan jenis APD</p></div><span class="apd-live">● LIVE DATA</span></div>'+composition()+'</section></div>';
 const products='<div class="apd-product-grid">'+TYPES.map((type,index)=>{const z=stock(type),n=z.NEW+z.REUSE,min=Number(state.limits?.[type]||0),percent=min?Math.min(100,Math.round(n/min*100)):n>0?100:0,alert=n===0||min>0&&n<min,status=n===0?'Stok Kosong':alert?'Stok Menipis':'Stok Tersedia';return '<article class="apd-product-card apd-product-'+type.toLowerCase()+'"><div class="apd-product-image">'+icon(type)+'<span class="apd-stock-status '+(alert?'low':'safe')+'">'+status+'</span></div><div class="apd-product-body"><h4>'+ART[type].label+'</h4><p>'+(type==='HELM'?'Pelindung kepala saat bekerja':type==='KAOS'?'Seragam kerja lapangan KMB':'Pelindung kaki keselamatan')+'</p><div class="apd-product-numbers"><span><small>Stok Saat Ini</small><strong>'+n+' <em>unit</em></strong></span><span><small>Min. Stok</small><strong>'+min+' <em>unit</em></strong></span></div><div class="apd-product-track"><span style="width:'+percent+'%"></span></div></div></article>'}).join('')+'</div>';
 const lower='<div class="apd-bottom-panels"><section class="panel apd-product-panel"><div class="section-head"><h3><span class="apd-panel-icon">▦</span> Jenis APD Utama</h3><button class="apd-link" onclick="navigate(\'stock\')">Lihat Semua →</button></div>'+products+'</section><section class="panel apd-activities-panel"><div class="section-head"><h3><span class="apd-panel-icon">▤</span> Aktivitas Terbaru</h3><button class="apd-link" onclick="navigate(\'history\')">Lihat Semua →</button></div>'+recentActivity()+'</section></div>';
 const rows=schedules().slice(0,7).map(x=>'<tr><td><button class="link" onclick="openPerson(\''+H(x.p.id)+'\')">'+H(x.p.name)+'</button></td><td>'+x.t+'</td><td>'+fmt(x.x.date)+'</td><td>'+fmt(x.d)+'</td><td>'+labelStatus(x.days<=0?'JATUH TEMPO':x.days<=30?'SEGERA':'TERJADWAL')+'</td></tr>').join('')||'<tr><td colspan="5">Belum ada jadwal penggantian. Mulai dari pembagian APD kepada karyawan.</td></tr>';
 return '<div class="apd-dashboard">'+heading('PT KARUNIA MANDIRI BERKARYA','Dashboard Monitoring APD KMB','Pantau distribusi, stok, dan penggantian Alat Pelindung Diri (APD) secara real-time.','<div class="apd-date-chip">▦ '+fmt(today())+'</div>')+cards+analytics+lower+'<section class="panel apd-schedules"><div class="section-head"><div><h3><span class="apd-panel-icon">◷</span> Jadwal Penggantian APD</h3><p>Dihitung dari tanggal penerimaan terbaru dan jatah penggantian masing-masing.</p></div><button class="apd-link" onclick="navigate(\'people\')">Kelola Manpower →</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Karyawan</th><th>Jenis APD</th><th>Terakhir Menerima</th><th>Jadwal Penggantian</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div></section></div>';
}
function renderPeopleRows(out){
 const source=people.filter(p=>p.status===(out?'OUT':'AKTIF'));
 const current=source.filter(p=>(siteFilter==='ALL'||p.site===siteFilter)&&(!term||(p.name+' '+p.position+' '+p.site).toLowerCase().includes(term.toLowerCase())));
 return current.map(p=>'<tr><td><button class="link" onclick="openPerson(\''+H(p.id)+'\')">'+H(p.name)+'</button><div class="muted">'+H(p.position)+'</div></td><td>'+H(p.site)+'</td><td>'+labelStatus(p.status)+'</td>'+TYPES.map(t=>'<td><b>'+held(p.id,t)+'</b><div class="muted">'+(due(p.id,t)?fmt(due(p.id,t)):'Belum dijadwalkan')+'</div></td>').join('')+'<td><button class="btn slim dark" onclick="openPerson(\''+H(p.id)+'\')">Detail APD</button> <button class="btn slim" onclick="personEditForm(\''+H(p.id)+'\')">Edit Manpower</button></td></tr>').join('')||'<tr><td colspan="7">Tidak ada karyawan yang cocok.</td></tr>';
}
function peoplePage(out){
 const source=people.filter(x=>x.status===(out?'OUT':'AKTIF')),sites=[...new Set(source.map(p=>p.site))].sort();
 return heading('DATABASE',out?'Manpower Keluar & Pengembalian':'Manpower Aktif & Kepemilikan APD',out?'Periksa dan catat APD yang dikembalikan saat resign.':'Klik nama karyawan untuk mencatat APD lama atau membagikan APD baru.')+
 '<section class="panel"><div class="section-head"><div><h3>Data Manpower KMB ('+source.length+')</h3><p>Data awal mengikuti Monitoring Manpower KMB; Pemilik/Editor dapat mengubah data khusus APD.</p></div></div><div class="row-tools"><input id="searchPerson" placeholder="Cari nama, jabatan, jobsite…" value="'+H(term)+'"><select id="filterSite"><option value="ALL">Semua Jobsite</option>'+sites.map(x=>'<option value="'+H(x)+'" '+(siteFilter===x?'selected':'')+'>'+H(x)+'</option>').join('')+'</select><button class="btn" onclick="loadAll()">↻ Sinkronkan Manpower</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Nama & Jabatan</th><th>Jobsite</th><th>Status</th><th>Helm</th><th>Kaos</th><th>Sepatu</th><th>Aksi</th></tr></thead><tbody id="personRows">'+renderPeopleRows(out)+'</tbody></table></div></section>';
}


function detailPage(p){
 const pieces=TYPES.map(t=>{
  const lots=state.receipts.filter(x=>x.person===p.id&&x.type===t).sort((a,b)=>b.date.localeCompare(a.date));
  const latestDist=latest(p.id,t),lastDate=due(p.id,t),oldStock=lots.filter(x=>x.source==='OLD').reduce((a,x)=>a+heldLot(x),0);
  const rows=lots.map(r=>{
   const remain=heldLot(r);
   const back=state.returns.filter(x=>x.receiptId===r.id);
   const source=r.source==='OLD'?'APD LAMA':r.source==='NEW'?'APD BARU':r.source==='EXTERNAL'?'APD DARI PIHAK LUAR':'APD BEKAS LAYAK';
   const history=back.map(x=>'<small>↳ '+fmt(x.date)+' · '+x.qty+' unit '+(x.action==='REUSE'?'dikembalikan layak → stok bekas':'tidak layak → musnah')+(can()?'<button class="btn slim" onclick="editReturn(\''+H(x.id)+'\')">Edit</button>':'')+(can()?'<button class="btn slim danger" onclick="deleteApdRecord(\'return\',\''+H(x.id)+'\')">Hapus</button>':'')+'</small>').join('');
   return '<div class="lot"><div style="flex:1"><strong>'+source+' · '+fmt(r.date)+' · '+r.qty+' unit · '+H(variant(r))+' '+labelStatus(r.condition||'BELUM DIPERIKSA')+'</strong><small>Masih dimiliki: <b>'+remain+' unit</b>'+(r.source==='OLD'?' · APD lama tidak menjadi acuan tanggal ganti':' · Jatah '+r.months+' bulan · Jadwal '+fmt(addMonths(r.date,r.months)))+'</small><small>Asal Gudang: '+H(r.source==='OLD'?'APD lama / stok pribadi':r.warehouse||'Belum dicatat')+'</small><small>'+H(r.note||'')+'</small>'+history+'</div><div class="toolbarend">'+(can()?'<button class="btn slim" onclick="receiptForm(\''+H(p.id)+'\',\''+t+'\',\''+H(r.id)+'\')">✎ Edit APD</button>':'')+(can()?'<button class="btn slim danger" onclick="deleteApdRecord(\'receipt\',\''+H(r.id)+'\')">Hapus</button>':'')+(can()&&p.status==='OUT'&&remain>0?'<button class="btn slim dark" onclick="returnForm(\''+H(r.id)+'\')">↩ Pengembalian</button>':'')+'</div></div>';
  }).join('')||'<div class="notice">Belum ada riwayat. Gunakan Catat APD Lama untuk APD yang telah dimiliki, atau Bagikan APD untuk stok gudang.</div>';
  return '<section class="panel" style="margin-bottom:16px"><div class="section-head"><div><h3>'+(t==='HELM'?'🪖':t==='KAOS'?'👕':'🥾')+' '+ART[t].label+'</h3><p>Dipegang '+held(p.id,t)+' unit · Stok lama '+oldStock+' unit</p></div><div class="toolbarend">'+(can()?'<button class="btn slim" onclick="receiptForm(\''+H(p.id)+'\',\''+t+'\',\'\',\'OLD\')">+ Catat APD Lama</button><button class="btn slim dark" onclick="receiptForm(\''+H(p.id)+'\',\''+t+'\',\'\',\'NEW\')">+ Tambah APD</button>':'')+'</div></div>'+
  '<div class="stat-row"><div class="mini-stat"><small>Total Dipegang</small><b>'+held(p.id,t)+'</b></div><div class="mini-stat"><small>Stok APD Lama</small><b>'+oldStock+'</b></div><div class="mini-stat"><small>Terakhir Terima Baru/Bekas</small><b style="font-size:13px">'+fmt(latestDist?.date)+'</b></div><div class="mini-stat"><small>Jadwal Ganti</small><b style="font-size:13px">'+fmt(lastDate)+'</b></div></div><div class="lot-list">'+rows+'</div></section>';
 }).join('');
 return '<div class="flex between wrap" style="margin-bottom:13px"><button class="btn" onclick="navigate(\''+(p.status==='OUT'?'out':'people')+'\')">← Kembali</button><button class="btn" onclick="loadAll()">↻ Sinkronkan</button></div><div class="personhero"><span class="eyebrow" style="color:#f4d56b">DETAIL APD KARYAWAN</span><h2>'+H(p.name)+'</h2><p>'+H(p.position)+' · '+H(p.site)+' · '+p.status+'</p><p>Jumlah APD dipegang: <b>'+held(p.id)+' unit</b>. '+(p.status==='OUT'?'Periksa APD yang dikembalikan saat resign.':'APD lama dan distribusi gudang dikelola terpisah.')+'</p></div><section class="panel" style="margin:18px 0"><div class="section-head"><div><h3>Data Karyawan</h3><p>Identitas dan status manpower pada Monitoring APD.</p></div>'+(can()?'<button class="btn dark" onclick="personEditForm(\''+H(p.id)+'\')">✎ Edit Data Karyawan</button>':'')+'</div><div class="stat-row"><div class="mini-stat"><small>Nama Karyawan</small><b style="font-size:15px">'+H(p.name)+'</b></div><div class="mini-stat"><small>Jabatan</small><b style="font-size:15px">'+H(p.position)+'</b></div><div class="mini-stat"><small>Jobsite</small><b style="font-size:15px">'+H(p.site)+'</b></div><div class="mini-stat"><small>Status</small><b style="font-size:15px">'+(p.status==='AKTIF'?'AKTIF':'TIDAK AKTIF / KELUAR')+'</b></div></div></section>'+pieces;
}
function stockPage(){
 if(!ownerOnly())return '<div class="empty">Halaman stok dan riwayat gudang hanya untuk Pemilik.</div>';
 const cards='<div class="cards3 warehouse-cards">'+TYPES.map(t=>{const x=stock(t);return '<div class="card product warehouse-card">'+icon(t)+'<div class="warehouse-card-info"><h3>'+ART[t].label+'</h3><div class="big">'+(x.NEW+x.REUSE)+'</div><small>Baru '+x.NEW+' · Bekas layak '+x.REUSE+' · Musnah '+x.DESTROYED+'</small><small>Minimal stok: '+Number(state.limits?.[t]||0)+'</small>'+(can()?'<button class="btn slim warehouse-edit" onclick="editWarehouseStock(\''+t+'\')">✎ Edit Stok Gudang</button>':'')+'</div></div>'}).join('')+'</div>';
 const breakdown='<section class="panel"><div class="section-head"><h3>Rincian Stok Ukuran / Warna</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Jenis</th><th>Ukuran / Warna</th><th>Baru</th><th>Bekas Layak</th><th>Total</th></tr></thead><tbody>'+TYPES.flatMap(t=>Object.entries(variantStocks(t)).filter(([v,z])=>v!=='BELUM DIISI'||z.NEW||z.REUSE).map(([v,z])=>'<tr><td>'+t+'</td><td>'+H(t==='HELM'?v+' (All Size)':v)+'</td><td>'+z.NEW+'</td><td>'+z.REUSE+'</td><td><b>'+(z.NEW+z.REUSE)+'</b></td></tr>')).join('')+'</tbody></table></div></section>';
 const rows=[...state.stockIn].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>'<tr><td>'+fmt(x.date)+'</td><td>'+x.type+'</td><td>'+H(variant(x))+'</td><td>'+labelStatus(x.grade==='NEW'?'BARU':'LAYAK')+'</td><td><b>'+x.qty+'</b></td><td>'+H(x.location||'Gudang')+'</td><td>'+H(x.note||'—')+'</td><td>'+(ownerOnly()?'<button class="btn slim" onclick="stockForm(\''+H(x.id)+'\')">✎ Edit Stok</button> <button class="btn slim danger" onclick="deleteApdRecord(\'stock\',\''+H(x.id)+'\')">Hapus</button>':'–')+'</td></tr>').join('')||'<tr><td colspan="8">Belum ada stok masuk. Stok awal 0; input manual ketika barang diterima gudang.</td></tr>';
 return heading('INVENTORY','Stok APD Gudang','Stok gudang terpisah dari APD lama milik karyawan.',can()?'<button class="btn dark" onclick="stockForm()">+ Tambah Stok Masuk</button>':'')+cards+breakdown+
 '<div class="notice">APD yang <b>sudah dipakai karyawan</b> dicatat melalui Manpower → Detail → Catat APD Lama. Jangan masukkan ke stok gudang.</div><section class="panel"><div class="section-head"><h3>Riwayat Stok Masuk</h3><button class="btn" onclick="loadAll()">↻ Sinkronkan</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Ukuran / Warna</th><th>Kondisi</th><th>Qty</th><th>Gudang</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function deletedPage(){
 if(!ownerOnly())return '<div class="empty">Riwayat Hapus hanya dapat dilihat Pemilik.</div>';
 const labels={stock:'Stok Masuk',receipt:'Penerimaan APD',return:'Pengembalian APD'};
 const rows=deleteAudit.map(x=>{const d=x.record_data||{};const date=new Date(x.deleted_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
 return '<tr><td>'+H(date)+' WIB</td><td>'+H(x.deleted_by)+'</td><td>'+H(labels[x.kind]||x.kind)+'</td><td>'+H(d.type||'—')+'</td><td>'+H(x.kind==='receipt'?personName(d.person):x.kind==='stock'?(d.location||'Gudang'):'Referensi '+d.receiptId)+'</td><td>'+H(d.qty??'—')+'</td><td>'+H(fmt(d.date))+'</td><td>'+H(d.note||'—')+'</td></tr>'}).join('')||'<tr><td colspan="8">Belum ada data yang dihapus.</td></tr>';
 return heading('AUDIT KHUSUS PEMILIK','Riwayat Hapus APD','Catatan penghapusan permanen: siapa yang menghapus, kapan, dan data yang terhapus. Editor tidak dapat mengakses halaman ini.','<button class="btn" onclick="loadDeleteAudit().then(render).catch(e=>showNotice(e.message,\'error\'))">↻ Perbarui</button>')+
 '<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Tanggal Hapus</th><th>Dihapus Oleh</th><th>Jenis Transaksi</th><th>APD</th><th>Karyawan / Gudang</th><th>Qty</th><th>Tanggal Data</th><th>Keterangan</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function historyPage(){
 const rows=[];
 if(ownerOnly())state.stockIn.forEach(x=>rows.push({date:x.date,type:x.type,label:x.grade==='NEW'?'STOK BARU MASUK':'STOK BEKAS MASUK',count:x.qty,name:x.location||'Gudang',warehouse:x.location||'Gudang',kind:'stock',id:x.id,call:"stockForm('"+H(x.id)+"')"}));
 state.receipts.forEach(x=>rows.push({date:x.date,type:x.type,label:x.source==='OLD'?'APD LAMA':x.source==='EXTERNAL'?'TERIMA EKSTERNAL':x.source==='NEW'?'TERIMA BARU':'TERIMA BEKAS',count:x.qty,name:personName(x.person),warehouse:x.source==='OLD'?'APD lama / stok pribadi':x.warehouse||'Belum dicatat',kind:'receipt',id:x.id,call:"receiptForm('"+H(x.person)+"','"+x.type+"','"+H(x.id)+"')"}));
 state.returns.forEach(x=>{const r=state.receipts.find(a=>a.id===x.receiptId);if(r)rows.push({date:x.date,type:r.type,label:x.action==='REUSE'?'KEMBALI LAYAK':'DIMUSNAHKAN',count:x.qty,name:personName(r.person),warehouse:r.warehouse||'Belum dicatat',kind:'return',id:x.id,call:"editReturn('"+H(x.id)+"')"})});
 rows.sort((a,b)=>b.date.localeCompare(a.date));
 return heading('AUDIT TRAIL','Riwayat Monitoring APD',ownerOnly()?'Riwayat stok, penerimaan lama, distribusi, dan pengembalian.':'Riwayat APD karyawan. Riwayat stok gudang khusus Pemilik.',ownerOnly()?'<button class="btn" onclick="backup()">⇩ Backup Data</button>':'')+'<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Aktivitas</th><th>Jumlah</th><th>Karyawan / Gudang</th><th>Asal Gudang</th><th>Aksi</th></tr></thead><tbody>'+(rows.map(x=>'<tr><td>'+fmt(x.date)+'</td><td>'+x.type+'</td><td>'+x.label+'</td><td>'+x.count+'</td><td>'+H(x.name)+'</td><td>'+H(x.warehouse||'—')+'</td><td>'+(can()?'<button class="btn slim" onclick="'+x.call+'">✎ Edit</button>':'')+(can()?'<button class="btn slim danger" onclick="deleteApdRecord(\''+x.kind+'\',\''+H(x.id)+'\')">Hapus</button>':'')+(!can()?'–':'')+'</td></tr>').join('')||'<tr><td colspan="7">Belum ada transaksi.</td></tr>')+'</tbody></table></div></section>';
}
function guidePage(){
 const guides=[
 ['1. Sinkronkan & Edit Manpower','Data awal diambil dari Monitoring Manpower KMB. Klik Edit Manpower untuk mengubah nama, jabatan, jobsite, atau status Aktif/Tidak Aktif khusus di Monitoring APD.'],
 ['2. Catat APD Lama','Buka Manpower → karyawan → Catat APD Lama. Isi kapan APD dahulu diterima, jumlah yang masih dipegang, dan kondisi layak/tidak layak. Tidak perlu stok gudang.'],
 ['3. Tambah Stok Gudang','Khusus Pemilik: Buka Stok & Riwayat Gudang → Tambah Stok Masuk. Editor harus konfirmasi ke Pemilik untuk koreksi stok.'],
 ['4. Tambah APD kepada Karyawan','Buka detail karyawan → Tambah APD. Pilih baru/bekas layak, tanggal penerimaan, jumlah dan jatah ganti dalam bulan. Stok gudang otomatis berkurang.'],
 ['5. Jadwal Penggantian Otomatis','Jadwal = tanggal penerimaan baru/bekas terakhir + jatah penggantian bulan. APD lama tetap stok karyawan dan tidak menentukan jadwal ganti.'],
 ['6. Karyawan Keluar','Jika status OUT dari Manpower KMB, klik Pengembalian pada riwayat. Pilih layak pakai untuk dikembalikan sebagai stok bekas atau tidak layak untuk dimusnahkan.'],
 ['7. Salah Input','Koreksi stok gudang, stok minimum, dan gambar APD hanya oleh Pemilik. Editor dapat memperbarui transaksi APD karyawan sesuai akses operasionalnya.']
 ];
 return heading('PANDUAN','Tata Cara Monitoring APD','Dibuat sederhana dan terpisah antara milik karyawan dan stok gudang.')+'<section class="panel">'+guides.map(x=>'<div class="guide-step"><strong>'+x[0]+'</strong><p>'+x[1]+'</p></div>').join('')+'</section>';
}
function accessPage(){
 if(role!=='owner')return '<div class="empty">Pengaturan akses hanya untuk Pemilik.</div>';
 const labels={owner:'PEMILIK',editor:'EDITOR',viewer:'VIEWER'};
 const desc='<div class="access-rights"><div><strong>👑 Pemilik</strong><p>Mengatur seluruh data, gambar, hak akses, dan laporan.</p></div><div><strong>✎ Editor</strong><p>Mengelola APD karyawan dan pengembalian. Koreksi stok gudang, gambar, pengaturan, dan sinkron Excel hanya melalui Pemilik.</p></div><div><strong>◉ Viewer</strong><p>Melihat data monitoring tanpa mengubah data.</p></div></div>';
 const members=accessUsers.map(a=>'<tr><td>'+H(a.email)+'</td><td><span class="role-tag '+H(a.role)+'">'+(labels[a.role]||H(a.role))+'</span></td><td>'+(a.role==='owner'?'<span class="muted">Dikelola oleh Pemilik</span>':'<div class="access-change"><select aria-label="Ubah hak akses" onchange="changeAccessRole(\''+H(a.email)+'\',this.value)"><option value="editor" '+(a.role==='editor'?'selected':'')+'>Editor</option><option value="viewer" '+(a.role==='viewer'?'selected':'')+'>Viewer</option></select><button class="btn slim danger" onclick="removeAccess(\''+H(a.email)+'\')">Hapus</button></div>')+'</td></tr>').join('')||'<tr><td colspan="3">Belum ada pengguna terdaftar.</td></tr>';
 return heading('PENGATURAN PEMILIK','Pengaturan & Sinkronisasi','Sinkron Excel offline, atur akun Pemilik/Editor/Viewer, dan kelola keamanan APD.')+ownerOfflineSyncPanel()+desc+
 '<section class="panel"><div class="section-head"><div><h3>Tambahkan Editor / Viewer</h3><p>Gunakan alamat email akun KMB yang sudah terdaftar.</p></div><button class="btn" onclick="loadAccessUsers().then(render)">↻ Muat Ulang</button></div><form onsubmit="addRole(event)"><div class="formgrid"><label>Email Pengguna<input name="email" type="email" required placeholder="email akun KMB"></label><label>Hak Akses<select name="role"><option value="editor">Editor — Input dan Edit</option><option value="viewer">Viewer — Lihat dan Download Excel</option></select></label></div><div class="formactions"><button class="btn dark" type="submit">+ Simpan Akses</button></div></form></section>'+
 '<section class="panel" style="margin-top:17px"><div class="section-head"><h3>Daftar Pengguna APD ('+accessUsers.length+')</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Hak Akses</th><th>Tindakan</th></tr></thead><tbody>'+members+'</tbody></table></div></section>';
}
function imagesPage(){
 if(!ownerOnly())return '<div class="empty">Halaman gambar APD hanya untuk Pemilik.</div>';
 const imgs='<div class="image-settings-grid">'+TYPES.map(t=>'<div class="panel image-settings-card"><h3>'+H(ART[t].label)+'</h3><div class="image-settings-preview">'+icon(t)+'</div><small class="muted">Gambar disimpan ke data Monitoring APD. Tampilan kartu otomatis mengikuti gambar terbaru.</small>'+(ownerOnly()?'<label class="btn dark image-upload-label">↥ Pilih Gambar Baru<input type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadApdPicture(this,\''+t+'\')" hidden></label>'+(state.images?.[t]?'<button class="btn slim" onclick="centerExistingPicture(\''+t+'\')">◎ Tengahkan Gambar</button><button class="btn slim" onclick="restoreDefaultPicture(\''+t+'\')">Kembalikan Gambar Default</button>':''):'<div class="tag">Hanya dapat diedit oleh Pemilik</div>')+'</div>').join('')+'</div>';
 return heading('TAMPILAN','Gambar APD Utama','Ganti gambar Helm Safety, Kaos KMB, atau Sepatu Safety kapan saja.','<button class="btn" onclick="navigate(\'dashboard\')">← Dashboard</button>')+
 '<div class="notice">Pilih foto masing-masing APD. Sistem otomatis mengecilkan gambar maksimal 720 × 720 piksel dan memberi ruang kosong agar objek tidak terpotong. Gambar yang disimpan akan muncul juga di Dashboard dan Stok APD.</div>'+imgs;
}
async function recenterPicture(source){
 const picture=await new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Gambar tidak terbaca.'));
  img.src=source;
 });
 const scan=document.createElement('canvas');scan.width=picture.naturalWidth||picture.width;scan.height=picture.naturalHeight||picture.height;
 if(scan.width*scan.height>30000000)throw Error('Resolusi gambar terlalu besar.');
 const sc=scan.getContext('2d',{willReadFrequently:true});sc.drawImage(picture,0,0,scan.width,scan.height);
 const rgba=sc.getImageData(0,0,scan.width,scan.height).data;
 const edge=(x,y)=>{const p=(y*scan.width+x)*4;return rgba[p+3]>100&&rgba[p]>247&&rgba[p+1]>247&&rgba[p+2]>247};
 let whiteBorder=0,tot=0,step=Math.max(1,Math.floor(Math.min(scan.width,scan.height)/80));
 for(let x=0;x<scan.width;x+=step){whiteBorder+=edge(x,0)?1:0;whiteBorder+=edge(x,scan.height-1)?1:0;tot+=2}
 for(let y=0;y<scan.height;y+=step){whiteBorder+=edge(0,y)?1:0;whiteBorder+=edge(scan.width-1,y)?1:0;tot+=2}
 const backgroundWhite=whiteBorder/tot>.60;
 let minx=scan.width,miny=scan.height,maxx=-1,maxy=-1;
 const stride=Math.max(1,Math.floor(Math.max(scan.width,scan.height)/900));
 for(let y=0;y<scan.height;y+=stride)for(let x=0;x<scan.width;x+=stride){
  const p=(y*scan.width+x)*4,a=rgba[p+3];
  if(a<65)continue;
  if(backgroundWhite&&rgba[p]>245&&rgba[p+1]>245&&rgba[p+2]>245)continue;
  if(x<minx)minx=x;if(y<miny)miny=y;if(x>maxx)maxx=x;if(y>maxy)maxy=y;
 }
 if(maxx<0){minx=0;miny=0;maxx=scan.width-1;maxy=scan.height-1}
 const margin=Math.max(2,Math.round(Math.max(maxx-minx,maxy-miny)*.035));
 minx=Math.max(0,minx-margin);miny=Math.max(0,miny-margin);
 maxx=Math.min(scan.width-1,maxx+margin);maxy=Math.min(scan.height-1,maxy+margin);
 const cropW=maxx-minx+1,cropH=maxy-miny+1,scale=Math.min(580/cropW,580/cropH,1.8);
 const width=Math.round(cropW*scale),height=Math.round(cropH*scale);
 const box=document.createElement('canvas');box.width=720;box.height=720;
 const ctx=box.getContext('2d');if(!ctx)throw Error('Canvas tidak didukung browser.');
 ctx.drawImage(scan,minx,miny,cropW,cropH,(720-width)/2,(720-height)/2,width,height);
 let output=box.toDataURL('image/webp',.80);
 if(!output.startsWith('data:image/webp'))output=box.toDataURL('image/png');
 if(output.length>650000)throw Error('Gambar masih terlalu besar. Gunakan berkas JPG/WEBP dengan resolusi lebih kecil.');
 return output;
}
async function centerExistingPicture(type){
 if(!ownerOnly()||!TYPES.includes(type)||!state.images?.[type])return;
 try{const updated=await recenterPicture(state.images[type]);const d=structuredClone(state);d.images[type]=updated;await persist(d,'Gambar '+ART[type].label+' sudah berada di tengah.')}
 catch(e){showNotice('Gagal menengahkan gambar: '+e.message,'error')}
}
async function uploadApdPicture(input,type){
 if(!ownerOnly()||!TYPES.includes(type))return;
 const file=input.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return showNotice('Pilih gambar JPG, PNG, atau WEBP.','error');
 if(file.size>12*1024*1024)return showNotice('Ukuran awal gambar maksimal 12 MB.','error');
 input.disabled=true;
 try{
  const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Gagal membaca berkas'));reader.readAsDataURL(file)});
  const centered=await recenterPicture(raw);
  const next=structuredClone(state);next.images={...next.images,[type]:centered};
  await persist(next,'Gambar '+ART[type].label+' sudah diperkecil dan diposisikan di tengah.');
 }catch(e){showNotice('Gagal memproses gambar: '+e.message,'error')}
 finally{input.disabled=false}
}
function restoreDefaultPicture(type){
 if(!ownerOnly()||!TYPES.includes(type)||!confirm('Kembalikan gambar '+ART[type].label+' ke gambar bawaan?'))return;
 const next=structuredClone(state);next.images={...next.images};delete next.images[type];persist(next,'Gambar bawaan telah dipulihkan.');
}
async function changeAccessRole(email,newRole){
 if(role!=='owner')return;
 if(!['editor','viewer'].includes(newRole))return;
 const personRole=accessUsers.find(a=>a.email.toLowerCase()===email.toLowerCase());
 if(!personRole||personRole.role==='owner')return showNotice('Hak akses Pemilik tidak dapat diubah melalui menu ini.','error');
 if(personRole.role===newRole)return;
 const {error}=await db.from('app_access_roles').update({role:newRole}).eq('app_id','apd').eq('email',email).neq('role','owner');
 if(error)return showNotice('Gagal mengganti hak akses: '+error.message,'error');
 await loadAccessUsers();render();showNotice('Hak akses '+email+' berubah menjadi '+(newRole==='editor'?'Editor':'Viewer')+'.','success');
}
async function removeAccess(email){
 if(role!=='owner')return;
 const member=accessUsers.find(x=>x.email.toLowerCase()===email.toLowerCase());
 if(!member||member.role==='owner')return showNotice('Akses Pemilik tidak dapat dicabut melalui halaman ini.','error');
 if(!confirm('Hapus akses APD untuk '+email+'?'))return;
 const {error}=await db.from('app_access_roles').delete().eq('app_id','apd').eq('email',email).neq('role','owner');
 if(error)return showNotice('Gagal menghapus akses: '+error.message,'error');
 await loadAccessUsers();render();showNotice('Akses pengguna telah dicabut.','success');
}

// Penghapusan transaksi dibatasi untuk Pemilik; perubahan saldo dicek ulang oleh validate().
async function deleteApdRecord(kind,id){
 if(!can())return showNotice('Hanya Pemilik dan Editor yang dapat menghapus data APD.','error');
 const collection={stock:'stockIn',receipt:'receipts',return:'returns'}[kind];
 if(!collection)return;
 const record=state[collection].find(x=>x.id===id);
 if(!record)return showNotice('Data tidak ditemukan. Sinkronkan halaman terlebih dahulu.','error');
 if(kind==='receipt'&&state.returns.some(x=>x.receiptId===id))
  return showNotice('APD ini memiliki pengembalian. Hapus transaksi pengembaliannya terlebih dahulu melalui Riwayat Transaksi.','error');
 const label=kind==='stock'?'stok masuk':kind==='receipt'?'penerimaan APD':'pengembalian APD';
 const desc=(kind==='return'?'':kind==='stock'?'':personName(record.person)+' · ')+(record.type||state.receipts.find(x=>x.id===record.receiptId)?.type||'APD')+' · '+fmt(record.date)+' · '+record.qty+' unit';
 if(!confirm('Hapus permanen '+label+'?\\n'+desc+'\\n\\nSaldo stok, jumlah kepemilikan dan dashboard akan dihitung ulang. Tindakan ini tidak dapat dibatalkan.'))return;
 const next=structuredClone(state);
 next[collection]=next[collection].filter(x=>x.id!==id);
 const issue=validate(next);
 if(issue)return showNotice('Tidak dapat menghapus karena akan membuat data stok tidak valid: '+issue,'error');
 await persist(next,'Data '+label+' berhasil dihapus. Dashboard dan stok telah dihitung ulang.');
}
/* Pengaturan cetak manual seperti monitoring KTA-TRA, tidak mengubah layout tersimpan. */
let apdPrintScale=100,apdPrintOrientation='landscape',apdPrintOnePage=false;
function openPrintSettings(){
 if(!user||!role)return showNotice('Silakan login sebelum mencetak.','error');
 modal('Pengaturan Print Monitoring APD',
 '<div class="notice">Atur tampilan khusus cetak. Pengaturan ini tidak mengubah susunan Dashboard yang disimpan.</div>'+
 '<div class="formgrid"><label>Orientasi Kertas<select id="apdPrintOrientation"><option value="landscape" '+(apdPrintOrientation==='landscape'?'selected':'')+'>Landscape / Mendatar</option><option value="portrait" '+(apdPrintOrientation==='portrait'?'selected':'')+'>Portrait / Tegak</option></select></label>'+
 '<label>Skala Dashboard (%)<input id="apdPrintScale" type="number" min="25" max="100" step="5" value="'+apdPrintScale+'"></label>'+
 '<label class="wide"><input id="apdPrintOnePage" type="checkbox" '+(apdPrintOnePage?'checked':'')+'> Kecilkan otomatis agar muat 1 lembar (tampilan bisa menjadi kecil)</label></div>'+
 '<div class="formactions"><button type="button" class="btn" onclick="closeModal()">Batal</button><button type="button" class="btn dark" onclick="startApdPrint()">Terapkan & Print</button></div>');
}
function startApdPrint(){
 const n=Number(el('apdPrintScale')?.value);
 if(!Number.isFinite(n)||n<25||n>100)return showNotice('Masukkan skala 25–100%.','error');
 apdPrintScale=n;apdPrintOrientation=el('apdPrintOrientation')?.value==='portrait'?'portrait':'landscape';
 apdPrintOnePage=!!el('apdPrintOnePage')?.checked;
 const old=document.getElementById('apd-print-settings');if(old)old.remove();
 const style=document.createElement('style');style.id='apd-print-settings';
 const landscape=apdPrintOrientation==='landscape';
 const dashboard=document.querySelector('.apd-dashboard');
 // Use the natural paper width; don't zoom out a fixed-width 1050px dashboard.
 // Only apply shrinking when the user explicitly enables fit-to-one-page.
 const screenHeight=dashboard?.scrollHeight||0;
 const paperHeightPx=landscape?710:1035;
 const requested=apdPrintScale/100;
 const fit=apdPrintOnePage&&page==='dashboard'&&screenHeight>0?
   Math.min(requested,Math.max(.25,(paperHeightPx-50)/screenHeight)):requested;
 const zoom=fit.toFixed(3);
 style.textContent='@page{size:A4 '+apdPrintOrientation+';margin:8mm}'+
 '@media print{#app{display:block!important;width:100%!important;max-width:100%!important}'+
 '.apd-dashboard{zoom:'+zoom+'!important;width:'+Math.round(100/fit)+'%!important;max-width:none!important;margin:0 auto!important}'+
 '.apd-editable-layout{grid-template-columns:repeat(2,minmax(0,1fr))!important}'+
 '.apd-editable-layout .apd-layout-wide{grid-column:1/-1!important}'+
 '.apd-gradient-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important}}';
 document.head.appendChild(style);
 closeModal();window.print();
}
window.addEventListener('afterprint',()=>document.getElementById('apd-print-settings')?.remove());
function modal(title,body){
 el('modalTitle').textContent=title;el('modalBody').innerHTML=body;el('modalBack').hidden=false;
}
function closeModal(){el('modalBack').hidden=true;el('modalBody').innerHTML=''}
function formButtons(label){return '<div class="formactions"><button class="btn" type="button" onclick="closeModal()">Batal</button><button class="btn dark" type="submit">'+H(label)+'</button></div>'}

function editWarehouseStock(type){
 if(!ownerOnly()||!TYPES.includes(type))return;
 const existing=state.stockIn.filter(t=>t.type===type).sort((a,b)=>b.date.localeCompare(a.date));
 const values=stock(type),minimum=Math.max(0,Number(state.limits?.[type]||0));
 const rows=existing.map(t=>'<div class="warehouse-edit-row"><div><strong>'+fmt(t.date)+' · '+(t.grade==='NEW'?'Barang baru':'Bekas layak')+'</strong><small>'+t.qty+' unit masuk'+(t.location?' · '+H(t.location):'')+'</small></div><div class="toolbarend"><button class="btn slim" onclick="stockForm(\''+H(t.id)+'\')">✎ Edit Transaksi</button><button class="btn slim danger" onclick="deleteApdRecord(\'stock\',\''+H(t.id)+'\')">Hapus</button></div></div>').join('')||'<div class="notice">Belum ada transaksi stok masuk '+ART[type].label+'. Jika ingin mengisi stok gudang, gunakan Tambah Stok Masuk.</div>';
 modal('Edit Stok Gudang · '+ART[type].label,
  '<div class="notice">Saldo gudang dihitung otomatis dari <b>stok masuk, pembagian, dan pengembalian APD</b>. Edit catatan stok masuk di bawah tanpa membuat duplikat. Pengembalian APD dikoreksi pada menu Riwayat Transaksi.</div>'+
  '<div class="warehouse-edit-summary"><span><small>Stok Baru</small><strong>'+values.NEW+'</strong></span><span><small>Bekas Layak</small><strong>'+values.REUSE+'</strong></span><span><small>Total</small><strong>'+(values.NEW+values.REUSE)+'</strong></span></div>'+
  '<form onsubmit="saveMinimumStock(event,\''+type+'\')" class="warehouse-min-form"><label>Minimal stok '+ART[type].label+' (unit)<input name="minimum" type="number" min="0" step="1" required value="'+minimum+'"></label><button class="btn dark" type="submit">Simpan Min. Stok</button></form>'+
  '<div class="section-head" style="margin-top:22px"><h3>Riwayat Stok Masuk</h3><button class="btn dark slim" onclick="stockForm(null,\''+type+'\')">+ Tambah Stok Masuk</button></div>'+
  '<div class="warehouse-edit-list">'+rows+'</div>');
}
function saveMinimumStock(event,type){
 event.preventDefault();
 if(!ownerOnly()||!TYPES.includes(type))return;
 const value=Number(new FormData(event.target).get('minimum'));
 if(!Number.isSafeInteger(value)||value<0)return showNotice('Minimal stok harus bilangan bulat nol atau lebih.','error');
 const next=structuredClone(state);
 next.limits={...next.limits,[type]:value};
 persist(next,'Minimal stok '+ART[type].label+' berhasil diperbarui.');
}

function stockForm(id,type){
 if(!ownerOnly())return;
 const x=state.stockIn.find(t=>t.id===id)||{date:today(),type:TYPES.includes(type)?type:'HELM',grade:'NEW',qty:1,location:'',note:'',variant:''};
 modal(id?'Edit Stok Gudang':'Tambah Stok Masuk','<div class="notice">Hanya untuk barang yang ada di gudang. <b>APD lama yang dimiliki karyawan tidak dicatat sebagai stok gudang.</b></div><form onsubmit="saveStock(event,\''+H(id||'')+'\')"><div class="formgrid"><label>Tanggal Stok Masuk<input name="date" type="date" required value="'+H(x.date)+'"></label><label>Jenis APD<select name="type" id="apdTypeSelect" onchange="syncVariant()">'+TYPES.map(t=>'<option '+(x.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+vForm(x.type,x.variant||(id?'BELUM DIISI':''))+'<label>Kondisi Stok<select name="grade"><option value="NEW" '+(x.grade==='NEW'?'selected':'')+'>Barang Baru</option><option value="REUSE" '+(x.grade==='REUSE'?'selected':'')+'>Barang Bekas Layak (Stok Awal)</option></select></label><label>Jumlah Unit<input name="qty" type="number" min="1" step="1" required value="'+x.qty+'"></label><label>Lokasi Gudang<input name="location" list="apdWarehouseLocations" value="'+H(x.location||'')+'" placeholder="Pilih atau isi lokasi gudang"><datalist id="apdWarehouseLocations"><option value="Workshop"></option></datalist></label><label>Keterangan<input name="note" value="'+H(x.note||'')+'"></label></div>'+formButtons(id?'Simpan Perubahan Stok':'Simpan Stok Masuk')+'</form>'+(id?'<div class="formactions"><button class="btn danger" type="button" onclick="deleteApdRecord(\'stock\',\''+H(id)+'\')">Hapus Transaksi Stok Ini</button></div>':''));
}
function saveStock(e,id){
 e.preventDefault();if(!ownerOnly())return showNotice('Perubahan stok hanya dapat dilakukan oleh Pemilik.','error');const f=Object.fromEntries(new FormData(e.target)),next=structuredClone(state);
 const value={id:id||uid(),date:f.date,type:f.type,grade:f.grade,variant:f.variant,qty:Number(f.qty),location:f.location,note:f.note};
 if(id){const i=next.stockIn.findIndex(x=>x.id===id);if(i<0)return showNotice('Transaksi stok tidak ditemukan.','error');next.stockIn[i]=value}
 else next.stockIn.push(value);
 persist(next,'Stok APD berhasil disimpan. Dashboard diperbarui.');
}
function receiptForm(personId,type,id,defaultSource){
 if(!can())return;
 const p=person(personId);
 if(!p)return showNotice('Karyawan tidak ditemukan. Tekan Sinkronkan.','error');
 const r=state.receipts.find(x=>x.id===id)||{person:personId,type,date:today(),qty:1,source:defaultSource||'OLD',condition:'BELUM DIPERIKSA',months:6,note:'',variant:'',warehouse:''};
 modal(id?'Edit Penerimaan · '+p.name:(r.source==='OLD'?'Catat APD Lama · ':'Tambah APD · ')+p.name,
 '<div class="notice"><b>APD LAMA:</b> Sudah dimiliki karyawan, tidak mengurangi gudang dan tidak membuat jadwal ganti. <b>APD BARU / BEKAS GUDANG:</b> Mengurangi stok gudang. <b>PT. KKA / Toko Lainnya:</b> Tercatat sebagai penerimaan tanpa mengurangi stok.</div>'+
 '<form onsubmit="saveReceipt(event,\''+H(id||'')+'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(p.name)+'"><input type="hidden" name="person" value="'+H(p.id)+'"></label><label>Jobsite<input readonly value="'+H(p.site)+'"></label>'+
 '<label>Jenis APD<select name="type" id="apdTypeSelect" onchange="syncVariant()">'+TYPES.map(t=>'<option '+(r.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+vForm(r.type,r.variant||(id?'BELUM DIISI':''))+
 '<label>Asal APD<select name="source" id="receiptSource" onchange="receiptMode()"><option value="OLD" '+(r.source==='OLD'?'selected':'')+'>APD Lama yang Sudah Dimiliki</option><option value="NEW" '+(r.source==='NEW'?'selected':'')+'>APD Baru dari Gudang</option><option value="REUSE" '+(r.source==='REUSE'?'selected':'')+'>APD Bekas Layak dari Gudang</option><option value="EXTERNAL" '+(r.source==='EXTERNAL'?'selected':'')+'>APD Langsung dari Pihak Luar</option></select></label>'+
 '<label id="warehouseReceiptWrap"><span id="receiptWarehouseLabel">Asal Gudang</span><input name="warehouse" id="warehouseReceipt" list="receiptWarehouseList" value="'+H(r.warehouse||'')+'" placeholder="Contoh: Workshop"><datalist id="receiptWarehouseList"><option value="Workshop"></option><option value="PT. KKA"></option><option value="Toko Lainnya"></option>'+[...new Set(state.stockIn.map(x=>x.location).filter(Boolean))].map(x=>'<option value="'+H(x)+'"></option>').join('')+'</datalist></label>'+
 '<label>Tanggal Diterima<input name="date" type="date" required value="'+H(r.date)+'"></label><label>Jumlah yang Diterima<input name="qty" type="number" min="1" step="1" required value="'+r.qty+'"></label>'+
 '<label>Kondisi APD Saat Ini<select name="condition"><option '+(r.condition==='BELUM DIPERIKSA'?'selected':'')+'>BELUM DIPERIKSA</option><option '+(r.condition==='LAYAK'?'selected':'')+'>LAYAK</option><option '+(r.condition==='TIDAK LAYAK'?'selected':'')+'>TIDAK LAYAK</option></select></label>'+
 '<label id="monthsWrap">Jatah Penggantian (bulan)<input name="months" type="number" min="1" max="120" step="1" value="'+(r.months||6)+'"><span class="muted" style="font-size:10px">Tanggal penerimaan + jumlah bulan = jatah penggantian.</span></label>'+
 '<label class="wide">Keterangan / Bukti<input name="note" value="'+H(r.note||'')+'"></label></div><div class="notice" id="receiptHint"></div>'+formButtons(id?'Simpan Perubahan APD':'Simpan Penerimaan APD')+'</form>');
 receiptMode();
}
function receiptMode(){
 const source=el('receiptSource')?.value,old=source==='OLD',external=source==='EXTERNAL';
 const m=el('monthsWrap'),hint=el('receiptHint'),w=el('warehouseReceiptWrap');
 if(w)w.hidden=old;
 if(el('receiptWarehouseLabel'))el('receiptWarehouseLabel').textContent=external?'Asal APD Eksternal':'Asal Gudang';
 if(el('warehouseReceipt'))el('warehouseReceipt').placeholder=external?'Pilih PT. KKA atau Toko Lainnya':'Contoh: Workshop';
 if(el('warehouseReceipt'))el('warehouseReceipt').required=!old;
 if(m)m.hidden=old;
 if(hint)hint.innerHTML=old?'APD lama tidak mengurangi stok gudang.':external?'APD dari pihak luar tidak mengurangi stok gudang; jadwal dan riwayat penerimaan tetap dicatat.':'Stok gudang akan dikurangi sesuai penerimaan.';
}
function saveReceipt(e,id){
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),next=structuredClone(state);
 if(f.source!=='OLD'&&!String(f.warehouse||'').trim())return showNotice('Pilih asal APD untuk pembagian.','error');
 if(f.source==='EXTERNAL'&&!['PT. KKA','Toko Lainnya'].includes(String(f.warehouse||'').trim()))return showNotice('Pilih PT. KKA atau Toko Lainnya sebagai sumber APD eksternal.','error');
 const value={id:id||uid(),person:f.person,type:f.type,date:f.date,qty:Number(f.qty),source:f.source,warehouse:f.source==='OLD'?'':String(f.warehouse||'').trim(),variant:f.variant,months:f.source==='OLD'?0:Number(f.months||6),condition:f.condition,note:f.note};
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
 if(error)showNotice('Gagal menambahkan akses: '+error.message,'error');else{e.target.reset();await loadAccessUsers();render();showNotice('Hak akses Monitoring APD berhasil disimpan.','success')}
}

function exportOldExcel(){
 if(!ownerOnly())return showNotice('Download Excel lengkap hanya untuk Pemilik.','error');
 if(!user||!role)return showNotice('Silakan masuk terlebih dahulu untuk download Excel.','error');
 const XLSX=window.XLSX;
 if(!XLSX?.utils||!XLSX.writeFile)return showNotice('Komponen Excel belum termuat. Periksa koneksi internet lalu refresh halaman.','error');
 const book=XLSX.utils.book_new();
 const add=(title,rows,widths)=>{
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=widths.map(w=>({wch:w}));
  if(rows.length>1)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:rows[0].length-1}})};
  XLSX.utils.book_append_sheet(book,ws,title);
 };
 const total=TYPES.reduce((n,t)=>{const s=stock(t);return n+s.NEW+s.REUSE},0);
 add('RINGKASAN',[
  ['MONITORING APD PT KARUNIA MANDIRI BERKARYA'],
  ['Tanggal Ekspor',today()],
  ['Total Manpower Aktif',people.filter(p=>p.status==='AKTIF').length],
  ['Total Manpower Keluar',people.filter(p=>p.status==='OUT').length],
  ['Total Stok Gudang',total],
  [],
  ['Jenis APD','Stok Baru','Stok Bekas Layak','Total Stok Gudang','APD Dipegang','APD Dimusnahkan','Minimal Stok','Jatuh Tempo'],
  ...TYPES.map(t=>{const x=stock(t);return [t,x.NEW,x.REUSE,x.NEW+x.REUSE,people.reduce((n,p)=>n+held(p.id,t),0),x.DESTROYED,Number(state.limits?.[t]||0),schedules().filter(y=>y.t===t&&y.days<=0).length]})
 ],[29,20,22,23,22,23,18,18]);
 add('KARYAWAN',[
  ['Nama','Jabatan','Jobsite','Status','Helm Dipegang','Helm Terakhir','Helm Ganti','Kaos Dipegang','Kaos Terakhir','Kaos Ganti','Sepatu Dipegang','Sepatu Terakhir','Sepatu Ganti'],
  ...people.map(p=>[p.name,p.position,p.site,p.status,...TYPES.flatMap(t=>[held(p.id,t),latest(p.id,t)?.date||'',due(p.id,t)||''])])
 ],[28,23,25,14,17,18,18,17,18,18,19,19,19]);
 add('STOK MASUK',[
  ['Tanggal Masuk','Jenis APD','Kondisi','Jumlah','Lokasi Gudang','Keterangan','ID Transaksi'],
  ...state.stockIn.map(x=>[x.date,x.type,x.grade==='NEW'?'Baru':'Bekas layak',Number(x.qty),x.location||'',x.note||'',x.id])
 ],[20,18,20,12,30,40,39]);
 add('PENERIMAAN APD',[
  ['Nama Karyawan','Jabatan','Jobsite','Status MP','Jenis APD','Asal APD','Tanggal Terima','Jumlah Terima','Masih Dipegang','Kondisi','Jatah Bulan','Tanggal Ganti','Keterangan','ID Transaksi'],
  ...state.receipts.map(r=>{const p=person(r.person);return [p?.name||r.person,p?.position||'',p?.site||'',p?.status||'',r.type,r.source==='OLD'?'APD Lama':r.source==='NEW'?'Baru':'Bekas layak',r.date,Number(r.qty),heldLot(r),r.condition||'',r.source==='OLD'?'':Number(r.months||6),r.source==='OLD'?'':addMonths(r.date,r.months),r.note||'',r.id]})
 ],[29,24,27,14,18,18,18,17,19,19,15,19,38,39]);
 add('PENGEMBALIAN',[
  ['Tanggal Kembali','Nama Karyawan','Jenis APD','Jumlah Kembali','Hasil Pemeriksaan','Keterangan','ID Riwayat','ID Penerimaan'],
  ...state.returns.map(r=>{const receipt=state.receipts.find(x=>x.id===r.receiptId);return [r.date,receipt?personName(receipt.person):'',receipt?.type||'',Number(r.qty),r.action==='REUSE'?'Layak - dipakai ulang':'Tidak layak - dimusnahkan',r.note||'',r.id,r.receiptId]})
 ],[21,28,18,20,32,40,39,39]);
 add('JADWAL GANTI',[
  ['Nama Karyawan','Jabatan','Jobsite','Jenis APD','Penerimaan Terakhir','Jatah Bulan','Jadwal Penggantian','Sisa Hari','Status'],
  ...schedules().map(x=>[x.p.name,x.p.position,x.p.site,x.t,x.x.date,Number(x.x.months),x.d,x.days,x.days<=0?'JATUH TEMPO':x.days<=30?'SEGERA':'TERJADWAL'])
 ],[29,25,27,17,22,17,25,14,20]);
 try{XLSX.writeFile(book,'Monitoring_APD_KMB_'+today()+'.xlsx',{compression:true})}
 catch(e){showNotice('Gagal menyiapkan file Excel: '+e.message,'error')}
}

function backup(){
 if(!ownerOnly())return showNotice('Backup data lengkap hanya untuk Pemilik.','error');
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
