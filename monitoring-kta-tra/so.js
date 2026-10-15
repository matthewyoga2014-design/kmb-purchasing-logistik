(function(){
"use strict";
const STORE="kta_tra_so_manual_v1";
const val=x=>String(x??"").trim();
const html=x=>val(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;',"\u0027":"&#39;"}[c]));
let slots=[];try{slots=JSON.parse(localStorage.getItem(STORE)||"[]");if(!Array.isArray(slots))slots=[]}catch{slots=[]}
const readonly=()=>typeof accessMode==="function"&&accessMode()==="viewer";
const rows=()=>typeof data!=="undefined"&&Array.isArray(data.mpp)?data.mpp:[];
function save(){localStorage.setItem(STORE,JSON.stringify(slots));render()}
function node(s,depth=0,trail=new Set()){
 const r=rows().find(x=>val(x.No)===val(s.mppNo));
 const children=slots.filter(x=>x.parent===s.id&&!trail.has(x.id));
 const t=new Set(trail);t.add(s.id);
 return '<li><div class="som-card"><div class="som-role">'+html(r?.Jabatan||s.label||"Posisi Belum Diisi")+'</div><div class="som-person '+(!r||!val(r.Nama)||/^vacant$/i.test(val(r.Nama))?"som-vacant":"")+'">'+html(r?.Nama||"VACANT")+'</div></div>'+(!readonly()?'<button class="som-edit" data-edit="'+html(s.id)+'">Edit</button>':"")+(children.length&&depth<20?'<ul>'+children.map(x=>node(x,depth+1,t)).join("")+'</ul>':"")+'</li>';
}
function render(){
 const h=document.getElementById("soContent");if(!h)return;
 const ids=new Set(slots.map(s=>s.id));
 const roots=slots.filter(s=>!s.parent||!ids.has(s.parent));
 h.innerHTML='<div class="som-toolbar">'+(!readonly()?'<button class="btn yellow" id="somAdd">+ Tambah Posisi SO</button>':'')+'<button class="btn" id="somPrint">Print SO</button></div><div class="som-sheet"><header><b>STRUKTUR ORGANISASI</b><div>PLANT DEPARTMENT KMB SITE KTA</div><strong>TAHUN 2026</strong></header>'+(slots.length?'<div class="som-scroll"><ul class="som-tree">'+roots.map(x=>node(x)).join("")+'</ul></div>':'<p class="som-empty">Belum ada posisi pada SO. Klik Tambah Posisi SO untuk menyusun secara manual dari MPP.</p>')+'</div><div id="somForm" hidden></div><p class="som-info">Penempatan SO diisi manual di halaman ini. Nama dan jabatan tetap berasal dari MPP, dan satu nomor MPP hanya bisa ditempatkan sekali. Data MPP dan pelamar tidak diubah.</p>';
 if(!readonly())document.getElementById("somAdd").onclick=()=>edit();
 document.getElementById("somPrint").onclick=()=>window.print();
 h.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(b.dataset.edit));
}
function edit(id){
 if(readonly())return;
 const slot=slots.find(s=>s.id===id)||{id:"p"+Date.now()+Math.floor(Math.random()*1000),mppNo:"",parent:"",label:""};
 const holder=document.getElementById("somForm");holder.hidden=false;
 const used=new Set(slots.filter(s=>s.id!==slot.id).map(s=>val(s.mppNo)).filter(Boolean));
 const options=rows().map(r=>'<option value="'+html(r.No)+'" '+(used.has(val(r.No))?'disabled':'')+' '+(val(slot.mppNo)===val(r.No)?'selected':'')+'>'+html("No "+r.No+" | "+(r.Jabatan||"-")+" | "+(r.Nama||"VACANT"))+(used.has(val(r.No))?" — SUDAH DIPAKAI":"")+'</option>').join("");
 const parents=slots.filter(s=>s.id!==slot.id).map(s=>{const r=rows().find(r=>val(r.No)===val(s.mppNo));return '<option value="'+html(s.id)+'" '+(slot.parent===s.id?'selected':'')+'>'+html((r?.Jabatan||s.label||"Posisi")+" — "+(r?.Nama||"VACANT"))+'</option>'}).join("");
 holder.innerHTML='<div class="som-editor"><h3>'+ (id?'Edit Posisi SO':'Tambah Posisi SO')+'</h3><label>Nama dan Jabatan dari MPP</label><select id="somEmployee"><option value="">— Pilih posisi dari MPP —</option>'+options+'</select><label>Atasan dalam Bagan</label><select id="somParent"><option value="">— Paling atas —</option>'+parents+'</select><label>Judul posisi kosong (opsional)</label><input id="somLabel" value="'+html(slot.label)+'" placeholder="Contoh: Helper Mekanik"><div class="som-buttons"><button class="btn yellow" id="somSave">Simpan Posisi</button><button class="btn" id="somCancel">Batal</button>'+(id?'<button class="btn danger" id="somDelete">Hapus dari SO</button>':'')+'</div></div>';
 document.getElementById("somCancel").onclick=()=>{holder.hidden=true;holder.innerHTML=""};
 document.getElementById("somSave").onclick=()=>{
 const no=val(document.getElementById("somEmployee").value),parent=document.getElementById("somParent").value,label=val(document.getElementById("somLabel").value);
 if(!no&&!label){alert("Pilih posisi dari MPP atau isi judul posisi kosong.");return}
 if(no&&slots.some(s=>s.id!==slot.id&&val(s.mppNo)===no)){alert("Posisi MPP ini sudah ada pada SO.");return}
 let p=parent;const visited=new Set([slot.id]);while(p){if(visited.has(p)){alert("Hubungan atasan tidak boleh melingkar.");return}visited.add(p);p=slots.find(s=>s.id===p)?.parent||""}
 const next={id:slot.id,mppNo:no,parent,label};const i=slots.findIndex(s=>s.id===slot.id);if(i<0)slots.push(next);else slots[i]=next;save();
 };
 if(id)document.getElementById("somDelete").onclick=()=>{if(!confirm("Hapus posisi dari bagan? Data MPP tetap aman."))return;slots=slots.filter(s=>s.id!==id).map(s=>s.parent===id?{...s,parent:slot.parent}:s);save()};
 holder.scrollIntoView({behavior:"smooth",block:"nearest"});
}
window.renderKtaSO=render;
document.addEventListener("DOMContentLoaded",render);
})();