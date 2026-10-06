const INITIAL=window.KMB_DATA||{sites:{},siteLabels:{},units:[],mpActive:[],mpOut:[]};
const KEY="kmb_monitoring_web_v1";
const OWNER_EMAIL="matthewyoga2014@gmail.com";
function isEditorMode(){return new URLSearchParams(window.location.search).get("mode")==="editor"}
function ownerOnly(){
  if(!isEditorMode())return true;
  alert("Mode Editor hanya untuk mengisi data operasional. Pengaturan hanya dapat diakses Pemilik / Administrator.");
  goDashboard();
  return false;
}
function applyAccessMode(){
  const settingsNav=document.querySelector('.nav[data-view="settings"]');
  if(settingsNav)settingsNav.style.display=isEditorMode()?"none":"";
  document.body.classList.toggle("editor-mode",isEditorMode());
  const title=document.querySelector(".app-name");
  if(title&&isEditorMode())title.textContent="Monitoring Manpower KMB • MODE EDITOR";
}

const EDITOR_KEY="kmb_editors";
const SOURCE_SYNC_KEY="kmb_excel_sync_monitoring6_v1";
let data=loadData(),editState=null,mpMode="active",mpFullView=false,recruitRoleFilter="";

const SITE_FIELDS=["No","Nama","Jabatan","Keterangan","PIC","Judul","Awal Rekrutmen","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi","Due Date","Status","Tanggal Close"];
const SITE_IMPORT_FIELDS=[...SITE_FIELDS,"Keterangan PTK","Lama Closing (Hari)","Open Index"];
const MP_SCHEMA_ACTIVE=[
"No.","NIP (KARYAWAN)","NIK KTP","NO.KK","Nama","NO. NPWP","Nomor HP","Jabatan","Departemen","Level",
"Status Kontrak PKWT/PKWTT/Harian Lepas","Akhir Kontrak","POH","Sisa Hari","Reminder","Tanggal Masuk","Masa Kerja",
"Jenis Kelamin","Agama","Tempat Lahir","Tgl/Lahir","Umur","Pendidikan Terakhir","Alamat Domisili","Alamat Lengkap",
"Keterangan","Tempat Bekerja","No Rekening","Nama Bank","Nama Pemilik Rekening","Nomor BPJS Kesehatan",
"Nomor BPJS Ketenagakerjaan","Nama Ibu","Pendidikan Terakhir Ibu","Pekerjaan Ibu","Nama Ayah","Pendidikan Terakhir Ayah",
"Pekerjaan Ayah","Saudara Kandung (1)","Jenis Kelamin (1)","Tanggal Lahir (1)","Saudara Kandung (2)","Jenis Kelamin (2)",
"Tanggal Lahir (2)","Saudara Kandung (3)","Jenis Kelamin (3)","Tanggal Lahir (3)","Saudara Kandung (4)","Jenis Kelamin (4)",
"Tanggal Lahir (4)","Nama Emergency","Hubungan","Nomor Telepon","STATUS","BLOK KAMAR"
];
const MP_SCHEMA_OUT=[...MP_SCHEMA_ACTIVE,"Tanggal Keluar","Alasan"];
const SENSITIVE_FIELDS=new Set(["NIP (KARYAWAN)","NIK KTP","NO.KK","NO. NPWP","Nomor HP","Alamat Domisili","Alamat Lengkap","No Rekening","Nama Bank","Nama Pemilik Rekening","Nomor BPJS Kesehatan","Nomor BPJS Ketenagakerjaan","Nama Ibu","Pendidikan Terakhir Ibu","Pekerjaan Ibu","Nama Ayah","Pendidikan Terakhir Ayah","Pekerjaan Ayah","Saudara Kandung (1)","Jenis Kelamin (1)","Tanggal Lahir (1)","Saudara Kandung (2)","Jenis Kelamin (2)","Tanggal Lahir (2)","Saudara Kandung (3)","Jenis Kelamin (3)","Tanggal Lahir (3)","Saudara Kandung (4)","Jenis Kelamin (4)","Tanggal Lahir (4)","Nama Emergency","Hubungan","Nomor Telepon"]);
const SUMMARY_MP_FIELDS=["No.","Nama","Jabatan","Departemen","Status Kontrak PKWT/PKWTT/Harian Lepas","POH","Tanggal Masuk","Masa Kerja","Keterangan","Tempat Bekerja","STATUS","BLOK KAMAR"];
const SITE_DISPLAY_ORDER=["C4","SLR - MAINTENANCE","SLR - REKONDISI","WS"];

function clone(v){return JSON.parse(JSON.stringify(v))}
function normText(v){return String(v??"").trim()}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function id(s){return String(s).replace(/[^a-z0-9]/gi,"_")}
function todayISO(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function fmtDate(v){if(!v)return "-";const s=String(v);const d=/^\d{4}-\d{2}-\d{2}/.test(s)?new Date(s.slice(0,10)+"T00:00:00"):new Date(s);return isNaN(d)?esc(v):new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(d)}
function canonicalJob(v){let s=normText(v).toLowerCase();s=s.replace(/\bjr\b/g,"junior").replace(/\bharian\b/g,"").replace(/\s+/g," ").trim();return s}
function canonicalJobLabel(v){const s=canonicalJob(v);if(s==="junior mekanik")return "Junior Mekanik";if(s==="junior welder")return "Junior Welder";if(s==="helper mekanik")return "Helper Mekanik";if(s==="admin plant")return "Admin Plant";return normText(v)||"Belum ditentukan"}
function nameKey(v){
  let s=normText(v).toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
  const aliases={"khoirul mustofa":"khoirul musthofa","adi":"aditya"};
  return aliases[s]||s;
}
function sameName(a,b){return nameKey(a)===nameKey(b)}
function isVacantName(v){const s=normText(v).toLowerCase();return !s||s==="vacant"}
function siteKeyFromPlacement(v){const s=normText(v).toLowerCase();if(!s)return "";if(s==="c4"||s.includes("kta")||s.includes("tra"))return "C4";if(s.includes("maintenance"))return "SLR - MAINTENANCE";if(s.includes("rekondisi"))return "SLR - REKONDISI";if(s.includes("workshop")||s.includes("legok")||s==="ws")return "WS";return ""}
function placementFromSiteKey(k){return ({C4:"C4","SLR - MAINTENANCE":"SLR - Maintenance","SLR - REKONDISI":"SLR - Rekondisi",WS:"Workshop Legok"})[k]||k}
function normalizedMP(row){
  const out={};
  const legacy={
    "No.":["No.","No"],"NIP (KARYAWAN)":["NIP (KARYAWAN)","NIP\n (KARYAWAN)"],"Status Kontrak PKWT/PKWTT/Harian Lepas":["Status Kontrak PKWT/PKWTT/Harian Lepas","Status Kontrak"],
    "Tanggal Masuk":["Tanggal Masuk","Tanggal \n Masuk"],"Pendidikan Terakhir":["Pendidikan Terakhir","Pendidikan \n Terakhir"],
    "Tempat Bekerja":["Tempat Bekerja","Tempat \n Bekerja"],"Nomor Telepon":["Nomor Telepon","Nomor \n Telfon"],"BLOK KAMAR":["BLOK KAMAR","Blok Kamar"]
  };
  for(const f of MP_SCHEMA_OUT){
    let val=row?.[f];
    if(val===undefined&&legacy[f])for(const k of legacy[f])if(row?.[k]!==undefined){val=row[k];break}
    if(val===undefined)val="";
    out[f]=val;
  }
  return out;
}
function normalizeAllMP(){
  data.mpActive=(data.mpActive||[]).map(normalizedMP);
  data.mpOut=(data.mpOut||[]).map(normalizedMP);
}
function mpRestoreKey(rec){
  return [nameKey(rec?.Nama),canonicalJob(rec?.Jabatan),normText(rec?.["Tempat Bekerja"]).toLowerCase()].join("|");
}
function mpGroupKey(rec){return siteKeyFromPlacement(rec?.["Tempat Bekerja"])||"OTHER"}
function mpGroupLabel(rec){
  const k=mpGroupKey(rec);
  return k==="OTHER"?(normText(rec?.["Tempat Bekerja"])||"Belum Ditentukan"):(data.siteLabels?.[k]||placementFromSiteKey(k)||k);
}
function mpGroupRank(rec){
  const k=mpGroupKey(rec),i=SITE_DISPLAY_ORDER.indexOf(k);
  return i<0?SITE_DISPLAY_ORDER.length:i;
}
function ensureRuntimeData(){
  if(!Array.isArray(data.deletedKMB))data.deletedKMB=[];
  if(!data.mpRestoreMeta||typeof data.mpRestoreMeta!=="object"||Array.isArray(data.mpRestoreMeta))data.mpRestoreMeta={};
  (data.mpOut||[]).forEach(r=>{
    const k=mpRestoreKey(r);
    if(!data.mpRestoreMeta[k])data.mpRestoreMeta[k]={siteKey:mpGroupKey(r),localNo:Number(r["No."])||null,activeIndex:null,capturedFrom:"existing-mp-out"};
  });
}
function renumberSiteRows(key){(data.sites?.[key]||[]).forEach((r,i)=>r.No=String(i+1))}
function renumberMPArray(arr){
  arr.sort((a,b)=>mpGroupRank(a)-mpGroupRank(b));
  const counts={};
  arr.forEach(r=>{const k=mpGroupKey(r);counts[k]=(counts[k]||0)+1;r["No."]=String(counts[k])});
}
function renumberAll(){
  Object.keys(data.sites||{}).forEach(renumberSiteRows);
  renumberMPArray(data.mpActive||[]);
  renumberMPArray(data.mpOut||[]);
}
function insertGroupedMP(arr,rec,meta){
  const key=meta?.siteKey||mpGroupKey(rec),wanted=Math.max(1,Number(meta?.localNo)||1),rank=SITE_DISPLAY_ORDER.indexOf(key);
  let insertAt=arr.length,lastSame=-1,firstLater=-1;
  for(let i=0;i<arr.length;i++){
    const rk=mpGroupKey(arr[i]),rr=SITE_DISPLAY_ORDER.indexOf(rk),rRank=rr<0?SITE_DISPLAY_ORDER.length:rr,targetRank=rank<0?SITE_DISPLAY_ORDER.length:rank;
    if(rk===key){lastSame=i;if((Number(arr[i]["No."])||9999)>=wanted){insertAt=i;break}}
    else if(firstLater<0&&rRank>targetRank)firstLater=i;
  }
  if(insertAt===arr.length){
    if(lastSame>=0)insertAt=lastSame+1;
    else if(firstLater>=0)insertAt=firstLater;
    else if(Number.isInteger(meta?.activeIndex))insertAt=Math.min(Math.max(0,meta.activeIndex),arr.length);
  }
  arr.splice(insertAt,0,rec);
}

function mergeRosterFromSource(existing,baseline){
  const ex=Array.isArray(existing)?existing:[];
  const safe=["No.","Nama","Jabatan","Departemen","Level","Status Kontrak PKWT/PKWTT/Harian Lepas","Akhir Kontrak","POH","Sisa Hari","Reminder","Tanggal Masuk","Masa Kerja","Jenis Kelamin","Agama","Tempat Lahir","Tgl/Lahir","Umur","Pendidikan Terakhir","Keterangan","Tempat Bekerja","STATUS","BLOK KAMAR","Tanggal Keluar","Alasan"];
  return (baseline||[]).map(b=>{
    const old=ex.find(e=>sameName(e?.Nama,b?.Nama));
    const merged=normalizedMP(old||{});
    const nb=normalizedMP(b||{});
    safe.forEach(k=>{merged[k]=nb[k]??""});
    return merged;
  });
}
function loadData(){
  try{
    const x=localStorage.getItem(KEY),saved=x?JSON.parse(x):clone(INITIAL);
    saved.sites=saved.sites||clone(INITIAL.sites||{});
    saved.siteLabels=saved.siteLabels||clone(INITIAL.siteLabels||{});
    saved.units=saved.units||clone(INITIAL.units||[]);
    saved.mpActive=Array.isArray(saved.mpActive)?saved.mpActive:[];
    saved.mpOut=Array.isArray(saved.mpOut)?saved.mpOut:[];
    saved.deletedKMB=Array.isArray(saved.deletedKMB)?saved.deletedKMB:[];
    saved.mpRestoreMeta=(saved.mpRestoreMeta&&typeof saved.mpRestoreMeta==="object"&&!Array.isArray(saved.mpRestoreMeta))?saved.mpRestoreMeta:{};
    if(!localStorage.getItem(SOURCE_SYNC_KEY)){
      saved.sites=clone(INITIAL.sites||{});
      saved.siteLabels=clone(INITIAL.siteLabels||{});
      saved.units=clone(INITIAL.units||[]);
      saved.mpActive=mergeRosterFromSource(saved.mpActive,INITIAL.mpActive||[]);
      saved.mpOut=mergeRosterFromSource(saved.mpOut,INITIAL.mpOut||[]);
      localStorage.setItem(SOURCE_SYNC_KEY,"1");
      localStorage.setItem(KEY,JSON.stringify(saved));
    }
    return saved;
  }catch(e){return clone(INITIAL)}
}
normalizeAllMP();ensureRuntimeData();renumberAll();
function saveData(){ensureRuntimeData();renumberAll();localStorage.setItem(KEY,JSON.stringify(data));renderDashboard();renderSettings()}

function badge(v){
  if(!v)return '<span class="badge neutral">-</span>';
  let c="neutral",t=String(v);
  if(/^open$/i.test(t))c="open";else if(/close|selesai/i.test(t))c="close";else if(/continue/i.test(t))c="continue";else if(/jatuh tempo/i.test(t))c="due";else if(/track/i.test(t))c="ok";
  return '<span class="badge '+c+'">'+esc(t)+'</span>';
}
function progress(r){
  const steps=[["Induksi",100,"INDUKSI"],["On Site",95,"ON SITE"],["FU MCU",80,"FU MCU"],["MCU",70,"MCU"],["Offering Latter",55,"OFFERING"],["Interview User",40,"INTERVIEW USER"],["Psikologi Test",25,"PSIKOLOGI TEST"]];
  for(const [k,p,label] of steps)if(r[k])return {p,label};
  return {p:0,label:"SOURCING KANDIDAT"};
}
function daysLeft(v){if(!v)return "";const due=new Date(v+"T00:00:00"),today=new Date();today.setHours(0,0,0,0);return Math.round((due-today)/86400000)}
function siteMetrics(rows){
  const planning=rows.length,vacant=rows.filter(r=>isVacantName(r.Nama)).length;
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
    sec.innerHTML='<div class="page-head"><div><h2>'+esc(data.siteLabels[key]||key)+'</h2><p>Monitoring manpower dan progress rekrutmen</p></div><div class="toolbar"><input class="input" id="q_'+id(key)+'" placeholder="Cari nama / jabatan..."><select class="select" id="st_'+id(key)+'"><option value="">Semua Status</option><option>Open</option><option>Continue</option><option>Close</option></select><button class="btn yellow" data-add>+ Tambah Data</button><button class="btn" data-export>Export CSV</button></div></div><div id="stats_'+id(key)+'"></div><div id="table_'+id(key)+'"></div>';
    host.appendChild(sec);
    document.getElementById("q_"+id(key)).addEventListener("input",()=>renderSite(key));
    document.getElementById("st_"+id(key)).addEventListener("change",()=>renderSite(key));
    sec.querySelector("[data-add]").onclick=()=>openSiteForm(key,null);
    sec.querySelector("[data-export]").onclick=()=>exportRows(data.sites[key],"KMB_"+(data.siteLabels[key]||key).replace(/\s+/g,"_")+".csv");
    renderSite(key);
  })
}
function openKmbSite(key){showView("site-"+id(key));renderSite(key)}
function openKmbMp(){
  mpMode="active";
  document.querySelectorAll(".mp-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode==="active"));
  showView("mp");renderMP();
}
function openKmbSummary(){
  showView("dashboard");
  setTimeout(()=>document.getElementById("summaryBody")?.closest(".card")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
function openKmbRecruitment(){
  showView("dashboard");
  setTimeout(()=>document.getElementById("recruitmentCard")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
let kmbChartInstances={};
function kmbMakeChart(id,config){
  if(!window.Chart)return;
  const canvas=document.getElementById(id);if(!canvas)return;
  if(kmbChartInstances[id])kmbChartInstances[id].destroy();
  kmbChartInstances[id]=new Chart(canvas,config);
}
function kmbChartOptions(extra={}){
  return {
    responsive:true,maintainAspectRatio:false,
    interaction:{mode:"index",intersect:false},
    plugins:{legend:{labels:{usePointStyle:true,boxWidth:7,boxHeight:7,color:"#73788a",font:{size:10,weight:"600"}}},tooltip:{backgroundColor:"#252238",padding:10,cornerRadius:10}},
    scales:{x:{grid:{display:false},ticks:{color:"#9297a8",font:{size:10}}},y:{beginAtZero:true,grid:{color:"rgba(123,110,153,.09)"},ticks:{precision:0,color:"#9297a8",font:{size:10}}}},
    ...extra
  };
}
function renderKMBCharts(){
  if(!window.Chart)return;
  const keys=Object.keys(data.sites||{});
  const labels=keys.map(k=>data.siteLabels[k]||k);
  const mets=keys.map(k=>siteMetrics(data.sites[k]||[]));
  const totalActual=mets.reduce((s,m)=>s+m.actual,0),totalVacant=mets.reduce((s,m)=>s+m.vacant,0);

  kmbMakeChart("kmbJobsiteChart",{
    type:"bar",
    data:{labels,datasets:[
      {label:"Planning",data:mets.map(m=>m.planning),backgroundColor:"#d9ccff",borderRadius:8,borderSkipped:false},
      {label:"Actual",data:mets.map(m=>m.actual),backgroundColor:"#7c3aed",borderRadius:8,borderSkipped:false},
      {label:"Vacant",data:mets.map(m=>m.vacant),backgroundColor:"#ff747d",borderRadius:8,borderSkipped:false}
    ]},
    options:kmbChartOptions({plugins:{legend:{position:"top",align:"end",labels:{usePointStyle:true,boxWidth:7,color:"#73788a",font:{size:10,weight:"600"}}},tooltip:{backgroundColor:"#252238",padding:10,cornerRadius:10}}})
  });

  kmbMakeChart("kmbCompositionChart",{
    type:"doughnut",
    data:{labels:["Actual","Vacant"],datasets:[{data:[totalActual,totalVacant],backgroundColor:["#7c3aed","#ff6b6b"],borderWidth:0,hoverOffset:5,borderRadius:6,spacing:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{display:false},tooltip:{backgroundColor:"#252238",padding:10,cornerRadius:10}}}
  });

  const stages=["SOURCING KANDIDAT","PSIKOLOGI TEST","INTERVIEW USER","OFFERING","MCU","FU MCU","ON SITE","INDUKSI"];
  const stageLabels=["Sourcing","Psikotes","Interview","Offering","MCU","FU MCU","On Site","Induksi"];
  const counts=Object.fromEntries(stages.map(x=>[x,0]));
  Object.values(data.sites||{}).flat().filter(r=>isVacantName(r.Nama)||["open","continue"].includes(normText(r.Status).toLowerCase())).forEach(r=>{
    const p=progress(r);if(counts[p.label]!==undefined)counts[p.label]++;
  });
  kmbMakeChart("kmbRecruitChart",{
    type:"line",
    data:{labels:stageLabels,datasets:[{label:"Jumlah Posisi",data:stages.map(s=>counts[s]),borderColor:"#7c3aed",backgroundColor:"rgba(124,58,237,.12)",pointBackgroundColor:"#fff",pointBorderColor:"#7c3aed",pointBorderWidth:3,pointRadius:4,tension:.38,fill:true}]},
    options:kmbChartOptions({plugins:{legend:{display:false},tooltip:{backgroundColor:"#252238",padding:10,cornerRadius:10}}})
  });
}
function renderDashboard(){
  let total={planning:0,actual:0,vacant:0,open:0,cont:0,close:0,due:0},rows="";
  Object.keys(data.sites).forEach(key=>{
    const m=siteMetrics(data.sites[key]);Object.keys(total).forEach(k=>total[k]+=m[k]||0);
    const pct=m.planning?Math.round(m.actual/m.planning*100):0;
    rows+='<tr><td><b>'+esc(data.siteLabels[key]||key)+'</b></td><td>'+m.planning+'</td><td>'+m.actual+'</td><td>'+m.vacant+'</td><td>'+pct+'%</td><td>'+m.open+'</td><td>'+m.cont+'</td><td>'+m.close+'</td><td>'+m.due+'</td></tr>';
  });
  document.getElementById("kPlanning").textContent=total.planning;
  document.getElementById("kActual").textContent=total.actual;
  document.getElementById("kVacant").textContent=total.vacant;
  document.getElementById("kPct").textContent=(total.planning?Math.round(total.actual/total.planning*100):0)+"%";
  document.getElementById("summaryBody").innerHTML=rows;
  document.getElementById("statusCards").innerHTML=[
    ["Open",total.open,"ptk-open"],["Continue",total.cont,"ptk-continue"],["Close",total.close,"ptk-close"],["Jatuh Tempo",total.due,"ptk-due"]
  ].map(x=>'<div class="mini ptk-mini '+x[2]+'"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join("");
  renderKMBUnitDashboard();
  renderVacancyResume();renderRecruitmentSummary();renderKMBCharts();
}
function renderVacancyResume(){
  const groups={};
  for(const [site,rows] of Object.entries(data.sites)){
    rows.forEach((r,i)=>{
      if(!isVacantName(r.Nama))return;
      const role=canonicalJobLabel(r.Jabatan),key=canonicalJob(r.Jabatan)||"belum";
      const p=progress(r);
      if(!groups[key])groups[key]={role,items:[]};
      groups[key].items.push({site,row:r,index:i,p});
    })
  }
  const arr=Object.values(groups).sort((a,b)=>b.items.length-a.items.length||a.role.localeCompare(b.role));
  document.getElementById("vacancyResume").innerHTML=arr.length?arr.map(g=>{
    const best=g.items.slice().sort((a,b)=>b.p.p-a.p.p)[0];
    const breakdown={};g.items.forEach(x=>breakdown[x.p.label]=(breakdown[x.p.label]||0)+1);
    const breakdownText=Object.entries(breakdown).sort((a,b)=>{const pa=g.items.find(x=>x.p.label===a[0])?.p.p||0,pb=g.items.find(x=>x.p.label===b[0])?.p.p||0;return pb-pa}).map(([k,v])=>v+"× "+k).join(" • ");
    const roleEnc=encodeURIComponent(canonicalJob(g.role));
    return '<button class="resume-card" onclick="focusRecruitRole(decodeURIComponent(\''+roleEnc+'\'))"><div><span class="resume-count">'+g.items.length+'</span><b>'+esc(g.role)+'</b></div><div class="resume-best">Progress tertinggi: <b>'+esc(best.p.label)+' ('+best.p.p+'%)</b></div><div class="resume-breakdown">'+esc(breakdownText)+'</div><div class="resume-link">Lihat detail →</div></button>';
  }).join(""):'<div class="empty">Tidak ada vacant</div>';
}
function focusRecruitRole(role){recruitRoleFilter=role;renderRecruitmentSummary();document.getElementById("recruitmentCard").scrollIntoView({behavior:"smooth",block:"start"})}
function clearRecruitFilter(){recruitRoleFilter="";renderRecruitmentSummary()}
function renderRecruitmentSummary(){
  const openRows=[];
  Object.keys(data.sites).forEach(key=>{
    (data.sites[key]||[]).forEach(r=>{
      if(String(r.Status||"").toLowerCase()!=="open")return;
      if(recruitRoleFilter&&canonicalJob(r.Jabatan)!==recruitRoleFilter)return;
      const p=progress(r),days=daysLeft(r["Due Date"]);openRows.push({site:key,row:r,p,days});
    })
  });
  document.getElementById("recruitCount").textContent=openRows.length+" OPEN";
  const fb=document.getElementById("recruitFilterBadge");
  if(recruitRoleFilter){fb.style.display="inline-flex";fb.innerHTML=esc(canonicalJobLabel(recruitRoleFilter))+' <button onclick="clearRecruitFilter()" title="Hapus filter">×</button>'}else fb.style.display="none";
  document.getElementById("recruitBody").innerHTML=openRows.length?openRows.map(x=>{
    const r=x.row,dayClass=x.days<0?"overdue":x.days<=7?"warning":"";
    return '<tr><td><b>'+esc(x.site)+'</b></td><td>'+esc(r.Jabatan||"-")+'</td><td>'+fmtDate(r["Awal Rekrutmen"])+'</td><td>'+fmtDate(r["Due Date"])+'</td><td><span class="days '+dayClass+'">'+(x.days===""?"-":x.days)+'</span></td><td>'+badge(r.Status)+'</td><td><b>'+esc(x.p.label)+'</b></td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress recruit-progress"><i style="width:'+x.p.p+'%"></i></div><b>'+x.p.p+'%</b></div></td><td>'+esc((r.Nama||"")+(r.Keterangan?" — "+r.Keterangan:""))+'</td></tr>';
  }).join(""):'<tr><td colspan="9" class="empty">Tidak ada rekrutmen OPEN untuk filter ini</td></tr>';
}
function renderSite(key){
  const q=(document.getElementById("q_"+id(key))?.value||"").toLowerCase(),st=document.getElementById("st_"+id(key))?.value||"",all=data.sites[key]||[],m=siteMetrics(all);
  document.getElementById("stats_"+id(key)).innerHTML='<div class="stats"><div class="mini"><b>'+m.planning+'</b><span>Planning</span></div><div class="mini"><b>'+m.actual+'</b><span>Actual</span></div><div class="mini"><b>'+m.vacant+'</b><span>Vacant</span></div><div class="mini"><b>'+m.open+'</b><span>Open</span></div><div class="mini"><b>'+m.close+'</b><span>Close</span></div></div>';
  const rows=all.map((r,i)=>({...r,__i:i})).filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q))&&(!st||r.Status===st));
  let body=rows.map(r=>{
    const p=progress(r),vacant=isVacantName(r.Nama);
    const action=vacant
      ? '<button class="btn" onclick="openSiteForm(decodeURIComponent(\''+encodeURIComponent(key)+'\'),'+r.__i+')">Edit</button> <button class="btn danger" onclick="removeSiteRow(decodeURIComponent(\''+encodeURIComponent(key)+'\'),'+r.__i+')">Hapus Posisi</button>'
      : '<button class="btn" onclick="openSiteForm(decodeURIComponent(\''+encodeURIComponent(key)+'\'),'+r.__i+')">Edit</button> <button class="btn danger" onclick="openExitFromSite(decodeURIComponent(\''+encodeURIComponent(key)+'\'),'+r.__i+')">MP OUT</button>';
    return '<tr><td>'+esc(r.No)+'</td><td><b>'+esc(r.Nama||"-")+'</b></td><td>'+esc(r.Jabatan||"-")+'</td><td>'+esc(r.Keterangan||"-")+'</td><td>'+esc(r.PIC||"-")+'</td><td>'+badge(r.Status)+'</td><td><div style="display:flex;align-items:center;gap:7px"><div class="progress"><i style="width:'+p.p+'%"></i></div><b>'+p.p+'%</b></div><div style="font-size:10px;color:#6b7280;margin-top:3px">'+esc(p.label)+'</div></td><td>'+fmtDate(r["Due Date"])+'</td><td>'+badge(r["Keterangan PTK"])+'</td><td class="action-cell">'+action+'</td></tr>';
  }).join("");
  document.getElementById("table_"+id(key)).innerHTML='<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Keterangan</th><th>PIC</th><th>Status</th><th>Progress</th><th>Due Date</th><th>Ket. PTK</th><th>Aksi</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function openExitFromSite(key,index){
  const siteRow=data.sites?.[key]?.[index];if(!siteRow||isVacantName(siteRow.Nama))return;
  const activeIndex=(data.mpActive||[]).findIndex(r=>sameName(r.Nama,siteRow.Nama));
  if(activeIndex<0){
    alert("Data "+siteRow.Nama+" belum ditemukan di MP Aktif. Sistem akan membuka MP Aktif dan mencari nama tersebut.");
    mpMode="active";
    showView("mp");
    document.querySelectorAll(".mp-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode==="active"));
    const q=document.getElementById("mpSearch");if(q)q.value=siteRow.Nama;
    renderMP();
    return;
  }
  openExitForm(activeIndex);
}
function computePTK(r){
  if(!r.Judul||!r["Awal Rekrutmen"]){r["Keterangan PTK"]="TIDAK ADA PENGAJUAN";return}
  if(r.Status==="Close"){r["Keterangan PTK"]="SELESAI";return}
  if(!r["Due Date"]){r["Keterangan PTK"]="";return}
  const d=daysLeft(r["Due Date"]);r["Keterangan PTK"]=d<=0?"JATUH TEMPO":d<=7?"HAMPIR JATUH TEMPO":"ON TRACK";
}
function fieldHtml(f,row,type="site"){
  const empty=type==="mp"&&!normText(row[f]);
  const hint=empty?'<small class="empty-hint">Belum terisi di Excel</small>':"";
  if((f==="No"&&type==="site")||(f==="No."&&type==="mp"))return '<div class="field"><label>'+f+'</label><input value="'+esc(row[f]||"Otomatis")+'" readonly><small class="empty-hint">Nomor diatur otomatis oleh sistem</small></div>';
  if(f==="Status"&&type==="site")return '<div class="field"><label>'+f+'</label><select data-f="'+f+'"><option value=""></option>'+["Open","Continue","Close"].map(x=>'<option '+(row[f]===x?"selected":"")+'>'+x+'</option>').join("")+'</select></div>';
  if(f==="Tempat Bekerja"&&type==="mp")return '<div class="field '+(empty?"empty-field":"")+'"><label>'+f+'</label><select data-f="'+f+'"><option value="">-- belum terisi --</option>'+["C4","SLR - Maintenance","SLR - Rekondisi","Workshop Legok"].map(x=>'<option '+(normText(row[f])===x?"selected":"")+'>'+x+'</option>').join("")+'</select>'+hint+'</div>';
  if(["Keterangan","Alasan","Alamat Domisili","Alamat Lengkap"].includes(f))return '<div class="field '+(SENSITIVE_FIELDS.has(f)?"sensitive ":"")+(empty?"empty-field":"")+'"><label>'+f+(SENSITIVE_FIELDS.has(f)?' <span title="Data sensitif">🔒</span>':'')+'</label><textarea data-f="'+f+'" placeholder="Belum terisi di Excel">'+esc(row[f]||"")+'</textarea>'+hint+'</div>';
  const dateFields=["Akhir Kontrak","Tanggal Masuk","Tanggal Keluar","Tgl/Lahir","Tanggal Lahir (1)","Tanggal Lahir (2)","Tanggal Lahir (3)","Tanggal Lahir (4)","Due Date","Tanggal Close","Awal Rekrutmen","Psikologi Test","Interview User","MCU","FU MCU","On Site","Induksi"];
  return '<div class="field '+(SENSITIVE_FIELDS.has(f)?"sensitive ":"")+(empty?"empty-field":"")+'"><label>'+f+(SENSITIVE_FIELDS.has(f)?' <span title="Data sensitif">🔒</span>':'')+'</label><input type="'+(dateFields.includes(f)?"date":"text")+'" data-f="'+f+'" value="'+esc(row[f]||"")+'" placeholder="Belum terisi di Excel">'+hint+'</div>';
}
function openSiteForm(key,index){
  editState={type:"site",key,index,old:index===null?null:clone(data.sites[key][index])};const row=index===null?{}:data.sites[key][index];
  document.getElementById("modalTitle").textContent=(index===null?"Tambah Data - ":"Edit Data - ")+(data.siteLabels[key]||key);
  document.getElementById("formFields").innerHTML=SITE_FIELDS.map(f=>fieldHtml(f,row,"site")).join("");
  document.getElementById("modal").classList.add("show");
}
function syncActivePlacementFromSite(name,key){
  if(isVacantName(name))return;
  const emp=(data.mpActive||[]).find(r=>sameName(r.Nama,name));
  if(emp)emp["Tempat Bekerja"]=placementFromSiteKey(key);
}
function saveModal(){
  if(!editState)return;let row={};document.querySelectorAll("#formFields [data-f]").forEach(el=>row[el.dataset.f]=el.value);
  if(editState.type==="site"){
    computePTK(row);
    if(editState.index===null){row.No="";data.sites[editState.key].push(row)}
    else{row.No=data.sites[editState.key][editState.index]?.No||"";data.sites[editState.key][editState.index]={...data.sites[editState.key][editState.index],...row}}
    renumberSiteRows(editState.key);
    if(!isVacantName(row.Nama))syncActivePlacementFromSite(row.Nama,editState.key);
    const k=editState.key;saveData();renderSite(k);renderMP();closeModal();return;
  }
  if(editState.type==="unit"){
    const sec=data.units?.[editState.sectionIndex];if(!sec)return;
    const clean={};(editState.fields||[]).forEach(f=>clean[f]=row[f]||"");
    if(editState.rowIndex===null)sec.rows.push(clean);else sec.rows[editState.rowIndex]={...sec.rows[editState.rowIndex],...clean};
    saveData();renderUnits();closeModal();return;
  }
  if(editState.type==="mp"||editState.type==="exit"){
    const arr=editState.mode==="active"?data.mpActive:data.mpOut,schema=editState.mode==="active"?MP_SCHEMA_ACTIVE:MP_SCHEMA_OUT;
    const clean={};schema.forEach(f=>clean[f]=row[f]||"");
    const old=editState.index===null?null:clone(arr[editState.index]);
    if(editState.type==="exit"){
      const src=editState.sourceIndex,activeRec=data.mpActive[src];
      if(activeRec){
        const key=mpRestoreKey(activeRec);
        data.mpRestoreMeta[key]={siteKey:mpGroupKey(activeRec),localNo:Number(activeRec["No."])||1,activeIndex:src,capturedFrom:"mp-out"};
        clean["No."]=activeRec["No."]||"";
        arr.push(clean);vacateForExit(activeRec,clean["Tanggal Keluar"],clean.Alasan);data.mpActive.splice(src,1);
      }
    }else{
      if(editState.index===null){clean["No."]="";arr.push(clean)}
      else{clean["No."]=arr[editState.index]?.["No."]||"";arr[editState.index]={...arr[editState.index],...clean}}
      if(editState.mode==="active"){
        const oldPlacement=old?.["Tempat Bekerja"]||"",newPlacement=clean["Tempat Bekerja"]||"";
        if(normText(oldPlacement)!==normText(newPlacement)&&clean.Nama)syncPlacement(clean,oldPlacement,newPlacement);
      }
    }
    saveData();makeSiteViews();renderMP();closeModal();return;
  }
}
function closeModal(){document.getElementById("modal").classList.remove("show");editState=null}
function removeSiteRow(key,index){
  const row=data.sites?.[key]?.[index];if(!row)return;
  if(!isVacantName(row.Nama)){alert("Manpower aktif tidak dihapus sebagai posisi. Gunakan tombol MP OUT.");return}
  if(!confirm("Hapus posisi kebutuhan "+(row.Jabatan||"ini")+"?\n\nPlanning manpower akan berkurang 1. Data posisi masuk Data Terhapus dan tetap dapat dipulihkan."))return;
  data.deletedKMB=data.deletedKMB||[];data.deletedKMB.unshift({type:"site",siteKey:key,index,row:clone(row),deletedAt:new Date().toISOString()});
  data.sites[key].splice(index,1);renumberSiteRows(key);saveData();renderSite(key);
}

function unitSectionCount(sec){return (sec?.rows||[]).filter(r=>Object.values(r||{}).some(v=>normText(v))).length}
function totalUnitCount(){return (data.units||[]).reduce((sum,sec)=>sum+unitSectionCount(sec),0)}
function renderKMBUnitDashboard(){
  const total=totalUnitCount(),totalEl=document.getElementById("kmbUnitTotal"),host=document.getElementById("kmbUnitDashboard");
  if(totalEl)totalEl.textContent=total+" unit";
  if(!host)return;
  const sections=data.units||[];
  host.innerHTML=sections.length?sections.map((sec,i)=>{
    const n=unitSectionCount(sec);
    return '<div class="dashboard-unit-item"><span>'+esc(sec.name||("Section "+(i+1)))+'</span><b>'+n+'</b><small>unit</small></div>';
  }).join(""):'<div class="empty compact-empty">Belum ada data populasi unit.</div>';
}
function renderUnits(){
  const q=(document.getElementById("unitSearch")?.value||"").toLowerCase(),grand=totalUnitCount();
  const grandEl=document.getElementById("unitGrandTotal");if(grandEl)grandEl.textContent=grand+" unit";
  renderKMBUnitDashboard();
  const host=document.getElementById("unitTables");if(!host)return;
  host.innerHTML=(data.units||[]).map((sec,sectionIndex)=>{
    const all=sec.rows||[],heads=[...new Set(all.flatMap(r=>Object.keys(r).filter(k=>k!=="__i")))];
    const safeHeads=heads.length?heads:["No.","Category","Code Unit SAP","Manufacturer","Model","Serial Number","Remark"];
    const rows=all.map((r,i)=>({...r,__i:i})).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
    const body=rows.length?rows.map(r=>'<tr>'+safeHeads.map(h=>'<td>'+esc(r[h]||"-")+'</td>').join("")+'<td class="action-cell"><button class="btn" onclick="openUnitForm('+sectionIndex+','+r.__i+')">Edit</button> <button class="btn danger" onclick="deleteUnitRow('+sectionIndex+','+r.__i+')">Hapus</button></td></tr>').join(""):'<tr><td colspan="'+(safeHeads.length+1)+'" class="empty">Belum ada unit pada section ini</td></tr>';
    return '<div class="card unit-block"><div class="section-head"><div><span class="eyebrow">UNIT SECTION</span><h3>'+esc(sec.name)+'</h3></div><div class="toolbar"><span class="unit-total-pill">'+unitSectionCount(sec)+' unit</span><button class="btn yellow" onclick="openUnitForm('+sectionIndex+',null)">+ Tambah Unit</button><button class="btn danger" onclick="deleteUnitSection('+sectionIndex+')">Hapus Section</button></div></div><div class="table-wrap"><table class="table"><thead><tr>'+safeHeads.map(h=>'<th>'+esc(h)+'</th>').join("")+'<th>Aksi</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
  }).join("");
}
function openUnitForm(sectionIndex,rowIndex){
  const sec=data.units?.[sectionIndex];if(!sec)return;
  const heads=[...new Set((sec.rows||[]).flatMap(r=>Object.keys(r).filter(k=>k!=="__i")))];
  const fields=heads.length?heads:["No.","Category","Code Unit SAP","Manufacturer","Model","Serial Number","Remark"];
  const row=rowIndex===null?{}:sec.rows[rowIndex];
  editState={type:"unit",sectionIndex,rowIndex,fields};
  document.getElementById("modalTitle").textContent=(rowIndex===null?"Tambah Unit - ":"Edit Unit - ")+sec.name;
  document.getElementById("formFields").innerHTML=fields.map(f=>fieldHtml(f,row||{},"unit")).join("");
  document.getElementById("modal").classList.add("show");
}
function addUnitSection(){
  let name=prompt("Nama jobsite / section populasi unit:");if(!name)return;name=name.trim();if(!name)return;
  if((data.units||[]).some(s=>normText(s.name).toLowerCase()===name.toLowerCase())){alert("Section unit tersebut sudah ada.");return}
  data.units=data.units||[];data.units.push({name,rows:[]});saveData();renderUnits();
}
function deleteUnitRow(sectionIndex,rowIndex){
  const sec=data.units?.[sectionIndex],row=sec?.rows?.[rowIndex];if(!sec||!row)return;
  if(!confirm("Hapus unit ini dari "+sec.name+"?\n\nData akan masuk Data Terhapus dan masih dapat dipulihkan."))return;
  data.deletedKMB=data.deletedKMB||[];data.deletedKMB.unshift({type:"unit",sectionIndex,sectionName:sec.name,rowIndex,row:clone(row),deletedAt:new Date().toISOString()});
  sec.rows.splice(rowIndex,1);saveData();renderUnits();
}
function deleteUnitSection(sectionIndex){
  const sec=data.units?.[sectionIndex];if(!sec)return;
  if(unitSectionCount(sec)>0){alert("Section masih memiliki data unit. Hapus atau pindahkan unit terlebih dahulu.");return}
  if(!confirm("Hapus section "+sec.name+"?"))return;
  data.deletedKMB=data.deletedKMB||[];data.deletedKMB.unshift({type:"unitSection",sectionIndex,section:clone(sec),deletedAt:new Date().toISOString()});
  data.units.splice(sectionIndex,1);saveData();renderUnits();
}

function setMPMode(mode){mpMode=mode;document.querySelectorAll(".mp-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));renderMP()}
function toggleMPFull(){mpFullView=!mpFullView;document.getElementById("mpFullBtn").textContent=mpFullView?"Tampilan Ringkas":"Semua Kolom";renderMP()}
function renderMP(){
  normalizeAllMP();ensureRuntimeData();renumberAll();
  const arr=mpMode==="active"?data.mpActive:data.mpOut,q=(document.getElementById("mpSearch")?.value||"").toLowerCase();
  const rows=arr.map((r,i)=>({...r,__i:i})).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
  document.getElementById("mpTitle").textContent=mpMode==="active"?"MP Aktif":"MP OUT";
  document.getElementById("mpCount").textContent=rows.length+" data";
  const fields=mpFullView?(mpMode==="active"?MP_SCHEMA_ACTIVE:MP_SCHEMA_OUT):SUMMARY_MP_FIELDS.concat(mpMode==="out"?["Tanggal Keluar","Alasan"]:[]);
  let head=fields.map(f=>'<th>'+esc(f)+'</th>').join("")+'<th>Aksi</th>',body="",lastGroup=null;
  rows.forEach(r=>{
    const group=mpGroupLabel(r);
    if(group!==lastGroup){body+='<tr class="mp-group-row"><td colspan="'+(fields.length+1)+'"><b>'+esc(group)+'</b><span>Nomor otomatis per jobsite</span></td></tr>';lastGroup=group}
    const cells=fields.map(f=>'<td>'+esc(r[f]||"-")+'</td>').join("");
    let actions='<button class="btn" onclick="openMpForm(\''+mpMode+'\','+r.__i+')">Edit</button>';
    if(mpMode==="active")actions+=' <button class="btn yellow" onclick="openMpForm(\'active\','+r.__i+')">Pindah Site</button> <button class="btn danger" onclick="openExitForm('+r.__i+')">MP OUT</button>';
    else actions+=' <button class="btn yellow" onclick="restoreFromOut('+r.__i+')">Kembalikan ke MP Aktif</button> <button class="btn danger" onclick="removeMpRow(\'out\','+r.__i+')">Hapus Data</button>';
    body+='<tr>'+cells+'<td class="action-cell">'+actions+'</td></tr>';
  });
  document.getElementById("mpTable").innerHTML='<div class="table-wrap"><table class="table mp-table"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
function hasFullMPData(row){
  return !!(normText(row?.["NIK KTP"])||normText(row?.["Nomor HP"])||normText(row?.["No Rekening"])||normText(row?.["Nomor BPJS Kesehatan"])||normText(row?.["Alamat Lengkap"]));
}
function openMpForm(mode,index){
  editState={type:"mp",mode,index};const arr=mode==="active"?data.mpActive:data.mpOut,row=index===null?{}:arr[index],fs=mode==="active"?MP_SCHEMA_ACTIVE:MP_SCHEMA_OUT;
  document.getElementById("modalTitle").textContent=(index===null?"Tambah ":"Edit ")+(mode==="active"?"MP Aktif":"MP OUT");
  let source="";
  if(index!==null){
    const filled=fs.filter(f=>normText(row[f])).length,empty=fs.length-filled;
    source+='<div class="data-completeness" style="grid-column:1/-1"><div><b>'+esc(row.Nama||"Data Manpower")+'</b><span>'+filled+' dari '+fs.length+' kolom terisi</span></div><div><span class="badge ok">'+filled+' terisi</span> <span class="badge neutral">'+empty+' kosong di Excel</span></div></div>';
  }
  if(index!==null&&!hasFullMPData(row)){
    source+='<div class="notice" style="grid-column:1/-1"><b>Kolom detail orang ini memang masih kosong pada file Excel yang tersinkron.</b> Semua kolom tetap ditampilkan di bawah dan dapat Anda isi manual. Jika file Excel terbaru memiliki datanya, klik <label class="btn yellow" style="display:inline-flex;margin-left:6px">Sinkronkan Excel<input type="file" accept=".xlsx,.xls" hidden onchange="importOriginalExcel(this)"></label>.</div>';
  }
  if(mode==="out"&&index===null){
    source+='<div class="source-box"><label>Ambil Data dari MP Aktif</label><select id="sourceActive"><option value="">-- pilih nama MP Aktif --</option>'+data.mpActive.map((r,i)=>'<option value="'+i+'">'+esc(r.Nama||"-")+' — '+esc(r.Jabatan||"-")+' — '+esc(r["Tempat Bekerja"]||"-")+'</option>').join("")+'</select><small>Pilih nama untuk menyalin seluruh data ke MP OUT.</small></div>';
  }
  document.getElementById("formFields").innerHTML=source+fs.map(f=>fieldHtml(f,row,"mp")).join("");
  const modal=document.getElementById("modal");modal.classList.add("show");
  const card=modal.querySelector(".modal-card");if(card)card.scrollTop=0;
  const sel=document.getElementById("sourceActive");if(sel)sel.onchange=()=>fillFromActive(sel.value);
}
function fillFromActive(idx){
  if(idx==="")return;const src=data.mpActive[Number(idx)];if(!src)return;
  for(const f of MP_SCHEMA_OUT){const el=document.querySelector('#formFields [data-f="'+CSS.escape(f)+'"]');if(el)el.value=f==="Tanggal Keluar"?todayISO():(src[f]||"")}
}
function openExitForm(index){
  const src=data.mpActive[index];if(!src)return;
  editState={type:"exit",mode:"out",index:null,sourceIndex:index};
  const row={...normalizedMP(src),"Tanggal Keluar":todayISO(),"Alasan":""};
  document.getElementById("modalTitle").textContent="Pindahkan ke MP OUT — "+(src.Nama||"");
  document.getElementById("formFields").innerHTML='<div class="notice" style="grid-column:1/-1"><b>Sinkron otomatis:</b> saat disimpan, data akan masuk ke MP OUT, dihapus dari MP Aktif, dan posisi lama di jobsite menjadi Vacant.</div>'+MP_SCHEMA_OUT.map(f=>fieldHtml(f,row,"mp")).join("");
  document.getElementById("modal").classList.add("show");
}
function removeMpRow(mode,index){
  const arr=mode==="active"?data.mpActive:data.mpOut,rec=arr[index];if(!rec)return;
  const label=mode==="out"?"Hapus record "+(rec.Nama||"ini")+" dari MP OUT?":"Hapus data manpower ini?";
  if(!confirm(label+"\n\nData akan masuk Data Terhapus dan dapat dipulihkan."))return;
  data.deletedKMB=data.deletedKMB||[];data.deletedKMB.unshift({type:"mp",mode,index,siteKey:mpGroupKey(rec),localNo:Number(rec["No."])||1,row:clone(rec),deletedAt:new Date().toISOString()});
  arr.splice(index,1);saveData();renderMP();
}
function restoreFromOut(index){
  const rec=data.mpOut[index];if(!rec)return;
  const name=rec.Nama||"data ini";
  if(data.mpActive.some(x=>sameName(x.Nama,rec.Nama))){alert(name+" sudah ada di MP Aktif. Data MP OUT tidak dipindahkan untuk mencegah duplikasi.");return}
  const placement=rec["Tempat Bekerja"]||"",site=siteKeyFromPlacement(placement),siteLabel=site?(data.siteLabels[site]||site):(placement||"site belum terdeteksi");
  const metaKey=mpRestoreKey(rec),meta=data.mpRestoreMeta?.[metaKey]||{siteKey:mpGroupKey(rec),localNo:Number(rec["No."])||1};
  if(!confirm("Kembalikan "+name+" dari MP OUT ke MP Aktif?\n\nPenempatan: "+siteLabel+"\nPosisi: "+(rec.Jabatan||"-")+"\nNomor asal: "+(meta.localNo||"-")+"\n\nData akan kembali ke urutan asal di jobsite tersebut."))return;
  const active={};MP_SCHEMA_ACTIVE.forEach(f=>active[f]=rec[f]||"");active["No."]="";
  insertGroupedMP(data.mpActive,active,meta);
  if(site&&data.sites[site]){
    const rows=data.sites[site];
    let target=rows.find(r=>isVacantName(r.Nama)&&normText(r.Keterangan).toLowerCase().includes(normText(rec.Nama).toLowerCase()));
    if(!target)target=rows.find(r=>isVacantName(r.Nama)&&canonicalJob(r.Jabatan)===canonicalJob(rec.Jabatan));
    if(target){target.Nama=rec.Nama;target.Jabatan=target.Jabatan||rec.Jabatan;target.Keterangan="Dikembalikan dari MP OUT"}
    else if(!rows.some(r=>sameName(r.Nama,rec.Nama)))rows.push({No:"",Nama:rec.Nama,Jabatan:rec.Jabatan||"",Keterangan:"Dikembalikan dari MP OUT",PIC:"PT. KMB",Judul:"","Awal Rekrutmen":"","Psikologi Test":"","Interview User":"","Offering Latter":"","MCU":"","FU MCU":"","On Site":"","Induksi":"","Due Date":"","Status":"","Tanggal Close":"","Keterangan PTK":"TIDAK ADA PENGAJUAN","Lama Closing (Hari)":"","Open Index":""});
    renumberSiteRows(site);
  }
  data.mpOut.splice(index,1);if(data.mpRestoreMeta)delete data.mpRestoreMeta[metaKey];
  saveData();makeSiteViews();renderMP();renderDashboard();alert(name+" berhasil dikembalikan ke MP Aktif pada urutan jobsite asal.");
}
function vacateForExit(rec,date,reason){
  const name=rec.Nama,site=siteKeyFromPlacement(rec["Tempat Bekerja"]);
  if(site&&data.sites[site]){
    const r=data.sites[site].find(x=>sameName(x.Nama,name));
    if(r){r.Nama="Vacant";r.Keterangan="MP OUT "+name+(date?" • "+date:"")+(reason?" • "+reason:"");if(!r["Keterangan PTK"])r["Keterangan PTK"]="TIDAK ADA PENGAJUAN"}
  }
}
function syncPlacement(rec,oldPlacement,newPlacement){
  const oldKey=siteKeyFromPlacement(oldPlacement),newKey=siteKeyFromPlacement(newPlacement),name=rec.Nama,job=rec.Jabatan;
  if(oldKey&&oldKey!==newKey&&data.sites[oldKey]){
    const oldRow=data.sites[oldKey].find(r=>sameName(r.Nama,name));
    if(oldRow){oldRow.Nama="Vacant";oldRow.Keterangan="Vacant — "+name+" pindah ke "+(newPlacement||"site lain");if(!oldRow["Keterangan PTK"])oldRow["Keterangan PTK"]="TIDAK ADA PENGAJUAN"}
  }
  if(newKey&&data.sites[newKey]){
    let target=data.sites[newKey].find(r=>isVacantName(r.Nama)&&canonicalJob(r.Jabatan)===canonicalJob(job));
    if(target){
      target.Nama=name;target.Keterangan="Perpindahan dari "+(oldPlacement||"-");
      if(["Open","Continue"].includes(target.Status)){target.Status="Close";target["Tanggal Close"]=todayISO();target["Keterangan PTK"]="SELESAI"}
    }else if(!data.sites[newKey].some(r=>sameName(r.Nama,name))){
      data.sites[newKey].push({No:String(data.sites[newKey].length+1),Nama:name,Jabatan:job,Keterangan:"Perpindahan dari "+(oldPlacement||"-"),PIC:"PT. KMB",Judul:"","Awal Rekrutmen":"","Psikologi Test":"","Interview User":"","Offering Latter":"","MCU":"","FU MCU":"","On Site":"","Induksi":"","Due Date":"","Status":"","Tanggal Close":"","Keterangan PTK":"TIDAK ADA PENGAJUAN","Lama Closing (Hari)":"","Open Index":""})
    }
  }
}

function csv(rows){if(!rows.length)return "";const hs=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!k.startsWith("__"))))],q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';return "\ufeff"+hs.map(q).join(",")+"\n"+rows.map(r=>hs.map(h=>q(r[h])).join(",")).join("\n")}
function download(content,name,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:type||"text/csv;charset=utf-8"}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
function exportRows(rows,name){download(csv(rows),name)}
function exportUnits(){const rows=(data.units||[]).flatMap(s=>s.rows.map(r=>({Jobsite:s.name,...r})));exportRows(rows,"KMB_Populasi_Unit.csv")}
function exportMP(){exportRows(mpMode==="active"?data.mpActive:data.mpOut,mpMode==="active"?"KMB_MP_Aktif.csv":"KMB_MP_OUT.csv")}
function buildDashboardAOA(){
  const aoa=[["MONITORING KMB"],[],["RINGKASAN MANPOWER"],["Jobsite","Planning","Actual","Vacant","Open","Continue","Close","Jatuh Tempo"]];
  for(const [k,rows] of Object.entries(data.sites)){const m=siteMetrics(rows);aoa.push([data.siteLabels[k]||k,m.planning,m.actual,m.vacant,m.open,m.cont,m.close,m.due])}
  aoa.push([],["RESUME VACANT"],["Jabatan","Jumlah Vacant","Progress Tertinggi","Breakdown"]);
  const groups={};
  for(const rows of Object.values(data.sites))for(const r of rows)if(isVacantName(r.Nama)){const key=canonicalJob(r.Jabatan),p=progress(r);if(!groups[key])groups[key]={label:canonicalJobLabel(r.Jabatan),items:[]};groups[key].items.push(p)}
  for(const g of Object.values(groups)){const best=g.items.slice().sort((a,b)=>b.p-a.p)[0],bd={};g.items.forEach(x=>bd[x.label]=(bd[x.label]||0)+1);aoa.push([g.label,g.items.length,best.label+" "+best.p+"%",Object.entries(bd).map(x=>x[1]+"x "+x[0]).join(" • ")])}
  return aoa;
}
function downloadExcel(){if(!ownerOnly())return;
  if(!window.XLSX){alert("Modul Excel belum termuat. Coba refresh halaman lalu ulangi.");return}
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(buildDashboardAOA()),"DASHBOARD");
  for(const [k,rows] of Object.entries(data.sites))XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"C4"===k?"C4":k==="SLR - MAINTENANCE"?"SLR - MAINTENANCE":k==="SLR - REKONDISI"?"SLR - REKONDISI":"WS");
  const unitRows=(data.units||[]).flatMap(s=>s.rows.map(r=>({Jobsite:s.name,...r})));XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(unitRows),"UNIT");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.mpActive.map(r=>{const o={};MP_SCHEMA_ACTIVE.forEach(f=>o[f]=r[f]||"");return o})),"MP Aktif");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.mpOut.map(r=>{const o={};MP_SCHEMA_OUT.forEach(f=>o[f]=r[f]||"");return o})),"MP OUT");
  const deletedRows=(data.deletedKMB||[]).map(x=>({Tipe:x.type==="site"?"Jobsite":(x.mode==="active"?"MP Aktif":"MP OUT"),Jobsite:x.siteKey||mpGroupLabel(x.row||{}),Nama:x.row?.Nama||"",Jabatan:x.row?.Jabatan||"",Nomor:x.row?.No||x.row?.["No."]||"",Dihapus:x.deletedAt||""}));
  XLSX.utils.book_append_sheet(wb,deletedRows.length?XLSX.utils.json_to_sheet(deletedRows):XLSX.utils.aoa_to_sheet([["Belum ada data terhapus"]]),"DATA TERHAPUS");
  XLSX.writeFile(wb,"Monitoring_Manpower_KMB_"+todayISO()+".xlsx");
}
function importOriginalExcel(input){
  const file=input.files?.[0];if(!file)return;
  if(!window.XLSX){alert("Modul Excel belum termuat.");return}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:"array",cellDates:true});
      const iso=v=>{
        if(v instanceof Date&&!isNaN(v)){const d=new Date(v);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
        const s=normText(v);if(!s)return "";
        const d=new Date(s);if(!isNaN(d)&&(/[\/\-]/.test(s)))return d.toISOString().slice(0,10);
        return v;
      };
      const siteDateFields=new Set(["Awal Rekrutmen","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi","Due Date","Tanggal Close"]);
      const readSite=sheetName=>{
        const ws=wb.Sheets[sheetName];if(!ws)throw new Error("Sheet "+sheetName+" tidak ditemukan.");
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});
        const out=[];
        for(let i=1;i<rows.length;i++){
          const a=rows[i]||[],no=a[0],name=normText(a[1]);
          if((no===""||no==null)&&!name)continue;
          const o={};SITE_IMPORT_FIELDS.forEach((f,j)=>o[f]=siteDateFields.has(f)?iso(a[j]):(a[j]??""));
          if(!o.No&&!o.Nama)continue;out.push(o);
        }
        return out;
      };
      const readMP=(sheetName,isOut)=>{
        const ws=wb.Sheets[sheetName];if(!ws)return [];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});
        const schema=isOut?MP_SCHEMA_OUT:MP_SCHEMA_ACTIVE,out=[];
        const dateIdx=new Set([11,15,20,40,43,46,49,55]);
        for(let i=6;i<rows.length;i++){
          const a=rows[i]||[],name=normText(a[4]),job=normText(a[7]),dept=normText(a[8]),site=normText(a[26]),exit=normText(a[55]),reason=normText(a[56]);
          if(!name||!/[A-Za-z]/.test(name))continue;
          if(isOut){if(!job&&!dept&&!site&&!exit&&!reason)continue}else{if(!job&&!dept&&!site)continue}
          const o={};schema.forEach((f,j)=>o[f]=dateIdx.has(j)?iso(a[j]):(a[j]??""));out.push(o);
        }
        return out;
      };
      const readUnits=()=>{
        const ws=wb.Sheets["UNIT"];if(!ws)return [];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});
        const rek=[],maint=[];
        for(let i=7;i<rows.length;i++){
          const a=rows[i]||[],rn=a[1],mn=a[9];
          if(rn!==""&&rn!=null&&String(rn).toLowerCase()!=="vessel"){
            if(String(rn).toLowerCase()==="dolly")rek.push({"No.":"Dolly","Category":"","Code Unit SAP":"","Manufacturer":"","Model":"","Serial Number":"","Remark":""});
            else rek.push({"No.":rn,"Category":a[2]??"","Code Unit SAP":a[3]??"","Manufacturer":a[4]??"","Model":a[5]??"","Serial Number":a[6]??"","Remark":a[7]??""});
          }
          if(mn!==""&&mn!=null)maint.push({"No.":mn,"Category":a[10]??"","Code Unit SAP":a[11]??"","Merek":a[12]??"","Kode":a[13]??"","Serial Number":a[14]??""});
        }
        return [{name:"SLR Rekondisi",rows:rek},{name:"SLR Maintenance",rows:maint}];
      };

      const newSites={
        "C4":readSite("C4"),
        "SLR - MAINTENANCE":readSite("SLR - MAINTENANCE"),
        "SLR - REKONDISI":readSite("SLR - REKONDISI"),
        "WS":readSite("WS")
      };
      const active=readMP("MP Aktif",false),out=readMP("MP OUT",true),units=readUnits();
      if(!active.length)throw new Error("Data MP Aktif tidak terbaca.");
      data.sites=newSites;
      data.siteLabels={"C4":"C4","SLR - MAINTENANCE":"SLR Maintenance","SLR - REKONDISI":"SLR Rekondisi","WS":"Workshop Legok"};
      data.units=units;
      data.mpActive=active;
      data.mpOut=out;
      normalizeAllMP();
      localStorage.setItem("kmb_full_mp_loaded","1");
      localStorage.setItem(SOURCE_SYNC_KEY,"1");
      saveData();makeSiteViews();renderUnits();renderMP();renderDashboard();
      alert("Sinkronisasi Excel selesai. Jobsite, progress rekrutmen, unit, MP Aktif dan MP OUT sudah diperbarui dari "+file.name+".");
    }catch(err){alert("Sinkronisasi gagal: "+err.message)}
  };
  reader.readAsArrayBuffer(file);input.value="";
}
function backup(){if(!ownerOnly())return;download(JSON.stringify(data,null,2),"Monitoring_Manpower_KMB_Backup.json","application/json")}
function importBackup(input){
  const file=input.files?.[0];if(!file)return;const rd=new FileReader();
  rd.onload=()=>{try{const v=JSON.parse(rd.result);if(!v.sites)throw new Error();data=v;normalizeAllMP();ensureRuntimeData();renumberAll();saveData();makeSiteViews();renderUnits();renderMP();alert("Backup berhasil dimuat.")}catch(e){alert("File backup tidak valid.")}};rd.readAsText(file);input.value="";
}
function resetAll(){if(!ownerOnly())return;if(confirm("Kembalikan data ke kondisi awal web?")){data=clone(INITIAL);normalizeAllMP();ensureRuntimeData();renumberAll();localStorage.removeItem(KEY);saveData();makeSiteViews();renderDashboard();renderUnits();renderMP();renderSettings();showView("dashboard")}}

function deletedKMBLabel(item){
  if(item.type==="site")return (data.siteLabels?.[item.siteKey]||item.siteKey||"Jobsite")+" • "+(item.row?.Nama||"-")+" • "+(item.row?.Jabatan||"-");
  if(item.type==="unit")return "Unit • "+(item.sectionName||"-")+" • "+(item.row?.["Code Unit SAP"]||item.row?.["Serial Number"]||item.row?.["No."]||"Data Unit");
  if(item.type==="unitSection")return "Section Unit • "+(item.section?.name||"-");
  return (item.mode==="active"?"MP Aktif":"MP OUT")+" • "+(item.row?.Nama||"-")+" • "+mpGroupLabel(item.row||{});
}
function renderDeletedKMB(){
  const list=data.deletedKMB||[];if(!list.length)return '<div class="empty">Belum ada data terhapus.</div>';
  return list.map((x,i)=>{const dt=x.deletedAt?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(x.deletedAt)):"-";return '<div class="statusline"><span><b>'+esc(deletedKMBLabel(x))+'</b><br><small>Dihapus: '+esc(dt)+'</small></span><span><button class="btn yellow" onclick="restoreDeletedKMB('+i+')">Kembalikan</button> <button class="btn danger" onclick="permanentDeleteKMB('+i+')">Hapus Permanen</button></span></div>'}).join("");
}
function restoreDeletedKMB(index){if(!ownerOnly())return;
  const item=(data.deletedKMB||[])[index];if(!item)return;if(!confirm("Kembalikan "+deletedKMBLabel(item)+"?"))return;
  if(item.type==="site"){
    const arr=data.sites?.[item.siteKey];if(!arr){alert("Jobsite asal tidak ditemukan.");return}
    arr.splice(Math.min(Math.max(0,Number(item.index)||0),arr.length),0,clone(item.row));renumberSiteRows(item.siteKey);
  }else if(item.type==="unit"){
    let sec=(data.units||[]).find(s=>normText(s.name)===normText(item.sectionName));
    if(!sec){sec={name:item.sectionName||"Unit",rows:[]};data.units.push(sec)}
    sec.rows.splice(Math.min(Math.max(0,Number(item.rowIndex)||0),sec.rows.length),0,clone(item.row));
  }else if(item.type==="unitSection"){
    data.units=data.units||[];data.units.splice(Math.min(Math.max(0,Number(item.sectionIndex)||0),data.units.length),0,clone(item.section));
  }else{
    const arr=item.mode==="active"?data.mpActive:data.mpOut,rec=normalizedMP(item.row||{});
    insertGroupedMP(arr,rec,{siteKey:item.siteKey,localNo:item.localNo,activeIndex:item.index});
  }
  data.deletedKMB.splice(index,1);saveData();makeSiteViews();renderUnits();renderMP();renderDashboard();renderSettings();
}
function permanentDeleteKMB(index){if(!ownerOnly())return;const item=(data.deletedKMB||[])[index];if(!item)return;if(!confirm("Hapus permanen data ini? Tindakan ini tidak dapat dibatalkan."))return;data.deletedKMB.splice(index,1);saveData();renderSettings()}
function restoreLastDeletedKMB(){if(!ownerOnly())return;if(!(data.deletedKMB||[]).length){alert("Tidak ada data terhapus.");return}restoreDeletedKMB(0)}
function getEditors(){try{const a=JSON.parse(localStorage.getItem(EDITOR_KEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return []}}
function addEditor(){if(!ownerOnly())return;let e=prompt("Masukkan email Editor (Input Data):");if(!e)return;e=e.trim().toLowerCase();if(!e.includes("@")||!e.includes(".")){alert("Format email tidak valid.");return}const a=getEditors();if(e===OWNER_EMAIL||a.includes(e)){alert("Email sudah terdaftar.");return}a.push(e);localStorage.setItem(EDITOR_KEY,JSON.stringify(a));renderSettings()}
function removeEditor(i){if(!ownerOnly())return;const a=getEditors();if(!a[i])return;if(!confirm("Hapus Editor "+a[i]+"?"))return;a.splice(i,1);localStorage.setItem(EDITOR_KEY,JSON.stringify(a));renderSettings()}
function renderSettings(){
  const host=document.getElementById("settingsContent");if(!host)return;if(isEditorMode()){host.innerHTML='<div class="card"><div class="empty">Pengaturan hanya dapat diakses Pemilik / Administrator.</div></div>';return}const editors=getEditors();
  host.innerHTML='<div class="grid2"><div class="card"><div class="section-head"><h3>Pemilik & Akses</h3></div><div class="statusline"><span>Pemilik / Administrator</span><b>'+esc(OWNER_EMAIL)+'</b></div><div class="statusline"><span>Hosting</span><b>GitHub Pages</b></div><div class="statusline"><span>Nama Sistem</span><b>Monitoring Manpower KMB</b></div><div class="statusline"><span>Hak Editor</span><b>Input Data Operasional (Tanpa Pengaturan)</b></div><div class="notice" style="margin-top:12px">Nomor jobsite dan manpower diatur otomatis. MP Aktif dan MP OUT dikelompokkan per jobsite.</div></div><div class="card"><div class="section-head"><div><h3>Editor</h3><p class="section-sub">Daftar editor yang sama dengan web KTA - TRA.</p></div><button class="btn yellow" onclick="addEditor()">+ Tambah Editor</button></div>'+(editors.length?editors.map((e,i)=>'<div class="statusline"><span>'+esc(e)+'</span><span><b>INPUT DATA</b> <button class="btn danger" onclick="removeEditor('+i+')">Hapus</button></span></div>').join(""):'<div class="empty">Belum ada Editor Input Data di browser ini.</div>')+'</div></div><div style="height:16px"></div><div class="grid2"><div class="card"><div class="section-head"><h3>Download Excel</h3></div><button class="btn primary" onclick="downloadExcel()">Download Monitoring Manpower KMB.xlsx</button></div><div class="card"><div class="section-head"><h3>Import Data Lengkap dari Excel</h3></div><label class="btn yellow">Import Excel Monitoring Manpower KMB<input type="file" accept=".xlsx,.xls" hidden onchange="importOriginalExcel(this)"></label></div></div><div style="height:16px"></div><div class="grid2"><div class="card"><div class="section-head"><h3>Backup Data Web</h3></div><div class="toolbar"><button class="btn" onclick="backup()">Download Backup JSON</button><label class="btn">Import Backup<input type="file" accept=".json" hidden onchange="importBackup(this)"></label></div></div><div class="card"><div class="section-head"><h3>Reset</h3></div><button class="btn danger" onclick="resetAll()">Reset ke Data Awal</button></div></div><div style="height:16px"></div><div class="card"><div class="section-head"><div><h3>Data Terhapus</h3><p class="section-sub">Data jobsite, MP Aktif, atau MP OUT yang salah hapus dapat dipulihkan.</p></div><span class="pill">'+((data.deletedKMB||[]).length)+' data</span></div><div class="toolbar" style="margin-bottom:8px"><button class="btn yellow" onclick="restoreLastDeletedKMB()">Kembalikan Terakhir Dihapus</button></div>'+renderDeletedKMB()+'</div>';
}
function goDashboard(){
  recruitRoleFilter="";
  showView("dashboard");
}
function showView(name){
  if(name==="settings"&&isEditorMode()){alert("Pengaturan hanya dapat diakses Pemilik / Administrator.");name="dashboard"}
  const target=document.getElementById(name)?name:"dashboard";
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const el=document.getElementById(target);if(el)el.classList.add("active");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===target));
  document.getElementById("topTitle").textContent=document.querySelector('.nav[data-view="'+target+'"]')?.dataset.title||"Monitoring Manpower KMB";
  const back=document.getElementById("backDashboard");if(back)back.style.display=target==="dashboard"?"none":"inline-flex";
  document.getElementById("sidebar").classList.remove("open");window.scrollTo(0,0);
  if(target==="dashboard")renderDashboard();
  if(target==="units")renderUnits();
  if(target==="mp")renderMP();
  if(target==="settings")renderSettings();
}

document.addEventListener("DOMContentLoaded",()=>{
  applyAccessMode();
  document.getElementById("today").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  makeSiteViews();renderDashboard();renderUnits();renderMP();renderSettings();
  document.getElementById("unitSearch").addEventListener("input",renderUnits);
  document.getElementById("mpSearch").addEventListener("input",renderMP);
  document.querySelectorAll(".mp-tab").forEach(b=>b.onclick=()=>setMPMode(b.dataset.mode));
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>showView(n.dataset.view));
  document.getElementById("saveModal").onclick=saveModal;document.getElementById("closeModal").onclick=closeModal;
  document.getElementById("menuBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("exportUnits").onclick=exportUnits;document.getElementById("exportMP").onclick=exportMP;document.getElementById("addMP").onclick=()=>openMpForm(mpMode,null);document.getElementById("mpFullBtn").onclick=toggleMPFull;
  showView("dashboard");
});