'use strict';
/*
 * Penyimpanan lokal Monitoring Offline.
 * Meniru bagian Supabase yang dipakai web Monitoring (tabel, RPC, storage)
 * dan backend Google Apps Script Notulensi — semuanya disimpan sebagai file
 * di folder data milik pengguna. Modul ini murni Node.js (tanpa Electron)
 * supaya bisa diuji di luar aplikasi.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCAL_EMAIL = 'pemilik@monitoring.lokal';
const LOCAL_UID = '00000000-0000-4000-8000-00000000000a';
const APPS = ['kta-tra', 'bupr-ampah', 'mbj', 'kmb', 'apd', 'unit-monitoring', 'notulensi'];
const OFFLINE_MSG = 'Fitur ini butuh internet dan tidak tersedia di aplikasi Monitoring offline.';

const now = () => new Date().toISOString();
const hex = (n) => crypto.randomBytes(n).toString('hex');
const uuid = () => crypto.randomUUID();
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Skema tabel: primary key + nilai bawaan (mengikuti database online).
const SCHEMA = {
  apd_delete_audit: { pk: ['id'], defaults: { id: 'seq', deleted_at: 'now' } },
  apd_state: { pk: ['id'], defaults: { id: () => 'main', data: () => ({ people: [], transactions: [] }), revision: () => 0, updated_at: 'now' } },
  app_access_roles: { pk: ['app_id', 'email'], ci: ['email'], defaults: { created_at: 'now', updated_at: 'now' } },
  app_state_private: { pk: ['app_id'], defaults: { data: () => ({}), updated_at: 'now' } },
  app_state_public: { pk: ['app_id'], defaults: { data: () => ({}), updated_at: 'now' } },
  candidate_attachments: { pk: ['id'], unique: [['object_path']], defaults: { id: 'uuid', uploaded_by: () => LOCAL_UID, created_at: 'now' } },
  kta_access_requests: { pk: ['id'], unique: [['app_id', 'email']], defaults: { id: 'uuid', role: () => 'viewer', status: () => 'pending', requested_at: 'now' } },
  kta_activity_log: { pk: ['id'], defaults: { id: 'seq', at: 'now' } },
  kta_app_perms: { pk: ['app_id'], defaults: { perms: () => ({}), updated_at: 'now' } },
  kta_download_access: { pk: ['email', 'app_id'], defaults: { added_at: 'now' } },
  kta_invites: { pk: ['token'], defaults: { token: () => hex(18), created_at: 'now', expires_at: () => new Date(Date.now() + 30 * 864e5).toISOString(), revoked: () => false } },
  kta_print_grants: { pk: ['app_id', 'email'], defaults: { app_id: () => 'kta-tra', status: () => 'pending', requested_at: 'now' } },
  kta_share_links: { pk: ['app_id'], defaults: { updated_at: 'now' } },
  kta_web_state: { pk: ['id'], defaults: { updated_at: 'now' } },
  kta_mp_private: { pk: ['site_id', 'pkey'], defaults: { updated_at: 'now' } },
  monitoring_guest_links: { pk: ['token'], defaults: { token: () => hex(24), created_at: 'now', expires_at: () => new Date(Date.now() + 30 * 864e5).toISOString(), revoked: () => false } },
  mpp_portal_projects: { pk: ['project_key'], defaults: { description: () => '', href: () => '', source_ids: () => [], theme: () => 'kmb', created_at: 'now', updated_at: 'now' } },
  organizational_charts: { pk: ['app_id'], defaults: { nodes: () => [], updated_at: 'now' } },
  portal_display_settings: { pk: ['app_key'], defaults: { description: () => '', updated_at: 'now' } },
};
const schemaOf = (t) => SCHEMA[t] || { pk: ['id'], defaults: { id: 'uuid', created_at: 'now' } };

// Data awal supaya setiap halaman langsung bisa dipakai walau masih kosong.
const EMPTY_SITE = () => ({ meta: {}, aktif: [], keluar: [], units: [], positions: [] });
const EMPTY_MP = () => ({ mpp: [], mpOut: [], units: [], mpActive: [], candidates: [] });
function seedRows() {
  const t = now();
  const site = (id) => ({ id, data: EMPTY_SITE(), updated_at: t, updated_by: LOCAL_EMAIL });
  const mp = (app_id, data) => ({ app_id, data, updated_at: t, updated_by: LOCAL_EMAIL });
  return {
    kta_web_state: ['main', 'kmb-c4', 'kmb-workshop', 'kmb-slr-rekondisi', 'kmb-slr-maintenance', 'bupr', 'mbj'].map(site),
    apd_state: [{ id: 'main', data: {}, revision: 0, updated_at: t, updated_by: LOCAL_EMAIL }],
    app_state_public: [
      mp('kta-tra', EMPTY_MP()), mp('kmb', { ...EMPTY_MP(), sites: [] }), mp('mbj', EMPTY_MP()), mp('bupr-ampah', EMPTY_MP()),
      mp('unit-monitoring', { rev: 0, units: [], projects: [], mobilisasi: [], pengiriman: [], sheetApi: '', sheetUrl: '' }),
    ],
    app_state_private: [mp('kta-tra', EMPTY_MP()), mp('kmb', { ...EMPTY_MP(), sites: [] }), mp('mbj', EMPTY_MP()), mp('bupr-ampah', EMPTY_MP())],
  };
}

class PgError extends Error {
  constructor(message, code, details) { super(message); this.code = code || 'P0001'; this.details = details || null; this.hint = null; }
}

// ---------- pembacaan kolom & filter ala PostgREST ----------
function colVal(row, col) {
  const m = String(col).split(/(->>|->)/);
  let v = row ? row[m[0].trim()] : undefined;
  for (let i = 1; i < m.length; i += 2) {
    const key = m[i + 1].trim().replace(/^'|'$/g, '');
    if (v && typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = undefined; } }
    v = v == null ? undefined : Array.isArray(v) && /^\d+$/.test(key) ? v[Number(key)] : v[key];
    if (m[i] === '->>' && v != null && typeof v === 'object') v = JSON.stringify(v);
    else if (m[i] === '->>' && v != null) v = String(v);
  }
  return v;
}
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a).localeCompare(String(b));
  const na = Number(a), nb = Number(b);
  if (a !== '' && b !== '' && !isNaN(na) && !isNaN(nb) && typeof a !== 'object' && typeof b !== 'object') return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
const same = (a, b, ci) => {
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return ci ? String(a).toLowerCase() === String(b).toLowerCase() : String(a) === String(b);
};
const likeRe = (p, flags) => new RegExp('^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.').replace(/\*/g, '.*') + '$', flags);
function parseList(v) {
  if (Array.isArray(v)) return v;
  const s = String(v).replace(/^\(|\)$/g, '');
  return s === '' ? [] : s.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
}
function test(row, f, ci) {
  const v = colVal(row, f.col);
  const isCi = ci && ci.includes(String(f.col));
  let r;
  switch (f.op) {
    case 'eq': r = same(v, f.val, isCi); break;
    case 'neq': r = v != null && !same(v, f.val, isCi); break;
    case 'gt': r = v != null && cmp(v, f.val) > 0; break;
    case 'gte': r = v != null && cmp(v, f.val) >= 0; break;
    case 'lt': r = v != null && cmp(v, f.val) < 0; break;
    case 'lte': r = v != null && cmp(v, f.val) <= 0; break;
    case 'like': r = v != null && likeRe(f.val).test(String(v)); break;
    case 'ilike': r = v != null && likeRe(f.val, 'i').test(String(v)); break;
    case 'is': {
      const w = f.val === 'null' ? null : f.val === 'true' ? true : f.val === 'false' ? false : f.val;
      r = w === null ? v == null : v === w; break;
    }
    case 'in': r = v != null && parseList(f.val).some((x) => same(v, x, isCi)); break;
    case 'cs': case 'contains': {
      const want = typeof f.val === 'string' ? parseList(f.val.replace(/^\{|\}$/g, '')) : f.val;
      if (Array.isArray(v)) r = (Array.isArray(want) ? want : [want]).every((w) => v.some((x) => same(x, w)));
      else if (v && typeof v === 'object' && want && typeof want === 'object') r = Object.keys(want).every((k) => same(v[k], want[k]));
      else r = false;
      break;
    }
    case 'or': r = parseOr(f.val).some((g) => test(row, g, ci)); break;
    case 'and': r = parseOr(f.val).every((g) => test(row, g, ci)); break;
    default: r = true;
  }
  return f.not ? !r : r;
}
function splitTop(s) {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') d++;
    if (ch === ')') d--;
    if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function parseOr(str) {
  return splitTop(String(str)).map((part) => {
    const m = part.match(/^(and|or)\((.*)\)$/);
    if (m) return { op: m[1], val: m[2], col: '' };
    const bits = part.split('.');
    const col = bits.shift();
    let not = false;
    if (bits[0] === 'not') { not = true; bits.shift(); }
    const op = bits.shift();
    return { col, op, val: bits.join('.'), not };
  });
}
function pick(row, columns) {
  const cols = String(columns || '*').split(',').map((c) => c.trim()).filter(Boolean);
  if (!cols.length || cols.includes('*')) return clone(row);
  const out = {};
  for (const c of cols) {
    if (c.includes('(')) continue; // relasi tidak didukung
    let alias = null, src = c;
    const m = c.match(/^([^:]+):(.+)$/);
    if (m && !m[2].startsWith(':')) { alias = m[1]; src = m[2]; }
    src = src.split('::')[0];
    const name = alias || src.split(/->>|->/).pop().trim();
    out[name] = clone(colVal(row, src));
    if (out[name] === undefined) out[name] = null;
  }
  return out;
}

class Store {
  constructor(opts) {
    this.dir = opts.dataDir;
    this.filesDir = opts.filesDir;
    this.onChange = opts.onChange || (() => {});
    this.tablesDir = path.join(this.dir, 'tabel');
    fs.mkdirSync(this.tablesDir, { recursive: true });
    fs.mkdirSync(this.filesDir, { recursive: true });
    this.cache = {};
    this.timers = {};
    this.meta = this._readJson(path.join(this.dir, 'meta.json'), null);
    if (!this.meta) {
      this.meta = { created_at: now(), seq: {}, format: 1 };
      const seed = seedRows();
      for (const t of Object.keys(seed)) { this.cache[t] = seed[t]; this._writeNow(t); }
      this._saveMeta();
    }
  }

  // ---------- file ----------
  _readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
  }
  _atomicWrite(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  }
  _saveMeta() { this._atomicWrite(path.join(this.dir, 'meta.json'), JSON.stringify(this.meta, null, 1)); }
  _safeName(t) { return String(t).replace(/[^a-z0-9_-]/gi, '_'); }
  table(t) {
    if (!this.cache[t]) this.cache[t] = this._readJson(path.join(this.tablesDir, this._safeName(t) + '.json'), []);
    return this.cache[t];
  }
  _writeNow(t) {
    clearTimeout(this.timers[t]); delete this.timers[t];
    this._atomicWrite(path.join(this.tablesDir, this._safeName(t) + '.json'), JSON.stringify(this.cache[t] || []));
  }
  _dirty(t) {
    clearTimeout(this.timers[t]);
    this.timers[t] = setTimeout(() => this._writeNow(t), 250);
    this.onChange(t);
  }
  flush() { for (const t of Object.keys(this.timers)) this._writeNow(t); }
  tableNames() {
    const names = new Set(Object.keys(this.cache));
    for (const f of fs.readdirSync(this.tablesDir)) if (f.endsWith('.json')) names.add(f.slice(0, -5));
    return [...names].sort();
  }

  // ---------- baris ----------
  _defaults(t, row) {
    const s = schemaOf(t);
    const r = { ...row };
    for (const [k, d] of Object.entries(s.defaults || {})) {
      if (r[k] !== undefined) continue;
      if (d === 'now') r[k] = now();
      else if (d === 'uuid') r[k] = uuid();
      else if (d === 'seq') { this.meta.seq[t] = (this.meta.seq[t] || this.table(t).reduce((m, x) => Math.max(m, Number(x[k]) || 0), 0)) + 1; r[k] = this.meta.seq[t]; this._saveMeta(); }
      else r[k] = d();
    }
    return r;
  }
  _keyOf(t, row, cols) {
    const s = schemaOf(t);
    return (cols || s.pk).map((c) => { const v = row[c]; return (s.ci || []).includes(c) && v != null ? String(v).toLowerCase() : JSON.stringify(v); }).join('|');
  }
  _match(t, filters) {
    const ci = schemaOf(t).ci;
    return this.table(t).filter((r) => (filters || []).every((f) => test(r, f, ci)));
  }

  query(q) {
    try { return this._query(q); } catch (e) {
      return { data: null, error: { message: e.message, code: e.code || 'P0001', details: e.details || null, hint: null }, count: null, status: 400 };
    }
  }
  _query(q) {
    const t = q.table;
    let rows, status = 200;
    const s = schemaOf(t);
    if (q.action === 'select') {
      rows = this._match(t, q.filters);
    } else if (q.action === 'insert' || q.action === 'upsert') {
      const vals = (Array.isArray(q.values) ? q.values : [q.values]).filter(Boolean);
      const tab = this.table(t);
      const conflict = q.onConflict ? String(q.onConflict).split(',').map((x) => x.trim()) : s.pk;
      rows = [];
      for (const v0 of vals) {
        const v = clone(v0);
        if (q.action === 'upsert') {
          const probe = this._defaults(t, v);
          const k = this._keyOf(t, probe, conflict);
          const idx = tab.findIndex((r) => this._keyOf(t, r, conflict) === k);
          if (idx >= 0) {
            if (q.ignoreDuplicates) continue;
            tab[idx] = { ...tab[idx], ...v };
            rows.push(tab[idx]);
            continue;
          }
          tab.push(probe); rows.push(probe);
        } else {
          const r = this._defaults(t, v);
          const keys = [s.pk, ...(s.unique || [])];
          for (const cols of keys) {
            const k = this._keyOf(t, r, cols);
            if (tab.some((x) => this._keyOf(t, x, cols) === k)) throw new PgError(`duplicate key value violates unique constraint "${t}_${cols.join('_')}_key"`, '23505');
          }
          tab.push(r); rows.push(r);
        }
      }
      status = 201;
      this._dirty(t);
    } else if (q.action === 'update') {
      rows = this._match(t, q.filters);
      for (const r of rows) Object.assign(r, clone(q.values));
      if (rows.length) this._dirty(t);
    } else if (q.action === 'delete') {
      rows = this._match(t, q.filters);
      if (rows.length) {
        const del = new Set(rows);
        this.cache[t] = this.table(t).filter((r) => !del.has(r));
        this._dirty(t);
      }
    } else throw new PgError('Aksi tidak dikenal: ' + q.action);

    const count = q.count ? rows.length : null;
    if (q.action === 'select' || q.returning) {
      let out = rows.slice();
      for (const o of [...(q.order || [])].reverse()) {
        out.sort((a, b) => {
          const va = colVal(a, o.col), vb = colVal(b, o.col);
          if (va == null || vb == null) {
            if (va == null && vb == null) return 0;
            const nf = o.nullsFirst != null ? o.nullsFirst : !o.ascending;
            return (va == null ? -1 : 1) * (nf ? 1 : -1);
          }
          return o.ascending ? cmp(va, vb) : -cmp(va, vb);
        });
      }
      if (q.range) out = out.slice(q.range[0], q.range[1] + 1);
      if (q.limit != null) out = out.slice(0, q.limit);
      out = out.map((r) => pick(r, q.columns));
      if (q.head) return { data: null, error: null, count, status };
      if (q.single === 'single') {
        if (out.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: `The result contains ${out.length} rows`, hint: null }, count, status: 406 };
        return { data: out[0], error: null, count, status };
      }
      if (q.single === 'maybe') {
        if (out.length > 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: `The result contains ${out.length} rows`, hint: null }, count, status: 406 };
        return { data: out[0] || null, error: null, count, status };
      }
      return { data: out, error: null, count, status };
    }
    return { data: null, error: null, count, status: q.action === 'insert' || q.action === 'upsert' ? 201 : 204 };
  }

  // ---------- RPC (fungsi database) ----------
  rpc(name, args) {
    try {
      const fn = RPC[name];
      if (!fn) throw new PgError(OFFLINE_MSG + ' (' + name + ')');
      return { data: clone(fn.call(this, args || {})), error: null, status: 200 };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code || 'P0001', details: null, hint: null }, status: 400 };
    }
  }
  _get(t, filters) { return this._match(t, filters)[0]; }

  // ---------- storage (lampiran) ----------
  _bucketPath(bucket, p) {
    const base = path.join(this.filesDir, this._safeName(bucket));
    const full = path.resolve(base, String(p || '').replace(/^\/+/, ''));
    if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Alamat berkas tidak valid');
    return full;
  }
  storage(op, a) {
    try {
      const f = () => this._bucketPath(a.bucket, a.path);
      if (op === 'upload') {
        const file = f();
        if (fs.existsSync(file) && !a.upsert) return { data: null, error: { message: 'The resource already exists', statusCode: '409', error: 'Duplicate' } };
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(a.b64 || '', 'base64'));
        this.onChange('storage');
        return { data: { path: a.path, id: a.path, fullPath: a.bucket + '/' + a.path }, error: null };
      }
      if (op === 'download') {
        const file = f();
        if (!fs.existsSync(file)) return { data: null, error: { message: 'Object not found', statusCode: '404' } };
        return { data: { b64: fs.readFileSync(file).toString('base64'), type: mimeOf(file) }, error: null };
      }
      if (op === 'remove') {
        const out = [];
        for (const p of a.paths || []) {
          const file = this._bucketPath(a.bucket, p);
          if (fs.existsSync(file)) { fs.rmSync(file, { force: true }); out.push({ name: p }); }
        }
        this.onChange('storage');
        return { data: out, error: null };
      }
      if (op === 'list') {
        const dir = this._bucketPath(a.bucket, a.path || '');
        if (!fs.existsSync(dir)) return { data: [], error: null };
        let items = fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
          const st = fs.statSync(path.join(dir, d.name));
          return d.isDirectory() ? { name: d.name, id: null, updated_at: null, created_at: null, metadata: null }
            : { name: d.name, id: d.name, updated_at: st.mtime.toISOString(), created_at: st.birthtime.toISOString(), metadata: { size: st.size, mimetype: mimeOf(d.name) } };
        });
        const o = a.options || {};
        if (o.search) items = items.filter((x) => x.name.includes(o.search));
        items.sort((x, y) => x.name.localeCompare(y.name));
        return { data: items.slice(o.offset || 0, (o.offset || 0) + (o.limit || 100)), error: null };
      }
      if (op === 'exists') return { data: fs.existsSync(f()), error: null };
      return { data: null, error: { message: 'Operasi storage tidak dikenal: ' + op } };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }
  readStorageFile(bucket, p) {
    const file = this._bucketPath(bucket, p);
    return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
  }

  // ---------- pengganti Google Apps Script Notulensi ----------
  _notuFile() { return path.join(this.dir, 'notulensi-data.json'); }
  notuState() {
    const d = this._readJson(this._notuFile(), null) || { folders: {}, series: {}, versions: {}, files: {}, _meta: { rev: 1 } };
    for (const c of ['folders', 'series', 'versions', 'files']) if (!d[c]) d[c] = {};
    if (!d._meta) d._meta = { rev: 1 };
    return d;
  }
  gas(kind, req) {
    try {
      if (kind !== 'notulensi') return { ok: false, error: 'Google Sheet tidak tersedia di aplikasi offline. Data unit disimpan di aplikasi ini.' };
      const op = req.op;
      const who = { email: LOCAL_EMAIL, id: LOCAL_UID };
      if (op === 'whoami') return { ok: true, email: who.email, id: who.id, role: 'owner' };
      if (op === 'ping') return { ok: true, app: 'notulensi', guestAccess: false, version: 'offline' };
      if (op === 'state') {
        const st = this.notuState(); const rev = Number(st._meta.rev) || 1;
        if (req.rev && Number(req.rev) === rev) return { ok: true, rev, same: true };
        return { ok: true, rev, data: st };
      }
      if (op === 'write') {
        const st = this.notuState();
        for (const o of req.ops || []) {
          if (!['folders', 'series', 'versions', 'files'].includes(o.col)) throw new Error('Koleksi tidak dikenal: ' + o.col);
          if (o.t === 'put') st[o.col][o.id] = o.data || {};
          else if (o.t === 'del') delete st[o.col][o.id];
        }
        const rev = (Number(st._meta.rev) || 1) + 1;
        st._meta = { rev, at: now(), by: who.email };
        this._atomicWrite(this._notuFile(), JSON.stringify(st));
        this.onChange('notulensi');
        return { ok: true, rev };
      }
      const idx = this._readJson(path.join(this.dir, 'notulensi-berkas.json'), {});
      const saveIdx = () => this._atomicWrite(path.join(this.dir, 'notulensi-berkas.json'), JSON.stringify(idx, null, 1));
      const root = path.join(this.filesDir, 'Notulensi');
      if (op === 'upload') {
        const bytes = Buffer.from(req.b64 || '', 'base64');
        if (bytes.length > 50 * 1024 * 1024) throw new Error('Berkas lebih dari 50 MB');
        const dirs = (req.dirs || []).map((d) => String(d || '').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120)).filter(Boolean);
        const folder = path.join(root, ...dirs);
        fs.mkdirSync(folder, { recursive: true });
        const name = String(req.name || 'berkas').replace(/[\\/:*?"<>|]+/g, '-');
        let file = path.join(folder, name);
        const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
        for (let i = 2; fs.existsSync(file); i++) file = path.join(folder, `${base} (${i})${ext}`);
        fs.writeFileSync(file, bytes);
        const id = 'f' + hex(10);
        idx[id] = { rel: path.relative(root, file), mime: req.mime || mimeOf(file), at: now() };
        saveIdx(); this.onChange('notulensi');
        return { ok: true, id, size: bytes.length, mime: idx[id].mime, url: null };
      }
      if (op === 'download') {
        const it = idx[req.id];
        if (!it) throw new Error('Berkas tidak ditemukan di folder Berkas\\Notulensi');
        const file = path.join(root, it.rel);
        return { ok: true, name: path.basename(file), mime: it.mime, b64: fs.readFileSync(file).toString('base64') };
      }
      if (op === 'trash') {
        const it = idx[req.id];
        if (it) {
          const file = path.join(root, it.rel);
          const bin = path.join(this.filesDir, '_Dihapus', 'Notulensi', path.dirname(it.rel));
          if (fs.existsSync(file)) { fs.mkdirSync(bin, { recursive: true }); fs.renameSync(file, path.join(bin, Date.now() + '-' + path.basename(file))); }
          delete idx[req.id]; saveIdx();
        }
        return { ok: true };
      }
      if (op === 'roles') return { ok: true, roles: {} };
      if (op === 'setRole') throw new Error(OFFLINE_MSG);
      throw new Error('Perintah tidak dikenal: ' + op);
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  // ---------- impor / ekspor ----------
  exportAll() {
    this.flush();
    const tables = {};
    for (const t of this.tableNames()) tables[t] = clone(this.table(t));
    return { format: 'monitoring-offline', version: 1, exported_at: now(), tables, notulensi: this.notuState() };
  }
  importAll(obj, mode) {
    if (!obj || obj.format !== 'monitoring-offline' || !obj.tables) throw new Error('File ini bukan cadangan data Monitoring.');
    const replace = mode !== 'merge';
    for (const [t, rows] of Object.entries(obj.tables)) {
      if (!Array.isArray(rows)) continue;
      if (t === 'office_jobs' || t.startsWith('office_')) continue;
      if (replace) this.cache[t] = clone(rows);
      else {
        const tab = this.table(t);
        for (const r of rows) {
          const k = this._keyOf(t, r);
          const i = tab.findIndex((x) => this._keyOf(t, x) === k);
          if (i >= 0) tab[i] = clone(r); else tab.push(clone(r));
        }
      }
      // Monitoring Unit memakai data di aplikasi ini, bukan Google Sheet.
      if (t === 'app_state_public') for (const r of this.table(t)) if (r.app_id === 'unit-monitoring' && r.data) { r.data.sheetApi = ''; }
      this._writeNow(t);
    }
    if (obj.notulensi) this._atomicWrite(this._notuFile(), JSON.stringify(obj.notulensi));
    this.meta.seq = {};
    this._saveMeta();
    this.onChange('import');
  }
}

// ---------- implementasi RPC ----------
const SITE_LABEL = { 'kmb-c4': 'C4', 'kmb-slr-maintenance': 'SLR - Maintenance', 'kmb-slr-rekondisi': 'SLR - Rekondisi', 'kmb-workshop': 'Workshop Legok' };
const offline = () => { throw new PgError(OFFLINE_MSG); };
const RPC = {
  kta_member_role() { return 'owner'; },
  kta_web_role() { return 'owner'; },
  kta_web_role_for() { return 'owner'; },
  kta_my_apps() { return APPS.map((app_id) => ({ app_id, role: 'owner' })); },
  kta_app_ok({ p_app }) { return APPS.includes(p_app); },
  kta_web_read({ p_ids }) {
    const ids = p_ids || [];
    return this.table('kta_web_state').filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, data: r.data, updated_at: r.updated_at }));
  },
  monitoring_guest_read(a) { return RPC.kta_web_read.call(this, a); },
  monitoring_guest_write({ p_id, p_data, p_old }) {
    const r = this._get('kta_web_state', [{ col: 'id', op: 'eq', val: p_id }]);
    if (!r) throw new PgError('Data tidak ditemukan');
    if (p_old && r.updated_at && p_old !== r.updated_at) throw new PgError('Data sudah berubah, muat ulang');
    r.data = p_data; r.updated_at = now(); r.updated_by = LOCAL_EMAIL;
    this._dirty('kta_web_state');
    return r.updated_at;
  },
  monitoring_guest_check() { return []; },
  monitoring_guest_list() { return []; },
  monitoring_guest_unit_config() {
    const r = this._get('app_state_public', [{ col: 'app_id', op: 'eq', val: 'unit-monitoring' }]);
    return [{ sheet_api: '', sheet_url: (r && r.data && r.data.sheetUrl) || '' }];
  },
  apd_read() {
    const s = this._get('apd_state', [{ col: 'id', op: 'eq', val: 'main' }]);
    return s ? [{ data: s.data, revision: s.revision, updated_at: s.updated_at, updated_by: s.updated_by || null }] : [];
  },
  monitoring_guest_apd_read() { return RPC.apd_read.call(this); },
  apd_people() {
    const out = [];
    for (const w of this.table('kta_web_state')) {
      if (!String(w.id).startsWith('kmb-')) continue;
      for (const [st, key] of [['AKTIF', 'aktif'], ['OUT', 'keluar']]) {
        for (const x of (w.data && Array.isArray(w.data[key]) ? w.data[key] : [])) {
          if (!x || !x.nama) continue;
          out.push({ site_id: w.id, site: SITE_LABEL[w.id] || w.id, nama: x.nama, jabatan: x.jabatan || '', status: st, masuk: x.masuk == null ? null : String(x.masuk), keluar: x.keluar == null ? null : String(x.keluar) });
        }
      }
    }
    return out;
  },
  monitoring_guest_apd_people() { return RPC.apd_people.call(this); },
  monitoring_guest_apd_save({ p_data, p_revision }) {
    const s = this._get('apd_state', [{ col: 'id', op: 'eq', val: 'main' }]);
    if (!s || Number(s.revision) !== Number(p_revision)) throw new PgError('Data sudah berubah, muat ulang');
    s.data = p_data; s.revision = Number(s.revision) + 1; s.updated_at = now(); s.updated_by = LOCAL_EMAIL;
    this._dirty('apd_state');
    return [{ revision: s.revision, updated_at: s.updated_at }];
  },
  kta_members({ p_app }) {
    const rows = this.table('app_access_roles').filter((a) => a.app_id === p_app && a.role !== 'owner' && String(a.email).toLowerCase() !== LOCAL_EMAIL);
    return [{ email: LOCAL_EMAIL, role: 'owner', since: null }, ...rows.map((a) => ({ email: a.email, role: a.role, since: a.created_at || null }))];
  },
  kta_member_set({ p_app, p_email, p_role }) {
    for (const a of this.table('app_access_roles')) if (a.app_id === p_app && String(a.email).toLowerCase() === String(p_email).toLowerCase() && a.role !== 'owner') { a.role = p_role; a.updated_at = now(); }
    this._dirty('app_access_roles');
    return null;
  },
  kta_member_revoke_invites() { return null; },
  kta_share_rotate({ p_app }) {
    const key = hex(12);
    this._query({ table: 'kta_share_links', action: 'upsert', values: { app_id: p_app, key, updated_at: now() } });
    return key;
  },
  kta_access_ask() { return 'member'; },
  kta_access_decide() { return null; },
  kta_mail_key_status() { return { set: false }; },
  kta_set_mail_key: offline,
  kta_invite_create: offline,
  kta_invite_peek() { return []; },
  kta_invite_redeem() { return [{ app_id: null, role: null, status: 'invalid' }]; },
  kta_invite_revoke: offline,
  monitoring_guest_manage: offline,
  monitoring_guest_revoke: offline,
  kta_log_activity({ p_app, p_site, p_action, p_detail, p_page }) {
    if (!p_app || !p_action || !String(p_action).trim()) return null;
    this._query({ table: 'kta_activity_log', action: 'insert', values: { app: String(p_app).slice(0, 40), site: p_site == null ? null : String(p_site).slice(0, 80), page: p_page == null ? null : String(p_page).slice(0, 60), actor: LOCAL_EMAIL, role: 'owner', action: String(p_action).slice(0, 300), detail: p_detail == null ? null : String(p_detail).slice(0, 4000) } });
    return null;
  },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xls': 'application/vnd.ms-excel', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.doc': 'application/msword', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json' };
function mimeOf(file) { return MIME[path.extname(String(file)).toLowerCase()] || 'application/octet-stream'; }

module.exports = { Store, LOCAL_EMAIL, LOCAL_UID, OFFLINE_MSG, mimeOf, colVal };
