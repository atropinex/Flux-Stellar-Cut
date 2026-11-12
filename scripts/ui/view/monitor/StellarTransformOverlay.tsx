import {useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import {PATH} from '../../../common/stellar/StellarAnimation';
import type {Clip} from '../../../common/stellar/StellarContract';
import {resolveClip} from '../../../common/stellar/StellarEvaluate';
import {clamp} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getMedia, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {findClip, findTrack} from '../../controller/timeline/StellarTimeline.Controller';
import {commitProperties, previewProperties} from '../../controller/timeline/StellarClipEdit.Controller';
import {cancelPreview} from '../../controller/timeline/StellarTimelineActions.Controller';
import {maskUiStore} from '../../controller/timeline/StellarMaskUi.Controller';
import {
    anchorOnStage, moveAnchor, pictureCorners, rotateBy, scaleBy, snapMove, type Point, type TransformMotion
} from './StellarTransformMath';
import styles from './StellarTransformOverlay.module.css';

// The box around the selected clip on the Program monitor, like the one in Premiere Pro.
//   Drag inside the box ....... move the clip (it sticks to the center and the edges of the frame)
//   Drag a corner ............. scale around the anchor point
//   Drag the round handle ..... rotate around the anchor point (hold Shift for steps of 15 degrees)
//   Drag the cross ............ move the anchor point. The picture stays where it is.
// Hold Alt to turn the sticking off.

const SNAP_PIXELS = 6;
const ROTATE_HANDLE_DISTANCE = 26;
const ROTATE_STEP = 15;
const EDGE_ROOM = 6; // how far the handles may stick out of the monitor

type DragKind = 'move' | 'scale' | 'rotate' | 'anchor';

interface Drag {
    kind: DragKind;
    start: TransformMotion;
    grabbed: Point;
    corners: Point[];
    moved: boolean;
}

/** The size of the clip's picture on the stage, in screen pixels. */
function pictureSize(clip: Clip, sequenceWidth: number, sequenceHeight: number, stageWidth: number, stageHeight: number): {width: number; height: number} {
    const state = editorStore.get();
    const media = getMedia(state, clip.mediaId);
    const inner = clip.nestId ? state.document?.sequences.find((item) => item.id === clip.nestId)?.settings : undefined;
    const sourceWidth = clip.text ? sequenceWidth : media?.width ?? inner?.width ?? sequenceWidth;
    const sourceHeight = clip.text ? sequenceHeight : media?.height ?? inner?.height ?? sequenceHeight;
    const ratio = Math.min(stageWidth / sourceWidth, stageHeight / sourceHeight);

    return {width: sourceWidth * ratio, height: sourceHeight * ratio};
}

export default function StellarTransformOverlay({stageWidth, stageHeight}: {stageWidth: number; stageHeight: number}) {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const selection = useStore(editorStore, (state) => state.selection);
    const tool = useStore(editorStore, (state) => state.tool);
    const playhead = useStore(editorStore, (state) => state.playhead);
    const selectedMaskId = useStore(maskUiStore, (state) => state.selectedMaskId);
    const [guides, setGuides] = useState<{x: number | null; y: number | null}>({x: null, y: null});
    const svgRef = useRef<SVGSVGElement | null>(null);
    const drag = useRef<Drag | null>(null);
    // A video clip is often selected together with its sound. The box belongs to the video clip, if there is exactly one.
    const selectedVideoClips = sequence
        ? selection.map((id) => findClip(sequence, id)).filter((item): item is Clip => !!item && findTrack(sequence, item.trackId)?.type === 'video')
        : [];
    const clip = selectedVideoClips.length === 1 ? selectedVideoClips[0] : undefined;
    const track = sequence && clip ? findTrack(sequence, clip.trackId) : undefined;
    const isVisible = clip && track && sequence && track.type === 'video' && !track.locked && tool === 'selection' && selectedMaskId === null
        && stageWidth > 0 && playhead >= clip.start && playhead <= clip.start + clip.duration;

    if (!isVisible || !clip || !sequence) {
        return null;
    }

    const activeClip = clip;
    const unit = stageWidth / sequence.settings.width;
    const resolved = resolveClip(activeClip, playhead).motion;
    const motion: TransformMotion = {
        x: resolved.x, y: resolved.y, scale: resolved.scale, rotation: resolved.rotation, anchorX: resolved.anchorX, anchorY: resolved.anchorY
    };
    const size = pictureSize(activeClip, sequence.settings.width, sequence.settings.height, stageWidth, stageHeight);
    const corners = pictureCorners(motion, unit, size.width, size.height);
    const anchor = anchorOnStage(motion, unit);
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const ids = [activeClip.id];

    // The round handle sits above the top edge, in the direction the clip's "up" points to.
    const topMiddle = {x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2};
    const up = {x: corners[0].x - corners[3].x, y: corners[0].y - corners[3].y};
    const upLength = Math.hypot(up.x, up.y) || 1;
    const outside = {x: topMiddle.x + (up.x / upLength) * ROTATE_HANDLE_DISTANCE, y: topMiddle.y + (up.y / upLength) * ROTATE_HANDLE_DISTANCE};
    // When the clip fills the frame, the handle would land outside the monitor where it cannot be reached. Then it moves inside the box.
    const isReachable = Math.abs(outside.x) <= stageWidth / 2 + EDGE_ROOM && Math.abs(outside.y) <= stageHeight / 2 + EDGE_ROOM;
    const rotateHandle = isReachable
        ? outside
        : {x: topMiddle.x - (up.x / upLength) * ROTATE_HANDLE_DISTANCE, y: topMiddle.y - (up.y / upLength) * ROTATE_HANDLE_DISTANCE};

    function stagePoint(event: ReactPointerEvent): Point {
        const box = (svgRef.current as SVGSVGElement).getBoundingClientRect();

        return {x: event.clientX - box.left - centerX, y: event.clientY - box.top - centerY};
    }

    function startDrag(event: ReactPointerEvent, kind: DragKind) {
        event.stopPropagation();
        event.preventDefault();
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
        drag.current = {kind, start: motion, grabbed: stagePoint(event), corners, moved: false};
    }

    function valuesFor(current: Drag, event: ReactPointerEvent): Record<string, number> {
        const pointer = stagePoint(event);
        const wantsSnap = editorStore.get().snapping && !event.altKey;

        if (current.kind === 'move') {
            const raw = {x: pointer.x - current.grabbed.x, y: pointer.y - current.grabbed.y};
            const snapped = wantsSnap ? snapMove(current.corners, raw.x, raw.y, stageWidth, stageHeight, SNAP_PIXELS) : {dx: raw.x, dy: raw.y, guideX: null, guideY: null};

            setGuides({x: snapped.guideX, y: snapped.guideY});

            return {[PATH.x]: current.start.x + snapped.dx / unit, [PATH.y]: current.start.y + snapped.dy / unit};
        }

        if (current.kind === 'scale') {
            return {[PATH.scale]: clamp(scaleBy(current.start, unit, current.grabbed, pointer), 1, 800)};
        }

        if (current.kind === 'rotate') {
            return {[PATH.rotation]: rotateBy(current.start, unit, current.grabbed, pointer, event.shiftKey ? ROTATE_STEP : null)};
        }

        // Anchor. It sticks to the middle of the picture.
        let target = pointer;
        const middle = pictureCenterOnStage(current.start);

        if (wantsSnap && Math.hypot(pointer.x - middle.x, pointer.y - middle.y) < SNAP_PIXELS) {
            target = middle;
        }

        const next = moveAnchor(current.start, unit, target);

        return {[PATH.anchorX]: next.anchorX, [PATH.anchorY]: next.anchorY, [PATH.x]: next.x, [PATH.y]: next.y};
    }

    /** Where the center of the picture is on the stage. */
    function pictureCenterOnStage(from: TransformMotion): Point {
        const box = pictureCorners(from, unit, size.width, size.height);

        return {x: (box[0].x + box[2].x) / 2, y: (box[0].y + box[2].y) / 2};
    }

    function onPointerMove(event: ReactPointerEvent) {
        const current = drag.current;

        if (!current) {
            return;
        }

        const pointer = stagePoint(event);

        if (!current.moved && Math.hypot(pointer.x - current.grabbed.x, pointer.y - current.grabbed.y) < 2) {
            return;
        }

        current.moved = true;
        previewProperties(ids, valuesFor(current, event));
    }

    function onPointerUp(event: ReactPointerEvent) {
        const current = drag.current;

        drag.current = null;
        setGuides({x: null, y: null});

        if (!current) {
            return;
        }

        if (!current.moved) {
            cancelPreview();
            return;
        }

        const labels: Record<DragKind, string> = {move: 'Move clip', scale: 'Scale clip', rotate: 'Rotate clip', anchor: 'Move anchor point'};

        commitProperties(labels[current.kind], ids, valuesFor(current, event));
    }

    const corner = (index: number, cursor: string) => (
        <rect
            key={index}
            className={`${styles.handle} ${cursor}`}
            x={centerX + corners[index].x - 4}
            y={centerY + corners[index].y - 4}
            width={8}
            height={8}
            data-handle={`corner-${index}`}
            onPointerDown={(event) => startDrag(event, 'scale')}
        />
    );
    const outline = corners.map((point) => `${centerX + point.x},${centerY + point.y}`).join(' ');

    return (
        <svg
            ref={svgRef}
            className={styles.overlay}
            data-theme="StellarTransformOverlay.overlay"
            data-transform-overlay="true"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* Lines that show what the clip is sticking to */}
            {guides.x !== null ? <line className={styles.guide} x1={centerX + guides.x} x2={centerX + guides.x} y1={0} y2={stageHeight} data-guide="x" /> : null}
            {guides.y !== null ? <line className={styles.guide} y1={centerY + guides.y} y2={centerY + guides.y} x1={0} x2={stageWidth} data-guide="y" /> : null}

            <polygon className={styles.body} points={outline} data-handle="body" onPointerDown={(event) => startDrag(event, 'move')} />

            {corner(0, styles.cursorNwse)}
            {corner(1, styles.cursorNesw)}
            {corner(2, styles.cursorNwse)}
            {corner(3, styles.cursorNesw)}

            <line className={styles.stem} x1={centerX + topMiddle.x} y1={centerY + topMiddle.y} x2={centerX + rotateHandle.x} y2={centerY + rotateHandle.y} />
            <circle className={`${styles.handle} ${styles.cursorRotate}`} cx={centerX + rotateHandle.x} cy={centerY + rotateHandle.y} r={5} data-handle="rotate" onPointerDown={(event) => startDrag(event, 'rotate')} />

            <g className={styles.anchor} data-handle="anchor" onPointerDown={(event) => startDrag(event, 'anchor')}>
                <circle className={styles.anchorHit} cx={centerX + anchor.x} cy={centerY + anchor.y} r={11} />
                <circle className={styles.anchorRing} cx={centerX + anchor.x} cy={centerY + anchor.y} r={6} />
                <line className={styles.anchorCross} x1={centerX + anchor.x - 9} x2={centerX + anchor.x + 9} y1={centerY + anchor.y} y2={centerY + anchor.y} />
                <line className={styles.anchorCross} x1={centerX + anchor.x} x2={centerX + anchor.x} y1={centerY + anchor.y - 9} y2={centerY + anchor.y + 9} />
            </g>
        </svg>
    );
}
