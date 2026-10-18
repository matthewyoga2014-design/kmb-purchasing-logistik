
// ================= v24: "Atur" forms for section / sub-section (sejajar, induk, urutan, tampilan) =================
function grpNamesOf(sec) { return grpOrderOf(DATA, sec).filter((g) => g !== sec); }
renameForm = function (kind, sec, grp) {
  const own = IS_OWNER;
  if (kind === 'sec') {
    const lay = (DATA.orgSecLay || {})[sec] || '';
    openForm({ eyebrow: 'Struktur Organisasi', title: `Atur section — ${sec}`, submit: 'Simpan',
      values: { nm: sec, lay, out: secOut(sec) },
      fields: [
        { k: 'nm', label: 'Nama section', req: true, full: true, hint: own ? 'Semua posisi di section ini ikut berganti nama.' : 'Hanya Pemilik yang bisa mengganti nama.' },
        { k: 'lay', label: 'Tampilan sub-section di section ini', type: 'select', full: true, options: [['', 'Ikuti tombol tampilan (Mendatar / Menurun)'], ['h', 'Sejajar ke samping (berjajar)'], ['v', 'Bersusun ke bawah (ringkas)']] },
        { k: 'out', label: 'Tampilkan terpisah — di luar Struktur Organisasi', type: 'check' },
      ],
      onSave: (v) => { const nv = own ? String(v.nm || '').trim() || sec : sec; return commit((S) => {
        const L = { ...(S.orgSecLay || {}) }; delete L[sec]; if (v.lay) L[nv] = v.lay; S.orgSecLay = L;
        const m = { ...(S.orgSecMode || {}) }; delete m[sec]; m[nv] = v.out ? 'out' : 'in'; S.orgSecMode = m;
        if (nv !== sec) {
          S.positions.forEach((p) => { if (p.section === sec) { if ((p.group || p.section) === sec) p.group = nv; p.section = nv; } });
          const fix = (k) => { if (!k) return k; const [s2, g2] = k.split('›'); return s2 === sec ? GK(nv, g2 === sec ? nv : g2) : k; };
          const g = {}; Object.entries(gmap(S)).forEach(([k, x]) => { g[fix(k)] = fix(x); }); S.orgGroups = g;
          const o = { ...(S.orgGrpOrder || {}) }; if (o[sec]) { o[nv] = o[sec]; delete o[sec]; } S.orgGrpOrder = o;
          S.orgSecOrder = (S.orgSecOrder || []).map((x) => x === sec ? nv : x);
        }
      }, nv !== sec ? `Section diganti menjadi ${nv}.` : `Pengaturan ${sec} disimpan.`); } });
    if (!own) { const f = document.getElementById('f_nm'); if (f) f.disabled = true; }
    return;
  }
  const map = gmap(DATA), key = GK(sec, grp), desc = new Set(gDesc(map, key));
  const others = grpNamesOf(sec).filter((g) => g !== grp);
  const curParent = (gParent(map, key) || '').split('›')[1] || '';
  const ord = grpNamesOf(sec), i = ord.indexOf(grp), nextG = ord.slice(i + 1).find((g) => ((gParent(map, GK(sec, g)) || '').split('›')[1] || '') === curParent) || '';
  openForm({ eyebrow: `Struktur Organisasi · ${sec}`, title: `Atur sub-section — ${grp}`, submit: 'Simpan',
    values: { nm: grp, par: curParent, bef: nextG },
    fields: [
      { k: 'nm', label: 'Nama sub-section', req: true, full: true, hint: own ? 'Semua posisi di sub-section ini ikut berganti nama.' : 'Hanya Pemilik yang bisa mengganti nama.' },
      { k: 'par', label: 'Letak', type: 'select', full: true, options: [['', `Sejajar — langsung di bawah ${sec}`]].concat(others.filter((g) => !desc.has(GK(sec, g))).map((g) => [g, `Di bawah sub-section ${g}`])) },
      { k: 'bef', label: 'Urutan', type: 'select', full: true, options: [['', 'Paling akhir']].concat(others.map((g) => [g, `Sebelum ${g}`])) },
    ],
    onSave: (v) => { const nv = own ? String(v.nm || '').trim() || grp : grp; return commit((S) => {
      const m = { ...gmap(S) };
      if (v.par) m[GK(sec, grp)] = GK(sec, v.par); else delete m[GK(sec, grp)];
      S.orgGroups = m;
      const o = grpOrderOf(S, sec).filter((g) => g !== grp); const at = v.bef ? o.indexOf(v.bef) : -1; o.splice(at < 0 ? o.length : at, 0, grp);
      S.orgGrpOrder = { ...(S.orgGrpOrder || {}), [sec]: o };
      if (nv !== grp) {
        S.positions.forEach((p) => { if (p.section === sec && (p.group || p.section) === grp) p.group = nv; });
        const fix = (k) => k === GK(sec, grp) ? GK(sec, nv) : k; const g = {}; Object.entries(gmap(S)).forEach(([k, x]) => { g[fix(k)] = fix(x); }); S.orgGroups = g;
        S.orgGrpOrder = { ...S.orgGrpOrder, [sec]: S.orgGrpOrder[sec].map((x) => x === grp ? nv : x) };
      }
    }, v.par ? `${nv} sekarang di bawah ${v.par}.` : `${nv} sejajar langsung di bawah ${sec}.`); } });
  if (!own) { const f = document.getElementById('f_nm'); if (f) f.disabled = true; }
};
