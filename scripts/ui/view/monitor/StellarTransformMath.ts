// The maths behind moving, scaling, turning and re-anchoring a clip on the Program monitor.
//
// Positions on the stage are measured in screen pixels from the CENTER of the stage.
// The motion of a clip is in sequence pixels, so "unit" (stage pixels per sequence pixel) converts between them.
//
// A clip is drawn like this: it is scaled and turned around its anchor point, then moved by its position.
//     screen point = position + anchor + scale * turn(point - anchor)
// so the anchor point itself ends up at position + anchor, and stays there when the clip is scaled or turned.

export interface TransformMotion {
    x: number;
    y: number;
    scale: number;      // percent
    rotation: number;   // degrees
    anchorX: number;
    anchorY: number;
}

export interface Point {
    x: number;
    y: number;
}

function turn(point: Point, degrees: number): Point {
    const radians = (degrees * Math.PI) / 180;

    return {
        x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
        y: point.x * Math.sin(radians) + point.y * Math.cos(radians)
    };
}

/** Where a point of the clip's picture (measured from the picture's center) ends up on the stage. */
export function toStage(motion: TransformMotion, unit: number, local: Point): Point {
    const anchor = {x: motion.anchorX * unit, y: motion.anchorY * unit};
    const turned = turn({x: local.x - anchor.x, y: local.y - anchor.y}, motion.rotation);
    const factor = motion.scale / 100;

    return {
        x: motion.x * unit + anchor.x + turned.x * factor,
        y: motion.y * unit + anchor.y + turned.y * factor
    };
}

/** The four corners of the picture: top left, top right, bottom right, bottom left. */
export function pictureCorners(motion: TransformMotion, unit: number, width: number, height: number): Point[] {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    return [
        {x: -halfWidth, y: -halfHeight},
        {x: halfWidth, y: -halfHeight},
        {x: halfWidth, y: halfHeight},
        {x: -halfWidth, y: halfHeight}
    ].map((corner) => toStage(motion, unit, corner));
}

/** Where the anchor point is on the stage. */
export function anchorOnStage(motion: TransformMotion, unit: number): Point {
    return {x: (motion.x + motion.anchorX) * unit, y: (motion.y + motion.anchorY) * unit};
}

export interface MoveSnap {
    dx: number;
    dy: number;
    guideX: number | null;
    guideY: number | null;
}

/**
 * Moves the picture by (dx, dy) screen pixels. The left, middle and right of the picture's box
 * stick to the left, middle and right of the frame (and the same for the top, middle and bottom).
 */
export function snapMove(corners: Point[], dx: number, dy: number, stageWidth: number, stageHeight: number, threshold: number): MoveSnap {
    const xs = corners.map((corner) => corner.x + dx);
    const ys = corners.map((corner) => corner.y + dy);
    const boxX = [Math.min(...xs), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...xs)];
    const boxY = [Math.min(...ys), (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...ys)];
    const lineX = [-stageWidth / 2, 0, stageWidth / 2];
    const lineY = [-stageHeight / 2, 0, stageHeight / 2];
    const x = closest(boxX, lineX, threshold);
    const y = closest(boxY, lineY, threshold);

    return {dx: dx + (x?.adjust ?? 0), dy: dy + (y?.adjust ?? 0), guideX: x?.line ?? null, guideY: y?.line ?? null};
}

function closest(values: number[], lines: number[], threshold: number): {adjust: number; line: number} | null {
    let best: {adjust: number; line: number} | null = null;

    for (const value of values) {
        for (const line of lines) {
            const distance = Math.abs(line - value);

            if (distance <= threshold && (!best || distance < Math.abs(best.adjust))) {
                best = {adjust: line - value, line};
            }
        }
    }

    return best;
}

/**
 * Drags the anchor point to a spot on the stage without moving the picture.
 * The position is changed to make up for it. Returns the new values in sequence pixels.
 */
export function moveAnchor(start: TransformMotion, unit: number, target: Point): {anchorX: number; anchorY: number; x: number; y: number} {
    const factor = start.scale / 100;
    const anchor = {x: start.anchorX * unit, y: start.anchorY * unit};
    const turnedAnchor = turn(anchor, start.rotation);
    // Where the picture's center is now, compared with where it would be with no scale and rotation: anchor - scale * turn(anchor).
    const shift = {x: anchor.x - factor * turnedAnchor.x, y: anchor.y - factor * turnedAnchor.y};
    const wanted = {x: target.x - start.x * unit - shift.x, y: target.y - start.y * unit - shift.y};
    // anchor' = (scale * turn)^-1 * wanted
    const back = turn(wanted, -start.rotation);
    const next = {x: back.x / factor, y: back.y / factor};
    const nextTurned = turn(next, start.rotation);
    const nextShift = {x: next.x - factor * nextTurned.x, y: next.y - factor * nextTurned.y};

    return {
        anchorX: next.x / unit,
        anchorY: next.y / unit,
        x: (start.x * unit + shift.x - nextShift.x) / unit,
        y: (start.y * unit + shift.y - nextShift.y) / unit
    };
}

/** Scale after dragging a corner. The farther from the anchor point, the bigger. */
export function scaleBy(start: TransformMotion, unit: number, grabbed: Point, pointer: Point): number {
    const pivot = anchorOnStage(start, unit);
    const before = Math.hypot(grabbed.x - pivot.x, grabbed.y - pivot.y);
    const after = Math.hypot(pointer.x - pivot.x, pointer.y - pivot.y);

    if (before < 1) {
        return start.scale;
    }

    return start.scale * (after / before);
}

/** Rotation after dragging around the anchor point. */
export function rotateBy(start: TransformMotion, unit: number, grabbed: Point, pointer: Point, step: number | null): number {
    const pivot = anchorOnStage(start, unit);
    const before = Math.atan2(grabbed.y - pivot.y, grabbed.x - pivot.x);
    const after = Math.atan2(pointer.y - pivot.y, pointer.x - pivot.x);
    let degrees = start.rotation + ((after - before) * 180) / Math.PI;

    if (step) {
        degrees = Math.round(degrees / step) * step;
    }

    return degrees;
}
