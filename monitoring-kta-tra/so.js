(function(){
"use strict";
const str=v=>String(v==null?"":v).trim();
const upper=v=>str(v).toUpperCase();
const escapeHTML=v=>str(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const vacant=v=>!str(v)||upper(v)==="VACANT";
function section(r){
 const s=upper(r["Section Job"]),job=upper(r.Jabatan);
 if(s&&s!=="BELUM DITENTUKAN")return s;
 if(/TYRE|TIRE/.test(job))return "TYRE SECTION";
 if(/PLANNER|ADMIN/.test(job))return "PLANNER SECTION";
 if(/MEKANIK|MECHANIC|WELDER|ELECTRIC|HELPER/.test(job))return "MAINTENANCE SECTION";
 return "BELUM DITENTUKAN";
}
function scope(r){
 const s=upper(r["Scope Job"]||r.Job||r["Sub Section Job"]);
 if(s)return s;
 const job=upper(r.Jabatan);
 if(/WELDER/.test(job))return "CREW WELDER";
 if(/ELECTRIC/.test(job))return "CREW ELECTRIC";
 if(/TYRE.*STOR|TYRE.*SPOR/.test(job))return "TYRE STORING";
 if(/TYRE.*INSPECT|SENIOR TYRE/.test(job))return "TYRE INSPECTOR";
 if(/TYRE/.test(job))return "TYRE REPAIR";
 if(/ADMIN/.test(job))return "PLANT ADMIN";
 if(/PLANNER/.test(job))return "PLANNING";
 return "BELUM DITENTUKAN";
}
function card(r){
 const title=escapeHTML(r.Jabatan||"-"),name=vacant(r.Nama)?"VACANT":escapeHTML(r.Nama);
 return '<div class="so7-card"><div class="so7-role">'+title+'</div><div class="so7-name'+(vacant(r.Nama)?" so7-vacant":"")+'">'+name+'</div></div>';
}
function group(title,items){
 return '<section class="so7-group"><div class="so7-group-title">'+escapeHTML(title)+'</div><div class="so7-people">'+items.map(card).join("")+'</div></section>';
}
function draw(){
 const host=document.getElementById("soContent");if(!host)return;
 try{
 if(typeof data==="undefined"||!Array.isArray(data.mpp)){host.textContent="Menunggu data MPP…";return}
 const rows=data.mpp;
 if(!rows.length){host.textContent="MPP belum memiliki data.";return}
 const order=(a,b)=>Number(a["Urutan SO"]||a.No||999)-Number(b["Urutan SO"]||b.No||999);
 const dept=rows.filter(r=>/^(DEPT|DEPARTMENT)\s*HEAD/.test(upper(r.Jabatan))).sort(order);
 const head=rows.filter(r=>/^SECTION\s*HEAD/.test(upper(r.Jabatan))).sort(order);
 const regular=rows.filter(r=>!dept.includes(r)&&!head.includes(r));
 const sections=["MAINTENANCE SECTION","PLANNER SECTION","TYRE SECTION"];
 const allSections=[...sections,...new Set(regular.map(section))].filter((x,i,a)=>a.indexOf(x)===i);
 const body=allSections.map(sec=>{
  const entries=regular.filter(r=>section(r)===sec).sort(order);
  if(!entries.length)return "";
  const scopes=[...new Set(entries.map(scope))];
  return '<div class="so7-section"><div class="so7-section-name">'+escapeHTML(sec)+'</div><div class="so7-scopes">'+scopes.map(sc=>group(sc,entries.filter(r=>scope(r)===sc))).join("")+'</div></div>';
 }).join("");
 let tops=dept.concat(head);if(!tops.length)tops=[rows[0]];
 const other=regular.filter(r=>!allSections.includes(section(r)));
 host.innerHTML='<div class="so7-paper"><header class="so7-heading"><b>STRUKTUR ORGANISASI</b><div>PLANT DEPARTMENT KMB SITE KTA</div><strong>TAHUN 2026</strong></header><div class="so7-top">'+group("PENANGGUNG JAWAB OPERASIONAL",tops)+'</div><div class="so7-link"></div><div class="so7-sections">'+body+'</div>'+(other.length?group("BELUM DITENTUKAN",other):"")+'<p class="so7-note">SO otomatis membaca nama, jabatan, Scope Job, dan Section Job dari MPP. Tidak perlu mengisi bagan secara terpisah.</p></div>';
 }catch(error){console.error("SO render error:",error);host.textContent="Bagan gagal dimuat: "+error.message}
}
window.renderKtaSO=draw;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",draw);else draw();
})();