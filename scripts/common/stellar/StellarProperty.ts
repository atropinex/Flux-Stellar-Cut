import type {Clip} from './StellarContract';
import {PATH, findKeyframeIndex, removeKeyframeAt, setKeyframe, valueAt} from './StellarAnimation';
import {COLOR_PARAMS, normalizeColor, type ColorSettings} from './StellarColor';
import {findEffect} from './StellarEffects';
import {contentTime} from './StellarEvaluate';

// Every number on a clip that can be changed in the effect controls has a "path" such as "motion.scale".
// This file reads and writes those numbers, with or without keyframes.

export interface PropertyInfo {
    path: string;
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
    decimals: number;
    default: number;
}

function info(path: string, label: string, min: number, max: number, step: number, unit: string, defaultValue: number): PropertyInfo {
    return {path, label, min, max, step, unit, decimals: step < 1 ? (step < 0.1 ? 2 : 1) : 0, default: defaultValue};
}

export function propertyInfo(clip: Clip, path: string): PropertyInfo | null {
    switch (path) {
        case PATH.x:
            return info(path, 'Position X', -8000, 8000, 1, 'px', 0);
        case PATH.y:
            return info(path, 'Position Y', -8000, 8000, 1, 'px', 0);
        case PATH.scale:
            return info(path, 'Scale', 1, 800, 0.5, '%', 100);
        case PATH.rotation:
            return info(path, 'Rotation', -3600, 3600, 0.5, '°', 0);
        case PATH.anchorX:
            return info(path, 'Anchor Point X', -8000, 8000, 1, 'px', 0);
        case PATH.anchorY:
            return info(path, 'Anchor Point Y', -8000, 8000, 1, 'px', 0);
        case PATH.opacity:
            return info(path, 'Opacity', 0, 100, 0.5, '%', 100);
        case PATH.volume:
            return info(path, 'Level', -60, 15, 0.5, ' dB', 0);
        case PATH.pan:
            return info(path, 'Pan', -100, 100, 1, '', 0);
        default:
            break;
    }

    if (path.startsWith('color.')) {
        const param = COLOR_PARAMS.find((item) => item.key === path.slice(6));

        return param ? info(path, param.label, param.min, param.max, param.step, param.unit, param.default) : null;
    }

    if (path.startsWith('effect.')) {
        const [, effectId, key] = path.split('.');
        const effect = clip.effects.find((item) => item.id === effectId);
        const param = effect ? findEffect(effect.kind)?.params.find((item) => item.key === key) : undefined;

        return param ? info(path, param.label, param.min, param.max, param.step, param.unit, param.default) : null;
    }

    return null;
}

/** The plain value, which is what shows when the property has no keyframes. */
export function readBase(clip: Clip, path: string): number {
    switch (path) {
        case PATH.x:
            return clip.motion.x;
        case PATH.y:
            return clip.motion.y;
        case PATH.scale:
            return clip.motion.scale;
        case PATH.rotation:
            return clip.motion.rotation;
        case PATH.anchorX:
            return clip.motion.anchorX ?? 0;
        case PATH.anchorY:
            return clip.motion.anchorY ?? 0;
        case PATH.opacity:
            return clip.motion.opacity;
        case PATH.volume:
            return clip.volumeDb;
        case PATH.pan:
            return clip.pan ?? 0;
        default:
            break;
    }

    if (path.startsWith('color.')) {
        return normalizeColor(clip.color)[path.slice(6) as keyof ColorSettings] as number;
    }

    if (path.startsWith('effect.')) {
        const [, effectId, key] = path.split('.');

        return clip.effects.find((item) => item.id === effectId)?.params[key] ?? 0;
    }

    return 0;
}

export function writeBase(clip: Clip, path: string, value: number): Clip {
    switch (path) {
        case PATH.x:
            return {...clip, motion: {...clip.motion, x: value}};
        case PATH.y:
            return {...clip, motion: {...clip.motion, y: value}};
        case PATH.scale:
            return {...clip, motion: {...clip.motion, scale: value}};
        case PATH.rotation:
            return {...clip, motion: {...clip.motion, rotation: value}};
        case PATH.anchorX:
            return {...clip, motion: {...clip.motion, anchorX: value}};
        case PATH.anchorY:
            return {...clip, motion: {...clip.motion, anchorY: value}};
        case PATH.opacity:
            return {...clip, motion: {...clip.motion, opacity: value}};
        case PATH.volume:
            return {...clip, volumeDb: value};
        case PATH.pan:
            return {...clip, pan: value};
        default:
            break;
    }

    if (path.startsWith('color.')) {
        return {...clip, color: {...normalizeColor(clip.color), [path.slice(6)]: value}};
    }

    if (path.startsWith('effect.')) {
        const [, effectId, key] = path.split('.');

        return {...clip, effects: clip.effects.map((item) => (item.id === effectId ? {...item, params: {...item.params, [key]: value}} : item))};
    }

    return clip;
}

export function isAnimatedProperty(clip: Clip, path: string): boolean {
    return (clip.keyframes?.[path]?.length ?? 0) > 0;
}

/** The time on the timeline, held inside the clip, so keyframes are never placed outside of it. */
function insideClip(clip: Clip, timelineTime: number): number {
    return Math.min(clip.start + clip.duration, Math.max(clip.start, timelineTime));
}

/** The value of a property as it is at a time on the timeline. */
export function readValueAt(clip: Clip, path: string, timelineTime: number): number {
    return valueAt(clip.keyframes?.[path], readBase(clip, path), contentTime(clip, timelineTime));
}

/**
 * Sets a property. When the property has keyframes, the keyframe at the playhead is changed (or created),
 * because that is what the person expects when they change a number on an animated property.
 */
export function writeValueAt(clip: Clip, path: string, value: number, timelineTime: number): Clip {
    if (!isAnimatedProperty(clip, path)) {
        return writeBase(clip, path, value);
    }

    const time = contentTime(clip, insideClip(clip, timelineTime));

    return {...clip, keyframes: {...clip.keyframes, [path]: setKeyframe(clip.keyframes[path], time, value)}};
}

/** The stopwatch: starts animating (one keyframe at the playhead) or stops (all keyframes go, the value stays). */
export function toggleAnimation(clip: Clip, path: string, timelineTime: number): Clip {
    if (isAnimatedProperty(clip, path)) {
        const current = readValueAt(clip, path, timelineTime);
        const keyframes = {...clip.keyframes};

        delete keyframes[path];

        return writeBase({...clip, keyframes}, path, current);
    }

    const time = contentTime(clip, insideClip(clip, timelineTime));
    const value = readBase(clip, path);

    return {...clip, keyframes: {...clip.keyframes, [path]: setKeyframe(undefined, time, value)}};
}

/** The diamond button: adds a keyframe at the playhead, or removes the one that is there. */
export function toggleKeyframe(clip: Clip, path: string, timelineTime: number): Clip {
    const time = contentTime(clip, insideClip(clip, timelineTime));
    const existing = clip.keyframes?.[path];

    if (existing && findKeyframeIndex(existing, time) >= 0) {
        const remaining = removeKeyframeAt(existing, time);
        const keyframes = {...clip.keyframes};

        if (remaining.length === 0) {
            delete keyframes[path];

            return writeBase({...clip, keyframes}, path, readValueAt(clip, path, timelineTime));
        }

        keyframes[path] = remaining;

        return {...clip, keyframes};
    }

    const value = readValueAt(clip, path, timelineTime);

    return {...clip, keyframes: {...clip.keyframes, [path]: setKeyframe(existing, time, value)}};
}

/** The timeline time of a keyframe. */
export function keyframeTimelineTime(clip: Clip, contentSeconds: number): number {
    const seconds = (contentSeconds - clip.inPoint) / Math.max(1e-6, clip.speed);

    return clip.reverse ? clip.start + clip.duration - seconds : clip.start + seconds;
}
