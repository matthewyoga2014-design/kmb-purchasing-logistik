(function(){
"use strict";
const txt=v=>String(v??"").trim();
const esc=v=>txt(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const empty=v=>!txt(v)||/^vacant$/i.test(txt(v));
const layout=[
 {name:"MAINTENANCE SECTION",teams:["UNSCHEDULE MTC","SCHEDULE MTC","CREW ELECTRIC","CREW WELDER","HELPER UNSCHEDULE REPAIR","HELPER SCHEDULE REPAIR","HELPER WELDER"]},
 {name:"PLANNER SECTION",teams:["PLANNER","PLANT ADMIN"]},
 {name:"TYRE SECTION",teams:["TYRE INSPECTOR","TYRE REPAIR","TYRE STORING"]}
];
function section(r){
 const s=txt(r["Section Job"]).toLowerCase(),j=txt(r.Jabatan).toLowerCase();
 if(/maintenance|mtc|mechanic|mekanik/.test(s))return "MAINTENANCE SECTION";
 if(/planner|planning|admin/.test(s))return "PLANNER SECTION";
 if(/tyre|tire/.test(s))return "TYRE SECTION";
 if(s)return txt(r["Section Job"]).toUpperCase();
 if(/tyre|tire/.test(j))return "TYRE SECTION";
 if(/planner|admin/.test(j))return "PLANNER SECTION";
 if(/mekanik|mechanic|welder|electric|helper/.test(j))return "MAINTENANCE SECTION";
 return "BELUM DITENTUKAN";
}
function team(r,s){
 const role=txt(r.Jabatan).toLowerCase();
 const job=txt(r.Job).toUpperCase(),sub=txt(r["Sub Section Job"]).toUpperCase();
 let raw=sub||job;
 if(raw && !/^(MAINTENANCE|PLANNER|TYRE) SECTION$/.test(raw))return raw;
 if(s==="PLANNER SECTION")return /admin/.test(role)?"PLANT ADMIN":"PLANNER";
 if(s==="TYRE SECTION")return /inspect|senior/.test(role)?"TYRE INSPECTOR":/stor|spor/.test(role)?"TYRE STORING":"TYRE REPAIR";
 if(/welder/.test(role))return /helper/.test(role)?"HELPER WELDER":"CREW WELDER";
 if(/electric/.test(role))return "CREW ELECTRIC";
 return "BELUM DITENTUKAN";
}
function normalizeTeam(name){
 const t=txt(name).toUpperCase();
 if(/UNSCHED/.test(t))return /HELPER/.test(t)?"HELPER UNSCHEDULE REPAIR":"UNSCHEDULE MTC";
 if(/SCHED/.test(t))return /HELPER/.test(t)?"HELPER SCHEDULE REPAIR":"SCHEDULE MTC";
 if(/WELDER/.test(t))return /HELPER/.test(t)?"HELPER WELDER":"CREW WELDER";
 if(/ELECTRIC/.test(t))return "CREW ELECTRIC";
 if(/TYRE.*INSPECT/.test(t))return "TYRE INSPECTOR";
 if(/TYRE.*REPAIR/.test(t))return "TYRE REPAIR";
 if(/TYRE.*STOR|TYRE.*SPOR/.test(t))return "TYRE STORING";
 return t;
}
function member(r){
 return '<div class="org-person"><span class="org-name'+(empty(r.Nama)?' org-vacant':'')+'">'+esc(empty(r.Nama)?"VACANT":r.Nama)+'</span><span class="org-role">'+esc(r.Jabatan||"-")+'</span></div>';
}
function card(label,rows){
 return '<div class="org-team"><div class="org-title">'+esc(label)+'</div><div class="org-people">'+rows.map(member).join("")+'</div></div>';
}
function render(){
 const host=document.getElementById("soContent");
 if(!host)return;
 if(typeof data==="undefined"||!Array.isArray(data.mpp)){host.textContent="MPP belum dimuat.";return;}
 const leader=[], groups=new Map();
 data.mpp.forEach(r=>{
  if(/^(dept|department)\s*head|^section\s*head/i.test(txt(r.Jabatan))){leader.push(r);return}
  const s=section(r),t=normalizeTeam(team(r,s));
  if(!groups.has(s))groups.set(s,new Map());
  if(!groups.get(s).has(t))groups.get(s).set(t,[]);
  groups.get(s).get(t).push(r);
 });
 leader.sort((a,b)=>/dept|department/i.test(a.Jabatan)?-1:/dept|department/i.test(b.Jabatan)?1:0);
 const branch=(name)=>{
  const teams=groups.get(name)||new Map();
  if(!teams.size)return '<div class="org-branch"><div class="org-title org-branch-title">'+esc(name)+'</div><div class="org-subteams">'+card("BELUM ADA PENEMPATAN",[])+'</div></div>';
  const standard=layout.find(x=>x.name===name)?.teams||[];
  const ordered=[...standard.filter(x=>teams.has(x)),...teams.keys()].filter((x,i,a)=>a.indexOf(x)===i);
  const primary=ordered.filter(x=>!x.startsWith("HELPER "));
  const helpers=ordered.filter(x=>x.startsWith("HELPER "));
  return '<div class="org-branch"><div class="org-title org-branch-title">'+esc(name)+'</div><div class="org-subteams">'+primary.map(t=>'<div class="org-subcol">'+card(t,teams.get(t))+(helpers.filter(h=>h.includes(t.replace(" MTC","").replace("CREW ","").split(" ")[0])).map(h=>'<div class="org-child">'+card(h,teams.get(h))+'</div>').join(""))+'</div>').join("")+helpers.filter(h=>!primary.some(t=>h.includes(t.replace(" MTC","").replace("CREW ","").split(" ")[0]))).map(h=>'<div class="org-subcol">'+card(h,teams.get(h))+'</div>').join("")+'</div></div>';
 };
 const ordered=[...layout.map(x=>x.name),...groups.keys()].filter((x,i,a)=>a.indexOf(x)===i);
 host.innerHTML='<div class="org-diagram"><div class="org-top">'+card("PENANGGUNG JAWAB OPERASIONAL",leader)+'</div><div class="org-stem"></div><div class="org-branches">'+ordered.map(branch).join("")+'</div></div><p class="org-explain">Bagan mengikuti data MPP website: kolom kiri nama, kolom kanan jabatan. Section Job → Job → Sub Section Job menentukan posisi. Posisi yang belum ditentukan tetap ditampilkan agar tidak ada nama hilang. Pengaturan pelamar tidak diubah.</p>';
}
window.renderKtaSO=render;
document.addEventListener("DOMContentLoaded",render);
})();