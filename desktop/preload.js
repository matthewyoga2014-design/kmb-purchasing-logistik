'use strict';
// Jembatan aman antara halaman web Monitoring dan penyimpanan lokal di laptop.
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'app:') {
  const info = ipcRenderer.sendSync('mon:info');
  contextBridge.exposeInMainWorld('MonitoringDesktop', {
    info,
    query: (q) => ipcRenderer.invoke('mon:query', q),
    rpc: (name, args) => ipcRenderer.invoke('mon:rpc', name, args),
    storage: (op, args) => ipcRenderer.invoke('mon:storage', op, args),
    gas: (kind, body) => ipcRenderer.invoke('mon:gas', kind, body),
    openFolder: (which) => ipcRenderer.invoke('mon:open-folder', which),
  });
}
