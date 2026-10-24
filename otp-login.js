/* Masuk dengan kode 6 angka dari email (OTP).
 * Dipakai semua web Monitoring: setelah halaman mengirim email masuk (signInWithOtp),
 * panggil KMBOtp.prompt(supabaseClient, email, optionsYangSama).
 * Link di email tetap bisa diklik seperti dulu; kode hanya cara tambahan yang lebih andal. */
(function () {
  'use strict';
  if (window.KMBOtp) return;

  const CSS = `
.kotp-bg{border:0;padding:0;background:transparent;max-width:calc(100vw - 32px);width:380px;font-family:inherit;color:inherit}
.kotp-bg::backdrop{background:rgba(15,10,30,.55)}
.kotp{background:#fff;color:#1f1633;border-radius:16px;width:100%;box-sizing:border-box;padding:24px 22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.kotp h3{margin:0 0 6px;font-size:20px}
.kotp p{margin:0 0 14px;font-size:14px;line-height:1.5;color:#5b5470}
.kotp p b{color:#1f1633;word-break:break-all}
.kotp input{width:100%;box-sizing:border-box;font:600 26px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.35em;text-align:center;padding:12px 8px;border:2px solid #d9d3ea;border-radius:12px;outline:none;color:#1f1633;background:#fff}
.kotp input:focus{border-color:#6D28D9}
.kotp .kotp-msg{min-height:20px;margin:8px 0 4px;font-size:13px;color:#5b5470}
.kotp .kotp-msg.err{color:#c0262d}
.kotp .kotp-msg.ok{color:#15803d}
.kotp .kotp-row{display:flex;gap:8px;margin-top:8px}
.kotp button{font:inherit;font-size:15px;border-radius:10px;padding:11px 14px;cursor:pointer;border:1px solid #d9d3ea;background:#fff;color:#1f1633}
.kotp button.kotp-p{flex:1;background:#6D28D9;border-color:#6D28D9;color:#fff;font-weight:600}
.kotp button:disabled{opacity:.55;cursor:default}
.kotp .kotp-links{display:flex;justify-content:space-between;margin-top:12px;font-size:13px}
.kotp .kotp-links button{border:0;padding:4px 0;background:none;color:#6D28D9;font-size:13px}
@media (prefers-color-scheme:dark){.kotp{background:#1d1830;color:#f1edfa}.kotp p{color:#b8b0cc}.kotp p b{color:#f1edfa}.kotp input{background:#130f22;color:#f1edfa;border-color:#3a3352}.kotp button{background:#1d1830;color:#f1edfa;border-color:#3a3352}.kotp button.kotp-p{background:#7c3aed;border-color:#7c3aed}.kotp .kotp-links button{color:#c4b5fd}.kotp .kotp-msg{color:#b8b0cc}}`;

  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function prompt(client, email, otpOptions) {
    if (!client || !client.auth || !email) return;
    if (!document.getElementById('kotp-css')) { const s = document.createElement('style'); s.id = 'kotp-css'; s.textContent = CSS; document.head.appendChild(s); }
    const old = document.querySelector('.kotp-bg'); if (old) old.remove();

    const box = el(`<dialog class="kotp-bg" aria-labelledby="kotp-t"><form class="kotp" novalidate>
      <h3 id="kotp-t">Masukkan kode masuk</h3>
      <p>Kode dikirim ke <b>${esc(email)}</b>. Cek kotak masuk (atau folder Spam), lalu ketik kodenya di sini.</p>
      <input id="kotp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••" aria-label="Kode masuk">
      <div class="kotp-msg" aria-live="polite"></div>
      <div class="kotp-row"><button type="submit" class="kotp-p">Masuk</button></div>
      <div class="kotp-links"><button type="button" data-k="resend">Kirim ulang kode</button><button type="button" data-k="close">Batal</button></div>
    </form></dialog>`);
    document.body.appendChild(box);
    if (box.showModal) box.showModal(); else box.setAttribute('open', '');
    const form = box.querySelector('form'), input = box.querySelector('input'), msg = box.querySelector('.kotp-msg');
    const submit = box.querySelector('.kotp-p'), resend = box.querySelector('[data-k="resend"]');
    const say = (t, cls) => { msg.textContent = t || ''; msg.className = 'kotp-msg' + (cls ? ' ' + cls : ''); };
    const close = () => { clearInterval(timer); if (box.open && box.close) box.close(); box.remove(); };
    box.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    setTimeout(() => input.focus(), 30);

    let wait = 0, timer = null;
    function cooldown(sec) {
      wait = sec; resend.disabled = true;
      const tick = () => { if (wait <= 0) { resend.disabled = false; resend.textContent = 'Kirim ulang kode'; clearInterval(timer); return; } resend.textContent = `Kirim ulang (${wait}s)`; wait--; };
      clearInterval(timer); tick(); timer = setInterval(tick, 1000);
    }
    cooldown(60);

    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
      if (input.value.length === 6) form.requestSubmit ? form.requestSubmit() : submit.click();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = input.value.replace(/\D/g, '');
      if (code.length < 6) { say('Kode terdiri dari 6 angka.', 'err'); input.focus(); return; }
      submit.disabled = true; say('Memeriksa kode…');
      const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        submit.disabled = false; input.select();
        say(/expired|invalid/i.test(error.message) ? 'Kode salah atau sudah kedaluwarsa. Coba lagi atau kirim ulang.' : 'Gagal: ' + error.message, 'err');
        return;
      }
      say('Berhasil masuk. Memuat ulang…', 'ok');
      setTimeout(() => location.reload(), 500);
    });

    box.addEventListener('click', async (e) => {
      const k = e.target.dataset && e.target.dataset.k;
      if (e.target === box || k === 'close') { close(); return; }
      if (k === 'resend' && !resend.disabled) {
        resend.disabled = true; say('Mengirim ulang…');
        const { error } = await client.auth.signInWithOtp({ email, options: otpOptions || {} });
        if (error) { resend.disabled = false; say(/rate|seconds/i.test(error.message) ? 'Terlalu sering. Tunggu sebentar lalu coba lagi.' : 'Gagal mengirim: ' + error.message, 'err'); return; }
        say('Kode baru sudah dikirim.', 'ok'); cooldown(60);
      }
    });
  }

  window.KMBOtp = { prompt };
})();
