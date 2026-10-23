(function unitPopulationEnhancement(){
  "use strict";
  if (window.__kmbUnitDetailsV1) return;
  if (typeof window.unitForm !== "function" || typeof window.pageUnit !== "function") return;
  window.__kmbUnitDetailsV1 = true;
  const oldPageUnit = window.pageUnit;
  // Keep previously registered lambung and photos when syncing the older
  // two-column Excel population sheet (which contains type/count only).
  if (typeof window.parseSheets === "function") {
    const originalParseSheets = window.parseSheets;
    window.parseSheets = function () {
      const parsed = originalParseSheets.apply(this, arguments);
      if (parsed && Array.isArray(parsed.units) && Array.isArray(DATA.units)) {
        const existing = DATA.units;
        parsed.units = parsed.units.map(u => {
          const prev = existing.find(x => String(x.unit || "").trim().toLowerCase() === String(u.unit || "").trim().toLowerCase());
          return prev ? { ...prev, ...u, details: Array.isArray(prev.details) ? prev.details : [] } : u;
        });
      }
      return parsed;
    };
  }
  const html = value => String(value == null ? "" : value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cleanPhoto = src => typeof src === "string" && /^data:image\/(?:webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(src) ? src : "";
  const statusOpts = ["Operasional","Standby","Breakdown","Dalam Perbaikan","Off Site","Belum Diketahui"];
  const conditionOpts = ["Baik","Perlu Perbaikan","Rusak","Belum Diperiksa"];
  const options = (opts,v) => opts.map(o=>'<option value="'+html(o)+'" '+(String(o)===String(v)?"selected":"")+'>'+html(o)+'</option>').join("");
  const uid=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"u-"+Date.now()+"-"+Math.random().toString(36).slice(2);
  const styles=`
    .ud-panel{margin-top:18px}.ud-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
    .ud-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:12px}
    .ud-item{border:1px solid var(--line,#e5e7eb);border-radius:14px;padding:14px;background:#fff;display:flex;gap:12px;align-items:start}
    .ud-thumb{width:92px;height:92px;flex:0 0 92px;border-radius:12px;object-fit:cover;border:1px solid #e5e7eb;background:#f8fafc}
    .ud-photo-empty{width:92px;height:92px;flex:0 0 92px;border-radius:12px;display:grid;place-items:center;background:#f1f5f9;color:#64748b;font-size:12px;text-align:center}
    .ud-type-list{display:grid;gap:16px}
    .ud-type-group{border:1px solid #e4e1f3;border-radius:16px;padding:16px;background:#fdfcff}
    .ud-type-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
    .ud-type-head h3{margin:2px 0 3px;font-size:17px;font-weight:800;color:#1e1b4b}
    .ud-type-kicker{font-size:10px;letter-spacing:.09em;font-weight:800;color:#6d28d9}
    .ud-type-group .ud-summary-grid{gap:12px}
    .ud-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .ud-sum-box{border:1px solid #e5e7eb;border-radius:12px;padding:16px;min-width:0}
    .ud-sum-box h4{font-size:13px;margin:0 0 14px;color:#312e81}
    .ud-sum-row{margin:12px 0}.ud-sum-line{display:flex;gap:10px;align-items:baseline;justify-content:space-between;font-size:13px}
    .ud-sum-line span{min-width:0;overflow-wrap:anywhere}.ud-sum-line b{font-size:12px;white-space:nowrap}
    .ud-sum-track{height:8px;border-radius:999px;background:#e9e5f8;overflow:hidden;margin-top:7px}
    .ud-sum-track>div{height:100%;border-radius:999px;background:#8050f4}
    @media(max-width:680px){.ud-summary-grid{grid-template-columns:1fr}.ud-type-group{padding:12px}}
    .ud-meta{min-width:0;flex:1}.ud-meta strong{display:block;font-size:15px;word-break:break-word}.ud-meta small{display:block;color:#64748b;margin-top:4px;line-height:1.5}
    .ud-tag{display:inline-block;padding:3px 8px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;margin-top:8px}
    .ud-small{font-size:12px;color:#64748b;line-height:1.5}.ud-form{border-top:1px solid #e5e7eb;margin-top:14px;padding-top:14px}
    .ud-form-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 12px}
    .ud-record{border:1px solid #ddd6fe;border-radius:12px;margin:12px 0;background:#fcfbff;overflow:hidden}
    .ud-record summary{padding:12px 14px;cursor:pointer;font-weight:700;color:#312e81;display:flex;gap:8px;align-items:center;list-style:none}
    .ud-record summary::-webkit-details-marker{display:none}.ud-record summary:before{content:"▸";display:inline-block;color:#7c3aed}.ud-record[open] summary:before{content:"▾"}
    .ud-record-body{padding:0 14px 14px}.ud-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .ud-fld{display:flex;flex-direction:column;gap:5px}.ud-fld.full{grid-column:1/-1}.ud-fld label{font-size:12px;font-weight:650;color:#475569}
    .ud-fld input,.ud-fld select,.ud-fld textarea{width:100%;min-width:0;padding:9px 10px;border:1px solid #ddd6fe;border-radius:9px;background:white;color:#1e1b4b;font:inherit;font-size:13px;box-sizing:border-box}
    .ud-fld textarea{resize:vertical;min-height:62px}.ud-upload{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
    .ud-upload input{font-size:12px;max-width:100%}.ud-record-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:10px}
    .ud-btn{border:1px solid #ddd6fe;background:white;color:#5b21b6;border-radius:9px;padding:9px 12px;cursor:pointer;font-weight:700;font:inherit;font-size:12px}
    .ud-btn-danger{color:#b91c1c;border-color:#fecaca}.ud-btn-primary{background:#6d28d9;color:white;border-color:#6d28d9}
    .ud-help{padding:10px 12px;border-radius:10px;background:#f5f3ff;color:#5b21b6;font-size:12px;line-height:1.5}
    #dialog:has(.ud-form){width:min(840px,calc(100vw - 30px));max-width:840px;box-sizing:border-box}
    .ud-lightbox{position:fixed;inset:0;background:rgba(2,6,23,.87);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:20px}
    .ud-lightbox img{max-width:min(960px,95vw);max-height:78vh;object-fit:contain;border-radius:8px}
    .ud-lightbox button{border:1px solid white;background:white;color:#111827;border-radius:9px;padding:9px 15px;cursor:pointer}
    @media(max-width:620px){.ud-fields{grid-template-columns:1fr}.ud-item{gap:9px}.ud-thumb,.ud-photo-empty{width:68px;height:68px;flex-basis:68px}#dialog:has(.ud-form){max-width:calc(100vw - 20px)}}
  `;
  const style=document.createElement("style"); style.textContent=styles; document.head.appendChild(style);
  const recordsOf=u=>Array.isArray(u?.details)?u.details:[];
  const registeredTotal=()=>DATA.units.reduce((sum,u)=>sum+recordsOf(u).length,0);
  const picture=(src,label,cl)=>cleanPhoto(src)?'<img class="'+cl+'" src="'+html(src)+'" alt="'+html(label||"Foto unit")+'" loading="lazy">':'<div class="ud-photo-empty">Belum ada foto</div>';
  function detailPanel(){
    const all=DATA.units.flatMap((u,idx)=>recordsOf(u).map((it,j)=>({it,idx,j,type:u.unit})));
    const total=DATA.units.reduce((sum,u)=>sum+(Number(u.jumlah)||0),0);
    const missing=Math.max(0,total-all.length);
    return '<div class="card ud-panel"><div class="ud-head"><div><div class="eyebrow">Register Unit</div><h2>Identitas & Foto Unit</h2><p>Catat nomor lambung dan kondisi setiap unit. Data jenis dan total populasi tetap mengikuti tabel di atas.</p></div><span class="pill">'+all.length+' terdata dari '+total+' unit</span></div>'+
      (missing?'<div class="ud-help" style="margin-bottom:12px">Masih ada '+missing+' unit yang detail identitasnya belum dilengkapi. Pilih Edit pada jenis unit di tabel, lalu Tambah Identitas Unit.</div>':'')+
      (all.length?'<div class="ud-grid">'+all.map(({it,idx,j,type})=>{
        let model=[it.merk,it.model].filter(Boolean).join(" ");
        return '<div class="ud-item">'+(cleanPhoto(it.foto)?'<button type="button" data-ud-photo="'+idx+':'+j+'" style="border:0;background:transparent;padding:0;cursor:zoom-in">'+picture(it.foto,it.lambung||type,"ud-thumb")+'</button>':picture("",type,"ud-thumb"))+
        '<div class="ud-meta"><strong>'+html(it.lambung||"Nomor lambung belum diisi")+'</strong><small>'+html(type)+(model?' · '+html(model):"")+'</small><small>Vendor: '+html(it.vendor||"Belum diisi")+' · Merek: '+html(it.merk||"Belum diisi")+'</small><small>'+html(it.jobsite||"Lokasi belum dicatat")+' · '+html(it.hm||"HM belum diisi")+(it.hm?" HM":"")+'</small><span class="ud-tag">'+html(it.status||"Belum Diketahui")+'</span><small>Kondisi: '+html(it.kondisi||"Belum Diperiksa")+'</small>'+
        (CAN_EDIT?'<button type="button" class="ud-btn" data-ud-edit="'+idx+':'+j+'" style="margin-top:10px">Edit Detail</button>':'')+'</div></div>';
      }).join("")+'</div>':'<p class="ud-small">Belum ada nomor lambung yang didaftarkan. Data jumlah unit sebelumnya tetap aman.</p>')+'</div>';
  }
  // Dashboard is grouped by unit type so different machines never share the
  // same vendor/brand chart. Counting remains based on existing register data.
  function groupUnitTypes() {
    const grouped = new Map();
    (DATA.units || []).forEach(u => {
      const type = String(u.unit || "").trim() || "Jenis belum diisi";
      const key = type.toLocaleLowerCase("id-ID");
      if (!grouped.has(key)) grouped.set(key, { type, planned: 0, details: [] });
      const g = grouped.get(key);
      g.planned += Math.max(0, Number(u.jumlah) || 0);
      g.details.push(...recordsOf(u));
    });
    return [...grouped.values()].sort((a,b) =>
      b.planned-a.planned || a.type.localeCompare(b.type,"id"));
  }
  function countByField(group,field,blankLabel="Belum diisi") {
    const bucket = new Map();
    const add=(raw,n=1)=>{
      const name=String(raw||"").trim() || blankLabel;
      const key=name.toLocaleLowerCase("id-ID");
      const prev=bucket.get(key);
      if(prev)prev.count+=n;else bucket.set(key,{name,count:n});
    };
    group.details.forEach(d=>add(d[field]));
    const absent=Math.max(0,group.planned-group.details.length);
    if(absent)add(blankLabel,absent);
    return [...bucket.values()].sort((a,b)=>b.count-a.count ||
      a.name.localeCompare(b.name,"id"));
  }
  function dashboardUnitBreakdown() {
    if (!Array.isArray(DATA.units)) return "";
    const groups=groupUnitTypes();
    const grandTotal=groups.reduce((n,g)=>n+Math.max(g.planned,g.details.length),0);
    const graph=(g,key,label,blankLabel="Belum diisi")=>'<section class="ud-sum-box" aria-label="'+html(label)+' untuk '+html(g.type)+'">'+
      '<h4>'+html(label)+'</h4>'+
      (countByField(g,key,blankLabel).map(item=>{
        const total=Math.max(g.planned,g.details.length,1);
        const pct=Math.min(100,Math.round(item.count/total*100));
        return '<div class="ud-sum-row"><div class="ud-sum-line"><span>'+html(item.name)+'</span><b>'+item.count+' unit</b></div>'+
          '<div class="ud-sum-track" role="img" aria-label="'+html(item.name)+': '+item.count+' dari '+total+' unit"><div style="width:'+pct+'%"></div></div></div>';
      }).join("") || '<p class="ud-small">Belum ada unit.</p>')+'</section>';
    return '<div class="card ud-summary-panel"><div class="ch"><div>'+
      '<div class="eyebrow">Populasi Unit</div><h2>Komposisi Unit per Jenis</h2>'+
      '<p>Rincian vendor, merek, status operasional, dan kondisi dikelompokkan menurut jenis unit agar mudah dibandingkan.</p>'+
      '</div><span class="pill">'+grandTotal+' unit</span></div>'+
      (groups.length?'<div class="ud-type-list">'+groups.map(g=>
        '<section class="ud-type-group"><div class="ud-type-head"><div>'+
          '<span class="ud-type-kicker">JENIS UNIT</span><h3>'+html(g.type)+'</h3>'+
          '<span class="ud-small">'+Math.min(g.details.length,g.planned)+' identitas terdata</span></div>'+
          '<span class="pill">'+g.planned+' unit</span></div>'+
          '<div class="ud-summary-grid">'+graph(g,"vendor","Vendor / Pemilik Unit")+graph(g,"merk","Merek Unit")+graph(g,"status","Status Operasional","Belum Diketahui")+graph(g,"kondisi","Kondisi Unit","Belum Diperiksa")+'</div></section>'
      ).join("")+'</div>':'<p class="ud-small">Belum ada populasi unit di jobsite ini.</p>')+
      '<p class="ud-small" style="margin-top:12px">“Belum diisi” berarti vendor atau merek belum tercatat. “Belum Diketahui” dan “Belum Diperiksa” berarti status atau kondisi belum tercatat, termasuk unit yang identitasnya belum didaftarkan.</p></div>';
  }
  if (typeof window.unitBlock === "function") {
    const previousUnitBlock = window.unitBlock;
    window.unitBlock=function(D){return previousUnitBlock(D)+dashboardUnitBreakdown();};
  }
  // Read-only full MPP audit. Preserves the existing operational MPP table.
  if (typeof window.pageMPP === "function") {
    const oldMPP=window.pageMPP;
    window.pageMPP=function(D) {
      const cols=["No","Section","Sub-section","Nama","Jabatan","Keterangan","PIC","PTK","Tanggal Pengajuan","Psikotest","Interview User","Offering","MCU","FU MCU","On Site","Induksi","Due Date","Status","Tanggal Close"];
      const row=p=>[p.no,p.section,p.group,p.nama,p.jabatan,p.ket,p.pic,p.ptk,p.aju,
        ...Array.from({length:7},(_,i)=>(Array.isArray(p.stages)?p.stages[i]:null)||''),p.due,p.status,p.close];
      const list=Array.isArray(DATA.positions)?DATA.positions:[];
      return oldMPP(D)+'<details class="card ud-mpp-audit" style="margin-top:18px"><summary style="cursor:pointer;font-weight:750;padding:4px 2px">Lihat Database MPP Lengkap ('+list.length+' posisi · 19 kolom)</summary>'+
        '<p class="ud-small" style="margin:10px 0">Semua data MPP yang tersimpan ditampilkan tanpa filter status. Tabel ini hanya untuk pengecekan dan tidak mengubah data.</p>'+
        '<div class="tw" style="overflow:auto"><table class="t mpp"><thead><tr>'+cols.map(c=>'<th>'+html(c)+'</th>').join('')+'</tr></thead><tbody>'+
        list.map(p=>{const a=row(p);return '<tr>'+cols.map((c,i)=>'<td style="min-width:100px;white-space:pre-wrap">'+html(a[i]??"")+'</td>').join('')+'</tr>';}).join('')+
        '</tbody></table></div></details>';
    };
  }
  window.pageUnit=function(D){return oldPageUnit(D)+detailPanel();};
  function rowTemplate(it,j){
    const thumb=cleanPhoto(it.foto)?'<img class="ud-thumb" src="'+html(it.foto)+'" alt="Pratinjau foto unit">':'<div class="ud-photo-empty">Belum ada foto</div>';
    const val=(key)=>html(it[key]||"");
    return '<details class="ud-record" data-ud-row="'+j+'" '+(it._expand?"open":"")+'><summary><span class="ud-summary">'+html(it.lambung||"Unit #"+(j+1))+'</span><span class="ud-tag" style="margin-top:0;margin-left:auto">'+html(it.status||"Belum Diketahui")+'</span></summary><div class="ud-record-body"><div class="ud-fields">'+
    '<div class="ud-fld"><label>Nomor Lambung *</label><input data-ud-key="lambung" value="'+val("lambung")+'" placeholder="Contoh: EXC-001" maxlength="70"></div>'+
    '<div class="ud-fld"><label>Vendor / Pemilik Unit</label><input data-ud-key="vendor" value="'+val("vendor")+'" placeholder="Contoh: KMB / TRINANDA" maxlength="90"></div>'+
    '<div class="ud-fld"><label>Merek</label><input data-ud-key="merk" value="'+val("merk")+'" placeholder="Contoh: Sany / Komatsu" maxlength="80"></div>'+
    '<div class="ud-fld"><label>Model / Tipe</label><input data-ud-key="model" value="'+val("model")+'" placeholder="Contoh: SY500H" maxlength="80"></div>'+
    '<div class="ud-fld"><label>Tahun Unit</label><input data-ud-key="tahun" value="'+val("tahun")+'" placeholder="Contoh: 2022" inputmode="numeric" maxlength="4"></div>'+
    '<div class="ud-fld"><label>Nomor Seri / Chassis</label><input data-ud-key="serial" value="'+val("serial")+'" maxlength="120"></div>'+
    '<div class="ud-fld"><label>Hour Meter (HM)</label><input data-ud-key="hm" value="'+val("hm")+'" placeholder="Contoh: 14.850" maxlength="30"></div>'+
    '<div class="ud-fld"><label>Status Operasional</label><select data-ud-key="status">'+options(statusOpts,it.status||"Belum Diketahui")+'</select></div>'+
    '<div class="ud-fld"><label>Kondisi</label><select data-ud-key="kondisi">'+options(conditionOpts,it.kondisi||"Belum Diperiksa")+'</select></div>'+
    '<div class="ud-fld full"><label>Lokasi / Jobsite</label><input data-ud-key="jobsite" value="'+val("jobsite")+'" placeholder="Area atau lokasi unit" maxlength="150"></div>'+
    '<div class="ud-fld full"><label>Keterangan / Catatan</label><textarea data-ud-key="keterangan" placeholder="Riwayat singkat, kendala, informasi tambahan">'+val("keterangan")+'</textarea></div>'+
    '</div><div class="ud-upload">'+thumb+'<div class="ud-fld" style="flex:1;min-width:170px"><label>Foto unit (JPG, PNG, WEBP, maks. 8 MB)</label><input type="file" data-ud-upload="'+j+'" accept="image/jpeg,image/png,image/webp"><small class="ud-small">Foto diperkecil agar nyaman dibuka melalui HP. Disimpan bersama data portal.</small></div></div>'+
    '<div class="ud-record-actions"><button type="button" class="ud-btn" data-ud-clear="'+j+'">Hapus Foto</button><button type="button" class="ud-btn ud-btn-danger" data-ud-remove="'+j+'">Hapus Identitas Ini</button></div></div></details>';
  }
  async function compactPhoto(file){
    if(!/^image\/(?:jpeg|png|webp)$/.test(file.type)) throw new Error("Gunakan foto JPG, PNG, atau WEBP.");
    if(file.size>8*1024*1024) throw new Error("Ukuran foto maksimal 8 MB.");
    const local=URL.createObjectURL(file);
    let im;
    try {
      im=await new Promise((resolve,reject)=>{const pic=new Image();pic.onload=()=>resolve(pic);pic.onerror=()=>reject(new Error("Foto tidak bisa dibaca."));pic.src=local;});
      const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
      if(!w||!h) throw new Error("Foto tidak valid.");
      const ratio=Math.min(1,900/Math.max(w,h));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
      canvas.getContext("2d").drawImage(im,0,0,canvas.width,canvas.height);
      let quality=.76,output="",type="image/webp";
      while(quality>=.3){output=canvas.toDataURL(type,quality);if(!output.startsWith("data:image/webp")){type="image/jpeg";output=canvas.toDataURL(type,quality);}if(output.length<=180000)break;quality-=.1;}
      if(output.length>235000) throw new Error("Foto terlalu besar setelah diperkecil, pilih foto lain.");
      return output;
    } finally {URL.revokeObjectURL(local);}
  }
  window.unitForm=function(idx,focusIndex){
    const u=idx==null?null:DATA.units[idx];
    const entries=recordsOf(u).map(x=>({...x,_expand:false}));
    if(Number.isInteger(focusIndex)&&entries[focusIndex])entries[focusIndex]._expand=true;
    let pending=[],uploadError='';
    const setError=msg=>{const err=document.getElementById("ferr");if(err){err.hidden=false;err.textContent=msg;}return false;};
    const readRows=()=>{
      document.querySelectorAll("#ud-rows [data-ud-row]").forEach(node=>{
        const idx=Number(node.dataset.udRow),rec=entries[idx];if(!rec)return;
        node.querySelectorAll("[data-ud-key]").forEach(input=>{rec[input.dataset.udKey]=input.value.trim();});
        rec._expand=node.open;
      });
    };
    const paint=()=>{
      const wrap=document.getElementById("ud-rows");if(!wrap)return;
      wrap.innerHTML=entries.map(rowTemplate).join("");
      const count=document.getElementById("ud-count");if(count)count.textContent=entries.length+" identitas dicatat";const j=document.getElementById("f_jumlah");if(j && Number(j.value)<entries.length)j.value=String(entries.length);
    };
    openForm({
      eyebrow:"Populasi Unit",
      title:u?"Edit "+u.unit:"Tambah Jenis Unit",
      intro:"Jumlah unit tetap dihitung seperti sebelumnya. Lengkapi nomor lambung dan foto satu per satu pada bagian Register Unit.",
      values:u?{...u}:{jumlah:1,unit:""},
      sections:[
        {title:"Ringkasan Populasi",fields:[
          {k:"unit",label:"Jenis Unit",req:true},
          {k:"jumlah",label:"Jumlah Unit",type:"number",req:true}
        ]},
        {title:"Informasi Tambahan",fields:[
          {k:"catatan",label:"Catatan Populasi",type:"textarea",rows:2,full:true,ph:"Catatan umum untuk jenis unit ini (opsional)"}
        ]}
      ],
      danger:u?{label:"Hapus jenis unit"}:null,
      onSave:async(v)=>{
        try{await Promise.all(pending);readRows();}catch(e){return setError(e.message||"Gagal memproses foto.");}
        if(uploadError)return setError(uploadError);
        const finalJumlah=Math.max(Number(v.jumlah)||0,entries.length);
        const seen=new Set();
        for(let i=0;i<entries.length;i++){
          const lambung=String(entries[i].lambung||"").trim();
          if(!lambung)return setError("Lengkapi Nomor Lambung untuk identitas unit #"+(i+1)+".");
          const k=lambung.toLowerCase().replace(/\s+/g,"");if(seen.has(k))return setError("Nomor Lambung duplikat: "+lambung+".");
          seen.add(k);
          if(entries[i].tahun&&!/^(19|20)\d{2}$/.test(entries[i].tahun))return setError("Tahun unit harus empat angka, contoh 2022.");
        }
        const cleaned=entries.map(it=>{
          const rec={...it,id:it.id||uid()};delete rec._expand;
          return rec;
        });
        return commit(S=>{
          const rec={...(u||{}),unit:v.unit,jumlah:finalJumlah,catatan:v.catatan,details:cleaned};
          if(u)S.units[idx]=rec;else S.units.push(rec);
        },u?"Data populasi dan detail unit diperbarui.":"Jenis unit ditambahkan.");
      }
    });
    const form=document.getElementById("frm"),err=document.getElementById("ferr");
    if(!form||!err)return;
    err.insertAdjacentHTML("beforebegin",'<div class="ud-form"><div class="ud-form-head"><div><strong>Register Per Unit</strong><div id="ud-count" class="ud-small"></div></div><button type="button" class="ud-btn ud-btn-primary" id="ud-add">+ Tambah Identitas Unit</button></div><div class="ud-help">Nomor lambung, merek, model, serial, HM, status, kondisi, lokasi dan foto bersifat detail per unit. Jumlah lama tidak dihapus. Untuk detail yang belum diketahui, isi bertahap.</div><div id="ud-rows"></div></div>');
    const wrapper=document.getElementById("ud-rows");
    wrapper.addEventListener("input",e=>{const row=e.target.closest("[data-ud-row]");if(row&&e.target.matches("[data-ud-key]")&&entries[Number(row.dataset.udRow)]){entries[Number(row.dataset.udRow)][e.target.dataset.udKey]=e.target.value.trim();if(e.target.dataset.udKey==="lambung")row.querySelector(".ud-summary").textContent=e.target.value||"Unit #"+(Number(row.dataset.udRow)+1);}});
    form.addEventListener("click",e=>{
      const add=e.target.closest("#ud-add");
      if(add){readRows();entries.push({id:uid(),lambung:"",merk:"",model:"",tahun:"",serial:"",hm:"",status:"Belum Diketahui",kondisi:"Belum Diperiksa",jobsite:"",keterangan:"",foto:"",_expand:true});paint();document.getElementById("ud-rows").lastElementChild?.scrollIntoView({block:"nearest",behavior:"smooth"});return;}
      const rem=e.target.closest("[data-ud-remove]");
      if(rem){readRows();const i=Number(rem.dataset.udRemove);if(!confirm("Hapus identitas unit ini dari daftar? Perubahan berlaku setelah klik Simpan Perubahan."))return;entries.splice(i,1);paint();return;}
      const clear=e.target.closest("[data-ud-clear]");
      if(clear){readRows();const i=Number(clear.dataset.udClear);if(entries[i])entries[i].foto="";paint();return;}
    });
    form.addEventListener("change",e=>{
      const inp=e.target.closest("[data-ud-upload]");if(!inp||!inp.files?.length)return;
      readRows();const i=Number(inp.dataset.udUpload),file=inp.files[0];if(!entries[i])return;uploadError='';
      const p=compactPhoto(file).then(uri=>{if(!entries[i])return;entries[i].foto=uri;const row=wrapper.querySelector('[data-ud-row="'+i+'"]');if(row){const preview=row.querySelector(".ud-upload .ud-thumb,.ud-upload .ud-photo-empty");if(preview)preview.outerHTML=picture(uri,entries[i].lambung||"Foto unit","ud-thumb");}}).catch(err=>{uploadError=err.message||'Gagal memproses foto.';setError(uploadError);throw err;});
      pending.push(p);
      p.finally(()=>{pending=pending.filter(q=>q!==p);}).catch(()=>{});
    });
    paint();
    if(u)FORM.dangerFn=()=>confirmBox("Hapus seluruh jenis unit "+u.unit+"?","Termasuk "+entries.length+" identitas dan foto unit. Tindakan ini akan mengurangi total populasi.",()=>commit(S=>{S.units.splice(idx,1);},"Jenis unit dihapus."));
  };
  document.addEventListener("click",e=>{
    const edit=e.target.closest("[data-ud-edit]");
    if(edit){e.preventDefault();e.stopImmediatePropagation();if(!CAN_EDIT)return;const parts=edit.dataset.udEdit.split(":").map(Number);window.unitForm(parts[0],parts[1]);return;}
    const photo=e.target.closest("[data-ud-photo]");
    if(photo){e.preventDefault();e.stopImmediatePropagation();const parts=photo.dataset.udPhoto.split(":").map(Number);const item=recordsOf(DATA.units[parts[0]])[parts[1]];const src=cleanPhoto(item?.foto);if(!src)return;const view=document.createElement("div");view.className="ud-lightbox";view.setAttribute("role","dialog");view.setAttribute("aria-label","Foto unit");view.innerHTML='<img src="'+html(src)+'" alt="'+html(item?.lambung||"Foto Unit")+'"><button type="button">Tutup Foto</button>';view.addEventListener("click",ev=>{if(ev.target!==view.querySelector("img"))view.remove();});document.body.appendChild(view);}
  },true);
})();