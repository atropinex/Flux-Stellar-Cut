import {useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react';

/** Finds the biggest box with a given shape that fits in a container. */
export function useFitBox(containerRef: RefObject<HTMLElement | null>, aspect: number): {
    width: number;
    height: number
} {
    const [box, setBox] = useState({width: 0, height: 0});

    useLayoutEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const measure = () => {
            const availableWidth = container.clientWidth;
            const availableHeight = container.clientHeight;
            const width = Math.min(availableWidth, availableHeight * aspect);

            setBox({width: Math.floor(width), height: Math.floor(width / aspect)});
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(container);

        return () => observer.disconnect();
    }, [containerRef, aspect]);

    return box;
}

interface StageProps {
    aspect: number;
    children: ReactNode;
    stageRef?: RefObject<HTMLDivElement | null>;
    onSize?: (width: number) => void;
    overlay?: ReactNode;
}

/** The black picture area of a monitor. */
export default function StellarMonitorStage({aspect, children, stageRef, overlay, onSize}: StageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const box = useFitBox(containerRef, aspect);

    useLayoutEffect(() => {
        onSize?.(box.width);
    }, [box.width, onSize]);

    return (
        <div ref={containerRef} className="relative flex min-h-0 flex-1 items-center justify-center p-3"
             data-theme="StellarMonitor.stage">
            <div
                ref={stageRef}
                className="relative overflow-hidden rounded-md bg-black shadow-[0_6px_30px_rgba(0,0,0,0.5)]"
                style={{width: box.width, height: box.height}}
            >
                {children}
                {overlay}
            </div>
        </div>
    );
}
