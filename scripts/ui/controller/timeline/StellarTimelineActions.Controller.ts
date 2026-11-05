import type {ClipEffect, MediaItem, Sequence} from '../../../common/stellar/StellarContract';
import {defaultEffectParams, findEffect} from '../../../common/stellar/StellarEffects';
import {MAX_PIXELS_PER_SECOND, MIN_PIXELS_PER_SECOND, MAX_TRACKS_PER_TYPE} from '../../../common/stellar/StellarConfig';
import {createId, snapToFrame} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence, getMedia, type ToolId} from '../project/StellarEditor.Store';
import {commitSequence, showToast} from '../project/StellarProject.Controller';
import {
    addClips, addTrack, clearRange, clipsUnderTime, extractRange, findClip, findTrack, liftClips, liftRange, linkClips, nextEditPoint, pasteClips,
    placeMedia, previousEditPoint, removeTrack, rippleDeleteClips, rippleTrimToTime, sequenceDuration, splitAllTracksAt,
    splitClipsAt, tracksOfType, unlinkClips, updateClips, updateTrack, withLinkedClips
} from './StellarTimeline.Controller';
import {seekTo} from '../playback/StellarPlayback.Controller';
import {addTransition, applySpeed} from './StellarClipEdit.Controller';
import {MARKER_COLORS} from '../../../common/stellar/StellarConfig';
import type {Marker} from '../../../common/stellar/StellarContract';

// The things a person can do to the timeline. Hotkeys, menus and right-click menus all call these.

function sequenceOrNull(): Sequence | null {
    return getActiveSequence();
}

function selectedIds(): string[] {
    const state = editorStore.get();
    const sequence = sequenceOrNull();

    if (!sequence) {
        return [];
    }

    return state.linkedSelection ? withLinkedClips(sequence, state.selection) : state.selection;
}

// === Selection === //

export function selectClips(ids: string[], additive = false): void {
    const state = editorStore.get();
    const sequence = sequenceOrNull();
    const expanded = sequence && state.linkedSelection ? withLinkedClips(sequence, ids) : ids;

    if (!additive) {
        editorStore.set({selection: expanded});
        return;
    }

    const current = new Set(state.selection);
    const allSelected = expanded.every((id) => current.has(id));

    for (const id of expanded) {
        if (allSelected) {
            current.delete(id);
        } else {
            current.add(id);
        }
    }

    editorStore.set({selection: [...current]});
}

export function selectAllClips(): void {
    const sequence = sequenceOrNull();

    editorStore.set({selection: sequence ? sequence.clips.map((clip) => clip.id) : []});
}

export function deselectAll(): void {
    editorStore.set({selection: []});
}

export function setTool(tool: ToolId): void {
    editorStore.set({tool});
}

export function toggleSnapping(): void {
    const snapping = !editorStore.get().snapping;

    editorStore.set({snapping});
    void window.api.updateSettings({snapping});
}

export function toggleLinkedSelection(): void {
    const linkedSelection = !editorStore.get().linkedSelection;

    editorStore.set({linkedSelection});
    void window.api.updateSettings({linkedSelection});
}

// === Cutting === //

/** Ctrl+K: cuts the selected clips at the playhead, or every clip under it if nothing is selected. */
export function addEditAtPlayhead(allTracks: boolean): void {
    const state = editorStore.get();
    const sequence = sequenceOrNull();

    if (!sequence) {
        return;
    }

    const time = state.playhead;

    commitSequence('Add edit', (current) => {
        if (allTracks) {
            return splitAllTracksAt(current, time);
        }

        const targets = clipsUnderTime(current, time, state.selection.length > 0 ? selectedIds() : undefined);

        return splitClipsAt(current, targets.filter((id) => !findTrack(current, findClip(current, id)?.trackId ?? '')?.locked), time);
    });
}

export function razorAt(time: number, allTracks: boolean, clipId: string | null): void {
    commitSequence('Razor', (current) => {
        if (allTracks) {
            return splitAllTracksAt(current, time);
        }

        return clipId ? splitClipsAt(current, [clipId], time) : current;
    });
}

// === Deleting === //

export function deleteSelection(ripple: boolean): void {
    const ids = selectedIds().filter((id) => !isLocked(id));

    if (ids.length === 0) {
        return;
    }

    commitSequence(ripple ? 'Ripple delete' : 'Delete', (current) => (ripple ? rippleDeleteClips(current, ids) : liftClips(current, ids)));
    editorStore.set({selection: []});
}

function isLocked(clipId: string): boolean {
    const sequence = sequenceOrNull();
    const clip = sequence ? findClip(sequence, clipId) : undefined;

    return clip && sequence ? (findTrack(sequence, clip.trackId)?.locked ?? false) : false;
}

/** Lift / extract the range between the in and out marks. */
export function removeInOutRange(ripple: boolean): void {
    const sequence = sequenceOrNull();

    if (!sequence || sequence.inPoint === null || sequence.outPoint === null || sequence.outPoint <= sequence.inPoint) {
        showToast('Set an In and an Out point first.');
        return;
    }

    const {inPoint, outPoint} = sequence;

    commitSequence(ripple ? 'Extract' : 'Lift', (current) => (ripple ? extractRange(current, inPoint, outPoint) : liftRange(current, inPoint, outPoint)));
}

// === Clipboard === //

export function copySelection(): void {
    const sequence = sequenceOrNull();

    if (!sequence) {
        return;
    }

    const ids = new Set(selectedIds());

    editorStore.set({clipboard: sequence.clips.filter((clip) => ids.has(clip.id))});
}

export function cutSelection(): void {
    copySelection();
    deleteSelection(false);
}

export function pasteAtPlayhead(mode: 'insert' | 'overwrite'): void {
    const state = editorStore.get();
    let newIds: string[] = [];

    commitSequence(mode === 'insert' ? 'Paste insert' : 'Paste', (current) => {
        const result = pasteClips(current, state.clipboard, state.playhead, mode);

        newIds = result.clipIds;

        return result.sequence;
    });

    editorStore.set({selection: newIds});
}

// === Moving the playhead === //

export function goToPreviousEdit(): void {
    const sequence = sequenceOrNull();

    if (sequence) {
        seekTo(previousEditPoint(sequence, editorStore.get().playhead));
    }
}

export function goToNextEdit(): void {
    const sequence = sequenceOrNull();

    if (sequence) {
        seekTo(nextEditPoint(sequence, editorStore.get().playhead));
    }
}

export function goToSequenceEnd(): void {
    const sequence = sequenceOrNull();

    if (sequence) {
        seekTo(sequenceDuration(sequence));
    }
}

// === Marks === //

export function markIn(): void {
    const time = editorStore.get().playhead;

    commitSequence('Mark in', (current) => ({
        ...current,
        inPoint: time,
        outPoint: current.outPoint !== null && current.outPoint <= time ? null : current.outPoint
    }));
}

export function markOut(): void {
    const time = editorStore.get().playhead;

    commitSequence('Mark out', (current) => ({
        ...current,
        outPoint: time,
        inPoint: current.inPoint !== null && current.inPoint >= time ? null : current.inPoint
    }));
}

export function clearInOut(): void {
    commitSequence('Clear in and out', (current) => ({...current, inPoint: null, outPoint: null}));
}

/** X: marks the in and out points around the selected clip. */
export function markClip(): void {
    const sequence = sequenceOrNull();
    const clip = sequence ? findClip(sequence, editorStore.get().selection[0] ?? '') : undefined;

    if (!clip) {
        return;
    }

    commitSequence('Mark clip', (current) => ({...current, inPoint: clip.start, outPoint: clip.start + clip.duration}));
}

export function addMarker(color: string = MARKER_COLORS[0].color, time: number = editorStore.get().playhead): string {
    const id = createId('marker');

    commitSequence('Add marker', (current) => ({
        ...current,
        markers: [...current.markers, {id, time, duration: 0, name: `Marker ${current.markers.length + 1}`, comment: '', color}]
    }));

    return id;
}

export function updateMarker(id: string, changes: Partial<Marker>): void {
    commitSequence('Edit marker', (current) => ({
        ...current,
        markers: current.markers.map((marker) => (marker.id === id ? {...marker, ...changes} : marker))
    }));
}

export function deleteMarker(id: string): void {
    commitSequence('Delete marker', (current) => ({...current, markers: current.markers.filter((marker) => marker.id !== id)}));
}

export function goToNextMarker(direction: 'previous' | 'next'): void {
    const sequence = sequenceOrNull();

    if (!sequence) {
        return;
    }

    const now = editorStore.get().playhead;
    const times = sequence.markers.map((marker) => marker.time).sort((first, second) => first - second);
    const target = direction === 'next' ? times.find((time) => time > now + 0.001) : [...times].reverse().find((time) => time < now - 0.001);

    if (target !== undefined) {
        seekTo(target);
    }
}

export function goToIn(): void {
    const mark = sequenceOrNull()?.inPoint;

    if (mark !== null && mark !== undefined) {
        seekTo(mark);
    }
}

export function goToOut(): void {
    const mark = sequenceOrNull()?.outPoint;

    if (mark !== null && mark !== undefined) {
        seekTo(mark);
    }
}

// === Putting media on the timeline === //

export function placeSourceOnTimeline(mediaId: string, mode: 'insert' | 'overwrite'): void {
    const state = editorStore.get();
    const media = getMedia(state, mediaId);

    if (!media) {
        showToast('Open a clip in the Source Monitor first.');
        return;
    }

    const marks = state.sourceMarks[mediaId];
    const sourceIn = marks?.inPoint ?? 0;
    const sourceOut = marks?.outPoint ?? media.duration;
    let newIds: string[] = [];

    commitSequence(mode === 'insert' ? 'Insert' : 'Overwrite', (current) => {
        const result = placeMedia(current, media, {
            mode, time: state.playhead, sourceIn, sourceOut,
            videoTrackId: state.targetVideoTrackId, audioTrackId: state.targetAudioTrackId,
            stillDuration: state.settings.stillDurationSeconds
        });

        newIds = result.clipIds;

        return result.sequence;
    });

    editorStore.set({selection: newIds});
}

/** Dropping media from the project panel onto a track. */
export function dropMediaOnTimeline(mediaId: string, time: number, trackId: string): void {
    const state = editorStore.get();
    const media = getMedia(state, mediaId);
    const sequence = sequenceOrNull();
    const track = sequence ? findTrack(sequence, trackId) : undefined;

    if (!media || !sequence || !track) {
        return;
    }

    const videoTrackId = track.type === 'video' ? trackId : state.targetVideoTrackId;
    const audioTrackId = track.type === 'audio' ? trackId : (state.targetAudioTrackId ?? tracksOfType(sequence, 'audio')[0]?.id ?? null);
    const start = Math.max(0, snapToFrame(time, sequence.settings.frameRate));
    const marks = state.sourceMarks[mediaId];
    let newIds: string[] = [];

    commitSequence(`Add ${media.name}`, (current) => {
        const result = placeMedia(current, media, {
            mode: 'overwrite', time: start, videoTrackId, audioTrackId,
            sourceIn: marks?.inPoint ?? 0, sourceOut: marks?.outPoint ?? media.duration,
            stillDuration: state.settings.stillDurationSeconds
        });

        newIds = result.clipIds;

        return result.sequence;
    });

    editorStore.set({selection: newIds});
}

export function appendMediaToTimeline(items: MediaItem[]): void {
    const state = editorStore.get();
    let time = sequenceOrNull() ? sequenceDuration(sequenceOrNull() as Sequence) : 0;

    commitSequence(`Add ${items.length} clip${items.length === 1 ? '' : 's'}`, (current) => {
        let sequence = current;

        for (const media of items) {
            const result = placeMedia(sequence, media, {
                mode: 'overwrite', time, sourceIn: 0, sourceOut: media.duration,
                videoTrackId: state.targetVideoTrackId, audioTrackId: state.targetAudioTrackId,
                stillDuration: state.settings.stillDurationSeconds
            });

            sequence = result.sequence;
            time += media.kind === 'image' ? state.settings.stillDurationSeconds : media.duration;
        }

        return sequence;
    });
}

// === Clip properties === //

export function toggleClipsEnabled(): void {
    const ids = selectedIds();

    if (ids.length === 0) {
        return;
    }

    commitSequence('Enable / disable clip', (current) => updateClips(current, ids, (clip) => ({...clip, enabled: !clip.enabled})));
}

export function nudgeSelection(direction: -1 | 1): void {
    const sequence = sequenceOrNull();
    const ids = selectedIds();

    if (!sequence || ids.length === 0) {
        return;
    }

    const frame = 1 / sequence.settings.frameRate;
    const earliest = Math.min(...sequence.clips.filter((clip) => ids.includes(clip.id)).map((clip) => clip.start));
    const delta = Math.max(direction * frame, -earliest);

    commitSequence('Nudge', (current) => {
        const moving = new Set(ids);
        let clips = current.clips.filter((clip) => !moving.has(clip.id));
        const moved = current.clips.filter((clip) => moving.has(clip.id)).map((clip) => ({...clip, start: clip.start + delta}));

        clips = addClips({...current, clips}, moved, 'overwrite', 0, 0).clips;

        return {...current, clips};
    });
}

export function linkSelection(): void {
    const ids = editorStore.get().selection;

    if (ids.length >= 2) {
        commitSequence('Link', (current) => linkClips(current, ids));
    }
}

export function unlinkSelection(): void {
    const ids = editorStore.get().selection;

    if (ids.length > 0) {
        commitSequence('Unlink', (current) => unlinkClips(current, ids));
    }
}

export function setClipLabel(label: string): void {
    const ids = selectedIds();

    commitSequence('Label', (current) => updateClips(current, ids, (clip) => ({...clip, label})));
}

export function rippleTrimAtPlayhead(direction: 'previous' | 'next'): void {
    const time = editorStore.get().playhead;

    commitSequence('Ripple trim', (current) => rippleTrimToTime(current, time, direction));
}

// === Effects === //

export function applyEffect(kind: string, clipIds?: string[]): void {
    const definition = findEffect(kind);
    const sequence = sequenceOrNull();

    if (!definition || !sequence) {
        return;
    }

    const targets = (clipIds ?? selectedIds()).filter((id) => {
        const clip = findClip(sequence, id);
        const track = clip ? findTrack(sequence, clip.trackId) : undefined;

        return track?.type === definition.appliesTo;
    });

    if (targets.length === 0) {
        showToast(`Select a ${definition.appliesTo} clip first.`);
        return;
    }

    if (definition.edge) {
        addTransition(kind, targets);
        return;
    }

    commitSequence(`Apply ${definition.label}`, (current) => updateClips(current, targets, (clip) => {
        if (clip.effects.some((effect) => effect.kind === kind) && definition.params.length === 0) {
            return clip;
        }

        const effect: ClipEffect = {id: createId('fx'), kind, enabled: true, params: defaultEffectParams(definition)};

        return {...clip, effects: [...clip.effects, effect]};
    }));
}

// === Tracks === //

export function addTrackOfType(type: 'video' | 'audio'): void {
    const sequence = sequenceOrNull();

    if (sequence && tracksOfType(sequence, type).length >= MAX_TRACKS_PER_TYPE) {
        showToast(`A sequence can have up to ${MAX_TRACKS_PER_TYPE} ${type} tracks.`);
        return;
    }

    commitSequence(`Add ${type} track`, (current) => addTrack(current, type));
}

export function deleteTrack(trackId: string): void {
    const sequence = sequenceOrNull();

    if (!sequence) {
        return;
    }

    const track = findTrack(sequence, trackId);

    if (track && tracksOfType(sequence, track.type).length <= 1) {
        showToast('A sequence needs at least one track of each kind.');
        return;
    }

    commitSequence('Delete track', (current) => removeTrack(current, trackId));
}

export function changeTrack(trackId: string, changes: Partial<{ muted: boolean; locked: boolean; solo: boolean; name: string; volumeDb: number; pan: number }>): void {
    commitSequence('Track settings', (current) => updateTrack(current, trackId, changes));
}

/** Mixer faders show the change while dragging. The last value is saved as one undo step. */
export function previewTrackMix(trackId: string, changes: Partial<{ volumeDb: number; pan: number }>): void {
    previewSequenceChange((current) => updateTrack(current, trackId, changes));
}

export function previewMasterDb(masterDb: number): void {
    previewSequenceChange((current) => ({...current, masterDb}));
}

export function setMasterDb(masterDb: number): void {
    cancelPreview();
    commitSequence('Master volume', (current) => ({...current, masterDb}));
}

// === Zoom === //

export function setZoom(pixelsPerSecond: number, anchorTime?: number, anchorViewportX?: number): void {
    const next = Math.max(MIN_PIXELS_PER_SECOND, Math.min(MAX_PIXELS_PER_SECOND, pixelsPerSecond));

    if (anchorTime === undefined || anchorViewportX === undefined) {
        editorStore.set({pixelsPerSecond: next});
        return;
    }

    // Keep the time under the cursor in the same place on the screen.
    editorStore.set({pixelsPerSecond: next, scrollX: Math.max(0, anchorTime * next - anchorViewportX)});
}

export function zoomIn(): void {
    setZoom(editorStore.get().pixelsPerSecond * 1.35);
}

export function zoomOut(): void {
    setZoom(editorStore.get().pixelsPerSecond / 1.35);
}

// The timeline view tells us how wide it is, so "zoom to sequence" works from a hotkey too.
let timelineViewportWidth = 800;

export function setTimelineViewportWidth(width: number): void {
    timelineViewportWidth = width;
}

export function zoomToFit(viewportWidth: number = timelineViewportWidth): void {
    const sequence = sequenceOrNull();
    const length = sequence ? Math.max(sequenceDuration(sequence), 5) : 30;

    editorStore.set({pixelsPerSecond: Math.max(MIN_PIXELS_PER_SECOND, Math.min(MAX_PIXELS_PER_SECOND, (viewportWidth - 40) / length)), scrollX: 0});
}

// === Changes that show while dragging, then become one undo step === //

/** Shows a change on screen without saving it. Call commitPreview() when the drag ends. */
export function previewSequenceChange(change: (sequence: Sequence) => Sequence): void {
    const active = sequenceOrNull();

    if (active) {
        editorStore.set({liveSequence: change(active)});
    }
}

export function commitPreview(label: string): void {
    const live = editorStore.get().liveSequence;

    if (!live) {
        return;
    }

    commitSequence(label, () => live);
}

export function cancelPreview(): void {
    editorStore.set({liveSequence: null, snapGuide: null});
}

/** Plays the selected clips faster or slower. 2 = twice as fast, so the clip becomes half as long. */
export function setClipSpeed(ids: string[], speed: number): void {
    applySpeed(ids, {speedPercent: speed * 100});
}

export function selectedClipIds(): string[] {
    return selectedIds();
}
