import {useRef, type RefObject} from 'react';

interface SplitterProps {
    axis: 'x' | 'y';                           // x = a vertical bar that resizes left and right
    containerRef: RefObject<HTMLElement | null>;
    onChange: (fraction: number) => void;      // the new position, 0..1 of the container
    fromEnd?: boolean;                         // measure from the right / bottom edge instead
    min?: number;
    max?: number;
}

/** The gap between two panels. Dragging it resizes them. */
export default function StellarSplitter({
                                            axis,
                                            containerRef,
                                            onChange,
                                            fromEnd = false,
                                            min = 0.1,
                                            max = 0.8
                                        }: SplitterProps) {
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
            className={`group relative shrink-0 ${axis === 'x' ? 'w-(--sc-gap) cursor-col-resize' : 'h-(--sc-gap) cursor-row-resize'}`}
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
                className={`absolute rounded-full bg-accent/0 transition-colors group-hover:bg-accent/60 group-active:bg-accent ${
                    axis === 'x' ? 'inset-y-2 left-1/2 w-0.5 -translate-x-1/2' : 'inset-x-2 top-1/2 h-0.5 -translate-y-1/2'
                }`}
            />
        </div>
    );
}
