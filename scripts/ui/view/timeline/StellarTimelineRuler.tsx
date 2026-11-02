import {formatTimecode} from '../../../common/utils/StellarTimeHelper';
import type {Sequence} from '../../../common/stellar/StellarContract';
import {RULER_HEIGHT} from './StellarTimelineConstants';

/** Picks a distance between labels so they are at least ~90px apart. */
function labelStep(pixelsPerSecond: number, frameRate: number): number {
    const frame = 1 / frameRate;
    const steps = [frame, frame * 2, frame * 5, frame * 10, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

    return steps.find((step) => step * pixelsPerSecond >= 90) ?? 3600;
}

interface RulerProps {
    sequence: Sequence;
    pixelsPerSecond: number;
    scrollX: number;
    viewportWidth: number;
    width: number;
}

/** The time scale on top of the timeline. Only the ticks that can be seen are drawn. */
export default function StellarTimelineRuler({sequence, pixelsPerSecond, scrollX, viewportWidth, width}: RulerProps) {
    const frameRate = sequence.settings.frameRate;
    const step = labelStep(pixelsPerSecond, frameRate);
    const first = Math.floor(scrollX / pixelsPerSecond / step);
    const last = Math.ceil((scrollX + viewportWidth) / pixelsPerSecond / step);
    const ticks: number[] = [];
    const minor: { time: number; size: 'half' | 'small' }[] = [];

    for (let index = Math.max(0, first); index <= last; index += 1) {
        ticks.push(index * step);
    }

    // The small bars between the labels, like the ruler of a real timeline. Only as many as fit.
    const divisions = [10, 5, 4, 2].find((count) => (step * pixelsPerSecond) / count >= 7) ?? 1;

    if (divisions > 1) {
        for (let index = Math.max(0, first); index <= last; index += 1) {
            for (let part = 1; part < divisions; part += 1) {
                minor.push({
                    time: index * step + (step * part) / divisions,
                    size: divisions % 2 === 0 && part === divisions / 2 ? 'half' : 'small'
                });
            }
        }
    }

    return (
        <div className="relative cursor-pointer border-b border-line bg-deep" style={{width, height: RULER_HEIGHT}}
             data-ruler="true" data-theme="StellarTimeline.ruler">
            {sequence.inPoint !== null && sequence.outPoint !== null ? (
                <div
                    className="pointer-events-none absolute inset-y-0 bg-accent/25"
                    style={{
                        left: sequence.inPoint * pixelsPerSecond,
                        width: (sequence.outPoint - sequence.inPoint) * pixelsPerSecond
                    }}
                />
            ) : null}

            {minor.map((tick) => (
                <div
                    key={`m${tick.time}`}
                    className={`pointer-events-none absolute bottom-0 w-px bg-ink/20 ${tick.size === 'half' ? 'h-2' : 'h-1.5'}`}
                    style={{left: tick.time * pixelsPerSecond}}
                />
            ))}

            {ticks.map((time) => (
                <div key={time} className="pointer-events-none absolute bottom-0 top-0"
                     style={{left: time * pixelsPerSecond}}>
                    <div className="absolute bottom-0 h-2.5 w-px bg-ink/30"/>
                    <span
                        className="timecode absolute left-1 top-1 whitespace-nowrap text-[10px] text-dim">{formatTimecode(time, frameRate)}</span>
                </div>
            ))}

            {sequence.markers.map((marker) => (
                <div
                    key={marker.id}
                    data-marker-id={marker.id}
                    title={marker.name ? `${marker.name}${marker.comment ? `: ${marker.comment}` : ''}` : 'Marker (right-click to change the color)'}
                    className="absolute bottom-0 z-[1] h-3.5 w-3 -translate-x-1/2 cursor-pointer"
                    style={{
                        left: marker.time * pixelsPerSecond,
                        background: marker.color,
                        clipPath: 'polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%)'
                    }}
                />
            ))}
        </div>
    );
}
