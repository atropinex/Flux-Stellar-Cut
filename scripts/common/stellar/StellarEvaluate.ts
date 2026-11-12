import type {Clip, ClipEffect, ClipMotion} from './StellarContract';
import {PATH, valueAt} from './StellarAnimation';
import {COLOR_PARAMS, normalizeColor, type ColorSettings} from './StellarColor';
import {findEffect} from './StellarEffects';

// Works out what a clip looks like at one moment, with every keyframe applied.
// The preview calls this for every frame, and the tests call it to check the export.

export type ClipSourceKind = 'media' | 'text' | 'nest';

export function clipSourceKind(clip: Clip): ClipSourceKind {
    if (clip.text) {
        return 'text';
    }

    return clip.nestId ? 'nest' : 'media';
}

/**
 * The time inside the clip's content (its source) for a time on the timeline. Keyframes use this time.
 * A reversed clip is read from its end to its start, so its content time goes down while the timeline goes up.
 */
export function contentTime(clip: Clip, timelineTime: number): number {
    if (clip.reverse) {
        return clip.inPoint + (clip.duration - (timelineTime - clip.start)) * clip.speed;
    }

    return clip.inPoint + (timelineTime - clip.start) * clip.speed;
}

/** The time to read from the source file. */
export function sourceReadTime(clip: Clip, timelineTime: number): number {
    return contentTime(clip, timelineTime);
}

export interface ResolvedEffect {
    id: string;
    kind: string;
    params: Record<string, number>;
}

export interface ResolvedClip {
    motion: ClipMotion;
    volumeDb: number;
    pan: number;
    effects: ResolvedEffect[];
    color: ColorSettings;
}

export function resolveClip(clip: Clip, timelineTime: number): ResolvedClip {
    const time = contentTime(clip, timelineTime);
    const keyframes = clip.keyframes ?? {};

    const motion: ClipMotion = {
        x: valueAt(keyframes[PATH.x], clip.motion.x, time),
        y: valueAt(keyframes[PATH.y], clip.motion.y, time),
        scale: valueAt(keyframes[PATH.scale], clip.motion.scale, time),
        rotation: valueAt(keyframes[PATH.rotation], clip.motion.rotation, time),
        anchorX: valueAt(keyframes[PATH.anchorX], clip.motion.anchorX ?? 0, time),
        anchorY: valueAt(keyframes[PATH.anchorY], clip.motion.anchorY ?? 0, time),
        opacity: valueAt(keyframes[PATH.opacity], clip.motion.opacity, time)
    };

    const effects: ResolvedEffect[] = [];

    for (const effect of clip.effects) {
        if (!effect.enabled || !findEffect(effect.kind)) {
            continue;
        }

        const params: Record<string, number> = {};

        for (const [key, plain] of Object.entries(effect.params)) {
            params[key] = valueAt(keyframes[PATH.effect(effect.id, key)], plain, time);
        }

        effects.push({id: effect.id, kind: effect.kind, params});
    }

    const color = normalizeColor(clip.color);

    for (const param of COLOR_PARAMS) {
        const list = keyframes[PATH.color(param.key)];

        if (list && list.length > 0) {
            (color as unknown as Record<string, number>)[param.key] = valueAt(list, color[param.key] as number, time);
        }
    }

    return {
        motion,
        volumeDb: valueAt(keyframes[PATH.volume], clip.volumeDb, time),
        pan: valueAt(keyframes[PATH.pan], clip.pan ?? 0, time),
        effects,
        color
    };
}

// === Transitions === //

export interface TransitionAmounts {
    dipBlack: number;   // 0 = no dip, 1 = all black
    dipWhite: number;
    dissolve: number;   // 1 = fully visible, 0 = gone
    audio: number;      // volume factor
}

/** How far the transitions at the ends of a clip have come at a time on the timeline. */
export function transitionAmounts(clip: Clip, timelineTime: number): TransitionAmounts {
    const amounts: TransitionAmounts = {dipBlack: 0, dipWhite: 0, dissolve: 1, audio: 1};

    for (const effect of clip.effects) {
        const definition = findEffect(effect.kind);

        if (!effect.enabled || !definition || !definition.edge || !definition.style) {
            continue;
        }

        const duration = Math.max(0.01, effect.params['duration'] ?? 1);
        const progress = definition.edge === 'in'
            ? (timelineTime - clip.start) / duration
            : (clip.start + clip.duration - timelineTime) / duration;
        const done = Math.min(1, Math.max(0, progress));

        switch (definition.style) {
            case 'dipBlack':
                amounts.dipBlack = Math.max(amounts.dipBlack, 1 - done);
                break;
            case 'dipWhite':
                amounts.dipWhite = Math.max(amounts.dipWhite, 1 - done);
                break;
            case 'dissolve':
                amounts.dissolve = Math.min(amounts.dissolve, done);
                break;
            case 'audioFade':
                amounts.audio = Math.min(amounts.audio, done);
                break;
        }
    }

    return amounts;
}

/** The transitions of a clip at one end, in the order they were added. */
export function transitionsOf(clip: Clip, edge: 'in' | 'out'): ClipEffect[] {
    return clip.effects.filter((effect) => findEffect(effect.kind)?.edge === edge);
}
