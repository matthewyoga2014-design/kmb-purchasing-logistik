
// ================= v15: Struktur Organisasi tools (tambah bawahan, anggota, drag & drop, info, cari, unduh) =================
ui.oq = ''; ui.olay = (store.get('kta-olay2') === 'h') ? 'h' : 'v';
let ORG_MP = null;
function orgMpIndex() {
  const m = DATA.aktif.map((a) => [normName(a.nama), a]);
  return (nama) => { const n = normName(nama); if (!n) return null; const hit = m.find(([k]) => k === n) || m.find(([k]) => k.startsWith(n) || n.startsWith(k)); return hit ? hit[1] : null; };
}
function orgInfo(p) {
  if (isVacant(p)) {
    if (!isOpen(p)) return '<div class="oi mute">Belum ada PTK</div>';
    const act = candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd').length;
    return `<div class="oi open">PTK Open · ${STAGE_SHORT[topStage(p)]} · ${act} pelamar</div>`;
  }
  const a = ORG_MP && ORG_MP(p.nama); if (!a || !a.akhir) return '';
  const r = diff(a.akhir, TODAY);
  if (r < 0) return `<div class="oi late">⚠ Kontrak lewat ${-r} hari</div>`;
  if (r <= 30) return `<div class="oi soon">⚠ Kontrak habis ${r} hari</div>`;
  return '';
}
function ocard(p, M) {
  const vac = isVacant(p), c = FAM_COLOR[roleFamily(p.jabatan)] || '#6D28D9';
  const ks = M.kids[p.uid] || [];
  const nk = DATA.positions.filter((x) => x.atasan === p.uid).length;
  const i = DATA.positions.indexOf(p);
  const box = `<div class="ocard ${vac ? 'vac' : ''}" data-uid="${esc(p.uid)}" style="--oc:${c};--ocb:${tint(c, .12)}" ${CAN_EDIT ? `data-soe="${i}" role="button" tabindex="0" title="Klik untuk atur section / sub-section / atasan · seret untuk memindahkan"` : `title="${esc((p.section || '') + ' › ' + (p.group || ''))}"`}>
    <div class="oj">${esc(p.jabatan || '-')}</div><div class="on">${esc(vac ? 'Vacant' : p.nama)}</div>${orgInfo(p)}
    ${CAN_EDIT ? `<div class="oacts"><button type="button" data-omem="${esc(p.uid)}" title="Pilih anggota tim">Anggota${nk ? ` (${nk})` : ''}</button></div>` : ''}</div>`;
  return `<li>${box}${ks.length ? tiersHtml(ks, M) : ''}</li>`;
}
function orgChart(D) {
  ORG_MP = orgMpIndex();
  const P = D.P; const M = orgModel(P);
  const freeSet = new Set(M.free.map((p) => p.uid));
  const secs = orgSections(P);
  const isTop = (s) => /penanggung|pjo|manajemen|management/i.test(s.name);
  const top = secs.filter(isTop).flatMap((s) => s.groups.flatMap((g) => g.list)).filter((p) => freeSet.has(p.uid));
  const body = secs.filter((s) => !isTop(s)).filter((s) => ui.osec === 'semua' || s.name === ui.osec);
  const secLi = (s) => {
    const all = s.groups.flatMap((g) => g.list), vac = all.filter(isVacant).length, mpa = all.length - vac;
    const framesArr = s.groups.map((g) => {
      const fl = g.list.filter((p) => freeSet.has(p.uid));
      const titled = g.name !== s.name; const gv = g.list.filter(isVacant).length;
      if (!fl.length && !CAN_EDIT) return '';
      return `<div class="gframe" data-dsec="${esc(s.name)}" data-dg="${esc(g.name)}">${titled ? `<div class="gtitle" ${CAN_EDIT ? `data-rgrp="${esc(s.name)}" data-g="${esc(g.name)}" role="button" tabindex="0" title="Klik untuk ganti nama sub-section"` : ''}>${esc(g.name)}<span>${g.list.length} posisi${gv ? ` · <em>${gv} vacant</em>` : ''}</span></div>` : ''}${fl.length ? tiersHtml(fl, M) : '<div class="small" style="padding:8px">Semua posisi ada di bawah atasannya.</div>'}</div>`;
    }).filter(Boolean);
    const frames = !framesArr.length ? '' : (ui.olay === 'v' || framesArr.length === 1) ? `<div class="glist">${framesArr.join('')}</div>` : `<ul class="gul">${framesArr.map((f) => `<li>${f}</li>`).join('')}</ul>`;
    return `<li><div class="onode sec" data-dsec="${esc(s.name)}" ${CAN_EDIT ? `data-rsec="${esc(s.name)}" role="button" tabindex="0" title="Klik untuk ganti nama section"` : ''}><b>${esc(s.name)}</b><span>${all.length} MPP · ${mpa} MPA · ${all.length ? Math.round(mpa / all.length * 100) : 0}%</span></div>${frames}</li>`;
  };
  const secRow = body.length ? `<ul class="tier secs">${body.map(secLi).join('')}</ul>` : '';
  if (ui.osec !== 'semua') return `<div class="org">${tiersHtml([], M, secRow)}</div>`;
  return `<div class="org">${top.length ? tiersHtml(top, M, secRow) : `<div class="tiers">${secRow}</div>`}</div>`;
}
function pageOrg(D) {
  const secs = orgSections(D.P).map((s) => s.name).filter((n) => !/penanggung|pjo|manajemen|management/i.test(n));
  const fams = [...new Set(D.P.map((p) => roleFamily(p.jabatan)))];
  return `<div class="mhead"><div><div class="eyebrow">Monitoring Manpower KTA - TRA</div><h1>Struktur Organisasi</h1><p>Otomatis dari MPP KTA - TRA. Jabatan yang sama tampil sejajar, dikelompokkan per section dan sub-section.</p></div>
    <div class="mtools"><input type="search" id="oq" placeholder="Cari nama / jabatan" value="${esc(ui.oq)}" aria-label="Cari di struktur">
      <select id="oSec" aria-label="Pilih section"><option value="semua">Semua section</option>${secs.map((s) => `<option ${ui.osec === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="Tata letak sub-section"><button type="button" data-olay="h" aria-pressed="${ui.olay !== 'v'}" title="Sub-section berjajar ke samping (lebar)">Mendatar</button><button type="button" data-olay="v" aria-pressed="${ui.olay === 'v'}" title="Sub-section bersusun ke bawah (ringkas, mudah dibaca)">Sub-section menurun</button></div>
      <div class="seg" role="group" aria-label="Zoom"><button type="button" data-oz="-" title="Perkecil">−</button><button type="button" data-oz="100" title="Ukuran asli" id="ozLbl">${ui.oz === null ? 'Pas' : Math.round(ui.oz * 100) + '%'}</button><button type="button" data-oz="+" title="Perbesar">+</button><button type="button" data-oz="fit" aria-pressed="${ui.oz === null}" title="Seluruh struktur pas dengan lebar layar">Pas lebar</button></div>
      <button type="button" class="btn ${ui.ofull ? 'btn-p' : 'btn-g'}" id="oFull" title="Tampilkan struktur memenuhi layar (Esc untuk keluar)">${ui.ofull ? '✕ Keluar layar penuh' : '⛶ Layar penuh'}</button>
      ${DL ? '<button type="button" class="btn btn-g" data-oexp="png">Unduh PNG</button><button type="button" class="btn btn-g" data-oexp="pdf">Unduh PDF</button>' : ''}
      ${(DL || IS_TOP) ? '<button type="button" class="btn btn-g" id="printBtn">Print</button>' : ''}</div></div>
  ${CAN_EDIT ? `<div class="ohelp"><b>Cara cepat:</b> <span>Klik kotak = atur section / sub-section / atasan (pilihan dari data MPP)</span><span><b>Anggota</b> = centang anggota tim sekaligus</span><span><b>Seret kotak orang</b>: lepas di <u>tengah</u> kotak lain = jadi bawahannya, di <u>sisi kiri/kanan</u> = sejajar (ubah urutan)</span><span><b>Seret judul sub-section ⠿</b>: lepas di <u>tengah</u> sub-section lain = masuk di bawahnya; di <u>tepi atas/bawah</u> (tampilan menurun) atau <u>kiri/kanan</u> (mendatar) = sejajar &amp; ubah urutan; di kotak ungu section = langsung di bawah section</span><span><b>Seret kotak ungu section</b> = ubah urutan / pindah ke Di luar SO</span><span><b>Klik</b> kotak section / judul sub-section = menu <b>Atur</b>: buat sejajar, pindah ke bawah sub-section lain, urutan, tampilan sejajar ke samping / menurun</span></div>` : ''}
  <div class="card orgcard"><div class="olegend">${fams.map((f) => `<span><i style="background:${FAM_COLOR[f] || '#6D28D9'}"></i>${esc(f)}</span>`).join('')}<span><i class="v"></i>Vacant</span><span><b class="lw">⚠</b>Kontrak habis ≤ 30 hari</span><span id="oqHits" class="small"></span></div>
    <div class="orgwrap" id="orgWrap"><div class="orgsizer" id="orgSizer">${orgChart(D)}</div></div></div>
  <p class="note">Bawahan otomatis ikut pindah section / sub-section bersama atasannya. Jika kolom <b>Atasan langsung</b> dikosongkan, posisi tampil sejajar dengan jabatan yang sama di sub-section-nya.</p>`;
}

// ---------- search ----------
function applyOrgSearch(scroll) {
  const wrap = document.getElementById('orgWrap'); if (!wrap) return;
  const q = ui.oq.trim().toLowerCase(); const cards = [...wrap.querySelectorAll('.ocard')];
  wrap.classList.toggle('searching', !!q);
  let first = null, n = 0;
  cards.forEach((c) => { const hit = !!q && ((c.querySelector('.on') || {}).textContent + ' ' + (c.querySelector('.oj') || {}).textContent).toLowerCase().includes(q); c.classList.toggle('hit', hit); if (hit) { n++; if (!first) first = c; } });
  const h = document.getElementById('oqHits'); if (h) h.textContent = q ? (n ? `${n} ditemukan` : 'Tidak ditemukan') : '';
  if (scroll && first) first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}
document.addEventListener('input', (e) => { if (e.target.id === 'oq') { ui.oq = e.target.value; applyOrgSearch(true); } });
const _applyOrgZoom11 = applyOrgZoom;
applyOrgZoom = function (w) { _applyOrgZoom11(w); applyOrgSearch(false); };

// ---------- helpers ----------
const posByUid = (S, uid) => S.positions.find((x) => x.uid === uid);
function isUnder(S, uid, ancestorUid) { let q = posByUid(S, uid), guard = 0; while (q && q.atasan && guard++ < 200) { if (q.atasan === ancestorUid) return true; q = posByUid(S, q.atasan); } return false; }
function moveTo(S, uid, target) {
  const p = posByUid(S, uid); if (!p) return;
  if (target.leader) { const L = posByUid(S, target.leader); if (!L) return; p.atasan = L.uid; p.section = L.section; p.group = L.group || L.section; }
  else { p.atasan = null; p.section = target.section; p.group = target.group || target.section; }
  cascadeSection(S, p);
}
const nameOf = (p) => `${isVacant(p) ? 'Vacant' : p.nama} (${p.jabatan || '-'})`;

// ---------- + Bawahan ----------
function addSub(uid) {
  const L = posByUid(DATA, uid); if (!L) return;
  mppForm(null);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('f_section', L.section); set('f_group', L.group || L.section); set('f_atasan', L.uid); set('f_nama', 'Vacant');
  const lower = DATA.positions.filter((x) => roleFamily(x.jabatan) === roleFamily(L.jabatan) && jabRank(x.jabatan) > jabRank(L.jabatan)).sort((a, b) => jabRank(a.jabatan) - jabRank(b.jabatan))[0];
  if (lower) set('f_jabatan', lower.jabatan);
  const t = document.getElementById('mTitle'); if (t) t.textContent = `Tambah Bawahan — ${nameOf(L)}`;
  const j = document.getElementById('f_jabatan'); if (j) { j.focus(); j.select(); }
}

// ---------- Anggota tim ----------
let MEM = null;
function openMembers(uid) {
  const L = posByUid(DATA, uid); if (!L) return;
  FORM = null; MEM = { uid };
  const anc = new Set(); let q = L, g = 0; while (q && q.atasan && g++ < 200) { anc.add(q.atasan); q = posByUid(DATA, q.atasan); }
  const list = DATA.positions.filter((x) => x.uid !== uid && !anc.has(x.uid));
  const groups = new Map(); list.forEach((x) => { const k = `${x.section || '-'} › ${x.group || x.section || '-'}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  const leaderOf = (x) => { const a = x.atasan && posByUid(DATA, x.atasan); return a ? (isVacant(a) ? 'Vacant' : a.nama) : ''; };
  document.getElementById('dialog').innerHTML = `<div class="cm-h"><h2 id="mTitle">Anggota tim — ${esc(nameOf(L))}</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div>
    <p class="small" style="margin:6px 0 10px">Centang posisi yang menjadi bawahan langsung. ${esc(L.section || '')}${L.group && L.group !== L.section ? ' › ' + esc(L.group) : ''}</p>
    <div class="memtool"><input type="search" id="memQ" placeholder="Cari nama / jabatan" aria-label="Cari"><label class="memmv"><input type="checkbox" id="memMove" checked> Pindahkan anggota ke section / sub-section atasan</label></div>
    <div class="memlist">${[...groups.entries()].map(([k, xs]) => `<div class="memg"><div class="memgh">${esc(k)}</div>${xs.map((x) => `<label class="memr" data-txt="${esc((x.nama + ' ' + x.jabatan + ' ' + k).toLowerCase())}"><input type="checkbox" value="${esc(x.uid)}" ${x.atasan === uid ? 'checked' : ''}><span class="mn ${isVacant(x) ? 'vacn' : ''}">${esc(isVacant(x) ? 'Vacant' : x.nama)}</span><span class="mj">${esc(x.jabatan || '-')}</span>${x.atasan && x.atasan !== uid ? `<span class="ml">atasan: ${esc(leaderOf(x))}</span>` : ''}</label>`).join('')}</div>`).join('')}</div>
    <div class="factions"><span class="small" id="memN"></span><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button><button type="button" class="btn btn-p" id="memSave">Simpan Anggota</button></div>`;
  document.getElementById('modal').hidden = false; memCount(); document.getElementById('memQ').focus();
}
function memCount() { const n = document.querySelectorAll('.memlist input:checked').length; const e = document.getElementById('memN'); if (e) e.textContent = `${n} anggota dipilih`; }
document.addEventListener('input', (e) => {
  if (e.target.id !== 'memQ') return; const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.memr').forEach((r) => { r.hidden = !!q && !r.dataset.txt.includes(q); });
  document.querySelectorAll('.memg').forEach((g) => { g.hidden = ![...g.querySelectorAll('.memr')].some((r) => !r.hidden); });
});
document.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('.memlist')) memCount(); });
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#memSave') || !MEM) return;
  const uid = MEM.uid, sel = new Set([...document.querySelectorAll('.memlist input:checked')].map((i) => i.value)), mv = document.getElementById('memMove').checked;
  const ok = await commit((S) => {
    const L = posByUid(S, uid); if (!L) return;
    S.positions.forEach((x) => {
      if (sel.has(x.uid) && x.atasan !== uid) { x.atasan = uid; if (mv) { x.section = L.section; x.group = L.group || L.section; } cascadeSection(S, x); }
      else if (!sel.has(x.uid) && x.atasan === uid) x.atasan = null;
    });
  }, `Anggota tim disimpan (${sel.size} orang).`);
  if (ok) { MEM = null; closeModal(); }
});

// ---------- drag & drop ----------
let DRAG = null;
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest && e.target.closest('.ocard[draggable="true"]'); if (!c || !CAN_EDIT) return;
  DRAG = c.dataset.uid; c.classList.add('dragging');
  try { e.dataTransfer.setData('text/plain', DRAG); e.dataTransfer.effectAllowed = 'move'; } catch (er) {}
});
document.addEventListener('dragend', () => { DRAG = null; document.querySelectorAll('.dragging,.dropok').forEach((x) => x.classList.remove('dragging', 'dropok')); });
function dropTarget(el) {
  const card = el.closest('.ocard'); if (card) { const u = card.dataset.uid; if (u === DRAG || isUnder(DATA, u, DRAG)) return null; return { el: card, leader: u }; }
  const sec = el.closest('.onode.sec'); if (sec) return { el: sec, section: sec.dataset.dsec, group: sec.dataset.dsec };
  const fr = el.closest('.gframe'); if (fr) return { el: fr, section: fr.dataset.dsec, group: fr.dataset.dg };
  return null;
}
document.addEventListener('dragover', (e) => {
  if (!DRAG) return; const t = dropTarget(e.target);
  document.querySelectorAll('.dropok').forEach((x) => { if (!t || x !== t.el) x.classList.remove('dropok'); });
  if (t) { e.preventDefault(); t.el.classList.add('dropok'); try { e.dataTransfer.dropEffect = 'move'; } catch (er) {} }
});
document.addEventListener('drop', async (e) => {
  if (!DRAG) return; const t = dropTarget(e.target); if (!t) return; e.preventDefault();
  const uid = DRAG; DRAG = null; document.querySelectorAll('.dragging,.dropok').forEach((x) => x.classList.remove('dragging', 'dropok'));
  const p = posByUid(DATA, uid); if (!p) return;
  const L = t.leader && posByUid(DATA, t.leader);
  if (L && p.atasan === L.uid) return;
  if (!L && !p.atasan && p.section === t.section && (p.group || p.section) === t.group) return;
  await commit((S) => moveTo(S, uid, t), L ? `${nameOf(p)} sekarang di bawah ${nameOf(L)}.` : `${nameOf(p)} dipindah ke ${t.group && t.group !== t.section ? t.section + ' › ' + t.group : t.section}.`);
});

// ---------- clicks on card buttons ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-oadd]'); if (a && CAN_EDIT) { e.stopPropagation(); addSub(a.dataset.oadd); return; }
  const m = e.target.closest('[data-omem]'); if (m && CAN_EDIT) { e.stopPropagation(); openMembers(m.dataset.omem); return; }
  if (e.target.closest('#fCancel') || e.target.id === 'mClose') MEM = null;
}, true);

// ---------- download PNG / PDF ----------
async function orgCanvas() {
  if (!window.htmlToImage) await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js');
  const org = document.querySelector('#orgSizer .org'); if (!org) throw new Error('Struktur belum tampil.');
  const prev = org.style.transform; org.style.transform = 'none';
  document.body.classList.add('oexport');
  try {
    return await window.htmlToImage.toCanvas(org, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true, style: { transform: 'none', margin: '0' } });
  } finally { org.style.transform = prev; document.body.classList.remove('oexport'); }
}
async function exportOrg(kind) {
  const btns = [...document.querySelectorAll('[data-oexp]')]; btns.forEach((b) => { b.disabled = true; });
  toast('Menyiapkan ' + kind.toUpperCase() + '…');
  try {
    const cv = await orgCanvas();
    const pad = 60, title = 90, W = cv.width + pad * 2, H = cv.height + pad * 2 + title;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1E1B3A'; g.font = '800 40px "Plus Jakarta Sans", Arial, sans-serif'; g.fillText('Struktur Organisasi KTA - TRA', pad, pad + 30);
    g.fillStyle = '#8A87A6'; g.font = '500 24px "Plus Jakarta Sans", Arial, sans-serif'; g.fillText(`${ui.osec === 'semua' ? 'Semua section' : ui.osec} · ${fmt(TODAY)}`, pad, pad + 66);
    g.drawImage(cv, pad, pad + title);
    const name = `Struktur_Organisasi_KTA-TRA_${ui.osec === 'semua' ? '' : ui.osec.replace(/[^A-Za-z0-9]+/g, '_') + '_'}${TODAY}`;
    if (kind === 'png') { const blob = await new Promise((r) => out.toBlob(r, 'image/png')); await save(name + '.png', blob); return; }
    if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const land = W >= H, fmtName = Math.max(W, H) > 3600 ? 'a3' : 'a4';
    const pdf = new window.jspdf.jsPDF({ orientation: land ? 'l' : 'p', unit: 'mm', format: fmtName });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 6;
    const s = Math.min((pw - m * 2) / W, (ph - m * 2) / H);
    pdf.addImage(out.toDataURL('image/jpeg', 0.93), 'JPEG', (pw - W * s) / 2, (ph - H * s) / 2, W * s, H * s);
    await save(name + '.pdf', pdf.output('blob'));
  } catch (er) { toast('Gagal mengunduh: ' + ((er && er.message) || 'coba lagi.'), true); }
  finally { btns.forEach((b) => { b.disabled = false; }); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-oexp]'); if (b) exportOrg(b.dataset.oexp); });

document.addEventListener('click', (e) => { const b = e.target.closest('[data-olay]'); if (!b) return; ui.olay = b.dataset.olay; store.set('kta-olay2', ui.olay); ui.ojump = true; render(); });
