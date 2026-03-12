const { autoUpdater } = require('electron-updater');

class UpdateService {
  constructor(app, getWindow) {
    this.app = app;
    this.getWindow = getWindow;
    this.status = {
      enabled: this.app.isPackaged,
      state: this.app.isPackaged ? 'idle' : 'disabled-in-dev',
      version: this.app.getVersion(),
      message: this.app.isPackaged ? 'Ready' : 'Auto-update disabled while unpackaged'
    };
  }

  sendStatus() {
    const window = this.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send('updates:status-changed', this.status);
    }
  }

  async initialize() {
    if (!this.app.isPackaged) {
      this.sendStatus();
      return;
    }

    autoUpdater.autoDownload = false;

    autoUpdater.on('checking-for-update', () => {
      this.status = { ...this.status, state: 'checking', message: 'Checking for updates' };
      this.sendStatus();
    });

    autoUpdater.on('update-available', (info) => {
      this.status = {
        ...this.status,
        state: 'available',
        message: `Update available: ${info.version}`
      };
      this.sendStatus();
    });

    autoUpdater.on('update-not-available', () => {
      this.status = { ...this.status, state: 'up-to-date', message: 'No update available' };
      this.sendStatus();
    });

    autoUpdater.on('error', (error) => {
      this.status = { ...this.status, state: 'error', message: String(error.message || error) };
      this.sendStatus();
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.status = {
        ...this.status,
        state: 'downloaded',
        message: `Update downloaded: ${info.version}`
      };
      this.sendStatus();
    });

    this.sendStatus();
  }

  getStatus() {
    return this.status;
  }

  async checkForUpdates() {
    if (!this.app.isPackaged) {
      return this.status;
    }
    await autoUpdater.checkForUpdates();
    return this.status;
  }

  async quitAndInstall() {
    if (this.status.state !== 'downloaded') {
      return { ok: false, reason: 'No downloaded update ready to install' };
    }
    autoUpdater.quitAndInstall();
    return { ok: true };
  }
}

module.exports = { UpdateService };
