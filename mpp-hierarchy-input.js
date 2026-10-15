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
 section.addEventListener("input",update);update();
}
document.addEventListener("DOMContentLoaded",()=>{let p=false;new MutationObserver(()=>{if(p)return;p=true;requestAnimationFrame(()=>{p=false;setup()})}).observe(document.getElementById("modal")||document.body,{childList:true,subtree:true});setup()});
})();