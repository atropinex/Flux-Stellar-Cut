import {BrowserWindow, dialog, ipcMain, shell} from 'electron';
import {basename, dirname, extname} from 'path';
import type {NewProjectOptions, ProjectDocument, ProjectLoadResult} from '../StellarContract';
import {StellarIPC} from '../StellarConnection';
import {PROJECT_EXTENSION} from '../StellarConfig';
import type {ProjectModel} from '../../models/ProjectModel';
import type {AutosaveModel} from '../../models/AutosaveModel';
import type {SettingsModel} from '../../models/SettingsModel';

const PROJECT_FILTER = {name: 'Stellar Project', extensions: [PROJECT_EXTENSION]};

/** Answers the project requests from the launcher and the editor. */
export class StellarProjectController {
    constructor(
        private projects: ProjectModel,
        private autosaves: AutosaveModel,
        private settings: SettingsModel
    ) {
    }

    register(): void {
        ipcMain.handle(StellarIPC.listRecentProjects, () => this.projects.listRecent());
        ipcMain.handle(StellarIPC.removeRecentProject, (_event, path: string) => this.projects.removeRecent(String(path)));

        ipcMain.handle(StellarIPC.pickFolder, (event, defaultPath?: string) => this.pickFolder(event.sender.id, defaultPath));
        ipcMain.handle(StellarIPC.createProject, (_event, options: NewProjectOptions) => this.createProject(options));
        ipcMain.handle(StellarIPC.browseProject, (event) => this.browseProject(event.sender.id));

        ipcMain.handle(StellarIPC.loadProject, (_event, path: string) => this.loadProject(String(path)));
        ipcMain.handle(StellarIPC.readProjectFile, (_event, path: string) => this.projects.read(String(path)));
        ipcMain.handle(StellarIPC.saveProject, (_event, path: string, document: ProjectDocument) => this.saveProject(String(path), document));
        ipcMain.handle(StellarIPC.saveProjectAs, (event, document: ProjectDocument) => this.saveProjectAs(event.sender.id, document));
        ipcMain.handle(StellarIPC.autosaveProject, (_event, path: string, document: ProjectDocument) => {
            return this.autosaves.save(String(path), document);
        });

        ipcMain.on(StellarIPC.revealInFolder, (_event, path: string) => {
            shell.showItemInFolder(String(path));
        });
    }

    private createProject(options: NewProjectOptions): string {
        const name = String(options.name ?? '').trim();
        const folder = String(options.folder ?? '').trim();

        if (!name || !folder) {
            throw new Error('A project needs a name and a folder.');
        }

        const path = this.projects.create({...options, name, folder});
        this.settings.update({lastProjectFolder: folder});

        return path;
    }

    private loadProject(path: string): ProjectLoadResult {
        const document = this.projects.read(path);
        this.projects.addRecent(path, document.name);

        return {path, document, recoveryPath: this.autosaves.findNewerThan(path)};
    }

    private saveProject(path: string, document: ProjectDocument): void {
        this.projects.write(path, document);
        this.projects.addRecent(path, document.name);
    }

    private async saveProjectAs(webContentsId: number, document: ProjectDocument): Promise<string | null> {
        const defaultFolder = this.settings.get().lastProjectFolder || undefined;
        const options = {
            title: 'Save Project As',
            defaultPath: defaultFolder ? `${defaultFolder}/${document.name}.${PROJECT_EXTENSION}` : `${document.name}.${PROJECT_EXTENSION}`,
            filters: [PROJECT_FILTER]
        };

        const window = this.windowOf(webContentsId);
        const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);

        if (result.canceled || !result.filePath) {
            return null;
        }

        const path = this.projects.withExtension(result.filePath);
        const renamed = {...document, name: basename(path, extname(path))};

        this.projects.write(path, renamed);
        this.projects.addRecent(path, renamed.name);
        this.settings.update({lastProjectFolder: dirname(dirname(path))});

        return path;
    }

    private async browseProject(webContentsId: number): Promise<string | null> {
        const window = this.windowOf(webContentsId);
        const options = {
            title: 'Open Project',
            defaultPath: this.settings.get().lastProjectFolder || undefined,
            properties: ['openFile' as const],
            filters: [PROJECT_FILTER]
        };

        const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

        return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
    }

    private async pickFolder(webContentsId: number, defaultPath?: string): Promise<string | null> {
        const window = this.windowOf(webContentsId);
        const options = {
            title: 'Choose a Folder',
            defaultPath: defaultPath || this.settings.get().lastProjectFolder || undefined,
            properties: ['openDirectory' as const, 'createDirectory' as const]
        };

        const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

        return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
    }

    private windowOf(webContentsId: number): BrowserWindow | null {
        return BrowserWindow.getAllWindows().find((window) => window.webContents.id === webContentsId) ?? null;
    }
}
