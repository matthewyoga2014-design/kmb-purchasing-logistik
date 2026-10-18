
// ================= v20: SO only arranges existing MPP data; dropdowns to avoid duplicate names =================
const uniq = (arr) => { const seen = new Map(); arr.forEach((v) => { const t = String(v || '').trim(); if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t); }); return [...seen.values()]; };
const secList = () => uniq(DATA.positions.map((p) => p.section));
const grpList = (sec) => uniq(DATA.positions.filter((p) => p.section === sec).map((p) => p.group || p.section)).filter((g) => g !== sec);
const jabList = () => uniq(DATA.positions.map((p) => p.jabatan).concat(DATA.aktif.map((p) => p.jabatan))).sort((a, b) => a.localeCompare(b));
const canon = (v, list) => { const t = String(v || '').trim(); if (!t) return t; const hit = list.find((x) => x.toLowerCase() === t.toLowerCase()); return hit || t; };
const optHtml = (list, cur, extra) => list.map((x) => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('') + (extra || '');

// ---------- SO: atur section / sub-section / atasan (hanya pilihan dari MPP) ----------
function soForm(idx) {
  const p = DATA.positions[idx]; if (!p) return;
  FORM = null; MEM = null;
  const anc = new Set(); const desc = new Set([p.uid]);
  let ch = true; while (ch) { ch = false; DATA.positions.forEach((x) => { if (x.atasan && desc.has(x.atasan) && !desc.has(x.uid)) { desc.add(x.uid); ch = true; } }); }
  const grpOpts = (sec, cur) => `<option value="" ${!cur || cur === sec ? 'selected' : ''}>— Langsung di bawah section —</option>` + optHtml(grpList(sec), cur);
  const atOpts = DATA.positions.filter((x) => !desc.has(x.uid)).map((x) => `<option value="${esc(x.uid)}" ${p.atasan === x.uid ? 'selected' : ''}>No. ${x.no} · ${esc(isVacant(x) ? 'Vacant' : x.nama)} · ${esc(x.jabatan || '')} (${esc(x.group || x.section || '')})</option>`).join('');
  document.getElementById('dialog').innerHTML = `<div class="cm-h"><h2 id="mTitle">Atur di Struktur Organisasi</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div>
    <div class="soinfo"><div><span>Jabatan</span><b>${esc(p.jabatan || '-')}</b></div><div><span>Nama</span><b class="${isVacant(p) ? 'vacn' : ''}">${esc(isVacant(p) ? 'Vacant' : p.nama)}</b></div><div><span>No. MPP</span><b>${p.no}</b></div></div>
    <p class="small" style="margin:0 0 12px">Pilihan di bawah diambil dari data MPP, jadi tidak ada nama ganda. Nama, jabatan, dan PTK diubah lewat <b>MPP KTA - TRA</b>.</p>
    <div class="fgrid">
      <div class="fld"><label for="so_sec">Section</label><select id="so_sec">${optHtml(secList(), p.section)}</select></div>
      <div class="fld"><label for="so_grp">Sub-section</label><select id="so_grp">${grpOpts(p.section, p.group)}</select></div>
      <div class="fld full"><label for="so_at">Atasan langsung</label><select id="so_at"><option value="">Otomatis — sejajar dengan jabatan yang sama</option>${atOpts}</select><small>Bawahan orang ini ikut pindah section / sub-section bersamanya.</small></div>
    </div>
    <div class="factions"><button type="button" class="btn btn-g" data-gompp="${idx}">Edit nama / jabatan di MPP</button><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button><button type="button" class="btn btn-p" id="soSave" data-i="${idx}">Simpan</button></div>`;
  document.getElementById('modal').hidden = false;
  document.getElementById('so_sec').addEventListener('change', (e) => { document.getElementById('so_grp').innerHTML = grpOpts(e.target.value, ''); });
  document.getElementById('so_sec').focus();
}
document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-soe]');
  if (c && CAN_EDIT && !e.target.closest('button')) { soForm(+c.dataset.soe); return; }
  const g = e.target.closest('[data-gompp]'); if (g && CAN_EDIT) { const i = +g.dataset.gompp; closeModal(); mppForm(i); return; }
  const sv = e.target.closest('#soSave'); if (!sv || !CAN_EDIT) return;
  const p = DATA.positions[+sv.dataset.i]; if (!p) return;
  const sec = document.getElementById('so_sec').value, grp = document.getElementById('so_grp').value || sec, at = document.getElementById('so_at').value || null;
  if (sec === p.section && grp === (p.group || p.section) && at === (p.atasan || null)) { closeModal(); return; }
  const ok = await commit((S) => {
    const pos = posByUid(S, p.uid); if (!pos) return;
    if (at && at !== pos.atasan) { const L = posByUid(S, at); pos.atasan = at; if (L && (sec === p.section && grp === (p.group || p.section))) { pos.section = L.section; pos.group = L.group || L.section; } else { pos.section = sec; pos.group = grp; } }
    else { pos.atasan = at; pos.section = sec; pos.group = grp; }
    cascadeSection(S, pos);
  }, `${nameOf(p)} diperbarui.`);
  if (ok) closeModal();
});

// ---------- MPP form: section / sub-section / jabatan as dropdowns (+ tambah baru) ----------
function comboize(key, list, cur, onChange) {
  const inp = document.getElementById('f_' + key); if (!inp) return;
  const NEW = '__new__';
  const sel = document.createElement('select'); sel.id = 'f_' + key; sel.name = key;
  const has = cur && list.some((x) => x === cur);
  sel.innerHTML = (key === 'group' ? '<option value="">— Sama dengan section —</option>' : '<option value="">— Pilih —</option>') + optHtml(list, cur) + (cur && !has ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '') + (IS_OWNER ? `<option value="${NEW}">➕ Tambah baru…</option>` : '');
  const box = document.createElement('input'); box.type = 'text'; box.placeholder = 'Ketik nama baru'; box.hidden = true; box.className = 'combonew'; box.autocomplete = 'off';
  inp.replaceWith(sel); sel.after(box);
  const dl = document.getElementById('dl_' + key); if (dl) dl.remove();
  sel.addEventListener('change', () => {
    if (sel.value === NEW) { sel.id = 'f_' + key + '_sel'; box.id = 'f_' + key; box.hidden = false; box.focus(); }
    if (onChange) onChange(sel.value);
  });
}
const _mppForm16 = mppForm;
mppForm = function (idx) {
  _mppForm16(idx);
  const p = idx == null ? null : DATA.positions[idx];
  const secCur = (document.getElementById('f_section') || {}).value || (p && p.section) || '';
  const grpCur = (document.getElementById('f_group') || {}).value || (p && p.group) || '';
  const jabCur = (document.getElementById('f_jabatan') || {}).value || (p && p.jabatan) || '';
  comboize('section', secList(), secCur, (v) => {
    const g = document.getElementById('f_group'); if (!g || g.tagName !== 'SELECT') return;
    g.innerHTML = '<option value="">— Sama dengan section —</option>' + optHtml(grpList(v), '') + (IS_OWNER ? '<option value="__new__">➕ Tambah baru…</option>' : '');
  });
  comboize('group', grpList(secCur), grpCur === secCur ? '' : grpCur);
  comboize('jabatan', jabList(), jabCur);
  const save = FORM.onSave;
  FORM.onSave = (v) => {
    const fix = (k) => { const el = document.getElementById('f_' + k); if (el) v[k] = el.value === '__new__' ? '' : (el.value || '').trim() || null; };
    ['section', 'group', 'jabatan'].forEach(fix);
    if (!v.section) { toast('Pilih atau isi Section.', true); return false; }
    if (!v.jabatan) { toast('Pilih atau isi Jabatan.', true); return false; }
    v.section = canon(v.section, secList()); v.group = v.group ? canon(v.group, grpList(v.section).concat([v.section])) : null; v.jabatan = canon(v.jabatan, jabList());
    return save(v);
  };
};
