import {useRef, type RefObject} from 'react';
import styles from './StellarSplitter.module.css';

interface SplitterProps {
    axis: 'x' | 'y';                           // x = a vertical bar that resizes left and right
    containerRef: RefObject<HTMLElement | null>;
    onChange: (fraction: number) => void;      // the new position, 0..1 of the container
    fromEnd?: boolean;                         // measure from the right / bottom edge instead
    min?: number;
    max?: number;
}

/** The gap between two panels. Dragging it resizes them. */
export default function StellarSplitter({axis, containerRef, onChange, fromEnd = false, min = 0.1, max = 0.8}: SplitterProps) {
    const dragging = useRef(false);

    function handleMove(clientX: number, clientY: number) {
        const rect = containerRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        const raw = axis === 'x' ? (clientX - rect.left) / rect.width : (clientY - rect.top) / rect.height;
        const fraction = fromEnd ? 1 - raw : raw;

        onChange(Math.max(min, Math.min(max, fraction)));
    }

    return (
        <div
            role="separator"
            data-theme="StellarSplitter"
            className={`${styles.div} group ${axis === 'x' ? styles.divVariant : styles.divVariant2}`}
            onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (dragging.current) {
                    handleMove(event.clientX, event.clientY);
                }
            }}
            onPointerUp={(event) => {
                dragging.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
        >
            <div
                className={`${styles.div2} ${
                    axis === 'x' ? styles.divVariant3 : styles.divVariant4
                }`}
            />
        </div>
    );
}
