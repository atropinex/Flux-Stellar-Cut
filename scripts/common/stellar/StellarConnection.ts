// The names of the messages between the window (preload) and the app (main).
export const StellarIPC = {
    // window
    windowMinimize: 'window:minimize',
    windowToggleMaximize: 'window:toggle-maximize',
    windowClose: 'window:close',
    windowIsMaximized: 'window:is-maximized',
    windowMaximizeChanged: 'window:maximize-changed',      // main -> page
    windowCloseRequested: 'window:close-requested',        // main -> page, the user tried to close the editor
    windowConfirmClose: 'window:confirm-close',
    windowFullscreen: 'window:fullscreen',
    getLaunchContext: 'app:launch-context',

    // settings, themes, hotkeys
    getSettings: 'settings:get',
    updateSettings: 'settings:update',
    listThemes: 'themes:list',
    selectTheme: 'themes:select',
    themeChanged: 'themes:changed',                         // main -> page
    openThemesFolder: 'themes:open-folder',
    getKeybinds: 'keybinds:get',
    setKeybind: 'keybinds:set',
    resetKeybinds: 'keybinds:reset',
    openKeybindsFile: 'keybinds:open-file',

    // projects
    listRecentProjects: 'projects:recent',
    removeRecentProject: 'projects:remove-recent',
    pickFolder: 'projects:pick-folder',
    createProject: 'projects:create',
    browseProject: 'projects:browse',
    openProjectInEditor: 'projects:open-in-editor',
    loadProject: 'projects:load',
    readProjectFile: 'projects:read-file',
    saveProject: 'projects:save',
    saveProjectAs: 'projects:save-as',
    autosaveProject: 'projects:autosave',
    closeProjectToLauncher: 'projects:close-to-launcher',
    revealInFolder: 'projects:reveal',

    // media
    importDialog: 'media:import-dialog',
    listDirectory: 'media:list-directory',
    probeMedia: 'media:probe',
    checkFiles: 'media:check-files',
    relinkDialog: 'media:relink-dialog',
    getThumbnail: 'media:thumbnail',
    getPlaybackSource: 'media:playback-source',
    getWaveform: 'media:waveform',
    proxyProgress: 'media:proxy-progress',                  // main -> page

    // export
    pickExportPath: 'export:pick-path',
    startExport: 'export:start',
    cancelExport: 'export:cancel',
    exportProgress: 'export:progress'                       // main -> page
} as const;

/** Media is shown in the page through this address. The main process serves the file, with seeking. */
export const MEDIA_SCHEME = 'stellar-media';

export function toMediaUrl(path: string): string {
    return `${MEDIA_SCHEME}://file/${encodeURIComponent(path)}`;
}
