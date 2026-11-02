import {useState, type ReactNode} from 'react';
import type {FrameMode} from '../../../common/stellar/StellarContract';
import {MAX_SPEED_PERCENT, MIN_SPEED_PERCENT} from '../../../common/stellar/StellarConfig';
import {editorStore, getActiveSequence} from '../../controller/project/StellarEditor.Store';
import {findClip} from '../../controller/timeline/StellarTimeline.Controller';
import {applySpeed} from '../../controller/timeline/StellarClipEdit.Controller';
import StellarDialog from '../common/StellarDialog';
import StellarScrubNumber from '../common/StellarScrubNumber';
import {BUTTON, BUTTON_PRIMARY} from '../common/StellarStyles';

// The small window that opens from "Speed/Duration..." in the clip menu (and Ctrl+R).

const FRAME_MODES: { id: FrameMode; label: string; hint: string }[] = [
    {id: 'sampling', label: 'Frame Sampling', hint: 'Repeats or skips frames. Fast and sharp.'},
    {id: 'blending', label: 'Frame Blending', hint: 'Mixes neighbouring frames. Smoother slow motion.'},
    {
        id: 'opticalFlow',
        label: 'Optical Flow',
        hint: 'Makes new frames by following the motion. Best for slow motion, slowest to render.'
    }
];

// The slider is logarithmic, so 50% and 200% are the same distance from 100%.
const SLIDER_MIN_PERCENT = 10;
const SLIDER_MAX_PERCENT = 1000;

function percentToSlider(percent: number): number {
    const clamped = Math.min(SLIDER_MAX_PERCENT, Math.max(SLIDER_MIN_PERCENT, percent));

    return (Math.log(clamped / SLIDER_MIN_PERCENT) / Math.log(SLIDER_MAX_PERCENT / SLIDER_MIN_PERCENT)) * 1000;
}

function sliderToPercent(position: number): number {
    return SLIDER_MIN_PERCENT * Math.pow(SLIDER_MAX_PERCENT / SLIDER_MIN_PERCENT, position / 1000);
}

function Row({label, hint, children}: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div className="flex min-h-9 items-center gap-3 py-1" title={hint}>
            <span className="w-24 shrink-0 text-[12px] text-dim">{label}</span>
            <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
        </div>
    );
}

export default function StellarSpeedDialog() {
    const ids = editorStore.get().selection;
    const sequence = getActiveSequence();
    const first = sequence ? findClip(sequence, ids[0]) : undefined;

    const [percent, setPercent] = useState(Math.round((first?.speed ?? 1) * 1000) / 10);
    const [reverse, setReverse] = useState(first?.reverse ?? false);
    const [ripple, setRipple] = useState(false);
    const [frameMode, setFrameMode] = useState<FrameMode>(first?.frameMode ?? 'sampling');
    const [maintainPitch, setMaintainPitch] = useState(first?.maintainPitch ?? true);

    if (!first) {
        return null;
    }

    const fixedLength = Boolean(first.text) || Boolean(first.nestId);
    // The length the clip would have with the speed that is typed now.
    const duration = (first.duration * first.speed * 100) / Math.max(MIN_SPEED_PERCENT, percent);
    const close = () => editorStore.set({dialog: null});

    function setSpeed(next: number) {
        setPercent(Math.max(MIN_SPEED_PERCENT, Math.min(MAX_SPEED_PERCENT, Math.round(next * 10) / 10)));
    }

    function apply() {
        applySpeed(ids, {
            speedPercent: fixedLength ? undefined : percent,
            reverse,
            frameMode,
            maintainPitch,
            ripple
        }, ripple ? 'Speed (ripple)' : 'Change speed');
        close();
    }

    return (
        <StellarDialog
            title="Clip Speed / Duration"
            width={440}
            onClose={close}
            footer={(
                <>
                    <button type="button" className={BUTTON} onClick={close}>Cancel</button>
                    <button type="button" className={BUTTON_PRIMARY} onClick={apply}>OK</button>
                </>
            )}
        >
            <p className="mb-2 truncate text-[12px] text-dim">{ids.length > 1 ? `${ids.length} clips selected` : first.name}</p>

            <Row label="Speed" hint="100% is normal. Above 100% is faster, below is slower.">
                <div className="w-20 shrink-0">
                    <StellarScrubNumber
                        value={percent} min={MIN_SPEED_PERCENT} max={MAX_SPEED_PERCENT} step={0.1} unit="%" decimals={1}
                        onChange={setSpeed} onCommit={setSpeed} onReset={() => setSpeed(100)}
                    />
                </div>
                <input
                    type="range" min={0} max={1000} step={1} className="min-w-0 flex-1" disabled={fixedLength}
                    value={percentToSlider(percent)} title="Speed from 10% to 1000%"
                    onChange={(event) => setSpeed(sliderToPercent(Number(event.target.value)))}
                />
            </Row>

            <Row label="Duration" hint="Changing the length changes the speed to fit.">
                <div className="w-20 shrink-0">
                    <StellarScrubNumber
                        value={Math.round(duration * 100) / 100} min={0.04} max={36000} step={0.04} unit="s"
                        decimals={2}
                        onChange={(next) => setSpeed((first.duration * first.speed * 100) / Math.max(0.04, next))}
                        onCommit={(next) => setSpeed((first.duration * first.speed * 100) / Math.max(0.04, next))}
                    />
                </div>
            </Row>

            <Row label="Reverse">
                <label className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={reverse} onChange={(event) => setReverse(event.target.checked)}/>
                    Play backwards
                </label>
            </Row>

            <Row label="Ripple edit" hint="The clips after this one move to close or open the gap.">
                <label className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={ripple} onChange={(event) => setRipple(event.target.checked)}/>
                    Shift trailing clips
                </label>
            </Row>

            <Row label="Frames" hint={FRAME_MODES.find((mode) => mode.id === frameMode)?.hint}>
                <select
                    className="min-w-0 flex-1 rounded-md border border-line bg-deep px-1.5 py-1 text-[12px] outline-none focus:border-accent"
                    value={frameMode} onChange={(event) => setFrameMode(event.target.value as FrameMode)}
                >
                    {FRAME_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                </select>
            </Row>
            <p className="pl-[108px] text-[11px] leading-snug text-dim">{FRAME_MODES.find((mode) => mode.id === frameMode)?.hint}</p>

            <Row label="Pitch">
                <label className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={maintainPitch}
                           onChange={(event) => setMaintainPitch(event.target.checked)}/>
                    Maintain audio pitch
                </label>
            </Row>
        </StellarDialog>
    );
}
