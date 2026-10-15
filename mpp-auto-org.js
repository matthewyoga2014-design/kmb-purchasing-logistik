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
const rank=(row,field,fallback)=>Number.isFinite(Number(row[field]))&&String(row[field]??"")!==""?Number(row[field]):fallback;
let busy=false;
function snapshot(){
 return dataGroups().map(g=>{
 const sections=new Map();
 g.rows.forEach((r,i)=>{
  const section=String(r["Section Job"]||"Belum ditentukan").trim()||"Belum ditentukan";
  const job=String(r["Job"]??r["Scope Job"]??"Belum ditentukan").trim()||"Belum ditentukan";
  if(!sections.has(section))sections.set(section,{name:section,first:i,order:rank(r,"Urutan Section",i+1),jobs:new Map()});
  const sg=sections.get(section);sg.order=Math.min(sg.order,rank(r,"Urutan Section",i+1));
  if(!sg.jobs.has(job))sg.jobs.set(job,{name:job,first:i,order:rank(r,"Urutan Job",i+1),rows:[]});
  const jg=sg.jobs.get(job);jg.order=Math.min(jg.order,rank(r,"Urutan Job",i+1));jg.rows.push({row:r,index:i,order:rank(r,"Urutan Posisi",i+1)});
 });
 const sectionsSorted=[...sections.values()].sort((a,b)=>a.order-b.order||a.first-b.first);
 sectionsSorted.forEach(x=>{x.jobs=[...x.jobs.values()].sort((a,b)=>a.order-b.order||a.first-b.first);x.jobs.forEach(j=>j.rows.sort((a,b)=>a.order-b.order||a.index-b.index))});
 return {...g,sections:sectionsSorted};
 });
}
function actions(level,si,ji,ri){
 return '<span class="so-sort-actions"><button type="button" data-sort="'+level+'" data-si="'+si+'" data-ji="'+ji+'" data-ri="'+ri+'" data-step="-1" title="Naik / geser ke kiri">↑</button><button type="button" data-sort="'+level+'" data-si="'+si+'" data-ji="'+ji+'" data-ri="'+ri+'" data-step="1" title="Turun / geser ke kanan">↓</button></span>';
}
function update(){
 const host=document.getElementById("soAutoContent");if(!host)return;
 const writable=["owner","editor"].includes(window.accessMode?.());
 const groups=snapshot();
 host.innerHTML=groups.map((g,gi)=>{
 const sectionHtml=g.sections.map((sec,si)=>'<div class="auto-section"><div class="auto-section-title">'+esc(sec.name)+(writable?actions("section",si,0,0):"")+'</div><div class="auto-joblist">'+sec.jobs.map((job,ji)=>'<div class="auto-job"><div class="auto-job-title">'+esc(job.name)+(writable?actions("job",si,ji,0):"")+'</div>'+job.rows.map((item,ri)=>'<div class="auto-person"><b>'+esc(item.row.Jabatan||"-")+'</b><span class="'+(vacant(item.row.Nama)?"auto-vacant":"")+'">'+esc(vacant(item.row.Nama)?"VACANT":item.row.Nama)+'</span>'+(writable?actions("person",si,ji,ri):"")+'</div>').join("")+'</div>').join("")+'</div></div>').join("");
 return '<div class="auto-site" data-group="'+gi+'">'+(g.site?'<h3>'+esc(g.site)+'</h3>':"")+'<div class="auto-sections">'+sectionHtml+'</div></div>';
 }).join("");
 if(groups.every(g=>!g.rows.length))host.innerHTML='<p>Belum ada data MPP.</p>';
}
async function reorder(gi,si,ji,ri,level,step){
 if(busy||!["owner","editor"].includes(window.accessMode?.()))return;
 const g=snapshot()[gi];if(!g)return;
 const sec=g.sections[si];if(!sec)return;
 let siblings,index;
 if(level==="section"){siblings=g.sections;index=si}
 else if(level==="job"){siblings=sec.jobs;index=ji}
 else{siblings=sec.jobs[ji]?.rows;index=ri}
 if(!siblings||index+step<0||index+step>=siblings.length)return;
 const key=level==="section"?"Urutan Section":level==="job"?"Urutan Job":"Urutan Posisi";
 // Assign a complete, stable order to every sibling before swapping.
 const reordered=siblings.slice();
 [reordered[index],reordered[index+step]]=[reordered[index+step],reordered[index]];
 const original=siblings.slice();
 const affected=new Map();
 original.forEach(item=>{const rows=level==="section"?item.jobs.flatMap(j=>j.rows.map(x=>x.row)):level==="job"?item.rows.map(x=>x.row):[item.row];rows.forEach(r=>{if(!affected.has(r))affected.set(r,r[key])})});
 reordered.forEach((item,i)=>{const rows=level==="section"?item.jobs.flatMap(j=>j.rows.map(x=>x.row)):level==="job"?item.rows.map(x=>x.row):[item.row];rows.forEach(r=>r[key]=i+1)});
 busy=true;update();
 const label=document.getElementById("soAutoStatus");if(label)label.textContent="Menyimpan susunan...";
 try{
  const result=await Promise.resolve(typeof saveData==="function"?saveData():null);
  if(result?.saved===false)throw new Error(result?.error?.message||"Gagal menyimpan ke server");
  if(label)label.textContent="Susunan tersimpan. Dashboard mengikuti data MPP.";
 }catch(e){
  affected.forEach((value,row)=>{if(value===undefined)delete row[key];else row[key]=value});
  if(label)label.textContent="Gagal menyimpan susunan: "+(e.message||e);
 }finally{busy=false;update()}
}
function setup(){
 const nav=document.getElementById("sidebar"),content=document.querySelector(".content");if(!nav||!content||document.getElementById("auto-org"))return;
 const b=document.createElement("button");b.className="nav";b.dataset.view="auto-org";b.dataset.title="Struktur Organisasi Otomatis";b.innerHTML="♧ &nbsp; Struktur Organisasi";b.onclick=()=>{if(typeof showView==="function")showView("auto-org");update()};
 const sys=[...nav.querySelectorAll(".group")].find(el=>/Sistem/i.test(el.textContent));
 nav.insertBefore(b,sys||null);
 const section=document.createElement("section");section.className="view";section.id="auto-org";
 section.innerHTML='<h2>Struktur Organisasi Otomatis</h2><p class="auto-note">Bagan dibuat langsung dari MPP. Untuk mengubah susunan, edit kolom <b>Section Job</b> dan <b>Job</b> pada MPP. Nama serta VACANT juga mengikuti MPP. Gunakan tombol panah pada kotak untuk mengatur urutan; urutan tersimpan sebagai data MPP.</p><div class="auto-actions"><button class="btn" type="button" id="autoRefresh">Perbarui dari MPP</button><button class="btn" type="button" id="autoPrint">Print</button></div><p id="soAutoStatus" class="auto-note"></p><div id="soAutoContent"></div>';
 content.append(section);
 document.getElementById("autoRefresh").onclick=update;
 document.getElementById("autoPrint").onclick=()=>window.print();
 document.getElementById("soAutoContent").addEventListener("click",e=>{const b=e.target.closest("button[data-sort]");if(!b)return;const site=b.closest("[data-group]");reorder(Number(site?.dataset.group),Number(b.dataset.si),Number(b.dataset.ji),Number(b.dataset.ri),b.dataset.sort,Number(b.dataset.step))});
 nav.addEventListener("click",e=>{if(e.target.closest('[data-view="auto-org"]'))requestAnimationFrame(update)},true);
 update();
}
const style=document.createElement("style");style.textContent=`
.so-sort-actions{display:inline-flex;gap:3px;margin-left:7px}.so-sort-actions button{cursor:pointer;border:1px solid #c2c9dd;border-radius:5px;background:white;color:#4f46e5;font-size:13px;padding:2px 6px}.so-sort-actions button:hover{background:#ede9fe}.auto-note{color:#69758b;font-size:13px;line-height:1.6}.auto-actions{display:flex;gap:8px;margin:13px 0 18px}.auto-site{margin:16px 0 28px}.auto-sections{display:flex;gap:16px;align-items:start;overflow-x:auto;padding:18px 3px}.auto-section{min-width:235px;flex:1;border:1px solid #dfe5f1;background:#f8faff;border-radius:12px;padding:11px;position:relative}.auto-section-title{background:#dfebff;border:1px solid #afc6ee;border-radius:8px;text-align:center;padding:11px;font-weight:800;color:#1d3c70}.auto-joblist{margin-top:20px;border-left:2px solid #aebfdb;margin-left:10px;padding-left:15px}.auto-job{margin:14px 0 16px;background:white;border:1px solid #dbe3ef;border-radius:9px;padding:9px;position:relative}.auto-job:before{content:"";position:absolute;left:-16px;top:18px;width:15px;border-top:2px solid #aebfdb}.auto-job-title{font-size:12px;font-weight:800;color:#4f46a5;background:#ede9fe;padding:8px;border-radius:5px;margin-bottom:8px}.auto-person{display:flex;flex-direction:column;gap:2px;border:1px solid #e3e8f1;border-radius:7px;padding:8px;margin:6px 0;font-size:11px}.auto-person b{color:#334155}.auto-person span{color:#475569}.auto-person .auto-vacant{color:#b91c1c;font-weight:850}@media print{body:has(#auto-org.view.active) .sidebar,body:has(#auto-org.view.active) .topbar,body:has(#auto-org.view.active) .auto-actions{display:none!important}body:has(#auto-org.view.active) .view:not(#auto-org){display:none!important}body:has(#auto-org.view.active) .auto-sections{overflow:visible!important}body:has(#auto-org.view.active) .main{margin:0!important;width:100%!important}}`;document.head.append(style);
document.addEventListener("DOMContentLoaded",setup);
window.addEventListener("kmb:data-changed",update);
})();