/* KMB Organization Chart Editor - independent synchronized chart */
(function(){
"use strict";
const p=location.pathname,appId=p.includes("monitoring-kta-tra")?"kta-tra":p.includes("monitoring-bupr-ampah")?"bupr-ampah":p.includes("monitoring-mbj")?"mbj":"kmb";
let sb, nodes=[],selected=null,editing=false,ready=false,dirty=false,chartZoom=1,zoomPercent=100;
const clone=o=>JSON.parse(JSON.stringify(o));
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const staff=()=>["owner","editor"].includes(window.accessMode?.());
function connect(){if(!sb&&window.supabase?.createClient&&window.KMB_SUPABASE_CONFIG){const c=window.KMB_SUPABASE_CONFIG;sb=window.supabase.createClient(c.url,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}return sb}
function notice(t){let e=document.getElementById("soMessage");if(e)e.textContent=t}
function mppItems(){
 try{
 const source=typeof data!=="undefined"?data:null;if(!source)return [];
 if(appId==="kmb")return Object.entries(source.sites||{}).flatMap(([site,rows])=>(rows||[]).map((r,i)=>({key:site+"|"+String(r.No??i+1),name:String(r.Nama||"").trim(),role:String(r.Jabatan||"").trim(),label:(source.siteLabels?.[site]||site)+" / #"+(r.No??i+1)+" / "+(r.Jabatan||"-"),row:r})));
 return (source.mpp||[]).map((r,i)=>({key:String(r.No??i+1),name:String(r.Nama||"").trim(),role:String(r.Jabatan||"").trim(),label:"#"+(r.No??i+1)+" / "+(r.Jabatan||"-"),row:r}));
 }catch(e){return []}
}
function displayName(n){
 if(n.sectionHeading)return "";
 const item=mppItems().find(x=>x.key===String(n.mppKey||""));
 if(item)return !item.name||/^vacant$/i.test(item.name)?"VACANT":item.name;
 return /^vacant\b/i.test(String(n.name||""))?"VACANT":(n.name||"VACANT");
}
function autoAssignBupr(){
 if(appId!=="bupr-ampah")return;
 const items=mppItems(),used=new Set(nodes.filter(n=>n.mppKey).map(n=>String(n.mppKey)));
 const mapRole=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/junior/g,"jr").replace(/mechanic/g,"mekanik");
 const score=(n,r)=>{
 const a=mapRole(n.role),b=mapRole(r.role);
 if(!a||!b)return false;
 if(a.includes("welder"))return b.includes("welder");
 if(a.includes("seniormekanik"))return b.includes("seniormekanik");
 if(a.includes("middlemekanik"))return b.includes("middlemekanik")||b.includes("midlemekanik");
 if(a.includes("jrmekanik"))return b.includes("jrmekanik");
 if(a.includes("tyre"))return b.includes("tyre")||b.includes("tire");
 if(a.includes("planner"))return b.includes("planner");
 if(a.includes("superintendent"))return b.includes("superintendent")||b.includes("supervisor");
 return false
 };
 nodes.forEach(n=>{
  if(n.mppKey||n.sectionHeading)return;
  const found=items.find(x=>!used.has(x.key)&&score(n,x));
  if(found){n.mppKey=found.key;used.add(found.key)}
 });
}

async function load(){
 const db=connect();if(!db){notice("Koneksi database belum tersedia.");return}
 const {data,error}=await db.from("organizational_charts").select("nodes").eq("app_id",appId).maybeSingle();
 if(error){notice("Gagal memuat: "+error.message);return}
 nodes=Array.isArray(data?.nodes)?data.nodes:[];if(appId==="bupr-ampah")autoAssignBupr();ready=true;dirty=false;draw();notice(nodes.length?"Struktur organisasi tersinkronisasi.":"Struktur masih kosong. Klik Tambah Posisi untuk memulai.");
}
async function save(){
 if(!staff()){notice("Masuk sebagai Pemilik atau Editor dahulu.");return}
 if(!ready)return;
 const db=connect(),button=document.getElementById("soSave");button.disabled=true;notice("Menyimpan...");
 const {error}=await db.from("organizational_charts").upsert({app_id:appId,nodes:clone(nodes),updated_at:new Date().toISOString()},{onConflict:"app_id"});
 button.disabled=false;
 if(error){notice("Gagal simpan: "+error.message);return}
 dirty=false;notice("Tersimpan ke database. Perubahan bisa dilihat di perangkat lain.");
}
function add(){if(!staff())return;const max=nodes.reduce((a,n)=>Math.max(a,Number(n.y)||0),0);const id=crypto.randomUUID();nodes.push({id,name:"VACANT",role:"Jabatan Baru",parent:"",x:120+(nodes.length%4)*250,y:max?max+150:55});editing=true;dirty=true;selected=id;draw();editPanel()}
function fitChart(){
 const scroller=document.querySelector(".so-scroller"),stage=document.getElementById("soStage");if(!scroller||!stage)return;
 const w=parseFloat(stage.style.width)||1000,h=parseFloat(stage.style.height)||500;
 const availableW=Math.max(320,scroller.clientWidth-20),availableH=Math.max(320,window.innerHeight-scroller.getBoundingClientRect().top-42);
 chartZoom=Math.min(1,availableW/w,availableH/h);
 zoomPercent=Math.max(10,Math.min(200,Math.round(chartZoom*100)));
 applyZoom();
}
function applyZoom(){
 const scroller=document.querySelector(".so-scroller"),stage=document.getElementById("soStage");if(!scroller||!stage)return;
 chartZoom=zoomPercent/100;stage.style.zoom=String(chartZoom);
 const h=parseFloat(stage.style.height)||500;
 const availableH=Math.max(320,window.innerHeight-scroller.getBoundingClientRect().top-42);
 scroller.style.height=Math.ceil(Math.min(h*chartZoom+16,availableH+10))+"px";
 scroller.style.minHeight="0";scroller.style.overflow="auto";
 const slider=document.getElementById("soZoomRange"),label=document.getElementById("soZoomLabel");
 if(slider)slider.value=String(zoomPercent);
 if(label)label.textContent=zoomPercent+"%";
}
function setZoom(n){zoomPercent=Math.max(10,Math.min(200,Math.round(n/5)*5));applyZoom()}
function draw(){
 const svg=document.getElementById("soLines"),stage=document.getElementById("soStage");if(!svg||!stage)return;
 const old=stage.querySelectorAll(".so-node");old.forEach(n=>n.remove());
 let w=Math.max(1000,...nodes.map(n=>(Number(n.x)||0)+260)),h=Math.max(500,...nodes.map(n=>(Number(n.y)||0)+130));
 stage.style.width=w+"px";stage.style.height=h+"px";svg.setAttribute("viewBox","0 0 "+w+" "+h);svg.setAttribute("width",w);svg.setAttribute("height",h);
 svg.replaceChildren();
 nodes.forEach(n=>{
 const parent=nodes.find(x=>x.id===n.parent);
 if(parent){
 const path=document.createElementNS("http://www.w3.org/2000/svg","path");
 const x1=(+parent.x||0)+105,y1=(+parent.y||0)+82,x2=(+n.x||0)+105,y2=(+n.y||0);
 const my=(y1+y2)/2;path.setAttribute("d",`M ${x1} ${y1} V ${my} H ${x2} V ${y2}`);path.setAttribute("fill","none");path.setAttribute("stroke","#8b97b5");path.setAttribute("stroke-width","2");svg.append(path);
 }
 });
 nodes.forEach(n=>{
 const el=document.createElement("div");el.className="so-node"+(selected===n.id?" selected":"")+(displayName(n)==="VACANT"?" vacant":"");el.style.left=(+n.x||0)+"px";el.style.top=(+n.y||0)+"px";
 el.innerHTML='<div class="so-role">'+safe(n.role)+'</div><div class="so-name">'+safe(displayName(n))+'</div>';
 el.addEventListener("click",()=>{selected=n.id;draw();editPanel()});
 if(staff())el.addEventListener("pointerdown",ev=>{
  if(ev.button!==0)return;
  const startX=ev.clientX,startY=ev.clientY,ox=+n.x||0,oy=+n.y||0;
  el.setPointerCapture(ev.pointerId);
  el.onpointermove=e=>{if(!el.hasPointerCapture(e.pointerId))return;n.x=Math.max(0,Math.round(ox+(e.clientX-startX)/chartZoom));n.y=Math.max(0,Math.round(oy+(e.clientY-startY)/chartZoom));el.style.left=n.x+"px";el.style.top=n.y+"px";dirty=true;redrawLines()};
  el.onpointerup=e=>{el.onpointermove=null;el.onpointerup=null;selected=n.id;draw();editPanel()};
 });
 stage.append(el);
 });
 fitChart();
 document.getElementById("soTools").style.display=staff()?"flex":"none";
}
function redrawLines(){const svg=document.getElementById("soLines");svg.replaceChildren();nodes.forEach(n=>{const par=nodes.find(x=>x.id===n.parent);if(!par)return;const x1=(+par.x||0)+105,y1=(+par.y||0)+82,x2=(+n.x||0)+105,y2=(+n.y||0),my=(y1+y2)/2;const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",`M ${x1} ${y1} V ${my} H ${x2} V ${y2}`);path.setAttribute("stroke","#8b97b5");path.setAttribute("stroke-width","2");path.setAttribute("fill","none");svg.append(path)})}
function editPanel(){
 const box=document.getElementById("soEditor");if(!box)return;
 const n=nodes.find(x=>x.id===selected);
 if(!n||!staff()){box.hidden=true;return}
 box.hidden=false;
 const options=mppItems();
 box.innerHTML='<h3>Edit Posisi</h3><label>Link ke posisi MPP<select id="soMPP"><option value="">Tidak terhubung (manual)</option>'+options.map(x=>'<option value="'+safe(x.key)+'" '+(String(n.mppKey||"")===x.key?'selected':'')+'>'+safe(x.label)+'</option>').join('')+'</select></label><label>Jabatan<input id="soRole" value="'+safe(n.role)+'"></label><label>Nama<input id="soName" value="'+safe(n.name)+'"></label><label>Atasan langsung<select id="soParent"><option value="">Tidak ada / Pimpinan utama</option>'+nodes.filter(x=>x.id!==n.id).map(x=>'<option value="'+safe(x.id)+'" '+(x.id===n.parent?'selected':'')+'>'+safe(x.role)+' — '+safe(x.name)+'</option>').join('')+'</select></label><div class="so-edit-actions"><button type="button" id="soUpdate">Terapkan</button><button type="button" id="soDelete" class="so-danger">Hapus Posisi</button></div>';
 document.getElementById("soUpdate").onclick=()=>{
 const par=document.getElementById("soParent").value;let ancestor=par;
 while(ancestor){if(ancestor===n.id){alert("Hubungan atasan tidak boleh membentuk lingkaran.");return}ancestor=nodes.find(x=>x.id===ancestor)?.parent||""}
 n.mppKey=document.getElementById("soMPP").value;n.name=document.getElementById("soName").value.trim()||"VACANT";n.role=document.getElementById("soRole").value.trim()||"Jabatan";n.parent=par;dirty=true;draw();editPanel();notice("Perubahan belum disimpan. Klik Simpan Struktur.");
 };
 document.getElementById("soDelete").onclick=()=>{if(!confirm("Hapus posisi ini dari struktur organisasi?"))return;nodes=nodes.filter(x=>x.id!==n.id);nodes.forEach(x=>{if(x.parent===n.id)x.parent=""});selected=null;dirty=true;draw();editPanel();notice("Posisi dihapus dari bagan. Klik Simpan Struktur.")};
}
function setup(){
 const v=document.getElementById("organization");if(!v)return;
 v.innerHTML='<div class="so-head"><div><span class="eyebrow">ORGANIZATION</span><h2>Struktur Organisasi</h2><p>Klik kotak untuk mengedit. Geser kotak untuk menata posisi; garis otomatis mengikuti atasan langsung.</p></div><div id="soTools" class="so-tools"><button class="btn" id="soAdd">+ Tambah Posisi</button><button class="btn yellow" id="soSave">Simpan Struktur</button><button class="btn" id="soReload">Muat Ulang</button><button class="btn" id="soPrint">Print</button></div></div><div class="so-zoom-bar"><span>Zoom</span><button type="button" id="soZoomOut" title="Perkecil">−</button><input id="soZoomRange" type="range" min="10" max="200" step="5" value="100" aria-label="Zoom struktur organisasi"><button type="button" id="soZoomIn" title="Perbesar">+</button><strong id="soZoomLabel">100%</strong><button type="button" id="soZoomFit">Pas Layar</button><button type="button" id="soZoom100">100%</button></div><div id="soMessage" class="so-message">Memuat struktur organisasi...</div><div class="so-layout"><div class="so-scroller"><div id="soStage" class="so-stage"><svg id="soLines" class="so-lines"></svg></div></div><aside class="so-editor" id="soEditor" hidden></aside></div>';
 document.getElementById("soAdd").onclick=add;document.getElementById("soSave").onclick=save;
 document.getElementById("soReload").onclick=()=>{if(dirty&&!confirm("Buang perubahan yang belum disimpan?"))return;selected=null;editPanel();load()};
 document.getElementById("soPrint").onclick=()=>window.print();
 document.getElementById("soZoomOut").onclick=()=>setZoom(zoomPercent-10);
 document.getElementById("soZoomIn").onclick=()=>setZoom(zoomPercent+10);
 document.getElementById("soZoomRange").oninput=e=>setZoom(Number(e.target.value));
 document.getElementById("soZoomFit").onclick=fitChart;
 document.getElementById("soZoom100").onclick=()=>setZoom(100);
 load();
}
const css=document.createElement("style");css.textContent=`
.so-zoom-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:white;border:1px solid #e3e6ef;border-radius:10px;padding:8px 12px;margin-top:12px;font-size:12px;color:#58677c}.so-zoom-bar button{border:1px solid #d6dded;border-radius:7px;background:#f6f3ff;color:#5b21b6;padding:6px 12px;cursor:pointer;font-weight:800}.so-zoom-bar input{width:155px;accent-color:#7c3aed}.so-zoom-bar strong{min-width:43px;text-align:center;color:#17243b}.so-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.so-head h2{margin:5px 0}.so-head p{font-size:13px;color:#68758a}.so-tools{display:flex;gap:8px;flex-wrap:wrap}.so-message{margin:12px 0;font-size:12px;color:#596e8c}.so-layout{display:flex;gap:14px;align-items:start}.so-scroller{background:#fbfcff;border:1px solid #e3e6ef;border-radius:14px;overflow:auto;flex:1;min-width:0;min-height:540px;max-height:75vh}.so-stage{position:relative;min-width:1000px;min-height:500px}.so-lines{position:absolute;inset:0;pointer-events:none}.so-node{position:absolute;width:210px;min-height:82px;padding:12px 9px;text-align:center;background:#fff;border:2px solid #d7dded;border-top:5px solid #7c3aed;border-radius:11px;box-shadow:0 4px 14px #1d2a4615;cursor:grab;touch-action:none;user-select:none}.so-node.selected{border-color:#8b5cf6}.so-node.vacant{border-top-color:#dc2626;background:#fff6f6}.so-role{font-size:13px;font-weight:800;color:#273348}.so-name{font-size:12px;margin-top:5px;color:#5e6b81}.so-node.vacant .so-name{color:#b91c1c;font-weight:750}.so-editor{padding:15px;width:260px;flex-shrink:0;background:white;border:1px solid #e1e5ec;border-radius:12px}.so-editor h3{margin:0 0 12px;font-size:16px}.so-editor label{display:block;font-size:12px;color:#58677c;margin:9px 0}.so-editor input,.so-editor select{display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #d7ddea;border-radius:8px;background:white;color:#17243b}.so-edit-actions{display:flex;gap:7px}.so-edit-actions button{border:0;background:#7c3aed;color:white;padding:9px;border-radius:8px;cursor:pointer}.so-edit-actions .so-danger{background:#fee2e2;color:#b91c1c}@media(max-width:720px){.so-layout{flex-direction:column}.so-scroller,.so-editor{width:100%}}@media print{body:has(#organization.view.active) .sidebar,body:has(#organization.view.active) .topbar,body:has(#organization.view.active) .so-tools,body:has(#organization.view.active) .so-editor{display:none!important}body:has(#organization.view.active) .view:not(#organization){display:none!important}body:has(#organization.view.active) .so-scroller{overflow:visible!important;max-height:none!important;border:0!important}body:has(#organization.view.active) .so-stage{transform-origin:top left;zoom:.72}body:has(#organization.view.active) .main{margin:0!important;width:100%!important}}`;
document.head.append(css);
document.addEventListener("DOMContentLoaded",setup);
window.addEventListener("resize",()=>{if(document.getElementById("organization")?.classList.contains("active"))fitChart()});
document.addEventListener("click",e=>{if(e.target.closest?.('[data-view="organization"]'))requestAnimationFrame(fitChart)});
window.addEventListener("focus",()=>{if(!dirty&&document.getElementById("organization")?.classList.contains("active"))load()});
})();