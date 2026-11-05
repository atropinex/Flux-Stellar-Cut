// The list of effects. The effects panel, the effect controls, the preview and the export all read this list.

export type EffectCategory = 'Video Effects' | 'Video Transitions' | 'Audio Effects' | 'Audio Transitions';

export interface EffectParam {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
    unit: string;
}

export type TransitionStyle = 'dipBlack' | 'dipWhite' | 'dissolve' | 'audioFade';

export interface EffectDefinition {
    kind: string;
    label: string;
    category: EffectCategory;
    appliesTo: 'video' | 'audio';
    params: EffectParam[];
    /** Transitions sit at one end of a clip: where they start, or where they end. */
    edge?: 'in' | 'out';
    style?: TransitionStyle;
}

function transition(
    kind: string, label: string, category: EffectCategory, appliesTo: 'video' | 'audio', edge: 'in' | 'out', style: TransitionStyle
): EffectDefinition[] {
    return [{
        kind, label, category, appliesTo, edge, style,
        params: [{ key: 'duration', label: 'Duration', min: 0.1, max: 30, step: 0.05, default: 1, unit: 's' }]
    }];
}

export const EFFECTS: EffectDefinition[] = [
    {
        kind: 'brightness', label: 'Brightness', category: 'Video Effects', appliesTo: 'video',
        params: [{ key: 'amount', label: 'Brightness', min: -100, max: 100, step: 1, default: 20, unit: '' }]
    },
    {
        kind: 'contrast', label: 'Contrast', category: 'Video Effects', appliesTo: 'video',
        params: [{ key: 'amount', label: 'Contrast', min: -100, max: 100, step: 1, default: 20, unit: '' }]
    },
    {
        kind: 'saturation', label: 'Saturation', category: 'Video Effects', appliesTo: 'video',
        params: [{ key: 'amount', label: 'Saturation', min: 0, max: 300, step: 1, default: 130, unit: '%' }]
    },
    {
        kind: 'hue', label: 'Hue Shift', category: 'Video Effects', appliesTo: 'video',
        params: [{ key: 'degrees', label: 'Hue', min: -180, max: 180, step: 1, default: 30, unit: '°' }]
    },
    {
        kind: 'blur', label: 'Gaussian Blur', category: 'Video Effects', appliesTo: 'video',
        params: [{ key: 'radius', label: 'Blurriness', min: 0, max: 100, step: 0.5, default: 10, unit: 'px' }]
    },
    { kind: 'grayscale', label: 'Black & White', category: 'Video Effects', appliesTo: 'video', params: [] },
    { kind: 'sepia', label: 'Sepia', category: 'Video Effects', appliesTo: 'video', params: [] },
    { kind: 'invert', label: 'Invert', category: 'Video Effects', appliesTo: 'video', params: [] },
    ...transition('fadeIn', 'Dip to Black (In)', 'Video Transitions', 'video', 'in', 'dipBlack'),
    ...transition('fadeOut', 'Dip to Black (Out)', 'Video Transitions', 'video', 'out', 'dipBlack'),
    ...transition('whiteIn', 'Dip to White (In)', 'Video Transitions', 'video', 'in', 'dipWhite'),
    ...transition('whiteOut', 'Dip to White (Out)', 'Video Transitions', 'video', 'out', 'dipWhite'),
    ...transition('dissolveIn', 'Cross Dissolve (In)', 'Video Transitions', 'video', 'in', 'dissolve'),
    ...transition('dissolveOut', 'Cross Dissolve (Out)', 'Video Transitions', 'video', 'out', 'dissolve'),
    {
        kind: 'amplify', label: 'Amplify', category: 'Audio Effects', appliesTo: 'audio',
        params: [{ key: 'gain', label: 'Gain', min: -30, max: 30, step: 0.5, default: 6, unit: 'dB' }]
    },
    ...transition('audioFadeIn', 'Fade In', 'Audio Transitions', 'audio', 'in', 'audioFade'),
    ...transition('audioFadeOut', 'Fade Out', 'Audio Transitions', 'audio', 'out', 'audioFade')
];

export const EFFECT_CATEGORIES: EffectCategory[] = ['Video Effects', 'Video Transitions', 'Audio Effects', 'Audio Transitions'];

export function findEffect(kind: string): EffectDefinition | undefined {
    return EFFECTS.find((effect) => effect.kind === kind);
}

export function defaultEffectParams(definition: EffectDefinition): Record<string, number> {
    const params: Record<string, number> = {};

    for (const param of definition.params) {
        params[param.key] = param.default;
    }

    return params;
}

export function isTransition(kind: string): boolean {
    return findEffect(kind)?.edge !== undefined;
}
