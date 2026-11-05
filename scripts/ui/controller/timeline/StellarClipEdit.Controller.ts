import type {Clip, FrameMode, Sequence} from '../../../common/stellar/StellarContract';
import {PATH, moveKeyframe, nextKeyframeTime, previousKeyframeTime, removeKeyframeAt, setKeyframeEasing, type EasingId} from '../../../common/stellar/StellarAnimation';
import {defaultColor, normalizeColor, type ColorSettings} from '../../../common/stellar/StellarColor';
import {findEffect} from '../../../common/stellar/StellarEffects';
import {contentTime} from '../../../common/stellar/StellarEvaluate';
import type {Mask} from '../../../common/stellar/StellarMask';
import {createClip} from '../../../common/stellar/StellarProjectFactory';
import {
    isAnimatedProperty, keyframeTimelineTime, propertyInfo, readValueAt, toggleAnimation, toggleKeyframe, writeBase, writeValueAt
} from '../../../common/stellar/StellarProperty';
import {DEFAULT_TEXT_DURATION, defaultText, type TextSettings} from '../../../common/stellar/StellarText';
import {MAX_SPEED_PERCENT, MIN_SPEED_PERCENT} from '../../../common/stellar/StellarConfig';
import {createId} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence, getMedia} from '../project/StellarEditor.Store';
import {commitSequence} from '../project/StellarProject.Controller';
import {seekTo} from '../playback/StellarPlayback.Controller';
import {addClips, clearRange, findClip, findTrack, tracksOfType, updateClips, withLinkedClips} from './StellarTimeline.Controller';
import {cancelPreview, previewSequenceChange} from './StellarTimelineActions.Controller';

// Changing the numbers of a clip: motion, volume, color, effects, speed, text and masks.
// Every change has a "live" form (shows on screen while dragging) and a "commit" form (one undo step).

function playhead(): number {
    return editorStore.get().playhead;
}

function expand(ids: string[]): string[] {
    const sequence = getActiveSequence();

    return sequence ? withLinkedClips(sequence, ids) : ids;
}

/** Shows a change to some clips without saving it. */
function live(ids: string[], change: (clip: Clip) => Clip): void {
    previewSequenceChange((current) => updateClips(current, ids, change));
}

function commitChange(label: string, ids: string[], change: (clip: Clip) => Clip): void {
    cancelPreview();
    commitSequence(label, (current) => updateClips(current, ids, change));
}

// === Numbers, with keyframes === //

export function previewProperty(ids: string[], path: string, value: number): void {
    const time = playhead();

    live(ids, (clip) => writeValueAt(clip, path, value, time));
}

export function commitProperty(ids: string[], path: string, value: number): void {
    const time = playhead();
    const sequence = getActiveSequence();
    const label = sequence && ids[0] ? propertyInfo(findClip(sequence, ids[0]) as Clip, path)?.label : undefined;

    commitChange(`Change ${(label ?? 'value').toLowerCase()}`, ids, (clip) => writeValueAt(clip, path, value, time));
}

export function resetProperty(ids: string[], path: string): void {
    const time = playhead();

    commitChange('Reset value', ids, (clip) => {
        const info = propertyInfo(clip, path);

        return info ? writeValueAt(clip, path, info.default, time) : clip;
    });
}

/** The stopwatch button. */
export function toggleAnimationOf(clipId: string, path: string): void {
    const time = playhead();
    const sequence = getActiveSequence();
    const clip = sequence ? findClip(sequence, clipId) : undefined;
    const turningOff = clip ? isAnimatedProperty(clip, path) : false;

    commitChange(turningOff ? 'Stop animating' : 'Start animating', [clipId], (target) => toggleAnimation(target, path, time));
}

/** The diamond button. */
export function toggleKeyframeOf(clipId: string, path: string): void {
    const time = playhead();

    commitChange('Toggle keyframe', [clipId], (clip) => toggleKeyframe(clip, path, time));
}

/** Moves a keyframe in time, from the little timeline next to the numbers. */
export function moveKeyframeOf(clipId: string, path: string, fromContentTime: number, toContentTime: number, isFinal: boolean): void {
    const change = (clip: Clip): Clip => {
        const list = clip.keyframes?.[path];

        return list ? {...clip, keyframes: {...clip.keyframes, [path]: moveKeyframe(list, fromContentTime, toContentTime)}} : clip;
    };

    if (isFinal) {
        commitChange('Move keyframe', [clipId], change);
    } else {
        live([clipId], change);
    }
}

export function setEasingOf(clipId: string, path: string, atContentTime: number, easing: EasingId): void {
    commitChange('Change easing', [clipId], (clip) => {
        const list = clip.keyframes?.[path];

        return list ? {...clip, keyframes: {...clip.keyframes, [path]: setKeyframeEasing(list, atContentTime, easing)}} : clip;
    });
}

export function deleteKeyframeOf(clipId: string, path: string, atContentTime: number): void {
    commitChange('Delete keyframe', [clipId], (clip) => {
        const list = clip.keyframes?.[path];

        if (!list) {
            return clip;
        }

        const remaining = removeKeyframeAt(list, atContentTime);
        const keyframes = {...clip.keyframes};

        if (remaining.length === 0) {
            delete keyframes[path];

            return writeBase({...clip, keyframes}, path, list[0].value);
        }

        keyframes[path] = remaining;

        return {...clip, keyframes};
    });
}

/** The arrows next to the diamond: go to the previous or next keyframe. */
export function jumpToKeyframe(clipId: string, path: string, direction: 'previous' | 'next'): void {
    const sequence = getActiveSequence();
    const clip = sequence ? findClip(sequence, clipId) : undefined;

    if (!clip) {
        return;
    }

    const now = contentTime(clip, playhead());
    const list = clip.keyframes?.[path];
    const forwardInContent = !clip.reverse;
    const wantsHigher = (direction === 'next') === forwardInContent;
    const target = wantsHigher ? nextKeyframeTime(list, now) : previousKeyframeTime(list, now);

    if (target !== null) {
        seekTo(keyframeTimelineTime(clip, target));
    }
}

/** What a property is at the playhead, for the numbers and for the keyframe buttons. */
export function valueOfProperty(clip: Clip, path: string): number {
    return readValueAt(clip, path, playhead());
}

// === Effects === //

export function toggleEffectOf(ids: string[], effectId: string): void {
    commitChange('Toggle effect', ids, (clip) => ({...clip, effects: clip.effects.map((item) => (item.id === effectId ? {...item, enabled: !item.enabled} : item))}));
}

export function removeEffectOf(ids: string[], effectId: string): void {
    commitChange('Remove effect', ids, (clip) => {
        const keyframes = {...clip.keyframes};

        for (const path of Object.keys(keyframes)) {
            if (path.startsWith(`effect.${effectId}.`)) {
                delete keyframes[path];
            }
        }

        return {...clip, keyframes, effects: clip.effects.filter((item) => item.id !== effectId)};
    });
}

/** Changes how long a transition is. It can never be longer than the clip. */
export function setTransitionDuration(clipId: string, effectId: string, seconds: number, isFinal: boolean): void {
    const change = (clip: Clip): Clip => {
        const length = Math.max(0.05, Math.min(seconds, clip.duration));

        return {...clip, effects: clip.effects.map((item) => (item.id === effectId ? {...item, params: {...item.params, duration: length}} : item))};
    };

    if (isFinal) {
        commitChange('Change transition length', [clipId], change);
    } else {
        live([clipId], change);
    }
}

/** Puts a transition on the start or the end of clips. A clip has only one transition at each end. */
export function addTransition(kind: string, clipIds: string[]): boolean {
    const definition = findEffect(kind);
    const sequence = getActiveSequence();

    if (!definition || !definition.edge || !sequence) {
        return false;
    }

    const targets = clipIds.filter((id) => {
        const clip = findClip(sequence, id);

        return clip && findTrack(sequence, clip.trackId)?.type === definition.appliesTo;
    });

    if (targets.length === 0) {
        return false;
    }

    commitChange(`Add ${definition.label}`, targets, (clip) => {
        const kept = clip.effects.filter((effect) => findEffect(effect.kind)?.edge !== definition.edge);
        const defaults: Record<string, number> = {duration: Math.min(1, clip.duration / 2)};

        return {...clip, effects: [...kept, {id: createId('fx'), kind, enabled: true, params: defaults}]};
    });

    return true;
}

// === Speed === //

export interface SpeedOptions {
    speedPercent?: number;
    reverse?: boolean;
    frameMode?: FrameMode;
    maintainPitch?: boolean;
    ripple?: boolean;
}

/**
 * Speed, direction and the way frames are made. Clips that are linked change together.
 * A faster clip gets shorter and a slower clip longer. With ripple, the clips after it slide along.
 */
export function applySpeed(ids: string[], options: SpeedOptions, label = 'Change speed'): void {
    const state = editorStore.get();
    const targetIds = new Set(expand(ids));

    cancelPreview();
    commitSequence(label, (current) => {
        let clips = current.clips;

        for (const id of targetIds) {
            const clip = clips.find((item) => item.id === id);

            if (!clip) {
                continue;
            }

            const media = getMedia(state, clip.mediaId);
            const isFixedLength = media?.kind === 'image' || Boolean(clip.text) || Boolean(clip.nestId);
            const percent = options.speedPercent === undefined ? clip.speed * 100 : Math.min(MAX_SPEED_PERCENT, Math.max(MIN_SPEED_PERCENT, options.speedPercent));
            const speed = isFixedLength ? 1 : percent / 100;
            let duration = (clip.duration * clip.speed) / speed;

            // The clip cannot use more of the file than there is.
            if (media && media.kind !== 'image') {
                const available = clip.reverse ? clip.inPoint + clip.duration * clip.speed : media.duration - clip.inPoint;
                const wanted = clip.duration * clip.speed;

                if (!clip.reverse && wanted > available) {
                    duration = Math.max(0.04, available / speed);
                }
            }

            const changed: Clip = {
                ...clip,
                speed,
                duration,
                reverse: options.reverse ?? clip.reverse,
                frameMode: options.frameMode ?? clip.frameMode,
                maintainPitch: options.maintainPitch ?? clip.maintainPitch
            };
            const oldEnd = clip.start + clip.duration;
            const newEnd = changed.start + changed.duration;
            const others = clips.filter((item) => item.id !== id);

            if (options.ripple && Math.abs(newEnd - oldEnd) > 1e-6) {
                const delta = newEnd - oldEnd;

                clips = [
                    ...others.map((item) => {
                        const slides = item.trackId === clip.trackId && item.start >= oldEnd - 1e-6 && !targetIds.has(item.id);

                        return slides ? {...item, start: Math.max(0, item.start + delta)} : item;
                    }),
                    changed
                ];
            } else {
                clips = [...clearRange(others, clip.trackId, changed.start, newEnd, targetIds), changed];
            }
        }

        return {...current, clips};
    });
}

/** The Speed / Duration dialog can also be asked for a length instead of a percentage. */
export function speedPercentForDuration(clip: Clip, seconds: number): number {
    return ((clip.duration * clip.speed) / Math.max(0.04, seconds)) * 100;
}

// === Color === //

export function updateColor(ids: string[], change: Partial<ColorSettings>, isFinal: boolean, label = 'Color'): void {
    const apply = (clip: Clip): Clip => ({...clip, color: {...normalizeColor(clip.color), ...change}});

    if (isFinal) {
        commitChange(label, ids, apply);
    } else {
        live(ids, apply);
    }
}

export function resetColor(ids: string[]): void {
    commitChange('Reset color', ids, (clip) => {
        const keyframes = {...clip.keyframes};

        for (const path of Object.keys(keyframes)) {
            if (path.startsWith('color.')) {
                delete keyframes[path];
            }
        }

        return {...clip, keyframes, color: defaultColor()};
    });
}

// === Text === //

export function updateText(ids: string[], change: Partial<TextSettings>, isFinal: boolean): void {
    const apply = (clip: Clip): Clip => (clip.text ? {...clip, text: {...clip.text, ...change}} : clip);

    if (isFinal) {
        commitChange('Change text', ids, apply);
    } else {
        live(ids, apply);
    }
}

/** Puts a new text clip on the top video track at the playhead, in free space if there is any. */
export function addTextClip(content = 'Your Title Here'): string | null {
    const sequence = getActiveSequence();

    if (!sequence) {
        return null;
    }

    const time = playhead();
    const videoTracks = tracksOfType(sequence, 'video').filter((track) => !track.locked);
    const isFree = (trackId: string) => !sequence.clips.some((clip) => clip.trackId === trackId && clip.start < time + DEFAULT_TEXT_DURATION && clip.start + clip.duration > time);
    const track = [...videoTracks].reverse().find((item) => isFree(item.id)) ?? videoTracks[videoTracks.length - 1];

    if (!track) {
        return null;
    }

    const clip = createClip({
        trackId: track.id, mediaId: '', name: 'Title', start: time, inPoint: 0, duration: DEFAULT_TEXT_DURATION,
        text: defaultText(content), label: 'rose'
    });

    commitSequence('Add text', (current) => addClips(current, [clip], 'overwrite', time, DEFAULT_TEXT_DURATION));
    editorStore.set({selection: [clip.id]});

    return clip.id;
}

// === Masks === //

export function addMask(clipId: string, mask: Mask): void {
    commitChange('Add mask', [clipId], (clip) => ({...clip, masks: [...(clip.masks ?? []), mask]}));
}

export function updateMask(clipId: string, maskId: string, change: Partial<Mask>, isFinal: boolean): void {
    const apply = (clip: Clip): Clip => ({...clip, masks: (clip.masks ?? []).map((mask) => (mask.id === maskId ? {...mask, ...change} : mask))});

    if (isFinal) {
        commitChange('Change mask', [clipId], apply);
    } else {
        live([clipId], apply);
    }
}

export function removeMask(clipId: string, maskId: string): void {
    commitChange('Delete mask', [clipId], (clip) => ({...clip, masks: (clip.masks ?? []).filter((mask) => mask.id !== maskId)}));
}

// === Small helpers for the views === //

export function activeClip(sequence: Sequence | null, ids: string[]): Clip | undefined {
    return sequence && ids[0] ? findClip(sequence, ids[0]) : undefined;
}

export {PATH};

/** Opens the small Speed / Duration window for the selected clips. */
export function openSpeedDialog(): void {
    if (editorStore.get().selection.length === 0) {
        return;
    }

    editorStore.set({dialog: 'speed'});
}
