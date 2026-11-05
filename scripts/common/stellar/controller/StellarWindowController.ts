import {app, BrowserWindow, ipcMain, screen} from 'electron';
import {join} from 'path';
import type {LaunchContext, WindowMaterial} from '../StellarContract';
import {StellarIPC} from '../StellarConnection';
import {APP_NAME} from '../StellarConfig';
import type {ThemeModel} from '../../models/ThemeModel';
import type {SettingsModel} from '../../models/SettingsModel';

/** Owns the two windows: the launcher (project view) and the editor. */
export class StellarWindowController {
    private launcher: BrowserWindow | null = null;
    private editor: BrowserWindow | null = null;
    private contexts = new Map<number, LaunchContext>(); // by web contents id
    private forceClose = new Set<number>();               // editor windows that may close without asking
    private isQuitting = false;

    constructor(private themes: ThemeModel, private settings: SettingsModel) {}

    register(): void {
        ipcMain.on(StellarIPC.windowMinimize, (event) => this.windowOf(event.sender.id)?.minimize());
        ipcMain.on(StellarIPC.windowToggleMaximize, (event) => this.toggleMaximize(this.windowOf(event.sender.id)));
        ipcMain.on(StellarIPC.windowClose, (event) => this.windowOf(event.sender.id)?.close());
        ipcMain.on(StellarIPC.windowFullscreen, (event) => this.toggleFullscreen(this.windowOf(event.sender.id)));
        ipcMain.handle(StellarIPC.windowIsMaximized, (event) => this.windowOf(event.sender.id)?.isMaximized() ?? false);
        ipcMain.handle(StellarIPC.getLaunchContext, (event) => {
            return this.contexts.get(event.sender.id) ?? {view: 'launcher', projectPath: null};
        });

        ipcMain.on(StellarIPC.windowConfirmClose, (event) => {
            const window = this.windowOf(event.sender.id);

            if (!window) {
                return;
            }

            this.forceClose.add(window.webContents.id);
            window.close();
        });

        ipcMain.handle(StellarIPC.openProjectInEditor, (_event, path: string) => this.openEditor(path));
        ipcMain.on(StellarIPC.closeProjectToLauncher, () => this.closeEditorToLauncher());

        app.on('before-quit', () => {
            this.isQuitting = true;
        });
    }

    showLauncher(): void {
        if (this.launcher && !this.launcher.isDestroyed()) {
            this.launcher.show();
            this.launcher.focus();
            return;
        }

        const window = this.createWindow({width: 1120, height: 720, minWidth: 900, minHeight: 600, center: true}, {view: 'launcher', projectPath: null});
        this.launcher = window;
        window.on('closed', () => {
            this.launcher = null;

            if (!this.editor && !this.isQuitting) {
                app.quit();
            }
        });
    }

    openEditor(projectPath: string): void {
        if (this.editor && !this.editor.isDestroyed()) {
            this.forceClose.add(this.editor.webContents.id);
            this.editor.close();
        }

        const {width, height} = screen.getPrimaryDisplay().workAreaSize;
        const window = this.createWindow(
            {width: Math.min(1700, width), height: Math.min(960, height), minWidth: 1000, minHeight: 640, center: true},
            {view: 'editor', projectPath}
        );

        this.editor = window;
        window.maximize();
        window.on('close', (event) => this.askEditorBeforeClosing(event, window));
        window.on('closed', () => {
            this.editor = null;
        });

        if (this.launcher && !this.launcher.isDestroyed()) {
            this.launcher.close();
        }
    }

    /** Called when the theme changes, so the window material follows it. */
    applyThemeToWindows(): void {
        const theme = this.themes.find(this.settings.get().theme);

        if (!theme) {
            return;
        }

        for (const window of BrowserWindow.getAllWindows()) {
            this.applyMaterial(window, theme.material, theme.base);
        }
    }

    broadcast(channel: string, ...args: unknown[]): void {
        for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
                window.webContents.send(channel, ...args);
            }
        }
    }

    // === Private === //

    private closeEditorToLauncher(): void {
        if (this.editor && !this.editor.isDestroyed()) {
            this.forceClose.add(this.editor.webContents.id);
            this.editor.close();
        }

        this.showLauncher();
    }

    /** The editor asks the page first, because the project may have unsaved changes. */
    private askEditorBeforeClosing(event: Electron.Event, window: BrowserWindow): void {
        if (this.forceClose.has(window.webContents.id) || this.isQuitting) {
            return;
        }

        event.preventDefault();
        window.webContents.send(StellarIPC.windowCloseRequested);
    }

    private createWindow(size: Electron.BrowserWindowConstructorOptions, context: LaunchContext): BrowserWindow {
        const theme = this.themes.find(this.settings.get().theme);
        const material = theme?.material ?? 'none';

        const window = new BrowserWindow({
            ...size,
            title: APP_NAME,
            frame: false,
            show: false,
            backgroundColor: material === 'none' ? (theme?.base ?? '#0b0d14') : '#00000000',
            webPreferences: {
                preload: join(__dirname, '../preload/preloadindex.js'),
                contextIsolation: true,
                sandbox: true
            }
        });

        // A closed window is destroyed, and touching window.webContents then throws "Object has been destroyed".
        // The id is kept here while the window is still alive.
        const webContentsId = window.webContents.id;

        this.contexts.set(webContentsId, context);
        this.applyMaterial(window, material, theme?.base ?? '#0b0d14');

        window.once('ready-to-show', () => window.show());
        const sendMaximized = (maximized: boolean) => {
            if (!window.isDestroyed()) {
                window.webContents.send(StellarIPC.windowMaximizeChanged, maximized);
            }
        };

        window.on('maximize', () => sendMaximized(true));
        window.on('unmaximize', () => sendMaximized(false));
        window.on('closed', () => {
            this.contexts.delete(webContentsId);
            this.forceClose.delete(webContentsId);
        });

        // While developing, electron-vite serves the page from a local dev server.
        const devServerUrl = process.env['ELECTRON_RENDERER_URL'];

        if (!app.isPackaged && devServerUrl) {
            void window.loadURL(devServerUrl);
        } else {
            void window.loadFile(join(__dirname, '../renderer/index.html'));
        }

        return window;
    }

    private applyMaterial(window: BrowserWindow, material: WindowMaterial, base: string): void {
        if (window.isDestroyed()) {
            return;
        }

        try {
            if (process.platform === 'win32') {
                window.setBackgroundMaterial(material);
            } else if (process.platform === 'darwin') {
                window.setVibrancy(material === 'none' ? null : 'under-window');
            }

            if (material === 'none') {
                window.setBackgroundColor(base);
            }
        } catch (error) {
            console.warn('[Stellar Window] Could not set the window material.', error);
        }
    }

    private toggleMaximize(window: BrowserWindow | null): void {
        if (!window) {
            return;
        }

        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }

    private toggleFullscreen(window: BrowserWindow | null): void {
        window?.setFullScreen(!window.isFullScreen());
    }

    private windowOf(webContentsId: number): BrowserWindow | null {
        return BrowserWindow.getAllWindows().find((window) => window.webContents.id === webContentsId) ?? null;
    }
}
