import {useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject} from 'react';
import type {Sequence} from '../../../common/stellar/StellarContract';
import {SNAP_DISTANCE_PX} from '../../../common/stellar/StellarConfig';
import {clamp, snapToFrame} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence, getMedia} from '../../controller/project/StellarEditor.Store';
import {
    allowedTrackShift, clipEnd, clipsAtOrAfter, clipsInRegion, findClip, findTrack, moveClips, snapPoints, snapToPoints,
    tracksOfType, trimClip, trimLimits, withLinkedClips
} from '../../controller/timeline/StellarTimeline.Controller';
import {cancelPreview, commitPreview, razorAt, selectClips, deselectAll, setZoom} from '../../controller/timeline/StellarTimelineActions.Controller';
import {pause, seekTo} from '../../controller/playback/StellarPlayback.Controller';
import {HEADER_WIDTH} from './StellarTimelineConstants';
import {nearestGridTime} from './StellarTimelineGrid';

// Everything that happens when the mouse is pressed, moved and released on the timeline.
// While a clip is dragged, the new layout is only a preview. It becomes one undo step when the mouse is released.

type Drag =
    | {kind: 'scrub'}
    | {kind: 'pan'; startX: number; startY: number; scrollLeft: number; scrollTop: number}
    | {kind: 'move'; base: Sequence; ids: string[]; grabTime: number; originTrackId: string; moved: boolean}
    | {kind: 'trim'; base: Sequence; clipId: string; edge: 'start' | 'end'; ripple: boolean; moved: boolean}
    | {kind: 'marquee'; startX: number; startY: number; baseSelection: string[]};

export interface MarqueeRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export function useStellarTimelineInteraction(scrollerRef: RefObject<HTMLDivElement | null>, contentRef: RefObject<HTMLDivElement | null>) {
    const drag = useRef<Drag | null>(null);
    const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

    function contentLeft(): number {
        return (contentRef.current?.getBoundingClientRect().left ?? 0) + HEADER_WIDTH;
    }

    function timeAt(clientX: number): number {
        return Math.max(0, (clientX - contentLeft()) / editorStore.get().pixelsPerSecond);
    }

    function trackAt(clientY: number): string | null {
        const rows = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-track-row]') ?? []);

        for (const row of rows) {
            const rect = row.getBoundingClientRect();

            if (clientY >= rect.top && clientY < rect.bottom) {
                return row.dataset.trackRow ?? null;
            }
        }

        return null;
    }

    function snapThreshold(): number {
        return SNAP_DISTANCE_PX / editorStore.get().pixelsPerSecond;
    }

    interface SnapResult {
        time: number;
        guide: number | null;
        kind: 'point' | 'grid' | null;
    }

    /**
     * Snaps a time. Edit points (clip edges, markers, playhead) win over the ruler grid,
     * and the grid wins over a plain frame. The guide is where the vertical line is drawn.
     */
    function snapTime(time: number, sequence: Sequence, excludeIds: Set<string>): SnapResult {
        const state = editorStore.get();
        const frameRate = sequence.settings.frameRate;

        if (!state.snapping) {
            return {time: snapToFrame(time, frameRate), guide: null, kind: null};
        }

        const point = snapToPoints(time, snapPoints(sequence, state.playhead, excludeIds), snapThreshold());

        if (point !== null) {
            return {time: point, guide: point, kind: 'point'};
        }

        const grid = nearestGridTime(time, state.pixelsPerSecond, frameRate);

        if (Math.abs(grid - time) <= snapThreshold()) {
            return {time: grid, guide: grid, kind: 'grid'};
        }

        return {time: snapToFrame(time, frameRate), guide: null, kind: null};
    }

    function showGuide(guide: number | null, kind: 'point' | 'grid' | null) {
        const state = editorStore.get();

        if (state.snapGuide !== guide || state.snapGuideKind !== kind) {
            editorStore.set({snapGuide: guide, snapGuideKind: kind});
        }
    }

    function scrubTo(clientX: number, noSnap: boolean) {
        const sequence = getActiveSequence();

        if (!sequence) {
            return;
        }

        let time = timeAt(clientX);

        if (editorStore.get().snapping && !noSnap) {
            const result = snapTime(time, sequence, new Set());

            time = result.time;
            showGuide(result.guide, result.kind);
        } else {
            showGuide(null, null);
        }

        seekTo(time);
    }

    /** Where a razor click at this x position cuts. */
    function razorTime(clientX: number, sequence: Sequence): number {
        return snapTime(timeAt(clientX), sequence, new Set()).time;
    }

    // === Pressing === //

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        const target = event.target as HTMLElement;
        const sequence = getActiveSequence();

        if (event.button !== 0 || !sequence || target.closest('[data-header]')) {
            return;
        }

        const state = editorStore.get();

        event.currentTarget.setPointerCapture(event.pointerId);

        if (target.closest('[data-ruler]')) {
            pause();
            drag.current = {kind: 'scrub'};
            scrubTo(event.clientX, event.shiftKey);
            return;
        }

        const time = timeAt(event.clientX);
        const scroller = scrollerRef.current;

        if (state.tool === 'hand' && scroller) {
            drag.current = {kind: 'pan', startX: event.clientX, startY: event.clientY, scrollLeft: scroller.scrollLeft, scrollTop: scroller.scrollTop};
            return;
        }

        if (state.tool === 'zoom' && scroller) {
            const factor = event.altKey ? 1 / 1.6 : 1.6;

            setZoom(state.pixelsPerSecond * factor, time, event.clientX - scroller.getBoundingClientRect().left - HEADER_WIDTH);
            drag.current = null;
            return;
        }

        const clipElement = target.closest<HTMLElement>('[data-clip-id]');

        if (!clipElement) {
            if (state.tool === 'razor') {
                if (event.shiftKey) {
                    razorAt(razorTime(event.clientX, sequence), true, null);
                }

                return;
            }

            if (!event.shiftKey) {
                deselectAll();
            }

            drag.current = {kind: 'marquee', startX: event.clientX, startY: event.clientY, baseSelection: event.shiftKey ? state.selection : []};
            return;
        }

        const clipId = clipElement.dataset.clipId as string;
        const clip = findClip(sequence, clipId);
        const track = clip ? findTrack(sequence, clip.trackId) : undefined;

        if (!clip || !track) {
            return;
        }

        if (state.tool === 'razor') {
            razorAt(razorTime(event.clientX, sequence), event.shiftKey, clipId);
            return;
        }

        if (track.locked) {
            selectClips([clipId]);
            return;
        }

        const edge = target.closest<HTMLElement>('[data-edge]')?.dataset.edge as 'start' | 'end' | undefined;

        if (edge && (state.tool === 'selection' || state.tool === 'ripple')) {
            selectClips([clipId], event.shiftKey);
            drag.current = {kind: 'trim', base: sequence, clipId, edge, ripple: state.tool === 'ripple', moved: false};
            return;
        }

        if (state.tool === 'trackSelect') {
            selectClips(clipsAtOrAfter(sequence, clipId), event.shiftKey);
        } else if (event.shiftKey || event.ctrlKey || event.metaKey) {
            selectClips([clipId], true);
        } else if (!state.selection.includes(clipId)) {
            selectClips([clipId]);
        }

        const selection = editorStore.get().selection;

        if (!selection.includes(clipId)) {
            return;
        }

        const ids = (state.linkedSelection ? withLinkedClips(sequence, selection) : selection).filter((id) => {
            const item = findClip(sequence, id);

            return item ? !findTrack(sequence, item.trackId)?.locked : false;
        });

        drag.current = {kind: 'move', base: sequence, ids, grabTime: time, originTrackId: clip.trackId, moved: false};
    }

    // === Moving === //

    function moveDelta(d: Extract<Drag, {kind: 'move'}>, raw: number): {delta: number; guide: number | null; kind: 'point' | 'grid' | null} {
        const state = editorStore.get();
        const frameRate = d.base.settings.frameRate;

        if (!state.snapping) {
            return {delta: snapToFrame(raw, frameRate), guide: null, kind: null};
        }

        const points = snapPoints(d.base, state.playhead, new Set(d.ids));
        const threshold = snapThreshold();
        let best: {adjust: number; point: number} | null = null;

        for (const clip of d.base.clips.filter((item) => d.ids.includes(item.id))) {
            for (const edge of [clip.start + raw, clipEnd(clip) + raw]) {
                const point = snapToPoints(edge, points, threshold);

                if (point !== null && (!best || Math.abs(point - edge) < Math.abs(best.adjust))) {
                    best = {adjust: point - edge, point};
                }
            }
        }

        if (best) {
            return {delta: raw + best.adjust, guide: best.point, kind: 'point'};
        }

        // No clip edge or marker is close. Try the ruler grid for the start and the end of every clip.
        for (const clip of d.base.clips.filter((item) => d.ids.includes(item.id))) {
            for (const edge of [clip.start + raw, clipEnd(clip) + raw]) {
                const grid = nearestGridTime(edge, state.pixelsPerSecond, frameRate);

                if (Math.abs(grid - edge) <= threshold && (!best || Math.abs(grid - edge) < Math.abs(best.adjust))) {
                    best = {adjust: grid - edge, point: grid};
                }
            }
        }

        return best ? {delta: raw + best.adjust, guide: best.point, kind: 'grid'} : {delta: snapToFrame(raw, frameRate), guide: null, kind: null};
    }

    /** With the razor, a vertical line follows the mouse and shows where the cut would land. */
    function showRazorHover(event: ReactPointerEvent<HTMLDivElement>) {
        const sequence = getActiveSequence();

        if (editorStore.get().tool !== 'razor' || !sequence || (event.target as HTMLElement).closest('[data-header]')) {
            showGuide(null, null);
            return;
        }

        const result = snapTime(timeAt(event.clientX), sequence, new Set());

        showGuide(result.time, result.kind ?? 'grid');
    }

    function onPointerLeave() {
        if (!drag.current) {
            showGuide(null, null);
        }
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const d = drag.current;

        if (!d) {
            showRazorHover(event);
            return;
        }

        const state = editorStore.get();

        if (d.kind === 'scrub') {
            scrubTo(event.clientX, event.shiftKey);
            return;
        }

        if (d.kind === 'pan') {
            const scroller = scrollerRef.current;

            if (scroller) {
                scroller.scrollLeft = d.scrollLeft - (event.clientX - d.startX);
                scroller.scrollTop = d.scrollTop - (event.clientY - d.startY);
            }

            return;
        }

        if (d.kind === 'move') {
            const raw = timeAt(event.clientX) - d.grabTime;
            const hovered = trackAt(event.clientY);

            if (!d.moved && Math.abs(raw) * state.pixelsPerSecond < 3 && (!hovered || hovered === d.originTrackId)) {
                return;
            }

            d.moved = true;

            const {delta, guide, kind} = moveDelta(d, raw);
            const origin = findTrack(d.base, d.originTrackId);
            const sameType = origin ? tracksOfType(d.base, origin.type) : [];
            const hoveredTrack = hovered ? findTrack(d.base, hovered) : undefined;
            const originIndex = sameType.findIndex((item) => item.id === d.originTrackId);
            const hoveredIndex = hoveredTrack && hoveredTrack.type === origin?.type ? sameType.findIndex((item) => item.id === hoveredTrack.id) : originIndex;
            const limits = allowedTrackShift(d.base, d.ids, origin?.type);
            const shift = clamp(hoveredIndex - originIndex, limits.min, limits.max);

            editorStore.set({liveSequence: moveClips(d.base, d.ids, delta, shift, origin?.type), snapGuide: guide, snapGuideKind: kind});
            return;
        }

        if (d.kind === 'trim') {
            const clip = findClip(d.base, d.clipId);
            const media = clip ? getMedia(state, clip.mediaId) : undefined;

            if (!clip || !media) {
                return;
            }

            d.moved = true;

            const result = snapTime(timeAt(event.clientX), d.base, new Set([d.clipId]));
            const time = result.time;
            const guide = result.guide;

            const limits = trimLimits(d.base, clip, d.edge, media.duration, media.kind === 'image', d.ripple);

            editorStore.set({
                liveSequence: trimClip(d.base, d.clipId, d.edge, clamp(time, limits.min, limits.max), d.ripple, state.linkedSelection),
                snapGuide: guide,
                snapGuideKind: result.kind
            });
            return;
        }

        // Marquee: draw the rectangle and select the clips it touches.
        const contentBox = contentRef.current?.getBoundingClientRect();
        const sequence = getActiveSequence();

        if (!contentBox || !sequence) {
            return;
        }

        const left = Math.min(d.startX, event.clientX);
        const top = Math.min(d.startY, event.clientY);
        const width = Math.abs(event.clientX - d.startX);
        const height = Math.abs(event.clientY - d.startY);

        setMarquee({left: left - contentBox.left, top: top - contentBox.top, width, height});

        const rows = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-track-row]') ?? []);
        const trackIds = new Set(
            rows
                .filter((row) => {
                    const rect = row.getBoundingClientRect();

                    return rect.bottom > top && rect.top < top + height;
                })
                .map((row) => row.dataset.trackRow as string)
        );
        const startTime = Math.max(0, (left - contentLeft()) / state.pixelsPerSecond);
        const endTime = Math.max(0, (left + width - contentLeft()) / state.pixelsPerSecond);
        const inside = clipsInRegion(sequence, startTime, endTime, trackIds);
        const expanded = state.linkedSelection ? withLinkedClips(sequence, inside) : inside;

        editorStore.set({selection: [...new Set([...d.baseSelection, ...expanded])]});
    }

    // === Releasing === //

    function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
        const d = drag.current;

        drag.current = null;
        setMarquee(null);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        if (!d) {
            return;
        }

        if (d.kind === 'move' || d.kind === 'trim') {
            if (d.moved && editorStore.get().liveSequence) {
                commitPreview(d.kind === 'move' ? 'Move clips' : d.ripple ? 'Ripple trim' : 'Trim clip');
            }

            cancelPreview();
        }

        showGuide(null, null);
    }

    return {marquee, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, timeAt, trackAt};
}
