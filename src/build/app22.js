
// ================= Sejajar manual: geser kartu ke samping kartu lain = satu baris, walau jabatannya beda =================
const rowKey = (p) => p.tier || jabKey(p.jabatan);
tierRows = function (list) {
  const m = new Map();
  list.forEach((p) => { const k = rowKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  const rank = (k, r) => { const own = r.filter((p) => jabKey(p.jabatan) === k); return Math.min(...(own.length ? own : r).map((p) => jabRank(p.jabatan))); };
  return [...m.entries()].map(([k, r]) => ({ r, n: rank(k, r) })).sort((a, b) => a.n - b.n).map((x) => x.r);
};
const _doOrgDrop22 = doOrgDrop;
doOrgDrop = async function (uid, t) {
  if (!t || !t.beside) return _doOrgDrop22(uid, t);
  const p = posByUid(DATA, uid), T = posByUid(DATA, t.beside); if (!p || !T) return;
  await commit((S) => {
    const a = S.positions.findIndex((x) => x.uid === uid); const [rec] = S.positions.splice(a, 1);
    const tgt = posByUid(S, t.beside);
    rec.atasan = tgt.atasan || null; rec.section = tgt.section; rec.group = tgt.group || tgt.section;
    const k = rowKey(tgt);
    if (k === jabKey(rec.jabatan)) delete rec.tier; else rec.tier = k;
    const b = S.positions.findIndex((x) => x.uid === t.beside);
    S.positions.splice(t.where === 'before' ? b : b + 1, 0, rec);
    cascadeSection(S, rec);
  }, `${nameOf(p)} sekarang sejajar dengan ${nameOf(T)}.`);
};
// pindah ke atasan / sub-section lain: kembali ke baris sesuai jabatannya
const _moveTo22 = moveTo;
moveTo = function (S, uid, target) { _moveTo22(S, uid, target); const q = posByUid(S, uid); if (q) delete q.tier; };
