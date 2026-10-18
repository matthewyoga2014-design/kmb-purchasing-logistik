
// ================= MPP = patokan: MP Aktif selalu mengikuti posisi terisi di MPP =================
// Setiap posisi MPP yang sudah terisi nama = 1 karyawan aktif. Detail (kontrak, POH, tanggal masuk, dst.)
// diambil dari sheet MP Aktif bila namanya cocok (ejaan boleh sedikit beda); nama di luar MPP tidak dihitung aktif.
function mpNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function mpLev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function mpScore(x, y) {
  if (!x || !y) return 0;
  if (x === y) return 100;
  const tx = x.split(' '), ty = y.split(' ');
  const [s, l] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  if (s.every((t, i) => l[i] === t)) return 90;                       // "bepri agung" ~ "bepri agung nugroho"
  if (mpLev(x, y) <= 2 && Math.min(x.length, y.length) >= 5) return 80; // "selamet hariadi" ~ "slamet heriadi"
  if (s.length === 1 && l[0].startsWith(s[0]) && s[0].length >= 3) return 60; // "adi" ~ "aditya"
  if (tx[0] === ty[0] && tx[0].length >= 4 && s.slice(1).every((t) => l.some((u) => mpLev(t, u) <= 1))) return 70;
  return 0;
}
function mppSync(S) {
  if (!S || !Array.isArray(S.positions)) return S;
  const src = Array.isArray(S.aktif) ? S.aktif : [];
  const used = new Set();
  const filled = S.positions.filter((p) => p.nama && !/^vacant$/i.test(String(p.nama).trim()));
  const pairs = [];
  filled.forEach((p, i) => src.forEach((a, j) => { const sc = mpScore(mpNorm(p.nama), mpNorm(a.nama)); if (sc) pairs.push([sc, i, j]); }));
  pairs.sort((a, b) => b[0] - a[0]);
  const pick = new Map();
  pairs.forEach(([, i, j]) => { if (!pick.has(i) && !used.has(j)) { pick.set(i, j); used.add(j); } });
  const out = filled.map((p, i) => {
    const a = pick.has(i) ? src[pick.get(i)] : null;
    return a ? { ...a, nama: p.nama, jabatan: a.jabatan || p.jabatan } : { nama: p.nama, jabatan: p.jabatan, dept: p.section || null, level: null, kontrak: null, akhir: null, poh: null, masuk: null, jk: null, kategori: null, site: null, dariMpp: true };
  });
  const same = out.length === src.length && out.every((x, k) => JSON.stringify(x) === JSON.stringify(src[k]));
  if (!same) S.aktif = out;
  return S;
}
const _commit21 = commit;
commit = function (mutate, okMsg) {
  const before = new Set((DATA.aktif || []).map((a) => mpNorm(a.nama)));
  const outBefore = new Set((DATA.keluar || []).map((a) => mpNorm(a.nama)));
  let dropped = [], freed = [];
  const r = _commit21((S) => {
    mutate(S);
    // karyawan yang baru dipindah ke MP Out -> posisinya di MPP otomatis jadi Vacant
    (S.keluar || []).filter((k) => !outBefore.has(mpNorm(k.nama))).forEach((k) => {
      const p = S.positions.find((x) => x.nama && !/^vacant$/i.test(x.nama) && mpScore(mpNorm(x.nama), mpNorm(k.nama)) >= 80);
      if (p) { freed.push(p.nama); p.nama = 'Vacant'; }
    });
    const added = (S.aktif || []).filter((a) => !before.has(mpNorm(a.nama)));
    mppSync(S);
    const now = new Set(S.aktif.map((a) => mpNorm(a.nama)));
    dropped = added.filter((a) => !now.has(mpNorm(a.nama)) && !S.aktif.some((b) => mpScore(mpNorm(a.nama), mpNorm(b.nama)))).map((a) => a.nama);
  }, okMsg);
  Promise.resolve(r).then((ok) => {
    if (ok === false) return;
    const nm = (L) => L.slice(0, 3).join(', ') + (L.length > 3 ? ` dan ${L.length - 3} lainnya` : '');
    if (freed.length) setTimeout(() => toast(`Posisi ${nm(freed)} di MPP sekarang Vacant.`), 300);
    else if (dropped.length) setTimeout(() => toast(`${nm(dropped)} tidak ada di MPP, jadi tidak dihitung MP Aktif. MPP adalah patokan.`, true), 300);
  });
  return r;
};
const _render21 = render;
render = function () { if (typeof DATA !== 'undefined') mppSync(DATA); return _render21.apply(this, arguments); };
