import {useRef} from 'react';

interface ScrubBarProps {
    time: number;
    duration: number;
    inPoint: number | null;
    outPoint: number | null;
    onSeek: (time: number) => void;
}

/** A thin bar under the picture. Click or drag to move through the clip. */
export default function StellarScrubBar({time, duration, inPoint, outPoint, onSeek}: ScrubBarProps) {
    const barRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const safeDuration = Math.max(duration, 0.001);

    function seekFromEvent(clientX: number) {
        const rect = barRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * safeDuration);
    }

    return (
        <div className="px-3 pb-2">
            <div
                ref={barRef}
                className="group relative h-4 cursor-pointer"
                onPointerDown={(event) => {
                    dragging.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    seekFromEvent(event.clientX);
                }}
                onPointerMove={(event) => {
                    if (dragging.current) {
                        seekFromEvent(event.clientX);
                    }
                }}
                onPointerUp={(event) => {
                    dragging.current = false;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
            >
                <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-ink/10"/>
                {inPoint !== null || outPoint !== null ? (
                    <div
                        className="absolute top-1.5 h-1 rounded-full bg-accent/60"
                        style={{
                            left: `${((inPoint ?? 0) / safeDuration) * 100}%`,
                            right: `${100 - ((outPoint ?? safeDuration) / safeDuration) * 100}%`
                        }}
                    />
                ) : null}
                <div className="absolute top-0.5 h-3 w-1.5 -translate-x-1/2 rounded-sm bg-playhead"
                     style={{left: `${Math.min(1, time / safeDuration) * 100}%`}}/>
            </div>
        </div>
    );
}
