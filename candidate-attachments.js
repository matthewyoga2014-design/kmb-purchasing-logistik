/* Protected recruitment attachment controls for KMB monitoring apps */
(function(){
"use strict";
const path=location.pathname;
const appId=path.includes("monitoring-kta-tra")?"kta-tra":path.includes("monitoring-bupr-ampah")?"bupr-ampah":path.includes("monitoring-mbj")?"mbj":"kmb";
const stages=["Sumber","Psikologi Test","Interview User","Offering Latter","MCU","FU MCU","On Site","Induksi"];
let client=null,cacheKey="",busy=false;
function clientForApp(){
  if(!client&&window.supabase?.createClient&&window.KMB_SUPABASE_CONFIG){
    const c=window.KMB_SUPABASE_CONFIG;
    client=window.supabase.createClient(c.url,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  return client;
}
function ctx(){
  try{
    if(typeof editState==="undefined"||editState?.type!=="candidate"||typeof data==="undefined")return null;
    let vacancyKey,candidate;
    if(appId==="kmb"){
      const r=data.sites?.[editState.siteKey]?.[editState.rowIndex];if(!r)return null;
      vacancyKey=kmbCandidateKey(editState.siteKey,r);
      candidate=editState.candidateIndex==null?null:getKmbCandidates(editState.siteKey,r)[editState.candidateIndex];
    }else{
      const r=data.mpp?.[editState.mppIndex];if(!r)return null;
      vacancyKey="MPP-"+String(r.No||"").trim();
      candidate=editState.candidateIndex==null?null:getCandidates(r)[editState.candidateIndex];
    }
    return {vacancyKey,name:String(candidate?.["Nama Kandidat"]||document.querySelector('[data-f="Nama Kandidat"]')?.value||"").trim(),existing:editState.candidateIndex!==null};
  }catch(e){console.error(e);return null}
}
const css=document.createElement("style");css.textContent=`
.kmb-attach{margin-top:7px;padding:9px;border-radius:9px;background:#f5f3ff;border:1px solid #e5defa;font-size:11px}
.kmb-attach-bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.kmb-attach-btn{border:1px solid #c7b5f0;border-radius:7px;padding:6px 9px;background:#fff;color:#6d28d9;font-size:11px;font-weight:700;cursor:pointer}
.kmb-attach-files{margin-top:7px;display:flex;gap:6px;flex-wrap:wrap}
.kmb-file{display:flex;align-items:center;gap:5px;background:white;padding:4px 7px;border:1px solid #ded6f7;border-radius:7px}
.kmb-file a{color:#5b21b6;text-decoration:underline;cursor:pointer}
.kmb-file button{border:0;background:#fee2e2;border-radius:5px;color:#b91c1c;cursor:pointer}
.kmb-attach-hint{color:#7c7292;font-size:10px}
`;document.head.appendChild(css);
function isStaff(){return ["owner","editor"].includes(window.accessMode?.())}
async function renderAttachments(scope,stage,host){
 const sb=clientForApp();if(!sb)return;
 const {data:sessionData}=await sb.auth.getSession();if(!sessionData?.session)return;
 const {data:files,error}=await sb.from("candidate_attachments").select("id,filename,object_path,created_at").eq("app_id",appId).eq("vacancy_key",scope.vacancyKey).eq("candidate_name",scope.name).eq("stage",stage).order("created_at",{ascending:false});
 if(!host.isConnected)return;
 if(error){host.textContent="Lampiran belum dapat dimuat: "+error.message;return}
 host.replaceChildren();
 for(const item of files||[]){
   const el=document.createElement("span");el.className="kmb-file";
   const a=document.createElement("a");a.textContent="📎 "+item.filename;a.title="Lihat / unduh lampiran";
   a.onclick=async()=>{
     const {data,error}=await sb.storage.from("kmb-candidate-docs").createSignedUrl(item.object_path,90);
     if(error){alert("Tidak dapat membuka: "+error.message);return}
     window.open(data.signedUrl,"_blank","noopener,noreferrer");
   };el.append(a);
   if(isStaff()){
    const del=document.createElement("button");del.textContent="✕";del.title="Hapus lampiran";
    del.onclick=async()=>{
      if(!confirm("Hapus lampiran "+item.filename+"?"))return;
      del.disabled=true;
      const rm=await sb.storage.from("kmb-candidate-docs").remove([item.object_path]);
      if(rm.error){alert("Gagal hapus file: "+rm.error.message);del.disabled=false;return}
      const out=await sb.from("candidate_attachments").delete().eq("id",item.id);
      if(out.error){alert("Berkas terhapus, tetapi metadata gagal dihapus: "+out.error.message);return}
      await renderAttachments(scope,stage,host);
    };el.append(del);
   }
   host.append(el);
 }
 if(!files?.length)host.textContent="Belum ada lampiran";
}
function mount(){
 const form=document.getElementById("formFields"),scope=ctx();
 if(!form||!scope)return;
 const key=JSON.stringify([scope.vacancyKey,scope.name,scope.existing]);
 if(cacheKey!==key){cacheKey=key;form.querySelectorAll(".kmb-attach").forEach(n=>n.remove())}
 for(const stage of stages){
   const input=Array.from(form.querySelectorAll("[data-f]")).find(el=>el.dataset.f===stage);
   if(!input||input.parentElement.querySelector(".kmb-attach"))continue;
   const widget=document.createElement("div");widget.className="kmb-attach";
   const bar=document.createElement("div");bar.className="kmb-attach-bar";
   const label=document.createElement("span");label.textContent="📎 Bukti / dokumen";bar.append(label);
   const btn=document.createElement("button");btn.type="button";btn.className="kmb-attach-btn";btn.textContent="+ Upload";
   const file=document.createElement("input");file.type="file";file.accept=".pdf,.jpg,.jpeg,.png,.webp";file.hidden=true;
   if(!scope.existing){btn.disabled=true;btn.title="Simpan pelamar terlebih dahulu"}
   if(!isStaff()){btn.hidden=true}
   btn.onclick=()=>file.click();
   const host=document.createElement("div");host.className="kmb-attach-files";
   const hint=document.createElement("span");hint.className="kmb-attach-hint";hint.textContent=scope.existing?"PDF/JPG/PNG/WEBP, maksimal 10 MB":"Simpan pelamar dulu agar lampiran terhubung dengan benar";
   file.onchange=async()=>{
     const f=file.files?.[0];file.value="";if(!f||busy)return;
     if(f.size>10485760){alert("Ukuran maksimal 10 MB");return}
     if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(f.type)){alert("Hanya PDF, JPG, PNG atau WEBP");return}
     const sb=clientForApp();if(!sb||!isStaff())return;
     busy=true;btn.disabled=true;btn.textContent="Mengunggah...";
     try{
       const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,"_");
       const id=crypto.randomUUID();
       const objectPath=[appId,id+"_"+safe].join("/");
       const up=await sb.storage.from("kmb-candidate-docs").upload(objectPath,f,{upsert:false,contentType:f.type});
       if(up.error)throw up.error;
       const add=await sb.from("candidate_attachments").insert({app_id:appId,vacancy_key:scope.vacancyKey,candidate_name:scope.name,stage,object_path:objectPath,filename:f.name});
       if(add.error){await sb.storage.from("kmb-candidate-docs").remove([objectPath]);throw add.error}
       await renderAttachments(scope,stage,host);
     }catch(e){alert("Upload gagal: "+(e.message||e))}
     finally{busy=false;btn.disabled=false;btn.textContent="+ Upload"}
   };
   bar.append(btn,file,hint);widget.append(bar,host);input.parentElement.append(widget);
   if(scope.existing)renderAttachments(scope,stage,host);else host.textContent="Belum ada lampiran";
 }
}
window.KMBDeleteCandidateAttachments=async function(targetApp,vacancy,candidateName){
 if(targetApp!==appId)return {ok:false,error:"Aplikasi tidak cocok"};
 const sb=clientForApp();if(!sb)return {ok:false,error:"Koneksi dokumen tidak tersedia"};
 const query=await sb.from("candidate_attachments").select("id,object_path").eq("app_id",appId).eq("vacancy_key",vacancy).eq("candidate_name",candidateName);
 if(query.error)return {ok:false,error:query.error.message};
 const files=query.data||[];
 if(!files.length)return {ok:true,count:0};
 const paths=files.map(x=>x.object_path).filter(Boolean);
 if(paths.length){const removed=await sb.storage.from("kmb-candidate-docs").remove(paths);if(removed.error)return {ok:false,error:removed.error.message}}
 const deleted=await sb.from("candidate_attachments").delete().eq("app_id",appId).eq("vacancy_key",vacancy).eq("candidate_name",candidateName);
 if(deleted.error)return {ok:false,error:deleted.error.message};
 return {ok:true,count:files.length};
};
document.addEventListener("DOMContentLoaded",()=>{
 let queued=false;
 const observer=new MutationObserver(()=>{
   if(queued)return;queued=true;
   requestAnimationFrame(()=>{queued=false;mount()});
 });
 observer.observe(document.getElementById("modal")||document.body,{subtree:true,childList:true});
 mount();
});
})();