import type {AppSettings} from '../CommonInteface';

export const APP_NAME = 'Flux-Stellar-Cut';
export const PROJECT_EXTENSION = 'stellarproj';
export const AUTOSAVE_FOLDER_NAME = 'Stellar Auto-Save';
export const RECENT_PROJECTS_LIMIT = 30;

// === What can be imported (ffmpeg reads all of these) === //
export const VIDEO_EXTENSIONS = [
    'mp4', 'm4v', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'f4v', 'webm', 'ogv', 'mpg', 'mpeg', 'mpe', 'm2v',
    'ts', 'mts', 'm2ts', 'mxf', '3gp', '3g2', 'vob', 'asf', 'dv', 'divx', 'rm', 'rmvb', 'mj2'
];
export const AUDIO_EXTENSIONS = [
    'mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'oga', 'opus', 'aif', 'aiff', 'wma', 'ac3', 'eac3', 'mka', 'caf', 'amr'
];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'tif', 'tiff', 'avif'];
/** Images a browser can show directly. Everything else is converted to png for the preview. */
export const WEB_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'avif'];
export const ALL_MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS];

// === Sequences === //
export interface SequencePreset {
    id: string;
    label: string;
    width: number;
    height: number;
    frameRate: number;
}

export const SEQUENCE_PRESETS: SequencePreset[] = [
    {id: 'hd1080-24', label: 'HD 1080p  ·  24 fps', width: 1920, height: 1080, frameRate: 24},
    {id: 'hd1080-2398', label: 'HD 1080p  ·  23.976 fps', width: 1920, height: 1080, frameRate: 24000 / 1001},
    {id: 'hd1080-25', label: 'HD 1080p  ·  25 fps', width: 1920, height: 1080, frameRate: 25},
    {id: 'hd1080-30', label: 'HD 1080p  ·  30 fps', width: 1920, height: 1080, frameRate: 30},
    {id: 'hd1080-2997', label: 'HD 1080p  ·  29.97 fps', width: 1920, height: 1080, frameRate: 30000 / 1001},
    {id: 'hd1080-60', label: 'HD 1080p  ·  60 fps', width: 1920, height: 1080, frameRate: 60},
    {id: 'hd720-30', label: 'HD 720p  ·  30 fps', width: 1280, height: 720, frameRate: 30},
    {id: 'uhd-24', label: '4K UHD  ·  24 fps', width: 3840, height: 2160, frameRate: 24},
    {id: 'uhd-30', label: '4K UHD  ·  30 fps', width: 3840, height: 2160, frameRate: 30},
    {id: 'uhd-60', label: '4K UHD  ·  60 fps', width: 3840, height: 2160, frameRate: 60},
    {id: 'vertical-1080', label: 'Vertical 1080x1920  ·  30 fps', width: 1080, height: 1920, frameRate: 30},
    {id: 'square-1080', label: 'Square 1080x1080  ·  30 fps', width: 1080, height: 1080, frameRate: 30}
];

export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_VIDEO_TRACKS = 3;
export const DEFAULT_AUDIO_TRACKS = 3;
export const MAX_TRACKS_PER_TYPE = 12;

// === Timeline === //
export const MIN_PIXELS_PER_SECOND = 2;
export const MAX_PIXELS_PER_SECOND = 1200;
export const DEFAULT_PIXELS_PER_SECOND = 80;
export const SNAP_DISTANCE_PX = 8;
export const MAX_HISTORY_STEPS = 100;

export const CLIP_LABELS: Record<string, string> = {
    violet: '#9b7bff',
    iris: '#6f8dff',
    cerulean: '#4fb6ff',
    mint: '#4fe0b0',
    forest: '#5cc26a',
    rose: '#ff7aa8',
    mango: '#ffb454',
    lavender: '#c2a4ff'
};

export const DEFAULT_SETTINGS: AppSettings = {
    theme: 'aurora',
    workspace: 'editing',
    layout: {},
    autosaveEnabled: true,
    autosaveIntervalMinutes: 5,
    autosaveMaxVersions: 20,
    autoProxy: true,
    proxyHeight: 540,
    stillDurationSeconds: 5,
    snapping: true,
    linkedSelection: true,
    lastProjectFolder: '',
    webAudio: true,
    projectTab: 'project'
};

/** The marker colors, with the names Premiere uses. */
export const MARKER_COLORS: { id: string; label: string; color: string }[] = [
    {id: 'green', label: 'Green', color: '#4fe0b0'},
    {id: 'red', label: 'Red', color: '#ff5d6c'},
    {id: 'purple', label: 'Purple', color: '#a98bff'},
    {id: 'orange', label: 'Orange', color: '#ffa84f'},
    {id: 'yellow', label: 'Yellow', color: '#ffd84f'},
    {id: 'white', label: 'White', color: '#f2f4ff'},
    {id: 'blue', label: 'Blue', color: '#5aa0ff'},
    {id: 'cyan', label: 'Cyan', color: '#4fd8ff'}
];

export const MIN_SPEED_PERCENT = 1;
export const MAX_SPEED_PERCENT = 10000;
