import {memo} from 'react';
import type {Clip, MediaItem, TrackType} from '../../../common/stellar/StellarContract';
import {CLIP_LABELS} from '../../../common/stellar/StellarConfig';
import type {ClipEffect} from '../../../common/stellar/StellarContract';
import {findEffect} from '../../../common/stellar/StellarEffects';
import {TRACK_HEIGHT} from './StellarTimelineConstants';
import StellarWaveform from './StellarWaveform';
import styles from './StellarTimelineClip.module.css';

interface ClipProps {
    clip: Clip;
    media: MediaItem | undefined;
    trackType: TrackType;
    pixelsPerSecond: number;
    selected: boolean;
    offline: boolean;
    thumbnail: string | undefined;
    locked: boolean;
}

/** The default label colors follow the theme. Other labels use their own color. */
function colorOf(clip: Clip, trackType: TrackType, media: MediaItem | undefined): string {
    const isDefault = (trackType === 'video' && clip.label === 'iris') || (trackType === 'audio' && clip.label === 'forest') || (media?.kind === 'image' && clip.label === 'mint');

    if (!isDefault && CLIP_LABELS[clip.label]) {
        return CLIP_LABELS[clip.label];
    }

    if (trackType === 'audio') {
        return 'var(--sc-audioClip)';
    }

    return media?.kind === 'image' ? 'var(--sc-imageClip)' : 'var(--sc-videoClip)';
}

/** A transition is a small box at the start or at the end of the clip, as long as the transition itself. */
function TransitionBox({effect, clipWidth, pixelsPerSecond}: {effect: ClipEffect; clipWidth: number; pixelsPerSecond: number}) {
    const definition = findEffect(effect.kind);

    if (!definition?.edge) {
        return null;
    }

    const isIn = definition.edge === 'in';
    const width = Math.max(10, Math.min(clipWidth / 2, (effect.params['duration'] ?? 1) * pixelsPerSecond));
    const toward = isIn ? 'to right' : 'to left';
    const fade = {
        dipBlack: `linear-gradient(${toward}, rgba(0,0,0,0.9), rgba(0,0,0,0.05))`,
        dipWhite: `linear-gradient(${toward}, rgba(255,255,255,0.9), rgba(255,255,255,0.05))`,
        dissolve: `linear-gradient(${toward}, rgba(255,255,255,0.45), rgba(255,255,255,0.05))`,
        audioFade: `linear-gradient(${toward}, rgba(0,0,0,0.55), rgba(0,0,0,0.05))`
    }[definition.style ?? 'dissolve'];

    return (
        <div
            data-transition={effect.id}
            title={`${definition.label} (${(effect.params['duration'] ?? 1).toFixed(2)} s)`}
            className={`${styles.transition} ${isIn ? styles.transitionIsIn : styles.transitionNotIsIn} ${effect.enabled ? '' : styles.transitionVariant}`}
            style={{width, background: fade}}
            data-theme="StellarTimeline.transition"
        >
            <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10" className={styles.svg}>
                <path d={isIn ? 'M0 10 10 0' : 'M0 0 10 10'} stroke="white" strokeWidth="0.8" fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
        </div>
    );
}

function StellarTimelineClip({clip, media, trackType, pixelsPerSecond, selected, offline, thumbnail, locked}: ClipProps) {
    const width = Math.max(2, clip.duration * pixelsPerSecond);
    const color = colorOf(clip, trackType, media);
    const transitions = clip.effects.filter((effect) => findEffect(effect.kind)?.edge);
    const hasEffects = clip.effects.some((effect) => effect.enabled && !findEffect(effect.kind)?.edge);
    const isText = Boolean(clip.text);
    const isNest = Boolean(clip.nestId);
    const animated = Object.keys(clip.keyframes ?? {}).length > 0;

    return (
        <div
            data-clip-id={clip.id}
            data-theme="StellarTimeline.clip"
            className={`${styles.clip} ${
                selected ? styles.clipSelected : styles.clipNotSelected
            } ${clip.enabled ? '' : styles.clipVariant} ${locked ? styles.clipLocked : ''}`}
            style={{
                left: clip.start * pixelsPerSecond,
                width,
                height: TRACK_HEIGHT - 7,
                background: `color-mix(in srgb, ${color} 55%, transparent)`,
                backgroundImage: offline ? 'repeating-linear-gradient(135deg, rgba(255,80,80,0.4) 0 6px, transparent 6px 12px)' : undefined
            }}
        >
            {trackType === 'video' && thumbnail && width > 40 ? (
                <div className={styles.overlay} style={{backgroundImage: `url(${thumbnail})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x'}} />
            ) : null}

            {trackType === 'audio' && media && !offline && width > 6 ? (
                <div className={styles.overlay2} style={clip.reverse ? {transform: 'scaleX(-1)'} : undefined}>
                    <StellarWaveform path={media.path} inPoint={clip.inPoint} sourceLength={clip.duration * clip.speed} width={width} height={TRACK_HEIGHT - 9} color="rgba(255,255,255,0.85)" />
                </div>
            ) : null}

            {isText ? (
                <div className={styles.overlay3}>
                    {clip.text?.content.split('\n')[0]}
                </div>
            ) : null}

            {transitions.map((effect) => <TransitionBox key={effect.id} effect={effect} clipWidth={width} pixelsPerSecond={pixelsPerSecond} />)}

            <div className={styles.row}>
                {isText ? <span className={styles.textSpan}>T</span> : null}
                {isNest ? <span className={styles.textSpan} title="Nested sequence">N</span> : null}
                {hasEffects || animated || (clip.masks?.length ?? 0) > 0 ? <span className={styles.textSpan2}>fx</span> : null}
                {clip.reverse ? <span className={styles.textSpan3}>R</span> : null}
                <span className={styles.textSpan4}>{clip.name}</span>
                {clip.speed !== 1 ? <span className={styles.textSpan3}>{Number((clip.speed * 100).toFixed(1))}%</span> : null}
            </div>

            <div data-edge="start" className={styles.overlay4} />
            <div data-edge="end" className={styles.overlay5} />
        </div>
    );
}

export default memo(StellarTimelineClip);
