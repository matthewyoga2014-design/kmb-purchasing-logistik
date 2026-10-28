/*
 * Monitoring Offline — pengganti supabase-js di dalam aplikasi Windows.
 * Semua permintaan data diteruskan ke penyimpanan lokal lewat window.MonitoringDesktop
 * (disediakan preload Electron). Tidak ada data yang dikirim ke internet.
 */
(function () {
  'use strict';
  var B = window.MonitoringDesktop;
  if (!B) { console.error('[Monitoring offline] jembatan aplikasi tidak ditemukan'); return; }
  var INFO = B.info || {};
  var EMAIL = INFO.email || 'pemilik@monitoring.lokal';
  var USER = {
    id: INFO.uid || '00000000-0000-4000-8000-00000000000a', aud: 'authenticated', role: 'authenticated', email: EMAIL,
    email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { name: 'Pemilik' },
    created_at: '2026-01-01T00:00:00Z',
  };
  var SESSION = {
    access_token: 'monitoring-offline-local', refresh_token: 'monitoring-offline-local', token_type: 'bearer',
    expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, user: USER,
  };
  window.__MONITORING_OFFLINE__ = true;
  // Beranda offline selalu tampil (bukan dialihkan ke Kantor AI yang butuh internet).
  try { sessionStorage.setItem('kmb-beranda', '1'); } catch (e) {}

  function errObj(e) { return { message: (e && e.message) || String(e), code: (e && e.code) || 'OFFLINE', details: null, hint: null }; }
  function wrap(p) {
    return Promise.resolve(p).then(function (r) { return r; }, function (e) { return { data: null, error: errObj(e), count: null, status: 500 }; });
  }

  // ---------- query builder ala PostgREST ----------
  function Query(table) {
    this.q = { table: table, action: 'select', columns: '*', filters: [], order: [], limit: null, range: null, single: null, count: null, head: false, values: null, onConflict: null, ignoreDuplicates: false, returning: false };
    this._throw = false;
  }
  var QP = Query.prototype;
  QP.select = function (columns, opts) {
    if (this.q.action === 'select') {
      this.q.columns = columns || '*';
      if (opts && opts.count) this.q.count = opts.count;
      if (opts && opts.head) this.q.head = true;
    } else { this.q.returning = true; this.q.columns = columns || '*'; }
    return this;
  };
  QP.insert = function (values, opts) { this.q.action = 'insert'; this.q.values = values; if (opts && opts.count) this.q.count = opts.count; return this; };
  QP.upsert = function (values, opts) {
    this.q.action = 'upsert'; this.q.values = values;
    if (opts) { this.q.onConflict = opts.onConflict || null; this.q.ignoreDuplicates = !!opts.ignoreDuplicates; if (opts.count) this.q.count = opts.count; }
    return this;
  };
  QP.update = function (values, opts) { this.q.action = 'update'; this.q.values = values; if (opts && opts.count) this.q.count = opts.count; return this; };
  QP['delete'] = function (opts) { this.q.action = 'delete'; if (opts && opts.count) this.q.count = opts.count; return this; };
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains'].forEach(function (op) {
    QP[op] = function (col, val) { this.q.filters.push({ col: col, op: op, val: val }); return this; };
  });
  QP.likeAnyOf = function (col, pats) { return this.or(pats.map(function (p) { return col + '.like.' + p; }).join(',')); };
  QP.filter = function (col, op, val) {
    var neg = false; if (/^not\./.test(op)) { neg = true; op = op.slice(4); }
    this.q.filters.push({ col: col, op: op, val: val, not: neg }); return this;
  };
  QP.not = function (col, op, val) { this.q.filters.push({ col: col, op: op, val: val, not: true }); return this; };
  QP.or = function (expr) { this.q.filters.push({ col: '', op: 'or', val: expr }); return this; };
  QP.match = function (obj) { for (var k in obj) this.q.filters.push({ col: k, op: 'eq', val: obj[k] }); return this; };
  QP.textSearch = function () { return this; };
  QP.order = function (col, opts) {
    opts = opts || {};
    if (opts.foreignTable || opts.referencedTable) return this;
    this.q.order.push({ col: col, ascending: opts.ascending !== false, nullsFirst: opts.nullsFirst == null ? null : !!opts.nullsFirst });
    return this;
  };
  QP.limit = function (n) { this.q.limit = n; return this; };
  QP.range = function (a, b) { this.q.range = [a, b]; return this; };
  QP.single = function () { this.q.single = 'single'; return this; };
  QP.maybeSingle = function () { this.q.single = 'maybe'; return this; };
  QP.abortSignal = function () { return this; };
  QP.returns = function () { return this; };
  QP.csv = function () { return this; };
  QP.throwOnError = function () { this._throw = true; return this; };
  QP.then = function (res, rej) {
    var self = this;
    var p = wrap(B.query(JSON.parse(JSON.stringify(this.q)))).then(function (r) {
      if (self._throw && r.error) throw r.error;
      return r;
    });
    return p.then(res, rej);
  };
  QP['catch'] = function (rej) { return this.then(null, rej); };
  QP['finally'] = function (f) { return this.then(function (v) { f(); return v; }, function (e) { f(); throw e; }); };

  function Rpc(name, args) { this.name = name; this.args = args || {}; this.mode = null; this._throw = false; }
  Rpc.prototype.single = function () { this.mode = 'single'; return this; };
  Rpc.prototype.maybeSingle = function () { this.mode = 'maybe'; return this; };
  Rpc.prototype.select = function () { return this; };
  Rpc.prototype.abortSignal = function () { return this; };
  Rpc.prototype.throwOnError = function () { this._throw = true; return this; };
  ['eq', 'neq', 'in', 'order', 'limit'].forEach(function (m) { Rpc.prototype[m] = function () { return this; }; });
  Rpc.prototype.then = function (res, rej) {
    var self = this;
    return wrap(B.rpc(this.name, JSON.parse(JSON.stringify(this.args)))).then(function (r) {
      if (!r.error && self.mode && Array.isArray(r.data)) r.data = r.data[0] || null;
      if (self._throw && r.error) throw r.error;
      return r;
    }).then(res, rej);
  };
  Rpc.prototype['catch'] = function (rej) { return this.then(null, rej); };
  Rpc.prototype['finally'] = function (f) { return this.then(function (v) { f(); return v; }, function (e) { f(); throw e; }); };

  // ---------- auth ----------
  var listeners = [];
  var auth = {
    getSession: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
    getUser: function () { return Promise.resolve({ data: { user: USER }, error: null }); },
    refreshSession: function () { return Promise.resolve({ data: { session: SESSION, user: USER }, error: null }); },
    setSession: function () { return Promise.resolve({ data: { session: SESSION, user: USER }, error: null }); },
    exchangeCodeForSession: function () { return Promise.resolve({ data: { session: SESSION, user: USER }, error: null }); },
    onAuthStateChange: function (cb) {
      listeners.push(cb);
      setTimeout(function () { try { cb('INITIAL_SESSION', SESSION); } catch (e) { console.error(e); } }, 0);
      return { data: { subscription: { id: String(listeners.length), unsubscribe: function () { var i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
    },
    signInWithOtp: function () { return Promise.resolve({ data: { user: null, session: null }, error: null }); },
    signInWithPassword: function () { return Promise.resolve({ data: { user: USER, session: SESSION }, error: null }); },
    verifyOtp: function () { return Promise.resolve({ data: { user: USER, session: SESSION }, error: null }); },
    signUp: function () { return Promise.resolve({ data: { user: USER, session: SESSION }, error: null }); },
    signOut: function () {
      toast('Aplikasi offline tidak memakai login — Anda selalu masuk sebagai Pemilik di laptop ini.');
      return Promise.resolve({ error: null });
    },
    updateUser: function () { return Promise.resolve({ data: { user: USER }, error: null }); },
    resetPasswordForEmail: function () { return Promise.resolve({ data: {}, error: null }); },
    startAutoRefresh: function () { return Promise.resolve(); },
    stopAutoRefresh: function () { return Promise.resolve(); },
  };

  // ---------- storage ----------
  function toB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function fromB64(b64) {
    var bin = atob(b64 || ''), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesOf(body) {
    if (body == null) return Promise.resolve(new Uint8Array(0));
    if (typeof body === 'string') return Promise.resolve(new TextEncoder().encode(body));
    if (body instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(body));
    if (ArrayBuffer.isView(body)) return Promise.resolve(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    if (body.arrayBuffer) return body.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    if (typeof FormData !== 'undefined' && body instanceof FormData) { var f = body.get('file') || body.values().next().value; return bytesOf(f); }
    return Promise.resolve(new TextEncoder().encode(JSON.stringify(body)));
  }
  function fileUrl(bucket, p, download) {
    return location.origin + '/__files/' + encodeURIComponent(bucket) + '/' + String(p).split('/').map(encodeURIComponent).join('/') + (download ? '?download=' + encodeURIComponent(download === true ? '' : download) : '');
  }
  function bucketApi(bucket) {
    return {
      upload: function (p, body, opts) {
        opts = opts || {};
        return wrap(bytesOf(body).then(function (u8) {
          return B.storage('upload', { bucket: bucket, path: p, b64: toB64(u8), upsert: !!opts.upsert, contentType: opts.contentType || (body && body.type) || null });
        }));
      },
      update: function (p, body, opts) { return this.upload(p, body, Object.assign({}, opts || {}, { upsert: true })); },
      download: function (p) {
        return wrap(B.storage('download', { bucket: bucket, path: p }).then(function (r) {
          if (r.error) return r;
          return { data: new Blob([fromB64(r.data.b64)], { type: r.data.type || 'application/octet-stream' }), error: null };
        }));
      },
      remove: function (paths) { return wrap(B.storage('remove', { bucket: bucket, paths: paths || [] })); },
      list: function (prefix, options) { return wrap(B.storage('list', { bucket: bucket, path: prefix || '', options: options || {} })); },
      exists: function (p) { return wrap(B.storage('exists', { bucket: bucket, path: p })); },
      createSignedUrl: function (p, exp, opts) { return Promise.resolve({ data: { signedUrl: fileUrl(bucket, p, opts && opts.download) }, error: null }); },
      createSignedUrls: function (paths) { return Promise.resolve({ data: (paths || []).map(function (p) { return { path: p, signedUrl: fileUrl(bucket, p), error: null }; }), error: null }); },
      getPublicUrl: function (p) { return { data: { publicUrl: fileUrl(bucket, p) } }; },
      move: function () { return Promise.resolve({ data: null, error: errObj('Memindah berkas belum didukung offline') }); },
      copy: function () { return Promise.resolve({ data: null, error: errObj('Menyalin berkas belum didukung offline') }); },
    };
  }

  // ---------- realtime (tidak dipakai offline) ----------
  function channel(name) {
    var ch = {
      topic: name,
      on: function () { return ch; },
      subscribe: function (cb) { if (cb) setTimeout(function () { try { cb('SUBSCRIBED'); } catch (e) {} }, 0); return ch; },
      unsubscribe: function () { return Promise.resolve('ok'); },
      send: function () { return Promise.resolve('ok'); },
      track: function () { return Promise.resolve('ok'); },
      untrack: function () { return Promise.resolve('ok'); },
      presenceState: function () { return {}; },
    };
    return ch;
  }

  function createClient() {
    return {
      supabaseUrl: 'offline://monitoring',
      from: function (t) { return new Query(t); },
      rpc: function (n, a) { return new Rpc(n, a); },
      schema: function () { return this; },
      auth: auth,
      storage: { from: bucketApi, listBuckets: function () { return Promise.resolve({ data: [], error: null }); } },
      functions: { invoke: function (name) { return Promise.resolve({ data: null, error: errObj('Layanan "' + name + '" butuh internet dan tidak tersedia di aplikasi offline.') }); } },
      channel: channel,
      removeChannel: function () { return Promise.resolve('ok'); },
      removeAllChannels: function () { return Promise.resolve([]); },
      getChannels: function () { return []; },
    };
  }
  var api = { createClient: createClient, __offline: true };
  try {
    Object.defineProperty(window, 'supabase', { configurable: true, get: function () { return api; }, set: function () { /* abaikan supabase-js dari CDN */ } });
  } catch (e) { window.supabase = api; }

  // ---------- Google Apps Script -> penyimpanan lokal ----------
  var origFetch = window.fetch.bind(window);
  function gasKind() { return /\/notulensi\//.test(location.pathname) ? 'notulensi' : 'unit'; }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
      var body = {};
      try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
      if (!init || !init.method || String(init.method).toUpperCase() === 'GET') body = { op: body.op || 'ping' };
      return Promise.resolve(B.gas(gasKind(), body)).then(function (j) {
        return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
    }
    if (/^https?:\/\/[^/]*supabase\.co\//.test(url)) {
      return Promise.resolve(new Response(JSON.stringify({ message: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    }
    return origFetch(input, init);
  };

  // ---------- pesan kecil ----------
  function toast(msg) {
    try {
      var d = document.createElement('div');
      d.textContent = msg;
      d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#4c1d95;color:#fff;padding:10px 16px;border-radius:12px;font:14px system-ui,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw';
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 4200);
    } catch (e) {}
  }
  window.MonitoringOfflineToast = toast;
})();
