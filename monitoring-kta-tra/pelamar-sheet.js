(function(){
 "use strict";
 const root=document.getElementById("pelamarContent");
 if(!root)return;
 function safe(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 function state(){try{return typeof data!=="undefined"&&data&&Array.isArray(data.mpp)?data:null}catch(e){return null}}
 function statusOf(candidate){
   const value=String(candidate["Status Kandidat"]||"Aktif").trim();
   return {raw:value,active:value.toLowerCase()==="aktif"};
 }
 function render(){
   const d=state(),search=document.getElementById("pelamarSearch"),filter=document.getElementById("pelamarStatus");
   if(!d){root.textContent="Data belum siap dimuat.";return}
   const rows=[];
   d.mpp.forEach((position,mi)=>{
     const list=typeof getCandidates==="function"?getCandidates(position):d.candidates?.["MPP-"+position.No]||[];
     list.forEach((candidate,ci)=>rows.push({position,mi,candidate,ci,status:statusOf(candidate)}));
   });
   const active=rows.filter(x=>x.status.active).length,inactive=rows.length-active;
   document.getElementById("pelamarCounts").textContent="Total "+rows.length+" pelamar  •  Aktif "+active+"  •  Tidak Aktif "+inactive;
   const q=(search?.value||"").trim().toLowerCase(),type=filter?.value||"all";
   const shown=rows.filter(x=>(type==="all"||(type==="active"&&x.status.active)||(type==="inactive"&&!x.status.active))&&(!q||[x.candidate["Nama Kandidat"],x.position.Jabatan,x.candidate.Sumber,x.status.raw].join(" ").toLowerCase().includes(q)));
   root.innerHTML=shown.length?'<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama Pelamar</th><th>Jabatan Dilamar</th><th>Status</th><th>Sumber</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>'+shown.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+safe(x.candidate["Nama Kandidat"]||"-")+'</td><td>'+safe(x.position.Jabatan||"-")+'</td><td><span style="font-weight:700;color:'+(x.status.active?'#15803d':'#b91c1c')+'">'+safe(x.status.raw||"Aktif")+'</span></td><td>'+safe(x.candidate.Sumber||"-")+'</td><td>'+safe(x.candidate.Keterangan||"-")+'</td><td class="action-cell"><button class="btn" data-candidate-edit="'+x.mi+':'+x.ci+'">Edit</button> <button class="btn danger" data-candidate-delete="'+x.mi+':'+x.ci+'">Hapus</button></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">Belum ada pelamar yang sesuai filter.</div>';
 }
 root.addEventListener("click",event=>{
   const edit=event.target.closest("[data-candidate-edit]"),del=event.target.closest("[data-candidate-delete]");
   if(!edit&&!del)return;
   const values=(edit||del).getAttribute(edit?"data-candidate-edit":"data-candidate-delete").split(":").map(Number);
   if(edit)openCandidateForm(values[0],values[1]);
   else deleteCandidate(values[0],values[1]);
 });
 document.getElementById("pelamarSearch")?.addEventListener("input",render);
 document.getElementById("pelamarStatus")?.addEventListener("change",render);
 document.querySelector('[data-view="pelamar"]')?.addEventListener("click",()=>setTimeout(render,0));
 document.addEventListener("click",e=>{if(e.target.closest("#saveModal, .candidate-actions, #closeModal"))setTimeout(render,700)});
 window.refreshPelamarSheet=render;
 render();
})();
