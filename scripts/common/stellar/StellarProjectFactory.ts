import {
    PROJECT_FILE_VERSION,
    type Bin,
    type Clip,
    type ClipMotion,
    type MediaItem,
    type ProjectDocument,
    type Sequence,
    type SequenceSettings,
    type Track,
    type TrackType
} from './StellarContract';
import {defaultColor, normalizeColor} from './StellarColor';
import {normalizeMask} from './StellarMask';
import {normalizeText} from './StellarText';
import {isEasingId, sortKeyframes, type Keyframe} from './StellarAnimation';
import {DEFAULT_AUDIO_TRACKS, DEFAULT_SAMPLE_RATE, DEFAULT_VIDEO_TRACKS} from './StellarConfig';
import {createId} from '../utils/StellarTimeHelper';

// Builds new, empty project data. Used by the app (new project) and by the page (new sequence).

export function createTrack(type: TrackType, number: number): Track {
    return {
        id: createId(type === 'video' ? 'v' : 'a'),
        type,
        name: `${type === 'video' ? 'V' : 'A'}${number}`,
        muted: false,
        locked: false,
        solo: false,
        volumeDb: 0,
        pan: 0
    };
}

export function createSequence(name: string, settings: Partial<SequenceSettings> & Pick<SequenceSettings, 'width' | 'height' | 'frameRate'>): Sequence {
    const tracks: Track[] = [];

    for (let index = 1; index <= DEFAULT_VIDEO_TRACKS; index += 1) {
        tracks.push(createTrack('video', index));
    }

    for (let index = 1; index <= DEFAULT_AUDIO_TRACKS; index += 1) {
        tracks.push(createTrack('audio', index));
    }

    return {
        id: createId('seq'),
        name,
        settings: {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            sampleRate: settings.sampleRate ?? DEFAULT_SAMPLE_RATE
        },
        tracks,
        clips: [],
        markers: [],
        inPoint: null,
        outPoint: null,
        playhead: 0,
        masterDb: 0
    };
}

/** The bins a new project starts with, like the ones Premiere's templates use. */
export const DEFAULT_BIN_NAMES = ['Audio', 'Footage', 'Graphics', 'Sequences'];

export function createDefaultBins(): Bin[] {
    return DEFAULT_BIN_NAMES.map((name) => ({id: createId('bin'), name, parentId: null}));
}

export function createEmptyProject(name: string, sequence: Sequence | null): ProjectDocument {
    const now = new Date().toISOString();

    return {
        version: PROJECT_FILE_VERSION,
        id: createId('proj'),
        name,
        createdAt: now,
        modifiedAt: now,
        bins: createDefaultBins(),
        media: [],
        sequences: sequence ? [sequence] : [],
        activeSequenceId: sequence ? sequence.id : null
    };
}

export function defaultMotion(): ClipMotion {
    return {x: 0, y: 0, scale: 100, rotation: 0, opacity: 100};
}

export function createClip(fields: Pick<Clip, 'trackId' | 'mediaId' | 'name' | 'start' | 'inPoint' | 'duration'> & Partial<Clip>): Clip {
    return {
        id: createId('clip'),
        speed: 1,
        reverse: false,
        frameMode: 'sampling',
        maintainPitch: true,
        motion: defaultMotion(),
        volumeDb: 0,
        pan: 0,
        effects: [],
        keyframes: {},
        color: defaultColor(),
        masks: [],
        text: null,
        nestId: null,
        linkId: null,
        enabled: true,
        label: 'iris',
        ...fields
    };
}

function normalizeKeyframes(raw: unknown): Record<string, Keyframe[]> {
    const result: Record<string, Keyframe[]> = {};

    if (!raw || typeof raw !== 'object') {
        return result;
    }

    for (const [path, list] of Object.entries(raw as Record<string, unknown>)) {
        if (!Array.isArray(list)) {
            continue;
        }

        const keyframes = list
            .filter((item) => item && typeof item.time === 'number' && typeof item.value === 'number')
            .map((item) => ({
                time: item.time,
                value: item.value,
                easing: isEasingId(item.easing) ? item.easing : 'linear'
            } as Keyframe));

        if (keyframes.length > 0) {
            result[path] = sortKeyframes(keyframes);
        }
    }

    return result;
}

export function normalizeMedia(item: MediaItem): MediaItem {
    return {...item, metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}};
}

/** Fixes a project that was edited by hand or saved by an older version. */
export function normalizeProject(raw: unknown): ProjectDocument {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('the file is not a Flux-Stellar-Cut project');
    }

    const source = raw as Partial<ProjectDocument>;
    const now = new Date().toISOString();

    const sequences = (Array.isArray(source.sequences) ? source.sequences : []).map((sequence) => ({
        ...sequence,
        tracks: (Array.isArray(sequence.tracks) ? sequence.tracks : []).map((track) => ({
            ...track,
            volumeDb: track.volumeDb ?? 0,
            pan: track.pan ?? 0
        })),
        masterDb: typeof sequence.masterDb === 'number' ? sequence.masterDb : 0,
        clips: (Array.isArray(sequence.clips) ? sequence.clips : []).map((clip) => ({
            ...createClip({
                trackId: clip.trackId, mediaId: clip.mediaId, name: clip.name,
                start: clip.start, inPoint: clip.inPoint, duration: clip.duration
            }),
            ...clip,
            motion: {...defaultMotion(), ...(clip.motion ?? {})},
            effects: Array.isArray(clip.effects) ? clip.effects : [],
            keyframes: normalizeKeyframes(clip.keyframes),
            color: normalizeColor(clip.color),
            masks: (Array.isArray(clip.masks) ? clip.masks : []).map(normalizeMask),
            text: normalizeText(clip.text)
        })),
        markers: (Array.isArray(sequence.markers) ? sequence.markers : []).map((marker) => ({
            ...marker,
            duration: marker.duration ?? 0,
            comment: marker.comment ?? ''
        })),
        inPoint: sequence.inPoint ?? null,
        outPoint: sequence.outPoint ?? null,
        playhead: sequence.playhead ?? 0
    }));

    const activeSequenceId = sequences.some((sequence) => sequence.id === source.activeSequenceId)
        ? (source.activeSequenceId as string)
        : (sequences[0]?.id ?? null);

    return {
        version: PROJECT_FILE_VERSION,
        id: source.id ?? createId('proj'),
        name: source.name ?? 'Untitled',
        createdAt: source.createdAt ?? now,
        modifiedAt: source.modifiedAt ?? now,
        bins: Array.isArray(source.bins) ? source.bins : [],
        media: (Array.isArray(source.media) ? source.media : []).map(normalizeMedia),
        sequences,
        activeSequenceId
    };
}
