import {contextBridge, ipcRenderer, webUtils, type IpcRendererEvent} from 'electron';
import {StellarIPC} from '../common/stellar/StellarConnection';
import type {ElectronApi, Theme} from '../common/CommonInteface';
import type {ExportProgress, PlaybackSource} from '../common/stellar/StellarContract';

/** Turns "ipcRenderer.on" into a function that returns "stop listening". */
function listen<T>(channel: string, callback: (value: T) => void): () => void {
    const listener = (_event: IpcRendererEvent, value: T) => callback(value);

    ipcRenderer.on(channel, listener);

    return () => ipcRenderer.removeListener(channel, listener);
}

const api: ElectronApi = {
    // window
    minimizeWindow: () => ipcRenderer.send(StellarIPC.windowMinimize),
    toggleMaximizeWindow: () => ipcRenderer.send(StellarIPC.windowToggleMaximize),
    closeWindow: () => ipcRenderer.send(StellarIPC.windowClose),
    toggleFullscreen: () => ipcRenderer.send(StellarIPC.windowFullscreen),
    isWindowMaximized: () => ipcRenderer.invoke(StellarIPC.windowIsMaximized),
    onMaximizeChange: (callback) => listen<boolean>(StellarIPC.windowMaximizeChanged, callback),
    onCloseRequested: (callback) => listen<void>(StellarIPC.windowCloseRequested, () => callback()),
    confirmClose: () => ipcRenderer.send(StellarIPC.windowConfirmClose),
    getLaunchContext: () => ipcRenderer.invoke(StellarIPC.getLaunchContext),
    getPathForFile: (file) => webUtils.getPathForFile(file),

    // settings, themes, hotkeys
    getSettings: () => ipcRenderer.invoke(StellarIPC.getSettings),
    updateSettings: (changes) => ipcRenderer.invoke(StellarIPC.updateSettings, changes),
    listThemes: () => ipcRenderer.invoke(StellarIPC.listThemes),
    selectTheme: (id) => ipcRenderer.invoke(StellarIPC.selectTheme, id),
    onThemeChanged: (callback) => listen<Theme>(StellarIPC.themeChanged, callback),
    openThemesFolder: () => ipcRenderer.send(StellarIPC.openThemesFolder),
    getKeybinds: () => ipcRenderer.invoke(StellarIPC.getKeybinds),
    setKeybind: (commandId, combo) => ipcRenderer.invoke(StellarIPC.setKeybind, commandId, combo),
    resetKeybinds: () => ipcRenderer.invoke(StellarIPC.resetKeybinds),
    openKeybindsFile: () => ipcRenderer.send(StellarIPC.openKeybindsFile),

    // projects
    listRecentProjects: () => ipcRenderer.invoke(StellarIPC.listRecentProjects),
    removeRecentProject: (path) => ipcRenderer.invoke(StellarIPC.removeRecentProject, path),
    pickFolder: (defaultPath) => ipcRenderer.invoke(StellarIPC.pickFolder, defaultPath),
    createProject: (options) => ipcRenderer.invoke(StellarIPC.createProject, options),
    browseProject: () => ipcRenderer.invoke(StellarIPC.browseProject),
    openProjectInEditor: (path) => ipcRenderer.invoke(StellarIPC.openProjectInEditor, path),
    loadProject: (path) => ipcRenderer.invoke(StellarIPC.loadProject, path),
    readProjectFile: (path) => ipcRenderer.invoke(StellarIPC.readProjectFile, path),
    saveProject: (path, document) => ipcRenderer.invoke(StellarIPC.saveProject, path, document),
    saveProjectAs: (document) => ipcRenderer.invoke(StellarIPC.saveProjectAs, document),
    autosaveProject: (path, document) => ipcRenderer.invoke(StellarIPC.autosaveProject, path, document),
    closeProjectToLauncher: () => ipcRenderer.send(StellarIPC.closeProjectToLauncher),
    revealInFolder: (path) => ipcRenderer.send(StellarIPC.revealInFolder, path),

    // media
    importDialog: () => ipcRenderer.invoke(StellarIPC.importDialog),
    listDirectory: (path) => ipcRenderer.invoke(StellarIPC.listDirectory, path),
    probeMedia: (paths) => ipcRenderer.invoke(StellarIPC.probeMedia, paths),
    checkFiles: (paths) => ipcRenderer.invoke(StellarIPC.checkFiles, paths),
    relinkDialog: (oldPath) => ipcRenderer.invoke(StellarIPC.relinkDialog, oldPath),
    getThumbnail: (path, kind, duration) => ipcRenderer.invoke(StellarIPC.getThumbnail, path, kind, duration),
    getPlaybackSource: (path, kind) => ipcRenderer.invoke(StellarIPC.getPlaybackSource, path, kind),
    getWaveform: (path) => ipcRenderer.invoke(StellarIPC.getWaveform, path),
    onProxyProgress: (callback) => listen<PlaybackSource>(StellarIPC.proxyProgress, callback),

    // export
    pickExportPath: (defaultName, extension, defaultFolder) => {
        return ipcRenderer.invoke(StellarIPC.pickExportPath, defaultName, extension, defaultFolder);
    },
    startExport: (request) => ipcRenderer.invoke(StellarIPC.startExport, request),
    cancelExport: (jobId) => ipcRenderer.send(StellarIPC.cancelExport, jobId),
    onExportProgress: (callback) => listen<ExportProgress>(StellarIPC.exportProgress, callback)
};

contextBridge.exposeInMainWorld('api', api);
