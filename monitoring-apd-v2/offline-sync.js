'use strict';
/* APD Offline Excel v1: format and guarded round-trip */
const SYNC_MAGIC='KMB_APD_OFFLINE_V1';
const SYNC_HEADERS={
 'STOK MASUK':['ID TRANSAKSI','TANGGAL MASUK','JENIS APD','KONDISI STOK','JUMLAH','LOKASI GUDANG','KETERANGAN'],
 'PENERIMAAN APD':['ID TRANSAKSI','KODE KARYAWAN','NAMA KARYAWAN','JENIS APD','ASAL APD','TANGGAL DITERIMA','JUMLAH','KONDISI APD','JATAH BULAN','KETERANGAN','JADWAL GANTI'],
 'PENGEMBALIAN':['ID PENGEMBALIAN','ID PENERIMAAN','KODE KARYAWAN','NAMA KARYAWAN','JENIS APD','TANGGAL KEMBALI','JUMLAH','KONDISI','KETERANGAN'],
 'MASTER APD':['JENIS APD','MIN STOK','SATUAN'],
 'KARYAWAN':['KODE KARYAWAN','NAMA KARYAWAN','JABATAN','JOBSITE','STATUS']
};
let pendingExcelSync=null;
const dateCell=x=>x?new Date(x+'T12:00:00'):'';
function excelSheet(rows,widths,header=true){
 const w=XLSX.utils.aoa_to_sheet(rows,{cellDates:true});
 w['!cols']=widths.map(n=>({wch:n}));
 if(header)w['!autofilter']={ref:'A5:'+XLSX.utils.encode_col(widths.length-1)+Math.max(6,rows.length)};
 return w;
}
function putSheet(book,name,title,note,headers,records,widths){
 const rows=[[title],[note],[],[],headers,...records,...Array.from({length:60},()=>Array(headers.length).fill(''))];
 const w=excelSheet(rows,widths);
 const end=headers.length-1;
 w['!merges']=[{s:{r:0,c:0},e:{r:0,c:end}},{s:{r:1,c:0},e:{r:1,c:end}}];
 XLSX.utils.book_append_sheet(book,w,name);return w;
}
function exportExcel(){
 if(!user||!role)return showNotice('Masuk dahulu untuk Download Excel.','error');
 if(!window.XLSX?.utils)return showNotice('Modul Excel belum siap. Periksa koneksi internet.','error');
 const book=XLSX.utils.book_new();
 const help=[['MONITORING APD KMB | EXCEL OFFLINE'],['Versi '+SYNC_MAGIC],[],['LANGKAH 1','Download file terbaru ketika online.'],['LANGKAH 2','Isi tabel STOK MASUK, PENERIMAAN APD, PENGEMBALIAN.'],['LANGKAH 3','APD LAMA tidak mengurangi gudang / tidak memunculkan jadwal ganti.'],['LANGKAH 4','BARU dan BEKAS LAYAK mengurangi gudang dan menghitung jadwal ganti.'],['LANGKAH 5','Pemilik → Pengaturan → Sinkronkan dengan Excel → unggah file → konfirmasi.'],['PERINGATAN','Jika revisi website berubah, impor ditolak agar tidak menimpa data terbaru.'],['ID TRANSAKSI','Untuk baris baru, biarkan ID kosong. Jangan hapus ID lama.'],['PENGEMBALIAN','Gunakan ID penerimaan yang sudah ada, unduh file terbaru sebelum mencatat pengembalian.'],['SYNC META','Jangan mengubah sheet SYNC META atau nama dan urutan kolom.']];
 XLSX.utils.book_append_sheet(book,excelSheet(help,[29,95],false),'PANDUAN');
 const summary=[['DASHBOARD APD KMB'],['Saldo gudang dan APD milik karyawan'],[],[],['Jenis APD','Stok Baru','Stok Bekas Layak','Total Gudang','Dipegang Karyawan','Minimal Stok'],...TYPES.map(t=>{const x=stock(t);return [t,x.NEW,x.REUSE,x.NEW+x.REUSE,people.reduce((n,p)=>n+held(p.id,t),0),Number(state.limits?.[t]||0)]})];
 XLSX.utils.book_append_sheet(book,excelSheet(summary,[22,20,22,20,23,19]),'DASHBOARD');
 const stocks=state.stockIn.map(x=>[x.id,dateCell(x.date),x.type,x.grade==='NEW'?'BARU':'BEKAS LAYAK',Number(x.qty),x.location||'',x.note||'']);
 putSheet(book,'STOK MASUK','STOK APD MASUK','Catat persediaan gudang; baris baru biarkan ID kosong.',SYNC_HEADERS['STOK MASUK'],stocks,[39,20,18,22,15,26,43]);
 const rec=state.receipts.map(x=>[x.id,x.person,personName(x.person),x.type,x.source==='OLD'?'APD LAMA':x.source==='NEW'?'BARU':'BEKAS LAYAK',dateCell(x.date),Number(x.qty),x.condition||'BELUM DIPERIKSA',x.source==='OLD'?'':Number(x.months||6),x.note||'','']);
 const sheet=putSheet(book,'PENERIMAAN APD','PENERIMAAN APD KARYAWAN','APD lama tercatat tanpa gudang. Jadwal ganti mengikuti pembagian terakhir.',SYNC_HEADERS['PENERIMAAN APD'],rec,[39,32,32,17,24,21,16,24,19,42,22]);
 for(let row=6;row<6+rec.length+60;row++)sheet['K'+row]={t:'n',f:'IF(OR(E'+row+'="APD LAMA",F'+row+'="",I'+row+'=""),"",EDATE(F'+row+',I'+row+'))',z:'yyyy-mm-dd'};
 const ret=state.returns.map(x=>{const r=state.receipts.find(a=>a.id===x.receiptId);return [x.id,x.receiptId,r?.person||'',r?personName(r.person):'',r?.type||'',dateCell(x.date),Number(x.qty),x.action==='REUSE'?'LAYAK':'TIDAK LAYAK',x.note||'']});
 putSheet(book,'PENGEMBALIAN','PENGEMBALIAN APD','Gunakan ID PENERIMAAN asal dan hasil pemeriksaan.',SYNC_HEADERS.PENGEMBALIAN,ret,[39,39,31,30,19,20,16,21,42]);
 putSheet(book,'MASTER APD','MASTER STOK APD','Masukkan stok minimum untuk masing-masing jenis.',SYNC_HEADERS['MASTER APD'],TYPES.map(t=>[t,Number(state.limits?.[t]||0),t==='SEPATU'?'PASANG':'UNIT']),[25,19,21]);
 putSheet(book,'KARYAWAN','DAFTAR MANPOWER KMB','Referensi karyawan saat Excel diunduh. Karyawan aktual mengikuti website.',SYNC_HEADERS.KARYAWAN,people.map(p=>[p.id,p.name,p.position,p.site,p.status]),[33,32,26,32,19]);
 XLSX.utils.book_append_sheet(book,excelSheet([[SYNC_MAGIC,'JANGAN UBAH'],['APP_ID','apd'],['BASE_REVISION',revision],['EXPORTED_AT',new Date().toISOString()],['SYNC_VERSION',1]], [35,58],false),'SYNC META');
 for(const tab of ['STOK MASUK','PENERIMAAN APD','PENGEMBALIAN']){
  const s=book.Sheets[tab],column=tab==='STOK MASUK'?'B':'F',used=tab==='STOK MASUK'?stocks.length:tab==='PENERIMAAN APD'?rec.length:ret.length;
  for(let i=6;i<6+used;i++)if(s[column+i])s[column+i].z='yyyy-mm-dd';
 }
 try{XLSX.writeFile(book,'Monitoring_APD_KMB_Offline_Rev'+revision+'_'+today()+'.xlsx',{compression:true,cellDates:true})}
 catch(e){showNotice('Gagal menyimpan file Excel: '+e.message,'error')}
}


function excelText(v){return v===null||v===undefined?'':String(v).trim()}
function excelDate(v){
 if(v instanceof Date){
  if(Number.isNaN(v.getTime()))throw Error('Tanggal Excel tidak valid.');
  return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
 }
 if(typeof v==='number'&&v>10000){
  const d=XLSX.SSF.parse_date_code(v);
  if(d?.y&&d?.m&&d?.d)return d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
 }
 const txt=excelText(v);
 let match=txt.match(/^(\d{4})-(\d\d)-(\d\d)$/);
 if(match){const d=new Date(txt+'T12:00:00');if(!Number.isNaN(d.getTime())&&d.getFullYear()===Number(match[1])&&d.getMonth()+1===Number(match[2])&&d.getDate()===Number(match[3]))return txt}
 match=txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(match){
  const out=match[3]+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');
  return excelDate(out);
 }
 throw Error('Tanggal "'+txt+'" tidak valid. Gunakan YYYY-MM-DD.');
}
function integerExcel(v,label,row,zero=false){
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n<(zero?0:1))throw Error(label+' pada baris '+row+' harus bilangan bulat '+(zero?'≥0':'minimal 1')+'.');
 return n;
}
function scanSheet(book,name){
 const sheet=book.Sheets[name];
 if(!sheet)throw Error('Sheet '+name+' tidak ditemukan.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:true});
 const headers=SYNC_HEADERS[name],r=rows[4]||[];
 for(let i=0;i<headers.length;i++)if(excelText(r[i]).toUpperCase()!==headers[i])throw Error('Header '+name+' tidak cocok pada kolom '+(i+1)+'. Jangan ubah template.');
 const cols=name==='PENERIMAAN APD'?10:headers.length;
 return rows.slice(5).filter(row=>row.slice(0,cols).some(v=>excelText(v)!==''));
}
function knownIds(original,items,name){
 const old=new Set(original.map(x=>x.id));
 const uploaded=new Set(items.map(x=>x.id).filter(Boolean));
 for(const x of old)if(!uploaded.has(x))throw Error('ID '+x+' hilang dari '+name+'. Impor tidak menghapus riwayat. Unduh Excel terbaru.');
 for(const id of uploaded)if(!old.has(id))throw Error('ID '+id+' tidak dikenal pada '+name+'. Kosongkan kolom ID untuk baris baru.');
}
function parseSyncWorkbook(book){
 const sheet=book.Sheets['SYNC META'];
 if(!sheet)throw Error('SYNC META tidak ditemukan.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});
 if(excelText(rows[0]?.[0])!==SYNC_MAGIC||excelText(rows[1]?.[1])!=='apd')throw Error('File tidak dibuat untuk Monitoring APD KMB terbaru.');
 const base=Number(rows[2]?.[1]);
 if(!Number.isSafeInteger(base)||base<0)throw Error('Revisi pada SYNC META tidak valid.');
 if(base!==revision)throw Error('File Excel revisi '+base+' tetapi website revisi '+revision+'. Unduh file terbaru supaya perubahan tidak tertimpa.');
 const rawStock=scanSheet(book,'STOK MASUK'),rawReceipt=scanSheet(book,'PENERIMAAN APD'),rawReturn=scanSheet(book,'PENGEMBALIAN'),rawMaster=scanSheet(book,'MASTER APD');
 knownIds(state.stockIn,rawStock.map(r=>({id:excelText(r[0])})),'STOK MASUK');
 knownIds(state.receipts,rawReceipt.map(r=>({id:excelText(r[0])})),'PENERIMAAN APD');
 knownIds(state.returns,rawReturn.map(r=>({id:excelText(r[0])})),'PENGEMBALIAN');
 const ids=new Set();
 function transactionId(value,label,row){
  const existing=excelText(value),id=existing||uid();
  if(ids.has(id))throw Error('ID ganda pada '+label+' baris '+row);
  ids.add(id);return id;
 }
 function apdType(value,label,row){
  const v=excelText(value).toUpperCase();
  if(!TYPES.includes(v))throw Error('Jenis APD di '+label+' baris '+row+' harus HELM, KAOS atau SEPATU.');
  return v;
 }
 const stockIn=rawStock.map((r,i)=>{
  const row=i+6,t=apdType(r[2],'STOK MASUK',row),g=excelText(r[3]).toUpperCase();
  if(!['BARU','BEKAS LAYAK'].includes(g))throw Error('Kondisi STOK MASUK baris '+row+' harus BARU / BEKAS LAYAK.');
  return {id:transactionId(r[0],'STOK MASUK',row),date:excelDate(r[1]),type:t,grade:g==='BARU'?'NEW':'REUSE',qty:integerExcel(r[4],'Jumlah Stok',row),location:excelText(r[5]),note:excelText(r[6])};
 });
 const receipts=rawReceipt.map((r,i)=>{
  const row=i+6,t=apdType(r[3],'PENERIMAAN APD',row),mode=excelText(r[4]).toUpperCase();
  if(!['APD LAMA','BARU','BEKAS LAYAK'].includes(mode))throw Error('Asal APD tidak valid baris '+row+'.');
  const pid=excelText(r[1])||cleanName(r[2]),employee=person(pid);
  if(!employee)throw Error('Karyawan '+excelText(r[2])+' pada baris '+row+' tidak ditemukan dalam Monitoring Manpower KMB.');
  const condition=excelText(r[7]).toUpperCase()||'BELUM DIPERIKSA';
  if(!['BELUM DIPERIKSA','LAYAK','TIDAK LAYAK'].includes(condition))throw Error('Kondisi APD tidak valid baris '+row+'.');
  const old=mode==='APD LAMA';
  const months=old?0:integerExcel(r[8],'Jatah penggantian',row);
  if(months>120)throw Error('Jatah penggantian maksimal 120 bulan pada baris '+row+'.');
  return {id:transactionId(r[0],'PENERIMAAN APD',row),person:employee.id,type:t,source:old?'OLD':mode==='BARU'?'NEW':'REUSE',date:excelDate(r[5]),qty:integerExcel(r[6],'Jumlah penerimaan',row),condition,months,note:excelText(r[9])};
 });
 const receiptIndex=new Map(receipts.map(x=>[x.id,x]));
 const returns=rawReturn.map((r,i)=>{
  const row=i+6,receiptId=excelText(r[1]),original=receiptIndex.get(receiptId);
  if(!original)throw Error('PENGEMBALIAN baris '+row+': ID PENERIMAAN tidak tersedia. Sinkronkan penerimaan baru dulu, kemudian Download Excel terbaru.');
  if(excelText(r[2])&&excelText(r[2])!==original.person)throw Error('Karyawan pengembalian tidak sesuai baris '+row+'.');
  if(excelText(r[4])&&apdType(r[4],'PENGEMBALIAN',row)!==original.type)throw Error('Jenis pengembalian tidak sesuai baris '+row+'.');
  const grade=excelText(r[7]).toUpperCase();
  if(!['LAYAK','TIDAK LAYAK'].includes(grade))throw Error('Kondisi pengembalian baris '+row+' harus LAYAK / TIDAK LAYAK.');
  return {id:transactionId(r[0],'PENGEMBALIAN',row),receiptId,date:excelDate(r[5]),qty:integerExcel(r[6],'Jumlah kembali',row),action:grade==='LAYAK'?'REUSE':'DESTROY',note:excelText(r[8])};
 });
 const limits={...state.limits},seenMaster=new Set();
 for(let i=0;i<rawMaster.length;i++){
  const row=i+6,t=apdType(rawMaster[i][0],'MASTER APD',row);
  if(seenMaster.has(t))throw Error('MASTER APD berisi jenis ganda '+t);
  seenMaster.add(t);limits[t]=integerExcel(rawMaster[i][1],'Minimal stok',row,true);
 }
 for(const t of TYPES)if(!seenMaster.has(t))throw Error('MASTER APD kurang '+t+'.');
 const next=structuredClone(state);
 next.stockIn=stockIn;next.receipts=receipts;next.returns=returns;next.limits=limits;
 const error=validate(next);if(error)throw Error('Validasi APD gagal: '+error);
 return {base,next,counts:{stock:stockIn.length,receipts:receipts.length,returns:returns.length}};
}
async function importOfflineExcel(input){
 if(role!=='owner')return showNotice('Hanya Pemilik dapat sinkron dengan Excel.','error');
 const file=input.files?.[0];if(!file)return;
 if(!/\.xlsx$/i.test(file.name))return showNotice('Gunakan file Excel XLSX dari template APD KMB.','error');
 if(file.size>10*1024*1024)return showNotice('Ukuran Excel maksimal 10 MB.','error');
 try{
  const content=await file.arrayBuffer();
  const book=XLSX.read(content,{type:'array',cellDates:true});
  const {data,error}=await db.from('apd_state').select('revision').eq('id','main').single();
  if(error)throw Error('Gagal memeriksa database: '+error.message);
  if(Number(data.revision)!==revision)throw Error('Data website baru diperbarui. Klik Sinkronkan, download Excel terbaru lalu ulangi.');
  const parsed=parseSyncWorkbook(book);pendingExcelSync=parsed;
  modal('Konfirmasi Sinkronisasi Excel',
  '<div class="notice">File tervalidasi. Periksa data sebelum disimpan ke website. Foto APD, hak akses pengguna, dan data Manpower tidak diganti.</div><div class="stat-row"><div class="mini-stat"><small>Stok Masuk</small><b>'+parsed.counts.stock+'</b></div><div class="mini-stat"><small>Penerimaan APD</small><b>'+parsed.counts.receipts+'</b></div><div class="mini-stat"><small>Pengembalian</small><b>'+parsed.counts.returns+'</b></div><div class="mini-stat"><small>Revisi</small><b>'+revision+'</b></div></div><p class="muted">Semua transaksi lama harus tetap ada. Transaksi dengan ID kosong dianggap transaksi baru. Jika ada perubahan web selama proses ini, penyimpanan akan otomatis ditolak.</p><div class="formactions"><button class="btn" onclick="pendingExcelSync=null;closeModal()">Batal</button><button class="btn dark" onclick="confirmOfflineSync()">Konfirmasi & Simpan ke Web</button></div>');
 }catch(e){pendingExcelSync=null;showNotice('Excel belum disinkronkan: '+e.message,'error')}
 finally{input.value=''}
}
async function confirmOfflineSync(){
 if(role!=='owner'||!pendingExcelSync)return;
 const prepared=pendingExcelSync;pendingExcelSync=null;
 if(prepared.base!==revision)return showNotice('Data telah berubah. Download Excel terbaru.','error');
 await persist(prepared.next,'Sinkronisasi Excel selesai dan tersimpan di web. Download Excel terbaru untuk revisi berikutnya.');
}
function ownerOfflineSyncPanel(){
 if(role!=='owner')return '';
 return '<section class="panel offline-sync-panel"><div class="section-head"><div><h3>⇄ Sinkronkan dengan Excel Offline</h3><p>Fitur khusus Pemilik untuk impor data offline.</p></div><span class="role-tag owner">PEMILIK</span></div><div class="notice">Langkah: Download Excel terbaru → Edit offline → Simpan → Upload file di sini → Periksa jumlah transaksi → Konfirmasi. <b>Jika data web berubah, impor akan ditolak untuk melindungi data.</b></div><div class="offline-sync-actions"><button class="btn dark" onclick="exportExcel()">⇩ Download Excel Terbaru</button><label class="btn offline-file-picker">↑ Pilih Excel untuk Sinkronkan<input type="file" accept=".xlsx" onchange="importOfflineExcel(this)" hidden></label></div><p class="muted" style="font-size:11px;margin-top:12px">Revisi saat ini: <b>'+revision+'</b>. Gambar APD dan hak akses tidak berubah saat sinkronisasi.</p></section>';
}
