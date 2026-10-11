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
