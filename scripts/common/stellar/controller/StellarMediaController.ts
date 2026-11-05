import {BrowserWindow, dialog, ipcMain} from 'electron';
import {existsSync, readdirSync, statSync} from 'fs';
import {homedir} from 'os';
import {dirname, extname, join, parse, resolve} from 'path';
import type {DirectoryEntry, DirectoryListing} from '../../CommonInteface';
import type {MediaKind} from '../StellarContract';
import {StellarIPC} from '../StellarConnection';
import {ALL_MEDIA_EXTENSIONS, AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS} from '../StellarConfig';
import type {MediaModel} from '../../models/MediaModel';

/** Answers the media requests: import, probing, thumbnails, playback copies and waveforms. */
export class StellarMediaController {
    constructor(private media: MediaModel) {}

    register(): void {
        ipcMain.handle(StellarIPC.importDialog, (event) => this.importDialog(event.sender.id));
        ipcMain.handle(StellarIPC.listDirectory, (_event, path: string | null) => this.listDirectory(typeof path === 'string' ? path : null));
        ipcMain.handle(StellarIPC.probeMedia, (_event, paths: string[]) => this.media.probeMany(this.cleanPaths(paths)));
        ipcMain.handle(StellarIPC.checkFiles, (_event, paths: string[]) => this.media.checkFiles(this.cleanPaths(paths)));
        ipcMain.handle(StellarIPC.relinkDialog, (event, oldPath: string) => this.relinkDialog(event.sender.id, String(oldPath)));

        ipcMain.handle(StellarIPC.getThumbnail, (_event, path: string, kind: MediaKind, duration: number) => {
            return this.media.getThumbnail(String(path), kind, Number(duration) || 0);
        });
        ipcMain.handle(StellarIPC.getPlaybackSource, (_event, path: string, kind: MediaKind) => {
            return this.media.getPlaybackSource(String(path), kind);
        });
        ipcMain.handle(StellarIPC.getWaveform, (_event, path: string) => this.media.getWaveform(String(path)));
    }

    /** The Media Browser: the folders and media files inside a folder. */
    private listDirectory(path: string | null): DirectoryListing {
        const home = homedir();
        const roots = [
            {name: 'Home', path: home},
            {name: 'Desktop', path: join(home, 'Desktop')},
            {name: 'Documents', path: join(home, 'Documents')},
            {name: 'Videos', path: join(home, 'Videos')},
            {name: 'Movies', path: join(home, 'Movies')},
            {name: 'Music', path: join(home, 'Music')},
            {name: 'Pictures', path: join(home, 'Pictures')},
            {name: 'Downloads', path: join(home, 'Downloads')}
        ].filter((root) => existsSync(root.path));
        const folder = resolve(path && path.length > 0 ? path : home);
        const listing: DirectoryListing = {path: folder, parent: parse(folder).root === folder ? null : dirname(folder), entries: [], roots, error: null};

        try {
            const entries: DirectoryEntry[] = [];

            for (const name of readdirSync(folder)) {
                if (name.startsWith('.')) {
                    continue;
                }

                const full = join(folder, name);

                try {
                    const info = statSync(full);

                    if (info.isDirectory()) {
                        entries.push({name, path: full, isDirectory: true, size: 0});
                    } else if (ALL_MEDIA_EXTENSIONS.includes(extname(name).slice(1).toLowerCase())) {
                        entries.push({name, path: full, isDirectory: false, size: info.size});
                    }
                } catch {
                    // A file that cannot be read is left out of the list.
                }
            }

            entries.sort((first, second) => Number(second.isDirectory) - Number(first.isDirectory) || first.name.localeCompare(second.name));
            listing.entries = entries;
        } catch (error) {
            listing.error = error instanceof Error ? error.message : String(error);
        }

        return listing;
    }

    private cleanPaths(paths: unknown): string[] {
        if (!Array.isArray(paths)) {
            return [];
        }

        return paths.filter((path): path is string => typeof path === 'string');
    }

    private async importDialog(webContentsId: number): Promise<string[]> {
        const window = this.windowOf(webContentsId);
        const options = {
            title: 'Import Media',
            properties: ['openFile' as const, 'multiSelections' as const],
            filters: [
                {name: 'All Media', extensions: ALL_MEDIA_EXTENSIONS},
                {name: 'Video', extensions: VIDEO_EXTENSIONS},
                {name: 'Audio', extensions: AUDIO_EXTENSIONS},
                {name: 'Images', extensions: IMAGE_EXTENSIONS},
                {name: 'Every file', extensions: ['*']}
            ]
        };

        const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

        return result.canceled ? [] : result.filePaths;
    }

    private async relinkDialog(webContentsId: number, oldPath: string): Promise<string | null> {
        const window = this.windowOf(webContentsId);
        const extension = extname(oldPath).replace('.', '');
        const options = {
            title: 'Locate File',
            properties: ['openFile' as const],
            filters: [
                {name: 'Same type', extensions: extension ? [extension] : ['*']},
                {name: 'Every file', extensions: ['*']}
            ]
        };

        const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

        return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
    }

    private windowOf(webContentsId: number): BrowserWindow | null {
        return BrowserWindow.getAllWindows().find((window) => window.webContents.id === webContentsId) ?? null;
    }
}
