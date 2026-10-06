const INITIAL=window.KMB_DATA||{sites:{},siteLabels:{},units:[],mpActive:[],mpOut:[]};
const KEY="kmb_monitoring_web_v1";
let data=loadData(),editState=null,mpMode="active";
const siteFields=["No","Nama","Jabatan","Keterangan","PIC","Judul","Awal Rekrutmen","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi","Due Date","Status","Tanggal Close"];
const mpFields=["No","Nama","Jabatan","Departemen","Level","Status Kontrak","Akhir Kontrak","POH","Tanggal Masuk","Masa Kerja","Jenis Kelamin","Pendidikan Terakhir","Keterangan","Tempat Bekerja","Blok Kamar"];
const mpOutFields=[...mpFields,"Tanggal Keluar","Alasan"];

function clone(v){return JSON.parse(JSON.stringify(v))}
function loadData(){
  try{
    const x=localStorage.getItem(KEY),saved=x?JSON.parse(x):clone(INITIAL);
    saved.sites=saved.sites||clone(INITIAL.sites||{});
    saved.siteLabels=saved.siteLabels||clone(INITIAL.siteLabels||{});
    saved.units=saved.units||clone(INITIAL.units||[]);
    if(!Array.isArray(saved.mpActive))saved.mpActive=clone(INITIAL.mpActive||[]);
    if(!Array.isArray(saved.mpOut))saved.mpOut=clone(INITIAL.mpOut||[]);
    return saved;
  }catch(e){return clone(INITIAL)}
}
function saveData(){localStorage.setItem(KEY,JSON.stringify(data));renderDashboard()}
function id(s){return s.replace(/[^a-z0-9]/gi,"_")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function fmtDate(v){if(!v)return "-";const d=new Date(v+"T00:00:00");return isNaN(d)?esc(v):new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(d)}
function badge(v){
  if(!v)return '<span class="badge neutral">-</span>';
  let c="neutral",t=String(v);
  if(/^open$/i.test(t))c="open";else if(/close|selesai/i.test(t))c="close";else if(/continue/i.test(t))c="continue";else if(/jatuh tempo/i.test(t))c="due";else if(/track/i.test(t))c="ok";
  return '<span class="badge '+c+'">'+esc(t)+'</span>';
}
function progress(r){
  const steps=[["Induksi",100,"INDUKSI"],["On Site",95,"ON SITE"],["FU MCU",80,"FU MCU"],["MCU",70,"MCU"],["Offering Latter",55,"OFFERING"],["Interview User",40,"INTERVIEW USER"],["Psikologi Test",25,"PSIKOLOGI TEST"]];
  for(const [k,p,label] of steps)if(r[k])return {p,label};
  return {p:0,label:"SOURCHING KANDIDAT"};
}
function daysLeft(v){
  if(!v)return "";
  const due=new Date(v+"T00:00:00"),today=new Date();today.setHours(0,0,0,0);
  return Math.round((due-today)/86400000);
}
function siteMetrics(rows){
  const planning=rows.length,vacant=rows.filter(r=>String(r.Nama||"").trim().toLowerCase()==="vacant"||String(r.Nama||"").trim()==="").length;
  return {planning,actual:planning-vacant,vacant,
    open:rows.filter(r=>String(r.Status).toLowerCase()==="open").length,
    cont:rows.filter(r=>String(r.Status).toLowerCase()==="continue").length,
    close:rows.filter(r=>String(r.Status).toLowerCase()==="close").length,
    due:rows.filter(r=>String(r["Keterangan PTK"]||"").trim().toUpperCase()==="JATUH TEMPO").length
  };
}
function makeSiteViews(){
  const host=document.getElementById("siteViews");host.innerHTML="";
  Object.keys(data.sites).forEach(key=>{
    const sec=document.createElement("section");sec.className="view";sec.id="site-"+id(key);
    sec.innerHTML='<div class="page-head"><div><h2>'+esc(data.siteLabels[key]||key)+'</h2><p>Monitoring manpower dan progress rekrutmen</p></div><div class="toolbar"><input class="input" id="q_'+id(key)+'" placeholder="Cari nama / jabatan..."><select class="select" id="st_'+id(key)+'"><option value="">Semua Status</option><option>Open</option><option>Continue</option><option>Close</option></select><button class="btn yellow" data-add="'+esc(key)+'">+ Tambah Data</button><button class="btn" data-export="'+esc(key)+'">Export CSV</button></div></div><div id="stats_'+id(key)+'"></div><div id="table_'+id(key)+'"></div>';
    host.appendChild(sec);
    document.getElementById("q_"+id(key)).addEventListener("input",()=>renderSite(key));
    document.getElementById("st_"+id(key)).addEventListener("change",()=>renderSite(key));
    sec.querySelector("[data-add]").onclick=()=>openSiteForm(key,null);
    sec.querySelector("[data-export]").onclick=()=>exportRows(data.sites[key],"KMB_"+(data.siteLabels[key]||key).replace(/\s+/g,"_")+".csv");
    renderSite(key);
  })
}
function renderDashboard(){
  let total={planning:0,actual:0,vacant:0,open:0,cont:0,close:0,due:0},rows="",bars="";
  Object.keys(data.sites).forEach(key=>{
    const m=siteMetrics(data.sites[key]);Object.keys(total).forEach(k=>total[k]+=m[k]||0);
    const pct=m.planning?Math.round(m.actual/m.planning*100):0;
    rows+='<tr><td><b>'+esc(data.siteLabels[key]||key)+'</b></td><td>'+m.planning+'</td><td>'+m.actual+'</td><td>'+m.vacant+'</td><td>'+pct+'%</td><td>'+m.open+'</td><td>'+m.cont+'</td><td>'+m.close+'</td><td>'+m.due+'</td></tr>';
    const h=Math.max(4,Math.round(m.actual/Math.max(1,m.planning)*135));
    bars+='<div class="barcol"><div class="bar" style="height:'+h+'px"></div><small>'+esc(data.siteLabels[key]||key)+'</small></div>';
  });
  document.getElementById("kPlanning").textContent=total.planning;
  document.getElementById("kActual").textContent=total.actual;
  document.getElementById("kVacant").textContent=total.vacant;
  document.getElementById("kPct").textContent=(total.planning?Math.round(total.actual/total.planning*100):0)+"%";
  document.getElementById("summaryBody").innerHTML=rows;
  document.getElementById("bars").innerHTML=bars;
  document.getElementById("statusCards").innerHTML=[["Open",total.open],["Continue",total.cont],["Close",total.close],["Jatuh Tempo",total.due]].map(x=>'<div class="mini"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join("");
  let vac={};Object.values(data.sites).flat().filter(r=>String(r.Nama||"").trim().toLowerCase()==="vacant"||!String(r.Nama||"").trim()).forEach(r=>vac[r.Jabatan||"Belum ditentukan"]=(vac[r.Jabatan||"Belum ditentukan"]||0)+1);
  document.getElementById("vacancies").innerHTML=Object.keys(vac).length?Object.entries(vac).sort((a,b)=>b[1]-a[1]).map(x=>'<div class="vacancy-row"><span>'+esc(x[0])+'</span><b>'+x[1]+'</b></div>').join(""):'<div class="empty">Tidak ada vacant</div>';
  renderRecruitmentSummary();
}
function renderRecruitmentSummary(){
  const openRows=[];
  Object.keys(data.sites).forEach(key=>{
    (data.sites[key]||[]).forEach(r=>{
      if(String(r.Status||"").toLowerCase()!=="open")return;
      const p=progress(r),days=daysLeft(r["Due Date"]);
      openRows.push({site:key,row:r,p,days});
    })
  });
  document.getElementById("recruitCount").textContent=openRows.length+" OPEN";
  document.getElementById("recruitBody").innerHTML=openRows.length?openRows.map(x=>{
    const r=x.row,dayClass=x.days<0?"overdue":x.days<=7?"warning":"";
    return '<tr><td><b>'+esc(x.site)+'</b></td><td>'+esc(r.Jabatan||"-")+'</td><td>'+fmtDate(r["Awal Rekrutmen"])+'</td><td>'+fmtDate(r["Due Date"])+'</td><td><span class="days '+dayClass+'">'+(x.days===""?"-":x.days)+'</span></td><td>'+badge(r.Status)+'</td><td><b>'+esc(x.p.label)+'</b></td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress recruit-progress"><i style="width:'+x.p.p+'%"></i></div><b>'+x.p.p+'%</b></div></td><td>'+esc((r.Nama||"")+(r.Keterangan?" — "+r.Keterangan:""))+'</td></tr>';
  }).join(""):'<tr><td colspan="9" class="empty">Tidak ada rekrutmen OPEN</td></tr>';
}
function renderSite(key){
  const q=(document.getElementById("q_"+id(key))?.value||"").toLowerCase(),st=document.getElementById("st_"+id(key))?.value||"",all=data.sites[key]||[],m=siteMetrics(all);
  document.getElementById("stats_"+id(key)).innerHTML='<div class="stats"><div class="mini"><b>'+m.planning+'</b><span>Planning</span></div><div class="mini"><b>'+m.actual+'</b><span>Actual</span></div><div class="mini"><b>'+m.vacant+'</b><span>Vacant</span></div><div class="mini"><b>'+m.open+'</b><span>Open</span></div><div class="mini"><b>'+m.close+'</b><span>Close</span></div></div>';
  const rows=all.map((r,i)=>({...r,__i:i})).filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q))&&(!st||r.Status===st));
  let body=rows.map(r=>{const p=progress(r);return '<tr><td>'+esc(r.No)+'</td><td><b>'+esc(r.Nama||"-")+'</b></td><td>'+esc(r.Jabatan||"-")+'</td><td>'+esc(r.Keterangan||"-")+'</td><td>'+esc(r.PIC||"-")+'</td><td>'+badge(r.Status)+'</td><td><div style="display:flex;align-items:center;gap:7px"><div class="progress"><i style="width:'+p.p+'%"></i></div><b>'+p.p+'%</b></div><div style="font-size:10px;color:#6b7280;margin-top:3px">'+esc(p.label)+'</div></td><td>'+fmtDate(r["Due Date"])+'</td><td>'+badge(r["Keterangan PTK"])+'</td><td><button class="btn" onclick="openSiteForm(decodeURIComponent(\''+encodeURIComponent(key)+'\'),'+r.__i+')">Edit</button> <button class="btn danger" onclick="removeSiteRow(decodeURIComponent(\''+encodeURIComponent(key)+'\'),'+r.__i+')">Hapus</button></td></tr>'}).join("");
  document.getElementById("table_"+id(key)).innerHTML='<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Keterangan</th><th>PIC</th><th>Status</th><th>Progress</th><th>Due Date</th><th>Ket. PTK</th><th>Aksi</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function computePTK(r){
  if(!r.Judul||!r["Awal Rekrutmen"]){r["Keterangan PTK"]="TIDAK ADA PENGAJUAN";return}
  if(r.Status==="Close"){r["Keterangan PTK"]="SELESAI";return}
  if(!r["Due Date"]){r["Keterangan PTK"]="";return}
  const d=daysLeft(r["Due Date"]);r["Keterangan PTK"]=d<=0?"JATUH TEMPO":d<=7?"HAMPIR JATUH TEMPO":"ON TRACK";
}
function fieldHtml(f,row){
  if(f==="Status")return '<div class="field"><label>'+f+'</label><select data-f="'+f+'"><option value=""></option>'+["Open","Continue","Close"].map(x=>'<option '+(row[f]===x?"selected":"")+'>'+x+'</option>').join("")+'</select></div>';
  if(["Keterangan","Alasan"].includes(f))return '<div class="field"><label>'+f+'</label><textarea data-f="'+f+'">'+esc(row[f]||"")+'</textarea></div>';
  const type=/Tanggal|Date|Kontrak$/.test(f)||["Awal Rekrutmen","Psikologi Test","Interview User","MCU","FU MCU","On Site","Induksi"].includes(f)?"date":"text";
  return '<div class="field"><label>'+f+'</label><input type="'+type+'" data-f="'+f+'" value="'+esc(row[f]||"")+'"></div>';
}
function openSiteForm(key,index){
  editState={type:"site",key,index};const row=index===null?{}:data.sites[key][index];
  document.getElementById("modalTitle").textContent=(index===null?"Tambah Data - ":"Edit Data - ")+(data.siteLabels[key]||key);
  document.getElementById("formFields").innerHTML=siteFields.map(f=>fieldHtml(f,row)).join("");
  document.getElementById("modal").classList.add("show");
}
function closeModal(){document.getElementById("modal").classList.remove("show");editState=null}
function saveModal(){
  if(!editState)return;let row={};document.querySelectorAll("#formFields [data-f]").forEach(el=>row[el.dataset.f]=el.value);
  if(editState.type==="site"){
    if(!row.No)row.No=String((data.sites[editState.key]||[]).length+1);computePTK(row);
    if(editState.index===null)data.sites[editState.key].push(row);else data.sites[editState.key][editState.index]={...data.sites[editState.key][editState.index],...row};
    const k=editState.key;saveData();renderSite(k);closeModal();return;
  }
  const arr=editState.mode==="active"?data.mpActive:data.mpOut;
  if(!row.No)row.No=String(arr.length+1);
  if(editState.index===null)arr.push(row);else arr[editState.index]={...arr[editState.index],...row};
  saveData();renderMP();closeModal();
}
function removeSiteRow(key,index){if(confirm("Hapus data ini?")){data.sites[key].splice(index,1);saveData();renderSite(key)}}
function renderUnits(){
  const q=(document.getElementById("unitSearch")?.value||"").toLowerCase();
  document.getElementById("unitTables").innerHTML=(data.units||[]).map(sec=>{
    const rows=sec.rows.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q)),heads=[...new Set(sec.rows.flatMap(r=>Object.keys(r)))];
    return '<div class="card unit-block"><div class="section-head"><h3>'+esc(sec.name)+'</h3><span class="badge ok">'+rows.filter(r=>String(r["No."]||"")!=="Dolly").length+' unit</span></div><div class="table-wrap"><table class="table"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+heads.map(h=>'<td>'+esc(r[h]||"-")+'</td>').join("")+'</tr>').join("")+'</tbody></table></div></div>'
  }).join("");
}
function setMPMode(mode){
  mpMode=mode;document.querySelectorAll(".mp-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));renderMP();
}
function renderMP(){
  const arr=mpMode==="active"?(data.mpActive||[]):(data.mpOut||[]),q=(document.getElementById("mpSearch")?.value||"").toLowerCase();
  const rows=arr.map((r,i)=>({...r,__i:i})).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
  document.getElementById("mpTitle").textContent=mpMode==="active"?"MP Aktif":"MP OUT";
  document.getElementById("mpCount").textContent=rows.length+" data";
  document.getElementById("mpTable").innerHTML='<div class="table-wrap"><table class="table mp-table"><thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Departemen</th><th>Status Kontrak</th><th>Tempat Bekerja</th><th>Tanggal Masuk</th>'+(mpMode==="out"?'<th>Tanggal Keluar</th><th>Alasan</th>':'<th>Keterangan</th>')+'<th>Aksi</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.No)+'</td><td><b>'+esc(r.Nama||"-")+'</b></td><td>'+esc(r.Jabatan||"-")+'</td><td>'+esc(r.Departemen||"-")+'</td><td>'+esc(r["Status Kontrak"]||"-")+'</td><td>'+esc(r["Tempat Bekerja"]||"-")+'</td><td>'+fmtDate(r["Tanggal Masuk"])+'</td>'+(mpMode==="out"?'<td>'+fmtDate(r["Tanggal Keluar"])+'</td><td>'+esc(r.Alasan||"-")+'</td>':'<td>'+esc(r.Keterangan||"-")+'</td>')+'<td><button class="btn" onclick="openMpForm(\''+mpMode+'\','+r.__i+')">Edit</button> <button class="btn danger" onclick="removeMpRow(\''+mpMode+'\','+r.__i+')">Hapus</button></td></tr>').join("")+'</tbody></table></div>';
}
function openMpForm(mode,index){
  editState={type:"mp",mode,index};const arr=mode==="active"?data.mpActive:data.mpOut,row=index===null?{}:arr[index],fs=mode==="active"?mpFields:mpOutFields;
  document.getElementById("modalTitle").textContent=(index===null?"Tambah ":"Edit ")+(mode==="active"?"MP Aktif":"MP OUT");
  document.getElementById("formFields").innerHTML=fs.map(f=>fieldHtml(f,row)).join("");
  document.getElementById("modal").classList.add("show");
}
function removeMpRow(mode,index){
  if(!confirm("Hapus data manpower ini?"))return;
  (mode==="active"?data.mpActive:data.mpOut).splice(index,1);saveData();renderMP();
}
function csv(rows){if(!rows.length)return "";const hs=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!k.startsWith("__"))))],q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';return "\ufeff"+hs.map(q).join(",")+"\n"+rows.map(r=>hs.map(h=>q(r[h])).join(",")).join("\n")}
function download(content,name,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:type||"text/csv;charset=utf-8"}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
function exportRows(rows,name){download(csv(rows),name)}
function exportUnits(){const rows=(data.units||[]).flatMap(s=>s.rows.map(r=>({Jobsite:s.name,...r})));exportRows(rows,"KMB_Populasi_Unit.csv")}
function exportMP(){exportRows(mpMode==="active"?data.mpActive:data.mpOut,mpMode==="active"?"KMB_MP_Aktif.csv":"KMB_MP_OUT.csv")}
function backup(){download(JSON.stringify(data,null,2),"Monitoring_KMB_Backup.json","application/json")}
function importBackup(input){
  const file=input.files&&input.files[0];if(!file)return;const rd=new FileReader();
  rd.onload=()=>{try{const v=JSON.parse(rd.result);if(!v.sites)throw new Error();data=v;if(!data.mpActive)data.mpActive=[];if(!data.mpOut)data.mpOut=[];saveData();makeSiteViews();renderUnits();renderMP();alert("Backup berhasil dimuat.")}catch(e){alert("File backup tidak valid.")}};rd.readAsText(file)
}
function resetAll(){if(confirm("Kembalikan data ke kondisi awal dari Excel?")){data=clone(INITIAL);localStorage.removeItem(KEY);makeSiteViews();renderDashboard();renderUnits();renderMP();showView("dashboard")}}
function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));const el=document.getElementById(name);if(el)el.classList.add("active");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===name));
  document.getElementById("topTitle").textContent=document.querySelector('.nav[data-view="'+name+'"]')?.dataset.title||"Monitoring KMB";
  document.getElementById("sidebar").classList.remove("open");window.scrollTo(0,0);
  if(name==="mp")renderMP();
}
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("today").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  makeSiteViews();renderDashboard();renderUnits();renderMP();
  document.getElementById("unitSearch").addEventListener("input",renderUnits);
  document.getElementById("mpSearch").addEventListener("input",renderMP);
  document.querySelectorAll(".mp-tab").forEach(b=>b.onclick=()=>setMPMode(b.dataset.mode));
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>showView(n.dataset.view));
  document.getElementById("saveModal").onclick=saveModal;document.getElementById("closeModal").onclick=closeModal;
  document.getElementById("menuBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("backupBtn").onclick=backup;document.getElementById("resetBtn").onclick=resetAll;document.getElementById("importFile").onchange=e=>importBackup(e.target);
  document.getElementById("exportUnits").onclick=exportUnits;document.getElementById("exportMP").onclick=exportMP;document.getElementById("addMP").onclick=()=>openMpForm(mpMode,null);
  showView("dashboard");
});