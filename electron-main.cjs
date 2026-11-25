const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const dotenv = require("dotenv");

const APP_HOST = "127.0.0.1";
const APP_PORT = 3000;
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;
const DEV_URL = "http://127.0.0.1:5173";
const serviceProcesses = [];
let mainWindow;
let shuttingDown = false;
let quitAfterStoppingServices = false;
let appUrl;

app.setName("Singularity");

function logChildOutput(child, label) {
  child.stdout?.on("data", (chunk) => console.info(`[${label}] ${chunk.toString().trimEnd()}`));
  child.stderr?.on("data", (chunk) => console.error(`[${label}] ${chunk.toString().trimEnd()}`));
}

function openExternalUrl(url) {
  if (!/^(https?:|mailto:|tel:)/i.test(url)) return;
  void shell.openExternal(url).catch((error) => {
    console.error("Unable to open external link:", error);
  });
}

function launchService(scriptPath, label, environment) {
  const moduleUrl = pathToFileURL(scriptPath).href;
  const child = spawn(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(moduleUrl)}).catch((error) => { console.error(error); process.exitCode = 1; });`,
    ],
    {
      cwd: app.isPackaged ? app.getPath("userData") : app.getAppPath(),
      env: {
        ...process.env,
        ...environment,
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.spawnError = undefined;
  child.once("error", (error) => {
    child.spawnError = error;
    console.error(`Could not start ${label}:`, error);
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      const error = new Error(`${label} stopped unexpectedly (code ${code}, signal ${signal}).`);
      console.error(error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox("Singularity stopped", error.message);
      }
      app.quit();
    }
  });
  logChildOutput(child, label);
  serviceProcesses.push(child);
  return child;
}

async function waitForService(url, child, label) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (child.spawnError) throw child.spawnError;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} exited before becoming ready.`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        await response.body?.cancel();
        return;
      }
      await response.body?.cancel();
    } catch {
      // The local server may take a moment to start.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${label} did not become ready at ${url} within 30 seconds.`);
}

async function stopService(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise((resolve) => {
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function stopServicesAndQuit() {
  if (quitAfterStoppingServices) return;
  quitAfterStoppingServices = true;
  shuttingDown = true;
  Promise.all(serviceProcesses.map(stopService))
    .catch((error) => console.error("Failed to stop Singularity services cleanly:", error))
    .finally(() => app.quit());
}

function getPackagedServerPath() {
  const appPath = app.getAppPath();
  const unpackedAppPath =
    app.isPackaged && appPath.endsWith(".asar") ? `${appPath}.unpacked` : appPath;
  return path.join(unpackedAppPath, ".output", "server", "index.mjs");
}

function getServerEnvironment() {
  const environment = { ...process.env };
  if (app.isPackaged) {
    const userEnvPath = path.join(app.getPath("userData"), ".env");
    if (fs.existsSync(userEnvPath)) {
      Object.assign(environment, dotenv.parse(fs.readFileSync(userEnvPath)));
    }
  }

  return {
    ...environment,
    HOST: APP_HOST,
    NITRO_HOST: APP_HOST,
    PORT: String(APP_PORT),
    NITRO_PORT: String(APP_PORT),
    ELECTRON_RUN_AS_NODE: "1",
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: "Singularity",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const appOrigin = new URL(appUrl).origin;
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== appOrigin) {
      openExternalUrl(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  mainWindow.webContents.on("will-navigate", (event, destination) => {
    if (new URL(destination).origin !== appOrigin) {
      event.preventDefault();
      openExternalUrl(destination);
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });

  void mainWindow.loadURL(appUrl).catch((error) => {
    console.error("Could not load the Singularity application:", error);
    dialog.showErrorBox("Singularity could not start", error.message);
    app.quit();
  });
}

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      if (app.isPackaged) {
        const server = launchService(
          getPackagedServerPath(),
          "Application server",
          getServerEnvironment(),
        );
        await waitForService(APP_URL, server, "Application server");
        appUrl = APP_URL;
      } else {
        await waitForService(
          DEV_URL,
          { exitCode: null, signalCode: null },
          "Vite development server",
        );
        appUrl = DEV_URL;
      }

      createWindow();
    } catch (error) {
      console.error("Singularity startup failed:", error);
      dialog.showErrorBox("Singularity could not start", error.message);
      app.quit();
    }
  });

  app.on("activate", () => {
    if (appUrl && BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("before-quit", (event) => {
    if (
      !quitAfterStoppingServices &&
      serviceProcesses.some((child) => child.exitCode === null && child.signalCode === null)
    ) {
      event.preventDefault();
      stopServicesAndQuit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
