import {ipcMain, shell} from 'electron';
import type {UpdatableSettings} from '../../CommonInteface';
import {StellarIPC} from '../StellarConnection';
import type {SettingsModel} from '../../models/SettingsModel';
import type {ThemeModel} from '../../models/ThemeModel';
import type {KeybindModel} from '../../models/KeybindModel';
import type {StellarWindowController} from './StellarWindowController';

/** Answers the settings, theme and hotkey requests that the page sends through the preload bridge. */
export class StellarConnectionController {
    constructor(
        private settings: SettingsModel,
        private themes: ThemeModel,
        private keybinds: KeybindModel,
        private windows: StellarWindowController
    ) {
    }

    register(): void {
        ipcMain.handle(StellarIPC.getSettings, () => this.settings.get());
        ipcMain.handle(StellarIPC.updateSettings, (_event, changes: UpdatableSettings) => this.settings.update(changes ?? {}));

        // Themes are read from the disk each time, so edits show up after "Reload".
        ipcMain.handle(StellarIPC.listThemes, () => this.themes.load());
        ipcMain.handle(StellarIPC.selectTheme, (_event, id: string) => this.selectTheme(String(id)));
        ipcMain.on(StellarIPC.openThemesFolder, () => void shell.openPath(this.themes.folder));

        ipcMain.handle(StellarIPC.getKeybinds, () => this.keybinds.get());
        ipcMain.handle(StellarIPC.setKeybind, (_event, commandId: string, combo: string | null) => {
            return this.keybinds.set(String(commandId), combo === null ? null : String(combo));
        });
        ipcMain.handle(StellarIPC.resetKeybinds, () => this.keybinds.reset());
        ipcMain.on(StellarIPC.openKeybindsFile, () => void shell.openPath(this.keybinds.filePath));
    }

    private selectTheme(id: string) {
        const list = this.themes.load();
        const theme = list.themes.find((item) => item.id === id) ?? list.themes[0];

        if (!theme) {
            throw new Error('There are no themes.');
        }

        this.settings.update({theme: theme.id});
        this.windows.applyThemeToWindows();
        this.windows.broadcast(StellarIPC.themeChanged, theme);

        return theme;
    }
}
