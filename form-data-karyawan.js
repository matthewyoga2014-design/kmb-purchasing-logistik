/* Cetak "Form Data Karyawan" (Lampiran 1) — kosong atau terisi data karyawan.
 * Format: Word (.docx), Excel (.xlsx, dari template asli forms/form-data-karyawan.xlsx) dan PDF / Print.
 * Dipakai di portal "Monitoring MPP Achievement All Jobsite" (form kosong) dan halaman MP Aktif
 * tiap portal Manpower (form terisi per karyawan). Tombol & menu tidak ikut tercetak.
 *
 *  <button data-fdk-blank>…</button>                 → form kosong
 *  <button data-fdk='{"nama":"…","jabatan":"…"}'>…    → form terisi (nama, nik, jabatan, dept, lokasi,
 *                                                       poh, masuk, jk, kontrak, akhir, pendidikan, email)
 */
(function () {
  'use strict';
  if (window.KMBFormKaryawan) return;
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  const TEMPLATE = new URL('forms/form-data-karyawan.xlsx', SRC).href;
  const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const xesc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tgl = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : String(s || ''); };

  /* ---------- data karyawan → isian form ---------- */
  function splitLines(t, lens) {
    const out = []; let rest = String(t || '').replace(/\s+/g, ' ').trim();
    lens.forEach((n, i) => {
      if (!rest) { out.push(''); return; }
      if (i === lens.length - 1 || rest.length <= n) { out.push(rest); rest = ''; return; }
      let cut = rest.lastIndexOf(' ', n); if (cut < n * 0.5) cut = n;
      out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
    });
    return out;
  }
  function kawin(v) {
    const t = String(v || '').trim(), k = t.match(/^K\s*\/?\s*(\d)/i), o = { kBelum: false, kMenikah: false, kDuda: false, kN: -1 };
    if (!t) return o;
    if (/duda|janda|cerai|^HB/i.test(t)) o.kDuda = true;
    else if (k) { o.kMenikah = true; o.kN = +k[1]; }
    else if (/^TK|belum|lajang|single/i.test(t)) o.kBelum = true;
    else if (/^kawin|menikah|married/i.test(t)) o.kMenikah = true;
    return o;
  }
  function norm(e) {
    e = e || {};
    const jk = String(e.jk || '');
    const st = String(e.kontrak || e.status || '');
    return {
      nama: e.nama || '', nik: e.nik || e.nrp || e.nip || '', jabatan: e.jabatan || '', dept: e.dept || '',
      lokasi: e.lokasi || e.site || '', poh: e.poh || '', masuk: tgl(e.masuk), pendidikan: e.pendidikan || '',
      email: e.emailKantor || '', tempat: e.tempatLahir || '', lahir: tgl(e.lahir), agama: e.agama || '',
      L: /^(l|laki|pria|male)/i.test(jk), P: /^(p|perempuan|wanita|female)/i.test(jk),
      tetap: /tetap|pkwtt|permanen/i.test(st), kontrak: !/tetap|pkwtt|permanen/i.test(st) && /kontrak|pkwt|probation|percobaan|harian|magang/i.test(st),
      akhir: e.akhir ? tgl(e.akhir) : '', filled: !!e.nama,
      ktp: e.ktp || '', kk: e.kk || '', npwp: e.npwp || '', hp: e.hp || '', bpjsKes: e.bpjsKes || '', bpjsTk: e.bpjsTk || '',
      bank: e.bank || '', rek: e.rek || '', rekNama: e.rekNama || '', sim: e.sim || '', noSim: e.noSim || '', darah: e.darah || '',
      alamat: splitLines(e.alamat, [32, 58, 58]), dom: splitLines(e.alamatDom, [32, 58, 58]),
      ...kawin(e.kawin), ortu: e.ortu || [], sdr: e.sdr || [], em: e.em || [],
    };
  }

  /* ---------- tampilan HTML (dipakai untuk Word & PDF) — gaya inline supaya Word membacanya sama ---------- */
  const F = 'font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;color:#000;';
  const TD = F + 'padding:0.6pt 3pt;vertical-align:bottom;line-height:1.15;mso-line-height-rule:exactly;';
  const TBL = 'border-collapse:collapse;width:100%;';
  const LN = 'border-bottom:1px solid #000;';
  const BOX = 'border:1px solid #000;';
  function formHtml(d) {
    const box = (on) => on ? '&#9746;' : '&#9744;';
    const td = (st, html, attr) => `<td style="${TD}${st || ''}"${attr ? ' ' + attr : ''}>${html ?? ''}</td>`;
    const lb = (t) => td('width:18%;white-space:nowrap;', t);
    const cl = (t) => td('width:2%;text-align:center;', t ? ':' : '');
    const gp = () => td('width:3%;', '');
    const ln = (x, st) => td(LN + 'width:27%;' + (st || ''), x === '' || x == null ? '&nbsp;' : esc(x));
    const ck = (html, ind) => td('white-space:nowrap;' + (ind ? 'padding-left:14pt;' : ''), html);
    const tr = (cells, h) => `<tr style="height:${h || 12}pt">${cells}</tr>`;
    const row = (l1, x1, l2, x2) => tr(lb(l1) + cl(l1) + (l1 ? ln(x1) : td('', '')) + gp() + lb(l2) + cl(l2) + (l2 ? ln(x2) : td('', '')));
    const sec = (rows) => `<table style="${TBL}${BOX}border-top:0;" cellspacing="0" cellpadding="0">${tr(td('', '', 'colspan="7" style="height:2pt"'), 2)}${rows}${tr(td('', '', 'colspan="7"'), 3)}</table>`;
    const tcell = (x, st, attr) => `<td style="${TD}${BOX}height:10pt;vertical-align:middle;${st || ''}"${attr ? ' ' + attr : ''}>${x ?? '&nbsp;'}</td>`;
    const th = (x, w, attr) => tcell(x, 'text-align:center;' + (w ? 'width:' + w + ';' : ''), attr);
    const grid = (heads, ws, n, data) => `<table style="${TBL}margin-top:5pt;" cellspacing="0" cellpadding="0"><tr>${heads.map((h, k) => th(h, ws[k])).join('')}</tr>${Array.from({ length: n }, (_, i) => `<tr>${tcell((i + 1) + '.')}${heads.slice(1).map((h, k) => { const v = ((data || [])[i] || [])[k]; return tcell(v ? esc(v) : '&nbsp;', k === 2 ? 'text-align:center;' : ''); }).join('')}</tr>`).join('')}</table>`;
    const fam = (t, n, data) => grid(['No.', t, 'Tanggal Lahir', 'L/P', 'Pendidikan', 'Pekerjaan'], ['6%', '30%', '13%', '6%', '22%', '23%'], n, data);
    const mini = (t) => `<tr><td style="${TD}width:40%;padding:0.5pt 3pt;">${t}</td><td style="${TD}width:6%;padding:0.5pt 0;">:</td><td style="${TD}padding:0.5pt 3pt;"></td></tr>`;
    return `<div style="${F}">
<table style="${TBL}${BOX}" cellspacing="0" cellpadding="0"><tr><td style="${F}font-weight:bold;font-size:12pt;text-align:center;vertical-align:middle;border-right:1px solid #000;width:72%;height:48pt;">FORM DATA KARYAWAN</td>
<td style="${F}vertical-align:top;padding:1pt 0;"><table style="${TBL}" cellspacing="0" cellpadding="0">${mini('No.')}${mini('Tgl.')}${mini('Rev.')}${mini('Tgl. Rev.')}</table></td></tr></table>
${sec(
  row('Nama Lengkap', d.nama, 'Tanggal Masuk Kerja', d.masuk) +
  tr(lb('NIK Karyawan') + cl(1) + ln(d.nik) + gp() + lb('Jenis Kelamin') + cl(1) + ck(box(d.L) + ' Laki - Laki')) +
  tr(lb('Jabatan') + cl(1) + ln(d.jabatan) + gp() + lb('') + cl(0) + ck(box(d.P) + ' Perempuan')) +
  tr(lb('Departemen') + cl(1) + ln(d.dept) + gp() + lb('Status Karyawan') + cl(1) + ck(box(d.tetap) + ' Tetap')) +
  tr(lb('Lokasi Kerja') + cl(1) + ln(d.lokasi) + gp() + lb('') + cl(0) + ck(box(d.kontrak) + ' Kontrak')) +
  tr(lb('Point Of Hire') + cl(1) + ln(d.poh) + gp() + lb('') + cl(0) + td(LN + 'text-align:center;', 's/d &nbsp;' + esc(d.akhir))))}
${sec(
  row('Alamat KTP', d.alamat[0], 'Email Pribadi', '') +
  tr(td(LN, esc(d.alamat[1]) || '&nbsp;', 'colspan="3"') + gp() + lb('Email Perusahaan') + cl(1) + ln(d.email)) +
  tr(td(LN, esc(d.alamat[2]) || '&nbsp;', 'colspan="3"') + gp() + lb('Tempat Lahir') + cl(1) + ln(d.tempat)) +
  row('Alamat Domisili', d.dom[0], 'Tanggal Lahir', d.lahir) +
  tr(td(LN, esc(d.dom[1]) || '&nbsp;', 'colspan="3"') + gp() + lb('Agama') + cl(1) + ln(d.agama)) +
  tr(td(LN, esc(d.dom[2]) || '&nbsp;', 'colspan="3"') + gp() + lb('Pendidikan Terakhir') + cl(1) + ln(d.pendidikan)))}
${sec(
  tr(lb('Status Pernikahan') + cl(1) + ck(box(d.kBelum) + ' Belum Menikah') + gp() + lb('No. Handphone') + cl(1) + ln(d.hp)) +
  tr(lb('') + cl(0) + ck(box(d.kMenikah) + ' Menikah') + gp() + lb('No. KTP') + cl(1) + ln(d.ktp)) +
  tr(lb('') + cl(0) + ck(box(d.kN === 0) + ' K/0 &nbsp;&nbsp; ' + box(d.kN === 3) + ' K/3', 1) + gp() + lb('No. KK') + cl(1) + ln(d.kk)) +
  tr(lb('') + cl(0) + ck(box(d.kN === 1) + ' K/1 &nbsp;&nbsp; ' + box(d.kN === 4) + ' K/4', 1) + gp() + lb('No. NPWP') + cl(1) + ln(d.npwp)) +
  tr(lb('') + cl(0) + ck(box(d.kN === 2) + ' K/2 &nbsp;&nbsp; ' + box(d.kN >= 5) + ' K/5', 1) + gp() + lb('No. BPJS Kes.') + cl(1) + ln(d.bpjsKes)) +
  tr(lb('') + cl(0) + ck(box(d.kDuda) + ' Duda - Janda') + gp() + lb('No. BPJS TK') + cl(1) + ln(d.bpjsTk)) +
  tr(td('', '', 'colspan="7"'), 6) +
  row('Nama Bank', d.bank, 'Jenis SIM', d.sim) + row('No. Rekening', d.rek, 'No. SIM', d.noSim) + row('Nama Rekening', d.rekNama, 'Gol. Darah', d.darah))}
${fam('Nama Orang Tua', 2, d.ortu)}${fam('Nama Saudara Kandung', 5, d.sdr)}${fam('Nama Suami / Istri', 1)}${fam('Nama Anak', 5)}
<table style="${TBL}margin-top:5pt;" cellspacing="0" cellpadding="0"><tr>${th('No.', '6%', 'rowspan="2"')}${th('Pendidikan', '24%', 'rowspan="2"')}${th('Tahun', '16%', 'colspan="2"')}${th('Nama Sekolah', '30%', 'rowspan="2"')}${th('Jurusan / Fakultas', '24%', 'rowspan="2"')}</tr><tr>${th('Dari')}${th('Sampai')}</tr>
${Array.from({ length: 5 }, (_, i) => `<tr>${tcell((i + 1) + '.')}${tcell()}${tcell()}${tcell()}${tcell()}${tcell()}</tr>`).join('')}</table>
<table style="${TBL}margin-top:5pt;" cellspacing="0" cellpadding="0"><tr>${tcell('Keluarga Yang Bisa Dihubungi (Emergency Call)', '', 'colspan="4"')}</tr><tr>${th('No.', '6%')}${th('Nama', '38%')}${th('Hubungan', '28%')}${th('No. Handphone', '28%')}</tr>
${[0, 1].map((i) => { const r = d.em[i] || []; return `<tr>${tcell((i + 1) + '.')}${tcell(r[0] ? esc(r[0]) : '&nbsp;')}${tcell(r[1] ? esc(r[1]) : '&nbsp;')}${tcell(r[2] ? esc(r[2]) : '&nbsp;')}</tr>`; }).join('')}</table>
<table style="${TBL}margin-top:6pt;" cellspacing="0" cellpadding="0">${tr(lb('') + cl(0) + ln('') + gp() + lb('') + cl(0) + td('', ''), 26)}
${tr(lb('Nama') + cl(1) + ln(d.nama) + gp() + lb('Tanda Tangan') + cl(1) + ln(''), 16)}</table>
</div>`;
  }
  const CSS = '';
  const widthAttrs = (h) => h.replace(/<(td|table)([^>]*?)style="([^"]*?)"/g, (m, tag, pre, st) => {
    const w = st.match(/(?:^|;)width:([\d.]+%)/); return w && !/\swidth=/.test(pre) ? `<${tag}${pre} width="${w[1]}" style="${st}"` : m;
  });
  function pageDoc(d, forWord) {
    const title = 'Form Data Karyawan' + (d.nama ? ' - ' + d.nama : '');
    const head = forWord
      ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page WordSection1{size:21cm 29.7cm;margin:1.4cm 1.6cm 1.2cm 1.6cm}div.WordSection1{page:WordSection1}${CSS}</style></head><body><div class="WordSection1">`
      : `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:10mm 13mm}html,body{margin:0;background:#fff}${CSS}
.bar{font:13px/1.4 system-ui,sans-serif;background:#F5F0FF;border-bottom:1px solid #DDD0FA;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bar button{font:600 13px system-ui,sans-serif;border:0;border-radius:8px;padding:8px 14px;background:#6D28D9;color:#fff;cursor:pointer}
.pg{max-width:190mm;margin:14px auto}@media print{.bar{display:none}.pg{margin:0;max-width:none}}</style></head><body>
<div class="bar"><button onclick="print()">Print / Simpan PDF</button><span>Pilih printer <b>Simpan sebagai PDF</b> untuk menyimpan file PDF.</span></div><div class="pg">`;
    return head + (forWord ? widthAttrs(formHtml(d)) : formHtml(d)) + (forWord ? '</div></body></html>' : '</div><script>window.onload=function(){setTimeout(function(){print()},350)}<\/script></body></html>');
  }
  function fileName(d, ext) { return ('Form Data Karyawan' + (d.nama ? ' - ' + d.nama : '')).replace(/[\\/:*?"<>|]+/g, '-') + '.' + ext; }
  function saveBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  /* ---------- Excel: isi template asli (format, garis, checkbox tetap) ---------- */
  const CELLS = { nama: 'I7', nik: 'I8', jabatan: 'I9', dept: 'I10', lokasi: 'I11', poh: 'I12', masuk: 'AB7', akhir: 'AG12',
    email: 'AB15', tempat: 'AB16', lahir: 'AB17', agama: 'AB18', pendidikan: 'AB19', ttdNama: 'I69',
    hp: 'AB21', ktp: 'AB22', kk: 'AB23', npwp: 'AB24', bpjsKes: 'AB25', bpjsTk: 'AB26', sim: 'AB28', noSim: 'AB29', darah: 'AB30',
    bank: 'I28', rek: 'I29', rekNama: 'I30', al0: 'I14', al1: 'C15', al2: 'C16', do0: 'I17', do1: 'C18', do2: 'C19' };
  const CHECKS = { L: 1, P: 2, tetap: 3, kontrak: 4, kBelum: 5, kMenikah: 6, k0: 7, k1: 8, k2: 9, k3: 10, k4: 11, k5: 12, kDuda: 13 }; // ctrlPropN.xml
  const TROWS = { ortu: [34, 2], sdr: [38, 5] }, TCOLS = ['D', 'O', 'T', 'V', 'AD'], EMROW = 64, EMCOLS = ['D', 'Q', 'AB'];
  function setCell(xml, ref, val) {
    if (val === '' || val == null) return xml;
    const inl = `t="inlineStr"><is><t xml:space="preserve">${xesc(val)}</t></is></c>`;
    const re = new RegExp(`<c r="${ref}"((?:\\s+s="\\d+")?)(?:\\s+t="\\w+")?\\s*(?:/>|>[\\s\\S]*?</c>)`);
    if (re.test(xml)) return xml.replace(re, (m, s) => `<c r="${ref}"${s} ${inl}`);
    const row = ref.replace(/^[A-Z]+/, '');
    const rre = new RegExp(`(<row r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`);
    const colN = (r) => r.replace(/\d+/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    return xml.replace(rre, (m, a, body, z) => {
      const cells = body.match(/<c r="[A-Z]+\d+"[\s\S]*?(?:\/>|<\/c>)/g) || [];
      const mine = `<c r="${ref}" ${inl}`;
      let i = cells.findIndex((c) => colN(c.match(/r="([A-Z]+)\d+"/)[1]) > colN(ref)); if (i < 0) i = cells.length;
      cells.splice(i, 0, mine); return a + cells.join('') + z;
    });
  }
  function fillXlsxParts(sheetXml, ctrl, d) {
    let x = sheetXml;
    const vals = { ...d, ttdNama: d.nama, al0: d.alamat[0], al1: d.alamat[1], al2: d.alamat[2], do0: d.dom[0], do1: d.dom[1], do2: d.dom[2] };
    for (let n = 0; n <= 5; n++) vals['k' + n] = n === 5 ? d.kN >= 5 : d.kN === n;
    Object.entries(CELLS).forEach(([k, ref]) => { x = setCell(x, ref, vals[k]); });
    Object.entries(TROWS).forEach(([k, [r0, n]]) => (d[k] || []).slice(0, n).forEach((row, i) => row.forEach((v, j) => { if (TCOLS[j]) x = setCell(x, TCOLS[j] + (r0 + i), v); })));
    (d.em || []).slice(0, 2).forEach((row, i) => row.forEach((v, j) => { if (EMCOLS[j]) x = setCell(x, EMCOLS[j] + (EMROW + i), v); }));
    const ctrlOut = {};
    Object.entries(CHECKS).forEach(([k, n]) => { if (vals[k] && ctrl[n]) ctrlOut[n] = ctrl[n].replace('objectType="CheckBox"', 'objectType="CheckBox" checked="Checked"'); });
    return { sheet: x, ctrl: ctrlOut };
  }
  let zipP = null;
  const loadZip = () => zipP || (zipP = window.JSZip ? Promise.resolve(window.JSZip) : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = JSZIP; s.onload = () => res(window.JSZip); s.onerror = () => { zipP = null; rej(new Error('Gagal memuat pembuat Excel. Periksa koneksi.')); }; document.head.appendChild(s);
  }));
  async function excel(d) {
    const buf = await fetch(TEMPLATE).then((r) => { if (!r.ok) throw new Error('Template form tidak ditemukan'); return r.arrayBuffer(); });
    if (!d.filled) { saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(d, 'xlsx')); return; }
    const Z = await loadZip(); const zip = await Z.loadAsync(buf);
    const ctrl = {}; for (const n of new Set(Object.values(CHECKS))) { const f = zip.file(`xl/ctrlProps/ctrlProp${n}.xml`); if (f) ctrl[n] = await f.async('string'); }
    const out = fillXlsxParts(await zip.file('xl/worksheets/sheet1.xml').async('string'), ctrl, d);
    zip.file('xl/worksheets/sheet1.xml', out.sheet);
    Object.entries(out.ctrl).forEach(([n, s]) => zip.file(`xl/ctrlProps/ctrlProp${n}.xml`, s));
    saveBlob(await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(d, 'xlsx'));
  }
  /* ---------- Word: .docx asli dibangun dari tabel HTML di atas ---------- */
  function htmlToDocxXml(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const root = doc.body.firstElementChild;
    const css = (el) => { const o = {}; (el && el.getAttribute('style') || '').split(';').forEach((p) => { const i = p.indexOf(':'); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; };
    const pct = (v) => { const m = String(v || '').match(/([\d.]+)%/); return m ? +m[1] : null; };
    const pt = (v) => { const m = String(v || '').match(/([\d.]+)pt/); return m ? +m[1] : null; };
    const X = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const B = (side, on) => on ? `<w:${side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>` : `<w:${side} w:val="nil"/>`;
    const RF = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>';
    function para(el, st) {
      const txt = (el ? el.textContent : '').replace(/ /g, ' ');
      const size = Math.round((pt(st['font-size']) || 8.5) * 2), bold = /bold/.test(st['font-weight'] || '');
      const jc = st['text-align'] === 'center' ? '<w:jc w:val="center"/>' : '';
      const pl = pt(st['padding-left']); const ind = pl && pl > 3 ? `<w:ind w:left="${Math.round(pl * 20)}"/>` : '';
      return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${ind}${jc}<w:rPr>${RF}<w:sz w:val="${size}"/></w:rPr></w:pPr>${txt.trim() ? `<w:r><w:rPr>${RF}${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${X(txt)}</w:t></w:r>` : ''}</w:p>`;
    }
    function table(t, widthTw) {
      const ts = css(t), box = /1px solid/.test(ts.border || ''), noTop = /border-top:0/.test(t.getAttribute('style') || '');
      const rows = [...t.rows];
      const occ = [], plan = rows.map(() => []);
      rows.forEach((r, ri) => {
        let c = 0;
        [...r.cells].forEach((cell) => {
          while (occ[ri] && occ[ri][c]) c++;
          const cs = cell.colSpan || 1, rs = cell.rowSpan || 1;
          plan[ri].push({ cell, c, cs, rs, cont: false });
          for (let k = 1; k < rs; k++) { occ[ri + k] = occ[ri + k] || []; for (let j = 0; j < cs; j++) occ[ri + k][c + j] = true; plan[ri + k].push({ cell, c, cs, rs, cont: true }); }
          c += cs;
        });
      });
      plan.forEach((p) => p.sort((a, b) => a.c - b.c));
      const ncol = Math.max(...plan.map((p) => p.reduce((n, x) => n + x.cs, 0)));
      let widths = new Array(ncol).fill(100 / ncol);
      const best = plan.find((p) => p.length === ncol && p.every((x) => x.cs === 1 && x.rs === 1)) || plan.find((p) => p.length === ncol);
      if (best && best.some((x) => pct(css(x.cell).width) != null)) {
        const w = best.map((x) => pct(css(x.cell).width));
        const known = w.filter((v) => v != null).reduce((a, b) => a + b, 0), un = w.filter((v) => v == null).length;
        widths = w.map((v) => v != null ? v : Math.max(1, (100 - known) / Math.max(1, un)));
      }
      // header pendidikan: kolom "Dari/Sampai" hanya punya lebar di sel induknya
      else { const head = plan[0]; widths = new Array(ncol).fill(0); head.forEach((x) => { const w = pct(css(x.cell).width) || 100 / ncol; for (let j = 0; j < x.cs; j++) widths[x.c + j] = w / x.cs; }); }
      const sum = widths.reduce((a, b) => a + b, 0) || 1, tw = widths.map((v) => Math.round(v / sum * widthTw));
      let x = `<w:tbl><w:tblPr><w:tblW w:w="${widthTw}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${B('top', box && !noTop)}${B('left', box)}${B('bottom', box)}${B('right', box)}${B('insideH', false)}${B('insideV', false)}</w:tblBorders><w:tblCellMar><w:left w:w="50" w:type="dxa"/><w:right w:w="50" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${tw.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
      plan.forEach((p, ri) => {
        const h = pt(css(rows[ri]).height);
        x += `<w:tr><w:trPr>${h ? `<w:trHeight w:val="${Math.round(h * 20)}" w:hRule="atLeast"/>` : ''}<w:cantSplit/></w:trPr>`;
        p.forEach((it) => {
          const st = css(it.cell), w = tw.slice(it.c, it.c + it.cs).reduce((a, b) => a + b, 0);
          const hpt = pt(st.height);
          const all = /1px solid/.test(st.border || ''), bb = all || /1px solid/.test(st['border-bottom'] || ''), br = all || /1px solid/.test(st['border-right'] || '');
          const va = st['vertical-align'] === 'middle' ? 'center' : st['vertical-align'] === 'top' ? 'top' : 'bottom';
          x += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${it.cs > 1 ? `<w:gridSpan w:val="${it.cs}"/>` : ''}${it.rs > 1 ? (it.cont ? '<w:vMerge/>' : '<w:vMerge w:val="restart"/>') : ''}<w:tcBorders>${all ? B('top', true) + B('left', true) : ''}${bb ? B('bottom', true) : ''}${br ? B('right', true) : ''}</w:tcBorders><w:vAlign w:val="${va}"/></w:tcPr>`;
          const inner = !it.cont && it.cell.querySelector('table');
          x += inner ? table(inner, w - 100) + para(null, {}) : para(it.cont ? null : it.cell, st);
          x += '</w:tc>';
          if (hpt && !h) x = x.replace(/<w:trPr>(<w:cantSplit\/>)<\/w:trPr>(?![\s\S]*<w:trPr>)/, `<w:trPr><w:trHeight w:val="${Math.round(hpt * 20)}" w:hRule="atLeast"/>$1</w:trPr>`);
        });
        x += '</w:tr>';
      });
      return x + '</w:tbl>';
    }
    const W = 11906 - 2 * 850;
    const gap = (h) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>`;
    const kids = [...root.children].filter((el) => el.tagName === 'TABLE');
    const body = kids.map((el, i) => table(el, W) + gap(i + 1 < kids.length ? Math.max(20, Math.round((pt(css(kids[i + 1])['margin-top']) || 0) * 20)) : 20)).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="620" w:right="850" w:bottom="560" w:left="850" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  async function word(d) {
    const Z = await loadZip(); const zip = new Z();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', htmlToDocxXml(formHtml(d)));
    saveBlob(await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fileName(d, 'docx'));
  }
  function pdf(d) {
    const w = window.open('', '_blank');
    if (!w) { alert('Jendela cetak diblokir browser. Izinkan pop-up untuk halaman ini lalu coba lagi.'); return; }
    w.document.open(); w.document.write(pageDoc(d, false)); w.document.close();
  }

  /* ---------- menu pilihan format ---------- */
  const st = document.createElement('style');
  st.textContent = `.fdk-menu{position:fixed;z-index:90;background:#fff;border:1px solid #E4E2F0;border-radius:12px;box-shadow:0 18px 40px -12px rgba(30,10,80,.35);padding:6px;min-width:230px;font-family:inherit}
.fdk-menu .h{padding:8px 10px 6px;font-size:12px;color:#6B6985;border-bottom:1px solid #EEE;margin-bottom:4px;max-width:260px}
.fdk-menu button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;cursor:pointer;font:600 13.5px/1.3 inherit;color:#1C1A33}
.fdk-menu button:hover{background:#F4F1FD}.fdk-menu i{font-style:normal;font-size:10px;font-weight:800;color:#fff;border-radius:5px;padding:3px 5px;min-width:34px;text-align:center}
.fdk-menu small{display:block;font-weight:500;color:#6B6985;font-size:11.5px}
.fdk-btn{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.fdk-mini{display:inline-flex;align-items:center;gap:5px;border:1px solid #DDD0FA;background:#F5F0FF;color:#6D28D9;border-radius:8px;padding:4px 9px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.fdk-mini:hover{background:#6D28D9;color:#fff}
@media print{.fdk-btn,.fdk-mini,.fdk-menu,.fdk-col{display:none!important}}`;
  document.head.appendChild(st);
  let menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(btn, raw) {
    closeMenu();
    const d = norm(raw);
    menu = document.createElement('div'); menu.className = 'fdk-menu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = `<div class="h">${d.filled ? 'Form Data Karyawan · <b>' + esc(d.nama) + '</b>' : 'Form Data Karyawan (kosong)'}</div>
      <button type="button" data-f="doc" role="menuitem"><i style="background:#2B579A">DOC</i><span>Word (.docx)<small>Bisa diedit di Microsoft Word</small></span></button>
      <button type="button" data-f="xlsx" role="menuitem"><i style="background:#1D6F42">XLSX</i><span>Excel<small>Template asli Lampiran 1</small></span></button>
      <button type="button" data-f="pdf" role="menuitem"><i style="background:#C0392B">PDF</i><span>PDF / Print<small>Pilih "Simpan sebagai PDF" saat print</small></span></button>`;
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left)) + 'px';
    menu.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
    menu.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      const f = b.dataset.f; closeMenu();
      try { if (f === 'doc') await word(d); else if (f === 'pdf') pdf(d); else await excel(d); }
      catch (err) { alert('Gagal membuat form: ' + (err.message || err)); }
    });
    const k = menu.querySelector('button'); if (k) k.focus();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-fdk],[data-fdk-blank]');
    if (b) { e.preventDefault(); e.stopPropagation(); let raw = {}; if (b.dataset.fdk) { try { raw = JSON.parse(b.dataset.fdk); } catch (_) { } } openMenu(b, raw); return; }
    if (menu && !e.target.closest('.fdk-menu')) closeMenu();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('scroll', closeMenu, true);

  window.KMBFormKaryawan = { norm, formHtml, pageDoc, fillXlsxParts, setCell, openMenu, htmlToDocxXml };
})();
