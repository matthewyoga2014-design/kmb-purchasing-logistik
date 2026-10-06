const BASE={
  mpp:window.KTA_TRA_MPP||[],
  mpActive:window.KTA_TRA_MP_ACTIVE||[],
  mpOut:window.KTA_TRA_MP_OUT||[],
  units:window.KTA_TRA_UNITS||[],
  candidates:{},
  deletedMPP:[],
  sourceFile:"Monitoring KTA - TRA(7).xlsx"
};
const STORAGE_KEY="kta_tra_monitoring_v1";
const EDITOR_KEY="kmb_editors";
const OWNER_EMAIL="matthewyoga2014@gmail.com";
let data=loadData(), editState=null, mpMode="active", mpFull=false, recruitRole="";

const MPP_FIELDS=["No","Nama","Jabatan","Keterangan","PIC","PTK","Tanggal Pengajuan PTK","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi","Due Date","Status","Tanggal Close","Keterangan PTK","Lama Closing (Hari)"];
const MP_ACTIVE_SCHEMA=["No.","NIP (KARYAWAN)","NIK KTP","NO.KK","Nama","NO. NPWP","Nomor HP","Whatsapp","Jabatan","Departemen","Level","Status Kontrak PKWT/PKWTT/Harian Lepas","Akhir Kontrak","POH","Sisa Hari","Reminder","Tanggal Masuk","Masa Kerja","Jenis Kelamin","Agama","Tempat Lahir","Tgl/Lahir","Umur","Pendidikan Terakhir","Alamat Domisili","Alamat Lengkap","Keterangan","Tempat Bekerja","SITE","No Rekening","Nama Bank","Nama Pemilik Rekening","Nomor BPJS Kesehatan","Nomor BPJS Ketenagakerjaan","Nama Ibu","Pendidikan Terakhir Ibu","Pekerjaan Ibu","Nama Ayah","Pendidikan Terakhir Ayah","Pekerjaan Ayah","Saudara Kandung (1)","Jenis Kelamin (1)","Tanggal Lahir (1)","Saudara Kandung (2)","Jenis Kelamin (2)","Tanggal Lahir (2)","Saudara Kandung (3)","Jenis Kelamin (3)","Tanggal Lahir (3)","Saudara Kandung (4)","Jenis Kelamin (4)","Tanggal Lahir (4)","Nama Emergency","Hubungan","Nomor Telepon","Whatsapp Emergency","STATUS","BLOK KAMAR"];
const MP_OUT_SCHEMA=MP_ACTIVE_SCHEMA.slice(0,-1).concat(["Tanggal Keluar","Tanggal Lamaran"]);
const MP_SUMMARY=["No.","Nama","Jabatan","Departemen","Level","Status Kontrak PKWT/PKWTT/Harian Lepas","Akhir Kontrak","POH","Sisa Hari","Tanggal Masuk","Masa Kerja","Keterangan","SITE","STATUS"];
const CANDIDATE_FIELDS=["Nama Kandidat","Tanggal Lamaran","Sumber","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi","Status Kandidat","Keterangan"];
const DATE_FIELDS=new Set(["Tanggal Pengajuan PTK","Psikologi Test","Interview User","Offering Latter","MCU","On Site","Induksi","Due Date","Tanggal Close","Akhir Kontrak","Reminder","Tanggal Masuk","Tgl/Lahir","Tanggal Lahir (1)","Tanggal Lahir (2)","Tanggal Lahir (3)","Tanggal Lahir (4)","Tanggal Keluar"]);

function clone(v){return JSON.parse(JSON.stringify(v))}
function norm(v){return String(v??"").trim()}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function todayISO(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function fmtDate(v){if(!v)return "-";const d=new Date(String(v).slice(0,10)+"T00:00:00");return isNaN(d)?esc(v):new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(d)}
function isVacant(v){return !norm(v)||norm(v).toLowerCase()==="vacant"}
function nameKey(v){return norm(v).toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()}
function sameName(a,b){return nameKey(a)===nameKey(b)}
function jobKey(v){
  let s=norm(v).toLowerCase().replace(/\bmidle\b/g,"middle").replace(/\bmekanik middle\b/g,"middle mekanik").replace(/\s+/g," ").trim();
  return s;
}
function jobLabel(v){
  const k=jobKey(v);
  if(k==="middle mekanik")return "Middle Mekanik";
  return norm(v)||"Belum ditentukan";
}
function vacancyKey(r){return "MPP-"+norm(r?.No)}
function candidateStatusFromText(s){
  s=norm(s).toLowerCase();
  if(/tidak lolos|gagal/.test(s))return "Tidak Lolos";
  if(/menolak/.test(s))return "Menolak";
  if(/tidak ada respon|no response/.test(s))return "No Response";
  if(/hold/.test(s))return "Hold";
  if(/hired|diterima/.test(s))return "Hired";
  return "Aktif";
}
function seedCandidatesFromText(r){
  const txt=norm(r?.Keterangan);if(!txt||/^MP OUT\s*-/i.test(txt))return [];
  const list=txt.split(/\n+/).map(x=>norm(x)).filter(Boolean).map(line=>{
    const parts=line.split(/\s+-\s*/);
    const name=norm(parts.shift()),note=norm(parts.join(" - "));
    if(!name||name.length<2)return null;
    return {"Nama Kandidat":name,"Tanggal Lamaran":"","Sumber":"","Psikologi Test":"","Interview User":"","Offering Latter":"","MCU":"","FU MCU":"","On Site":"","Induksi":"","Status Kandidat":candidateStatusFromText(note),"Keterangan":note};
  }).filter(Boolean);
  const target=list.find(x=>!["Tidak Lolos","Menolak","No Response"].includes(x["Status Kandidat"]))||list[0];
  if(target)["Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi"].forEach(k=>target[k]=r?.[k]||"");
  return list;
}
function ensureCandidateData(d){
  if(!d.candidates||typeof d.candidates!=="object"||Array.isArray(d.candidates))d.candidates={};
  (d.mpp||[]).forEach(r=>{
    if(!isVacant(r.Nama))return;
    const key=vacancyKey(r);
    if(!Array.isArray(d.candidates[key])||!d.candidates[key].length){
      const seeded=seedCandidatesFromText(r);
      if(seeded.length)d.candidates[key]=seeded;
    }
  });
  return d;
}
function getCandidates(r){return (data.candidates&&Array.isArray(data.candidates[vacancyKey(r)]))?data.candidates[vacancyKey(r)]:[]}
function candidateProgress(c){
  if(norm(c?.["Status Kandidat"]).toLowerCase()==="hired")return {p:100,label:"HIRED"};
  return progress(c||{});
}
function bestCandidateProgress(r){
  const list=getCandidates(r);
  if(!list.length)return progress(r);
  return list.map(candidateProgress).sort((a,b)=>b.p-a.p)[0]||progress(r);
}
function candidateBreakdown(r){
  const list=getCandidates(r),bd={};
  list.forEach(c=>{const p=candidateProgress(c);bd[p.label]=(bd[p.label]||0)+1});
  return bd;
}
function allCandidateRows(){
  const out=[];
  (data.mpp||[]).forEach((r,mi)=>{
    getCandidates(r).forEach((cand,ci)=>{
      const p=candidateProgress(cand);
      out.push({"No MPP":r.No,"Jabatan":r.Jabatan,"PTK":r.PTK,"Status PTK":r.Status,"Due Date":r["Due Date"],...cand,"Progress Terakhir":p.label,"Progress %":p.p,"MPP Index":mi+1,"Kandidat Ke":ci+1});
    });
  });
  return out;
}
function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const d=raw?JSON.parse(raw):clone(BASE);
    d.mpp=Array.isArray(d.mpp)?d.mpp:clone(BASE.mpp);
    d.mpActive=Array.isArray(d.mpActive)?d.mpActive:clone(BASE.mpActive);
    d.mpOut=Array.isArray(d.mpOut)?d.mpOut:clone(BASE.mpOut);
    d.units=Array.isArray(d.units)?d.units:clone(BASE.units);
    d.deletedMPP=Array.isArray(d.deletedMPP)?d.deletedMPP:[];
    d.sourceFile=d.sourceFile||BASE.sourceFile;
    d.mpActive=d.mpActive.map(r=>normalizeMP(r,false));
    d.mpOut=d.mpOut.map(r=>normalizeMP(r,true));
    ensureCandidateData(d);
    return d;
  }catch(e){return clone(BASE)}
}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderDashboard();renderSettings()}
function normalizeMP(row,isOut){
  const schema=isOut?MP_OUT_SCHEMA:MP_ACTIVE_SCHEMA, out={};
  const aliases={"No.":["No.","No"],"Status Kontrak PKWT/PKWTT/Harian Lepas":["Status Kontrak PKWT/PKWTT/Harian Lepas","Status Kontrak"],"Tanggal Masuk":["Tanggal Masuk","Tanggal \n Masuk"],"Pendidikan Terakhir":["Pendidikan Terakhir","Pendidikan \n Terakhir"],"Tempat Bekerja":["Tempat Bekerja","Tempat \n Bekerja"],"Nomor Telepon":["Nomor Telepon","Nomor \n Telfon"],"BLOK KAMAR":["BLOK KAMAR","Blok Kamar"]};
  schema.forEach(f=>{
    let val=row?.[f];
    if(val===undefined&&aliases[f])for(const a of aliases[f])if(row?.[a]!==undefined){val=row[a];break}
    out[f]=val??"";
  });
  return out;
}
function badge(v){
  if(!v)return '<span class="badge neutral">-</span>';
  let c="neutral",s=String(v);
  if(/^open$/i.test(s))c="open";else if(/close|selesai/i.test(s))c="close";else if(/continue/i.test(s))c="continue";else if(/jatuh tempo/i.test(s))c="due";else if(/hampir|track/i.test(s))c="ok";
  return '<span class="badge '+c+'">'+esc(s)+'</span>';
}
function progress(r){
  const steps=[["Induksi",100,"INDUKSI"],["On Site",95,"ON SITE"],["FU MCU",80,"FU MCU"],["MCU",70,"MCU"],["Offering Latter",55,"OFFERING"],["Interview User",40,"INTERVIEW USER"],["Psikologi Test",25,"PSIKOLOGI TEST"]];
  for(const [k,p,label] of steps)if(norm(r[k]))return {p,label};
  return {p:0,label:"SOURCING KANDIDAT"};
}
function daysLeft(v){if(!v)return "";const d=new Date(v+"T00:00:00"),t=new Date();t.setHours(0,0,0,0);return Math.round((d-t)/86400000)}
function metrics(){
  const planning=data.mpp.length,vacant=data.mpp.filter(r=>isVacant(r.Nama)).length,actual=planning-vacant;
  return {planning,vacant,actual,pct:planning?Math.round(actual/planning*100):0,
    open:data.mpp.filter(r=>norm(r.Status).toLowerCase()==="open").length,
    cont:data.mpp.filter(r=>norm(r.Status).toLowerCase()==="continue").length,
    close:data.mpp.filter(r=>norm(r.Status).toLowerCase()==="close").length,
    near:data.mpp.filter(r=>norm(r["Keterangan PTK"]).toUpperCase()==="HAMPIR JATUH TEMPO").length,
    overdue:data.mpp.filter(r=>norm(r["Keterangan PTK"]).toUpperCase()==="JATUH TEMPO").length,
    done:data.mpp.filter(r=>norm(r["Keterangan PTK"]).toUpperCase()==="SELESAI").length
  }
}
function renderDashboard(){
  const m=metrics();
  document.getElementById("kPlanning").textContent=m.planning;
  document.getElementById("kActual").textContent=m.actual;
  document.getElementById("kVacant").textContent=m.vacant;
  document.getElementById("kPct").textContent=m.pct+"%";
  document.getElementById("vacantTotal").textContent=m.vacant+" vacant • "+allCandidateRows().length+" kandidat";
  document.getElementById("statusCards").innerHTML=[["Open",m.open],["Continue",m.cont],["Close",m.close]].map(x=>'<div class="mini"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join("");
  document.getElementById("dueCards").innerHTML=[["Hampir Jatuh Tempo",m.near],["Jatuh Tempo",m.overdue],["Selesai",m.done]].map(x=>'<div class="mini"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join("");
  renderVacancyResume();renderRecruitment();renderUnits();
}
function renderVacancyResume(){
  const groups={};
  data.mpp.forEach((r,i)=>{
    if(!isVacant(r.Nama))return;
    const key=jobKey(r.Jabatan)||"belum",p=bestCandidateProgress(r),cands=getCandidates(r);
    if(!groups[key])groups[key]={label:jobLabel(r.Jabatan),items:[],candidateCount:0};
    groups[key].items.push({r,p,i});
    groups[key].candidateCount+=cands.length;
  });
  const arr=Object.values(groups).sort((a,b)=>b.items.length-a.items.length||a.label.localeCompare(b.label));
  document.getElementById("vacancyResume").innerHTML=arr.length?arr.map(g=>{
    const best=g.items.slice().sort((a,b)=>b.p.p-a.p.p)[0],bd={};
    g.items.forEach(x=>{const cb=candidateBreakdown(x.r);if(Object.keys(cb).length)Object.entries(cb).forEach(([k,v])=>bd[k]=(bd[k]||0)+v);else bd[x.p.label]=(bd[x.p.label]||0)+1});
    return '<button class="resume-card" onclick="focusRole(decodeURIComponent(\''+encodeURIComponent(jobKey(g.label))+'\'))"><div><span class="resume-count">'+g.items.length+'</span><b>'+esc(g.label)+'</b></div><div class="candidate-total">'+g.candidateCount+' kandidat untuk '+g.items.length+' vacant</div><div class="resume-best">Progress kandidat tertinggi: <b>'+esc(best.p.label)+' ('+best.p.p+'%)</b></div><div class="resume-breakdown">'+esc(Object.entries(bd).map(x=>x[1]+'× '+x[0]).join(" • ")||"Belum ada kandidat")+'</div><div class="resume-link">Lihat detail →</div></button>'
  }).join(""):'<div class="empty">Tidak ada vacant</div>';
}
function focusRole(role){recruitRole=role;renderRecruitment();document.getElementById("recruitmentCard").scrollIntoView({behavior:"smooth",block:"start"})}
function clearRole(){recruitRole="";renderRecruitment()}
function renderRecruitment(){
  const rows=data.mpp.map((r,i)=>({...r,__i:i})).filter(r=>norm(r.Status).toLowerCase()==="open"&&(!recruitRole||jobKey(r.Jabatan)===recruitRole));
  document.getElementById("recruitCount").textContent=rows.length+" OPEN • "+rows.reduce((s,r)=>s+getCandidates(r).length,0)+" KANDIDAT";
  const fb=document.getElementById("recruitFilterBadge");
  if(recruitRole){fb.style.display="inline-flex";fb.innerHTML=esc(jobLabel(recruitRole))+' <button onclick="clearRole()">×</button>'}else fb.style.display="none";
  document.getElementById("recruitBody").innerHTML=rows.length?rows.map(r=>{
    const p=bestCandidateProgress(r),d=daysLeft(r["Due Date"]),dc=d<0?"overdue":d<=7?"warning":"",list=getCandidates(r);
    const preview=list.slice(0,3).map(c=>{const cp=candidateProgress(c);return '<div class="candidate-preview"><b>'+esc(c["Nama Kandidat"]||"-")+'</b><span>'+esc(cp.label)+' '+cp.p+'%</span></div>'}).join("");
    return '<tr><td><b>'+esc(r.Jabatan)+'</b></td><td>'+fmtDate(r["Tanggal Pengajuan PTK"])+'</td><td>'+fmtDate(r["Due Date"])+'</td><td><span class="days '+dc+'">'+(d===""?"-":d)+'</span></td><td>'+badge(r.Status)+'</td><td><b>'+esc(p.label)+'</b></td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress recruit-progress"><i style="width:'+p.p+'%"></i></div><b>'+p.p+'%</b></div></td><td><button class="btn candidate-btn" onclick="openCandidateList('+r.__i+')">'+list.length+' Kandidat</button>'+preview+(list.length>3?'<small>+'+(list.length-3)+' kandidat lainnya</small>':'')+'</td><td>'+esc(r.Keterangan||"-")+'</td></tr>'
  }).join(""):'<tr><td colspan="9" class="empty">Tidak ada PTK Open untuk filter ini.</td></tr>';
}
function renderUnits(){
  const total=(data.units||[]).reduce((s,r)=>s+(Number(r.Jumlah)||0),0);
  document.getElementById("unitTotal").textContent=total+" unit";
  document.getElementById("unitSummary").innerHTML=(data.units||[]).map(r=>'<div class="unit-card"><span>'+esc(r["Jenis Unit"])+'</span><b>'+esc(r.Jumlah)+'</b></div>').join("");
}
function renderMPP(){
  const q=norm(document.getElementById("mppSearch")?.value).toLowerCase(),st=norm(document.getElementById("mppStatus")?.value),m=metrics();
  document.getElementById("mppStats").innerHTML='<div class="stats"><div class="mini"><b>'+m.planning+'</b><span>Planning</span></div><div class="mini"><b>'+m.actual+'</b><span>Actual</span></div><div class="mini"><b>'+m.vacant+'</b><span>Vacant</span></div><div class="mini"><b>'+m.open+'</b><span>Open</span></div><div class="mini"><b>'+m.close+'</b><span>Close</span></div></div>';
  const rows=data.mpp.map((r,i)=>({...r,__i:i})).filter(r=>(!q||JSON.stringify(r).toLowerCase().includes(q)||JSON.stringify(getCandidates(r)).toLowerCase().includes(q))&&(!st||r.Status===st));
  const body=rows.map(r=>{
    const p=isVacant(r.Nama)?bestCandidateProgress(r):progress(r),list=getCandidates(r);
    const cand=isVacant(r.Nama)?'<button class="btn candidate-btn" onclick="openCandidateList('+r.__i+')">'+list.length+' Kandidat</button>':'<span class="badge neutral">-</span>';
    return '<tr><td>'+esc(r.No)+'</td><td><b>'+esc(r.Nama)+'</b></td><td>'+esc(r.Jabatan)+'</td><td>'+cand+'</td><td>'+esc(r.Keterangan||"-")+'</td><td>'+esc(r.PTK||"-")+'</td><td>'+badge(r.Status)+'</td><td><div style="display:flex;align-items:center;gap:7px"><div class="progress"><i style="width:'+p.p+'%"></i></div><b>'+p.p+'%</b></div><small>'+esc(p.label)+'</small></td><td>'+fmtDate(r["Due Date"])+'</td><td>'+badge(r["Keterangan PTK"])+'</td><td class="action-cell"><button class="btn" onclick="openMPPForm('+r.__i+')">Edit</button> '+(isVacant(r.Nama)?'<button class="btn yellow" onclick="openCandidateList('+r.__i+')">Kandidat</button> ':'')+'<button class="btn danger" onclick="deleteMPP('+r.__i+')">Hapus</button></td></tr>'
  }).join("");
  document.getElementById("mppTable").innerHTML='<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Kandidat</th><th>Keterangan</th><th>PTK</th><th>Status</th><th>Progress</th><th>Due Date</th><th>Ket. PTK</th><th>Aksi</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function computeMPP(r){
  if(!norm(r.PTK)||!norm(r["Tanggal Pengajuan PTK"])){r["Keterangan PTK"]="TIDAK ADA PENGAJUAN";r["Lama Closing (Hari)"]="";return}
  if(r.Status==="Close"){r["Keterangan PTK"]="SELESAI";if(r["Tanggal Close"]&&r["Tanggal Pengajuan PTK"]){const a=new Date(r["Tanggal Pengajuan PTK"]),b=new Date(r["Tanggal Close"]);r["Lama Closing (Hari)"]=String(Math.round((b-a)/86400000))}return}
  const d=daysLeft(r["Due Date"]);r["Keterangan PTK"]=d===""?"":d<=0?"JATUH TEMPO":d<=7?"HAMPIR JATUH TEMPO":"ON TRACK";r["Lama Closing (Hari)"]="";
}
function fieldHTML(f,row,type){
  const val=row?.[f]??"",empty=type==="mp"&&!norm(val);
  if(f==="Status"&&type==="mpp")return '<div class="field"><label>Status</label><select data-f="Status"><option value=""></option>'+["Open","Continue","Close"].map(x=>'<option '+(val===x?"selected":"")+'>'+x+'</option>').join("")+'</select></div>';
  if(["Keterangan","Alamat Domisili","Alamat Lengkap"].includes(f))return '<div class="field '+(empty?"empty-field":"")+'"><label>'+esc(f)+'</label><textarea data-f="'+esc(f)+'" placeholder="'+(empty?"Belum terisi di Excel":"")+'">'+esc(val)+'</textarea>'+(empty?'<small class="empty-hint">Belum terisi di Excel</small>':'')+'</div>';
  return '<div class="field '+(empty?"empty-field":"")+'"><label>'+esc(f)+'</label><input type="'+(DATE_FIELDS.has(f)?"date":"text")+'" data-f="'+esc(f)+'" value="'+esc(val)+'" placeholder="'+(empty?"Belum terisi di Excel":"")+'">'+(empty?'<small class="empty-hint">Belum terisi di Excel</small>':'')+'</div>';
}
function openMPPForm(index=null){
  setModalSave(true);
  editState={type:"mpp",index};const row=index===null?{}:data.mpp[index];
  document.getElementById("modalTitle").textContent=index===null?"Tambah MPP KTA - TRA":"Edit MPP KTA - TRA";
  document.getElementById("formFields").innerHTML=MPP_FIELDS.map(f=>fieldHTML(f,row,"mpp")).join("");
  document.getElementById("modal").classList.add("show");document.querySelector("#modal .modal-card").scrollTop=0;
}
function deleteMPP(index){
  const row=data.mpp[index];if(!row)return;
  if(!confirm("Hapus data MPP ini?\n\nData tidak akan hilang permanen. Data akan dipindahkan ke Data Terhapus dan bisa dikembalikan kapan saja."))return;
  const key=vacancyKey(row),cands=clone(getCandidates(row));
  data.deletedMPP=data.deletedMPP||[];
  data.deletedMPP.unshift({row:clone(row),candidates:cands,deletedAt:new Date().toISOString()});
  if(data.candidates)delete data.candidates[key];
  data.mpp.splice(index,1);
  saveData();renderMPP();
  alert("Data MPP dipindahkan ke Data Terhapus. Anda bisa memulihkannya dari menu Pengaturan.");
}
function setModalSave(show,label="Simpan Perubahan"){
  const b=document.getElementById("saveModal");if(!b)return;b.style.display=show?"":"none";b.textContent=label;
}
function openCandidateList(mppIndex){
  const r=data.mpp[mppIndex];if(!r)return;
  if(!isVacant(r.Nama)){alert("Kandidat hanya dikelola untuk posisi Vacant.");return}
  const list=getCandidates(r),best=bestCandidateProgress(r);
  editState={type:"candidate-list",mppIndex};
  document.getElementById("modalTitle").textContent="Kandidat — "+r.Jabatan+" (Vacant #"+r.No+")";
  setModalSave(false);
  document.getElementById("formFields").innerHTML='<div class="candidate-manager"><div class="candidate-manager-head"><div><b>'+list.length+' kandidat</b><span>Progress tertinggi '+esc(best.label)+' ('+best.p+'%)</span></div><button class="btn yellow" onclick="openCandidateForm('+mppIndex+',null)">+ Tambah Kandidat</button></div>'+(list.length?list.map((cand,ci)=>{
    const p=candidateProgress(cand);
    return '<div class="candidate-card"><div class="candidate-card-main"><div class="candidate-name">'+esc(cand["Nama Kandidat"]||"-")+'</div><div class="candidate-meta">'+badge(cand["Status Kandidat"]||"Aktif")+' <span>'+esc(cand.Sumber||"Sumber belum diisi")+'</span></div><div class="candidate-progress"><div class="progress"><i style="width:'+p.p+'%"></i></div><b>'+p.p+'%</b><span>'+esc(p.label)+'</span></div><div class="candidate-note">'+esc(cand.Keterangan||"")+'</div></div><div class="candidate-actions"><button class="btn" onclick="openCandidateForm('+mppIndex+','+ci+')">Edit</button><button class="btn danger" onclick="deleteCandidate('+mppIndex+','+ci+')">Hapus</button></div></div>'
  }).join(""):'<div class="empty">Belum ada kandidat. Klik “Tambah Kandidat”.</div>')+'</div>';
  document.getElementById("modal").classList.add("show");document.querySelector("#modal .modal-card").scrollTop=0;
}
function candidateFieldHTML(f,row){
  const val=row?.[f]??"";
  if(f==="Status Kandidat")return '<div class="field"><label>Status Kandidat</label><select data-f="Status Kandidat">'+["Aktif","Hold","Tidak Lolos","Menolak","No Response","Hired","Cancel"].map(x=>'<option '+(val===x?"selected":"")+'>'+x+'</option>').join("")+'</select></div>';
  if(f==="Keterangan")return '<div class="field"><label>Keterangan</label><textarea data-f="Keterangan">'+esc(val)+'</textarea></div>';
  return '<div class="field"><label>'+esc(f)+'</label><input type="'+(DATE_FIELDS.has(f)?"date":"text")+'" data-f="'+esc(f)+'" value="'+esc(val)+'"></div>';
}
function openCandidateForm(mppIndex,candidateIndex=null){
  const r=data.mpp[mppIndex];if(!r)return;const list=getCandidates(r),row=candidateIndex===null?{"Status Kandidat":"Aktif"}:(list[candidateIndex]||{});
  editState={type:"candidate",mppIndex,candidateIndex};
  document.getElementById("modalTitle").textContent=(candidateIndex===null?"Tambah":"Edit")+" Kandidat — "+r.Jabatan;
  setModalSave(true,candidateIndex===null?"Tambah Kandidat":"Simpan Kandidat");
  document.getElementById("formFields").innerHTML='<div class="candidate-back"><button class="btn" type="button" onclick="openCandidateList('+mppIndex+')">← Daftar Kandidat</button><span>Vacant #'+esc(r.No)+' • '+esc(r.PTK||"PTK belum diisi")+'</span></div>'+CANDIDATE_FIELDS.map(f=>candidateFieldHTML(f,row)).join("");
  document.getElementById("modal").classList.add("show");document.querySelector("#modal .modal-card").scrollTop=0;
}
function deleteCandidate(mppIndex,candidateIndex){
  const r=data.mpp[mppIndex],list=getCandidates(r),cand=list[candidateIndex];if(!cand)return;
  if(!confirm("Hapus kandidat "+(cand["Nama Kandidat"]||"ini")+"?"))return;
  list.splice(candidateIndex,1);data.candidates[vacancyKey(r)]=list;saveData();renderMPP();openCandidateList(mppIndex);
}
function setMPMode(mode){mpMode=mode;document.querySelectorAll(".mp-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));renderMP()}
function toggleMPFull(){mpFull=!mpFull;document.getElementById("mpFullBtn").textContent=mpFull?"Tampilan Ringkas":"Semua Kolom";renderMP()}
function renderMP(){
  const arr=mpMode==="active"?data.mpActive:data.mpOut,q=norm(document.getElementById("mpSearch")?.value).toLowerCase();
  const rows=arr.map((r,i)=>({...r,__i:i})).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
  document.getElementById("mpTitle").textContent=mpMode==="active"?"MP Aktif":"MP Out";document.getElementById("mpCount").textContent=rows.length+" data";
  const fields=mpFull?(mpMode==="active"?MP_ACTIVE_SCHEMA:MP_OUT_SCHEMA):MP_SUMMARY.concat(mpMode==="out"?["Tanggal Keluar"]:[]);
  const head=fields.map(f=>'<th>'+esc(f)+'</th>').join("")+'<th>Aksi</th>';
  const body=rows.map(r=>{
    const cells=fields.map(f=>'<td>'+esc(r[f]||"-")+'</td>').join("");
    const acts=mpMode==="active"?'<button class="btn" onclick="openMPForm(\'active\','+r.__i+')">Edit</button> <button class="btn danger" onclick="openExit('+r.__i+')">MP OUT</button>':'<button class="btn" onclick="openMPForm(\'out\','+r.__i+')">Edit</button> <button class="btn yellow" onclick="restoreFromOut('+r.__i+')">Kembalikan ke MP Aktif</button> <button class="btn danger" onclick="deleteMP(\'out\','+r.__i+')">Hapus</button>';
    return '<tr>'+cells+'<td class="action-cell">'+acts+'</td></tr>'
  }).join("");
  document.getElementById("mpTable").innerHTML='<div class="table-wrap"><table class="table"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
function openMPForm(mode,index=null){
  setModalSave(true);
  editState={type:"mp",mode,index};const arr=mode==="active"?data.mpActive:data.mpOut,row=index===null?{}:arr[index],schema=mode==="active"?MP_ACTIVE_SCHEMA:MP_OUT_SCHEMA;
  document.getElementById("modalTitle").textContent=(index===null?"Tambah ":"Edit ")+(mode==="active"?"MP Aktif":"MP Out");
  let top="";
  if(index!==null){const filled=schema.filter(f=>norm(row[f])).length;top='<div class="data-completeness" style="grid-column:1/-1"><div><b>'+esc(row.Nama||"Data Manpower")+'</b><span>'+filled+' dari '+schema.length+' kolom terisi</span></div><span class="badge neutral">'+(schema.length-filled)+' kosong</span></div>'}
  if(mode==="out"&&index===null)top+='<div class="source-box"><label>Ambil data dari MP Aktif</label><select id="sourceActive"><option value="">-- pilih nama --</option>'+data.mpActive.map((r,i)=>'<option value="'+i+'">'+esc(r.Nama)+' — '+esc(r.Jabatan)+'</option>').join("")+'</select><small>Data akan disalin ke form MP Out.</small></div>';
  document.getElementById("formFields").innerHTML=top+schema.map(f=>fieldHTML(f,row,"mp")).join("");
  document.getElementById("modal").classList.add("show");document.querySelector("#modal .modal-card").scrollTop=0;
  const s=document.getElementById("sourceActive");if(s)s.onchange=()=>fillFromActive(s.value);
}
function fillFromActive(idx){if(idx==="")return;const src=data.mpActive[Number(idx)];MP_OUT_SCHEMA.forEach(f=>{const el=document.querySelector('#formFields [data-f="'+CSS.escape(f)+'"]');if(el)el.value=f==="Tanggal Keluar"?todayISO():(src[f]||"")})}
function openExit(index){
  setModalSave(true);
  const src=data.mpActive[index];editState={type:"exit",sourceIndex:index};
  const row={...normalizeMP(src,true),"Tanggal Keluar":todayISO()};
  document.getElementById("modalTitle").textContent="Pindahkan ke MP Out — "+src.Nama;
  document.getElementById("formFields").innerHTML='<div class="notice" style="grid-column:1/-1"><b>Sinkron otomatis:</b> saat disimpan, data masuk ke MP Out, dihapus dari MP Aktif, dan posisi yang sama di MPP menjadi Vacant.</div>'+MP_OUT_SCHEMA.map(f=>fieldHTML(f,row,"mp")).join("");
  document.getElementById("modal").classList.add("show");document.querySelector("#modal .modal-card").scrollTop=0;
}
function deleteMP(mode,index){if(confirm("Hapus data ini?")){(mode==="active"?data.mpActive:data.mpOut).splice(index,1);saveData();renderMP()}}
function restoreFromOut(index){
  const rec=data.mpOut[index];if(!rec)return;
  const name=rec.Nama||"data ini";
  if(data.mpActive.some(x=>sameName(x.Nama,rec.Nama))){
    alert(name+" sudah ada di MP Aktif. Data MP Out tidak dipindahkan untuk mencegah duplikasi.");
    return;
  }
  if(!confirm("Kembalikan "+name+" dari MP Out ke MP Aktif?\n\nJabatan: "+(rec.Jabatan||"-")+"\nSITE: "+(rec.SITE||"TRA")+"\n\nJika posisi MPP sebelumnya masih Vacant, posisi tersebut akan diisi kembali otomatis."))return;

  const active={};MP_ACTIVE_SCHEMA.forEach(f=>active[f]=rec[f]||"");
  if(!active["No."])active["No."]=String(data.mpActive.length+1);
  data.mpActive.push(active);

  let target=data.mpp.find(r=>isVacant(r.Nama)&&norm(r.Keterangan).toLowerCase().includes(norm(rec.Nama).toLowerCase()));
  if(!target)target=data.mpp.find(r=>isVacant(r.Nama)&&jobKey(r.Jabatan)===jobKey(rec.Jabatan));
  if(target){
    target.Nama=rec.Nama;
    target.Jabatan=target.Jabatan||rec.Jabatan;
    target.Keterangan="Dikembalikan dari MP Out";
    if(target.PTK&&norm(target.Status).toLowerCase()==="open"){
      target.Status="Close";
      target["Tanggal Close"]=todayISO();
      target["Keterangan PTK"]="SELESAI";
      if(target["Tanggal Pengajuan PTK"]){
        const a=new Date(target["Tanggal Pengajuan PTK"]),b=new Date(target["Tanggal Close"]);
        target["Lama Closing (Hari)"]=String(Math.round((b-a)/86400000));
      }
    }else if(!target.PTK){
      target.Status="";
      target["Keterangan PTK"]="TIDAK ADA PENGAJUAN";
    }
  }else if(!data.mpp.some(r=>sameName(r.Nama,rec.Nama))){
    data.mpp.push({
      No:String(Math.max(0,...data.mpp.map(r=>Number(r.No)||0))+1),
      Nama:rec.Nama,Jabatan:rec.Jabatan||"",Keterangan:"Dikembalikan dari MP Out",PIC:"",
      PTK:"","Tanggal Pengajuan PTK":"","Psikologi Test":"","Interview User":"","Offering Latter":"",
      MCU:"","FU MCU":"","On Site":"","Induksi":"","Due Date":"","Status":"","Tanggal Close":"",
      "Keterangan PTK":"TIDAK ADA PENGAJUAN","Lama Closing (Hari)":""
    });
  }

  data.mpOut.splice(index,1);
  saveData();renderMPP();renderMP();renderDashboard();
  alert(name+" berhasil dikembalikan ke MP Aktif dan data MPP sudah disinkronkan.");
}
function vacateMPP(rec){
  const row=data.mpp.find(r=>sameName(r.Nama,rec.Nama));
  if(row){row.Nama="Vacant";row.Keterangan="MP OUT - "+rec.Nama;row.PIC=row.PIC||"";if(!row.PTK){row.Status="";row["Keterangan PTK"]="TIDAK ADA PENGAJUAN"}}
}
function closeModal(){document.getElementById("modal").classList.remove("show");setModalSave(true);editState=null}
function saveModal(){
  if(!editState)return;const vals={};document.querySelectorAll("#formFields [data-f]").forEach(el=>vals[el.dataset.f]=el.value);
  if(editState.type==="mpp"){
    if(!vals.No)vals.No=String(Math.max(0,...data.mpp.map(r=>Number(r.No)||0))+1);computeMPP(vals);
    if(editState.index===null)data.mpp.push(vals);else data.mpp[editState.index]={...data.mpp[editState.index],...vals};
    saveData();renderMPP();closeModal();return;
  }
  if(editState.type==="candidate"){
    const r=data.mpp[editState.mppIndex],key=vacancyKey(r),list=getCandidates(r),clean={};
    CANDIDATE_FIELDS.forEach(f=>clean[f]=vals[f]||"");
    if(!norm(clean["Nama Kandidat"])){alert("Nama kandidat wajib diisi.");return}
    if(editState.candidateIndex===null)list.push(clean);else list[editState.candidateIndex]={...list[editState.candidateIndex],...clean};
    data.candidates[key]=list;saveData();renderMPP();openCandidateList(editState.mppIndex);return;
  }
  if(editState.type==="mp"){
    const arr=editState.mode==="active"?data.mpActive:data.mpOut,schema=editState.mode==="active"?MP_ACTIVE_SCHEMA:MP_OUT_SCHEMA,clean={};schema.forEach(f=>clean[f]=vals[f]||"");
    if(!clean["No."])clean["No."]=String(arr.length+1);
    if(editState.index===null)arr.push(clean);else arr[editState.index]={...arr[editState.index],...clean};
    saveData();renderMP();closeModal();return;
  }
  if(editState.type==="exit"){
    const src=data.mpActive[editState.sourceIndex],clean={};MP_OUT_SCHEMA.forEach(f=>clean[f]=vals[f]||"");
    if(!clean["No."])clean["No."]=String(data.mpOut.length+1);
    data.mpOut.push(clean);vacateMPP(src);data.mpActive.splice(editState.sourceIndex,1);
    saveData();renderMPP();renderMP();closeModal();
  }
}
function excelDate(v){
  if(v instanceof Date&&!isNaN(v)){const d=new Date(v);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
  if(typeof v==="number"&&v>20000&&v<70000){const d=new Date(Date.UTC(1899,11,30)+v*86400000);return d.toISOString().slice(0,10)}
  const s=norm(v);if(!s)return "";return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):s;
}
function syncExcel(input){
  const file=input.files?.[0];if(!file)return;if(!window.XLSX){alert("Modul Excel belum termuat.");return}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:"array",cellDates:true});
      const readMPP=()=>{
        const ws=wb.Sheets["MPP KTA-TRA"];if(!ws)throw new Error("Sheet MPP KTA-TRA tidak ditemukan.");
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true}),out=[],dateIdx=new Set([6,7,8,9,10,11,12,13,14,16]);
        for(let i=1;i<rows.length;i++){const a=rows[i]||[],no=norm(a[0]),name=norm(a[1]);if(!/^\d+(\.0)?$/.test(no)||!name)continue;const o={};MPP_FIELDS.forEach((f,j)=>o[f]=dateIdx.has(j)?excelDate(a[j]):(a[j]??""));out.push(o)}return out;
      };
      const readMP=(sheet,isOut)=>{
        const ws=wb.Sheets[sheet];if(!ws)return[];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true}),schema=isOut?MP_OUT_SCHEMA:MP_ACTIVE_SCHEMA,out=[],dateIdx=new Set([12,15,16,21,42,45,48,51]);if(isOut)dateIdx.add(57);
        for(let i=6;i<rows.length;i++){const a=rows[i]||[],no=norm(a[0]),name=norm(a[4]),job=norm(a[8]),dept=norm(a[9]),site=norm(a[28]);if(!/^\d+(\.0)?$/.test(no)||!/[A-Za-z]/.test(name)||!(job||dept||site))continue;const o={};schema.forEach((f,j)=>o[f]=dateIdx.has(j)?excelDate(a[j]):(a[j]??""));out.push(o)}return out;
      };
      const readUnits=()=>{
        const ws=wb.Sheets["DASHBOARD"];if(!ws)return[];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true}),out=[];
        for(let i=19;i<=31;i++){const a=rows[i]||[],name=norm(a[7]),qty=Number(a[8])||0;if(name)out.push({"Jenis Unit":name,"Jumlah":qty})}return out;
      };
      const mpp=readMPP(),active=readMP("MP Aktif",false),out=readMP("MP Out",true),units=readUnits();
      if(!mpp.length)throw new Error("Data MPP tidak terbaca.");
      data.mpp=mpp;data.mpActive=active;data.mpOut=out;data.units=units;data.sourceFile=file.name;ensureCandidateData(data);
      saveData();renderMPP();renderMP();renderDashboard();alert("Sinkronisasi selesai: "+mpp.length+" planning, "+active.length+" MP Aktif, "+out.length+" MP Out.");
    }catch(err){alert("Sinkronisasi gagal: "+err.message)}
  };
  reader.readAsArrayBuffer(file);input.value="";
}
function csv(rows){if(!rows.length)return "";const heads=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!k.startsWith("__"))))],q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';return "\ufeff"+heads.map(q).join(",")+"\n"+rows.map(r=>heads.map(h=>q(r[h])).join(",")).join("\n")}
function download(content,name,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:type||"text/csv;charset=utf-8"}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
function exportRows(rows,name){download(csv(rows),name)}
function buildDashboardAOA(){
  const m=metrics(),candidateTotal=allCandidateRows().length,aoa=[["MONITORING MANPOWER KTA - TRA"],[],["KONDISI MANPOWER"],["Planning","Actual","Vacant","% Actual","Total Kandidat Vacant"],[m.planning,m.actual,m.vacant,m.pct/100,candidateTotal],[],["STATUS PTK","Jumlah"],["Open",m.open],["Continue",m.cont],["Close",m.close],[],["DUE DATE","Jumlah"],["Hampir Jatuh Tempo",m.near],["Jatuh Tempo",m.overdue],["Selesai",m.done],[],["RESUME UNIT","Jumlah"]];
  data.units.forEach(r=>aoa.push([r["Jenis Unit"],r.Jumlah]));return aoa;
}
function downloadExcel(){
  if(!window.XLSX){alert("Modul Excel belum termuat.");return}
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(buildDashboardAOA()),"DASHBOARD");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.mpp,{header:MPP_FIELDS}),"MPP KTA-TRA");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.mpActive,{header:MP_ACTIVE_SCHEMA}),"MP Aktif");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.mpOut,{header:MP_OUT_SCHEMA}),"MP Out");
  const candRows=allCandidateRows();
  XLSX.utils.book_append_sheet(wb,candRows.length?XLSX.utils.json_to_sheet(candRows):XLSX.utils.aoa_to_sheet([["No MPP","Jabatan","Nama Kandidat","Status Kandidat","Progress Terakhir","Progress %"]]),"KANDIDAT VACANT");
  const deletedRows=(data.deletedMPP||[]).map(x=>({...x.row,"Dihapus Pada":x.deletedAt||"","Jumlah Kandidat":(x.candidates||[]).length}));
  XLSX.utils.book_append_sheet(wb,deletedRows.length?XLSX.utils.json_to_sheet(deletedRows):XLSX.utils.aoa_to_sheet([["Belum ada data terhapus"]]),"MPP TERHAPUS");
  XLSX.writeFile(wb,"Monitoring_Manpower_KTA-TRA_"+todayISO()+".xlsx");
}
function backup(){download(JSON.stringify(data,null,2),"Monitoring_Manpower_KTA-TRA_Backup.json","application/json")}
function importBackup(input){const f=input.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const v=JSON.parse(rd.result);if(!v.mpp)throw new Error();data=v;data.deletedMPP=Array.isArray(data.deletedMPP)?data.deletedMPP:[];data.mpActive=(data.mpActive||[]).map(r=>normalizeMP(r,false));data.mpOut=(data.mpOut||[]).map(r=>normalizeMP(r,true));ensureCandidateData(data);saveData();renderMPP();renderMP();renderDashboard();alert("Backup berhasil dimuat.")}catch(e){alert("Backup tidak valid.")}};rd.readAsText(f);input.value=""}
function resetAll(){if(confirm("Kembalikan ke data awal Monitoring KTA - TRA(7)?")){data=clone(BASE);data.mpActive=data.mpActive.map(r=>normalizeMP(r,false));data.mpOut=data.mpOut.map(r=>normalizeMP(r,true));ensureCandidateData(data);localStorage.removeItem(STORAGE_KEY);saveData();renderMPP();renderMP();renderDashboard()}}
function renderDeletedMPP(){
  const list=data.deletedMPP||[];
  if(!list.length)return '<div class="empty">Belum ada data MPP yang terhapus.</div>';
  return list.map((x,i)=>{
    const r=x.row||{},dt=x.deletedAt?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(x.deletedAt)):"-";
    return '<div class="statusline"><span><b>'+esc(r.Nama||"-")+'</b> • '+esc(r.Jabatan||"-")+' • No. '+esc(r.No||"-")+'<br><small>Dihapus: '+esc(dt)+' • '+((x.candidates||[]).length)+' kandidat</small></span><span><button class="btn yellow" onclick="restoreDeletedMPP('+i+')">Kembalikan</button> <button class="btn danger" onclick="permanentDeleteMPP('+i+')">Hapus Permanen</button></span></div>';
  }).join("");
}
function restoreDeletedMPP(index){
  const item=(data.deletedMPP||[])[index];if(!item||!item.row)return;
  const r=clone(item.row);
  if(data.mpp.some(x=>norm(x.No)===norm(r.No)&&sameName(x.Nama,r.Nama)&&jobKey(x.Jabatan)===jobKey(r.Jabatan))){
    alert("Data yang sama sudah ada di MPP. Pemulihan dibatalkan untuk mencegah duplikasi.");return;
  }
  if(!confirm("Kembalikan data MPP "+(r.Nama||"-")+" — "+(r.Jabatan||"-")+"?"))return;
  data.mpp.push(r);
  data.mpp.sort((a,b)=>(Number(a.No)||9999)-(Number(b.No)||9999));
  if((item.candidates||[]).length){
    data.candidates=data.candidates||{};
    data.candidates[vacancyKey(r)]=clone(item.candidates);
  }
  data.deletedMPP.splice(index,1);
  saveData();renderMPP();renderDashboard();renderSettings();
  alert("Data MPP berhasil dikembalikan.");
}
function permanentDeleteMPP(index){
  const item=(data.deletedMPP||[])[index];if(!item)return;
  if(!confirm("Hapus permanen data ini dari Data Terhapus?\n\nTindakan ini tidak dapat dibatalkan."))return;
  data.deletedMPP.splice(index,1);saveData();renderSettings();
}
function restoreLastDeletedMPP(){
  if(!(data.deletedMPP||[]).length){alert("Tidak ada data MPP yang terhapus.");return}
  restoreDeletedMPP(0);
}
function getEditors(){try{const a=JSON.parse(localStorage.getItem(EDITOR_KEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function addEditor(){let e=prompt("Masukkan email Editor Full Access:");if(!e)return;e=e.trim().toLowerCase();if(!e.includes("@")){alert("Email tidak valid.");return}const a=getEditors();if(e===OWNER_EMAIL||a.includes(e)){alert("Email sudah terdaftar.");return}a.push(e);localStorage.setItem(EDITOR_KEY,JSON.stringify(a));renderSettings()}
function removeEditor(i){const a=getEditors();if(!a[i])return;if(!confirm("Hapus Editor "+a[i]+"?"))return;a.splice(i,1);localStorage.setItem(EDITOR_KEY,JSON.stringify(a));renderSettings()}
function renderSettings(){
  const editors=getEditors(),host=document.getElementById("settingsContent");if(!host)return;
  host.innerHTML='<div class="grid2"><div class="card"><div class="section-head"><h3>Pemilik & Akses</h3></div><div class="statusline"><span>Pemilik / Administrator</span><b>'+esc(OWNER_EMAIL)+'</b></div><div class="statusline"><span>Sistem</span><b>Monitoring Manpower KTA - TRA</b></div><div class="statusline"><span>Hak Editor</span><b>Sama dengan Pemilik (Full Access)</b></div><div class="statusline"><span>Sumber terakhir</span><b>'+esc(data.sourceFile||"-")+'</b></div></div><div class="card"><div class="section-head"><h3>Editor</h3><button class="btn yellow" onclick="addEditor()">+ Tambah Editor</button></div>'+(editors.length?editors.map((e,i)=>'<div class="statusline"><span>'+esc(e)+'</span><span><b>FULL ACCESS</b> <button class="btn danger" onclick="removeEditor('+i+')">Hapus</button></span></div>').join(""):'<div class="empty">Belum ada editor Full Access.</div>')+'</div></div><div style="height:16px"></div><div class="grid2"><div class="card"><div class="section-head"><h3>Sinkron & Download Excel</h3></div><p class="settings-copy">Sinkronkan dari file Monitoring KTA - TRA terbaru atau download kondisi web saat ini menjadi Excel.</p><div class="toolbar"><label class="btn yellow">Sinkronkan Excel<input type="file" accept=".xlsx,.xls" hidden onchange="syncExcel(this)"></label><button class="btn primary" onclick="downloadExcel()">Download Excel</button></div></div><div class="card"><div class="section-head"><h3>Backup</h3></div><div class="toolbar"><button class="btn" onclick="backup()">Download Backup JSON</button><label class="btn">Import Backup<input type="file" accept=".json" hidden onchange="importBackup(this)"></label><button class="btn danger" onclick="resetAll()">Reset Data Awal</button></div></div></div><div style="height:16px"></div><div class="card"><div class="section-head"><div><h3>Data MPP Terhapus</h3><p class="section-sub">Salah hapus dapat dikembalikan tanpa sinkron ulang Excel.</p></div><span class="pill">'+((data.deletedMPP||[]).length)+' data</span></div><div class="toolbar" style="margin-bottom:8px"><button class="btn yellow" onclick="restoreLastDeletedMPP()">Kembalikan Terakhir Dihapus</button></div>'+renderDeletedMPP()+'</div>';
}
function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.getElementById(name)?.classList.add("active");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===name));
  document.getElementById("topTitle").textContent=document.querySelector('.nav[data-view="'+name+'"]')?.dataset.title||"Monitoring Manpower KTA - TRA";
  document.getElementById("sidebar").classList.remove("open");window.scrollTo(0,0);
  if(name==="mpp")renderMPP();if(name==="mp")renderMP();if(name==="settings")renderSettings();
}
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("today").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  renderDashboard();renderMPP();renderMP();renderSettings();
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>showView(n.dataset.view));
  document.querySelectorAll(".mp-tab").forEach(b=>b.onclick=()=>setMPMode(b.dataset.mode));
  document.getElementById("menuBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("mppSearch").oninput=renderMPP;document.getElementById("mppStatus").onchange=renderMPP;document.getElementById("addMPP").onclick=()=>openMPPForm(null);document.getElementById("exportMPP").onclick=()=>exportRows(data.mpp,"MPP_KTA-TRA.csv");
  document.getElementById("mpSearch").oninput=renderMP;document.getElementById("mpFullBtn").onclick=toggleMPFull;document.getElementById("addMP").onclick=()=>openMPForm(mpMode,null);document.getElementById("exportMP").onclick=()=>exportRows(mpMode==="active"?data.mpActive:data.mpOut,mpMode==="active"?"MP_Aktif_KTA-TRA.csv":"MP_Out_KTA-TRA.csv");
  document.getElementById("closeModal").onclick=closeModal;document.getElementById("saveModal").onclick=saveModal;
  showView("dashboard");
});