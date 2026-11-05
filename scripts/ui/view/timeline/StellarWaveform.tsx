import {useEffect, useRef} from 'react';
import type {WaveformData} from '../../../common/stellar/StellarContract';
import styles from './StellarWaveform.module.css';

const cache = new Map<string, Promise<{peaks: Uint8Array; perSecond: number} | null>>();

function loadWaveform(path: string): Promise<{peaks: Uint8Array; perSecond: number} | null> {
    let promise = cache.get(path);

    if (!promise) {
        promise = window.api.getWaveform(path).then((data: WaveformData | null) => {
            if (!data) {
                return null;
            }

            const binary = atob(data.peaks);
            const peaks = new Uint8Array(binary.length);

            for (let index = 0; index < binary.length; index += 1) {
                peaks[index] = binary.charCodeAt(index);
            }

            return {peaks, perSecond: data.peaksPerSecond};
        });
        cache.set(path, promise);
    }

    return promise;
}

interface WaveformProps {
    path: string;
    inPoint: number;    // seconds into the file where the clip starts
    sourceLength: number;
    width: number;
    height: number;
    color: string;
}

/** The sound shape inside an audio clip. */
export default function StellarWaveform({path, inPoint, sourceLength, width, height, color}: WaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let cancelled = false;

        void loadWaveform(path).then((data) => {
            const canvas = canvasRef.current;

            if (cancelled || !canvas || !data) {
                return;
            }

            const drawWidth = Math.max(1, Math.min(Math.round(width), 3000));
            const context = canvas.getContext('2d');

            if (!context) {
                return;
            }

            canvas.width = drawWidth;
            canvas.height = height;
            context.clearRect(0, 0, drawWidth, height);
            context.fillStyle = color;

            const middle = height / 2;

            for (let x = 0; x < drawWidth; x += 1) {
                const from = Math.floor((inPoint + (x / drawWidth) * sourceLength) * data.perSecond);
                const to = Math.max(from + 1, Math.floor((inPoint + ((x + 1) / drawWidth) * sourceLength) * data.perSecond));
                let peak = 0;

                for (let index = from; index < to && index < data.peaks.length; index += 1) {
                    peak = Math.max(peak, data.peaks[index]);
                }

                const barHeight = Math.max(1, (peak / 255) * (height - 6));

                context.fillRect(x, middle - barHeight / 2, 1, barHeight);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [path, inPoint, sourceLength, width, height, color]);

    return <canvas ref={canvasRef} className={styles.overlayCanvas} />;
}
