const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vedaAgent", {
  pair: (credentials) => ipcRenderer.invoke("pair-desktop-agent", credentials)
});
