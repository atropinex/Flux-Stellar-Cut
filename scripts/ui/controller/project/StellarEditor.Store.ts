import type {Clip, MediaItem, PlaybackSource, ProjectDocument, Sequence} from '../../../common/stellar/StellarContract';
import type {AppSettings, Theme} from '../../../common/CommonInteface';
import type {KeybindMap} from '../../../common/stellar/StellarCommands';
import {DEFAULT_PIXELS_PER_SECOND, DEFAULT_SETTINGS} from '../../../common/stellar/StellarConfig';
import {createStore} from '../store/StellarStore';

export type ToolId = 'selection' | 'trackSelect' | 'ripple' | 'razor' | 'hand' | 'zoom' | 'pen';
export type DialogId = 'export' | 'settings' | 'newSequence' | 'newProject' | 'speed' | null;

export interface HistoryEntry {
    label: string;
    document: ProjectDocument;
}

export interface SourceMarks {
    inPoint: number | null;
    outPoint: number | null;
}

export interface EditorState {
    // the project
    projectPath: string | null;
    document: ProjectDocument | null;
    dirty: boolean;
    savedAt: number | null;
    autosavedAt: number | null;
    past: HistoryEntry[];
    future: HistoryEntry[];
    currentLabel: string;
    liveSequence: Sequence | null; // a timeline edit that is still being dragged

    // playback
    playhead: number;
    playing: boolean;
    rate: number;       // 1 = normal, negative = backwards
    loop: boolean;

    // timeline
    selection: string[];
    tool: ToolId;
    snapping: boolean;
    linkedSelection: boolean;
    pixelsPerSecond: number;
    scrollX: number;
    targetVideoTrackId: string | null;
    targetAudioTrackId: string | null;
    clipboard: Clip[];
    snapGuide: number | null;
    snapGuideKind: 'point' | 'grid' | null;

    // source monitor and project panel
    sourceMediaId: string | null;
    sourceTime: number;
    sourceMarks: Record<string, SourceMarks>;
    selectedMediaIds: string[];
    selectedBinId: string | null;

    // media helpers that are not saved in the project
    playbackSources: Record<string, PlaybackSource>;
    thumbnails: Record<string, string>;
    offline: Record<string, boolean>;

    // window
    theme: Theme | null;
    settings: AppSettings;
    keybinds: KeybindMap;
    workspace: string;
    layout: Record<string, number>;
    maximizedPanel: string | null;
    hoveredPanel: string | null;
    dialog: DialogId;
    toast: { id: number; message: string } | null;
}

export const editorStore = createStore<EditorState>({
    projectPath: null,
    document: null,
    dirty: false,
    savedAt: null,
    autosavedAt: null,
    past: [],
    future: [],
    currentLabel: 'Open project',
    liveSequence: null,

    playhead: 0,
    playing: false,
    rate: 1,
    loop: false,

    selection: [],
    tool: 'selection',
    snapping: true,
    linkedSelection: true,
    pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
    scrollX: 0,
    targetVideoTrackId: null,
    targetAudioTrackId: null,
    clipboard: [],
    snapGuide: null,
    snapGuideKind: null,

    sourceMediaId: null,
    sourceTime: 0,
    sourceMarks: {},
    selectedMediaIds: [],
    selectedBinId: null,

    playbackSources: {},
    thumbnails: {},
    offline: {},

    theme: null,
    settings: DEFAULT_SETTINGS,
    keybinds: {},
    workspace: 'editing',
    layout: {},
    maximizedPanel: null,
    hoveredPanel: null,
    dialog: null,
    toast: null
});

// === Reading the state === //

export function getActiveSequence(state: EditorState = editorStore.get()): Sequence | null {
    const document = state.document;

    if (!document) {
        return null;
    }

    return document.sequences.find((sequence) => sequence.id === document.activeSequenceId) ?? null;
}

/** The sequence the timeline shows: the one being dragged, or the saved one. */
export function getShownSequence(state: EditorState = editorStore.get()): Sequence | null {
    const active = getActiveSequence(state);

    if (state.liveSequence && active && state.liveSequence.id === active.id) {
        return state.liveSequence;
    }

    return active;
}

export function getMedia(state: EditorState, id: string): MediaItem | undefined {
    return state.document?.media.find((item) => item.id === id);
}
