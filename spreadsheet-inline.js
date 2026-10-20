/* KMB: edit cells directly like a spreadsheet. Existing backend controls permissions and saves. */
(function(){
  'use strict';
  const MPP_COLS = {1:'nama',2:'jabatan',3:'ket',4:'pic',5:'ptk',6:'aju',7:'st0',8:'st1',9:'st2',10:'st3',11:'st4',12:'st5',13:'st6',14:'due',15:'status',16:'close'};
  const MP_EDIT = new Set(['nama','jabatan','dept','level','kontrak','akhir','poh','masuk','jk','kategori','site','keluar']);
  const DATE = new Set(['aju','due','close','masuk','akhir','keluar']);
  const OPTIONS = {
    status:['','Open','Continue','Close'],
    level:['','Staff','Non Staff'],
    kontrak:['','PKWT','PKWTT','Harian Lepas'],
    jk:['','Laki - Laki','Perempuan'],
    kategori:['','Ring 1','Ring 2','Ring 3','Nasional']
  };
  let active = null;
  const view = document.getElementById('view');
  if(!view) return;
  function enabled(){
    try { return typeof WEB !== 'undefined' && WEB.ready && !WEB.noAccess; } catch(e){return false;}
  }
  function editable(){
    try { return enabled() && CAN_EDIT === true && SAVING === false; }catch(e){return false;}
  }
  function identify(){
    try {
      if(ui.page==='mpp') return 'mpp';
      if(ui.page==='karyawan') return ui.kt==='out'?'keluar':'aktif';
    }catch(e){}
    return '';
  }
  function getRecord(sheet,row){
    try { return sheet==='mpp'?DATA.positions[row]:sheet==='aktif'?DATA.aktif[row]:DATA.keluar[row]; }catch(e){return null;}
  }
  function getValue(rec,key){
    if(!rec)return '';
    if(/^st[0-6]$/.test(key))return (rec.stages||[])[Number(key.slice(2))]||'';
    return rec[key]??'';
  }
  function decorate(){
    if(!enabled() || active)return;
    const sheet=identify();
    if(!sheet)return;
    const table=view.querySelector(sheet==='mpp'?'table.mpp.full':'table.mpp');
    if(!table || !table.tBodies.length)return;
    const wrap=table.closest('.tw');
    if(!wrap)return;
    wrap.classList.add('kmb-sp-wrap');
    const card=wrap.closest('.card');
    if(!card)return;
    let banner=card.querySelector('.kmb-sp-hint');
    if(!banner){
      banner=document.createElement('div');
      banner.className='kmb-sp-hint';
      wrap.before(banner);
    }
    banner.innerHTML=editable()
      ? '<span class="kmb-sp-dot"></span><b>Edit langsung di tabel</b><span>Ketuk sel untuk mengubah · Enter menyimpan · Esc batal · Tab ke sel berikutnya. Perubahan tersimpan ke server.</span>'
      : '<span class="kmb-sp-dot kmb-sp-muted"></span><b>Tampilan spreadsheet</b><span>Hanya lihat. Untuk mengedit gunakan tautan Editor yang diberikan Pemilik.</span>';
    const rows=Array.from(table.tBodies[0].rows);
    const mpSource=sheet==='aktif'?DATA.aktif:sheet==='keluar'?DATA.keluar:null;
    const filtered=mpSource&&mpSource.filter(p=>!ui.kq || `${p.nama} ${p.jabatan} ${p.poh}`.toLowerCase().includes(ui.kq.toLowerCase()));
    const cols=sheet==='mpp'?null:MP_COLS.filter(c=>ui.allCols||c[3]).filter(c=>!(sheet==='keluar'&&c[0]==='sisa')).map(c=>c[0]);
    if(cols && sheet==='keluar')cols.push('keluar');
    let ri=0;
    rows.forEach(tr=>{
      if(tr.classList.contains('grpr')||tr.classList.contains('subr'))return;
      let index=-1;
      if(sheet==='mpp'){
        const n=Number(tr.cells[0]?.textContent.trim());
        if(Number.isInteger(n)&&n>0) index=DATA.positions.findIndex(p=>Number(p.no)===n);
      }else{
        const p=filtered?.[ri++];index=p?mpSource.indexOf(p):-1;
      }
      if(index<0)return;
      Array.from(tr.cells).forEach((td,j)=>{
        const key=sheet==='mpp'?MPP_COLS[j]:cols?.[j];
        if(!key || (sheet!=='mpp'&&!MP_EDIT.has(key)))return;
        td.classList.add('kmb-sp-cell');
        if(!editable())return;
        td.dataset.spSheet=sheet;td.dataset.spRow=String(index);td.dataset.spKey=key;
        td.tabIndex=0;td.title='Ketuk untuk edit';
        td.setAttribute('aria-label','Edit '+(table.tHead?.rows[0]?.cells[j]?.textContent.trim()||key)+' baris '+(index+1));
      });
    });
  }
  function begin(td){
    if(active||!editable())return;
    const sheet=td.dataset.spSheet,key=td.dataset.spKey,row=Number(td.dataset.spRow);
    const rec=getRecord(sheet,row); if(!rec)return;
    const original=String(getValue(rec,key));
    const c=OPTIONS[key]?document.createElement('select'):document.createElement(key==='ket'?'textarea':'input');
    c.className='kmb-sp-input';
    if(c.tagName==='INPUT')c.type=DATE.has(key)&&(!original||/^\d{4}-\d{2}-\d{2}$/.test(original))?'date':'text';
    if(c.tagName==='TEXTAREA')c.rows=3;
    if(c.tagName==='SELECT'){
      const items=[...new Set([...OPTIONS[key],original])];
      items.forEach(val=>{const o=document.createElement('option');o.value=val;o.textContent=val||'—';c.append(o);});
    }
    c.value=original;
    active={td,sheet,key,row,original,c,html:td.innerHTML,done:false};
    td.classList.add('kmb-sp-editing');td.textContent='';td.append(c);
    c.focus();if(typeof c.select==='function' && c.type!=='date')c.select();
    c.addEventListener('keydown',ev=>{
      if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();end(false);return;}
      if(ev.key==='Enter' && (c.tagName!=='TEXTAREA'||!ev.shiftKey)){
        ev.preventDefault();ev.stopPropagation();end(true);return;
      }
      if(ev.key==='Tab'){ev.preventDefault();ev.stopPropagation();end(true,ev.shiftKey?-1:1);}
    });
    c.addEventListener('blur',()=>{if(active&&active.c===c)end(true);});
  }
  async function end(save,step){
    const a=active; if(!a||a.done)return;a.done=true;
    const next=a.c.value;
    a.td.classList.remove('kmb-sp-editing');a.td.innerHTML=a.html;
    active=null;
    if(!save||next===a.original){if(step)focusNext(a,step);return;}
    if(DATE.has(a.key)&&next&&!/^\d{4}-\d{2}-\d{2}$/.test(next)){
      toast('Tanggal harus format YYYY-MM-DD.',true);return;
    }
    if((a.key==='nama'||a.key==='jabatan')&&!next.trim()&&a.sheet!=='mpp'){
      toast('Nama dan jabatan karyawan tidak boleh kosong.',true);return;
    }
    if(a.key==='jabatan'&&!next.trim()){toast('Jabatan tidak boleh kosong.',true);return;}
    const ok=await commit(S=>{
      const rec=a.sheet==='mpp'?S.positions[a.row]:a.sheet==='aktif'?S.aktif[a.row]:S.keluar[a.row];
      if(!rec)return;
      if(/^st[0-6]$/.test(a.key)){
        rec.stages=Array.isArray(rec.stages)?rec.stages:[null,null,null,null,null,null,null];
        rec.stages[Number(a.key.slice(2))]=next||null;
      }else{
        rec[a.key]=a.key==='nama'&&a.sheet==='mpp'&&!next.trim()?'Vacant':(next||null);
      }
      if(a.sheet==='mpp'&&a.key==='status'&&next==='Close'&&!rec.close)rec.close=TODAY;
    },'Sel tersimpan otomatis.');
    if(ok&&step)focusNext(a,step);
  }
  function focusNext(a,step){
    const cells=Array.from(view.querySelectorAll('td[data-sp-sheet][tabindex="0"]'));
    const i=cells.findIndex(x=>x.dataset.spSheet===a.sheet&&x.dataset.spRow===String(a.row)&&x.dataset.spKey===a.key);
    const n=cells[i+step]; if(n){n.scrollIntoView({block:'nearest',inline:'nearest'});n.focus();begin(n);}
  }
  document.addEventListener('click',e=>{
    const td=e.target.closest?.('td.kmb-sp-cell[data-sp-sheet]');
    if(td&&view.contains(td)&&!active){begin(td);}
  });
  document.addEventListener('keydown',e=>{
    const td=e.target.closest?.('td.kmb-sp-cell[data-sp-sheet]');
    if(td&&!active&&(e.key==='Enter'||e.key==='F2')){e.preventDefault();begin(td);}
  });
  const observer=new MutationObserver(()=>{if(!active)decorate();});
  observer.observe(view,{childList:true});
  decorate();
  const css=document.createElement('style');
  css.textContent=`
    .kmb-sp-hint{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;margin:0 0 12px;border:1px solid #ddd6fe;background:#faf8ff;border-radius:11px;color:#514a67;font-size:12px;line-height:1.55}
    .kmb-sp-hint b{color:#4c1d95;font-size:12px}.kmb-sp-dot{width:9px;height:9px;flex:none;border-radius:50%;background:#22c55e}.kmb-sp-dot.kmb-sp-muted{background:#9ca3af}
    .kmb-sp-wrap{overflow:auto;max-height:72vh;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;border:1px solid #eae5f4;border-radius:10px}
    .kmb-sp-wrap table{border-collapse:separate;border-spacing:0}
    .kmb-sp-wrap thead th{position:sticky;top:0;z-index:3;background:#f7f4ff;box-shadow:0 1px 0 #e4ddf1}
    .kmb-sp-wrap th:first-child{position:sticky;left:0;z-index:4;background:#f1edfb}
    .kmb-sp-wrap tbody td:first-child{position:sticky;left:0;z-index:2;background:#faf9fd}
    .kmb-sp-cell[data-sp-sheet]{cursor:text}
    .kmb-sp-cell[data-sp-sheet]:hover,.kmb-sp-cell[data-sp-sheet]:focus{background:#f0ebff!important;outline:2px solid #8b5cf6;outline-offset:-2px}
    .kmb-sp-editing{padding:2px!important;min-width:142px}
    .kmb-sp-input{width:100%;min-width:130px;min-height:34px;box-sizing:border-box;font:inherit;padding:5px 7px;border:2px solid #6d28d9;background:white;color:#241c35;border-radius:5px;outline:0}
    textarea.kmb-sp-input{min-width:240px;resize:vertical}
    @media(max-width:680px){.kmb-sp-hint{font-size:11px}.kmb-sp-wrap{max-height:68vh}.kmb-sp-cell[data-sp-sheet]{min-width:94px}.kmb-sp-wrap td:first-child{min-width:48px!important}}
    @media print{.kmb-sp-hint{display:none!important}.kmb-sp-wrap{max-height:none;overflow:visible}.kmb-sp-input{border:0}}
  `;
  document.head.append(css);
})();