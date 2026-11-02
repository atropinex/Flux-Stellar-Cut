import type {
    ExportProgress, ExportRequest, ExportStartResult, LaunchContext, MediaKind, NewProjectOptions,
    PlaybackSource, ProbeResult, ProjectDocument, ProjectLoadResult, RecentProject, ThemeColor,
    WaveformData, WindowMaterial
} from './stellar/StellarContract';
import type {KeybindMap} from './stellar/StellarCommands';

/** Everything the page can ask the app to do. The preload script fills this in. */
export interface ElectronApi {
    // window
    minimizeWindow: () => void;
    toggleMaximizeWindow: () => void;
    closeWindow: () => void;
    toggleFullscreen: () => void;
    isWindowMaximized: () => Promise<boolean>;
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void; // returns "stop listening"
    onCloseRequested: (callback: () => void) => () => void;
    confirmClose: () => void;
    getLaunchContext: () => Promise<LaunchContext>;
    getPathForFile: (file: File) => string;

    // settings, themes, hotkeys
    getSettings: () => Promise<AppSettings>;
    updateSettings: (changes: UpdatableSettings) => Promise<AppSettings>;
    listThemes: () => Promise<ThemeList>;
    selectTheme: (id: string) => Promise<Theme>;
    onThemeChanged: (callback: (theme: Theme) => void) => () => void;
    openThemesFolder: () => void;
    getKeybinds: () => Promise<KeybindMap>;
    setKeybind: (commandId: string, combo: string | null) => Promise<KeybindMap>;
    resetKeybinds: () => Promise<KeybindMap>;
    openKeybindsFile: () => void;

    // projects
    listRecentProjects: () => Promise<RecentProject[]>;
    removeRecentProject: (path: string) => Promise<RecentProject[]>;
    pickFolder: (defaultPath?: string) => Promise<string | null>;
    createProject: (options: NewProjectOptions) => Promise<string>;       // returns the project file path
    browseProject: () => Promise<string | null>;
    openProjectInEditor: (path: string) => Promise<void>;
    loadProject: (path: string) => Promise<ProjectLoadResult>;
    readProjectFile: (path: string) => Promise<ProjectDocument>;
    saveProject: (path: string, document: ProjectDocument) => Promise<void>;
    saveProjectAs: (document: ProjectDocument) => Promise<string | null>; // returns the new path, null if cancelled
    autosaveProject: (path: string, document: ProjectDocument) => Promise<string>;
    closeProjectToLauncher: () => void;
    revealInFolder: (path: string) => void;

    // media
    importDialog: () => Promise<string[]>;
    listDirectory: (path: string | null) => Promise<DirectoryListing>;
    probeMedia: (paths: string[]) => Promise<ProbeResult[]>;
    checkFiles: (paths: string[]) => Promise<Record<string, boolean>>;
    relinkDialog: (oldPath: string) => Promise<string | null>;
    getThumbnail: (path: string, kind: MediaKind, duration: number) => Promise<string | null>;
    getPlaybackSource: (path: string, kind: MediaKind) => Promise<PlaybackSource>;
    getWaveform: (path: string) => Promise<WaveformData | null>;
    onProxyProgress: (callback: (source: PlaybackSource) => void) => () => void;

    // export
    pickExportPath: (defaultName: string, extension: string, defaultFolder?: string) => Promise<string | null>;
    startExport: (request: ExportRequest) => Promise<ExportStartResult>;
    cancelExport: (jobId: string) => void;
    onExportProgress: (callback: (progress: ExportProgress) => void) => () => void;
}

export interface AppSettings {
    theme: string;
    workspace: string;
    layout: Record<string, number>;      // panel split positions, by name
    autosaveEnabled: boolean;
    autosaveIntervalMinutes: number;
    autosaveMaxVersions: number;
    autoProxy: boolean;                  // build smooth-playback copies of formats the player cannot decode
    proxyHeight: number;
    stillDurationSeconds: number;
    snapping: boolean;
    linkedSelection: boolean;
    lastProjectFolder: string;
    webAudio: boolean;                   // route the preview sound through the mixer (meters, pan, gain above 0 dB)
    projectTab: string;                  // the tab that is open in the project panel
}

export interface DirectoryEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
}

export interface DirectoryListing {
    path: string;
    parent: string | null;
    entries: DirectoryEntry[];
    roots: { name: string; path: string }[];
    error: string | null;
}

export type UpdatableSettings = Partial<AppSettings>;

export interface ThemeLayer {
    type: 'gradient' | 'image';
    value: string;
    opacity: number;
    blur: number;
    size: string;
}

export interface ThemeGlass {
    island: string;     // background of every panel
    header: string;     // background of the panel title bar
    blur: number;       // px
    saturate: number;   // percent
    border: string;
    highlight: string;  // thin light line on top of each panel
    shadow: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: Partial<Record<ThemeColor, string>>;
    glass: ThemeGlass;
    radius: number;     // px, corners of the panels
    gap: number;        // px, space between the panels
    material: WindowMaterial;
    base: string;       // color behind everything
    layers: ThemeLayer[];
    overrides: Record<string, Record<string, string>>;
}

export interface ThemeList {
    themes: Theme[];
    errors: string[];
}
