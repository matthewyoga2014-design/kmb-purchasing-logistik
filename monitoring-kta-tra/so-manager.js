(function(){
"use strict";
const KEY="kta-tra-so-configuration-v2";
const defaults=[
 ["PENANGGUNG JAWAB OPERASIONAL","MANAJEMEN OPERASIONAL",""],
 ["MAINTENANCE SECTION","UNSCHEDULE MTC",""],
 ["MAINTENANCE SECTION","SCHEDULE MTC",""],
 ["MAINTENANCE SECTION","CREW ELECTRIC",""],
 ["MAINTENANCE SECTION","CREW WELDER",""],
 ["MAINTENANCE SECTION","HELPER UNSCHEDULE REPAIR","UNSCHEDULE MTC"],
 ["MAINTENANCE SECTION","HELPER SCHEDULE REPAIR","SCHEDULE MTC"],
 ["MAINTENANCE SECTION","HELPER WELDER","CREW WELDER"],
 ["PLANNER SECTION","PLANNING",""],
 ["PLANNER SECTION","PLANT ADMIN",""],
 ["TYRE SECTION","TYRE INSPECTOR",""],
 ["TYRE SECTION","TYRE REPAIR",""],
 ["TYRE SECTION","TYRE STORING",""],
 ["DI LUAR SO","DI LUAR SO",""]
].map((x,i)=>({id:"SO"+String(i+1).padStart(3,"0"),section:x[0],job:x[1],parent:x[2],order:i+1}));
const clean=v=>String(v??"").trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>clean(v).toUpperCase().replace(/\s+/g," ");
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)&&x.length?x:defaults}catch{return defaults}}
let cfg=load();
const canManage=()=>typeof accessMode==="function"&&accessMode()!=="viewer"&&accessMode()!=="editor";
function sectionFor(r){
 const s=norm(r["Section Job"]),j=norm(r.Jabatan);
 if(s)return s;
 if(/DEPT HEAD|DEPARTMENT HEAD|SECTION HEAD/.test(j))return "PENANGGUNG JAWAB OPERASIONAL";
 if(/TYRE|TIRE/.test(j))return "TYRE SECTION";
 if(/PLANNER|ADMIN/.test(j))return "PLANNER SECTION";
 if(/MEKANIK|MECHANIC|WELDER|HELPER|ELECTRIC/.test(j))return "MAINTENANCE SECTION";
 return "BELUM DITENTUKAN";
}
function jobFor(r,section){
 const j=norm(r.Job),sub=norm(r["Sub Section Job"]),role=norm(r.Jabatan);
 const items=cfg.filter(x=>norm(x.section)===section);
 for(const field of [sub,j]){let hit=items.find(x=>norm(x.job)===field);if(hit)return norm(hit.job)}
 if(section==="PENANGGUNG JAWAB OPERASIONAL")return "MANAJEMEN OPERASIONAL";
 if(section==="PLANNER SECTION")return /ADMIN/.test(role)?"PLANT ADMIN":"PLANNING";
 if(section==="TYRE SECTION")return /INSPECT|SENIOR/.test(role)?"TYRE INSPECTOR":/STOR|SPOR/.test(role)?"TYRE STORING":"TYRE REPAIR";
 if(section==="MAINTENANCE SECTION"){
  if(/WELDER/.test(role))return /HELPER/.test(role)?"HELPER WELDER":"CREW WELDER";
  if(/ELECTRIC/.test(role))return "CREW ELECTRIC";
 }
 return "BELUM DITENTUKAN";
}
function person(r){const isVacant=!clean(r.Nama)||norm(r.Nama)==="VACANT";return '<div class="sox-person"><span class="'+(isVacant?'sox-vacant':'')+'">'+esc(isVacant?'VACANT':r.Nama)+'</span><small>'+esc(r.Jabatan||"-")+'</small></div>'}
function team(title,rows){return '<div class="sox-team"><div class="sox-bar">'+esc(title)+'</div>'+rows.map(person).join("")+'</div>'}
function render(){
 const host=document.getElementById("soContent");if(!host||typeof data==="undefined")return;
 const rows=Array.isArray(data.mpp)?data.mpp:[];
 const buckets=new Map();
 rows.forEach(r=>{const s=sectionFor(r),j=jobFor(r,s),k=s+"|"+j;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r)});
 const used=new Set();
 const top=cfg.find(x=>norm(x.section)==="PENANGGUNG JAWAB OPERASIONAL");
 const leaders=buckets.get("PENANGGUNG JAWAB OPERASIONAL|MANAJEMEN OPERASIONAL")||[];
 used.add("PENANGGUNG JAWAB OPERASIONAL|MANAJEMEN OPERASIONAL");
 const sections=["MAINTENANCE SECTION","PLANNER SECTION","TYRE SECTION"];
 const branch=s=>{
 const nodes=cfg.filter(x=>norm(x.section)===s).sort((a,b)=>a.order-b.order);
 const roots=nodes.filter(n=>!clean(n.parent));
 const descendants=n=>nodes.filter(x=>norm(x.parent)===norm(n.job));
 const drawn=new Set();
 const node=n=>{if(drawn.has(n.id))return "";drawn.add(n.id);const kids=descendants(n);const k=s+"|"+norm(n.job);used.add(k);return '<div class="sox-node">'+team(n.job,buckets.get(k)||[])+kids.map(c=>'<div class="sox-child">'+node(c)+'</div>').join("")+'</div>'};
 const extras=[...buckets].filter(([key])=>key.startsWith(s+"|")&&!used.has(key)&&!nodes.some(n=>key===s+"|"+norm(n.job)));
 return '<div class="sox-section"><div class="sox-bar sox-section-title">'+esc(s)+'</div><div class="sox-children">'+roots.map(node).join("")+extras.map(([key,rs])=>'<div class="sox-node">'+team(key.split("|")[1],rs)+'</div>').join("")+'</div></div>';
 };
 const orphans=[...buckets].filter(([key])=>!sections.some(s=>key.startsWith(s+"|"))&&!used.has(key));
 host.innerHTML='<div class="sox-sheet"><div class="sox-heading"><strong>STRUKTUR ORGANISASI</strong><div>PLANT DEPARTMENT KMB SITE KTA</div><b>TAHUN 2026</b></div><div class="sox-root">'+team("PENANGGUNG JAWAB OPERASIONAL",leaders)+'</div><div class="sox-stem"></div><div class="sox-sections">'+sections.map(branch).join("")+'</div>'+(orphans.length?'<div class="sox-outside"><div class="sox-bar">DI LUAR SO / BELUM DITENTUKAN</div>'+orphans.flatMap(x=>x[1]).map(person).join("")+'</div>':"")+'</div>';
}
function validate(rows){
 const ids=new Set(),pairs=new Set();
 for(const x of rows){if(!clean(x.id)||!clean(x.section)||!clean(x.job))throw Error("ID, Section, dan Job tidak boleh kosong.");if(ids.has(x.id))throw Error("ID SO ganda: "+x.id);ids.add(x.id);const k=norm(x.section)+"|"+norm(x.job);if(pairs.has(k))throw Error("Section/Job ganda: "+k);pairs.add(k)}
 for(const x of rows){let seen=new Set([norm(x.job)]),p=norm(x.parent);while(p){if(seen.has(p))throw Error("Hubungan atasan-bawahan melingkar di "+x.job);seen.add(p);const parent=rows.find(r=>norm(r.section)===norm(x.section)&&norm(r.job)===p);if(!parent)throw Error("Atasan tidak ditemukan: "+x.parent);p=norm(parent.parent)}}
}
function editor(){
 const host=document.getElementById("soConfigEditor");if(!host)return;
 host.innerHTML='<div style="overflow:auto"><table class="sox-config"><thead><tr><th>ID</th><th>Section Job</th><th>Job</th><th>Induk Job</th><th>Urutan</th><th></th></tr></thead><tbody>'+cfg.map((x,i)=>'<tr data-so-row="'+i+'">'+['id','section','job','parent','order'].map(k=>'<td><input data-k="'+k+'" value="'+esc(x[k])+'"></td>').join("")+'<td><button type="button" data-remove="'+i+'">Hapus</button></td></tr>').join("")+'</tbody></table></div><div class="sox-tools"><button id="soAddNode" class="btn">+ Tambah Cabang</button><button id="soSaveConfig" class="btn yellow">Simpan Susunan</button></div>';
 host.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(!confirm("Hapus cabang SO ini? Data MPP tidak akan dihapus."))return;cfg.splice(Number(b.dataset.remove),1);editor()});
 document.getElementById("soAddNode").onclick=()=>{cfg.push({id:"SO"+Date.now(),section:"MAINTENANCE SECTION",job:"CABANG BARU",parent:"",order:cfg.length+1});editor()};
 document.getElementById("soSaveConfig").onclick=()=>{
 const next=[...host.querySelectorAll("[data-so-row]")].map(tr=>Object.fromEntries([...tr.querySelectorAll("[data-k]")].map(el=>[el.dataset.k,el.dataset.k==="order"?Number(el.value):el.value.trim()])));
 try{validate(next);cfg=next;localStorage.setItem(KEY,JSON.stringify(cfg));render();editor();alert("Susunan SO tersimpan pada browser ini. Data MPP dan pelamar tidak diubah.")}catch(err){alert(err.message)}
 };
}
function download(){
 if(!window.XLSX){alert("Modul Excel belum siap.");return}
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(cfg,{header:["id","section","job","parent","order"]}),"KONFIGURASI SO");
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((typeof data!=="undefined"?data.mpp:[]).map(r=>({No:r.No,Nama:r.Nama,Jabatan:r.Jabatan,"Section Job":r["Section Job"],Job:r.Job,"Sub Section Job":r["Sub Section Job"]}))),"REFERENSI MPP");
 XLSX.writeFile(wb,"Template_Struktur_Organisasi_KTA_TRA.xlsx");
}
function upload(input){
 const file=input.files?.[0];if(!file||!window.XLSX)return;
 const reader=new FileReader();
 reader.onload=()=>{try{
 const wb=XLSX.read(reader.result,{type:"array"}),ws=wb.Sheets["KONFIGURASI SO"];if(!ws)throw Error("Sheet KONFIGURASI SO tidak ditemukan.");
 const incoming=XLSX.utils.sheet_to_json(ws,{defval:""}).map(x=>({id:clean(x.id),section:clean(x.section),job:clean(x.job),parent:clean(x.parent),order:Number(x.order)||0}));
 if(!incoming.length)throw Error("Konfigurasi SO kosong.");
 validate(incoming);
 const oldKeys=new Set(cfg.map(x=>x.id+"|"+x.section+"|"+x.job+"|"+x.parent));
 const changed=incoming.filter(x=>!oldKeys.has(x.id+"|"+x.section+"|"+x.job+"|"+x.parent));
 if(!confirm("Pratinjau upload SO:\n"+incoming.length+" cabang, "+changed.length+" cabang baru/berubah.\n\nHanya konfigurasi SO yang diganti. MPP dan pelamar tidak ditimpa. Lanjutkan?"))return;
 cfg=incoming;localStorage.setItem(KEY,JSON.stringify(cfg));render();editor();alert("Konfigurasi SO berhasil dimuat. Data MPP tidak diubah.");
 }catch(err){alert("Upload SO gagal: "+err.message)}finally{input.value=""}};
 reader.readAsArrayBuffer(file);
}
function setup(){
 const so=document.getElementById("so"),host=document.getElementById("soContent");if(!so||!host||document.getElementById("soManageActions"))return;
 const header=so.querySelector(".page-head");const bar=document.createElement("div");bar.id="soManageActions";bar.className="sox-tools";
 bar.innerHTML='<button type="button" class="btn" id="soDownload">Download Excel SO</button>'+ (canManage()?'<label class="btn yellow">Upload Perubahan SO<input id="soUpload" type="file" accept=".xlsx,.xls" hidden></label><button type="button" class="btn" id="soToggleConfig">Pengaturan SO</button>':"");
 header.after(bar);
 const editorHost=document.createElement("div");editorHost.id="soConfigEditor";editorHost.hidden=true;bar.after(editorHost);
 document.getElementById("soDownload").onclick=download;
 if(canManage()){
 document.getElementById("soUpload").onchange=function(){upload(this)};
 document.getElementById("soToggleConfig").onclick=()=>{editorHost.hidden=!editorHost.hidden;if(!editorHost.hidden)editor()};
 }
 window.renderKtaSO=render;render();
}
const style=document.createElement("style");style.textContent=`
.sox-tools{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}.sox-sheet{min-width:1470px;background:white;padding:25px 16px;color:#1e293b}.sox-heading{text-align:center;margin:0 0 34px;font-size:13px;line-height:1.65}.sox-heading strong{letter-spacing:4px}.sox-root{width:220px;margin:auto}.sox-bar{background:#acbacb;border:1px solid #7795b2;color:#172437;text-align:center;padding:7px 5px;font-size:11px}.sox-person{display:grid;grid-template-columns:minmax(0,1fr) 68px;border:1px solid #7795b2;border-top:0;min-height:24px;font-size:10px}.sox-person span{padding:5px}.sox-person small{border-left:1px solid #7795b2;padding:5px;overflow-wrap:anywhere}.sox-vacant{color:#b91c1c;font-weight:700}.sox-stem{height:105px;width:1px;background:#a3bdd6;margin:auto;position:relative}.sox-stem:after{content:"";position:absolute;bottom:24px;left:-560px;width:1120px;border-top:1px solid #a3bdd6}.sox-sections{display:grid;grid-template-columns:1.65fr .55fr 1.4fr;gap:18px;align-items:start}.sox-section{position:relative}.sox-section:before{content:"";height:20px;position:absolute;top:-20px;left:50%;border-left:1px solid #a3bdd6}.sox-section-title{width:60%;margin:0 auto 40px}.sox-children{display:flex;gap:6px;align-items:start;justify-content:space-around;position:relative}.sox-children:before{content:"";position:absolute;top:-20px;left:9%;right:9%;border-top:1px solid #a3bdd6}.sox-node{min-width:0;flex:1;position:relative}.sox-node:before{content:"";position:absolute;top:-20px;left:50%;height:20px;border-left:1px solid #a3bdd6}.sox-child{margin-top:28px;position:relative}.sox-child:before{content:"";position:absolute;top:-28px;height:28px;left:50%;border-left:1px solid #a3bdd6}.sox-outside{width:210px;margin:35px 10% 0 auto}.sox-config{border-collapse:collapse;width:100%;min-width:700px;background:white}.sox-config th,.sox-config td{padding:5px;border:1px solid #d0dae7}.sox-config input{min-width:80px;width:100%;padding:6px}.sox-config th{background:#e4ebf4}#soConfigEditor[hidden]{display:none!important}@media print{body:has(#so.view.active) #soManageActions,body:has(#so.view.active) #soConfigEditor{display:none!important}body:has(#so.view.active) .sox-sheet{min-width:0!important;width:100%!important;zoom:.65}@page{size:landscape;margin:6mm}}`;document.head.append(style);
document.addEventListener("DOMContentLoaded",setup);
})();
