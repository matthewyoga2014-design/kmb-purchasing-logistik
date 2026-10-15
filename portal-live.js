/* KMB Portal: read-only, privacy-conscious live manpower summaries.
   Reads only public sanitized app_state_public; never reads private MP records. */
(function(){
"use strict";
const ids=[
 {id:"kta-tra",name:"Monitoring KTA–TRA",href:"./monitoring-kta-tra/"},
 {id:"kmb",name:"Monitoring KMB",href:"./monitoring-manpower-kmb/"},
 {id:"bupr-ampah",name:"Monitoring BUPR Ampah",href:"./monitoring-bupr-ampah/"},
 {id:"mbj",name:"Monitoring MBJ",href:"./monitoring-mbj/"}
];
const root=document.getElementById("liveManpower");if(!root)return;
const status=document.getElementById("liveStatus"),updated=document.getElementById("liveUpdated");
const refreshBtn=document.getElementById("liveRefresh");
let db=null,locked=false,loaded={},lastUpdate={},channel=null;
const fmt=n=>Number(n||0).toLocaleString("id-ID");
const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const vacant=name=>{const s=String(name??"").trim().toLowerCase();return !s||s==="vacant"};
function rowsFor(id,snapshot){
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))throw Error("Format data tidak valid");
 if(id==="kmb"){
   if(!snapshot.sites||typeof snapshot.sites!=="object"||Array.isArray(snapshot.sites))throw Error("Data jobsite belum tersedia");
   return Object.entries(snapshot.sites).flatMap(([site,rows])=>Array.isArray(rows)?rows.filter(r=>r&&typeof r==="object").map(r=>({...r,__site:site})):[]);
 }
 if(!Array.isArray(snapshot.mpp))throw Error("Data MPP belum tersedia");
 return snapshot.mpp.filter(r=>r&&typeof r==="object");
}
function summarize(raw,id){
 const rows=rowsFor(id,raw);
 const roles=new Map(), sites=new Map();
 rows.forEach(row=>{
   const job=String(row.Jabatan||"Belum ditentukan").trim()||"Belum ditentukan";
   const key=job.toLocaleLowerCase("id-ID").replace(/\s+/g," ").replace(/\bmidle\b/g,"middle");
   const wasVacant=vacant(row.Nama);
   if(!roles.has(key))roles.set(key,{name:job,plan:0,vacant:0});
   const item=roles.get(key);item.plan++;if(wasVacant)item.vacant++;
   if(id==="kmb"){
     const site=String(raw.siteLabels?.[row.__site]||row.__site);
     if(!sites.has(site))sites.set(site,{plan:0,vacant:0,roles:new Map()});
     const bucket=sites.get(site);bucket.plan++;if(wasVacant)bucket.vacant++;
     if(!bucket.roles.has(key))bucket.roles.set(key,{name:job,plan:0,vacant:0});
     const sub=bucket.roles.get(key);sub.plan++;if(wasVacant)sub.vacant++;
   }
 });
 const plan=rows.length,vacCount=rows.filter(r=>vacant(r.Nama)).length;
 return {plan,actual:plan-vacCount,vacant:vacCount,roles:[...roles.values()],sites};
}
function setStatus(type,text){
 if(status)status.innerHTML='<span class="live-dot '+type+'"></span>'+escape(text);
}
function renderRows(roles){
 return '<div class="live-tablewrap"><table class="live-table"><thead><tr><th>Jabatan / Posisi</th><th>Planning</th><th>Actual</th><th>Vacant</th></tr></thead><tbody>'+
 roles.slice().sort((a,b)=>(b.vacant-a.vacant)||(b.plan-a.plan)||a.name.localeCompare(b.name,"id")).map(x=>'<tr><td>'+escape(x.name)+'</td><td>'+fmt(x.plan)+'</td><td>'+fmt(x.plan-x.vacant)+'</td><td class="'+(x.vacant?"v":"")+'">'+fmt(x.vacant)+'</td></tr>').join("")+
 '</tbody></table></div>';
}
function renderPanel(info,result){
 const n=result,percentage=n.plan?Math.round(n.actual/n.plan*100):0;
 const names=n.roles.filter(r=>r.vacant>0).sort((a,b)=>b.vacant-a.vacant);
 const chips=names.length?names.map(r=>'<span class="live-chip">'+escape(r.name)+' · '+fmt(r.vacant)+'</span>').join(""):'<span class="live-chip empty">Tidak ada vacant</span>';
 let table=renderRows(n.roles);
 if(info.id==="kmb"){
   const sites=[...n.sites.entries()].map(([site,x])=>'<h4 class="live-label">'+escape(site)+' <span style="font-weight:500;color:#69798a">('+fmt(x.plan)+' planning · '+fmt(x.vacant)+' vacant)</span></h4>'+renderRows([...x.roles.values()])).join("");
   table+='<div style="margin-top:15px"><b class="live-label">Rincian berdasarkan jobsite</b>'+sites+'</div>';
 }
 return '<article class="live-panel"><div class="live-panel-head"><h3>'+escape(info.name)+'</h3><a class="live-panel-link" href="'+info.href+'">Buka ↗</a></div>'+
 '<p class="live-panel-meta">Sumber: data monitoring tersimpan · hanya ringkasan jabatan</p>'+
 '<div class="live-numbers"><div class="live-number"><small>Planning</small><strong>'+fmt(n.plan)+'</strong></div><div class="live-number"><small>Actual</small><strong>'+fmt(n.actual)+'</strong></div><div class="live-number alert"><small>Vacant</small><strong>'+fmt(n.vacant)+'</strong></div></div>'+
 '<div class="live-bar"><div class="live-bar-fill" style="width:'+percentage+'%"></div></div><div class="live-ratio">'+percentage+'% terpenuhi</div>'+
 '<div class="live-label">Posisi yang masih vacant</div><div class="live-vacant-list">'+chips+'</div>'+
 '<details class="live-details" open><summary>Rincian Manpower Planning per jabatan</summary>'+table+'</details></article>';
}
function render(){
 const good=ids.filter(info=>loaded[info.id]?.value);
 const complete=good.length===4;
 const errors=ids.filter(info=>loaded[info.id]?.error);
 if(complete){
  const total=good.reduce((out,info)=>{const x=loaded[info.id].value;out.plan+=x.plan;out.actual+=x.actual;out.vacant+=x.vacant;return out;},{plan:0,actual:0,vacant:0});
  document.getElementById("liveTotals").innerHTML=[["Total Planning",total.plan,""],["Total Actual",total.actual,""],["Total Vacant",total.vacant,"vac"]].map(([label,num,cls])=>'<div class="live-kpi '+cls+'"><span>'+label+'</span><b>'+fmt(num)+'</b></div>').join("");
 }else document.getElementById("liveTotals").innerHTML='<div class="live-loading" style="grid-column:1/-1">'+(good.length?'Sebagian data berhasil dimuat. Total gabungan menunggu empat sumber lengkap.':'Menyiapkan ringkasan empat monitoring…')+'</div>';
 root.innerHTML=ids.map(info=>loaded[info.id]?.value?renderPanel(info,loaded[info.id].value):'<article class="live-panel"><div class="live-panel-head"><h3>'+escape(info.name)+'</h3><a class="live-panel-link" href="'+info.href+'">Buka ↗</a></div>'+(loaded[info.id]?.error?'<div class="live-error">'+escape(loaded[info.id].error)+'</div>':'<div class="live-loading">Mengambil data live…</div>')+'</article>').join("");
 if(errors.length){setStatus("warn",good.length+" dari 4 sumber aktif");}
 else if(complete){setStatus("ok","Live · otomatis 30 detik");}
 else setStatus("","Memuat data…");
 const dates=Object.values(lastUpdate).filter(Boolean);
 if(updated)updated.textContent=dates.length?'Terakhir diperiksa: '+new Date(Math.max(...dates)).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):'Belum ada data yang berhasil dimuat';
}
async function refresh(){
 if(locked)return;
 locked=true;if(refreshBtn)refreshBtn.disabled=true;
 const config=window.KMB_SUPABASE_CONFIG;
 if(!db && window.supabase?.createClient && config?.url && config?.publishableKey){
   db=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 }
 if(!db){
   ids.forEach(info=>{if(!loaded[info.id]?.value)loaded[info.id]={error:"Koneksi database belum tersedia. Coba muat ulang halaman."}});
   setStatus("error","Koneksi tidak tersedia");render();locked=false;if(refreshBtn)refreshBtn.disabled=false;return;
 }
 try{
  const {data,error}=await db.from("app_state_public").select("app_id,data,updated_at").in("app_id",ids.map(x=>x.id));
  if(error)throw error;
  const byId=new Map((data||[]).map(row=>[row.app_id,row]));
  ids.forEach(info=>{
   const row=byId.get(info.id);
   if(!row){loaded[info.id]={error:"Data monitoring belum tersedia di database."};return}
   try{
     loaded[info.id]={value:summarize(row.data,info.id)};
     lastUpdate[info.id]=Date.now();
   }catch(err){loaded[info.id]={error:"Format data belum dapat dibaca."}}
  });
 }catch(err){
  ids.forEach(info=>{loaded[info.id]={error:"Gagal terhubung ke data monitoring. Silakan coba lagi."}});
 }
 render();locked=false;if(refreshBtn)refreshBtn.disabled=false;
}
refreshBtn?.addEventListener("click",refresh);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
window.addEventListener("focus",()=>{if(!document.hidden)refresh()});
const timer=window.setInterval(()=>{if(!document.hidden)refresh()},30000);
window.addEventListener("pagehide",()=>window.clearInterval(timer),{once:true});
refresh();
})();