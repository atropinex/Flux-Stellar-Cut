export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** 23.976 and 24 both count 24 frames per timecode second. */
export function timecodeBase(frameRate: number): number {
    return Math.max(1, Math.round(frameRate));
}

/** Moves a time to the closest frame. */
export function snapToFrame(seconds: number, frameRate: number): number {
    return Math.round(seconds * frameRate) / frameRate;
}

export function floorToFrame(seconds: number, frameRate: number): number {
    return Math.floor(seconds * frameRate + 1e-6) / frameRate;
}

/** 83.5 seconds at 24 fps -> "00:01:23:12" */
export function formatTimecode(seconds: number, frameRate: number): string {
    const base = timecodeBase(frameRate);
    const totalFrames = Math.max(0, Math.round(seconds * frameRate));
    const frames = totalFrames % base;
    const totalSeconds = Math.floor(totalFrames / base);
    const secs = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    return [hours, minutes, secs, frames].map((part) => String(part).padStart(2, '0')).join(':');
}

/** "00:01:23:12" -> 83.5. Also accepts "1:23:12", "123" (frames) and plain seconds like "83.5s". */
export function parseTimecode(text: string, frameRate: number): number | null {
    const trimmed = text.trim();

    if (/^\d+(\.\d+)?s$/i.test(trimmed)) {
        return parseFloat(trimmed);
    }

    const parts = trimmed.split(/[:;.]/).map((part) => Number(part));

    if (parts.some((part) => !Number.isFinite(part))) {
        return null;
    }

    if (parts.length === 1) {
        return parts[0] / frameRate;
    }

    const base = timecodeBase(frameRate);
    const [frames, secs = 0, minutes = 0, hours = 0] = [...parts].reverse();

    return hours * 3600 + minutes * 60 + secs + frames / base;
}

/** 83.5 -> "1:23", 3725 -> "1:02:05" */
export function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const secs = total % 60;
    const minutes = Math.floor(total / 60) % 60;
    const hours = Math.floor(total / 3600);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }

    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatFrameRate(frameRate: number): string {
    const rounded = Math.round(frameRate * 1000) / 1000;

    return Number.isInteger(rounded) ? `${rounded} fps` : `${rounded.toFixed(3)} fps`;
}

export function dbToGain(db: number): number {
    return Math.pow(10, db / 20);
}

export function createId(prefix: string): string {
    const random = Math.random().toString(36).slice(2, 10);

    return `${prefix}_${Date.now().toString(36)}${random}`;
}
