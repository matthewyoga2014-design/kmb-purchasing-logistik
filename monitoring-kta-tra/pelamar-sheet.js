(function(){
"use strict";
const root=document.getElementById("pelamarContent");
if(!root)return;
const stages=["Tanggal Lamaran","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi"];
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;":"&#39;"}[c]));
function current(){try{return typeof data!=="undefined"&&Array.isArray(data.mpp)?data:null}catch(e){return null}}
function active(c){return String(c["Status Kandidat"]||"Aktif").trim().toLowerCase()==="aktif"}
function records(){
 const d=current(),rows=[];
 if(!d)return rows;
 d.mpp.forEach((position,mi)=>{
   const list=typeof getCandidates==="function"?getCandidates(position):d.candidates?.["MPP-"+position.No]||[];
   list.forEach((candidate,ci)=>rows.push({position,mi,candidate,ci}));
 });
 return rows;
}
function render(){
 const d=current();if(!d){root.textContent="Data pelamar belum dimuat.";return}
 const rows=records(),activeCount=rows.filter(x=>active(x.candidate)).length;
 const summary=document.getElementById("pelamarCounts");
 if(summary)summary.textContent="Total "+rows.length+" pelamar • Aktif "+activeCount+" • Tidak Aktif "+(rows.length-activeCount);
 const selector=document.getElementById("pelamarVacancy");
 if(selector){
   const selected=selector.value;
   selector.innerHTML='<option value="">Pilih jabatan vacant untuk tambah pelamar</option>'+d.mpp.map((r,i)=>({r,i})).filter(x=>typeof isVacant==="function"&&isVacant(x.r.Nama)).map(x=>'<option value="'+x.i+'">MPP #'+esc(x.r.No)+' — '+esc(x.r.Jabatan)+'</option>').join("");
   if([...selector.options].some(o=>o.value===selected))selector.value=selected;
 }
 const search=(document.getElementById("pelamarSearch")?.value||"").trim().toLowerCase(),filter=document.getElementById("pelamarStatus")?.value||"all";
 const shown=rows.filter(x=>(filter==="all"||(filter==="active"&&active(x.candidate))||(filter==="inactive"&&!active(x.candidate)))&&(!search||[x.candidate["Nama Kandidat"],x.position.Jabatan,x.candidate.Sumber,x.candidate.Keterangan,x.candidate["Status Kandidat"]].join(" ").toLowerCase().includes(search)));
 const headers=["No","Nama Kandidat","Jabatan","Status","Sumber",...stages,"Keterangan","Dokumen Upload","Aksi"];
 root.innerHTML=shown.length?'<div class="table-wrap"><table class="table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+shown.map((x,i)=>{
 const c=x.candidate,status=c["Status Kandidat"]||"Aktif";
 const values=[i+1,c["Nama Kandidat"]||"-",x.position.Jabatan||"-",status,c.Sumber||"-",...stages.map(k=>c[k]||"-"),c.Keterangan||"-"];
 return '<tr>'+values.map((v,j)=>'<td'+(j===3?' style="font-weight:700;color:'+(active(c)?"#15803d":"#b91c1c")+'"':'')+'>'+esc(v)+'</td>').join("")+'<td><button class="btn" data-upload="'+x.mi+':'+x.ci+'">📤 Upload</button> <button class="btn" data-docs="'+x.mi+':'+x.ci+'">📎 Lihat File</button></td><td class="action-cell"><button class="btn" data-edit="'+x.mi+':'+x.ci+'">Edit</button> <button class="btn danger" data-delete="'+x.mi+':'+x.ci+'">Hapus</button></td></tr>';
 }).join("")+'</tbody></table></div>':'<div class="empty">Belum ada pelamar sesuai filter.</div>';
}
root.addEventListener("click",event=>{
 const edit=event.target.closest("[data-edit]"),del=event.target.closest("[data-delete]"),docs=event.target.closest("[data-docs]"),upload=event.target.closest("[data-upload]");
 if(!edit&&!del&&!docs&&!upload)return;
 const btn=edit||del||docs||upload;
 const indexes=btn.getAttribute(edit?"data-edit":del?"data-delete":upload?"data-upload":"data-docs").split(":").map(Number);
 if(edit){openCandidateForm(indexes[0],indexes[1]);return}
 if(del){deleteCandidate(indexes[0],indexes[1]);return}
 if(upload){
   if(!window.KMBCloud?.canEdit?.()){alert("Masuk sebagai Pemilik atau Editor untuk upload dokumen.");return}
   const position=current()?.mpp?.[indexes[0]],candidate=position&&getCandidates(position)[indexes[1]];
   if(!candidate)return;
   const options=["Berkas Lamaran / CV","Hasil Psikologi Test","Hasil Interview User","Offering Letter (dokumen)","Hasil MCU"];
   const overlay=document.createElement("div");overlay.className="pelamar-docs-overlay";
   const panel=document.createElement("div");panel.className="pelamar-docs-panel";
   const title=document.createElement("h3");title.textContent="Upload Dokumen — "+candidate["Nama Kandidat"];panel.append(title);
   const select=document.createElement("select");select.className="select";options.forEach(stage=>{const o=document.createElement("option");o.value=stage;o.textContent=stage;select.append(o)});panel.append(select);
   const fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".pdf,.jpg,.jpeg,.png";panel.append(fileInput);
   const note=document.createElement("p");note.textContent="PDF / JPG / PNG, maksimal 20 MB. File otomatis terhubung ke data kandidat di MPP.";panel.append(note);
   const save=document.createElement("button");save.className="btn";save.textContent="Upload File";
   save.onclick=async()=>{
     const file=fileInput.files?.[0];if(!file){alert("Pilih file terlebih dahulu.");return}
     save.disabled=true;save.textContent="Mengunggah...";
     try{
       await window.KMBUploadCandidateAttachment("kta-tra","MPP-"+String(position.No).trim(),String(candidate["Nama Kandidat"]||"").trim(),select.value,file);
       overlay.remove();alert("Dokumen berhasil di-upload dan terhubung ke Data Pelamar.");
     }catch(e){alert("Upload gagal: "+(e.message||e));save.disabled=false;save.textContent="Upload File"}
   };
   panel.append(save);
   const close=document.createElement("button");close.className="btn";close.textContent="Batal";close.onclick=()=>overlay.remove();panel.append(close);
   overlay.append(panel);overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};document.body.append(overlay);
   return;
 }
 const d=current(),position=d?.mpp?.[indexes[0]],candidate=position&&getCandidates(position)[indexes[1]];
 if(!candidate)return;
 btn.disabled=true;btn.textContent="Memuat...";
 try{
   const files=await window.KMBListCandidateAttachments("kta-tra","MPP-"+String(position.No).trim(),String(candidate["Nama Kandidat"]||"").trim());
   if(!files.length){alert("Belum ada dokumen yang di-upload untuk pelamar ini.");return}
   const overlay=document.createElement("div");overlay.className="pelamar-docs-overlay";
   const panel=document.createElement("div");panel.className="pelamar-docs-panel";
   const heading=document.createElement("h3");heading.textContent="Dokumen Pelamar — "+(candidate["Nama Kandidat"]||"-");panel.append(heading);
   const notice=document.createElement("p");notice.textContent="Dokumen yang diunggah melalui form Edit Pelamar di MPP.";panel.append(notice);
   files.forEach(file=>{
     const link=document.createElement("button");link.type="button";link.className="btn";link.textContent="📎 "+file.filename+" • "+file.stage;
     link.addEventListener("click",async()=>{try{await window.KMBOpenCandidateAttachment(file.object_path)}catch(e){alert("Gagal membuka dokumen: "+(e.message||e))}});
     panel.append(link);
   });
   const close=document.createElement("button");close.className="btn";close.textContent="Tutup";close.onclick=()=>overlay.remove();panel.append(close);
   overlay.append(panel);overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};document.body.append(overlay);
 }catch(error){alert("Gagal membaca dokumen pelamar: "+(error.message||error))}
 finally{btn.disabled=false;btn.textContent="📎 Lihat File"}
});
document.getElementById("pelamarSearch")?.addEventListener("input",render);
document.getElementById("pelamarStatus")?.addEventListener("change",render);
document.getElementById("pelamarAdd")?.addEventListener("click",()=>{
 const selected=document.getElementById("pelamarVacancy")?.value;
 if(selected===""){alert("Pilih jabatan vacant terlebih dahulu.");return}
 openCandidateForm(Number(selected),null);
});
document.querySelector('[data-view="pelamar"]')?.addEventListener("click",()=>setTimeout(render,0));
document.addEventListener("click",e=>{if(e.target.closest("#saveModal,#closeModal,.candidate-actions"))setTimeout(render,800)});
window.refreshPelamarSheet=render;
render();
})();