(function(){
"use strict";
const STORE="kta_tra_so_manual_v1";
const v=x=>String(x??"").trim();
const esc=x=>v(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const vacant=x=>!v(x)||/^vacant$/i.test(v(x));
const viewer=()=>typeof accessMode==="function"&&accessMode()==="viewer";
const active=()=>typeof data!=="undefined"&&Array.isArray(data.mpActive)?data.mpActive:[];
const key=r=>v(r["NIP (KARYAWAN)"])?"nip:"+v(r["NIP (KARYAWAN)"]):"nama:"+v(r.Nama).toLowerCase();
const positions=()=>[...new Set(active().map(r=>v(r.Jabatan)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
let slots=[];try{slots=JSON.parse(localStorage.getItem(STORE)||"[]");if(!Array.isArray(slots))slots=[]}catch{slots=[]}
slots=slots.map(s=>({...s,role:v(s.role||s.label||""),employeeKey:v(s.employeeKey||"")}));
function assigned(s){return active().find(r=>key(r)===s.employeeKey)}
function persist(){localStorage.setItem(STORE,JSON.stringify(slots));render()}
function personSelect(s){
 const used=new Set(slots.filter(x=>x.id!==s.id).map(x=>x.employeeKey).filter(Boolean));
 const list=active().filter(r=>!vacant(r.Nama));
 return '<select class="som-inline" data-assign="'+esc(s.id)+'"><option value="">VACANT — Belum Ada Karyawan</option>'+list.map(r=>'<option value="'+esc(key(r))+'" '+(used.has(key(r))?"disabled":"")+' '+(s.employeeKey===key(r)?"selected":"")+'>'+esc(r.Nama+" — "+(r.Jabatan||"-"))+(used.has(key(r))?" (Sudah di SO)":"")+'</option>').join("")+'</select>';
}
function node(s,level=0,seen=new Set()){
 if(seen.has(s.id)||level>25)return "";
 const next=new Set(seen);next.add(s.id);
 const r=assigned(s),children=slots.filter(x=>x.parent===s.id);
 return '<li><div class="som-card"><div class="som-role">'+esc(s.role||"Pilih Jabatan")+'</div><div class="som-person '+(!r?"som-vacant":"")+'">'+(viewer()?esc(r?.Nama||"VACANT"):personSelect(s))+'</div></div>'+(!viewer()?'<button class="som-edit" data-edit="'+esc(s.id)+'">Edit Jabatan / Atasan</button>':"")+(children.length?'<ul>'+children.map(x=>node(x,level+1,next)).join("")+'</ul>':"")+'</li>';
}
function render(){
 const h=document.getElementById("soContent");if(!h)return;
 const ids=new Set(slots.map(s=>s.id)),roots=slots.filter(s=>!s.parent||!ids.has(s.parent));
 h.innerHTML='<div class="som-toolbar">'+(!viewer()?'<button class="btn yellow" id="somAdd">+ Tambah Kotak SO</button>':"")+'<button class="btn" id="somPrint">Print SO</button></div><div class="som-sheet"><header><b>STRUKTUR ORGANISASI</b><div>PLANT DEPARTMENT KMB SITE KTA</div><strong>TAHUN 2026</strong></header>'+(slots.length?'<div class="som-scroll"><ul class="som-tree">'+roots.map(x=>node(x)).join("")+'</ul></div>':'<p class="som-empty">Klik Tambah Kotak SO untuk membuat susunan organisasi. Nama dipilih dari MP Aktif.</p>')+'</div><div id="somForm" hidden></div><p class="som-info">Jabatan bisa sama pada beberapa kotak. Nama hanya diambil dari MP Aktif dan setiap karyawan hanya boleh dipakai satu kali. Kotak tanpa nama otomatis VACANT.</p>';
 if(!viewer())document.getElementById("somAdd").onclick=()=>edit();
 document.getElementById("somPrint").onclick=()=>window.print();
 h.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(b.dataset.edit));
 h.querySelectorAll("[data-assign]").forEach(sel=>sel.onchange=()=>{
  const slot=slots.find(s=>s.id===sel.dataset.assign);if(!slot)return;
  const value=sel.value;
  if(value&&slots.some(x=>x.id!==slot.id&&x.employeeKey===value)){alert("Karyawan sudah ditempatkan pada kotak SO lainnya.");render();return}
  slot.employeeKey=value;persist();
 });
}
function edit(id){
 if(viewer())return;
 const slot=slots.find(s=>s.id===id)||{id:"org"+Date.now(),role:"",parent:"",employeeKey:""};
 const host=document.getElementById("somForm");host.hidden=false;
 const options=positions();
 if(slot.role&&!options.includes(slot.role))options.unshift(slot.role);
 const choices=options.map(role=>'<option value="'+esc(role)+'" '+(slot.role===role?"selected":"")+'>'+esc(role)+'</option>').join("");
 const parents=slots.filter(s=>s.id!==slot.id).map(s=>'<option value="'+esc(s.id)+'" '+(slot.parent===s.id?"selected":"")+'>'+esc(s.role||"Belum Ada Jabatan")+'</option>').join("");
 host.innerHTML='<div class="som-editor"><h3>'+(id?"Edit Kotak SO":"Tambah Kotak SO")+'</h3><label>Jabatan dari MP Aktif</label><select id="somRole"><option value="">— Pilih Jabatan —</option>'+choices+'</select><label>Atasan / Induk Kotak</label><select id="somParent"><option value="">— Paling Atas —</option>'+parents+'</select><div class="som-buttons"><button class="btn yellow" id="somSave">Simpan Kotak</button><button class="btn" id="somCancel">Batal</button>'+(id?'<button class="btn danger" id="somDelete">Hapus Kotak</button>':"")+'</div></div>';
 document.getElementById("somCancel").onclick=()=>{host.hidden=true};
 document.getElementById("somSave").onclick=()=>{
  const role=v(document.getElementById("somRole").value),parent=document.getElementById("somParent").value;
  if(!role){alert("Pilih jabatan terlebih dahulu.");return}
  let p=parent;const visited=new Set([slot.id]);while(p){if(visited.has(p)){alert("Hubungan atasan melingkar.");return}visited.add(p);p=slots.find(x=>x.id===p)?.parent||""}
  const next={...slot,role,parent};const i=slots.findIndex(x=>x.id===slot.id);if(i<0)slots.push(next);else slots[i]=next;persist();
 };
 if(id)document.getElementById("somDelete").onclick=()=>{if(!confirm("Hapus kotak SO? Data MP Aktif tetap aman."))return;slots=slots.filter(x=>x.id!==slot.id).map(x=>x.parent===slot.id?{...x,parent:slot.parent}:x);persist()};
 host.scrollIntoView({behavior:"smooth",block:"nearest"});
}
window.renderKtaSO=render;
document.addEventListener("DOMContentLoaded",render);
})();