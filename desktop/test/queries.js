'use strict';
// Uji semantik query: dijalankan di dalam halaman memakai window.supabase (pengganti offline).
const path = require('path');
const { chromium } = require('playwright');
const { start } = require('./server');

(async () => {
  const dataDir = process.argv[2];
  const { srv, store, port } = await start({ dataDir, webRoot: path.join(__dirname, '..', '..') });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
  await page.goto(`http://127.0.0.1:${port}/kantor-ai/`);
  const out = await page.evaluate(async () => {
    const sb = window.supabase.createClient('x', 'y');
    const R = {};
    const ok = (k, v) => { R[k] = v; };
    // manpower
    let r = await sb.from('kta_web_state').upsert({ id: 'mbj', data: { positions: [{ a: 1 }], aktif: [{ nama: 'A' }] }, updated_at: '2026-10-28T01:00:00.000Z', updated_by: 'x' }).select('updated_at').single();
    ok('upsert_single', r);
    r = await sb.from('kta_web_state').select('updated_at').eq('id', 'mbj').maybeSingle();
    ok('maybeSingle', r);
    r = await sb.rpc('kta_web_read', { p_ids: ['mbj', 'zzz'], p_key: null });
    ok('kta_web_read', r.data.map((x) => x.id + ':' + x.data.positions.length));
    // apd revision check
    const a0 = (await sb.rpc('apd_read', { p_key: null })).data[0];
    r = await sb.from('apd_state').update({ data: { types: [1] }, revision: a0.revision + 1 }).eq('id', 'main').eq('revision', a0.revision).select('revision,updated_at');
    ok('apd_update', r.data);
    r = await sb.from('apd_state').update({ data: {}, revision: 99 }).eq('id', 'main').eq('revision', a0.revision).select('revision');
    ok('apd_stale', r.data);
    // unit json path filter
    r = await sb.from('app_state_public').select('data').eq('app_id', 'unit-monitoring').maybeSingle();
    const rev = Number(r.data.data.rev) || 0;
    r = await sb.from('app_state_public').update({ data: { ...r.data.data, rev: rev + 1, units: [{ x: 1 }] } }).eq('app_id', 'unit-monitoring').eq('data->>rev', String(rev)).select('app_id');
    ok('unit_update', r.data);
    // insert, duplicate, order, in, delete
    await sb.from('app_access_roles').insert({ app_id: 'apd', email: 'b@x.com', role: 'viewer' });
    r = await sb.from('app_access_roles').insert({ app_id: 'apd', email: 'B@x.com', role: 'viewer' });
    ok('dup_error', r.error && r.error.code);
    await sb.from('app_access_roles').upsert({ app_id: 'apd', email: 'a@x.com', role: 'editor' });
    r = await sb.from('app_access_roles').select('email,role').eq('app_id', 'apd').order('role').order('email');
    ok('order', r.data);
    r = await sb.from('app_access_roles').select('*', { count: 'exact', head: true }).in('app_id', ['apd']);
    ok('count', r.count);
    r = await sb.from('app_access_roles').delete().eq('app_id', 'apd').eq('email', 'b@x.com').neq('role', 'owner');
    ok('delete', r.error);
    r = await sb.from('kta_mp_private').upsert([{ site_id: 's', pkey: 'k1', data: { n: 1 } }, { site_id: 's', pkey: 'k1', data: { n: 2 } }], { onConflict: 'site_id,pkey' });
    r = await sb.from('kta_mp_private').select('site_id,pkey,data').in('site_id', ['s']).range(0, 999);
    ok('mp_private', r.data);
    r = await sb.from('kta_activity_log').select('*').order('at', { ascending: false }).limit(5);
    await sb.rpc('kta_log_activity', { p_app: 'apd', p_site: null, p_action: 'Tes', p_detail: 'x' });
    r = await sb.from('kta_activity_log').select('id,action,actor').or('action.eq.Tes,action.eq.zzz');
    ok('log', r.data);
    r = await sb.rpc('apd_people', { p_key: null });
    ok('apd_people', r.data.length);
    r = await sb.rpc('kta_invite_create', { p_app: 'apd', p_email: 'x@y.z', p_role: 'viewer' });
    ok('offline_rpc', r.error && r.error.message);
    // storage
    r = await sb.storage.from('kta-web-docs').upload('a/b.txt', new Blob(['halo']), { upsert: false });
    ok('upload', r);
    r = await sb.storage.from('kta-web-docs').upload('a/b.txt', new Blob(['halo']), { upsert: false });
    ok('upload_dup', r.error && r.error.statusCode);
    r = await sb.storage.from('kta-web-docs').createSignedUrl('a/b.txt', 60);
    const txt = await (await fetch(r.data.signedUrl)).text();
    ok('signed', txt);
    r = await sb.storage.from('kta-web-docs').download('a/b.txt');
    ok('download', await r.data.text());
    r = await sb.storage.from('kta-web-docs').list('a');
    ok('list', r.data.map((x) => x.name));
    // GAS notulensi
    const g = async (body) => (await fetch('https://script.google.com/macros/s/X/exec', { method: 'POST', body: JSON.stringify(body) })).json();
    history.replaceState(null, '', '/notulensi/');
    ok('whoami', await g({ op: 'whoami' }));
    ok('write', await g({ op: 'write', ops: [{ t: 'put', col: 'series', id: 's1', data: { title: 'Rapat' } }] }));
    const st = await g({ op: 'state', rev: 0 });
    ok('state', [st.rev, Object.keys(st.data.series)]);
    const up = await g({ op: 'upload', name: 'foto.jpg', mime: 'image/jpeg', b64: btoa('abc'), dirs: ['Unit A', 'Sec/B'] });
    const dl = await g({ op: 'download', id: up.id });
    ok('upload_download', [up.ok, atob(dl.b64)]);
    ok('trash', await g({ op: 'trash', id: up.id }));
    return R;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  store.flush();
  srv.close();
})();
