// Keyframes and easing. Used by the effect controls, the preview and the export.
//
// A keyframe time is in "content seconds": the position inside the source of the clip.
// Because of that, trimming, moving or splitting a clip never has to move its keyframes.

export type EasingId =
    | 'linear' | 'hold' | 'easeIn' | 'easeOut' | 'easeInOut'
    | 'cubicIn' | 'cubicOut' | 'cubicInOut' | 'backOut';

export interface Keyframe {
    time: number;   // content seconds
    value: number;
    easing: EasingId; // how the value travels from this keyframe to the next one
}

export interface EasingDefinition {
    id: EasingId;
    label: string;
    description: string;
}

export const EASINGS: EasingDefinition[] = [
    { id: 'linear', label: 'Linear', description: 'Constant speed' },
    { id: 'hold', label: 'Hold', description: 'Stays until the next keyframe, then jumps' },
    { id: 'easeIn', label: 'Ease In', description: 'Starts slow' },
    { id: 'easeOut', label: 'Ease Out', description: 'Ends slow' },
    { id: 'easeInOut', label: 'Ease In Out', description: 'Slow at both ends' },
    { id: 'cubicIn', label: 'Cubic In', description: 'Starts very slow' },
    { id: 'cubicOut', label: 'Cubic Out', description: 'Ends very slow' },
    { id: 'cubicInOut', label: 'Cubic In Out', description: 'Very slow at both ends' },
    { id: 'backOut', label: 'Overshoot', description: 'Goes past the value, then settles' }
];

export const DEFAULT_EASING: EasingId = 'linear';

export function isEasingId(value: unknown): value is EasingId {
    return EASINGS.some((easing) => easing.id === value);
}

/** Turns a straight 0..1 progress into an eased 0..1 progress. */
export function applyEasing(id: EasingId, progress: number): number {
    const p = Math.min(1, Math.max(0, progress));

    switch (id) {
        case 'hold':
            return 0;
        case 'easeIn':
            return p * p;
        case 'easeOut':
            return 1 - (1 - p) * (1 - p);
        case 'easeInOut':
            return p < 0.5 ? 2 * p * p : 1 - ((2 - 2 * p) * (2 - 2 * p)) / 2;
        case 'cubicIn':
            return p * p * p;
        case 'cubicOut':
            return 1 - (1 - p) * (1 - p) * (1 - p);
        case 'cubicInOut':
            return p < 0.5 ? 4 * p * p * p : 1 - ((2 - 2 * p) * (2 - 2 * p) * (2 - 2 * p)) / 2;
        case 'backOut': {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const q = p - 1;

            return 1 + c3 * q * q * q + c1 * q * q;
        }
        default:
            return p;
    }
}

/** The same curves as an ffmpeg expression. "P" is the straight progress. */
function easingExpression(id: EasingId, progress: string): string {
    const p = `(${progress})`;

    switch (id) {
        case 'hold':
            return '0';
        case 'easeIn':
            return `${p}*${p}`;
        case 'easeOut':
            return `(1-(1-${p})*(1-${p}))`;
        case 'easeInOut':
            return `if(lt(${p},0.5),2*${p}*${p},1-(2-2*${p})*(2-2*${p})/2)`;
        case 'cubicIn':
            return `${p}*${p}*${p}`;
        case 'cubicOut':
            return `(1-(1-${p})*(1-${p})*(1-${p}))`;
        case 'cubicInOut':
            return `if(lt(${p},0.5),4*${p}*${p}*${p},1-(2-2*${p})*(2-2*${p})*(2-2*${p})/2)`;
        case 'backOut':
            return `(1+2.70158*(${p}-1)*(${p}-1)*(${p}-1)+1.70158*(${p}-1)*(${p}-1))`;
        default:
            return p;
    }
}

// === Reading a value === //

export function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
    return [...keyframes].sort((first, second) => first.time - second.time);
}

/** The value of an animated property at a time. With no keyframes the plain value is returned. */
export function valueAt(keyframes: Keyframe[] | undefined, plainValue: number, time: number): number {
    if (!keyframes || keyframes.length === 0) {
        return plainValue;
    }

    const sorted = keyframes;

    if (time <= sorted[0].time) {
        return sorted[0].value;
    }

    const last = sorted[sorted.length - 1];

    if (time >= last.time) {
        return last.value;
    }

    for (let index = 0; index < sorted.length - 1; index += 1) {
        const from = sorted[index];
        const to = sorted[index + 1];

        if (time >= from.time && time < to.time) {
            const progress = (time - from.time) / Math.max(1e-9, to.time - from.time);

            return from.value + (to.value - from.value) * applyEasing(from.easing, progress);
        }
    }

    return last.value;
}

// === Editing keyframes. All of these return a new list. === //

const SAME_TIME = 1 / 240; // two keyframes closer than this are the same keyframe

export function findKeyframeIndex(keyframes: Keyframe[] | undefined, time: number, tolerance = SAME_TIME): number {
    if (!keyframes) {
        return -1;
    }

    return keyframes.findIndex((keyframe) => Math.abs(keyframe.time - time) <= tolerance);
}

/** Adds a keyframe, or changes the value of the one that is already at that time. */
export function setKeyframe(keyframes: Keyframe[] | undefined, time: number, value: number, easing?: EasingId): Keyframe[] {
    const list = keyframes ? [...keyframes] : [];
    const index = findKeyframeIndex(list, time);

    if (index >= 0) {
        list[index] = {...list[index], value, easing: easing ?? list[index].easing};
    } else {
        list.push({time, value, easing: easing ?? DEFAULT_EASING});
    }

    return sortKeyframes(list);
}

export function removeKeyframeAt(keyframes: Keyframe[] | undefined, time: number): Keyframe[] {
    return (keyframes ?? []).filter((keyframe) => Math.abs(keyframe.time - time) > SAME_TIME);
}

export function moveKeyframe(keyframes: Keyframe[], fromTime: number, toTime: number): Keyframe[] {
    const index = findKeyframeIndex(keyframes, fromTime);

    if (index < 0) {
        return keyframes;
    }

    const moved = {...keyframes[index], time: toTime};
    const others = keyframes.filter((_, position) => position !== index).filter((keyframe) => Math.abs(keyframe.time - toTime) > SAME_TIME);

    return sortKeyframes([...others, moved]);
}

export function setKeyframeEasing(keyframes: Keyframe[], time: number, easing: EasingId): Keyframe[] {
    return keyframes.map((keyframe) => (Math.abs(keyframe.time - time) <= SAME_TIME ? {...keyframe, easing} : keyframe));
}

export function nextKeyframeTime(keyframes: Keyframe[] | undefined, time: number): number | null {
    const next = (keyframes ?? []).find((keyframe) => keyframe.time > time + SAME_TIME);

    return next ? next.time : null;
}

export function previousKeyframeTime(keyframes: Keyframe[] | undefined, time: number): number | null {
    const before = (keyframes ?? []).filter((keyframe) => keyframe.time < time - SAME_TIME);

    return before.length > 0 ? before[before.length - 1].time : null;
}

// === ffmpeg === //

function numberText(value: number): string {
    return String(Number(value.toFixed(6)));
}

/**
 * An ffmpeg expression for an animated value.
 * timeExpression is the content time in seconds, for example "(t*1.5+2)".
 */
export function keyframeExpression(keyframes: Keyframe[] | undefined, plainValue: number, timeExpression: string): string {
    if (!keyframes || keyframes.length === 0) {
        return numberText(plainValue);
    }

    if (keyframes.length === 1) {
        return numberText(keyframes[0].value);
    }

    const time = `(${timeExpression})`;
    const last = keyframes[keyframes.length - 1];
    let expression = numberText(last.value);

    for (let index = keyframes.length - 2; index >= 0; index -= 1) {
        const from = keyframes[index];
        const to = keyframes[index + 1];
        const span = Math.max(1e-6, to.time - from.time);
        const progress = `(${time}-${numberText(from.time)})/${numberText(span)}`;
        const eased = easingExpression(from.easing, progress);
        const segment = `${numberText(from.value)}+(${numberText(to.value - from.value)})*${eased}`;

        expression = `if(lt(${time},${numberText(to.time)}),${segment},${expression})`;
    }

    return `if(lt(${time},${numberText(keyframes[0].time)}),${numberText(keyframes[0].value)},${expression})`;
}

// === Property paths. A clip keeps its keyframes in a map from path to list. === //

export const PATH = {
    x: 'motion.x',
    y: 'motion.y',
    scale: 'motion.scale',
    rotation: 'motion.rotation',
    anchorX: 'motion.anchorX',
    anchorY: 'motion.anchorY',
    opacity: 'motion.opacity',
    volume: 'audio.volume',
    pan: 'audio.pan',
    color: (key: string) => `color.${key}`,
    effect: (effectId: string, key: string) => `effect.${effectId}.${key}`
} as const;
