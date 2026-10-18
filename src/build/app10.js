
// ================= v14: Struktur Organisasi (auto from MPP) =================
PAGES.splice(PAGES.findIndex((x) => x.id === 'karyawan'), 0, { id: 'org', label: 'Struktur Organisasi', grp: 'Monitoring', ic: '<rect x="9" y="3" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="16" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="15" y="16" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4M6 16v-4h12v4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' });
if ((location.hash || '').slice(1) === 'org') ui.page = 'org';
try { if ((sessionStorage.getItem('mp5-page') || store.get('mp5-page')) === 'org') ui.page = 'org'; } catch (e) {}
ui.osec = 'semua'; ui.oz = (() => { const v = parseFloat(store.get('kta-oz2')); return v > 0 ? v : null; })(); ui.ofull = false;

const newUid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const _materialize = materialize;
materialize = function (p) { if (!p.uid) p.uid = newUid(); return _materialize(p); };
STATE.positions.forEach((p) => { if (!p.uid) p.uid = newUid(); });

function jabKey(j) { return (j || '–').toLowerCase().replace(/middle/g, 'midle').split(/\s+/).filter(Boolean).sort().join(' '); }
function jabRank(j) {
  j = (j || '').toLowerCase();
  if (/dept|department|manager|pjo/.test(j)) return 0;
  if (/section head|kepala/.test(j)) return 1;
  if (/supervisor|foreman|leader|spv/.test(j)) return 2;
  if (/planner/.test(j)) return 3;
  if (/admin/.test(j)) return 4;
  if (/senior/.test(j)) return 5;
  if (/junior/.test(j)) return 7;
  if (/helper/.test(j)) return 8;
  return 6;
}
function orgModel(P) {
  const by = {}; P.forEach((p) => { by[p.uid] = p; });
  const parentOf = (p) => {
    if (!p.atasan || !by[p.atasan] || p.atasan === p.uid) return null;
    const seen = new Set([p.uid]); let q = by[p.atasan];
    while (q) { if (seen.has(q.uid)) return null; seen.add(q.uid); q = q.atasan ? by[q.atasan] : null; }
    return by[p.atasan];
  };
  const kids = {}; const free = [];
  P.forEach((p) => { const par = parentOf(p); if (par) (kids[par.uid] = kids[par.uid] || []).push(p); else free.push(p); });
  return { kids, free };
}
function tierRows(list) {
  const m = new Map();
  list.forEach((p) => { const k = jabKey(p.jabatan); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return [...m.values()].sort((a, b) => jabRank(a[0].jabatan) - jabRank(b[0].jabatan));
}
function ocard(p, M) {
  const vac = isVacant(p), c = FAM_COLOR[roleFamily(p.jabatan)] || '#6D28D9';
  const ks = M.kids[p.uid] || [];
  const tag = isOpen(p) ? '<span class="otag open">PTK Open</span>' : '';
  const box = `<div class="ocard ${vac ? 'vac' : ''}" style="--oc:${c};--ocb:${tint(c, .12)}" ${CAN_EDIT ? `data-epos="${DATA.positions.indexOf(p)}" role="button" tabindex="0" title="Klik untuk edit / atur atasan"` : `title="${esc(p.group || p.section || '')}"`}>
    <div class="on">${esc(vac ? 'Vacant' : p.nama)}</div><div class="oj">${esc(p.jabatan || '-')}</div>${tag}</div>`;
  return `<li>${box}${ks.length ? tiersHtml(ks, M) : ''}</li>`;
}
function tiersHtml(list, M, tail) {
  const rows = tierRows(list).map((r) => `<ul class="tier">${r.map((p) => ocard(p, M)).join('')}</ul>`);
  if (tail) rows.push(tail);
  return `<div class="tiers">${rows.join('')}</div>`;
}
function orgSections(P) {
  const out = []; const idx = {};
  P.forEach((p) => {
    const s = p.section || 'Lainnya';
    if (idx[s] === undefined) { idx[s] = out.length; out.push({ name: s, groups: [], gidx: {} }); }
    const S = out[idx[s]], g = p.group || s;
    if (S.gidx[g] === undefined) { S.gidx[g] = S.groups.length; S.groups.push({ name: g, list: [] }); }
    S.groups[S.gidx[g]].list.push(p);
  });
  return out;
}
function orgChart(D) {
  const P = D.P; const M = orgModel(P);
  const freeSet = new Set(M.free.map((p) => p.uid));
  const secs = orgSections(P);
  const isTop = (s) => /penanggung|pjo|manajemen|management/i.test(s.name);
  const top = secs.filter(isTop).flatMap((s) => s.groups.flatMap((g) => g.list)).filter((p) => freeSet.has(p.uid));
  let body = secs.filter((s) => !isTop(s)).filter((s) => ui.osec === 'semua' || s.name === ui.osec);
  const secLi = (s) => {
    const all = s.groups.flatMap((g) => g.list), vac = all.filter(isVacant).length;
    const frames = s.groups.map((g) => {
      const fl = g.list.filter((p) => freeSet.has(p.uid)); if (!fl.length) return '';
      const titled = g.name !== s.name;
      return `<div class="gframe">${titled ? `<div class="gtitle" ${CAN_EDIT ? `data-rgrp="${esc(s.name)}" data-g="${esc(g.name)}" role="button" tabindex="0" title="Klik untuk ganti nama sub-section"` : ''}>${esc(g.name)}<span>${g.list.length} posisi</span></div>` : ''}${tiersHtml(fl, M)}</div>`;
    }).join('');
    return `<li><div class="onode sec" ${CAN_EDIT ? `data-rsec="${esc(s.name)}" role="button" tabindex="0" title="Klik untuk ganti nama section"` : ''}><b>${esc(s.name)}</b><span>${all.length} posisi${vac ? ` · ${vac} vacant` : ''}</span></div>${frames ? `<div class="glist">${frames}</div>` : ''}</li>`;
  };
  const secRow = body.length ? `<ul class="tier secs">${body.map(secLi).join('')}</ul>` : '';
  if (ui.osec !== 'semua') return `<div class="org">${tiersHtml([], M, secRow)}</div>`;
  return `<div class="org">${top.length ? tiersHtml(top, M, secRow) : `<div class="tiers">${secRow}</div>`}</div>`;
}
function pageOrg(D) {
  const secs = orgSections(D.P).map((s) => s.name).filter((n) => !/penanggung|pjo|manajemen|management/i.test(n));
  const fams = [...new Set(D.P.map((p) => roleFamily(p.jabatan)))];
  return `<div class="mhead"><div><div class="eyebrow">Monitoring Manpower KTA - TRA</div><h1>Struktur Organisasi</h1><p>Otomatis dari MPP KTA - TRA. Jabatan yang sama tampil sejajar, dikelompokkan per section dan sub-section.</p></div>
    <div class="mtools"><select id="oSec" aria-label="Pilih section"><option value="semua">Semua section</option>${secs.map((s) => `<option ${ui.osec === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="Zoom"><button type="button" data-oz="-">−</button><button type="button" data-oz="fit" aria-pressed="${ui.oz === null}">Pas layar</button><button type="button" data-oz="+">+</button></div>
      ${(DL || IS_TOP) ? '<button type="button" class="btn btn-g" id="printBtn">Print</button>' : ''}</div></div>
  <div class="card orgcard"><div class="olegend">${fams.map((f) => `<span><i style="background:${FAM_COLOR[f] || '#6D28D9'}"></i>${esc(f)}</span>`).join('')}<span><i class="v"></i>Vacant</span>${CAN_EDIT ? '<span class="small">Klik kotak jabatan untuk mengedit atau mengatur <b>atasan langsung</b>.</span>' : ''}</div>
    <div class="orgwrap" id="orgWrap"><div class="orgsizer" id="orgSizer">${orgChart(D)}</div></div></div>
  <p class="note">Bawahan langsung: buka Edit pada posisi (di sini atau di MPP KTA - TRA), lalu isi <b>Atasan langsung</b>. Posisi itu akan pindah ke bawah atasannya. Jika dikosongkan, posisi tampil otomatis sejajar dengan jabatan yang sama di sub-section-nya.</p>`;
}
function applyOrgZoom(forWidth) {
  const wrap = document.getElementById('orgWrap'), sizer = document.getElementById('orgSizer'); if (!wrap || !sizer) return;
  const org = sizer.querySelector('.org'); if (!org) return;
  org.style.transform = 'none';
  const w = org.offsetWidth, h = org.offsetHeight;
  wrap.classList.toggle('fitw', !forWidth && ui.oz === null);
  const fit = forWidth ? Math.min(1, forWidth / w) : Math.min(1, (wrap.clientWidth - 40) / w);
  const s = forWidth ? fit : (ui.oz === null ? Math.max(.2, fit) : ui.oz);
  org.style.transform = `scale(${s})`;
  sizer.style.width = Math.ceil(w * s) + 'px'; sizer.style.height = Math.ceil(h * s) + 'px';
  if (!forWidth) ui.ozCur = s;
}
function render() {
  D = derive();
  let lastG = '';
  const nPel = D.P.reduce((a, p) => a + candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd').length, 0);
  const ct = { mpp: [D.open.length, D.ket['JATUH TEMPO'] > 0], pelamar: [nPel, false], karyawan: [DATA.aktif.length, false], unit: [D.unitTot, false] };
  document.getElementById('nav').innerHTML = PAGES.map((pg) => {
    const lbl = pg.grp !== lastG ? `<div class="lbl">${pg.grp}</div>` : ''; lastG = pg.grp;
    const c = ct[pg.id];
    return `${lbl}<button type="button" data-go="${pg.id}" ${ui.page === pg.id ? 'aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">${pg.ic}</svg>${pg.label}${c ? `<span class="ct ${c[1] ? 'al' : ''}">${c[0]}</span>` : ''}</button>`;
  }).join('');
  document.getElementById('roleTag').textContent = ROLE;
  document.getElementById('roleTag').className = 'pill' + (CAN_EDIT ? ' live' : '');
  document.getElementById('upBtn').hidden = !CAN_EDIT;
  const map = { dashboard: pageDashboard, mpp: pageMPP, pelamar: pagePelamar, org: pageOrg, unit: pageUnit, karyawan: pageKaryawan, setting: pageSetting };
  const ow = document.getElementById('orgWrap'), osc = ow ? [ow.scrollLeft, ow.scrollTop] : null;
  document.getElementById('view').innerHTML = (map[ui.page] || pageDashboard)(D);
  if (ui.page === 'org') {
    applyOrgZoom(); const nw = document.getElementById('orgWrap');
    if (nw) { if (osc && !ui.ojump) { nw.scrollLeft = osc[0]; nw.scrollTop = osc[1]; } else nw.scrollLeft = Math.max(0, (nw.scrollWidth - nw.clientWidth) / 2); }
    ui.ojump = false;
  }
}
document.addEventListener('click', (e) => {
  const z = e.target.closest('[data-oz]'); if (!z) return;
  const v = z.dataset.oz, cur = ui.ozCur || 1;
  ui.oz = v === 'fit' ? null : v === '100' ? 1 : Math.min(1.8, Math.max(.2, +(cur + (v === '+' ? .1 : -.1)).toFixed(2)));
  store.set('kta-oz2', ui.oz === null ? '' : String(ui.oz)); ui.ojump = true;
  render();
});
document.addEventListener('change', (e) => { if (e.target.id === 'oSec') { ui.osec = e.target.value; ui.ojump = true; render(); } });
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('ocard') && (e.target.dataset.epos || e.target.dataset.soe)) { e.preventDefault(); e.target.click(); } });
let _ozT; window.addEventListener('resize', () => { clearTimeout(_ozT); _ozT = setTimeout(() => { if (ui.page === 'org' && ui.oz === null) applyOrgZoom(); }, 150); });
window.addEventListener('beforeprint', () => {
  if (ui.page !== 'org') return;
  let s = document.getElementById('orgPrintCss'); if (!s) { s = document.createElement('style'); s.id = 'orgPrintCss'; document.head.appendChild(s); }
  s.textContent = '';
  const og = document.querySelector('#orgSizer .org'); if (og && og.querySelector('.orgroot.out')) { og.classList.remove('pos-left', 'pos-right'); og.classList.add('pos-bottom'); }
  if (og) { const sz = document.getElementById('orgSizer'); og.style.transform = 'none'; og.style.zoom = ''; const w = og.offsetWidth; og.style.zoom = String(Math.min(1, 660 / w)); if (sz) { sz.style.width = 'auto'; sz.style.height = 'auto'; } }
});
window.addEventListener('afterprint', () => { const s = document.getElementById('orgPrintCss'); if (s) s.remove(); if (ui.page === 'org') render(); });

// "Atasan langsung" in the MPP form
const _mppForm10 = mppForm;
mppForm = function (idx) {
  _mppForm10(idx);
  const p = idx == null ? null : DATA.positions[idx];
  const opts = DATA.positions.filter((x) => !p || x.uid !== p.uid).map((x) => `<option value="${esc(x.uid)}" ${p && p.atasan === x.uid ? 'selected' : ''}>No. ${x.no} · ${esc(isVacant(x) ? 'Vacant' : x.nama)} · ${esc(x.jabatan || '')}</option>`).join('');
  const grid = document.querySelector('#frm .fgrid');
  if (grid) grid.insertAdjacentHTML('beforeend', `<div class="fld full"><label for="f_atasan">Atasan langsung (Struktur Organisasi)</label><select id="f_atasan"><option value="">Otomatis — sejajar dengan jabatan yang sama</option>${opts}</select><small>Pilih atasan jika posisi ini adalah bawahan/anggota dari posisi lain.</small></div>`);
  const save = FORM.onSave;
  FORM.onSave = (v) => {
    const at = (document.getElementById('f_atasan') || {}).value || null;
    const _c = commit;
    commit = (mut, msg) => { commit = _c; return _c((S) => { mut(S); const pos = p ? S.positions.find((x) => x.uid === p.uid) : S.positions.find((x) => !x.uid); if (pos) { if (!pos.uid) pos.uid = newUid(); pos.atasan = at; if (p && (pos.section !== p.section || pos.group !== p.group)) cascadeSection(S, pos); } S.positions.forEach((x) => { if (!x.uid) x.uid = newUid(); }); }, msg); };
    try { return save(v); } finally { commit = _c; }
  };
};

// subordinates (atasan chain) follow their leader's section / sub-section
function cascadeSection(S, pos) {
  const q = [pos.uid], seen = new Set(q);
  while (q.length) {
    const u = q.shift();
    S.positions.forEach((x) => { if (x.atasan === u && !seen.has(x.uid)) { seen.add(x.uid); x.section = pos.section; x.group = pos.group; q.push(x.uid); } });
  }
}
// rename a whole section / sub-section
function renameForm(kind, sec, grp) {
  const old = kind === 'sec' ? sec : grp;
  const n = DATA.positions.filter((p) => kind === 'sec' ? p.section === sec : (p.section === sec && (p.group || p.section) === grp)).length;
  openForm({ eyebrow: 'Struktur Organisasi', title: `Ganti nama ${kind === 'sec' ? 'section' : 'sub-section'}`, submit: 'Simpan',
    intro: `${n} posisi di <b>${esc(old)}</b> ikut berubah.${kind === 'grp' ? ` (Section: ${esc(sec)})` : ''}`,
    values: { nm: old }, fields: [{ k: 'nm', label: kind === 'sec' ? 'Nama section' : 'Nama sub-section', req: true, full: true, list: kind === 'sec' ? SEC_OPTS() : GRP_OPTS() }],
    onSave: (v) => { const nv = String(v.nm).trim(); if (!nv || nv === old) return true; return commit((S) => {
      S.positions.forEach((p) => {
        if (kind === 'sec' && p.section === sec) { if ((p.group || p.section) === sec) p.group = nv; p.section = nv; }
        if (kind === 'grp' && p.section === sec && (p.group || p.section) === grp) p.group = nv;
      });
    }, `${kind === 'sec' ? 'Section' : 'Sub-section'} diganti menjadi ${nv}.`); } });
}
document.addEventListener('click', (e) => {
  if (!CAN_EDIT) return;
  const r = e.target.closest('[data-rsec]'); if (r) { renameForm('sec', r.dataset.rsec); return; }
  const g = e.target.closest('[data-rgrp]'); if (g) { renameForm('grp', g.dataset.rgrp, g.dataset.g); }
});
