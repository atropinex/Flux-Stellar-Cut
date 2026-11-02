import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import type {Clip, Sequence} from '../../../common/stellar/StellarContract';
import {resolveClip} from '../../../common/stellar/StellarEvaluate';
import {createMask, type Mask, type MaskPoint} from '../../../common/stellar/StellarMask';
import {editorStore, getMedia, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {findClip, findTrack} from '../../controller/timeline/StellarTimeline.Controller';
import {addMask, updateMask} from '../../controller/timeline/StellarClipEdit.Controller';
import {maskUiStore, selectMask} from '../../controller/timeline/StellarMaskUi.Controller';
import {setTool} from '../../controller/timeline/StellarTimelineActions.Controller';

// Shows the masks of the selected clip on top of the Program monitor, and lets you draw and edit them.
// Mask positions are fractions of the clip's own picture, so everything here is converted between the screen,
// the stage, and the picture (the picture is moved, scaled and turned by the clip's motion).

const HANDLE = 5;
const CLOSE_DISTANCE = 0.025;

interface Geometry {
    stageWidth: number;
    stageHeight: number;
    picture: { x: number; y: number; width: number; height: number };
    motion: { x: number; y: number; scale: number; rotation: number };
    sequenceWidth: number;
}

function geometryOf(clip: Clip, sequence: Sequence, stageWidth: number, stageHeight: number): Geometry {
    const state = editorStore.get();
    const media = getMedia(state, clip.mediaId);
    const inner = clip.nestId ? state.document?.sequences.find((item) => item.id === clip.nestId)?.settings : undefined;
    const sourceWidth = clip.text ? sequence.settings.width : media?.width ?? inner?.width ?? sequence.settings.width;
    const sourceHeight = clip.text ? sequence.settings.height : media?.height ?? inner?.height ?? sequence.settings.height;
    const ratio = Math.min(stageWidth / sourceWidth, stageHeight / sourceHeight);
    const width = sourceWidth * ratio;
    const height = sourceHeight * ratio;
    const resolved = resolveClip(clip, Math.min(clip.start + clip.duration, Math.max(clip.start, state.playhead)));
    const unit = stageWidth / sequence.settings.width;

    return {
        stageWidth, stageHeight,
        picture: {x: (stageWidth - width) / 2, y: (stageHeight - height) / 2, width, height},
        motion: {
            x: resolved.motion.x * unit,
            y: resolved.motion.y * unit,
            scale: resolved.motion.scale / 100,
            rotation: resolved.motion.rotation
        },
        sequenceWidth: sequence.settings.width
    };
}

/** From a point on the screen (relative to the top-left of the stage) to a fraction of the picture. */
function toPicture(geometry: Geometry, stageX: number, stageY: number): MaskPoint {
    const radians = (-geometry.motion.rotation * Math.PI) / 180;
    const dx = stageX - geometry.stageWidth / 2 - geometry.motion.x;
    const dy = stageY - geometry.stageHeight / 2 - geometry.motion.y;
    const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
    const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
    const localX = rotatedX / geometry.motion.scale + geometry.stageWidth / 2;
    const localY = rotatedY / geometry.motion.scale + geometry.stageHeight / 2;

    return {
        x: (localX - geometry.picture.x) / geometry.picture.width,
        y: (localY - geometry.picture.y) / geometry.picture.height
    };
}

function clamp01(value: number): number {
    return Math.min(1.5, Math.max(-0.5, value));
}

type DragKind = { type: 'move' } | { type: 'point'; index: number } | { type: 'corner'; sx: number; sy: number };

export default function StellarMaskOverlay({stageWidth, stageHeight}: { stageWidth: number; stageHeight: number }) {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const selection = useStore(editorStore, (state) => state.selection);
    const tool = useStore(editorStore, (state) => state.tool);
    const playhead = useStore(editorStore, (state) => state.playhead);
    const selectedMaskId = useStore(maskUiStore, (state) => state.selectedMaskId);
    const [drawing, setDrawing] = useState<MaskPoint[] | null>(null);
    const [hover, setHover] = useState<MaskPoint | null>(null);
    const drag = useRef<{ kind: DragKind; start: MaskPoint; original: Mask } | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const clip = sequence && selection[0] ? findClip(sequence, selection[0]) : undefined;
    const track = sequence && clip ? findTrack(sequence, clip.trackId) : undefined;
    const isPen = tool === 'pen';

    // Leaving the pen tool or changing the clip drops a half-drawn shape.
    useEffect(() => {
        setDrawing(null);
    }, [tool, clip?.id]);

    useEffect(() => {
        if (!drawing) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setDrawing(null);
            }

            if (event.key === 'Enter') {
                finish(drawing);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    if (!sequence || !clip || !track || track.type !== 'video' || stageWidth <= 0) {
        return null;
    }

    const activeClip = clip;
    const geometry = geometryOf(activeClip, sequence, stageWidth, stageHeight);
    const masks = activeClip.masks ?? [];
    void playhead;

    function stagePoint(event: ReactPointerEvent): { x: number; y: number } {
        const box = (svgRef.current as SVGSVGElement).getBoundingClientRect();

        return {x: event.clientX - box.left, y: event.clientY - box.top};
    }

    function pointOf(event: ReactPointerEvent): MaskPoint {
        const point = stagePoint(event);

        return toPicture(geometry, point.x, point.y);
    }

    function finish(points: MaskPoint[]) {
        setDrawing(null);

        if (points.length >= 3) {
            const mask = createMask('polygon', points);

            addMask(activeClip.id, mask);
            selectMask(mask.id);
        }

        setTool('selection');
    }

    function startDrag(event: ReactPointerEvent, mask: Mask, kind: DragKind) {
        event.stopPropagation();
        (svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId);
        selectMask(mask.id);
        drag.current = {kind, start: pointOf(event), original: mask};
    }

    function changeFor(event: ReactPointerEvent): Partial<Mask> | null {
        const current = drag.current;

        if (!current) {
            return null;
        }

        const point = pointOf(event);
        const dx = point.x - current.start.x;
        const dy = point.y - current.start.y;
        const mask = current.original;

        if (current.kind.type === 'move') {
            return mask.shape === 'polygon'
                ? {points: mask.points.map((item) => ({x: item.x + dx, y: item.y + dy}))}
                : {cx: mask.cx + dx, cy: mask.cy + dy};
        }

        if (current.kind.type === 'point') {
            const index = current.kind.index;

            return {
                points: mask.points.map((item, position) => (position === index ? {
                    x: clamp01(point.x),
                    y: clamp01(point.y)
                } : item))
            };
        }

        // A corner: the opposite corner stays where it is.
        const {sx, sy} = current.kind;
        const left = mask.cx - mask.width / 2;
        const top = mask.cy - mask.height / 2;
        const anchorX = sx > 0 ? left : left + mask.width;
        const anchorY = sy > 0 ? top : top + mask.height;
        const width = Math.max(0.02, Math.abs(point.x - anchorX));
        const height = Math.max(0.02, Math.abs(point.y - anchorY));

        return {width, height, cx: (point.x + anchorX) / 2, cy: (point.y + anchorY) / 2};
    }

    const toScreenX = (fraction: number) => geometry.picture.x + fraction * geometry.picture.width;
    const toScreenY = (fraction: number) => geometry.picture.y + fraction * geometry.picture.height;
    const transform = `translate(${geometry.motion.x} ${geometry.motion.y}) rotate(${geometry.motion.rotation} ${stageWidth / 2} ${stageHeight / 2}) translate(${stageWidth / 2} ${stageHeight / 2}) scale(${geometry.motion.scale}) translate(${-stageWidth / 2} ${-stageHeight / 2})`;
    const accent = 'var(--color-accent, #6aa7ff)';

    function outline(mask: Mask, isSelected: boolean) {
        const stroke = isSelected ? accent : 'rgba(255,255,255,0.7)';
        const common = {
            fill: isSelected ? 'rgba(106,167,255,0.08)' : 'none',
            stroke,
            strokeWidth: isSelected ? 1.6 : 1,
            vectorEffect: 'non-scaling-stroke' as const
        };

        if (mask.shape === 'polygon') {
            const points = mask.points.map((point) => `${toScreenX(point.x)},${toScreenY(point.y)}`).join(' ');

            return <polygon points={points} {...common}
                            onPointerDown={(event) => startDrag(event, mask, {type: 'move'})}/>;
        }

        const cx = toScreenX(mask.cx);
        const cy = toScreenY(mask.cy);
        const width = mask.width * geometry.picture.width;
        const height = mask.height * geometry.picture.height;
        const rotate = `rotate(${mask.rotation} ${cx} ${cy})`;

        return mask.shape === 'ellipse'
            ? <ellipse cx={cx} cy={cy} rx={width / 2} ry={height / 2} transform={rotate} {...common}
                       onPointerDown={(event) => startDrag(event, mask, {type: 'move'})}/>
            : <rect x={cx - width / 2} y={cy - height / 2} width={width} height={height} transform={rotate} {...common}
                    onPointerDown={(event) => startDrag(event, mask, {type: 'move'})}/>;
    }

    function handles(mask: Mask) {
        if (mask.shape === 'polygon') {
            return mask.points.map((point, index) => (
                <rect
                    key={index} x={toScreenX(point.x) - HANDLE} y={toScreenY(point.y) - HANDLE} width={HANDLE * 2}
                    height={HANDLE * 2}
                    fill="white" stroke={accent} className="cursor-move"
                    onPointerDown={(event) => startDrag(event, mask, {type: 'point', index})}
                    onDoubleClick={() => {
                        if (mask.points.length > 3) {
                            updateMask(activeClip.id, mask.id, {points: mask.points.filter((_, position) => position !== index)}, true);
                        }
                    }}
                />
            ));
        }

        const cx = toScreenX(mask.cx);
        const cy = toScreenY(mask.cy);
        const halfWidth = (mask.width * geometry.picture.width) / 2;
        const halfHeight = (mask.height * geometry.picture.height) / 2;

        return ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => {
            const radians = (mask.rotation * Math.PI) / 180;
            const ox = sx * halfWidth;
            const oy = sy * halfHeight;
            const x = cx + ox * Math.cos(radians) - oy * Math.sin(radians);
            const y = cy + ox * Math.sin(radians) + oy * Math.cos(radians);

            return (
                <rect
                    key={`${sx}${sy}`} x={x - HANDLE} y={y - HANDLE} width={HANDLE * 2} height={HANDLE * 2} fill="white"
                    stroke={accent} className="cursor-nwse-resize"
                    onPointerDown={(event) => startDrag(event, mask, {type: 'corner', sx, sy})}
                />
            );
        });
    }

    return (
        <svg
            ref={svgRef}
            className={`absolute inset-0 h-full w-full ${isPen ? 'cursor-crosshair' : ''}`}
            style={{pointerEvents: isPen || masks.length > 0 ? 'auto' : 'none'}}
            data-theme="StellarMaskOverlay.overlay"
            onPointerDown={(event) => {
                if (isPen) {
                    const point = pointOf(event);
                    const first = drawing?.[0];

                    if (drawing && first && drawing.length >= 3 && Math.hypot((point.x - first.x) * geometry.picture.width, (point.y - first.y) * geometry.picture.height) < CLOSE_DISTANCE * geometry.picture.width) {
                        finish(drawing);
                        return;
                    }

                    setDrawing([...(drawing ?? []), point]);
                    return;
                }

                if (event.target === event.currentTarget) {
                    selectMask(null);
                }
            }}
            onDoubleClick={() => {
                if (isPen && drawing) {
                    finish(drawing.slice(0, -1));
                }
            }}
            onPointerMove={(event) => {
                if (isPen) {
                    setHover(pointOf(event));
                }

                const change = changeFor(event);

                if (change && drag.current) {
                    updateMask(activeClip.id, drag.current.original.id, change, false);
                }
            }}
            onPointerUp={(event) => {
                const change = changeFor(event);

                if (change && drag.current) {
                    updateMask(activeClip.id, drag.current.original.id, change, true);
                }

                drag.current = null;
            }}
        >
            <g transform={transform}>
                {masks.map((mask) => (
                    <g key={mask.id} opacity={mask.enabled ? 1 : 0.35}>{outline(mask, mask.id === selectedMaskId)}</g>
                ))}
                {masks.filter((mask) => mask.id === selectedMaskId).map((mask) => <g
                    key={`h-${mask.id}`}>{handles(mask)}</g>)}

                {drawing ? (
                    <g>
                        <polyline
                            points={[...drawing, ...(hover ? [hover] : [])].map((point) => `${toScreenX(point.x)},${toScreenY(point.y)}`).join(' ')}
                            fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3"
                            vectorEffect="non-scaling-stroke"
                        />
                        {drawing.map((point, index) => (
                            <rect key={index} x={toScreenX(point.x) - 3} y={toScreenY(point.y) - 3} width="6" height="6"
                                  fill={index === 0 ? accent : 'white'} stroke={accent}/>
                        ))}
                    </g>
                ) : null}
            </g>
        </svg>
    );
}
