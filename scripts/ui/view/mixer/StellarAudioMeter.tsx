import {useEffect, useRef} from 'react';
import {audioEngine, gainToDb} from '../../controller/playback/StellarAudioEngine';

// A stereo level meter. It reads the mixing desk many times a second and moves the bars by hand,
// so the rest of the page does not need to redraw.

const FLOOR_DB = -60;
const CEILING_DB = 6;
const HOLD_MILLISECONDS = 900;
const FALL_DB_PER_SECOND = 40;

function positionOf(db: number): number {
    return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
}

export const METER_MARKS = [6, 0, -6, -12, -24, -36, -48];

interface MeterProps {
    busId?: string;      // a track id, or nothing for the master
    className?: string;
    showScale?: boolean;
}

export default function StellarAudioMeter({busId, className = '', showScale = false}: MeterProps) {
    const barLeft = useRef<HTMLDivElement | null>(null);
    const barRight = useRef<HTMLDivElement | null>(null);
    const holdLeft = useRef<HTMLDivElement | null>(null);
    const holdRight = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let frame = 0;
        let last = performance.now();
        const shown = [FLOOR_DB, FLOOR_DB];
        const held = [FLOOR_DB, FLOOR_DB];
        const heldAt = [0, 0];

        function tick(now: number) {
            const elapsed = (now - last) / 1000;
            const reading = busId ? audioEngine.read(busId) : audioEngine.readMaster();
            const levels = [gainToDb(reading.left), gainToDb(reading.right)].map((value) => Math.max(FLOOR_DB, Number.isFinite(value) ? value : FLOOR_DB));
            const bars = [barLeft.current, barRight.current];
            const holds = [holdLeft.current, holdRight.current];

            last = now;

            for (let side = 0; side < 2; side += 1) {
                shown[side] = levels[side] >= shown[side] ? levels[side] : Math.max(levels[side], shown[side] - FALL_DB_PER_SECOND * elapsed);

                if (levels[side] >= held[side]) {
                    held[side] = levels[side];
                    heldAt[side] = now;
                } else if (now - heldAt[side] > HOLD_MILLISECONDS) {
                    held[side] = Math.max(levels[side], held[side] - FALL_DB_PER_SECOND * elapsed);
                }

                const bar = bars[side];
                const hold = holds[side];

                if (bar) {
                    bar.style.transform = `scaleY(${positionOf(shown[side])})`;
                    bar.style.background = shown[side] > 0 ? 'var(--color-danger, #ff5d5d)' : shown[side] > -12 ? 'var(--color-warning, #ffc247)' : 'var(--color-success, #4ade80)';
                }

                if (hold) {
                    hold.style.bottom = `${positionOf(held[side]) * 100}%`;
                    hold.style.opacity = held[side] > FLOOR_DB + 1 ? '1' : '0';
                    hold.style.background = held[side] > 0 ? 'var(--color-danger, #ff5d5d)' : 'var(--color-ink, #fff)';
                }
            }

            frame = requestAnimationFrame(tick);
        }

        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [busId]);

    return (
        <div className={`flex h-full gap-0.5 ${className}`} data-theme="StellarMeter.meter">
            {showScale ? (
                <div className="relative mr-0.5 w-6 shrink-0 text-right text-[9px] tabular-nums text-dim">
                    {METER_MARKS.map((mark) => (
                        <span key={mark} className="absolute right-0 -translate-y-1/2"
                              style={{bottom: `${positionOf(mark) * 100}%`}}>{mark}</span>
                    ))}
                </div>
            ) : null}
            {([[barLeft, holdLeft], [barRight, holdRight]] as const).map(([bar, hold], side) => (
                <div key={side} className="relative h-full w-2 overflow-hidden rounded-sm bg-black/40">
                    <div ref={bar} className="absolute inset-x-0 bottom-0 h-full origin-bottom"
                         style={{transform: 'scaleY(0)'}}/>
                    <div ref={hold} className="absolute inset-x-0 h-px opacity-0"/>
                </div>
            ))}
        </div>
    );
}
