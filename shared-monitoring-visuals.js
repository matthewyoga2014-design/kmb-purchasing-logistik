/* KMB common visual enhancements • 2026-10-15 */
(function(){
"use strict";
const style=document.createElement("style");
style.textContent=`
#statusCards .mini,#dueCards .mini{border:1px solid transparent;transition:background .2s,transform .2s;border-radius:14px}
#statusCards .mini:nth-child(1){background:#fff0ed;border-color:#ffcabc;color:#ae381e}
#statusCards .mini:nth-child(2){background:#eaf2ff;border-color:#c5d9ff;color:#2457aa}
#statusCards .mini:nth-child(3){background:#e6f8ef;border-color:#b7e8cf;color:#176a43}
#dueCards .mini:nth-child(1){background:#fff5db;border-color:#ffe2a0;color:#a76a00}
#dueCards .mini:nth-child(2){background:#fff0ee;border-color:#ffbeb8;color:#b91c1c}
#dueCards .mini:nth-child(3){background:#e6f8ef;border-color:#b7e8cf;color:#176a43}
#statusCards .mini b,#dueCards .mini b{color:inherit;font-weight:850}
#statusCards .mini span,#dueCards .mini span{color:inherit}
.kmb-stage-guide{grid-column:1/-1;background:#f8f9ff;border:1px solid #dce2fa;border-radius:12px;padding:14px;margin:7px 0 15px}
.kmb-stage-guide strong{font-size:13px;color:#263456}
.kmb-stage-track{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}
.kmb-stage-chip{border-radius:8px;background:#e8ebf1;color:#64748b;font-size:10px;padding:7px 9px;font-weight:700}
.kmb-stage-chip.done{background:#ddf7e7;color:#17623f}
.kmb-stage-chip.now{background:#e8defe;color:#6331af;box-shadow:inset 0 0 0 1px #a581e8}
.kmb-stage-meter{height:7px;background:#e3e8f1;border-radius:99px;overflow:hidden;margin-top:12px}
.kmb-stage-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#26ad83);transition:width .25s}
.kmb-days-urgent{color:#b91c1c!important;background:#fee2e2;border-radius:7px;font-weight:750;padding:3px 7px}
.kmb-days-near{color:#92400e!important;background:#fef3c7;border-radius:7px;font-weight:750;padding:3px 7px}
.kmb-days-good{color:#166534!important;background:#dcfce7;border-radius:7px;font-weight:750;padding:3px 7px}
`;
document.head.appendChild(style);
const stages=[["Psikologi Test","Psikotes"],["Interview User","Interview"],["Offering Latter","Offering"],["MCU","MCU"],["FU MCU","FU MCU"],["On Site","On Site"],["Induksi","Induksi"]];
function update(){
 const f=document.getElementById("formFields");
 if(f && f.querySelector('[data-f="Nama Kandidat"]')){
   let g=f.querySelector(".kmb-stage-guide");
   if(!g){
     g=document.createElement("div");g.className="kmb-stage-guide";
     const back=f.querySelector(".candidate-back");
     if(back)back.after(g);else f.prepend(g);
     stages.forEach(([field])=>{const inp=Array.from(f.querySelectorAll("[data-f]")).find(n=>n.dataset.f===field);if(inp)inp.addEventListener("input",update)});
   }
   const done=stages.map(([field])=>!!f.querySelector('[data-f="'+field+'"]')?.value);
   const last=done.lastIndexOf(true),pct=last<0?0:[25,40,55,70,80,95,100][last];
   const current=last<6?last+1:-1;
   g.innerHTML='<strong>Progres Rekrutmen: '+pct+'% • '+(last<0?'Belum diproses':stages[last][1])+'</strong><div class="kmb-stage-meter"><div class="kmb-stage-fill" style="width:'+pct+'%"></div></div><div class="kmb-stage-track">'+stages.map((s,i)=>'<span class="kmb-stage-chip '+(done[i]?'done':i===current?'now':'')+'">'+(done[i]?'✓ ':'')+s[1]+'</span>').join('')+'</div>';
 }
 // Warnai hanya angka pada kolom Sisa Hari, tanpa mengubah data.
 document.querySelectorAll("table").forEach(table=>{
   const heads=Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent.trim().toLowerCase());
   const idx=heads.findIndex(x=>x.includes("sisa hari")||x.includes("jatuh tempo (hari)"));
   if(idx<0)return;
   table.querySelectorAll("tbody tr").forEach(tr=>{
     const td=tr.cells[idx];if(!td)return;
     td.classList.remove("kmb-days-urgent","kmb-days-near","kmb-days-good");
     const days=Number(td.textContent.trim().replace(",","."));
     if(Number.isFinite(days)&&td.textContent.trim()!=="")td.classList.add(days<=0?"kmb-days-urgent":days<=7?"kmb-days-near":"kmb-days-good");
   });
 });
}
document.addEventListener("DOMContentLoaded",()=>{
 let pending=false;
 const obs=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;update()})});
 obs.observe(document.body,{childList:true,subtree:true});
 update();
});
})();