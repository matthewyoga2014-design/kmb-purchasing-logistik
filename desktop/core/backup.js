'use strict';
/*
 * Backup otomatis: menulis semua data Monitoring ke file Excel (.xlsx) yang bisa
 * dibuka langsung di Excel, plus cadangan lengkap .json untuk dipulihkan ke aplikasi.
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const SITE_NAMES = {
  main: 'KTA-TRA', 'kmb-c4': 'KMB C4', 'kmb-workshop': 'KMB Workshop', 'kmb-slr-rekondisi': 'KMB SLR Rekondisi',
  'kmb-slr-maintenance': 'KMB SLR Maint', bupr: 'BUPR', mbj: 'MBJ', 'kta-tra': 'KTA-TRA', kmb: 'KMB', 'bupr-ampah': 'BUPR',
  'unit-monitoring': 'Unit',
};
const KEY_NAMES = {
  aktif: 'MP Aktif', keluar: 'MP Out', positions: 'MPP', units: 'Unit', mpp: 'MPP', mpOut: 'MP Out', mpActive: 'MP Aktif',
  candidates: 'Pelamar', stockIn: 'Stok Masuk', receipts: 'Penerimaan', requests: 'Permintaan', transfers: 'Transfer',
  returns: 'Pengembalian', types: 'Jenis APD', warehouses: 'Gudang', adjust: 'Penyesuaian', limits: 'Batas', ga: 'GA Request',
  mobilisasi: 'Mobilisasi', pengiriman: 'Pengiriman', projects: 'Project', personOverrides: 'Data Karyawan',
};
const SKIP_KEYS = new Set(['images', 'meta', 'deletedMPP', 'deletedKMB', 'mpRestoreMeta', 'sheetApi', 'sheetUrl', 'rev', 'revisi', 'stockResetReceiptIds', 'unitRegistryArchive']);

const xmlEsc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') v = JSON.stringify(v);
  v = String(v);
  return v.length > 32000 ? v.slice(0, 32000) + '…' : v;
}
function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

function sheetXml(rows) {
  const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
  const ncol = rows.reduce((m, r) => Math.max(m, r.length), 1);
  out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
  out.push('<cols>');
  for (let c = 0; c < ncol; c++) {
    const w = Math.min(60, Math.max(8, ...rows.slice(0, 200).map((r) => (r[c] == null ? 0 : String(r[c]).length + 2))));
    out.push(`<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`);
  }
  out.push('</cols><sheetData>');
  rows.forEach((r, ri) => {
    out.push(`<row r="${ri + 1}">`);
    r.forEach((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      const s = ri === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && isFinite(v)) out.push(`<c r="${ref}"${s}><v>${v}</v></c>`);
      else if (typeof v === 'boolean') out.push(`<c r="${ref}" t="b"${s}><v>${v ? 1 : 0}</v></c>`);
      else { const t = cellText(v); if (t !== '') out.push(`<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlEsc(t)}</t></is></c>`); }
    });
    out.push('</row>');
  });
  out.push('</sheetData>');
  if (rows.length > 1) out.push(`<autoFilter ref="A1:${colName(ncol - 1)}${rows.length}"/>`);
  out.push('</worksheet>');
  return out.join('');
}

/** sheets: [{name, rows: any[][]}] -> Buffer xlsx */
async function writeXlsx(sheets) {
  const zip = new JSZip();
  const names = [];
  const used = new Set();
  for (const s of sheets) {
    let n = String(s.name || 'Sheet').replace(/[\[\]:*?/\\]/g, '-').slice(0, 31) || 'Sheet';
    let k = 2;
    while (used.has(n.toLowerCase())) { const suf = ' (' + k++ + ')'; n = n.slice(0, 31 - suf.length) + suf; }
    used.add(n.toLowerCase()); names.push(n);
  }
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names.map((n, i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6D28D9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Daftar objek -> tabel (baris pertama = judul kolom).
function tableOf(list, extra) {
  const items = list.filter((x) => x != null);
  if (!items.length) return null;
  if (items.every((x) => typeof x !== 'object')) return [['Nilai'], ...items.map((x) => [x])];
  const cols = [];
  const seen = new Set();
  for (const it of items.slice(0, 5000)) for (const k of Object.keys(typeof it === 'object' ? it : { nilai: it })) if (!seen.has(k)) { seen.add(k); cols.push(k); }
  const head = [...(extra ? Object.keys(extra) : []), ...cols];
  const rows = items.map((it) => [...(extra ? Object.values(extra) : []), ...cols.map((c) => (typeof it === 'object' ? it[c] : c === 'nilai' ? it : null))]);
  return [head, ...rows];
}
function addDoc(sheets, prefix, data) {
  if (!data || typeof data !== 'object') return;
  for (const [k, v] of Object.entries(data)) {
    if (SKIP_KEYS.has(k)) continue;
    const name = prefix + ' - ' + (KEY_NAMES[k] || k);
    let rows = null;
    if (Array.isArray(v)) rows = tableOf(v);
    else if (v && typeof v === 'object') {
      const vals = Object.entries(v);
      if (vals.length && vals.every(([, x]) => x && typeof x === 'object' && !Array.isArray(x))) rows = tableOf(vals.map(([id, x]) => ({ _id: id, ...x })));
    }
    if (rows && rows.length > 1) sheets.push({ name, rows });
  }
}

function buildSheets(snapshot) {
  const T = snapshot.tables || {};
  const sheets = [];
  for (const r of T.kta_web_state || []) addDoc(sheets, SITE_NAMES[r.id] || r.id, r.data);
  const priv = new Map((T.app_state_private || []).map((r) => [r.app_id, r]));
  for (const r of T.app_state_public || []) {
    const src = priv.get(r.app_id) || r;
    addDoc(sheets, (SITE_NAMES[r.app_id] || r.app_id) + (r.app_id === 'unit-monitoring' ? '' : ' Rekrut'), src.data);
  }
  for (const r of T.apd_state || []) addDoc(sheets, 'APD', r.data);
  const n = snapshot.notulensi || {};
  const series = n.series || {};
  if (Object.keys(series).length) {
    sheets.push({ name: 'Notulensi - Daftar', rows: tableOf(Object.entries(series).map(([id, s]) => ({ _id: id, ...s }))) });
    const poin = [];
    for (const [vid, v] of Object.entries(n.versions || {})) {
      const s = series[v.seriesId] || {};
      for (const row of Array.isArray(v.rows) ? v.rows : []) poin.push({ Notulensi: s.title || v.seriesId, 'Meeting ke': v.no, Tanggal: v.date || '', ...row, _versi: vid });
    }
    const pt = tableOf(poin);
    if (pt) sheets.push({ name: 'Notulensi - Tindak Lanjut', rows: pt });
    const ft = tableOf(Object.entries(n.files || {}).map(([id, f]) => ({ _id: id, ...f })));
    if (ft) sheets.push({ name: 'Notulensi - Berkas', rows: ft });
  }
  for (const t of ['kta_activity_log', 'candidate_attachments', 'organizational_charts', 'portal_display_settings', 'mpp_portal_projects', 'kta_mp_private']) {
    const rows = tableOf(T[t] || []);
    if (rows && rows.length > 1) sheets.push({ name: { kta_activity_log: 'Log Aktivitas', candidate_attachments: 'Lampiran Pelamar', organizational_charts: 'Struktur Organisasi', portal_display_settings: 'Nama Portal', mpp_portal_projects: 'Project Portal', kta_mp_private: 'MP Data Pribadi' }[t], rows });
  }
  const summary = [['Sheet', 'Jumlah baris'], ...sheets.map((s) => [s.name, s.rows.length - 1])];
  sheets.unshift({ name: 'Ringkasan', rows: [['Backup Monitoring', new Date().toLocaleString('id-ID')], [], ...summary] });
  return sheets;
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function prune(dir, prefix, keep) {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.rmSync(path.join(dir, f), { force: true });
  } catch (e) {}
}

/** Tulis backup hari ini (ditimpa sepanjang hari) ke folder Backup Excel & Backup Data. */
async function writeBackup(store, rootDir, opts = {}) {
  const d = new Date();
  const snap = store.exportAll();
  const xlsDir = path.join(rootDir, 'Backup Excel');
  const jsonDir = path.join(rootDir, 'Backup Data');
  fs.mkdirSync(xlsDir, { recursive: true });
  fs.mkdirSync(jsonDir, { recursive: true });
  const xlsx = await writeXlsx(buildSheets(snap));
  const name = opts.name || `Monitoring-Backup-${stamp(d)}`;
  const xf = path.join(xlsDir, name + '.xlsx');
  const tmp = xf + '.tmp';
  fs.writeFileSync(tmp, xlsx);
  try { fs.renameSync(tmp, xf); } catch (e) {
    // File sedang dibuka di Excel: simpan dengan nama lain.
    const alt = path.join(xlsDir, `${name}-${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`);
    fs.renameSync(tmp, alt);
  }
  fs.writeFileSync(path.join(jsonDir, `monitoring-data-${stamp(d)}.json`), JSON.stringify(snap));
  prune(xlsDir, 'Monitoring-Backup-', 60);
  prune(jsonDir, 'monitoring-data-', 60);
  return xf;
}

module.exports = { writeBackup, writeXlsx, buildSheets };
