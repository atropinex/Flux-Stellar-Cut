// Color tuning, in the style of Premiere's Lumetri Color.
//
// Every setting is turned into one lookup table per channel (red, green, blue), plus a saturation.
// The preview feeds the tables to an SVG filter and the export feeds them to ffmpeg's "curves" filter,
// so both show the same picture.

export interface CurvePoint {
    x: number; // 0..1
    y: number; // 0..1
}

export interface ColorSettings {
    enabled: boolean;
    // Basic correction
    temperature: number;   // -100 cool .. 100 warm
    tint: number;          // -100 green .. 100 magenta
    exposure: number;      // stops, -5..5
    contrast: number;      // -100..100
    highlights: number;    // -100..100
    shadows: number;
    whites: number;
    blacks: number;
    saturation: number;    // 0..200, 100 = unchanged
    // Creative
    fadedFilm: number;     // 0..100
    sharpen: number;       // 0..100
    vibrance: number;      // -100..100
    vignette: number;      // 0..100
    // Color wheels
    shadowHue: number;     // degrees
    shadowAmount: number;  // 0..100
    midHue: number;
    midAmount: number;
    highlightHue: number;
    highlightAmount: number;
    // The RGB curve. Two points that are on the diagonal mean "no change".
    curve: CurvePoint[];
}

export type ColorGroup = 'Basic' | 'Creative' | 'Color Wheels';

export interface ColorParam {
    key: keyof ColorSettings & string;
    label: string;
    group: ColorGroup;
    min: number;
    max: number;
    step: number;
    default: number;
    unit: string;
}

export const COLOR_PARAMS: ColorParam[] = [
    {key: 'temperature', label: 'Temperature', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'tint', label: 'Tint', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'exposure', label: 'Exposure', group: 'Basic', min: -5, max: 5, step: 0.05, default: 0, unit: ''},
    {key: 'contrast', label: 'Contrast', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'highlights', label: 'Highlights', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'shadows', label: 'Shadows', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'whites', label: 'Whites', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'blacks', label: 'Blacks', group: 'Basic', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'saturation', label: 'Saturation', group: 'Basic', min: 0, max: 200, step: 1, default: 100, unit: '%'},
    {key: 'fadedFilm', label: 'Faded Film', group: 'Creative', min: 0, max: 100, step: 1, default: 0, unit: ''},
    {key: 'sharpen', label: 'Sharpen', group: 'Creative', min: 0, max: 100, step: 1, default: 0, unit: ''},
    {key: 'vibrance', label: 'Vibrance', group: 'Creative', min: -100, max: 100, step: 1, default: 0, unit: ''},
    {key: 'vignette', label: 'Vignette', group: 'Creative', min: 0, max: 100, step: 1, default: 0, unit: ''},
    {key: 'shadowHue', label: 'Shadow Hue', group: 'Color Wheels', min: 0, max: 360, step: 1, default: 220, unit: '°'},
    {key: 'shadowAmount', label: 'Shadow Tint', group: 'Color Wheels', min: 0, max: 100, step: 1, default: 0, unit: ''},
    {key: 'midHue', label: 'Midtone Hue', group: 'Color Wheels', min: 0, max: 360, step: 1, default: 40, unit: '°'},
    {key: 'midAmount', label: 'Midtone Tint', group: 'Color Wheels', min: 0, max: 100, step: 1, default: 0, unit: ''},
    {
        key: 'highlightHue',
        label: 'Highlight Hue',
        group: 'Color Wheels',
        min: 0,
        max: 360,
        step: 1,
        default: 40,
        unit: '°'
    },
    {
        key: 'highlightAmount',
        label: 'Highlight Tint',
        group: 'Color Wheels',
        min: 0,
        max: 100,
        step: 1,
        default: 0,
        unit: ''
    }
];

export function defaultCurve(): CurvePoint[] {
    return [{x: 0, y: 0}, {x: 1, y: 1}];
}

export function defaultColor(): ColorSettings {
    const color: Record<string, unknown> = {enabled: true, curve: defaultCurve()};

    for (const param of COLOR_PARAMS) {
        color[param.key] = param.default;
    }

    return color as unknown as ColorSettings;
}

/** Fills in anything a project file is missing. */
export function normalizeColor(raw: Partial<ColorSettings> | undefined | null): ColorSettings {
    const base = defaultColor();

    if (!raw || typeof raw !== 'object') {
        return base;
    }

    const merged = {...base, ...raw} as ColorSettings;

    merged.curve = Array.isArray(raw.curve) && raw.curve.length >= 2 ? raw.curve : defaultCurve();

    return merged;
}

export function isCurveNeutral(curve: CurvePoint[]): boolean {
    return curve.every((point) => Math.abs(point.x - point.y) < 0.0005);
}

/** True when the color settings would not change the picture. */
export function isColorNeutral(color: ColorSettings): boolean {
    if (!color.enabled) {
        return true;
    }

    for (const param of COLOR_PARAMS) {
        const isAmountOfWheel = param.key.endsWith('Amount');
        const isHueOfWheel = param.key.endsWith('Hue');

        if (isHueOfWheel) {
            continue;
        }

        const value = color[param.key] as number;
        const neutral = isAmountOfWheel ? 0 : param.default;

        if (Math.abs(value - neutral) > 0.0001) {
            return false;
        }
    }

    return isCurveNeutral(color.curve);
}

// === The tables === //

export const LUT_SIZE = 17;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function bell(value: number, center: number, width: number): number {
    const distance = (value - center) / width;

    return Math.exp(-0.5 * distance * distance);
}

/** A smooth curve through the points (monotone cubic), so a curve never wiggles outside its points. */
export function evaluateCurve(points: CurvePoint[], x: number): number {
    const sorted = [...points].sort((first, second) => first.x - second.x);

    if (x <= sorted[0].x) {
        return sorted[0].y;
    }

    const last = sorted[sorted.length - 1];

    if (x >= last.x) {
        return last.y;
    }

    const count = sorted.length;
    const slopes: number[] = [];
    const tangents: number[] = new Array(count).fill(0);

    for (let index = 0; index < count - 1; index += 1) {
        const run = Math.max(1e-6, sorted[index + 1].x - sorted[index].x);

        slopes.push((sorted[index + 1].y - sorted[index].y) / run);
    }

    tangents[0] = slopes[0];
    tangents[count - 1] = slopes[count - 2];

    for (let index = 1; index < count - 1; index += 1) {
        tangents[index] = slopes[index - 1] * slopes[index] <= 0 ? 0 : (slopes[index - 1] + slopes[index]) / 2;
    }

    for (let index = 0; index < count - 1; index += 1) {
        if (Math.abs(slopes[index]) < 1e-9) {
            tangents[index] = 0;
            tangents[index + 1] = 0;
            continue;
        }

        const a = tangents[index] / slopes[index];
        const b = tangents[index + 1] / slopes[index];
        const size = a * a + b * b;

        if (size > 9) {
            const scale = 3 / Math.sqrt(size);

            tangents[index] = scale * a * slopes[index];
            tangents[index + 1] = scale * b * slopes[index];
        }
    }

    let segment = 0;

    while (segment < count - 2 && x > sorted[segment + 1].x) {
        segment += 1;
    }

    const from = sorted[segment];
    const to = sorted[segment + 1];
    const run = Math.max(1e-6, to.x - from.x);
    const t = (x - from.x) / run;
    const t2 = t * t;
    const t3 = t2 * t;

    return (
        (2 * t3 - 3 * t2 + 1) * from.y + (t3 - 2 * t2 + t) * run * tangents[segment] +
        (-2 * t3 + 3 * t2) * to.y + (t3 - t2) * run * tangents[segment + 1]
    );
}

function wheelOffset(hue: number, amount: number, channel: number): number {
    const strength = (amount / 100) * 0.16;
    const radians = ((hue - channel * 120) * Math.PI) / 180;

    return strength * Math.cos(radians);
}

/** One output value for one input value of one channel (0 red, 1 green, 2 blue). */
export function colorTransfer(color: ColorSettings, channel: number, input: number): number {
    const warm = color.temperature / 100;
    const magenta = color.tint / 100;
    const channelGain = channel === 0 ? 1 + 0.3 * warm + 0.08 * magenta : channel === 1 ? 1 - 0.18 * magenta : 1 - 0.3 * warm + 0.08 * magenta;

    let value = clamp01(input) * channelGain;

    value *= Math.pow(2, color.exposure * 0.7);

    const contrastFactor = color.contrast >= 0 ? 1 + (color.contrast / 100) * 1.2 : 1 + color.contrast / 100;

    value = (value - 0.5) * contrastFactor + 0.5;

    const probe = clamp01(value);

    value += (color.shadows / 100) * 0.25 * bell(probe, 0.22, 0.2);
    value += (color.highlights / 100) * 0.25 * bell(probe, 0.78, 0.2);
    value += (color.blacks / 100) * 0.2 * bell(probe, 0.0, 0.12);
    value += (color.whites / 100) * 0.2 * bell(probe, 1.0, 0.12);

    const fade = (color.fadedFilm / 100) * 0.16;

    value = fade + value * (1 - fade);

    const wheelProbe = clamp01(value);

    value += wheelOffset(color.shadowHue, color.shadowAmount, channel) * (1 - wheelProbe) * (1 - wheelProbe);
    value += wheelOffset(color.midHue, color.midAmount, channel) * 4 * wheelProbe * (1 - wheelProbe);
    value += wheelOffset(color.highlightHue, color.highlightAmount, channel) * wheelProbe * wheelProbe;

    value = clamp01(value);

    if (!isCurveNeutral(color.curve)) {
        value = clamp01(evaluateCurve(color.curve, value));
    }

    return value;
}

export interface ColorLuts {
    red: number[];
    green: number[];
    blue: number[];
}

export function buildColorLuts(color: ColorSettings, size = LUT_SIZE): ColorLuts {
    const tables: number[][] = [[], [], []];

    for (let channel = 0; channel < 3; channel += 1) {
        for (let index = 0; index < size; index += 1) {
            tables[channel].push(colorTransfer(color, channel, index / (size - 1)));
        }
    }

    return {red: tables[0], green: tables[1], blue: tables[2]};
}

/** The saturation that the filter should use. Vibrance is approximated as extra saturation. */
export function effectiveSaturation(color: ColorSettings): number {
    const vibranceBoost = 1 + (color.vibrance / 100) * 0.45;

    return Math.max(0, (color.saturation / 100) * vibranceBoost);
}

// === ffmpeg === //

function pointsText(table: number[]): string {
    return table.map((value, index) => `${(index / (table.length - 1)).toFixed(4)}/${value.toFixed(4)}`).join(' ');
}

/** The filters that apply the color settings. Empty when nothing changes. */
export function colorFilters(color: ColorSettings): string[] {
    if (isColorNeutral(color)) {
        return [];
    }

    const filters: string[] = [];
    const luts = buildColorLuts(color, 9);
    const saturation = effectiveSaturation(color);

    filters.push(`curves=r='${pointsText(luts.red)}':g='${pointsText(luts.green)}':b='${pointsText(luts.blue)}'`);

    if (Math.abs(saturation - 1) > 0.001) {
        filters.push(`eq=saturation=${saturation.toFixed(4)}`);
    }

    if (color.sharpen > 0.5) {
        filters.push(`unsharp=5:5:${((color.sharpen / 100) * 1.5).toFixed(3)}:5:5:0`);
    }

    if (color.vignette > 0.5) {
        const angle = Math.PI / 2 - (color.vignette / 100) * (Math.PI / 2 - 0.3);

        filters.push(`vignette=angle=${angle.toFixed(4)}:mode=forward:eval=init`);
    }

    return filters;
}
