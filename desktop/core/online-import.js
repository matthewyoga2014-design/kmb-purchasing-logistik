'use strict';
// Skrip yang dijalankan di jendela Monitoring online (setelah pengguna masuk)
// untuk membaca data yang boleh ia lihat, lalu disalin ke aplikasi offline.

const ONLINE_HOME = 'https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/?beranda';
const SUPA = { url: 'https://yoviojbfyvgpllxisjvy.supabase.co', key: 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9' };
const NOTU_GAS = 'https://script.google.com/macros/s/AKfycbxEVSGJYpi-q9BiO8iiRSirX9OuVnvP0rVNUYQR4SlcSgkvkfAsYsw8vc1iIzXKFR4X/exec';

function fetchOnlineScript() {
  return `(async () => {
  const SUPA = ${JSON.stringify(SUPA)};
  const NOTU_GAS = ${JSON.stringify(NOTU_GAS)};
  if (!window.supabase || !window.supabase.createClient) return { error: 'Halaman Monitoring online belum selesai dimuat. Tunggu sebentar lalu coba lagi.' };
  const sb = window.supabase.createClient(SUPA.url, SUPA.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'kta-web-auth' } });
  const { data: sd } = await sb.auth.getSession();
  const session = sd && sd.session;
  if (!session) return { error: 'Belum masuk. Silakan masuk dengan email dulu.' };
  const out = { email: session.user.email, tables: {}, notes: [] };
  const ids = ['main', 'kmb-c4', 'kmb-workshop', 'kmb-slr-rekondisi', 'kmb-slr-maintenance', 'bupr', 'mbj'];
  let r = await sb.rpc('kta_web_read', { p_ids: ids, p_key: null });
  if (r.error) out.notes.push('Manpower: ' + r.error.message);
  else if (r.data && r.data.length) out.tables.kta_web_state = r.data.map((x) => ({ id: x.id, data: x.data, updated_at: x.updated_at, updated_by: 'salin dari online' }));
  r = await sb.rpc('apd_read', { p_key: null });
  if (r.error) out.notes.push('APD: ' + r.error.message);
  else if (r.data && r.data[0]) out.tables.apd_state = [{ id: 'main', data: r.data[0].data, revision: r.data[0].revision, updated_at: r.data[0].updated_at, updated_by: r.data[0].updated_by }];
  const tables = ['app_state_public', 'app_state_private', 'portal_display_settings', 'mpp_portal_projects', 'organizational_charts', 'kta_app_perms', 'candidate_attachments', 'kta_mp_private'];
  for (const t of tables) {
    const all = [];
    for (let from = 0; from < 50000; from += 1000) {
      const q = await sb.from(t).select('*').range(from, from + 999);
      if (q.error) { if (!/permission|not exist|schema cache/i.test(q.error.message)) out.notes.push(t + ': ' + q.error.message); break; }
      all.push(...(q.data || []));
      if (!q.data || q.data.length < 1000) break;
    }
    if (all.length) out.tables[t] = all;
  }
  const lg = await sb.from('kta_activity_log').select('*').order('at', { ascending: false }).limit(5000);
  if (!lg.error && lg.data && lg.data.length) out.tables.kta_activity_log = lg.data;
  // Notulensi (Google Drive lewat Apps Script)
  try {
    const res = await fetch(NOTU_GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ op: 'state', token: session.access_token, share: '', rev: 0 }), redirect: 'follow' });
    const j = await res.json();
    if (j && j.ok && j.data) out.notulensi = j.data;
    else out.notes.push('Notulensi: ' + ((j && j.error) || 'tidak terbaca'));
  } catch (e) { out.notes.push('Notulensi: ' + e.message); }
  // Monitoring Unit (bila datanya di Google Sheet)
  const unit = (out.tables.app_state_public || []).find((x) => x.app_id === 'unit-monitoring');
  if (unit && unit.data && unit.data.sheetApi) {
    try {
      const api = unit.data.sheetApi;
      const res = await fetch(api + (api.includes('?') ? '&' : '?') + 't=' + Date.now() + '&token=' + encodeURIComponent(session.access_token), { cache: 'no-store' });
      const j = await res.json();
      if (j && j.ok && j.state) unit.data = Object.assign({}, unit.data, j.state);
      else out.notes.push('Monitoring Unit (Google Sheet): ' + ((j && j.error) || 'tidak terbaca'));
    } catch (e) { out.notes.push('Monitoring Unit (Google Sheet): ' + e.message); }
  }
  if (unit && unit.data) unit.data.sheetApi = '';
  return out;
})()`;
}

module.exports = { ONLINE_HOME, fetchOnlineScript };
