import type {MediaItem, MediaKind} from '../../../common/stellar/StellarContract';
import {createId} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence, getMedia} from './StellarEditor.Store';
import {addSequence, commit, commitSequence, sequenceSettingsFromMedia, showToast} from './StellarProject.Controller';
import {placeMedia} from '../timeline/StellarTimeline.Controller';

// Importing files, and keeping thumbnails and smooth-playback copies for them.

let proxyListenerStarted = false;

/** Listens for finished playback copies. Called once when the editor starts. */
export function startMediaListeners(): void {
    if (proxyListenerStarted) {
        return;
    }

    proxyListenerStarted = true;

    window.api.onProxyProgress((source) => {
        editorStore.set((state) => ({playbackSources: {...state.playbackSources, [source.path]: source}}));
    });
}

export async function importWithDialog(binId: string | null): Promise<void> {
    const paths = await window.api.importDialog();

    if (paths.length > 0) {
        await importPaths(paths, binId);
    }
}

/** Where a file goes when nobody picked a bin: audio to "Audio", pictures to "Graphics", video to "Footage". */
function defaultBinFor(bins: {
    id: string;
    name: string;
    parentId: string | null
}[], kind: MediaKind, hasVideo: boolean): string | null {
    const wanted = kind === 'audio' ? 'Audio' : kind === 'image' ? 'Graphics' : hasVideo ? 'Footage' : 'Audio';

    return bins.find((bin) => bin.parentId === null && bin.name === wanted)?.id ?? null;
}

export async function importPaths(paths: string[], binId: string | null): Promise<void> {
    const state = editorStore.get();

    if (!state.document) {
        return;
    }

    const known = new Set(state.document.media.map((item) => item.path));
    const fresh = paths.filter((path) => !known.has(path));

    if (fresh.length === 0) {
        showToast('That media is already in the project.');
        return;
    }

    showToast(`Importing ${fresh.length} file${fresh.length === 1 ? '' : 's'}...`);

    const results = await window.api.probeMedia(fresh);
    const imported: MediaItem[] = [];
    const failed: string[] = [];

    for (const result of results) {
        if (result.media) {
            const target = binId ?? defaultBinFor(state.document.bins, result.media.kind, result.media.hasVideo);

            imported.push({
                ...result.media,
                id: createId('media'),
                binId: target,
                importedAt: new Date().toISOString(),
                metadata: {}
            });
        } else {
            failed.push(`${result.path}: ${result.error ?? 'unknown error'}`);
        }
    }

    if (imported.length > 0) {
        commit(`Import ${imported.length} file${imported.length === 1 ? '' : 's'}`, (document) => ({
            ...document,
            media: [...document.media, ...imported]
        }));
        editorStore.set({selectedMediaIds: imported.map((item) => item.id)});
        void prepareMedia(imported);
        showToast(`Imported ${imported.length} file${imported.length === 1 ? '' : 's'}`);
    }

    if (failed.length > 0) {
        window.alert(`These files could not be imported:\n\n${failed.join('\n')}`);
    }
}

/** Loads thumbnails and playback copies for media. Runs in the background. */
export async function prepareMedia(items: MediaItem[]): Promise<void> {
    await Promise.all(items.map((item) => prepareOne(item.path, item.kind, item.duration)));
}

async function prepareOne(path: string, kind: MediaKind, duration: number): Promise<void> {
    const [thumbnail, source] = await Promise.all([
        window.api.getThumbnail(path, kind, duration),
        window.api.getPlaybackSource(path, kind)
    ]);

    editorStore.set((state) => ({
        thumbnails: thumbnail ? {...state.thumbnails, [path]: thumbnail} : state.thumbnails,
        playbackSources: {...state.playbackSources, [path]: source}
    }));
}

export async function prepareAllMedia(): Promise<void> {
    const document = editorStore.get().document;

    if (document) {
        await prepareMedia(document.media);
    }
}

/** The address the page should play for a file: the original, or its smooth-playback copy. */
export function playbackUrlFor(path: string): string | null {
    const source = editorStore.get().playbackSources[path];

    if (!source || source.mode === 'building' || source.mode === 'failed') {
        return null;
    }

    return source.url;
}

export async function relinkMedia(mediaId: string): Promise<void> {
    const media = getMedia(editorStore.get(), mediaId);

    if (!media) {
        return;
    }

    const newPath = await window.api.relinkDialog(media.path);

    if (!newPath) {
        return;
    }

    const [result] = await window.api.probeMedia([newPath]);

    if (!result?.media) {
        window.alert(`That file cannot be used: ${result?.error ?? 'unknown error'}`);
        return;
    }

    const description = result.media;

    commit('Relink media', (document) => ({
        ...document,
        media: document.media.map((item) => (item.id === mediaId ? {
            ...item, ...description,
            name: item.name,
            path: newPath
        } : item))
    }));

    const updated = getMedia(editorStore.get(), mediaId);

    if (updated) {
        void prepareMedia([updated]);
    }

    editorStore.set((state) => ({offline: {...state.offline, [mediaId]: false}}));
}

// === Source monitor and sequences from media === //

export function openInSource(mediaId: string): void {
    editorStore.set({sourceMediaId: mediaId, sourceTime: 0});
    window.dispatchEvent(new CustomEvent('stellar:show-source'));
}

/** "New Sequence From Clip": a sequence with the clip's size and frame rate, with the clip already placed. */
export function createSequenceFromMedia(mediaId: string): void {
    const media = getMedia(editorStore.get(), mediaId);

    if (!media) {
        return;
    }

    const name = media.name.replace(/\.[^.]+$/, '');

    addSequence(name, sequenceSettingsFromMedia(media));

    const sequence = getActiveSequence();

    if (!sequence) {
        return;
    }

    const state = editorStore.get();

    commitSequence('Add clip to new sequence', (current) => placeMedia(current, media, {
        mode: 'overwrite', time: 0, sourceIn: 0, sourceOut: media.duration,
        videoTrackId: state.targetVideoTrackId, audioTrackId: state.targetAudioTrackId,
        stillDuration: state.settings.stillDurationSeconds
    }).sequence);
}
