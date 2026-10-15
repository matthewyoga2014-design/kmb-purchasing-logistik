(function(){
"use strict";
const KEY="kta_tra_so_smartart_v1",OLD="kta_tra_so_manual_v1";
const v=x=>String(x??"").trim(),safe=x=>v(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const vacant=x=>!v(x)||/^vacant$/i.test(v(x));
const editable=()=>typeof accessMode!=="function"||accessMode()!=="viewer";
const active=()=>typeof data!=="undefined"&&Array.isArray(data.mpActive)?data.mpActive.filter(r=>!vacant(r.Nama)&&!/^(out|keluar|resign|nonaktif)$/i.test(v(r.STATUS))):[];
const personKey=r=>v(r["NIP (KARYAWAN)"])?"nip:"+v(r["NIP (KARYAWAN)"]):"name:"+v(r.Nama).toLowerCase();
const roles=()=>[...new Set(active().map(r=>v(r.Jabatan)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const uid=()=> "n"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let nodes=[];try{nodes=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{}
if(!Array.isArray(nodes)||!nodes.length){try{const old=JSON.parse(localStorage.getItem(OLD)||"[]");if(Array.isArray(old)&&old.length)nodes=old.map(n=>({id:n.id||uid(),parent:n.parent||"",role:n.role||n.label||"Posisi",employeeKey:n.employeeKey||"",open:true}));}catch{}}
if(!Array.isArray(nodes))nodes=[];
let selected=nodes[0]?.id||"";
function save(){localStorage.setItem(KEY,JSON.stringify(nodes));render()}
function assigned(n){return active().find(r=>personKey(r)===n.employeeKey)}
function used(except){return new Set(nodes.filter(n=>n.id!==except).map(n=>n.employeeKey).filter(Boolean))}
function nameOptions(n){const taken=used(n.id);return '<option value="">VACANT</option>'+active().map(r=>{const k=personKey(r);return '<option value="'+safe(k)+'" '+(n.employeeKey===k?"selected":"")+' '+(taken.has(k)?"disabled":"")+'>'+safe(r.Nama)+(taken.has(k)?" — sudah digunakan":"")+'</option>'}).join("")}
function roleOptions(n){let all=roles();if(n.role&&!all.includes(n.role))all.unshift(n.role);return '<option value="">Pilih jabatan</option>'+all.map(role=>'<option '+(role===n.role?"selected":"")+' value="'+safe(role)+'">'+safe(role)+'</option>').join("")}
function chartNode(n,depth=0,ancestors=new Set()){
 if(depth>20||ancestors.has(n.id))return "";
 const seen=new Set(ancestors);seen.add(n.id),person=assigned(n),children=nodes.filter(x=>x.parent===n.id);
 return '<li><div class="sa-card" data-box="'+safe(n.id)+'"><div class="sa-card-role">'+safe(n.role||"Pilih Jabatan")+'</div><div class="sa-card-name '+(!person?"sa-vacant":"")+'">'+safe(person?.Nama||"VACANT")+'</div></div>'+ (children.length?'<ul>'+children.map(c=>chartNode(c,depth+1,seen)).join("")+'</ul>':"")+'</li>';
}
function treeRows(){
 const depthOf=n=>{let d=0,p=n.parent,seen=new Set([n.id]);while(p&&d<20&&!seen.has(p)){d++;seen.add(p);p=nodes.find(x=>x.id===p)?.parent||""}return d};
 return nodes.map(n=>'<div class="sa-outline-row '+(selected===n.id?"sa-selected":"")+'" data-id="'+safe(n.id)+'" style="--indent:'+Math.min(depthOf(n),12)+'"><button type="button" class="sa-pick" data-pick="'+safe(n.id)+'" title="Pilih baris">●</button><div class="sa-row-fields"><select data-role="'+safe(n.id)+'" aria-label="Jabatan">'+roleOptions(n)+'</select><select data-name="'+safe(n.id)+'" aria-label="Nama dari MP Aktif">'+nameOptions(n)+'</select></div></div>').join("");
}
function render(){
 const host=document.getElementById("soContent");if(!host)return;
 if(!nodes.some(n=>n.id===selected))selected=nodes[0]?.id||"";
 const ids=new Set(nodes.map(n=>n.id)),roots=nodes.filter(n=>!n.parent||!ids.has(n.parent));
 host.innerHTML='<div class="sa-layout"><aside class="sa-panel"><div class="sa-panel-title"><b>Susunan Struktur Organisasi</b><small>Editor seperti SmartArt Word</small></div><div class="sa-help">Enter: tambah sejajar · Tab: jadikan bawahan · Shift+Tab: naik tingkat</div><div class="sa-outline" id="saOutline">'+(nodes.length?treeRows():'<p>Belum ada posisi. Klik Tambah Jabatan.</p>')+'</div><div class="sa-controls">'+(editable()?'<button class="btn yellow" id="saAdd">+ Tambah Jabatan</button><button class="btn" id="saChild">+ Bawahan</button><button class="btn" id="saIndent">→ Turunkan Level</button><button class="btn" id="saOutdent">← Naikkan Level</button><button class="btn" id="saUp">↑</button><button class="btn" id="saDown">↓</button><button class="btn danger" id="saRemove">Hapus Kotak</button>':'')+'<button class="btn" id="saPrint">Print SO</button><button class="btn" id="saExport">Backup SO</button>'+(editable()?'<label class="btn">Pulihkan SO<input id="saImport" type="file" accept=".json" hidden></label>':'')+'</div><p class="sa-footnote">Jabatan bisa berulang. Nama hanya dari MP Aktif dan tidak boleh dipakai dua kali. Jika nama belum dipilih, otomatis VACANT.</p></aside><div class="sa-sheet"><div class="sa-heading"><strong>STRUKTUR ORGANISASI</strong><div>PLANT DEPARTMENT KMB SITE KTA</div><b>TAHUN 2026</b></div>'+(nodes.length?'<div class="sa-chart-scroll"><ul class="sa-tree">'+roots.map(n=>chartNode(n)).join("")+'</ul></div>':'<p class="sa-empty">Bagan akan terbentuk otomatis ketika jabatan ditambahkan di panel kiri.</p>')+'</div></div>';
 const get=id=>nodes.find(n=>n.id===id);
 const add=(isChild=false)=>{if(!editable())return;const cur=get(selected),newNode={id:uid(),parent:isChild?(cur?.id||""):(cur?.parent||""),role:"",employeeKey:""};let at=cur?nodes.indexOf(cur)+1:nodes.length;nodes.splice(at,0,newNode);selected=newNode.id;save();setTimeout(()=>host.querySelector('[data-role="'+selected+'"]')?.focus(),0)};
 const moveLevel=dir=>{const cur=get(selected);if(!cur)return;const i=nodes.indexOf(cur);if(dir>0){const prev=nodes[i-1];if(!prev||prev.id===cur.parent)return;cur.parent=prev.id}else{const parent=get(cur.parent);cur.parent=parent?.parent||""}save()};
 const swap=delta=>{const i=nodes.findIndex(x=>x.id===selected),j=i+delta;if(i<0||j<0||j>=nodes.length)return;[nodes[i],nodes[j]]=[nodes[j],nodes[i]];save()};
 const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn};
 bind("saAdd",()=>add(false));bind("saChild",()=>add(true));bind("saIndent",()=>moveLevel(1));bind("saOutdent",()=>moveLevel(-1));bind("saUp",()=>swap(-1));bind("saDown",()=>swap(1));
 bind("saRemove",()=>{const n=get(selected);if(!n||!confirm("Hapus kotak SO ini? Data MP Aktif tetap aman."))return;nodes=nodes.filter(x=>x.id!==n.id).map(x=>x.parent===n.id?{...x,parent:n.parent}:x);selected=nodes[0]?.id||"";save()});
 bind("saPrint",()=>window.print());
 bind("saExport",()=>{const dataStr=JSON.stringify({version:1,slots:nodes},null,2);const a=document.createElement("a"),url=URL.createObjectURL(new Blob([dataStr],{type:"application/json"}));a.href=url;a.download="Backup_SO_KTA_TRA.json";a.click();URL.revokeObjectURL(url)});
 const imp=document.getElementById("saImport");if(imp)imp.onchange=()=>{const f=imp.files?.[0];if(!f)return;f.text().then(t=>{const obj=JSON.parse(t),arr=obj.slots;if(!Array.isArray(arr)||arr.some(n=>!n.id||typeof n.parent!=="string"))throw Error("Format SO tidak valid");if(confirm("Ganti susunan SO saat ini dengan file backup?")){nodes=arr;save()}}).catch(e=>alert("Gagal membuka backup: "+e.message))};
 host.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{selected=b.dataset.pick;host.querySelectorAll(".sa-outline-row").forEach(x=>x.classList.toggle("sa-selected",x.dataset.id===selected))});
 host.querySelectorAll("[data-role]").forEach(el=>{el.disabled=!editable();el.onfocus=()=>{selected=el.dataset.role};el.onchange=()=>{get(el.dataset.role).role=el.value;save()}});
 host.querySelectorAll("[data-name]").forEach(el=>{el.disabled=!editable();el.onfocus=()=>{selected=el.dataset.name};el.onchange=()=>{const n=get(el.dataset.name);if(el.value&&used(n.id).has(el.value)){alert("Nama ini sudah dipakai di SO.");render();return}n.employeeKey=el.value;save()}});
 const outline=document.getElementById("saOutline");outline.onkeydown=e=>{if(!editable()||e.target.tagName==="SELECT"&&e.key==="Enter")return;if(e.key==="Enter"){e.preventDefault();add(false)}else if(e.key==="Tab"){e.preventDefault();moveLevel(e.shiftKey?-1:1)}};
 host.querySelectorAll("[data-box]").forEach(el=>el.onclick=()=>{selected=el.dataset.box;const row=host.querySelector('.sa-outline-row[data-id="'+selected+'"]');row?.scrollIntoView({behavior:"smooth",block:"nearest"});host.querySelectorAll(".sa-outline-row").forEach(x=>x.classList.toggle("sa-selected",x===row))});
}
window.renderKtaSO=render;
document.addEventListener("DOMContentLoaded",render);
})();