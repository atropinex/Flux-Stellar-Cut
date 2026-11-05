import {useRef} from 'react';
import styles from './StellarScrubBar.module.css';

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
        <div className={styles.div}>
            <div
                ref={barRef}
                className={`${styles.div2} group`}
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
                <div className={styles.overlay} />
                {inPoint !== null || outPoint !== null ? (
                    <div
                        className={styles.div3}
                        style={{left: `${((inPoint ?? 0) / safeDuration) * 100}%`, right: `${100 - ((outPoint ?? safeDuration) / safeDuration) * 100}%`}}
                    />
                ) : null}
                <div className={styles.div4} style={{left: `${Math.min(1, time / safeDuration) * 100}%`}} />
            </div>
        </div>
    );
}
