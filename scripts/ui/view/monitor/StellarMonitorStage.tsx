import {useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import styles from './StellarMonitorStage.module.css';

/** Finds the biggest box with a given shape that fits in a container. */
export function useFitBox(containerRef: RefObject<HTMLElement | null>, aspect: number): {width: number; height: number} {
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
    controls?: ReactNode; // drawn over the picture but NOT cut off at its edges (the box and handles of the clip can leave the frame)
}

/** The black picture area of a monitor. */
export default function StellarMonitorStage({aspect, children, stageRef, overlay, controls, onSize}: StageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const box = useFitBox(containerRef, aspect);

    useLayoutEffect(() => {
        onSize?.(box.width);
    }, [box.width, onSize]);

    return (
        <div ref={containerRef} className={styles.stage} data-theme="StellarMonitor.stage">
            <div className={styles.frame} style={{width: box.width, height: box.height}}>
                <div ref={stageRef} className={styles.div}>
                    {children}
                    {overlay}
                </div>
                {controls}
            </div>
        </div>
    );
}
