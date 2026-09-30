'use strict';

const { app, BrowserWindow, desktopCapturer, dialog, session } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

let backendProcess = null;
let mainWindow = null;
let appOrigin = null;
let serverPort = null;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function isAppOrigin(value) {
  try {
    return new URL(value).origin === appOrigin;
  } catch {
    return false;
  }
}

function configureMediaCapture() {
  const appSession = session.defaultSession;

  appSession.setPermissionCheckHandler((_contents, permission, origin) => (
    isAppOrigin(origin) && ['media', 'display-capture'].includes(permission)
  ));

  appSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const allowed = isAppOrigin(details.requestingUrl)
      && ['media', 'display-capture'].includes(permission);
    callback(allowed);
  });

  appSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (
      process.platform !== 'win32'
      || !isAppOrigin(request.securityOrigin)
      || !request.audioRequested
      || !request.videoRequested
    ) {
      callback(null);
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 }
      });
      if (!sources.length) {
        callback(null);
        return;
      }

      callback({ video: sources[0], audio: 'loopback' });
    } catch (error) {
      console.error('[Audio] Windows loopback capture failed:', error);
      callback(null);
    }
  });
}

function startBackend(port) {
  const appRoot = app.isPackaged
    ? process.resourcesPath
    : path.resolve(__dirname, '..');
  const packagedBackend = path.join(appRoot, 'backend', 'MOMBackend.exe');
  const command = app.isPackaged
    ? packagedBackend
    : (process.env.PYTHON_EXECUTABLE || 'python');
  const args = app.isPackaged
    ? []
    : [path.join(appRoot, 'backend', 'server.py')];
  const logDirectory = app.getPath('userData');

  fs.mkdirSync(logDirectory, { recursive: true });
  const log = fs.createWriteStream(path.join(logDirectory, 'backend.log'), { flags: 'a' });
  backendProcess = spawn(command, args, {
    cwd: appRoot,
    env: {
      ...process.env,
      MOM_APP_ROOT: appRoot,
      MOM_SERVER_HOST: '127.0.0.1',
      MOM_SERVER_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  backendProcess.stdout.pipe(log);
  backendProcess.stderr.pipe(log);
  backendProcess.on('error', (error) => {
    log.write(`[Electron] Backend process error: ${error.stack || error}\n`);
  });
  backendProcess.on('close', () => log.end());
  return backendProcess;
}

async function waitForBackend(child, port) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local backend exited with code ${child.exitCode}. Check the backend log in ${app.getPath('userData')}.`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Local backend did not start. Check the backend log in ${app.getPath('userData')}.`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppOrigin(url)) event.preventDefault();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(appOrigin);
}

app.whenReady().then(async () => {
  try {
    if (process.platform !== 'win32') {
      throw new Error('The Windows desktop app is supported on Windows only.');
    }

    serverPort = await getAvailablePort();
    appOrigin = `http://127.0.0.1:${serverPort}`;
    configureMediaCapture();
    const child = startBackend(serverPort);
    await waitForBackend(child, serverPort);
    createWindow();
  } catch (error) {
    dialog.showErrorBox('MOM Offline Transcriber could not start', error.message);
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});