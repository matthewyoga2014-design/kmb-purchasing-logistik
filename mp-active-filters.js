/* MP Active filters and precise Sisa Hari warning colors */
(function(){
"use strict";
const css=document.createElement("style");css.textContent=`
.mp-smart-filters{display:flex;align-items:end;flex-wrap:wrap;gap:9px;padding:12px;background:#f8f9ff;border:1px solid #e2e7f1;border-radius:12px;margin:12px 0}
.mp-smart-filters label{font-size:11px;color:#53627d;display:flex;flex-direction:column;gap:4px}
.mp-smart-filters select{border:1px solid #d6dbe8;border-radius:8px;padding:8px;min-width:135px;max-width:210px;background:#fff;color:#25344f;font-size:12px}
.mp-smart-filters button{border:1px solid #d6dbe8;background:white;border-radius:8px;padding:8px 12px;cursor:pointer;color:#5b21b6;font-weight:650}
.mp-due-red{background:#fee2e2!important;color:#991b1b!important;font-weight:800!important;border-radius:7px}
.mp-due-yellow{background:#fef3c7!important;color:#92400e!important;font-weight:800!important;border-radius:7px}
`;document.head.append(css);
const filterKeys=["Jabatan","Departemen","SITE","STATUS"];
const state={};let lock=false;
function run(){
 if(lock)return;lock=true;
 try{
 const view=document.getElementById("mp"),root=document.getElementById("mpTable");
 if(!view||!root)return;
 const table=root.querySelector("table");if(!table)return;
 const heads=[...table.querySelectorAll("thead th")].map(x=>x.textContent.trim());
 const rows=[...table.querySelectorAll("tbody tr")].filter(tr=>tr.cells.length>=heads.length-1&&!tr.classList.contains("mp-group-row"));
 const active=(()=>{try{return typeof mpMode!=="undefined"?mpMode==="active":true}catch(e){return true}})();
 let bar=document.getElementById("mpSmartFilters");
 if(!bar){bar=document.createElement("div");bar.className="mp-smart-filters";bar.id="mpSmartFilters";root.parentElement.insertBefore(bar,root)}
 bar.style.display=active?"flex":"none";
 if(active){
 const keys=filterKeys.filter(k=>heads.includes(k));
 const signature=keys.map(k=>k+":"+[...new Set(rows.map(tr=>tr.cells[heads.indexOf(k)]?.textContent.trim()).filter(v=>v&&v!=="-"))].sort().join("|")).join(";");
 if(bar.dataset.signature!==signature){
  bar.dataset.signature=signature;bar.replaceChildren();
  keys.forEach(k=>{
    const label=document.createElement("label");label.textContent="Filter "+k;
    const select=document.createElement("select");select.setAttribute("aria-label","Filter "+k);
    const all=document.createElement("option");all.value="";all.textContent="Semua";select.append(all);
    const values=[...new Set(rows.map(tr=>tr.cells[heads.indexOf(k)]?.textContent.trim()).filter(v=>v&&v!=="-"))].sort();
    values.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;select.append(o)});
    if(values.includes(state[k]))select.value=state[k];else state[k]="";
    select.onchange=()=>{state[k]=select.value;run()};label.append(select);bar.append(label)
  });
  const reset=document.createElement("button");reset.type="button";reset.textContent="Reset Filter";reset.onclick=()=>{keys.forEach(k=>state[k]="");bar.dataset.signature="";run()};bar.append(reset);
 }
 let shown=0;
 rows.forEach(tr=>{const ok=keys.every(k=>!state[k]||tr.cells[heads.indexOf(k)]?.textContent.trim()===state[k]);tr.style.display=ok?"":"none";if(ok)shown++});
 [...table.querySelectorAll("tbody tr.mp-group-row")].forEach(tr=>{
   let next=tr.nextElementSibling,any=false;
   while(next&&!next.classList.contains("mp-group-row")){if(next.style.display!=="none")any=true;next=next.nextElementSibling}
   tr.style.display=any?"":"none";
 });
 let indicator=document.getElementById("mpFilterCount");if(!indicator){indicator=document.createElement("span");indicator.id="mpFilterCount";indicator.style.cssText="font-size:12px;color:#64748b";bar.append(indicator)}
 indicator.textContent=shown+" dari "+rows.length+" karyawan ditampilkan";
 }else rows.forEach(tr=>tr.style.display="");
 const idx=heads.findIndex(h=>h.toLowerCase()==="sisa hari");
 if(idx>=0)rows.forEach(tr=>{
  const td=tr.cells[idx];if(!td)return;
  td.classList.remove("mp-due-red","mp-due-yellow","kmb-days-good","kmb-days-near","kmb-days-urgent");
  const raw=td.textContent.trim(),days=Number(raw.replace(",","."));
  if(/jatuh\s*tempo/i.test(raw)||(raw!==""&&Number.isFinite(days)&&days<=0))td.classList.add("mp-due-red");
  else if(raw!==""&&Number.isFinite(days)&&days>0&&days<=7)td.classList.add("mp-due-yellow");
 });
 }finally{lock=false}
}
document.addEventListener("DOMContentLoaded",()=>{
 let pending=false;
 const obs=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run()})});
 const root=document.getElementById("mpTable");
 if(root)obs.observe(root,{childList:true,subtree:true});
 run();document.addEventListener("click",e=>{if(e.target.closest?.(".mp-tab,.nav[data-view='mp']"))requestAnimationFrame(run)});
});
})();