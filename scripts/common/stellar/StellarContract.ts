// The shapes of everything that is saved in a project file or sent between the window and the app.
// Everything in here is plain data, so it can be written to YAML and read back without any conversion.

import type {Keyframe} from './StellarAnimation';
import type {ColorSettings} from './StellarColor';
import type {Mask} from './StellarMask';
import type {TextSettings} from './StellarText';

export const PROJECT_FILE_VERSION = 2;

export type MediaKind = 'video' | 'audio' | 'image';
export type TrackType = 'video' | 'audio';

export interface SequenceSettings {
    width: number;
    height: number;
    frameRate: number;
    sampleRate: number;
}

export interface Marker {
    id: string;
    time: number;
    duration: number;   // 0 for a point marker
    name: string;
    comment: string;
    color: string;      // a color from MARKER_COLORS
}

export interface Bin {
    id: string;
    name: string;
    parentId: string | null;
}

/** A file that was imported into the project. The file itself is never copied. */
export interface MediaItem {
    id: string;
    name: string;
    path: string;
    kind: MediaKind;
    binId: string | null;
    duration: number;       // seconds, stills use the default still duration
    width: number;
    height: number;
    frameRate: number;
    videoCodec: string | null;
    audioCodec: string | null;
    hasVideo: boolean;
    hasAudio: boolean;
    sampleRate: number;
    channels: number;
    fileSize: number;       // bytes
    container: string;
    importedAt: string;     // ISO date
    metadata: Record<string, string>; // fields the person typed in: title, description, scene, shot...
}

/** What the probe returns for one file, before it gets an id and a bin. */
export type MediaDescription = Omit<MediaItem, 'id' | 'binId' | 'importedAt'>;

export interface ProbeResult {
    path: string;
    media: MediaDescription | null;
    error: string | null;
}

export interface ClipMotion {
    x: number;          // pixels, relative to the center of the frame
    y: number;
    scale: number;      // percent
    rotation: number;   // degrees
    anchorX: number;    // pixels. The point that scale and rotation turn around, from the center of the clip's picture
    anchorY: number;
    opacity: number;    // percent
}

export interface ClipEffect {
    id: string;
    kind: string;       // key of an effect in StellarEffects.ts
    enabled: boolean;
    params: Record<string, number>;
}

export type FrameMode = 'sampling' | 'blending' | 'opticalFlow';

export interface Clip {
    id: string;
    trackId: string;
    mediaId: string;    // empty for a text clip or a nested sequence
    name: string;
    start: number;      // where the clip begins on the timeline, seconds
    inPoint: number;    // where it begins inside the source file, seconds
    duration: number;   // length on the timeline, seconds
    speed: number;      // 1 = normal. The clip uses duration * speed seconds of the source
    reverse: boolean;   // play the clip backwards
    frameMode: FrameMode; // how frames are made when the speed is not 1
    maintainPitch: boolean;
    motion: ClipMotion;
    volumeDb: number;
    pan: number;        // -100 left .. 100 right
    effects: ClipEffect[];
    keyframes: Record<string, Keyframe[]>; // property path -> keyframes. See StellarAnimation.ts
    color: ColorSettings;
    masks: Mask[];
    text: TextSettings | null; // set for a text clip
    nestId: string | null;     // set for a nested sequence: the id of the sequence inside
    linkId: string | null; // clips with the same link id move and trim together
    enabled: boolean;
    label: string;      // color label name
}

export interface Track {
    id: string;
    type: TrackType;
    name: string;
    muted: boolean;     // video: the eye is closed. audio: the speaker is off.
    locked: boolean;
    solo: boolean;
    volumeDb: number;   // audio tracks: the fader of the track mixer
    pan: number;        // audio tracks: -100 left .. 100 right
}

export interface Sequence {
    id: string;
    name: string;
    settings: SequenceSettings;
    tracks: Track[];    // video tracks first (V1, V2...), then audio tracks (A1, A2...)
    clips: Clip[];
    markers: Marker[];
    inPoint: number | null;
    outPoint: number | null;
    playhead: number;
    masterDb: number;   // the master fader of the mixer
}

export interface ProjectDocument {
    version: number;
    id: string;
    name: string;
    createdAt: string;
    modifiedAt: string;
    bins: Bin[];
    media: MediaItem[];
    sequences: Sequence[];
    activeSequenceId: string | null;
}

// === Launcher === //

export interface RecentProject {
    name: string;
    path: string;
    openedAt: string;
    exists: boolean;
}

export interface NewProjectOptions {
    name: string;
    folder: string;
    sequence: (SequenceSettings & { name: string }) | null; // null starts an empty project
}

export interface LaunchContext {
    view: 'launcher' | 'editor';
    projectPath: string | null;
}

export interface ProjectLoadResult {
    path: string;
    document: ProjectDocument;
    recoveryPath: string | null; // an autosave that is newer than the saved file
}

// === Media playback === //

export interface PlaybackSource {
    path: string;
    url: string;
    mode: 'original' | 'proxy' | 'building' | 'failed';
    progress: number; // 0..1 while a proxy is being built
}

export interface WaveformData {
    peaksPerSecond: number;
    peaks: string; // base64, one byte per peak
}

// === Export === //

export type RateControl = 'crf' | 'bitrate';
export type EncodeSpeed = 'fast' | 'medium' | 'slow';

export interface ExportSettings {
    formatId: string;
    outputPath: string;
    width: number;
    height: number;
    frameRate: number;
    rateControl: RateControl;
    crf: number;
    videoKbps: number;
    encodeSpeed: EncodeSpeed;
    audioKbps: number;
    sampleRate: number;
    channels: 1 | 2;
    range: 'sequence' | 'inOut';
    exportVideo: boolean;
    exportAudio: boolean;
    frameInterpolation: FrameMode; // how frames are made when the frame rate changes
    maxDepth: boolean;             // render at the highest bit depth the format has
    maxQuality: boolean;           // use the best (slowest) scaling
}

export interface ExportRequest {
    sequence: Sequence;
    media: Record<string, MediaItem>;
    settings: ExportSettings;
    /** Every sequence of the project, so that nested sequences can be found. */
    sequences?: Record<string, Sequence>;
    /** Pictures the page drew (text and masks) as base64 PNG. Keys are "text:<clipId>" and "mask:<clipId>". */
    inlineAssets?: Record<string, string>;
    /** The same pictures as files. The app writes them before the command is built. */
    assets?: Record<string, string>;
}

export interface ExportStartResult {
    ok: boolean;
    jobId: string | null;
    error: string | null;
}

export interface ExportProgress {
    jobId: string;
    status: 'running' | 'done' | 'error' | 'cancelled';
    percent: number;            // 0..100
    etaSeconds: number | null;
    speed: number | null;       // 2 = twice as fast as real time
    outputPath: string;
    message: string | null;     // the reason, when status is "error"
}

// === Themes === //

export const THEME_COLORS = [
    'ink', 'dim', 'accent', 'accentInk', 'surface', 'surfaceHover', 'line', 'deep',
    'danger', 'success', 'warning', 'videoClip', 'audioClip', 'imageClip', 'playhead', 'selection'
] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export type WindowMaterial = 'none' | 'mica' | 'acrylic' | 'tabbed';
