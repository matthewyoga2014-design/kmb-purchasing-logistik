/* MPP hierarchy assistant: Section Job -> Job, persistent values in MPP fields */
(function(){
"use strict";
const defaults={"Penanggung Jawab Operasional":["Manajemen Operasional"],"Planner Section":["Planning","Administrasi Plant"],"Tyre Section":["Tyre Inspector","Tyre Repair","Tyre Storing"],"Maintenance Section":["Welder","Mekanik","Helper Mekanik"]};
function setup(){
 const form=document.getElementById("formFields");
 if(!form||!form.querySelector('[data-f="Section Job"]')||!form.querySelector('[data-f="Job"]')||!form.querySelector('[data-f="Jabatan"]'))return;
 const section=form.querySelector('[data-f="Section Job"]'),job=form.querySelector('[data-f="Job"]');
 if(section.dataset.hierarchyReady)return;
 section.dataset.hierarchyReady="1";
 const help=document.createElement("small");help.style.cssText="display:block;color:#64748b;margin:4px 0";help.textContent="Section Job = bagian utama organisasi. Job = kelompok pekerjaan di dalam section.";
 section.parentElement.append(help);
 const listId="kmb-sections-"+Math.random().toString(36).slice(2);
 const dl=document.createElement("datalist");dl.id=listId;Object.keys(defaults).forEach(x=>{const o=document.createElement("option");o.value=x;dl.append(o)});section.setAttribute("list",listId);section.after(dl);
 const jobsId="kmb-jobs-"+Math.random().toString(36).slice(2);
 const jl=document.createElement("datalist");jl.id=jobsId;job.setAttribute("list",jobsId);job.after(jl);
 function update(){const options=defaults[section.value.trim()]||[];jl.replaceChildren();options.forEach(x=>{const o=document.createElement("option");o.value=x;jl.append(o)})}
 const subInput=form.querySelector('[data-f="Sub Section Job"]');
 if(subInput){
   const selector=document.createElement("select");
   selector.setAttribute("data-f","Sub Section Job");
   selector.className=subInput.className;
   selector.style.cssText=subInput.style.cssText;
   const saved=subInput.value.trim();
   subInput.replaceWith(selector);
   const predefined={
     "Penanggung Jawab Operasional":{"Manajemen Operasional":["Pimpinan Operasional","Department Head","Section Head"]},
     "Planner Section":{"Planning":["Planner","Planning & Control"],"Administrasi Plant":["Plant Admin","Administrasi & Pelaporan"]},
     "Maintenance Section":{"Welder":["Crew Welder","Helper Welder"],"Mekanik":["Unscheduled MTC","Scheduled MTC","Crew Electric","Helper Unscheduled Repair","Helper Scheduled Repair"],"Helper Mekanik":["Helper Unscheduled Repair","Helper Scheduled Repair"]},
     "Tyre Section":{"Tyre Inspector":["Tyre Inspector"],"Tyre Repair":["Tyre Repair","Helper Tyre Repair"],"Tyre Storing":["Tyre Storing"]}
   };
   function refreshSub(){
     const sectionName=section.value.trim(),jobName=job.value.trim();
     const current=selector.value||(!selector.dataset.initialized?saved:"");
     const map=predefined[sectionName]||{};
     let options=[...(map[jobName]||[])];
     if(!options.length && jobName)options=[jobName];
     const prior=Array.from(document.querySelectorAll('[data-f="Sub Section Job"]')).filter(x=>x!==selector).map(x=>x.value).filter(Boolean);
     options=[...new Set([...options,...prior])];
     if(current&&!options.includes(current))options.unshift(current);
     selector.replaceChildren(new Option("— Pilih Sub Section Job —",""),...options.map(x=>new Option(x,x)));
     selector.value=options.includes(current)?current:"";selector.dataset.initialized="1";
   }
   section.addEventListener("input",refreshSub);
   section.addEventListener("change",refreshSub);
   job.addEventListener("input",refreshSub);
   job.addEventListener("change",refreshSub);
   refreshSub();
 }
 section.addEventListener("input",update);update();
}
document.addEventListener("DOMContentLoaded",()=>{let p=false;new MutationObserver(()=>{if(p)return;p=true;requestAnimationFrame(()=>{p=false;setup()})}).observe(document.getElementById("modal")||document.body,{childList:true,subtree:true});setup()});
})();