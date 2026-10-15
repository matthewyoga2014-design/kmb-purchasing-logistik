(function(){
"use strict";
const v=x=>String(x??"").trim();
const esc=x=>v(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;',"\u0027":"&#39;"}[c]));
const vacant=x=>!v(x)||/^vacant$/i.test(v(x));
function nodeHTML(n,byParent,depth,visiting){
 const r=n.r, id=v(r.No);
 if(depth>25||visiting.has(id))return '<div class="tree-warning">Hubungan atasan berulang: '+esc(r.Nama)+'</div>';
 const seen=new Set(visiting);seen.add(id);
 const children=(byParent.get(id)||[]).slice().sort((a,b)=>Number(a.r["Urutan SO"]||a.i)-Number(b.r["Urutan SO"]||b.i));
 const label=vacant(r.Nama)?"VACANT":r.Nama;
 return '<li><div class="tree-person"><div class="tree-position">'+esc(r.Jabatan||"-")+'</div><div class="tree-employee '+(vacant(r.Nama)?"tree-vacant":"")+'">'+esc(label)+'</div></div><div class="tree-scope">'+esc(r["Scope Job"]||r["Sub Section Job"]||r.Job||r["Section Job"]||"")+'</div>'+ (children.length?'<ul>'+children.map(c=>nodeHTML(c,byParent,depth+1,seen)).join("")+'</ul>':"")+'</li>';
}
function render(){
 const h=document.getElementById("soContent");if(!h||typeof data==="undefined")return;
 const rows=Array.isArray(data.mpp)?data.mpp:[];
 const byParent=new Map(),ids=new Set(rows.map(r=>v(r.No)));
 const root=[];
 rows.forEach((r,i)=>{const item={r,i},p=v(r["Atasan No"]);if(!p||!ids.has(p)||p===v(r.No))root.push(item);else{if(!byParent.has(p))byParent.set(p,[]);byParent.get(p).push(item)}});
 root.sort((a,b)=>Number(a.r["Urutan SO"]||a.i+1)-Number(b.r["Urutan SO"]||b.i+1));
 const children=root.map(r=>nodeHTML(r,byParent,0,new Set())).join("");
 h.innerHTML='<div class="tree-sheet"><div class="tree-header"><strong>STRUKTUR ORGANISASI</strong><div>PLANT DEPARTMENT KMB SITE KTA — 2026</div></div><div class="tree-scroll"><ul class="tree-chart">'+children+'</ul></div><p class="tree-tip">Untuk menentukan posisi, pilih Edit MPP → Urutan SO, Atasan Langsung, dan Scope Job. Posisi dengan atasan yang sama disusun menyamping; bawahan disusun ke bawah. Seluruh nama dan jabatan langsung mengikuti MPP.</p></div>';
}
window.renderKtaSO=render;
document.addEventListener("DOMContentLoaded",render);
})();