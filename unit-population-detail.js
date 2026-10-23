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

    /* Clear hierarchy: ownership metadata above live operational condition. */
    .ud-type-list{display:grid;gap:16px}
    .ud-type-group{background:#fff;border:1px solid #e3e7ef;border-radius:16px;padding:18px}
    .ud-type-head{align-items:flex-start;margin-bottom:10px}
    .ud-type-count{display:flex;flex-direction:column;align-items:flex-end;min-width:76px;line-height:1.15}
    .ud-type-count strong{font-size:25px;color:#1e1b4b;font-weight:800}
    .ud-type-count small{font-size:11px;color:#64748b;margin-top:4px}
    .ud-data-note{font-size:12px;color:#64748b;line-height:1.5;margin:0 0 12px}
    .ud-unit-sections{display:grid;gap:12px}
    .ud-section-heading{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin:2px 0 9px}
    .ud-identity-grid,.ud-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .ud-identity-card,.ud-health-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;min-width:0}
    .ud-identity-card{background:#f8fafc}
    .ud-identity-card h4,.ud-health-card h4{font-size:14px;margin:0;color:#1e1b4b;font-weight:800}
    .ud-identity-card p,.ud-health-card p{font-size:12px;color:#64748b;line-height:1.5;margin:4px 0 12px}
    .ud-identity-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;border-top:1px solid #e8edf4;font-size:13px}
    .ud-identity-row:first-of-type{border-top:0}
    .ud-identity-name{font-weight:650;color:#334155;min-width:0;overflow-wrap:anywhere}
    .ud-identity-num{white-space:nowrap;color:#1e1b4b;font-weight:800;font-variant-numeric:tabular-nums}
    .ud-percent{font-size:11px;color:#64748b;font-weight:500;margin-left:4px}
    .ud-health-card{background:#fff}
    .ud-health-card h4{display:flex;align-items:center;gap:7px}
    .ud-health-card h4:before{content:'';width:4px;height:17px;border-radius:4px;background:#7c3aed}
    .ud-health-row{padding:9px 0;border-bottom:1px solid #eef2f7}
    .ud-health-row:last-child{border-bottom:0;padding-bottom:0}
    .ud-health-line{display:flex;gap:8px;align-items:center;justify-content:space-between;min-width:0}
    .ud-health-label{display:flex;gap:7px;align-items:center;font-size:13px;font-weight:650;color:#334155;min-width:0;overflow-wrap:anywhere}
    .ud-health-dot{display:inline-block;width:9px;height:9px;background:var(--ud-color);border-radius:50%;flex:0 0 9px}
    .ud-health-num{font-size:13px;white-space:nowrap;color:#0f172a;font-weight:800;font-variant-numeric:tabular-nums}
    .ud-health-track{margin-top:7px;height:7px;background:#edf0f6;border-radius:999px;overflow:hidden}
    .ud-health-fill{height:100%;background:var(--ud-color);border-radius:999px}
    .ud-data-quality{margin-top:12px;border-radius:9px;padding:9px 11px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.55}
    .ud-overview-explain{padding:10px 13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#475569;font-size:12px;line-height:1.6;margin:12px 0 16px}
    @media(max-width:720px){.ud-identity-grid,.ud-health-grid{grid-template-columns:1fr}.ud-type-group{padding:13px}.ud-type-count strong{font-size:22px}}


    /* Populasi Unit — table-first reporting layout, without decorative photos. */
    .ud-pop-hero{position:relative;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:20px 22px 20px 28px;margin-bottom:16px;border-radius:14px;background:linear-gradient(110deg,#edf5fc 0%,#fafcff 78%);border:1px solid #dbe8f4}
    .ud-pop-hero:before{content:"";position:absolute;left:12px;top:16px;bottom:16px;width:6px;background:#facc15;border-radius:999px}
    .ud-pop-hero h2{font-size:clamp(24px,3vw,34px);line-height:1.05;letter-spacing:.018em;font-weight:850;color:#0a2153;margin:0 0 8px}
    .ud-pop-hero p{font-size:13px;color:#294467;margin:0;line-height:1.55}
    .ud-pop-total{display:flex;align-items:baseline;gap:6px;background:#fff;border:1px solid #d9e5f2;border-radius:12px;padding:9px 14px;color:#17365e;white-space:nowrap}
    .ud-pop-total strong{font-size:24px}
    .ud-pop-total span{font-size:12px;font-weight:750}
    .ud-pop-explain{font-size:12px;line-height:1.6;color:#42526b;margin:0 2px 14px}
    .ud-pop-list{display:grid;gap:16px}
    .ud-pop-type{border:1px solid #e1e9f1;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(15,42,76,.045)}
    .ud-pop-head{background:#174769;color:#fff;padding:13px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px}
    .ud-pop-head h3{font-size:clamp(16px,1.7vw,22px);font-weight:850;letter-spacing:.018em;margin:0;color:#fff}
    .ud-pop-head strong{font-size:24px;font-weight:850}
    .ud-pop-head .ud-pop-total-label{font-size:12px;margin-left:5px;font-weight:600;opacity:.95}
    .ud-pop-body{display:grid;grid-template-columns:175px minmax(0,1fr);gap:12px;padding:12px;background:#f8fbfe}
    .ud-pop-count{padding:19px 15px;min-width:0;border-radius:13px;background:linear-gradient(150deg,#f0f7fd,#fff);border:1px solid #dcebf6}
    .ud-pop-count .ud-count-label{font-weight:800;color:#13365d;font-size:13px}
    .ud-pop-count .ud-count-number{font-size:clamp(44px,5vw,66px);line-height:1.1;color:#081e51;font-weight:900;margin:9px 0 0}
    .ud-pop-count .ud-count-suffix{color:#204368;font-size:13px;font-weight:750}
    .ud-pop-count .ud-count-note{font-size:11px;color:#526784;margin-top:14px;line-height:1.6}
    .ud-pop-vendors{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,365px),1fr));gap:12px;min-width:0}
    .ud-pop-vendor{min-width:0;border:1px solid var(--ud-vendor-line,#d7e4f1);background:var(--ud-vendor-bg,#fff);border-radius:13px;padding:12px;overflow:hidden}
    .ud-pop-vendor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:42px;padding-bottom:8px}
    .ud-pop-vendor-name{font-weight:850;font-size:17px;color:#0d2857;min-width:0;overflow-wrap:anywhere}
    .ud-pop-vendor-total{display:flex;align-items:baseline;gap:5px;white-space:nowrap;color:#14294d}
    .ud-pop-vendor-total b{font-size:26px;line-height:1;font-weight:850}
    .ud-pop-vendor-total span{font-size:12px;font-weight:700}
    .ud-pop-table-wrap{overflow-x:auto;border:1px solid #dbe6f3;border-radius:9px;background:#fff}
    .ud-pop-table{width:100%;min-width:395px;border-collapse:separate;border-spacing:0;table-layout:auto;font-size:12px;color:#1d3254}
    .ud-pop-table th{padding:9px 8px;background:#e8f0fa;border-right:1px solid #d9e4f1;text-align:left;font-weight:850;color:#17325b;vertical-align:middle;font-size:11px}
    .ud-pop-table td{padding:9px 8px;border-top:1px solid #e7edf5;border-right:1px solid #e7edf5;vertical-align:top;line-height:1.5}
    .ud-pop-table th:last-child,.ud-pop-table td:last-child{border-right:0}
    .ud-pop-table td:nth-child(2),.ud-pop-table th:nth-child(2){text-align:center;font-weight:800;white-space:nowrap}
    .ud-pop-name{font-weight:800;overflow-wrap:anywhere}
    .ud-pop-metrics{display:flex;flex-direction:column;gap:5px}
    .ud-pop-pill{display:inline-flex;align-items:flex-start;gap:5px;line-height:1.35;padding:4px 6px;border-radius:6px;background:var(--ud-chip-bg);color:var(--ud-chip-text);font-size:11px;font-weight:700;overflow-wrap:anywhere}
    .ud-pop-pill b{font-variant-numeric:tabular-nums}
    .ud-pop-remark{margin:0;padding:9px 13px 11px;background:#fff;color:#52657e;font-size:11px;line-height:1.5;border-top:1px solid #edf1f6}
    .ud-pop-footer{margin:12px 0 0;color:#475569;font-size:12px;line-height:1.65}
    @media(max-width:850px){.ud-pop-body{grid-template-columns:1fr}.ud-pop-count{display:flex;align-items:center;gap:12px;padding:12px 16px}.ud-pop-count .ud-count-number{font-size:38px;margin:0}.ud-pop-count .ud-count-note{margin:0 0 0 auto}.ud-pop-count .ud-count-suffix{align-self:center}}
    @media(max-width:550px){.ud-pop-head{padding:12px}.ud-pop-body{padding:9px}.ud-pop-hero{padding:17px 15px 17px 28px}.ud-pop-vendors{grid-template-columns:minmax(0,1fr)}.ud-pop-table{min-width:390px}.ud-pop-vendor{padding:10px}.ud-pop-count .ud-count-note{font-size:10px}}


    /* v4: one synchronized population panel; colors match existing purple/blue unit tiles. */
    .ud-summary-panel{margin-bottom:18px}
    .ud-summary-panel .ud-pop-hero{background:linear-gradient(110deg,#f3eeff 0%,#fcfbff 80%);border-color:#e3d9fa}
    .ud-summary-panel .ud-pop-hero:before{background:#7c3aed}
    .ud-summary-panel .ud-pop-hero h2{color:#29145b;font-size:clamp(23px,2.8vw,31px)}
    .ud-summary-panel .ud-pop-hero p{color:#5b4a78}
    .ud-summary-panel .ud-pop-total{border-color:#e3d9fa;color:#5b21b6;background:#fff}
    .ud-summary-panel .ud-pop-explain{color:#55486f}
    .ud-summary-panel .ud-pop-type{border-color:#ded9ea}
    .ud-summary-panel .ud-pop-head{background:var(--ud-pop-accent,#6d28d9)}
    .ud-summary-panel .ud-pop-body{background:#fcfbff}
    .ud-summary-panel .ud-pop-count{background:linear-gradient(150deg,var(--ud-pop-accent-soft,#f5f3ff),#fff);border-color:#e5def7}
    .ud-summary-panel .ud-pop-count .ud-count-label,.ud-summary-panel .ud-pop-count .ud-count-number{color:#29145b}
    .ud-summary-panel .ud-pop-count .ud-count-suffix{color:#5b21b6}
    .ud-summary-panel .ud-pop-table-wrap{border-color:#e4dff2}
    .ud-summary-panel .ud-pop-table th{background:#f2edfc;color:#38206d;border-color:#e3d9f6}
    .ud-summary-panel .ud-pop-table td{border-color:#eee9f5}
    .ud-summary-panel .ud-pop-vendor-total b{color:#4c1d95}
    .ud-summary-panel .ud-pop-vendor-name{color:#38206d}
    .ud-pop-source{display:inline-flex;align-items:center;gap:7px;border:1px solid #ddd1f8;background:#fff;color:#5b21b6;border-radius:9px;padding:9px 12px;font:inherit;font-size:12px;font-weight:750;cursor:pointer;white-space:nowrap}
    .ud-pop-source:hover,.ud-pop-source:focus-visible{background:#ede9fe;outline:2px solid transparent}
    @media(max-width:600px){.ud-summary-panel .ud-pop-hero{align-items:flex-start}.ud-pop-source{white-space:normal}}

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
  const styleOct=document.createElement("style"); styleOct.textContent="\n/* Compact 2-column Population Unit dashboard (2026-10-23) */\n.ud-summary-panel{padding:16px!important}.ud-summary-panel .ud-pop-hero{padding:0;margin:0 0 10px;background:transparent;border:0;border-radius:0}.ud-summary-panel .ud-pop-hero:before{display:none}\n.ud-summary-panel .ud-pop-hero h2{font-size:14px!important;margin:0 0 3px;color:#6d28d9}.ud-summary-panel .ud-pop-hero p{font-size:12px;line-height:1.5}\n.ud-summary-panel .ud-pop-total{padding:7px 10px;background:#f1ebff;border:0}.ud-summary-panel .ud-pop-total strong{font-size:15px}\n.ud-summary-panel .ud-pop-explain{font-size:11px;margin:0 0 12px;padding:8px 10px;background:#f3f6fc;border:1px solid #e3e8f2;border-radius:9px}\n.ud-summary-panel .ud-pop-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}\n.ud-summary-panel .ud-pop-type{min-width:0;border-radius:11px;break-inside:avoid}\n.ud-summary-panel .ud-pop-head{padding:9px 12px;min-height:39px;background:linear-gradient(105deg,var(--u-a),var(--u-b));color:#102148}\n.ud-summary-panel .ud-pop-head h3{font-size:13px!important;color:#102148;display:flex;align-items:center;gap:8px;min-width:0;overflow-wrap:anywhere}\n.ud-summary-panel .ud-pop-head h3 svg{width:23px;height:23px;flex:0 0 23px}.ud-summary-panel .ud-pop-head strong{font-size:12px;color:#102148}\n.ud-summary-panel .ud-pop-head .ud-pop-total-label{font-size:11px;color:#102148;font-weight:700}\n.ud-summary-panel .ud-pop-body{display:grid;grid-template-columns:118px minmax(0,1fr);gap:5px;background:#fff;padding:7px}\n.ud-summary-panel .ud-pop-count{padding:10px 8px;border:0;background:linear-gradient(140deg,#eff3fb,#fff);border-radius:7px}\n.ud-summary-panel .ud-pop-count .ud-count-label{font-size:10px}.ud-summary-panel .ud-pop-count .ud-count-number{display:inline-block;font-size:27px;line-height:1;margin:6px 0 0}\n.ud-summary-panel .ud-pop-count .ud-count-suffix{font-size:11px;margin-left:4px}.ud-summary-panel .ud-pop-count .ud-count-note{font-size:10px;margin:9px 0 0;line-height:1.45}\n.ud-summary-panel .ud-pop-vendors{display:block;min-width:0}.ud-summary-panel .ud-pop-vendor{padding:0;background:transparent;border:0;border-radius:0}\n.ud-summary-panel .ud-pop-vendor+.ud-pop-vendor{margin-top:8px}.ud-summary-panel .ud-pop-vendor-head{min-height:0;padding:2px 4px 5px}\n.ud-summary-panel .ud-pop-vendor-name,.ud-summary-panel .ud-pop-vendor-total span{font-size:10px}.ud-summary-panel .ud-pop-vendor-total b{font-size:11px}\n.ud-summary-panel .ud-pop-vendor.unknown .ud-pop-vendor-head{display:none}\n.ud-summary-panel .ud-pop-table-wrap{border-radius:5px;overflow-x:auto}.ud-summary-panel .ud-pop-table{width:100%;min-width:320px;font-size:10px}\n.ud-summary-panel .ud-pop-table th{padding:7px 4px;text-align:center;font-size:9px;background:#f0f3f9}\n.ud-summary-panel .ud-pop-table td{padding:7px 4px;font-size:10px;vertical-align:middle;text-align:center}\n.ud-summary-panel .ud-pop-table td:first-child{text-align:left}.ud-summary-panel .ud-pop-pill{padding:1px 4px;font-size:9px;border-radius:4px}\n.ud-summary-panel .ud-pop-remark{border:0;margin:0 7px 7px;background:#f1f4fa;border-radius:7px;padding:7px 9px;font-size:10px}\n.ud-summary-panel .ud-pop-footer{margin:10px 2px 0;font-size:11px}\n@media(max-width:1050px){.ud-summary-panel .ud-pop-list{grid-template-columns:minmax(0,1fr)}}\n@media(max-width:540px){.ud-summary-panel{padding:12px!important}.ud-summary-panel .ud-pop-body{grid-template-columns:1fr}.ud-summary-panel .ud-pop-count{display:flex;align-items:center;gap:7px}.ud-summary-panel .ud-pop-count .ud-count-number{font-size:23px;margin:0}.ud-summary-panel .ud-pop-count .ud-count-note{margin:0 0 0 auto}.ud-summary-panel .ud-pop-table{min-width:320px}}\n@media print{.ud-summary-panel .ud-pop-list{grid-template-columns:repeat(2,minmax(0,1fr))}}\n"; document.head.appendChild(styleOct);
  const browserStyle=document.createElement("style"); browserStyle.textContent="\n/* Populasi Unit Explorer: editable data with 8 switchable layouts */\n.ub-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}\n.ub-left,.ub-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.ub-search{font:inherit;font-size:12px;width:min(240px,100%);min-width:160px;padding:9px 10px;border:1px solid #ddd7ee;border-radius:9px;background:#fff;color:var(--ink)}\n.ub-sort{font:inherit;font-size:12px;border:1px solid #ddd7ee;border-radius:9px;padding:8px 9px;background:#fff;color:var(--ink)}\n.ub-picker{position:relative}.ub-picker>summary{cursor:pointer;list-style:none;display:flex;gap:8px;align-items:center;border:1px solid #ddd7ee;border-radius:9px;padding:8px 12px;color:#5b21b6;font-weight:800;font-size:12px;background:#fff}\n.ub-picker>summary::-webkit-details-marker{display:none}.ub-picker[open]>summary{background:#f5f3ff}\n.ub-menu{position:absolute;top:calc(100% + 5px);left:0;z-index:25;width:245px;background:#fff;border:1px solid #e4ddef;border-radius:12px;box-shadow:0 15px 35px rgba(17,24,39,.16);padding:6px;display:grid;gap:2px}\n.ub-menu button{display:flex;align-items:center;gap:10px;text-align:left;font:inherit;font-size:12px;color:#334155;padding:9px 10px;border:0;border-radius:7px;cursor:pointer;background:#fff}\n.ub-menu button:hover,.ub-menu button[aria-pressed=true]{background:#f2eeff;color:#5b21b6}\n.ub-marker{display:inline-block;width:17px;flex:0 0 17px;text-align:center;color:#6d28d9;font-weight:900}\n.ub-menu hr{margin:4px 0;border:0;border-top:1px solid #e9e5ef}\n.ub-layout{display:grid;grid-template-columns:1fr;gap:12px;align-items:start}\n.ub-layout.has-pane{grid-template-columns:minmax(0,1fr) 245px}\n.ub-main{min-width:0}.ub-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}\n.ub-item{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e4e4f0;border-radius:10px;background:#fff;min-height:72px;min-width:0;cursor:pointer}\n.ub-item:hover,.ub-item[aria-pressed=true],.ub-table tr[aria-pressed=true]{border-color:#a88af7;background:#f9f6ff;outline:1px solid #e0d4fc}\n.ub-icon{background:var(--ub-bg,#f0eafe);color:var(--ub-col,#6d28d9);width:46px;height:46px;border-radius:10px;flex:0 0 46px;display:grid;place-items:center}\n.ub-icon svg{max-width:78%;max-height:78%}\n.ub-label{min-width:0;flex:1}.ub-label strong{display:block;line-height:1.4;font-size:13px;overflow-wrap:anywhere}\n.ub-label small{display:block;margin-top:3px;line-height:1.45;font-size:11px;color:#667085;overflow-wrap:anywhere}\n.ub-action{border:1px solid #d9cbfa;background:#fff;color:#5b21b6;border-radius:7px;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer}\n.ub-items.extralarge{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}\n.ub-items.extralarge .ub-item,.ub-items.large .ub-item{flex-direction:column;justify-content:center;text-align:center;align-items:center}\n.ub-items.extralarge .ub-item{min-height:170px}\n.ub-items.extralarge .ub-icon{width:80px;height:80px;flex-basis:80px}\n.ub-items.large{grid-template-columns:repeat(auto-fill,minmax(195px,1fr))}\n.ub-items.large .ub-item{min-height:145px}\n.ub-items.large .ub-icon{width:62px;height:62px;flex-basis:62px}\n.ub-items.medium{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}\n.ub-items.medium .ub-item{padding:9px;gap:8px}\n.ub-items.medium .ub-icon{width:39px;height:39px;flex-basis:39px}\n.ub-items.small{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:5px}\n.ub-items.small .ub-item{padding:6px;gap:7px;min-height:40px}\n.ub-items.small .ub-icon{width:25px;height:25px;flex-basis:25px;border-radius:6px}\n.ub-items.small .ub-label small,.ub-items.small .ub-action{display:none}\n.ub-items.list{grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:4px}\n.ub-items.list .ub-item{min-height:41px;padding:6px 9px;gap:8px}\n.ub-items.list .ub-icon{width:26px;height:26px;flex-basis:26px;border-radius:6px}\n.ub-items.list .ub-label small,.ub-items.list .ub-action{display:none}\n.ub-items.content{grid-template-columns:1fr}.ub-items.content .ub-item{min-height:100px}\n.ub-items.content .ub-icon{width:65px;height:65px;flex-basis:65px}\n.ub-tablewrap{max-width:100%;overflow-x:auto;border:1px solid #e5e7eb;border-radius:10px}\n.ub-table{width:100%;min-width:690px;border-collapse:collapse;font-size:12px}\n.ub-table th{padding:10px;background:#f2f4fa;color:#47416a;font-weight:850;text-align:left;border-bottom:1px solid #e2e5ef}\n.ub-table td{padding:9px 10px;border-bottom:1px solid #eef0f5;color:#344055}\n.ub-table tr[data-ub-select]{cursor:pointer}.ub-table .ub-name{font-weight:800}\n.ub-side{background:#faf9ff;border:1px solid #e5dff3;border-radius:12px;padding:14px;min-width:0}\n.ub-side h3{font-size:13px;margin:0 0 10px;color:#33205c}\n.ub-side dl{margin:0}.ub-side dt{font-weight:800;font-size:11px;color:#4c3c70;margin-top:10px}\n.ub-side dd,.ub-side p{font-size:11px;line-height:1.5;color:#475569;margin:3px 0 0;overflow-wrap:anywhere}\n.ub-side img{width:100%;max-height:185px;object-fit:contain;border-radius:9px;background:#f1f3f8}\n.ub-hint{font-size:11px;color:#64748b;margin:10px 0 0}\n.ub-register{margin-top:16px}.ub-register>summary{cursor:pointer;border:1px solid #e6dff3;background:#f6f2ff;color:#5b21b6;font-size:12px;font-weight:750;border-radius:9px;padding:11px}\n@media(max-width:1040px){.ub-layout.has-pane{grid-template-columns:minmax(0,1fr)}}\n@media(max-width:560px){.ub-items,.ub-items.extralarge,.ub-items.large,.ub-items.medium,.ub-items.small{grid-template-columns:repeat(2,minmax(0,1fr))}.ub-items.content{grid-template-columns:1fr}.ub-item{padding:8px}.ub-items.extralarge .ub-item{min-height:135px}.ub-items.extralarge .ub-icon{width:60px;height:60px;flex-basis:60px}.ub-items.large .ub-item{min-height:125px}.ub-items.large .ub-icon{width:50px;height:50px;flex-basis:50px}}\n@media print{.ub-picker,.ub-search,.ub-sort,.ub-action{display:none!important}.ub-layout.has-pane{grid-template-columns:1fr}}\n"; document.head.appendChild(browserStyle);
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
  const rowName=(value, fallback)=>String(value == null ? "" : value).trim() || fallback;
  const normalizeRow=(v)=>String(v).toLocaleLowerCase("id-ID");
  // Don't derive a "progress rekondisi" from arbitrary operational status.
  // Count only fields recorded for each individual unit. Missing identities
  // count against the existing master total, without inventing records.
  function vendorBreakdown(g) {
    const owners=new Map();
    function add(d) {
      const vendor=rowName(d.vendor,"Belum diisi");
      const brand=rowName(d.merk,"Belum diisi");
      const vkey=normalizeRow(vendor);
      if(!owners.has(vkey))owners.set(vkey,{name:vendor,total:0,brands:new Map()});
      const owner=owners.get(vkey);
      owner.total++;
      const bkey=normalizeRow(brand);
      if(!owner.brands.has(bkey))owner.brands.set(bkey,{name:brand,count:0,status:new Map(),kondisi:new Map()});
      const b=owner.brands.get(bkey);
      b.count++;
      [
        ["status",rowName(d.status,"Belum Diketahui")],
        ["kondisi",rowName(d.kondisi,"Belum Diperiksa")]
      ].forEach(([key,label])=>{
        const k=normalizeRow(label);
        if(!b[key].has(k))b[key].set(k,{label,count:0});
        b[key].get(k).count++;
      });
    }
    g.details.forEach(add);
    const missing=Math.max(0,g.planned-g.details.length);
    for(let i=0;i<missing;i++) add({});
    const sorter=(a,b)=>b.count-a.count || a.name.localeCompare(b.name,"id");
    return [...owners.values()].sort((a,b)=>{
      const unknownA=/^belum/i.test(a.name), unknownB=/^belum/i.test(b.name);
      if(unknownA!==unknownB)return unknownA?1:-1;
      return b.total-a.total || a.name.localeCompare(b.name,"id");
    }).map(v=>({...v,brands:[...v.brands.values()].sort(sorter)}));
  }
  function popChipColors(field,label) {
    const v=normalizeRow(label);
    if(/belum|tidak diketahui|tidak ada data/.test(v))return ["#f1f5f9","#475569"];
    if(/rusak|breakdown|tidak layak|tidak beroperasi/.test(v))return ["#fee2e2","#991b1b"];
    if(/perlu|dalam perbaikan|perbaikan|repair|maintenance/.test(v) && !/selesai/.test(v))return ["#fef3c7","#92400e"];
    if(/operasional|aktif|running|^baik$|layak/.test(v))return ["#dcfce7","#166534"];
    if(/standby|siaga/.test(v))return ["#dbeafe","#1e40af"];
    if(/selesai|off.site|mobilisasi|pengiriman/.test(v))return ["#ede9fe","#5b21b6"];
    return ["#e0e7ff","#3730a3"];
  }
  function unitMetrics(map,field) {
    return '<div class="ud-pop-metrics">'+[...map.values()].sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,"id")).map(it=>{
      const colors=popChipColors(field,it.label);
      return '<span class="ud-pop-pill" style="--ud-chip-bg:'+colors[0]+';--ud-chip-text:'+colors[1]+'"><b>'+it.count+'×</b> '+html(it.label)+'</span>';
    }).join("")+'</div>';
  }
  function vendorCard(v,idx) {
    const palettes=[
      ["#f5f0ff","#e1d4fc"],
      ["#f0f4ff","#d9e3ff"],
      ["#f7f5ff","#e7dffc"],
      ["#f3f5fe","#dde4fb"]
    ];
    const palette=/^belum/i.test(v.name)?["#f8fafc","#cbd5e1"]:palettes[idx%palettes.length];
    return '<article class="ud-pop-vendor" style="--ud-vendor-bg:'+palette[0]+';--ud-vendor-line:'+palette[1]+'">'+
      '<div class="ud-pop-vendor-head"><div class="ud-pop-vendor-name">'+html(v.name)+'</div>'+
      '<div class="ud-pop-vendor-total"><span>Total:</span><b>'+v.total+'</b><span>unit</span></div></div>'+
      '<div class="ud-pop-table-wrap"><table class="ud-pop-table"><thead><tr>'+
      '<th scope="col">Merek Unit</th><th scope="col">Total</th><th scope="col">Status Operasional</th><th scope="col">Kondisi Unit</th>'+
      '</tr></thead><tbody>'+
      v.brands.map(b=>'<tr><td class="ud-pop-name">'+html(b.name)+'</td><td>'+b.count+'</td>'+
      '<td>'+unitMetrics(b.status,"status")+'</td><td>'+unitMetrics(b.kondisi,"kondisi")+'</td></tr>').join("")+
      '</tbody></table></div></article>';
  }

  const POP_PAL=[
    ["#69d8d4","#8ce7ed"],["#ffad78","#ffc58d"],["#b798ff","#d2b2ff"],
    ["#ff80b2","#ffa9d0"],["#76b1ff","#9fd0ff"],["#71db90","#92ecae"],
    ["#ad93f9","#cbb0fc"],["#ff8b89","#ffb3b0"],["#74c6f8","#98dfff"],
    ["#7de58b","#9ef1b1"],["#ffd265","#ffe18a"],["#f38abe","#ffb2d9"]
  ];
  function unitPopType(g,index){
    const total=Math.max(g.planned,g.details.length),missing=Math.max(0,total-g.details.length);
    const pa=POP_PAL[index%POP_PAL.length];
    const ico=typeof unitIcon==="function"?unitIcon(g.type,22):"▣";
    const vendors=vendorBreakdown(g).map(v=>{
      const unknown=/^belum/i.test(v.name);
      return '<div class="ud-pop-vendor '+(unknown?'unknown':'')+'">'+
        '<div class="ud-pop-vendor-head"><b class="ud-pop-vendor-name">Vendor: '+html(v.name)+'</b><span class="ud-pop-vendor-total"><b>'+v.total+'</b><span> unit</span></span></div>'+
        '<div class="ud-pop-table-wrap"><table class="ud-pop-table"><thead><tr><th>Merek Unit</th><th>Total</th><th>Status Operasional</th><th>Kondisi Unit</th></tr></thead><tbody>'+
        v.brands.map(b=>'<tr><td class="ud-pop-name">'+html(b.name)+'</td><td>'+b.count+'</td><td>'+unitMetrics(b.status,"status")+'</td><td>'+unitMetrics(b.kondisi,"kondisi")+'</td></tr>').join("")+
        '</tbody></table></div></div>';
    }).join("");
    return '<section class="ud-pop-type" style="--u-a:'+pa[0]+';--u-b:'+pa[1]+'" aria-label="'+html(g.type)+'">'+
      '<div class="ud-pop-head"><h3>'+ico+'<span>'+html(g.type)+'</span></h3><div><span class="ud-pop-total-label">Total: </span><strong>'+total+'</strong><span class="ud-pop-total-label"> unit</span></div></div>'+
      '<div class="ud-pop-body"><div class="ud-pop-count"><span class="ud-count-label">Total Unit</span><div><strong class="ud-count-number">'+total+'</strong><span class="ud-count-suffix">unit</span></div>'+
      '<div class="ud-count-note">'+g.details.length+' identitas terdata'+(missing?'<div>'+missing+' unit belum memiliki identitas detail</div>':'')+'</div></div>'+
      '<div class="ud-pop-vendors">'+vendors+'</div></div>'+
      '<p class="ud-pop-remark">'+(missing?'ⓘ Keterangan: '+missing+' unit belum tercatat identitasnya; vendor/merek, status atau kondisi ditampilkan sebagai belum diisi/diketahui/diperiksa.':'✓ Seluruh identitas '+g.details.length+' unit telah dicatat.')+'</p></section>';
  }
  function dashboardUnitBreakdown(){
    if(!Array.isArray(DATA.units))return "";
    const groups=groupUnitTypes();
    const grandTotal=groups.reduce((n,g)=>n+Math.max(g.planned,g.details.length),0);
    return '<div class="card ud-summary-panel"><div class="ud-pop-hero"><div><h2>POPULASI UNIT</h2>'+
      '<p>Rekap otomatis berdasarkan jenis, vendor, merek, status operasional, dan kondisi dari sheet Populasi Unit.</p></div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="ud-pop-total"><strong>'+grandTotal+'</strong><span>Total unit</span></div>'+
      ((typeof permOf!=="function"||permOf("unit","v"))?'<button type="button" class="ud-pop-source" data-go="unit">Lihat sumber data →</button>':'')+'</div></div>'+
      '<p class="ud-pop-explain">ⓘ Tabel dibaca per <b>Jenis Unit → Vendor → Merek</b>. Angka status dan kondisi adalah jumlah unit dari merek tersebut, bukan tambahan unit.</p>'+
      (groups.length?'<div class="ud-pop-list">'+groups.map(unitPopType).join("")+'</div>':'<p class="ud-small">Belum ada data unit.</p>')+
      '<p class="ud-pop-footer">Belum Diketahui = status operasional belum dicatat. Belum Diperiksa = kondisi belum dinilai. Data otomatis dari sheet Populasi Unit.</p></div>';
  }
  if(typeof window.unitBlock==="function")window.unitBlock=function(){return dashboardUnitBreakdown();};

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

  /* The viewer's chosen layout is local to the browser, never a duplicate source. */
  const UB_MODES=[
    ["extralarge","Extra large icons","▣"],
    ["large","Large icons","▣"],
    ["medium","Medium icons","▤"],
    ["small","Small icons","▦"],
    ["list","List","☷"],
    ["details","Details","☰"],
    ["tiles","Tiles","▧"],
    ["content","Content","≡"]
  ];
  const ub={view:"details",sort:"qty",search:"",select:0,details:false,preview:false,scope:""};
  function ubScope(){return location.pathname+"|"+(typeof WEB_ID==="undefined"?"main":WEB_ID);}
  function ubLoad(){
    const scope=ubScope();if(scope===ub.scope)return;
    ub.scope=scope;ub.view="details";ub.sort="qty";ub.search="";ub.select=0;ub.details=false;ub.preview=false;
    try{const v=JSON.parse(localStorage.getItem("kmb-unit-view:"+scope)||"{}");
      if(UB_MODES.some(m=>m[0]===v.view))ub.view=v.view;
      if(["qty","name","least"].includes(v.sort))ub.sort=v.sort;
      ub.details=!!v.details;ub.preview=!!v.preview;
    }catch(e){}
  }
  function ubSave(){
    try{localStorage.setItem("kmb-unit-view:"+ub.scope,JSON.stringify({view:ub.view,sort:ub.sort,details:ub.details,preview:ub.preview}));}catch(e){}
  }
  const ubCount=u=>Math.max(Number(u.jumlah)||0,recordsOf(u).length);
  function ubRows(){
    const a=(DATA.units||[]).map((u,i)=>{
      const details=recordsOf(u),vendors=[...new Set(details.map(d=>rowName(d.vendor,"Belum diisi")))];
      return {u,i,name:rowName(u.unit,"Jenis belum diisi"),count:ubCount(u),details,vendors};
    }).filter(r=>!ub.search||[r.name,...r.vendors,...r.details.flatMap(d=>[d.lambung,d.merk,d.model,d.status,d.kondisi])].join(" ").toLowerCase().includes(ub.search.toLowerCase()));
    if(ub.sort==="name")a.sort((x,y)=>x.name.localeCompare(y.name,"id"));
    else if(ub.sort==="least")a.sort((x,y)=>x.count-y.count||x.name.localeCompare(y.name,"id"));
    else a.sort((x,y)=>y.count-x.count||x.name.localeCompare(y.name,"id"));
    return a;
  }
  const ubIcon=u=>typeof unitIcon==="function"?unitIcon(u,36):"▣";
  function ubItem(r,ix){
    const sel=ub.select===r.i?"true":"false";
    const color=["#7c3aed","#2563eb","#0d9488","#ea580c","#db2777","#059669"][r.i%6];
    const text=r.details.length+" identitas · "+r.vendors.join(", ");
    const extra=ub.view==="content"?"<br>"+html(r.details.map(d=>d.lambung||d.merk||"").filter(Boolean).slice(0,6).join(" · ")||"Detail identitas belum tersedia"):"";
    return '<div class="ub-item" role="button" tabindex="0" aria-pressed="'+sel+'" data-ub-select="'+r.i+'" style="--ub-col:'+color+';--ub-bg:'+color+'17">'+
      '<span class="ub-icon">'+ubIcon(r.name)+'</span><div class="ub-label"><strong>'+html(r.name)+'</strong>'+
      '<small>'+r.count+' unit'+((ub.view==="tiles"||ub.view==="content")?" · "+html(text):"")+extra+'</small></div>'+
      (CAN_EDIT&&ub.view!=="small"&&ub.view!=="list"?'<button type="button" class="ub-action" data-eunit="'+r.i+'" title="Ubah jenis dan identitas unit">Edit</button>':"")+'</div>';
  }
  function ubTable(rows){
    return '<div class="ub-tablewrap"><table class="ub-table"><thead><tr><th>Jenis Unit</th><th>Jumlah</th><th>Terdata</th><th>Vendor</th><th>Status Operasional</th><th>Kondisi</th>'+(CAN_EDIT?'<th>Aksi</th>':'')+'</tr></thead><tbody>'+
    rows.map(r=>{
      const statuses=[...new Set(r.details.map(d=>rowName(d.status,"Belum Diketahui")))];
      const conditions=[...new Set(r.details.map(d=>rowName(d.kondisi,"Belum Diperiksa")))];
      return '<tr tabindex="0" data-ub-select="'+r.i+'" aria-pressed="'+(ub.select===r.i)+'"><td class="ub-name">'+html(r.name)+'</td>'+
        '<td>'+r.count+'</td><td>'+r.details.length+'/'+r.count+'</td><td>'+html(r.vendors.join(", ")||"Belum diisi")+'</td>'+
        '<td>'+html(statuses.join(", ")||(r.count?"Belum Diketahui":"–"))+'</td>'+
        '<td>'+html(conditions.join(", ")||(r.count?"Belum Diperiksa":"–"))+'</td>'+
        (CAN_EDIT?'<td><button type="button" class="ub-action" data-eunit="'+r.i+'">Edit</button></td>':'')+'</tr>';
    }).join("")+'</tbody></table></div>';
  }
  function ubSide(label,row){
    if(!row)return '<aside class="ub-side"><h3>'+label+'</h3><p>Pilih jenis unit di sebelah kiri untuk melihat informasi.</p></aside>';
    const first=row.details.find(d=>cleanPhoto(d.foto));
    const preview=label==="Preview pane";
    const photo=first?'<button type="button" style="padding:0;border:0;background:none;cursor:zoom-in;width:100%" data-ud-photo="'+row.i+':'+row.details.indexOf(first)+'"><img src="'+html(first.foto)+'" alt="Foto '+html(row.name)+'"></button>':'<p>Belum ada foto unit.</p>';
    return '<aside class="ub-side"><h3>'+label+'</h3>'+(preview?photo:'<h2 style="font-size:16px">'+html(row.name)+'</h2>')+
      '<dl><dt>Jumlah populasi</dt><dd>'+row.count+' unit</dd><dt>Identitas tercatat</dt><dd>'+row.details.length+' unit</dd>'+
      '<dt>Vendor</dt><dd>'+html(row.vendors.join(", ")||"Belum diisi")+'</dd>'+
      '<dt>Nomor Lambung</dt><dd>'+html(row.details.map(d=>d.lambung).filter(Boolean).join(", ")||"Belum diisi")+'</dd>'+
      '<dt>Status / Kondisi</dt><dd>'+html([...new Set(row.details.map(d=>rowName(d.status,"Belum Diketahui")+" / "+rowName(d.kondisi,"Belum Diperiksa")))].join("; ")||"Belum dicatat")+'</dd></dl>'+
      (CAN_EDIT?'<button type="button" class="ub-action" style="margin-top:12px" data-eunit="'+row.i+'">Edit Data</button>':'')+'</aside>';
  }
  function ubMenu(){
    return '<details class="ub-picker"><summary aria-label="Pilih tampilan sheet Populasi Unit">☷ View · '+html((UB_MODES.find(m=>m[0]===ub.view)||UB_MODES[5])[1])+' ▾</summary><div class="ub-menu" role="group" aria-label="Pilihan bentuk tampilan">'+
      UB_MODES.map(m=>'<button type="button" data-ub-mode="'+m[0]+'" aria-pressed="'+(ub.view===m[0])+'"><span class="ub-marker">'+(ub.view===m[0]?'●':m[2])+'</span>'+m[1]+'</button>').join("")+
      '<hr><button type="button" data-ub-pane="details" aria-pressed="'+ub.details+'"><span class="ub-marker">'+(ub.details?'●':'▤')+'</span>Details pane</button>'+
      '<button type="button" data-ub-pane="preview" aria-pressed="'+ub.preview+'"><span class="ub-marker">'+(ub.preview?'●':'▯')+'</span>Preview pane</button></div></details>';
  }
  window.pageUnit=function(D){
    ubLoad();
    const rows=ubRows(),current=(DATA.units||[])[ub.select]?DATA.units[ub.select]:null;
    const selected=rows.find(r=>r.i===ub.select)||null;
    const p={u:current,details:recordsOf(current)};
    const count=(DATA.units||[]).reduce((n,u)=>n+ubCount(u),0);
    return header("Database","Populasi Unit","Database unit operasional. Pilih View untuk mengubah bentuk tampilan tanpa mengubah data.")+
      '<div class="card"><div class="ch"><div><div class="eyebrow">Populasi Unit</div><h2>Data Unit</h2><p>Semua mode View mengambil data yang sama dan tetap dapat diedit oleh Editor/Pemilik.</p></div>'+
      '<div class="ub-right"><span class="pill live">'+count+' total unit</span>'+
      (CAN_EDIT?'<button type="button" class="btn btn-p" id="addUnit">+ Tambah Jenis Unit</button>':'')+
      (DL?'<button type="button" class="btn btn-g" data-csv="unit">Export CSV</button>':'')+'</div></div>'+
      '<div class="ub-bar"><div class="ub-left">'+ubMenu()+
      '<select id="ub-sort" class="ub-sort" aria-label="Urutkan populasi"><option value="qty" '+(ub.sort==="qty"?"selected":"")+'>Sort: Jumlah terbanyak</option>'+
      '<option value="name" '+(ub.sort==="name"?"selected":"")+'>Sort: Nama A–Z</option>'+
      '<option value="least" '+(ub.sort==="least"?"selected":"")+'>Sort: Jumlah terkecil</option></select></div>'+
      '<div class="ub-right"><input type="search" class="ub-search" id="ub-search" placeholder="Cari jenis, vendor, lambung..." value="'+html(ub.search)+'" aria-label="Cari Populasi Unit">'+
      '<span class="pill">'+rows.length+' jenis ditampilkan</span></div></div>'+
      '<div class="ub-layout '+(ub.details||ub.preview?'has-pane':'')+'"><div class="ub-main">'+
      (ub.view==="details"?ubTable(rows):'<div class="ub-items '+ub.view+'">'+rows.map(ubItem).join("")+'</div>')+
      (rows.length?'':'<p class="empty">Tidak ada data yang sesuai pencarian.</p>')+
      '</div>'+(ub.details?ubSide("Details pane",selected):'')+(ub.preview?ubSide("Preview pane",selected):'')+'</div>'+
      '<p class="ub-hint">View dapat diganti kapan saja. Pilihan tampilan tersimpan di browser ini; jumlah, vendor, status, kondisi, dan foto tetap mengacu pada data Populasi Unit.</p></div>'+
      '<details class="ub-register"><summary>▸ Buka Register Identitas & Foto Unit ('+registeredTotal()+' terdata)</summary>'+detailPanel()+'</details>';
  };

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

  /* Explorer selections and layout toggles. Standard Edit actions stay untouched. */
  document.addEventListener("click",function(ev){
    const t=ev.target,mode=t.closest("[data-ub-mode]"),pane=t.closest("[data-ub-pane]");
    if(mode||pane){
      ev.preventDefault();ev.stopImmediatePropagation();ubLoad();
      if(mode)ub.view=mode.dataset.ubMode;
      if(pane)ub[pane.dataset.ubPane]=!ub[pane.dataset.ubPane];
      ubSave();render();return;
    }
    if(t.closest("[data-eunit],[data-ud-edit],[data-ud-photo]"))return;
    const pick=t.closest("[data-ub-select]");
    if(pick&&ui.page==="unit"){
      const idx=Number(pick.dataset.ubSelect);
      if(Number.isInteger(idx)&&idx!==ub.select){ub.select=idx;render();}
    }
  },true);
  document.addEventListener("keydown",function(ev){
    if((ev.key==="Enter"||ev.key===" ")&&ev.target.matches("[data-ub-select]")){
      ev.preventDefault();ev.target.click();
    }
  });
  document.addEventListener("change",function(ev){
    if(ev.target.id==="ub-sort"){ub.sort=ev.target.value;ubSave();render();}
  });
  document.addEventListener("input",function(ev){
    if(ev.target.id!=="ub-search")return;
    const pos=ev.target.selectionStart;ub.search=ev.target.value;
    render();
    const input=document.getElementById("ub-search");
    if(input){input.focus();try{input.setSelectionRange(pos,pos);}catch(e){}}
  });

  document.addEventListener("click",e=>{
    const edit=e.target.closest("[data-ud-edit]");
    if(edit){e.preventDefault();e.stopImmediatePropagation();if(!CAN_EDIT)return;const parts=edit.dataset.udEdit.split(":").map(Number);window.unitForm(parts[0],parts[1]);return;}
    const photo=e.target.closest("[data-ud-photo]");
    if(photo){e.preventDefault();e.stopImmediatePropagation();const parts=photo.dataset.udPhoto.split(":").map(Number);const item=recordsOf(DATA.units[parts[0]])[parts[1]];const src=cleanPhoto(item?.foto);if(!src)return;const view=document.createElement("div");view.className="ud-lightbox";view.setAttribute("role","dialog");view.setAttribute("aria-label","Foto unit");view.innerHTML='<img src="'+html(src)+'" alt="'+html(item?.lambung||"Foto Unit")+'"><button type="button">Tutup Foto</button>';view.addEventListener("click",ev=>{if(ev.target!==view.querySelector("img"))view.remove();});document.body.appendChild(view);}
  },true);
})();