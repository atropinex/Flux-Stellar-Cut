// Masks. A mask cuts a clip to a shape. All positions are fractions (0..1) of the clip's picture.

export type MaskShape = 'ellipse' | 'rectangle' | 'polygon';

export interface MaskPoint {
    x: number;
    y: number;
}

export interface Mask {
    id: string;
    name: string;
    shape: MaskShape;
    enabled: boolean;
    // ellipse and rectangle
    cx: number;
    cy: number;
    width: number;
    height: number;
    rotation: number;     // degrees
    // polygon, drawn with the pen
    points: MaskPoint[];
    smooth: boolean;      // round the corners of the polygon
    // all shapes
    feather: number;      // soft edge, in pixels of a 1080 high picture
    expansion: number;    // grow (+) or shrink (-) the shape, same pixels
    opacity: number;      // 0..100
    inverted: boolean;
}

let maskCounter = 0;

function maskId(): string {
    maskCounter += 1;

    return `mask-${Date.now().toString(36)}-${maskCounter}`;
}

export function createMask(shape: MaskShape, points: MaskPoint[] = []): Mask {
    const names = {ellipse: 'Ellipse Mask', rectangle: 'Rectangle Mask', polygon: 'Free Draw Mask'};

    return {
        id: maskId(),
        name: names[shape],
        shape,
        enabled: true,
        cx: 0.5,
        cy: 0.5,
        width: 0.5,
        height: 0.5,
        rotation: 0,
        points,
        smooth: false,
        feather: 10,
        expansion: 0,
        opacity: 100,
        inverted: false
    };
}

export function normalizeMask(raw: Partial<Mask>): Mask {
    const base = createMask(raw.shape ?? 'ellipse');

    return {...base, ...raw, points: Array.isArray(raw.points) ? raw.points : []};
}

/** The bounding box of a mask, used for hit tests and for showing handles. */
export function maskBounds(mask: Mask): { left: number; top: number; right: number; bottom: number } {
    if (mask.shape === 'polygon' && mask.points.length > 0) {
        const xs = mask.points.map((point) => point.x);
        const ys = mask.points.map((point) => point.y);

        return {left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys)};
    }

    return {
        left: mask.cx - mask.width / 2,
        top: mask.cy - mask.height / 2,
        right: mask.cx + mask.width / 2,
        bottom: mask.cy + mask.height / 2
    };
}

/** A mask with fewer than three points cannot be drawn. */
export function isMaskDrawable(mask: Mask): boolean {
    return mask.enabled && (mask.shape !== 'polygon' || mask.points.length >= 3);
}

export function activeMasks(masks: Mask[] | undefined): Mask[] {
    return (masks ?? []).filter(isMaskDrawable);
}
