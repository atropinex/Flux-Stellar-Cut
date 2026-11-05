import {useRef, type MouseEvent as ReactMouseEvent} from 'react';
import type {Clip} from '../../../common/stellar/StellarContract';
import {EASINGS, findKeyframeIndex, type EasingId} from '../../../common/stellar/StellarAnimation';
import {contentTime} from '../../../common/stellar/StellarEvaluate';
import {isAnimatedProperty, keyframeTimelineTime, propertyInfo} from '../../../common/stellar/StellarProperty';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {openContextMenu} from '../../controller/contextmenu/StellarContextMenu.Controller';
import {seekTo} from '../../controller/playback/StellarPlayback.Controller';
import {
    commitProperty, deleteKeyframeOf, jumpToKeyframe, moveKeyframeOf, previewProperty, resetProperty, setEasingOf, toggleAnimationOf, toggleKeyframeOf,
    valueOfProperty
} from '../../controller/timeline/StellarClipEdit.Controller';
import StellarScrubNumber from '../common/StellarScrubNumber';
import styles from './StellarPropertyRow.module.css';

// One line of the Effect Controls: stopwatch, name, number, keyframe buttons and the small timeline beside it.
// The numbers are never sliders. Drag them sideways or click and type.

interface PropertyRowProps {
    clip: Clip;
    ids: string[];       // every clip that gets the change (the whole selection)
    path: string;
    label?: string;
    showLane?: boolean;
    indent?: boolean;
}

function Stopwatch({active}: {active: boolean}) {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={active ? styles.textSvgActive : styles.textSvgNotActive}>
            <circle cx="8" cy="9" r="5" fill={active ? 'currentColor' : 'none'} fillOpacity={0.25} />
            <path d="M8 9V6M6.5 2h3" />
        </svg>
    );
}

function Diamond({filled, size = 10}: {filled: boolean; size?: number}) {
    return (
        <svg width={size} height={size} viewBox="0 0 10 10">
            <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" />
        </svg>
    );
}

function Arrow({direction}: {direction: 'previous' | 'next'}) {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d={direction === 'previous' ? 'M7.5 1 2.5 5l5 4Z' : 'M2.5 1l5 4-5 4Z'} />
        </svg>
    );
}

export default function StellarPropertyRow({clip, ids, path, label, showLane = true, indent = true}: PropertyRowProps) {
    const playhead = useStore(editorStore, (state) => state.playhead);
    const drag = useRef<{ from: number; latest: number } | null>(null);
    const laneRef = useRef<HTMLDivElement | null>(null);
    const info = propertyInfo(clip, path);

    if (!info) {
        return null;
    }

    const animated = isAnimatedProperty(clip, path);
    const keyframes = clip.keyframes?.[path] ?? [];
    const now = contentTime(clip, Math.min(clip.start + clip.duration, Math.max(clip.start, playhead)));
    const onKeyframe = animated && findKeyframeIndex(keyframes, now) >= 0;
    const value = valueOfProperty(clip, path);
    const playheadInside = playhead >= clip.start && playhead <= clip.start + clip.duration;
    const fractionOf = (timelineTime: number) => (clip.duration > 0 ? (timelineTime - clip.start) / clip.duration : 0);

    function timeAtPointer(clientX: number): number {
        const lane = laneRef.current;

        if (!lane) {
            return clip.start;
        }

        const box = lane.getBoundingClientRect();
        const fraction = Math.min(1, Math.max(0, (clientX - box.left) / Math.max(1, box.width)));

        return clip.start + fraction * clip.duration;
    }

    function easingMenu(event: ReactMouseEvent, keyframeContentTime: number, current: EasingId) {
        openContextMenu(event, [
            ...EASINGS.map((easing) => ({
                id: easing.id,
                label: easing.label,
                checked: easing.id === current,
                action: () => setEasingOf(clip.id, path, keyframeContentTime, easing.id)
            })),
            {id: 'sep', label: '', separator: true},
            {id: 'delete', label: 'Delete Keyframe', danger: true, action: () => deleteKeyframeOf(clip.id, path, keyframeContentTime)}
        ]);
    }

    const currentKeyframe = onKeyframe ? keyframes[findKeyframeIndex(keyframes, now)] : null;

    return (
        <div className={`${styles.row} ${indent ? styles.rowIndent : styles.rowNotIndent}`} data-theme="StellarEffectControls.row">
            <button
                type="button"
                title={animated ? 'Stop animating (removes all keyframes)' : 'Start animating this value'}
                className={styles.button}
                onClick={() => toggleAnimationOf(clip.id, path)}
            >
                <Stopwatch active={animated} />
            </button>

            <span className={styles.textSpan} title={label ?? info.label}>{label ?? info.label}</span>

            <div className={styles.box}>
                <StellarScrubNumber
                    value={value}
                    min={info.min}
                    max={info.max}
                    step={info.step}
                    unit={info.unit}
                    decimals={info.decimals}
                    onChange={(next) => previewProperty(ids, path, next)}
                    onCommit={(next) => commitProperty(ids, path, next)}
                    onReset={() => resetProperty(ids, path)}
                />
            </div>

            <div className={styles.row2}>
                {animated ? (
                    <button type="button" title="Previous keyframe" className={styles.button2} onClick={() => jumpToKeyframe(clip.id, path, 'previous')}>
                        <Arrow direction="previous" />
                    </button>
                ) : <span className={styles.boxSpan} />}
                <button
                    type="button"
                    title={onKeyframe ? 'Remove the keyframe here' : 'Add a keyframe here'}
                    className={`${styles.button} ${onKeyframe ? styles.textSvgActive : styles.buttonNotOnKeyframe}`}
                    onClick={() => toggleKeyframeOf(clip.id, path)}
                >
                    <Diamond filled={onKeyframe} />
                </button>
                {animated ? (
                    <button type="button" title="Next keyframe" className={styles.button2} onClick={() => jumpToKeyframe(clip.id, path, 'next')}>
                        <Arrow direction="next" />
                    </button>
                ) : <span className={styles.boxSpan} />}
            </div>

            {showLane ? (
                <div
                    ref={laneRef}
                    className={styles.lane}
                    data-theme="StellarEffectControls.lane"
                    title="Click to move the playhead"
                    onPointerDown={(event) => {
                        if (event.target === event.currentTarget) {
                            seekTo(timeAtPointer(event.clientX));
                        }
                    }}
                >
                    {animated && keyframes.length > 1 ? (
                        <div
                            className={styles.div}
                            style={{
                                left: `${Math.min(...keyframes.map((item) => fractionOf(keyframeTimelineTime(clip, item.time)))) * 100}%`,
                                right: `${(1 - Math.max(...keyframes.map((item) => fractionOf(keyframeTimelineTime(clip, item.time))))) * 100}%`
                            }}
                        />
                    ) : null}

                    {keyframes.map((keyframe) => {
                        const position = Math.min(1, Math.max(0, fractionOf(keyframeTimelineTime(clip, keyframe.time))));
                        const isHere = Math.abs(keyframe.time - now) < 1e-4;

                        return (
                            <button
                                key={keyframe.time}
                                type="button"
                                title={`${EASINGS.find((easing) => easing.id === keyframe.easing)?.label ?? 'Linear'}. Drag to move, right-click for easing.`}
                                className={`${styles.button3} ${isHere ? styles.textSvgActive : styles.textButtonNotIsHere}`}
                                style={{left: `${position * 100}%`}}
                                onPointerDown={(event) => {
                                    event.stopPropagation();
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    drag.current = {from: keyframe.time, latest: keyframe.time};
                                }}
                                onPointerMove={(event) => {
                                    if (!drag.current) {
                                        return;
                                    }

                                    const target = contentTime(clip, timeAtPointer(event.clientX));

                                    drag.current.latest = target;
                                    moveKeyframeOf(clip.id, path, drag.current.from, target, false);
                                }}
                                onPointerUp={(event) => {
                                    event.currentTarget.releasePointerCapture(event.pointerId);

                                    if (drag.current && Math.abs(drag.current.latest - drag.current.from) > 1e-6) {
                                        moveKeyframeOf(clip.id, path, drag.current.from, drag.current.latest, true);
                                    } else {
                                        seekTo(keyframeTimelineTime(clip, keyframe.time));
                                    }

                                    drag.current = null;
                                }}
                                onContextMenu={(event) => easingMenu(event, keyframe.time, keyframe.easing)}
                            >
                                <Diamond filled size={9} />
                            </button>
                        );
                    })}

                    {playheadInside ? (
                        <div className={styles.overlay} style={{left: `${fractionOf(playhead) * 100}%`}} />
                    ) : null}
                </div>
            ) : null}

            {showLane && currentKeyframe ? (
                <select
                    className={styles.textSelect}
                    title="How the value moves from this keyframe to the next one"
                    value={currentKeyframe.easing}
                    onChange={(event) => setEasingOf(clip.id, path, currentKeyframe.time, event.target.value as EasingId)}
                >
                    {EASINGS.map((easing) => <option key={easing.id} value={easing.id}>{easing.label}</option>)}
                </select>
            ) : showLane ? <span className={styles.boxSpan2} /> : null}
        </div>
    );
}
