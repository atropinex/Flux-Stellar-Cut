import {useRef, useState} from 'react';

interface ScrubNumberProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    decimals?: number;
    onChange: (value: number) => void;   // called while dragging, for a live preview
    onCommit: (value: number) => void;   // called once when the drag or typing ends
    onReset?: () => void;
}

/** A number that you change by dragging sideways (like in Premiere), or by clicking and typing. */
export default function StellarScrubNumber({
                                               value,
                                               min,
                                               max,
                                               step = 1,
                                               unit = '',
                                               decimals = 0,
                                               onChange,
                                               onCommit,
                                               onReset
                                           }: ScrubNumberProps) {
    const [editing, setEditing] = useState(false);
    const drag = useRef<{ startX: number; startValue: number; moved: boolean; latest: number } | null>(null);

    function clampValue(next: number): number {
        const rounded = Math.round(next / step) * step;

        return Math.max(min, Math.min(max, Number(rounded.toFixed(4))));
    }

    if (editing) {
        return (
            <input
                autoFocus
                defaultValue={value.toFixed(decimals)}
                className="w-20 rounded-md border border-accent bg-deep px-1.5 py-0.5 text-right text-[12px] outline-none"
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => {
                    const typed = parseFloat(event.currentTarget.value);

                    setEditing(false);

                    if (Number.isFinite(typed)) {
                        onCommit(clampValue(typed));
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }

                    if (event.key === 'Escape') {
                        setEditing(false);
                    }
                }}
            />
        );
    }

    return (
        <span
            className="cursor-ew-resize select-none rounded-md px-1.5 py-0.5 text-[12px] tabular-nums text-accent hover:bg-surface-hover"
            title="Drag to change. Click to type. Double-click to reset."
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {startX: event.clientX, startValue: value, moved: false, latest: value};
            }}
            onPointerMove={(event) => {
                if (!drag.current) {
                    return;
                }

                const distance = event.clientX - drag.current.startX;

                if (Math.abs(distance) > 2) {
                    drag.current.moved = true;
                }

                if (drag.current.moved) {
                    const speed = event.shiftKey ? 0.1 : 1; // hold Shift for fine control
                    const next = clampValue(drag.current.startValue + distance * step * speed * Math.max(1, (max - min) / 400));

                    drag.current.latest = next;
                    onChange(next);
                }
            }}
            onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);

                if (drag.current?.moved) {
                    onCommit(drag.current.latest);
                } else {
                    setEditing(true);
                }

                drag.current = null;
            }}
            onDoubleClick={() => onReset?.()}
        >
            {value.toFixed(decimals)}
            {unit}
        </span>
    );
}
