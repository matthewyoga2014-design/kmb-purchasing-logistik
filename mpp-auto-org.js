/* Read-only SmartArt-style organization view generated directly from MPP.
   Editing the hierarchy takes place in MPP's Section Job / Job fields. */
(function(){
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function dataGroups(){
 try{
 const d=typeof data!=="undefined"?data:null;if(!d)return[];
 return d.sites?Object.entries(d.sites).map(([key,rows])=>({site:d.siteLabels?.[key]||key,rows:rows||[]})):[{site:"",rows:d.mpp||[]}];
 }catch(e){return []}
}
function vacant(name){return !String(name||"").trim()||/^vacant$/i.test(String(name).trim())}
function update(){
 const host=document.getElementById("soAutoContent");if(!host)return;
 const groups=dataGroups();
 host.innerHTML=groups.map(g=>{
 const sections=new Map();
 g.rows.forEach(r=>{
 const section=String(r["Section Job"]||"Belum ditentukan").trim();
 const job=String(r["Job"]??r["Scope Job"]??"Belum ditentukan").trim()||"Belum ditentukan";
 if(!sections.has(section))sections.set(section,new Map());
 const jobs=sections.get(section);if(!jobs.has(job))jobs.set(job,[]);
 jobs.get(job).push(r);
 });
 const sectionHtml=[...sections].map(([section,jobs])=>'<div class="auto-section"><div class="auto-section-title">'+esc(section)+'</div><div class="auto-joblist">'+[...jobs].map(([job,rows])=>'<div class="auto-job"><div class="auto-job-title">'+esc(job)+'</div>'+rows.map(r=>'<div class="auto-person"><b>'+esc(r.Jabatan||"-")+'</b><span class="'+(vacant(r.Nama)?"auto-vacant":"")+'">'+esc(vacant(r.Nama)?"VACANT":r.Nama)+'</span></div>').join("")+'</div>').join("")+'</div></div>').join("");
 return '<div class="auto-site">'+(g.site?'<h3>'+esc(g.site)+'</h3>':'')+'<div class="auto-sections">'+sectionHtml+'</div></div>';
 }).join("");
 const empty=groups.every(g=>g.rows.length===0);if(empty)host.innerHTML='<p>Belum ada data MPP.</p>';
}
function setup(){
 const nav=document.getElementById("sidebar"),content=document.querySelector(".content");if(!nav||!content||document.getElementById("auto-org"))return;
 const b=document.createElement("button");b.className="nav";b.dataset.view="auto-org";b.dataset.title="Struktur Organisasi Otomatis";b.innerHTML="♧ &nbsp; Struktur Organisasi";b.onclick=()=>{if(typeof showView==="function")showView("auto-org");update()};
 const sys=[...nav.querySelectorAll(".group")].find(el=>/Sistem/i.test(el.textContent));
 nav.insertBefore(b,sys||null);
 const section=document.createElement("section");section.className="view";section.id="auto-org";
 section.innerHTML='<h2>Struktur Organisasi Otomatis</h2><p class="auto-note">Bagan dibuat langsung dari MPP. Untuk mengubah susunan, edit kolom <b>Section Job</b> dan <b>Job</b> pada MPP. Nama serta VACANT juga mengikuti MPP.</p><div class="auto-actions"><button class="btn" type="button" id="autoRefresh">Perbarui dari MPP</button><button class="btn" type="button" id="autoPrint">Print</button></div><div id="soAutoContent"></div>';
 content.append(section);
 document.getElementById("autoRefresh").onclick=update;
 document.getElementById("autoPrint").onclick=()=>window.print();
 nav.addEventListener("click",e=>{if(e.target.closest('[data-view="auto-org"]'))requestAnimationFrame(update)},true);
 update();
}
const style=document.createElement("style");style.textContent=`
.auto-note{color:#69758b;font-size:13px;line-height:1.6}.auto-actions{display:flex;gap:8px;margin:13px 0 18px}.auto-site{margin:16px 0 28px}.auto-sections{display:flex;gap:16px;align-items:start;overflow-x:auto;padding:18px 3px}.auto-section{min-width:235px;flex:1;border:1px solid #dfe5f1;background:#f8faff;border-radius:12px;padding:11px;position:relative}.auto-section-title{background:#dfebff;border:1px solid #afc6ee;border-radius:8px;text-align:center;padding:11px;font-weight:800;color:#1d3c70}.auto-joblist{margin-top:20px;border-left:2px solid #aebfdb;margin-left:10px;padding-left:15px}.auto-job{margin:14px 0 16px;background:white;border:1px solid #dbe3ef;border-radius:9px;padding:9px;position:relative}.auto-job:before{content:"";position:absolute;left:-16px;top:18px;width:15px;border-top:2px solid #aebfdb}.auto-job-title{font-size:12px;font-weight:800;color:#4f46a5;background:#ede9fe;padding:8px;border-radius:5px;margin-bottom:8px}.auto-person{display:flex;flex-direction:column;gap:2px;border:1px solid #e3e8f1;border-radius:7px;padding:8px;margin:6px 0;font-size:11px}.auto-person b{color:#334155}.auto-person span{color:#475569}.auto-person .auto-vacant{color:#b91c1c;font-weight:850}@media print{body:has(#auto-org.view.active) .sidebar,body:has(#auto-org.view.active) .topbar,body:has(#auto-org.view.active) .auto-actions{display:none!important}body:has(#auto-org.view.active) .view:not(#auto-org){display:none!important}body:has(#auto-org.view.active) .auto-sections{overflow:visible!important}body:has(#auto-org.view.active) .main{margin:0!important;width:100%!important}}`;document.head.append(style);
document.addEventListener("DOMContentLoaded",setup);
window.addEventListener("kmb:data-changed",update);
})();