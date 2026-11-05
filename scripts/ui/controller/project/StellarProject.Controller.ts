import type {Bin, Clip, MediaItem, ProjectDocument, Sequence, SequenceSettings} from '../../../common/stellar/StellarContract';
import {MAX_HISTORY_STEPS} from '../../../common/stellar/StellarConfig';
import {createSequence} from '../../../common/stellar/StellarProjectFactory';
import {createId} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence, type HistoryEntry} from './StellarEditor.Store';
import {tracksOfType} from '../timeline/StellarTimeline.Controller';

// Opening, saving and changing the project. Every change goes through commit(), so every change can be undone.

let toastCounter = 0;

export function showToast(message: string): void {
    toastCounter += 1;
    const id = toastCounter;

    editorStore.set({toast: {id, message}});

    window.setTimeout(() => {
        if (editorStore.get().toast?.id === id) {
            editorStore.set({toast: null});
        }
    }, 3200);
}

// === Opening and closing === //

export async function openProjectFile(path: string): Promise<boolean> {
    try {
        const result = await window.api.loadProject(path);
        let document = result.document;
        let dirty = false;
        let message = '';

        if (result.recoveryPath) {
            const useAutosave = window.confirm(
                'Flux-Stellar-Cut found an auto-save that is newer than this project.\n\nOpen the auto-save instead? (Press Cancel to open the saved project.)'
            );

            if (useAutosave) {
                document = await window.api.readProjectFile(result.recoveryPath);
                dirty = true;
                message = 'Recovered from auto-save. Save to keep it.';
            }
        }

        loadDocument(path, document, dirty);

        if (message) {
            showToast(message);
        }

        return true;
    } catch (error) {
        window.alert(`Could not open the project.\n\n${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export function loadDocument(path: string | null, document: ProjectDocument, dirty: boolean): void {
    const sequence = document.sequences.find((item) => item.id === document.activeSequenceId) ?? document.sequences[0] ?? null;
    const videoTrack = sequence ? tracksOfType(sequence, 'video')[0] : null;
    const audioTrack = sequence ? tracksOfType(sequence, 'audio')[0] : null;

    editorStore.set({
        projectPath: path,
        document,
        dirty,
        savedAt: dirty ? null : Date.now(),
        past: [],
        future: [],
        currentLabel: 'Open project',
        liveSequence: null,
        playhead: sequence?.playhead ?? 0,
        playing: false,
        selection: [],
        targetVideoTrackId: videoTrack?.id ?? null,
        targetAudioTrackId: audioTrack?.id ?? null,
        sourceMediaId: null,
        selectedMediaIds: []
    });

    void refreshOfflineState();
}

export async function refreshOfflineState(): Promise<void> {
    const document = editorStore.get().document;

    if (!document || document.media.length === 0) {
        editorStore.set({offline: {}});
        return;
    }

    const exists = await window.api.checkFiles(document.media.map((item) => item.path));
    const offline: Record<string, boolean> = {};

    for (const item of document.media) {
        offline[item.id] = exists[item.path] === false;
    }

    editorStore.set({offline});
}

// === Saving === //

export async function saveProject(): Promise<boolean> {
    const state = editorStore.get();

    if (!state.document) {
        return false;
    }

    if (!state.projectPath) {
        return saveProjectAs();
    }

    try {
        const document = documentForSaving(state.document);

        await window.api.saveProject(state.projectPath, document);
        editorStore.set({dirty: false, savedAt: Date.now()});
        showToast('Project saved');

        return true;
    } catch (error) {
        window.alert(`Could not save the project.\n\n${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

export async function saveProjectAs(): Promise<boolean> {
    const state = editorStore.get();

    if (!state.document) {
        return false;
    }

    const path = await window.api.saveProjectAs(documentForSaving(state.document));

    if (!path) {
        return false;
    }

    editorStore.set({projectPath: path, dirty: false, savedAt: Date.now()});
    showToast('Project saved');

    return true;
}

/** The playhead is stored in the sequence so the project opens where you left it. */
export function documentForSaving(document: ProjectDocument): ProjectDocument {
    const state = editorStore.get();

    return {
        ...document,
        modifiedAt: new Date().toISOString(),
        sequences: document.sequences.map((sequence) => {
            return sequence.id === document.activeSequenceId ? {...sequence, playhead: state.playhead} : sequence;
        })
    };
}

/** Asks about unsaved changes. Returns false if the user cancels. */
export async function confirmDiscardOrSave(): Promise<boolean> {
    const state = editorStore.get();

    if (!state.dirty || !state.document) {
        return true;
    }

    const wantsSave = window.confirm(`Save changes to "${state.document.name}" before closing?\n\nOK = Save   Cancel = choose again`);

    if (wantsSave) {
        return saveProject();
    }

    return window.confirm('Close without saving? Your changes will be lost.');
}

export async function closeProject(): Promise<void> {
    if (await confirmDiscardOrSave()) {
        window.api.closeProjectToLauncher();
    }
}

// === Changing the project (with undo) === //

/** Applies a change to the project and remembers the old version so it can be undone. */
export function commit(label: string, change: (document: ProjectDocument) => ProjectDocument): void {
    const state = editorStore.get();

    if (!state.document) {
        return;
    }

    const next = change(state.document);

    if (next === state.document) {
        return;
    }

    const entry: HistoryEntry = {label: state.currentLabel, document: state.document};
    const past = [...state.past, entry].slice(-MAX_HISTORY_STEPS);

    editorStore.set({document: next, past, future: [], currentLabel: label, dirty: true, liveSequence: null});
}

/** Changes the active sequence. */
export function commitSequence(label: string, change: (sequence: Sequence) => Sequence): void {
    commit(label, (document) => {
        const active = document.sequences.find((sequence) => sequence.id === document.activeSequenceId);

        if (!active) {
            return document;
        }

        const next = change(active);

        if (next === active) {
            return document;
        }

        return {...document, sequences: document.sequences.map((sequence) => (sequence.id === active.id ? next : sequence))};
    });
}

export function undo(): void {
    const state = editorStore.get();
    const previous = state.past[state.past.length - 1];

    if (!previous || !state.document) {
        return;
    }

    const future = [{label: state.currentLabel, document: state.document}, ...state.future];

    editorStore.set({
        document: previous.document, past: state.past.slice(0, -1), future, currentLabel: previous.label,
        dirty: true, liveSequence: null, selection: keepExistingSelection(previous.document, state.selection)
    });
}

export function redo(): void {
    const state = editorStore.get();
    const next = state.future[0];

    if (!next || !state.document) {
        return;
    }

    const past = [...state.past, {label: state.currentLabel, document: state.document}];

    editorStore.set({
        document: next.document, past, future: state.future.slice(1), currentLabel: next.label,
        dirty: true, liveSequence: null, selection: keepExistingSelection(next.document, state.selection)
    });
}

/** Jumps to any step in the history list. */
export function jumpToHistory(index: number): void {
    const state = editorStore.get();
    const currentIndex = state.past.length;

    for (let step = currentIndex; step > index; step -= 1) {
        undo();
    }

    for (let step = currentIndex; step < index; step += 1) {
        redo();
    }
}

function keepExistingSelection(document: ProjectDocument, selection: string[]): string[] {
    const sequence = document.sequences.find((item) => item.id === document.activeSequenceId);
    const ids = new Set(sequence?.clips.map((clip: Clip) => clip.id) ?? []);

    return selection.filter((id) => ids.has(id));
}

// === Bins, media and sequences === //

export function addBin(name: string, parentId: string | null): string {
    const bin: Bin = {id: createId('bin'), name, parentId};

    commit('New bin', (document) => ({...document, bins: [...document.bins, bin]}));

    return bin.id;
}

export function renameBin(id: string, name: string): void {
    commit('Rename bin', (document) => ({...document, bins: document.bins.map((bin) => (bin.id === id ? {...bin, name} : bin))}));
}

export function renameMedia(id: string, name: string): void {
    commit('Rename', (document) => ({...document, media: document.media.map((item) => (item.id === id ? {...item, name} : item))}));
}

/** Saves the fields from the metadata panel (title, description, scene...) on some media. An empty text removes the field. */
export function setMediaMetadata(mediaIds: string[], fields: Record<string, string>): void {
    const ids = new Set(mediaIds);

    commit('Edit metadata', (document) => ({
        ...document,
        media: document.media.map((item) => {
            if (!ids.has(item.id)) {
                return item;
            }

            const metadata = {...(item.metadata ?? {}), ...fields};

            for (const key of Object.keys(metadata)) {
                if (metadata[key] === '') {
                    delete metadata[key];
                }
            }

            return {...item, metadata};
        })
    }));
}

export function renameSequence(id: string, name: string): void {
    commit('Rename sequence', (document) => ({...document, sequences: document.sequences.map((item) => (item.id === id ? {...item, name} : item))}));
}

export function moveMediaToBin(mediaIds: string[], binId: string | null): void {
    const ids = new Set(mediaIds);

    commit('Move to bin', (document) => ({...document, media: document.media.map((item) => (ids.has(item.id) ? {...item, binId} : item))}));
}

/** Deletes a bin. Its contents move up to the parent bin. */
export function deleteBin(id: string): void {
    commit('Delete bin', (document) => {
        const bin = document.bins.find((item) => item.id === id);

        if (!bin) {
            return document;
        }

        return {
            ...document,
            bins: document.bins.filter((item) => item.id !== id).map((item) => (item.parentId === id ? {...item, parentId: bin.parentId} : item)),
            media: document.media.map((item) => (item.binId === id ? {...item, binId: bin.parentId} : item))
        };
    });
}

/** Removes media from the project and every clip that uses it. */
export function deleteMedia(ids: string[]): void {
    const remove = new Set(ids);

    commit('Delete media', (document) => ({
        ...document,
        media: document.media.filter((item) => !remove.has(item.id)),
        sequences: document.sequences.map((sequence) => ({...sequence, clips: sequence.clips.filter((clip) => !remove.has(clip.mediaId))}))
    }));

    const state = editorStore.get();

    editorStore.set({
        selectedMediaIds: state.selectedMediaIds.filter((id) => !remove.has(id)),
        sourceMediaId: state.sourceMediaId && remove.has(state.sourceMediaId) ? null : state.sourceMediaId
    });
}

export function addSequence(name: string, settings: SequenceSettings): string {
    const sequence = createSequence(name, settings);

    commit('New sequence', (document) => ({...document, sequences: [...document.sequences, sequence], activeSequenceId: sequence.id}));
    activateSequence(sequence.id);

    return sequence.id;
}

export function activateSequence(id: string): void {
    const document = editorStore.get().document;
    const sequence = document?.sequences.find((item) => item.id === id);

    if (!document || !sequence) {
        return;
    }

    const videoTrack = tracksOfType(sequence, 'video')[0];
    const audioTrack = tracksOfType(sequence, 'audio')[0];

    editorStore.set({
        document: {...document, activeSequenceId: id},
        playhead: sequence.playhead,
        playing: false,
        selection: [],
        liveSequence: null,
        targetVideoTrackId: videoTrack?.id ?? null,
        targetAudioTrackId: audioTrack?.id ?? null
    });
}

export function deleteSequence(id: string): void {
    const document = editorStore.get().document;

    if (!document || document.sequences.length <= 1) {
        showToast('A project needs at least one sequence to edit.');
        return;
    }

    commit('Delete sequence', (current) => {
        const sequences = current.sequences.filter((item) => item.id !== id);

        return {...current, sequences, activeSequenceId: current.activeSequenceId === id ? sequences[0].id : current.activeSequenceId};
    });
    activateSequence(editorStore.get().document?.activeSequenceId ?? '');
}

/** Premiere's "New Sequence From Clip": a sequence that matches the clip, with the clip already in it. */
export function sequenceSettingsFromMedia(media: MediaItem): SequenceSettings {
    const hasPicture = media.hasVideo && media.width > 0;

    return {
        width: hasPicture ? media.width : 1920,
        height: hasPicture ? media.height : 1080,
        frameRate: media.frameRate > 0 ? media.frameRate : 24,
        sampleRate: media.sampleRate > 0 ? media.sampleRate : 48000
    };
}

export function requireActiveSequence(): Sequence | null {
    return getActiveSequence();
}
