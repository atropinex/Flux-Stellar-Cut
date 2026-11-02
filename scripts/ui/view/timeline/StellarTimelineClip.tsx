import {memo} from 'react';
import type {Clip, MediaItem, TrackType} from '../../../common/stellar/StellarContract';
import {CLIP_LABELS} from '../../../common/stellar/StellarConfig';
import type {ClipEffect} from '../../../common/stellar/StellarContract';
import {findEffect} from '../../../common/stellar/StellarEffects';
import {TRACK_HEIGHT} from './StellarTimelineConstants';
import StellarWaveform from './StellarWaveform';

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
function TransitionBox({effect, clipWidth, pixelsPerSecond}: {
    effect: ClipEffect;
    clipWidth: number;
    pixelsPerSecond: number
}) {
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
            className={`pointer-events-none absolute inset-y-0 z-[2] overflow-hidden border-ink/50 ${isIn ? 'left-0 border-r' : 'right-0 border-l'} ${effect.enabled ? '' : 'opacity-40'}`}
            style={{width, background: fade}}
            data-theme="StellarTimeline.transition"
        >
            <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10" className="opacity-70">
                <path d={isIn ? 'M0 10 10 0' : 'M0 0 10 10'} stroke="white" strokeWidth="0.8" fill="none"
                      vectorEffect="non-scaling-stroke"/>
            </svg>
        </div>
    );
}

function StellarTimelineClip({
                                 clip,
                                 media,
                                 trackType,
                                 pixelsPerSecond,
                                 selected,
                                 offline,
                                 thumbnail,
                                 locked
                             }: ClipProps) {
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
            className={`absolute top-[3px] overflow-hidden rounded-md border text-[11px] ${
                selected ? 'z-10 border-selection shadow-[0_0_0_1px_var(--sc-selection)]' : 'border-black/30'
            } ${clip.enabled ? '' : 'opacity-35'} ${locked ? 'saturate-50' : ''}`}
            style={{
                left: clip.start * pixelsPerSecond,
                width,
                height: TRACK_HEIGHT - 7,
                background: `color-mix(in srgb, ${color} 55%, transparent)`,
                backgroundImage: offline ? 'repeating-linear-gradient(135deg, rgba(255,80,80,0.4) 0 6px, transparent 6px 12px)' : undefined
            }}
        >
            {trackType === 'video' && thumbnail && width > 40 ? (
                <div className="pointer-events-none absolute inset-0 opacity-45" style={{
                    backgroundImage: `url(${thumbnail})`,
                    backgroundSize: 'auto 100%',
                    backgroundRepeat: 'repeat-x'
                }}/>
            ) : null}

            {trackType === 'audio' && media && !offline && width > 6 ? (
                <div className="absolute inset-0" style={clip.reverse ? {transform: 'scaleX(-1)'} : undefined}>
                    <StellarWaveform path={media.path} inPoint={clip.inPoint} sourceLength={clip.duration * clip.speed}
                                     width={width} height={TRACK_HEIGHT - 9} color="rgba(255,255,255,0.85)"/>
                </div>
            ) : null}

            {isText ? (
                <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-2 text-[12px] font-semibold text-ink/60">
                    {clip.text?.content.split('\n')[0]}
                </div>
            ) : null}

            {transitions.map((effect) => <TransitionBox key={effect.id} effect={effect} clipWidth={width}
                                                        pixelsPerSecond={pixelsPerSecond}/>)}

            <div
                className="pointer-events-none relative flex items-center gap-1 whitespace-nowrap px-1.5 pt-0.5 font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
                {isText ? <span className="rounded bg-black/40 px-1 text-[9px] font-bold">T</span> : null}
                {isNest ? <span className="rounded bg-black/40 px-1 text-[9px] font-bold"
                                title="Nested sequence">N</span> : null}
                {hasEffects || animated || (clip.masks?.length ?? 0) > 0 ?
                    <span className="rounded bg-black/40 px-1 text-[9px] italic text-accent">fx</span> : null}
                {clip.reverse ? <span className="rounded bg-black/40 px-1 text-[9px]">R</span> : null}
                <span className="truncate">{clip.name}</span>
                {clip.speed !== 1 ? <span
                    className="rounded bg-black/40 px-1 text-[9px]">{Number((clip.speed * 100).toFixed(1))}%</span> : null}
            </div>

            <div data-edge="start" className="absolute inset-y-0 left-0 w-[7px] cursor-w-resize"/>
            <div data-edge="end" className="absolute inset-y-0 right-0 w-[7px] cursor-e-resize"/>
        </div>
    );
}

export default memo(StellarTimelineClip);
