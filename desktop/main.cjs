const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session } = require("electron");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");

let mainWindow;
let updatePromptOpen = false;
let agentProcess;
let agentBridgeToken;

function startAgentWidget() {
  if (!app.isPackaged || process.platform !== "win32") return;

  agentBridgeToken = randomBytes(32).toString("hex");
  const agentPath = path.join(process.resourcesPath, "agent", "VEDA-Agent.exe");
  agentProcess = spawn(agentPath, [], {
    env: {
      ...process.env,
      VEDA_AGENT_BRIDGE_TOKEN: agentBridgeToken
    },
    stdio: "ignore",
    windowsHide: false
  });
  agentProcess.on("error", (error) => {
    agentProcess = null;
    console.error("Could not start the VEDA desktop agent widget:", error);
  });
  agentProcess.on("exit", (code) => {
    agentProcess = null;
    if (code !== 0 && code !== null) {
      console.error(`VEDA desktop agent widget exited with code ${code}.`);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
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

function assertMainWindowSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      !event.senderFrame.url.startsWith("file:")) {
    throw new Error("Desktop agent controls are only available from the VEDA app.");
  }
}

async function requestAgent(path, method = "GET") {
  if (!agentProcess || !agentBridgeToken) {
    throw new Error("The local desktop agent is not running.");
  }

  const response = await fetch(`http://127.0.0.1:8765${path}`, {
    method,
    headers: { "X-VEDA-Agent-Token": agentBridgeToken },
    signal: AbortSignal.timeout(5000)
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Local desktop agent request failed (${response.status}).`);
  }
  return result;
}

function installDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      if (!mainWindow || sources.length === 0) {
        callback({});
        return;
      }

      const cancelId = sources.length;
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "Share your screen",
        message: "Choose a display to share with the paired phone.",
        buttons: [...sources.map((source) => source.name), "Cancel"],
        cancelId,
        defaultId: 0,
        noLink: true
      });
      callback(response === cancelId ? {} : { video: sources[response] });
    } catch (error) {
      console.error("Could not open the screen-sharing picker:", error);
      callback({});
    }
  });
}

ipcMain.handle("pair-desktop-agent", async (event, credentials) => {
  assertMainWindowSender(event);
  if (!agentProcess || !agentBridgeToken || !credentials ||
      typeof credentials.accessToken !== "string" ||
      typeof credentials.refreshToken !== "string" ||
      typeof credentials.serverUrl !== "string") {
    throw new Error("The local VEDA agent is not ready to pair.");
  }

  const response = await fetch("http://127.0.0.1:8765/pair", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VEDA-Agent-Token": agentBridgeToken
    },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new Error(`Local desktop agent pairing failed (${response.status}).`);
  }
  return response.json();
});

ipcMain.handle("get-desktop-agent-status", async (event) => {
  assertMainWindowSender(event);
  return requestAgent("/status");
});

ipcMain.handle("trigger-desktop-agent", async (event) => {
  assertMainWindowSender(event);
  return requestAgent("/trigger", "POST");
});

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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    installDisplayMediaHandler();
    startAgentWidget();
    createWindow();
    startUpdateChecks();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    if (agentProcess && !agentProcess.killed) agentProcess.kill();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
