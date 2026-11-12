const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vedaAgent", {
  pair: (credentials) => ipcRenderer.invoke("pair-desktop-agent", credentials),
  getStatus: () => ipcRenderer.invoke("get-desktop-agent-status"),
  trigger: () => ipcRenderer.invoke("trigger-desktop-agent")
});
