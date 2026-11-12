// The grid of the timeline ruler. The ruler draws it, and the snapping uses the very same numbers,
// so a snap always lands on a line the person can see.

/** Picks a distance between labels so they are at least ~90px apart. */
export function labelStep(pixelsPerSecond: number, frameRate: number): number {
    const frame = 1 / frameRate;
    const steps = [frame, frame * 2, frame * 5, frame * 10, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

    return steps.find((step) => step * pixelsPerSecond >= 90) ?? 3600;
}

/** How many small bars fit between two labels. */
export function gridDivisions(step: number, pixelsPerSecond: number): number {
    return [10, 5, 4, 2].find((count) => (step * pixelsPerSecond) / count >= 7) ?? 1;
}

/** The time between two neighbouring small bars of the ruler. */
export function gridStep(pixelsPerSecond: number, frameRate: number): number {
    const step = labelStep(pixelsPerSecond, frameRate);

    return step / gridDivisions(step, pixelsPerSecond);
}

/** The ruler bar closest to a time. */
export function nearestGridTime(time: number, pixelsPerSecond: number, frameRate: number): number {
    const step = gridStep(pixelsPerSecond, frameRate);

    return Math.max(0, Math.round(time / step) * step);
}
