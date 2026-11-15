// kta-print: emails the Pemilik when a Pelihat asks for print permission, and applies the
// Setujui / Tolak decision from the signed link in that email (no login needed on the phone).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// email Pemilik: dari secret OWNER_EMAIL, atau dibaca dari tabel akses (peran owner) saat pertama dipakai
let OWNER = (Deno.env.get("OWNER_EMAIL") || "").toLowerCase();
async function loadOwner() {
  if (OWNER) return OWNER;
  const { data } = await admin.from("app_access_roles").select("email").eq("app_id", "kta-tra").eq("role", "owner").limit(1).maybeSingle();
  OWNER = String(data?.email || "").toLowerCase();
  return OWNER;
}
const APPS: Record<string, { name: string; web: string }> = {
  "kta-tra": { name: "KTA-TRA", web: "manpower-kta-tra/" },
  "bupr-ampah": { name: "BUPR Ampah", web: "manpower-bupr/" },
  "mbj": { name: "MBJ", web: "manpower-mbj/" },
  "kmb": { name: "KMB", web: "manpower-kmb/" },
  "apd": { name: "APD KMB", web: "monitoring-apd-kmb/" },
};
const KARYAWAN = "Berkas Karyawan";
const appOf = (a: unknown) => (typeof a === "string" && APPS[a] ? a : "kta-tra");
const BASE = "https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/";
const PAGE = BASE + "manpower-kta-tra/izin.html";
const WEB = BASE + "manpower-kta-tra/";
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SRK, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
let KEY: CryptoKey | null = null;
async function key() {
  if (!KEY) {
    const raw = await crypto.subtle.digest("SHA-256", enc.encode("kta-print-link:" + SRK));
    KEY = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  }
  return KEY;
}
async function sign(p: { e: string; r: number; x: number; a?: string }) {
  const body = b64u(enc.encode(JSON.stringify(p)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return body + "." + b64u(sig);
}
async function verify(t: string) {
  const [body, sig] = String(t || "").split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await key(), unb64u(sig), enc.encode(body));
  if (!ok) return null;
  const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
  return p.x > Date.now() ? p as { e: string; r: number; x: number; a?: string } : null;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function resendKey() {
  const env = Deno.env.get("RESEND_API_KEY");
  if (env) return env;
  const { data } = await admin.from("kta_private_settings").select("value").eq("name", "resend_api_key").maybeSingle();
  return (data && data.value) || "";
}
// Fallback without any API key: FormSubmit relays a form post to the owner's inbox
// (one-time "Activate Form" click in the first email it sends).
async function formSubmit(fields: Record<string, string>) {
  const r = await fetch(`https://formsubmit.co/ajax/${OWNER}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Referer: WEB, Origin: "https://matthewyoga2014-design.github.io", "User-Agent": "Mozilla/5.0 (Monitoring Manpower)" },
    body: JSON.stringify({ _template: "box", _captcha: "false", ...fields }),
  });
  const txt = await r.text();
  let j: any = null; try { j = JSON.parse(txt); } catch (_) { /* not json */ }
  return { ok: r.ok && (!j || String(j.success) !== "false"), status: r.status, detail: txt.slice(0, 300) };
}
async function sendMail(subject: string, html: string, fields?: Record<string, string>) {
  const k = await resendKey();
  if (!k) return fields ? await formSubmit({ _subject: subject, ...fields }) : { ok: false, error: "email_not_configured" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Monitoring Manpower <onboarding@resend.dev>", to: [OWNER], subject, html }),
  });
  return r.ok ? { ok: true } : { ok: false, error: "email_failed", detail: (await r.text()).slice(0, 300) };
}
async function caller(req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  return (u?.user?.email || "").toLowerCase();
}

async function row(email: string, APP: string) {
  const { data } = await admin.from("kta_print_grants").select("email,status,requested_at,decided_at,notified_at").eq("app_id", APP).eq("email", email).maybeSingle();
  return data;
}

async function notify(req: Request, APP: string) {
  const email = await caller(req);
  if (!email) return json({ ok: false, error: "login" }, 401);
  const g = await row(email, APP);
  if (!g || g.status !== "pending") return json({ ok: false, error: "no_request" }, 400);
  if (g.notified_at && Date.now() - Date.parse(g.notified_at) < 10 * 60 * 1000) return json({ ok: true, skipped: "recent" });
  const t = await sign({ e: email, r: Date.parse(g.requested_at), x: Date.now() + 7 * 864e5, a: APP });
  const PN = APPS[APP].name, PW = BASE + APPS[APP].web;
  const when = new Date(g.requested_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
  const btn = (a: string, label: string, bg: string) => `<a href="${PAGE}?a=${a}&t=${t}" style="display:inline-block;padding:13px 26px;border-radius:10px;background:${bg};color:#fff;font-weight:700;text-decoration:none;font-size:15px;margin:4px 6px">${label}</a>`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1E1B3A">
    <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#6D28D9">MONITORING MANPOWER ${PN.toUpperCase()}</div>
    <h2 style="margin:6px 0 10px">Permintaan izin cetak</h2>
    <p style="font-size:15px;line-height:1.5"><b>${esc(email)}</b> meminta izin untuk print, simpan PDF/PNG, dan mengunduh data.<br><span style="color:#8A87A6;font-size:13px">Diminta ${when} WIB</span></p>
    <div style="text-align:center;margin:22px 0">${btn("approved", "✓ Setujui", "#15803D")}${btn("denied", "✕ Tolak", "#DC2626")}</div>
    <p style="font-size:12px;color:#8A87A6">Link berlaku 7 hari. Izin bisa dicabut kapan saja di <a href="${PW}" style="color:#6D28D9">web</a> → Pengaturan → Izin Cetak Pelihat.</p></div>`;
  const m = await sendMail(`Izin cetak ${PN}: ${email}`, html, {
    "Proyek": `Monitoring Manpower ${PN}`,
    "Permintaan": `${email} minta izin print / simpan PDF-PNG / unduh data`,
    "Waktu": `${when} WIB`,
    "SETUJUI (klik link)": `${PAGE}?a=approved&t=${t}`,
    "TOLAK (klik link)": `${PAGE}?a=denied&t=${t}`,
    "Catatan": "Link berlaku 7 hari. Izin bisa dicabut di web > Pengaturan > Izin Cetak Pelihat.",
  });
  if (!m.ok) return json(m, 502);
  await admin.from("kta_print_grants").update({ notified_at: new Date().toISOString() }).eq("app_id", APP).eq("email", email);
  return json({ ok: true });
}

async function decide(body: { t: string; a?: string; peek?: boolean }) {
  const p = await verify(body.t);
  if (!p) return json({ ok: false, error: "invalid" }, 400);
  const APP = appOf(p.a);
  const g = await row(p.e, APP);
  if (!g) return json({ ok: false, error: "gone", email: p.e }, 404);
  if (Date.parse(g.requested_at) !== p.r) return json({ ok: false, error: "stale", email: p.e, status: g.status }, 409);
  if (body.peek) return json({ ok: true, email: p.e, status: g.status, requested_at: g.requested_at, project: APPS[APP].name, web: BASE + APPS[APP].web });
  if (body.a !== "approved" && body.a !== "denied") return json({ ok: false, error: "action" }, 400);
  const { error } = await admin.from("kta_print_grants").update({ status: body.a, decided_at: new Date().toISOString(), decided_by: OWNER + " (email)" }).eq("app_id", APP).eq("email", p.e);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, email: p.e, status: body.a, project: APPS[APP].name, web: BASE + APPS[APP].web });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    await loadOwner();
    const body = await req.json().catch(() => ({}));
    if (body.op === "notify") return await notify(req, appOf(body.app));
    if (body.op === "decide") return await decide(body);
    if (body.op === "drivestate") {
      // data semua proyek untuk Google Apps Script milik Pemilik (pengganti baca tabel langsung)
      const { data: tk } = await admin.from("kta_private_settings").select("value").eq("name", "drive_sync_token").maybeSingle();
      if (!tk || !body.token || body.token !== tk.value) return json({ ok: false, error: "token" }, 403);
      const { data: rows, error } = await admin.from("kta_web_state").select("id,data,updated_at");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, rows });
    }
    if (body.op === "drivefiles") {
      // dipakai Google Apps Script milik Pemilik untuk menyalin berkas pelamar ke Google Drive
      const { data: tk } = await admin.from("kta_private_settings").select("value").eq("name", "drive_sync_token").maybeSingle();
      if (!tk || !body.token || body.token !== tk.value) return json({ ok: false, error: "token" }, 403);
      // 1) catat semua berkas yang sekarang ada di web ke arsip (kta_drive_files)
      const { data: rows } = await admin.from("kta_web_state").select("id,data");
      const now = new Date().toISOString();
      const seen: Record<string, unknown>[] = [];
      for (const r of rows || []) {
        for (const p of (r.data?.positions || [])) for (const c of (p.cands || [])) for (const f of Object.values(c.files || {}) as any[]) {
          if (!f || !f.id) continue;
          seen.push({ storage_id: f.id, state: r.id, cand: c.name || "", jabatan: p.jabatan || "", name: f.name || String(f.id).split("/").pop(), last_seen: now });
        }
      }
      // berkas karyawan (MP Aktif / MP Out) dari data pribadi -> folder "Berkas Karyawan/<Nama>"
      const { data: prv } = await admin.from("kta_mp_private").select("site_id,pkey,data");
      for (const r of prv || []) {
        const fs = Array.isArray(r.data?.files) ? r.data.files : [];
        for (const f of fs as any[]) {
          if (!f || !f.id) continue;
          seen.push({ storage_id: f.id, state: r.site_id, cand: r.data?._nama || r.pkey, jabatan: KARYAWAN, name: f.name || String(f.id).split("/").pop(), last_seen: now });
        }
      }
      if (seen.length) await admin.from("kta_drive_files").upsert(seen, { onConflict: "storage_id" });
      // 2) Drive menyimpan semua berkas di arsip.
      //    Editor menghapus pelamar di web -> berkas tetap di Drive.
      //    Pemilik klik "Hapus berkas tidak aktif" -> purge_at diisi (atau objek storage dihapus sebelum pindah ke Drive)
      //    -> baris arsip dihapus -> ikut hilang dari Drive.
      //    Berkas yang sudah aman di Drive (drive_id terkonfirmasi > 1 hari) dihapus dari Supabase Storage (offloaded_at),
      //    lalu dibuka langsung dari Google Drive. Baris arsipnya TIDAK dihapus.
      const { data: reg, error: re } = await admin.from("kta_drive_files").select("storage_id,state,cand,jabatan,name,drive_id,drive_at,drive_seen_at,shared_to,offloaded_at,purge_at");
      if (re || !Array.isArray(reg)) return json({ ok: false, error: "registry" }, 500);
      const { data: objs, error: oe } = await admin.rpc("kta_storage_names");
      if (oe || !Array.isArray(objs)) return json({ ok: false, error: "storage_list" }, 500);
      const live = new Set((objs as unknown[]).map((o) => (typeof o === "string" ? o : (o as Record<string, string>).kta_storage_names)));
      const goneRows = reg.filter((x) => x.purge_at || (!live.has(x.storage_id) && !x.offloaded_at));
      const gone = goneRows.map((x) => x.storage_id);
      const purgeLive = goneRows.filter((x) => live.has(x.storage_id)).map((x) => x.storage_id);
      if (purgeLive.length) await admin.storage.from("kta-web-docs").remove(purgeLive);
      if (gone.length) await admin.from("kta_drive_files").delete().in("storage_id", gone);
      const keep = reg.filter((x) => !gone.includes(x.storage_id));
      // 3) pindahkan berkas yang sudah aman di Drive keluar dari Supabase Storage (maks 100 per putaran)
      const { data: ofs } = await admin.from("kta_private_settings").select("value").eq("name", "drive_offload").maybeSingle();
      const tnow = Date.now();
      if (ofs && ofs.value === "on") {
        const ready = keep.filter((x) => live.has(x.storage_id) && !x.offloaded_at && x.drive_id && x.drive_at && x.drive_seen_at &&
          tnow - Date.parse(x.drive_at) > 864e5 && tnow - Date.parse(x.drive_seen_at) < 2 * 3600e3).slice(0, 100);
        if (ready.length) {
          const ids = ready.map((x) => x.storage_id);
          const { error: rmErr } = await admin.storage.from("kta-web-docs").remove(ids);
          if (!rmErr) {
            const at = new Date().toISOString();
            await admin.from("kta_drive_files").update({ offloaded_at: at }).in("storage_id", ids);
            for (const x of ready) { x.offloaded_at = at; live.delete(x.storage_id); }
          }
        }
      }
      // 4) siapa yang boleh melihat tiap berkas di Drive (Editor portal itu; per berkas, bukan per folder)
      const { data: vw } = await admin.rpc("kta_drive_viewers");
      const viewers: Record<string, string[]> = {};
      for (const v of (vw || []) as { state: string; emails: string[] }[]) viewers[v.state] = (v.emails || []).map((e) => String(e).toLowerCase());
      const out: unknown[] = [];
      for (const x of keep) {
        let url: string | null = null;
        if (live.has(x.storage_id) && !x.offloaded_at) {
          const { data: su } = await admin.storage.from("kta-web-docs").createSignedUrl(x.storage_id, 900);
          if (!su?.signedUrl) return json({ ok: false, error: "sign" }, 500); // jangan kirim daftar tidak lengkap
          url = su.signedUrl;
        }
        const want = viewers[x.state] || [];
        const have = (x.shared_to || []).map((e: string) => String(e).toLowerCase());
        out.push({ state: x.state, cand: x.cand, jabatan: x.jabatan, name: x.name, id: x.storage_id, url, group: x.jabatan === KARYAWAN ? KARYAWAN : "Berkas Pelamar",
          drive_id: x.drive_id || null, viewers: want, add: want.filter((e) => !have.includes(e)), remove: have.filter((e) => !want.includes(e)) });
      }
      return json({ ok: true, v: 2, files: out });
    }
    if (body.op === "drivedone") {
      // Apps Script melaporkan ID Google Drive tiap berkas + email yang sudah diberi akses Pelihat
      const { data: tk } = await admin.from("kta_private_settings").select("value").eq("name", "drive_sync_token").maybeSingle();
      if (!tk || !body.token || body.token !== tk.value) return json({ ok: false, error: "token" }, 403);
      const list = Array.isArray(body.files) ? body.files : [];
      const at = new Date().toISOString();
      const { data: cur } = await admin.from("kta_drive_files").select("storage_id,drive_id,drive_at");
      const byId: Record<string, { drive_id: string | null; drive_at: string | null }> = {};
      for (const c of cur || []) byId[c.storage_id] = c;
      let n = 0;
      for (let i = 0; i < list.length; i += 20) {
        await Promise.all(list.slice(i, i + 20).map(async (f: any) => {
          const c = byId[String(f?.id || "")];
          if (!c || !f.drive_id || !/^[A-Za-z0-9_-]{10,}$/.test(String(f.drive_id))) return;
          const patch: Record<string, unknown> = { drive_id: String(f.drive_id), drive_seen_at: at, shared_to: Array.isArray(f.shared_to) ? f.shared_to.map((e: string) => String(e).toLowerCase()) : [] };
          if (!c.drive_at || c.drive_id !== String(f.drive_id)) patch.drive_at = at; // berkas Drive baru -> tunggu 1 hari lagi sebelum dihapus dari Supabase
          const { error } = await admin.from("kta_drive_files").update(patch).eq("storage_id", String(f.id));
          if (!error) n++;
        }));
      }
      return json({ ok: true, updated: n });
    }
    if (body.op === "test") {
      const who = await caller(req);
      if (!OWNER || !who || who !== OWNER) return json({ ok: false, error: "owner_only" }, 403);
      const m = await sendMail("Tes notifikasi · Monitoring Manpower", `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1E1B3A"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#6D28D9">MONITORING MANPOWER KTA-TRA</div><h2 style="margin:6px 0 10px">Notifikasi email aktif ✓</h2><p style="font-size:15px">Permintaan izin cetak dari Pelihat akan masuk ke email ini, lengkap dengan tombol Setujui dan Tolak.</p></div>`);
      return json(m);
    }
    return json({ ok: false, error: "op" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
