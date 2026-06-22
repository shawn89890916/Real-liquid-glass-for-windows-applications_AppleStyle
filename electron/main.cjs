const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 980,
    minHeight: 650,
    frame: false,
    transparent: false,
    backgroundColor: '#0b1017',
    show: false,
    title: 'Liquid Glass Lab',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Fallback: show window after 3s even if ready-to-show hasn't fired
  const showTimeout = setTimeout(() => {
    if (!win.isDestroyed()) win.show();
  }, 3000);

  win.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    if (!win.isDestroyed()) win.show();
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(htmlPath).catch(err => {
      console.error('Failed to load file:', htmlPath, err);
    });
  }
}

ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
