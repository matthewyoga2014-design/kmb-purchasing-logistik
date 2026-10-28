'use strict';
// Server uji: menjalankan web Monitoring offline di browser biasa (tanpa Electron)
// dengan penyimpanan lokal yang sama. Dipakai untuk pengujian otomatis.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Store, LOCAL_EMAIL, LOCAL_UID } = require('../core/store');
const { serve } = require('../core/serve');

function start({ port = 0, dataDir, webRoot }) {
  const store = new Store({ dataDir: path.join(dataDir, 'data'), filesDir: path.join(dataDir, 'Berkas') });
  const offlineDir = path.join(__dirname, '..', 'offline');
  const bridge = `window.MonitoringDesktop={info:${JSON.stringify({ email: LOCAL_EMAIL, uid: LOCAL_UID })},
call:function(ch,a){return fetch('/__bridge/'+ch,{method:'POST',body:JSON.stringify(a)}).then(function(r){return r.json()})},
query:function(q){return this.call('query',q)},rpc:function(n,a){return this.call('rpc',{name:n,args:a})},
storage:function(op,a){return this.call('storage',{op:op,args:a})},gas:function(k,b){return this.call('gas',{kind:k,body:b})}};\n`;
  const srv = http.createServer((req, res) => {
    const origin = 'http://' + req.headers.host;
    if (req.url.startsWith('/__bridge/')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const a = JSON.parse(body || '{}');
        const ch = req.url.slice(10);
        let out;
        if (ch === 'query') out = store.query(a);
        else if (ch === 'rpc') out = store.rpc(a.name, a.args);
        else if (ch === 'storage') out = store.storage(a.op, a.args);
        else if (ch === 'gas') out = store.gas(a.kind, a.body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
      return;
    }
    const r = serve({ webRoot, offlineDir, store, origin }, req.url);
    let body = r.body;
    if (req.url.startsWith('/__offline/supabase-shim.js')) body = bridge + body.toString();
    res.writeHead(r.status, { 'Content-Type': r.mime });
    res.end(body);
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ srv, store, port: srv.address().port })));
}
module.exports = { start };

if (require.main === module) {
  start({ port: Number(process.env.PORT || 8765), dataDir: process.argv[2] || '/tmp/monitoring-test', webRoot: process.argv[3] || path.join(__dirname, '..', '..') })
    .then(({ port }) => console.log('http://127.0.0.1:' + port));
}
