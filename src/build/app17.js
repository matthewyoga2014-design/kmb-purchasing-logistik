
// ================= v21: only the Pemilik may add / delete positions (and create new names) =================
const OWNER_ONLY = 'Hanya Pemilik yang bisa menambah atau menghapus posisi.';
const _commit17 = commit;
commit = function (mut, msg) {
  if (!IS_OWNER) {
    const test = JSON.parse(JSON.stringify(STATE));
    const ids = (S) => S.positions.map((p) => p.uid || '');
    const before = ids(test); try { mut(test); } catch (e) { return _commit17(mut, msg); }
    const after = ids(test);
    const removed = before.some((u) => !after.includes(u)), added = after.length !== before.length || after.some((u) => !u || !before.includes(u));
    if (removed || added) { toast(OWNER_ONLY, true); return Promise.resolve(false); }
    const nm = (S, k) => new Set(S.positions.map((p) => String(k === 'group' ? (p.group || p.section) : p[k] || '').toLowerCase()));
    for (const k of ['section', 'group', 'jabatan']) { const old = nm(STATE, k); if ([...nm(test, k)].some((v) => v && !old.has(v))) { toast('Nama section / sub-section / jabatan baru hanya bisa dibuat oleh Pemilik.', true); return Promise.resolve(false); } }
  }
  return _commit17(mut, msg);
};
const _pageMPP17 = pageMPP;
pageMPP = function (D) {
  let h = _pageMPP17(D);
  if (!IS_OWNER) h = h.replace(/<button type="button" class="btn btn-y" id="addPos">[^<]*<\/button>/g, '').replace(/<button type="button" class="btn btn-g btn-sm red" data-delpos="\d+">Hapus<\/button>/g, '');
  return h;
};
const _render17 = render;
render = function () {
  _render17();
  if (!IS_OWNER) {
    const up = document.getElementById('upBtn'); if (up) up.hidden = true;
    document.querySelectorAll('#view [data-sync], #view #rsBtn').forEach((b) => { const s = document.createElement('p'); s.className = 'small'; s.style.margin = '0'; s.textContent = 'Hanya Pemilik yang bisa melakukan ini.'; b.replaceWith(s); });
  }
};
document.addEventListener('click', (e) => {
  if (IS_OWNER || !CAN_EDIT) return;
  const t = e.target;
  if (t.closest('#addPos') || t.closest('[data-delpos]') || t.closest('#upBtn') || t.closest('[data-sync]') || t.closest('#rsBtn')) { e.stopPropagation(); e.preventDefault(); toast(t.closest('#addPos') || t.closest('[data-delpos]') ? OWNER_ONLY : 'Hanya Pemilik yang bisa melakukan ini.', true); return; }
}, true);
