import {BrowserWindow, dialog, ipcMain} from 'electron';
import {basename, dirname, extname, join} from 'path';
import {existsSync} from 'fs';
import type {ExportRequest, ExportStartResult} from '../StellarContract';
import {StellarIPC} from '../StellarConnection';
import type {ExportModel} from '../../models/ExportModel';

/** Answers the export requests and sends progress back to the window that asked. */
export class StellarExportController {
    constructor(private exporter: ExportModel) {}

    register(): void {
        ipcMain.handle(StellarIPC.pickExportPath, (event, defaultName: string, extension: string, defaultFolder?: string) => {
            return this.pickPath(event.sender.id, String(defaultName), String(extension), defaultFolder);
        });

        ipcMain.handle(StellarIPC.startExport, (event, request: ExportRequest) => this.start(event.sender, request));
        ipcMain.on(StellarIPC.cancelExport, (_event, jobId: string) => this.exporter.cancel(String(jobId)));
    }

    private async start(sender: Electron.WebContents, incoming: ExportRequest): Promise<ExportStartResult> {
        // The page may only send pictures as data. File paths for them are made here, never taken from the page.
        const request: ExportRequest = {...incoming, assets: undefined};
        const outputPath = request?.settings?.outputPath;

        if (typeof outputPath !== 'string' || !outputPath) {
            return {ok: false, jobId: null, error: 'Choose where to save the exported file.'};
        }

        if (!existsSync(dirname(outputPath))) {
            return {ok: false, jobId: null, error: 'The folder for the exported file does not exist.'};
        }

        return this.exporter.start(request, (progress) => {
            if (!sender.isDestroyed()) {
                sender.send(StellarIPC.exportProgress, progress);
            }
        });
    }

    private async pickPath(webContentsId: number, defaultName: string, extension: string, defaultFolder?: string): Promise<string | null> {
        const window = BrowserWindow.getAllWindows().find((item) => item.webContents.id === webContentsId);
        const fileName = extname(defaultName) === `.${extension}` ? defaultName : `${basename(defaultName, extname(defaultName))}.${extension}`;
        const options = {
            title: 'Export To',
            defaultPath: defaultFolder ? join(defaultFolder, fileName) : fileName,
            filters: [{name: extension.toUpperCase(), extensions: [extension]}]
        };

        const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);

        if (result.canceled || !result.filePath) {
            return null;
        }

        return extname(result.filePath).toLowerCase() === `.${extension}` ? result.filePath : `${result.filePath}.${extension}`;
    }
}
