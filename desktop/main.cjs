const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");

let mainWindow;
let updatePromptOpen = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function promptToInstallUpdate() {
  if (updatePromptOpen) return;
  updatePromptOpen = true;

  try {
    const options = {
      type: "info",
      title: "VEDA Desktop update ready",
      message: "An update has been downloaded.",
      detail: "Restart VEDA Desktop now to install it.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  } catch (error) {
    console.error("Could not display the update installation prompt:", error);
  } finally {
    updatePromptOpen = false;
  }
}

function startUpdateChecks() {
  if (!app.isPackaged) return;

  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("update-downloaded", promptToInstallUpdate);
  autoUpdater.on("error", (error) => {
    console.error("VEDA Desktop update check failed:", error);
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error("VEDA Desktop could not check for updates:", error);
    });
  };

  setTimeout(checkForUpdates, 10_000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  createWindow();
  startUpdateChecks();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
