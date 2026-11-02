import {snapToFrame} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence} from '../project/StellarEditor.Store';
import {sequenceDuration} from '../timeline/StellarTimeline.Controller';

// The playback clock. While playing, it moves the playhead along with the wall clock.
// The preview engine reads the playhead and keeps the video and audio elements in step.

const SHUTTLE_SPEEDS = [1, 2, 4, 8];

let frameRequest = 0;
let clockStartWall = 0;
let clockStartTime = 0;

function frameRate(): number {
    return getActiveSequence()?.settings.frameRate ?? 24;
}

/** Moves the playhead to the closest frame. It may go past the last clip, but never before 0. */
export function seekTo(seconds: number): void {
    const time = Math.max(0, snapToFrame(seconds, frameRate()));

    editorStore.set({playhead: time});

    if (editorStore.get().playing) {
        clockStartWall = performance.now();
        clockStartTime = time;
    }
}

export function stepFrames(frames: number): void {
    pause();
    seekTo(editorStore.get().playhead + frames / frameRate());
}

export function play(rate = 1): void {
    const sequence = getActiveSequence();

    if (!sequence) {
        return;
    }

    const state = editorStore.get();
    const duration = sequenceDuration(sequence);

    if (rate > 0 && state.playhead >= duration - 1e-3 && duration > 0) {
        editorStore.set({playhead: sequence.inPoint !== null && state.loop ? sequence.inPoint : 0});
    }

    clockStartWall = performance.now();
    clockStartTime = editorStore.get().playhead;
    editorStore.set({playing: true, rate});

    if (!frameRequest) {
        frameRequest = requestAnimationFrame(tick);
    }
}

export function pause(): void {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;

    if (editorStore.get().playing) {
        editorStore.set({playing: false, rate: 1});
    }
}

export function togglePlay(): void {
    if (editorStore.get().playing) {
        pause();
    } else {
        play(1);
    }
}

export function toggleLoop(): void {
    editorStore.set({loop: !editorStore.get().loop});
}

/** J, K and L. Pressing L again plays faster. */
export function shuttle(direction: 'reverse' | 'stop' | 'forward'): void {
    const state = editorStore.get();

    if (direction === 'stop') {
        pause();
        return;
    }

    const sign = direction === 'forward' ? 1 : -1;
    const isSameWay = state.playing && Math.sign(state.rate) === sign;
    const currentIndex = SHUTTLE_SPEEDS.indexOf(Math.abs(state.rate));
    const nextIndex = isSameWay ? Math.min(currentIndex + 1, SHUTTLE_SPEEDS.length - 1) : 0;

    play(sign * SHUTTLE_SPEEDS[nextIndex]);
}

function tick(): void {
    frameRequest = 0;

    const state = editorStore.get();
    const sequence = getActiveSequence();

    if (!state.playing || !sequence) {
        return;
    }

    const elapsed = ((performance.now() - clockStartWall) / 1000) * state.rate;
    let time = clockStartTime + elapsed;
    const duration = sequenceDuration(sequence);
    const hasRange = state.loop && sequence.inPoint !== null && sequence.outPoint !== null && sequence.outPoint > sequence.inPoint;
    const rangeStart = hasRange ? (sequence.inPoint as number) : 0;
    const rangeEnd = hasRange ? (sequence.outPoint as number) : duration;

    if (state.rate > 0 && time >= rangeEnd) {
        if (state.loop && rangeEnd > rangeStart) {
            time = rangeStart;
            clockStartWall = performance.now();
            clockStartTime = rangeStart;
        } else {
            editorStore.set({playhead: rangeEnd});
            pause();
            return;
        }
    }

    if (state.rate < 0 && time <= rangeStart) {
        editorStore.set({playhead: rangeStart});
        pause();
        return;
    }

    editorStore.set({playhead: time});
    frameRequest = requestAnimationFrame(tick);
}
