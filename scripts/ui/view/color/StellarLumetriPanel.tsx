import {useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode} from 'react';
import type {Clip} from '../../../common/stellar/StellarContract';
import {COLOR_PARAMS, defaultCurve, normalizeColor, type ColorGroup, type CurvePoint} from '../../../common/stellar/StellarColor';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {findClip, findTrack} from '../../controller/timeline/StellarTimeline.Controller';
import {resetColor, updateColor} from '../../controller/timeline/StellarClipEdit.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarPropertyRow from '../effects/StellarPropertyRow';
import styles from './StellarLumetriPanel.module.css';

// Color tuning in the style of Premiere's Lumetri Color: basic correction, creative, color wheels and a curve.

const GROUPS: ColorGroup[] = ['Basic', 'Creative', 'Color Wheels'];
const CURVE_SIZE = 180;

function Group({title, children, open, onToggle}: {title: string; children: ReactNode; open: boolean; onToggle: () => void}) {
    return (
        <div className={styles.section} data-theme="StellarLumetri.section">
            <button type="button" className={styles.rowButton} onClick={onToggle}>
                <StellarIcon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
                {title}
            </button>
            {open ? children : null}
        </div>
    );
}

/** The curve: drag the points. Click an empty place to add one. Double-click a point to remove it. */
function CurveEditor({clip, ids}: {clip: Clip; ids: string[]}) {
    const curve = normalizeColor(clip.color).curve;
    const svgRef = useRef<SVGSVGElement | null>(null);
    const dragging = useRef<number | null>(null);

    function pointFrom(event: ReactPointerEvent): CurvePoint {
        const box = (svgRef.current as SVGSVGElement).getBoundingClientRect();

        return {
            x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
            y: Math.min(1, Math.max(0, 1 - (event.clientY - box.top) / box.height))
        };
    }

    function replace(points: CurvePoint[], isFinal: boolean) {
        updateColor(ids, {curve: [...points].sort((first, second) => first.x - second.x)}, isFinal, 'Change curve');
    }

    const path = [...curve].sort((first, second) => first.x - second.x).map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x * CURVE_SIZE},${(1 - point.y) * CURVE_SIZE}`).join(' ');

    return (
        <div className={styles.div}>
            <svg
                ref={svgRef}
                width={CURVE_SIZE}
                height={CURVE_SIZE}
                className={styles.curve}
                data-theme="StellarLumetri.curve"
                onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) {
                        return;
                    }

                    const point = pointFrom(event);

                    replace([...curve, point], true);
                }}
                onPointerMove={(event) => {
                    if (dragging.current === null) {
                        return;
                    }

                    const point = pointFrom(event);
                    const index = dragging.current;
                    const isEnd = index === 0 || index === curve.length - 1;

                    // The two end points can only go up and down.
                    const next = curve.map((item, position) => (position === index ? {x: isEnd ? item.x : point.x, y: point.y} : item));

                    replace(next, false);
                }}
                onPointerUp={(event) => {
                    if (dragging.current !== null) {
                        const point = pointFrom(event);
                        const index = dragging.current;
                        const isEnd = index === 0 || index === curve.length - 1;

                        replace(curve.map((item, position) => (position === index ? {x: isEnd ? item.x : point.x, y: point.y} : item)), true);
                    }

                    dragging.current = null;
                }}
            >
                {[0.25, 0.5, 0.75].map((line) => (
                    <g key={line} stroke="currentColor" strokeOpacity="0.12">
                        <line x1={line * CURVE_SIZE} y1="0" x2={line * CURVE_SIZE} y2={CURVE_SIZE} />
                        <line x1="0" y1={line * CURVE_SIZE} x2={CURVE_SIZE} y2={line * CURVE_SIZE} />
                    </g>
                ))}
                <line x1="0" y1={CURVE_SIZE} x2={CURVE_SIZE} y2="0" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
                <path d={path} fill="none" stroke="var(--color-accent, #6aa7ff)" strokeWidth="2" />
                {curve.map((point, index) => (
                    <circle
                        key={`${point.x}-${index}`}
                        cx={point.x * CURVE_SIZE}
                        cy={(1 - point.y) * CURVE_SIZE}
                        r="5"
                        fill="var(--color-accent, #6aa7ff)"
                        stroke="white"
                        strokeWidth="1"
                        className={styles.circle}
                        onPointerDown={(event) => {
                            event.stopPropagation();
                            (svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId);
                            dragging.current = index;
                        }}
                        onDoubleClick={() => {
                            if (index > 0 && index < curve.length - 1) {
                                replace(curve.filter((_, position) => position !== index), true);
                            }
                        }}
                    />
                ))}
            </svg>
            <div className={styles.row}>
                Click to add a point. Double-click a point to remove it.
                <button type="button" className={styles.button} onClick={() => updateColor(ids, {curve: defaultCurve()}, true, 'Reset curve')}>Reset</button>
            </div>
        </div>
    );
}

export default function StellarLumetriPanel() {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const selection = useStore(editorStore, (state) => state.selection);
    const [open, setOpen] = useState<Record<string, boolean>>({Basic: true, Creative: true, 'Color Wheels': false, Curves: false});
    const clip = sequence && selection[0] ? findClip(sequence, selection[0]) : undefined;
    const track = sequence && clip ? findTrack(sequence, clip.trackId) : undefined;

    if (!clip || !track || track.type !== 'video') {
        return (
            <div className={styles.panel} data-theme="StellarLumetri.panel">
                <StellarIcon name="palette" size={28} />
                <p className={styles.textP}>Select a video clip to tune its color.</p>
            </div>
        );
    }

    const color = normalizeColor(clip.color);
    const ids = selection;

    return (
        <div className={styles.panel2} data-theme="StellarLumetri.panel">
            <div className={styles.row2}>
                <span className={styles.textSpan}>{clip.name}</span>
                <label className={styles.rowLabel}>
                    <input type="checkbox" checked={color.enabled} onChange={(event) => updateColor(ids, {enabled: event.target.checked}, true, 'Toggle color')} />
                    On
                </label>
                <button type="button" className={styles.textButton} onClick={() => resetColor(ids)}>Reset all</button>
            </div>

            {GROUPS.map((group) => (
                <Group key={group} title={group} open={open[group] ?? false} onToggle={() => setOpen({...open, [group]: !open[group]})}>
                    {COLOR_PARAMS.filter((param) => param.group === group).map((param) => (
                        <StellarPropertyRow key={param.key} clip={clip} ids={ids} path={`color.${param.key}`} showLane={false} />
                    ))}
                </Group>
            ))}

            <Group title="Curves" open={open['Curves'] ?? false} onToggle={() => setOpen({...open, Curves: !open['Curves']})}>
                <CurveEditor clip={clip} ids={ids} />
            </Group>
        </div>
    );
}
