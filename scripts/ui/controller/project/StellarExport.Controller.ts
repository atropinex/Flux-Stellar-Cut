import type {Clip, ExportProgress, ExportSettings, MediaItem, Sequence} from '../../../common/stellar/StellarContract';
import {collectGeneratedClips} from '../../../common/stellar/StellarExportCommand';
import {activeMasks} from '../../../common/stellar/StellarMask';
import {renderMaskCanvas, renderTextCanvas, toBase64Png} from '../graphics/StellarGraphics';
import {
    EXPORT_PRESETS,
    findExportFormat,
    type ExportFormat,
    type ExportPreset
} from '../../../common/stellar/StellarExportFormats';
import {createStore} from '../store/StellarStore';
import {editorStore, getActiveSequence} from './StellarEditor.Store';
import {sequenceDuration} from '../timeline/StellarTimeline.Controller';

// Starts an export and keeps its progress, so the dialog can be closed and opened again while it runs.

export interface ExportJobState {
    jobId: string | null;
    progress: ExportProgress | null;
    starting: boolean;
    error: string | null;
}

export const exportStore = createStore<ExportJobState>({jobId: null, progress: null, starting: false, error: null});

let listening = false;

function listen(): void {
    if (listening) {
        return;
    }

    listening = true;

    window.api.onExportProgress((progress) => {
        if (progress.jobId !== exportStore.get().jobId) {
            return;
        }

        exportStore.set({progress, error: progress.status === 'error' ? progress.message : null});
    });
}

export function isExportRunning(): boolean {
    return exportStore.get().progress?.status === 'running' || exportStore.get().starting;
}

/** Starting values for the dialog, taken from the sequence. */
export function defaultExportSettings(): ExportSettings | null {
    const sequence = getActiveSequence();

    if (!sequence) {
        return null;
    }

    const format = findExportFormat('h264') as ExportFormat;

    return {
        formatId: format.id,
        outputPath: '',
        width: sequence.settings.width,
        height: sequence.settings.height,
        frameRate: sequence.settings.frameRate,
        rateControl: 'crf',
        crf: format.defaultCrf,
        videoKbps: format.defaultVideoKbps,
        encodeSpeed: 'medium',
        audioKbps: 192,
        sampleRate: sequence.settings.sampleRate,
        channels: 2,
        range: sequence.inPoint !== null && sequence.outPoint !== null ? 'inOut' : 'sequence',
        exportVideo: format.type !== 'audio',
        exportAudio: format.type !== 'animation',
        frameInterpolation: 'sampling',
        maxDepth: false,
        maxQuality: false
    };
}

/** Applies a preset (YouTube 1080p, Vertical...) to the settings. */
export function applyPreset(settings: ExportSettings, preset: ExportPreset): ExportSettings {
    const sequence = getActiveSequence();
    const format = findExportFormat(settings.formatId);

    if (!sequence || !format) {
        return settings;
    }

    return {
        ...settings,
        width: preset.width ?? sequence.settings.width,
        height: preset.height ?? sequence.settings.height,
        frameRate: preset.frameRate ?? sequence.settings.frameRate,
        crf: preset.crf ?? format.defaultCrf,
        videoKbps: preset.videoKbps ?? format.defaultVideoKbps,
        audioKbps: preset.audioKbps
    };
}

export function presetsFor(formatId: string): ExportPreset[] {
    return EXPORT_PRESETS.filter((preset) => preset.formatIds === null || preset.formatIds.includes(formatId));
}

/** Seconds that will be rendered, for the size estimate. */
export function exportLength(settings: ExportSettings): number {
    const sequence = getActiveSequence();

    if (!sequence) {
        return 0;
    }

    if (settings.range === 'inOut' && sequence.inPoint !== null && sequence.outPoint !== null) {
        return Math.max(0, sequence.outPoint - sequence.inPoint);
    }

    return sequenceDuration(sequence);
}

const MASK_MAX_WIDTH = 1280; // masks are soft, so they do not need to be as big as the frame

function sequencesById(sequences: Sequence[]): Record<string, Sequence> {
    return Object.fromEntries(sequences.map((sequence) => [sequence.id, sequence]));
}

/** The size of the picture a mask is drawn for: the same shape as the clip's picture. */
function maskSizeFor(clip: Clip, media: Record<string, MediaItem>, sequences: Record<string, Sequence>, settings: ExportSettings): {
    width: number;
    height: number
} {
    const item = media[clip.mediaId];
    const inner = clip.nestId ? sequences[clip.nestId]?.settings : undefined;
    const sourceWidth = clip.text ? settings.width : item?.width ?? inner?.width ?? settings.width;
    const sourceHeight = clip.text ? settings.height : item?.height ?? inner?.height ?? settings.height;
    const ratio = Math.min(1, MASK_MAX_WIDTH / Math.max(1, sourceWidth));

    return {width: Math.max(2, Math.round(sourceWidth * ratio)), height: Math.max(2, Math.round(sourceHeight * ratio))};
}

/** Draws every text and mask picture of the sequence (and of the sequences nested in it) for the export. */
function drawInlineAssets(
    sequence: Sequence, media: Record<string, MediaItem>, sequences: Record<string, Sequence>, settings: ExportSettings
): Record<string, string> {
    const assets: Record<string, string> = {};
    const generated = collectGeneratedClips(sequence, sequences);

    for (const clip of generated.text) {
        if (clip.text) {
            assets[`text:${clip.id}`] = toBase64Png(renderTextCanvas(clip.text, settings.width, settings.height));
        }
    }

    for (const clip of generated.masked) {
        const size = maskSizeFor(clip, media, sequences, settings);

        assets[`mask:${clip.id}`] = toBase64Png(renderMaskCanvas(activeMasks(clip.masks), size.width, size.height, true));
    }

    return assets;
}

/** Every sequence that the exported one reaches through nesting, itself included. */
function reachableSequences(root: Sequence, all: Sequence[]): Sequence[] {
    const byId = sequencesById(all);
    const found = new Map<string, Sequence>([[root.id, root]]);
    const queue: Sequence[] = [root];

    while (queue.length > 0) {
        const current = queue.shift() as Sequence;

        for (const clip of current.clips) {
            const inner = clip.nestId ? byId[clip.nestId] : undefined;

            if (inner && !found.has(inner.id)) {
                found.set(inner.id, inner);
                queue.push(inner);
            }
        }
    }

    return [...found.values()];
}

export async function startExport(settings: ExportSettings): Promise<void> {
    const state = editorStore.get();
    const sequence = getActiveSequence(state);

    if (!sequence || !state.document) {
        return;
    }

    listen();

    const reachable = reachableSequences(sequence, state.document.sequences);
    const sequences = sequencesById(reachable);
    const media: Record<string, MediaItem> = {};

    for (const current of reachable) {
        for (const clip of current.clips) {
            const item = state.document.media.find((candidate) => candidate.id === clip.mediaId);

            if (item) {
                media[item.id] = item;
            }
        }
    }

    exportStore.set({jobId: null, progress: null, starting: true, error: null});

    let inlineAssets: Record<string, string>;

    try {
        inlineAssets = drawInlineAssets(sequence, media, sequences, settings);
    } catch (error) {
        exportStore.set({
            starting: false,
            error: `The text and masks could not be drawn: ${error instanceof Error ? error.message : String(error)}`
        });
        return;
    }

    const result = await window.api.startExport({sequence, media, settings, sequences, inlineAssets});

    if (!result.ok || !result.jobId) {
        exportStore.set({starting: false, error: result.error ?? 'The export could not start.'});
        return;
    }

    exportStore.set({
        jobId: result.jobId,
        starting: false,
        progress: {
            jobId: result.jobId,
            status: 'running',
            percent: 0,
            etaSeconds: null,
            speed: null,
            outputPath: settings.outputPath,
            message: null
        }
    });
}

export function cancelExport(): void {
    const jobId = exportStore.get().jobId;

    if (jobId) {
        window.api.cancelExport(jobId);
    }
}

export function resetExportState(): void {
    if (!isExportRunning()) {
        exportStore.set({jobId: null, progress: null, starting: false, error: null});
    }
}
