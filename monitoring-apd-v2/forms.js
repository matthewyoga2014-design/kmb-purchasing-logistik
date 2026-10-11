'use strict';
function stockForm(id){
 if(!can())return;
 const r=state.stockIn.find(x=>x.id===id)||{date:today(),type:'HELM',grade:'NEW',qty:1,location:'',note:''};
 showModal(id?'Edit Stok APD':'Tambah Stok APD','<div class="notice">Hanya untuk APD yang benar-benar masuk gudang. APD lama yang sudah dimiliki karyawan dicatat melalui detail karyawan.</div><form onsubmit="saveStock(event,\''+H(id||'')+'\')"><div class="formgrid"><label>Tanggal Masuk<input type="date" name="date" required value="'+H(r.date)+'"></label><label>Jenis APD<select name="type">'+TYPES.map(t=>'<option '+(r.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Kondisi Stok<select name="grade"><option value="NEW" '+(r.grade==='NEW'?'selected':'')+'>APD Baru</option><option value="REUSE" '+(r.grade==='REUSE'?'selected':'')+'>APD Bekas Layak (Stok Awal)</option></select></label><label>Jumlah Unit<input type="number" name="qty" min="1" step="1" required value="'+r.qty+'"></label><label>Gudang / Lokasi<input name="location" value="'+H(r.location||'')+'"></label><label>Keterangan<input name="note" value="'+H(r.note||'')+'"></label></div>'+buttons(id?'Simpan Perubahan Stok':'Simpan Stok Masuk')+'</form>');
}
function saveStock(e,id){
 e.preventDefault();
 const f=Object.fromEntries(new FormData(e.target)),d=structuredClone(state);
 const value={id:id||uid(),date:f.date,type:f.type,grade:f.grade,qty:Number(f.qty),location:f.location,note:f.note};
 const ix=d.stockIn.findIndex(x=>x.id===id);if(id&&ix<0)return notice('Transaksi stok tidak ditemukan.','error');
 if(id)d.stockIn[ix]=value;else d.stockIn.push(value);
 persist(d,'Stok APD berhasil disimpan. Dashboard diperbarui.');
}
function receiptForm(personId,type,id,source){
 if(!can())return;const p=person(personId);if(!p)return notice('Karyawan tidak ditemukan. Sinkronkan Manpower.','error');
 const r=state.receipts.find(x=>x.id===id)||{person:personId,type,date:today(),qty:1,source:source||'OLD',condition:'BELUM DIPERIKSA',months:6,note:''};
 const html='<div class="notice"><b>APD LAMA:</b> catat kepemilikan sebelumnya tanpa stok gudang dan tanpa tanggal ganti. <b>APD BARU/BEKAS:</b> ambil dari stok gudang dan hitung tanggal ganti dari penerimaan terakhir.</div><form onsubmit="saveReceipt(event,\''+H(id||'')+'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(p.name)+'"><input type="hidden" name="person" value="'+H(p.id)+'"></label><label>Jobsite<input readonly value="'+H(p.site)+'"></label><label>Jenis APD<select name="type">'+TYPES.map(t=>'<option '+(r.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Jenis Pencatatan<select name="source" id="receiptSource" onchange="changeReceiptSource()"><option value="OLD" '+(r.source==='OLD'?'selected':'')+'>APD Lama (Sudah Dimiliki)</option><option value="NEW" '+(r.source==='NEW'?'selected':'')+'>APD Baru dari Gudang</option><option value="REUSE" '+(r.source==='REUSE'?'selected':'')+'>APD Bekas Layak dari Gudang</option></select></label><label>Tanggal APD Diterima<input name="date" type="date" required value="'+H(r.date)+'"></label><label>Jumlah APD<input name="qty" type="number" min="1" step="1" required value="'+r.qty+'"></label><label>Kondisi APD yang Dimiliki<select name="condition"><option '+(r.condition==='BELUM DIPERIKSA'?'selected':'')+'>BELUM DIPERIKSA</option><option '+(r.condition==='LAYAK'?'selected':'')+'>LAYAK</option><option '+(r.condition==='TIDAK LAYAK'?'selected':'')+'>TIDAK LAYAK</option></select></label><label id="monthsWrap">Jatah Penggantian (bulan)<input name="months" type="number" min="1" max="120" step="1" value="'+(r.months||6)+'" required><span class="muted" style="font-size:10px">Otomatis dihitung dari tanggal penerimaan ini</span></label><label class="wide">Keterangan / Nomor Bukti<input name="note" value="'+H(r.note||'')+'"></label></div><div class="notice" id="receiptHint"></div>'+buttons(id?'Simpan Perubahan APD':'Simpan Penerimaan APD')+'</form>';
 showModal(id?'Edit Data APD · '+p.name:'Tambah Data APD · '+p.name,html);
 changeReceiptSource();
}
function changeReceiptSource(){
 const old=el('receiptSource')?.value==='OLD',w=el('monthsWrap'),h=el('receiptHint');
 if(w){w.hidden=old;const m=w.querySelector('input');if(m)m.required=!old}
 if(h)h.innerHTML=old?'APD Lama <b>tidak akan mengurangi stok gudang</b>. Hanya stok yang sudah dipegang karyawan dan kondisinya yang tercatat.':'Pembagian APD baru/bekas <b>mengurangi stok gudang</b>. Jadwal penggantian otomatis dihitung dari tanggal penerimaan terakhir ditambah jatah bulan.';
}
function saveReceipt(e,id){
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),d=structuredClone(state);
 const value={id:id||uid(),person:f.person,type:f.type,date:f.date,qty:Number(f.qty),source:f.source,months:f.source==='OLD'?0:Number(f.months||6),condition:f.condition,note:f.note};
 const ix=d.receipts.findIndex(r=>r.id===id);if(id&&ix<0)return notice('Riwayat penerimaan tidak ditemukan.','error');
 if(id)d.receipts[ix]=value;else d.receipts.push(value);
 persist(d,'APD karyawan berhasil disimpan. Kepemilikan dan jadwal ganti diperbarui.');
}
function returnForm(id){
 if(!can())return;const r=state.receipts.find(x=>x.id===id),p=person(r?.person);
 if(!r||!p)return notice('Data penerimaan atau karyawan tidak tersedia.','error');
 if(p.status!=='OUT')return notice('Pengembalian saat resign dapat dicatat setelah status karyawan OUT pada Monitoring Manpower KMB.','error');
 const qty=held(r);if(qty<1)return notice('Semua APD dari penerimaan ini sudah selesai diproses.','error');
 showModal('Pengembalian APD · '+p.name,'<div class="notice"><b>LAYAK:</b> barang dikembalikan ke stok bekas pakai dan boleh dibagikan lagi. <b>TIDAK LAYAK:</b> dicatat musnah dan tidak masuk gudang.</div><form onsubmit="saveReturn(event,\''+H(r.id)+'\',\'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(p.name)+'"></label><label>Jenis APD<input readonly value="'+r.type+'"></label><label>Tanggal Pengembalian<input name="date" type="date" required value="'+today()+'"></label><label>Jumlah Kembali (maksimum '+qty+' unit)<input name="qty" type="number" min="1" max="'+qty+'" step="1" required value="'+qty+'"></label><label>Kondisi Fisik<input name="disabled" type="hidden" value=""><select name="action"><option value="REUSE">LAYAK — Masuk Stok Bekas</option><option value="DESTROY">TIDAK LAYAK — Musnah</option></select></label><label>Keterangan Pemeriksaan<input name="note" placeholder="Hasil pengecekan barang"></label></div>'+buttons('Simpan Pengembalian')+'</form>');
}
function returnEdit(id){
 if(!can())return;const t=state.returns.find(x=>x.id===id),r=state.receipts.find(x=>x.id===t?.receiptId);if(!t||!r)return;
 showModal('Edit Pengembalian APD','<div class="notice">Koreksi pengembalian akan otomatis memperbarui stok bekas layak atau catatan pemusnahan.</div><form onsubmit="saveReturn(event,\''+H(r.id)+'\',\''+H(id)+'\')"><div class="formgrid"><label>Karyawan<input readonly value="'+H(person(r.person)?.name||r.person)+'"></label><label>APD<input readonly value="'+r.type+'"></label><label>Tanggal<input name="date" type="date" required value="'+H(t.date)+'"></label><label>Jumlah<input name="qty" type="number" min="1" step="1" value="'+t.qty+'" required></label><label>Kondisi<select name="action"><option value="REUSE" '+(t.action==='REUSE'?'selected':'')+'>LAYAK — Stok Bekas</option><option value="DESTROY" '+(t.action==='DESTROY'?'selected':'')+'>TIDAK LAYAK — Musnah</option></select></label><label>Keterangan<input name="note" value="'+H(t.note||'')+'"></label></div>'+buttons('Simpan Koreksi Pengembalian')+'</form>');
}
function saveReturn(e,receiptId,id){
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),d=structuredClone(state);
 const x={id:id||uid(),receiptId,date:f.date,qty:Number(f.qty),action:f.action,note:f.note};
 const ix=d.returns.findIndex(t=>t.id===id);if(id&&ix<0)return notice('Riwayat pengembalian tidak ditemukan.','error');
 if(id)d.returns[ix]=x;else d.returns.push(x);
 persist(d,'Pengembalian berhasil disimpan. Status stok bekas/musnah diperbarui.');
}
async function addAccess(e){
 e.preventDefault();if(role!=='owner')return;const f=Object.fromEntries(new FormData(e.target));
 const {error}=await db.from('app_access_roles').upsert({app_id:'apd',email:f.email.trim().toLowerCase(),role:f.role},{onConflict:'app_id,email'});
 if(error)notice('Gagal menyimpan akses: '+error.message,'error');else{e.target.reset();notice('Hak akses APD disimpan.','success')}
}
