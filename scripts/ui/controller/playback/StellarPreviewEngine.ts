import type {Clip, MediaItem, Sequence, Track} from '../../../common/stellar/StellarContract';
import {buildColorLuts, effectiveSaturation, isColorNeutral, type ColorSettings} from '../../../common/stellar/StellarColor';
import {clipSourceKind, contentTime, resolveClip, transitionAmounts, type ResolvedClip} from '../../../common/stellar/StellarEvaluate';
import {activeMasks} from '../../../common/stellar/StellarMask';
import {clamp, dbToGain} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getMedia, getShownSequence, type EditorState} from '../project/StellarEditor.Store';
import {playbackUrlFor} from '../project/StellarMedia.Controller';
import {tracksOfType} from '../timeline/StellarTimeline.Controller';
import {maskImageUrl, textImageUrl} from '../graphics/StellarGraphics';
import {audioEngine, type ClipOutput} from './StellarAudioEngine';

// Draws the program monitor. Every clip that is under the playhead gets an element (video, audio, image,
// text picture or a nested monitor), and this class keeps those elements at the right time, place, color and volume.

const LOOK_AHEAD_SECONDS = 1.5;  // elements are made a little early so playback starts without a stall
const DRIFT_LIMIT_SECONDS = 0.3; // if the element is further than this from where it should be, it is moved
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type MediaElement = HTMLVideoElement | HTMLAudioElement | HTMLImageElement;

interface Slot {
    clipId: string;
    kind: 'media' | 'text' | 'nest';
    trackType: 'video' | 'audio';
    url: string;
    element: MediaElement | null;
    wrapper: HTMLDivElement | null;
    vignette: HTMLDivElement | null;
    dip: HTMLDivElement | null;
    child: StellarPreviewEngine | null;
    output: ClipOutput | null;
    filterId: string;
    filterKey: string;
    maskKey: string;
}

export interface EngineOptions {
    video: boolean;
    audio: boolean;
}

/** Everything a sequence needs to know about where it is drawn. */
interface DrawContext {
    state: EditorState;
    stageWidth: number;
    stageHeight: number;
    isRoot: boolean;
    busId: string | null;   // the sound of nested clips goes through the bus of the clip that holds them
    gainFactor: number;     // the volume of the clips that hold this sequence
    speedFactor: number;    // the speed of the clips that hold this sequence
}

let filterCounter = 0;

function fitRect(sourceWidth: number, sourceHeight: number, stageWidth: number, stageHeight: number): { x: number; y: number; width: number; height: number } {
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        return {x: 0, y: 0, width: stageWidth, height: stageHeight};
    }

    const ratio = Math.min(stageWidth / sourceWidth, stageHeight / sourceHeight);
    const width = sourceWidth * ratio;
    const height = sourceHeight * ratio;

    return {x: (stageWidth - width) / 2, y: (stageHeight - height) / 2, width, height};
}

function cssFilterFor(resolved: ResolvedClip, scale: number): string {
    const parts: string[] = [];

    for (const effect of resolved.effects) {
        const amount = effect.params['amount'] ?? 0;

        switch (effect.kind) {
            case 'brightness':
                parts.push(`brightness(${Math.max(0, 1 + amount / 100)})`);
                break;
            case 'contrast':
                parts.push(`contrast(${Math.max(0, 1 + amount / 100)})`);
                break;
            case 'saturation':
                parts.push(`saturate(${Math.max(0, amount / 100)})`);
                break;
            case 'hue':
                parts.push(`hue-rotate(${effect.params['degrees'] ?? 0}deg)`);
                break;
            case 'blur':
                parts.push(`blur(${Math.max(0, (effect.params['radius'] ?? 0) * scale)}px)`);
                break;
            case 'grayscale':
                parts.push('grayscale(1)');
                break;
            case 'sepia':
                parts.push('sepia(1)');
                break;
            case 'invert':
                parts.push('invert(1)');
                break;
            default:
                break;
        }
    }

    return parts.join(' ');
}

function amplifyDb(resolved: ResolvedClip): number {
    return resolved.effects.filter((effect) => effect.kind === 'amplify').reduce((total, effect) => total + (effect.params['gain'] ?? 0), 0);
}

export class StellarPreviewEngine {
    private slots = new Map<string, Slot>();
    private unsubscribe: (() => void) | null = null;
    private lastState: EditorState | null = null;
    private svg: SVGSVGElement | null = null;

    constructor(private layer: HTMLElement, private options: EngineOptions = {video: true, audio: true}) {}

    start(): void {
        this.unsubscribe = editorStore.subscribe(() => this.render());
        this.render();
    }

    dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;

        for (const clipId of [...this.slots.keys()]) {
            this.removeSlot(clipId);
        }

        this.svg?.remove();
        this.svg = null;
    }

    /** Called when the monitor is resized. */
    refresh(): void {
        this.render();
    }

    private render(): void {
        const state = editorStore.get();
        const sequence = getShownSequence(state);

        this.lastState = state;
        audioEngine.setEnabled(state.settings.webAudio);

        if (!sequence) {
            for (const clipId of [...this.slots.keys()]) {
                this.removeSlot(clipId);
            }

            return;
        }

        if (state.playing) {
            audioEngine.resume();
        }

        audioEngine.setBus(audioEngine.masterId, dbToGain(sequence.masterDb ?? 0), 0);

        this.draw(sequence, state.playhead, {
            state,
            stageWidth: this.layer.clientWidth || sequence.settings.width,
            stageHeight: this.layer.clientHeight || sequence.settings.height,
            isRoot: true,
            busId: null,
            gainFactor: 1,
            speedFactor: 1
        });
    }

    /** Draws one sequence at a time. A nested clip does this again for the sequence inside it. */
    draw(sequence: Sequence, time: number, context: DrawContext): void {
        const {state} = context;
        const scale = context.stageWidth / sequence.settings.width;
        const videoTracks = tracksOfType(sequence, 'video');
        const anySolo = sequence.tracks.some((track) => track.type === 'audio' && track.solo);
        const wanted = new Set<string>();

        if (context.isRoot) {
            for (const track of sequence.tracks.filter((item) => item.type === 'audio')) {
                const audible = !track.muted && (!anySolo || track.solo);

                audioEngine.setBus(track.id, audible ? dbToGain(track.volumeDb ?? 0) : 0, (track.pan ?? 0) / 100);
            }
        }

        for (const clip of sequence.clips) {
            const isNear = time >= clip.start - LOOK_AHEAD_SECONDS && time < clip.start + clip.duration + 0.25;
            const kind = clipSourceKind(clip);
            const media = kind === 'media' ? getMedia(state, clip.mediaId) : undefined;

            if (!isNear || !clip.enabled || (kind === 'media' && (!media || state.offline[media.id]))) {
                continue;
            }

            const track = sequence.tracks.find((item) => item.id === clip.trackId);

            if (!track || (track.type === 'video' && media?.kind === 'audio')) {
                continue;
            }

            if ((track.type === 'video' && !this.options.video) || (track.type === 'audio' && !this.options.audio)) {
                continue;
            }

            wanted.add(clip.id);
            this.updateClip(clip, media, kind, track, sequence, time, context, {
                scale,
                zIndex: videoTracks.findIndex((item) => item.id === track.id) + 1,
                trackOff: track.type === 'video' ? track.muted : track.muted || (anySolo && !track.solo)
            });
        }

        for (const clipId of [...this.slots.keys()]) {
            if (!wanted.has(clipId)) {
                this.removeSlot(clipId);
            }
        }
    }

    private updateClip(
        clip: Clip, media: MediaItem | undefined, kind: Slot['kind'], track: Track, sequence: Sequence, time: number, context: DrawContext,
        view: { scale: number; zIndex: number; trackOff: boolean }
    ): void {
        const isVisual = track.type === 'video';
        const isLive = time >= clip.start && time < clip.start + clip.duration;
        const resolved = resolveClip(clip, clamp(time, clip.start, clip.start + clip.duration));
        const slot = this.slotFor(clip, media, kind, track.type, sequence, context);

        if (!slot) {
            return;
        }

        if (isVisual) {
            this.styleVisual(slot, clip, media, resolved, sequence, time, context, view, isLive);
        }

        if (slot.kind === 'nest' && slot.child) {
            this.drawNested(slot, clip, track, sequence, time, context, resolved, isLive, view.trackOff);
            return;
        }

        const element = slot.element;

        if (!element || element instanceof HTMLImageElement || !media) {
            return;
        }

        const expected = clamp(contentTime(clip, time), 0, Math.max(0, media.duration - 0.001));
        const frameDuration = 1 / sequence.settings.frameRate;
        const playingForward = context.state.playing && context.state.rate > 0 && isLive && !clip.reverse;

        if (!isVisual) {
            this.updateSound(slot, clip, track, resolved, time, context, isLive && !view.trackOff);
        } else {
            element.muted = true;
        }

        if (playingForward) {
            const wantedRate = clamp(clip.speed * context.speedFactor * context.state.rate, 0.0625, 16);

            if (element.playbackRate !== wantedRate) {
                element.playbackRate = wantedRate;
            }

            if (element.paused || Math.abs(element.currentTime - expected) > DRIFT_LIMIT_SECONDS) {
                element.currentTime = expected;
            }

            if (element.paused) {
                void element.play().catch(() => undefined);
            }

            return;
        }

        // Not playing (scrubbing), waiting for the clip to start, or playing backwards: show the exact frame.
        if (!element.paused) {
            element.pause();
        }

        if (Math.abs(element.currentTime - expected) > frameDuration * 0.5) {
            element.currentTime = expected;
        }
    }

    // === Nested sequences === //

    private drawNested(
        slot: Slot, clip: Clip, track: Track, sequence: Sequence, time: number, context: DrawContext, resolved: ResolvedClip, isLive: boolean, trackOff: boolean
    ): void {
        const inner = context.state.document?.sequences.find((item) => item.id === clip.nestId);

        if (!inner || !slot.child) {
            return;
        }

        const amounts = transitionAmounts(clip, time);
        const volume = dbToGain(resolved.volumeDb + amplifyDb(resolved)) * amounts.audio;
        const trackGain = context.isRoot ? 1 : dbToGain(track.volumeDb ?? 0);
        const audible = isLive && !trackOff;

        slot.child.drawInner(inner, contentTime(clip, time), {
            ...context,
            isRoot: false,
            busId: context.busId ?? track.id,
            gainFactor: audible ? context.gainFactor * volume * trackGain * dbToGain(inner.masterDb ?? 0) : 0,
            speedFactor: context.speedFactor * clip.speed
        });

        void sequence;
    }

    /** Called by the engine of the clip that holds this sequence. */
    drawInner(inner: Sequence, time: number, context: DrawContext): void {
        this.lastState = context.state;
        this.draw(inner, time, context);
    }

    // === Looks === //

    private styleVisual(
        slot: Slot, clip: Clip, media: MediaItem | undefined, resolved: ResolvedClip, sequence: Sequence, time: number, context: DrawContext,
        view: { scale: number; zIndex: number; trackOff: boolean }, isLive: boolean
    ): void {
        const wrapper = slot.wrapper;

        if (!wrapper) {
            return;
        }

        const motion = resolved.motion;
        const amounts = transitionAmounts(clip, time);
        const style = wrapper.style;

        style.visibility = isLive && !view.trackOff ? 'visible' : 'hidden';
        style.zIndex = String(view.zIndex);
        style.opacity = String(clamp((motion.opacity / 100) * amounts.dissolve, 0, 1));
        style.transformOrigin = `calc(50% + ${motion.anchorX * view.scale}px) calc(50% + ${motion.anchorY * view.scale}px)`;
        style.transform = `translate(${motion.x * view.scale}px, ${motion.y * view.scale}px) rotate(${motion.rotation}deg) scale(${motion.scale / 100})`;

        const filters: string[] = [];
        const effectFilter = cssFilterFor(resolved, view.scale);

        if (effectFilter) {
            filters.push(effectFilter);
        }

        const colorFilter = this.colorFilterFor(slot, resolved.color);

        if (colorFilter) {
            filters.push(colorFilter);
        }

        style.filter = filters.length > 0 ? filters.join(' ') : 'none';

        // Dips to black or white, and the vignette.
        if (slot.dip) {
            const white = amounts.dipWhite > amounts.dipBlack;

            slot.dip.style.background = white ? '#ffffff' : '#000000';
            slot.dip.style.opacity = String(Math.max(amounts.dipBlack, amounts.dipWhite));
        }

        if (slot.vignette) {
            const strength = resolved.color.enabled ? resolved.color.vignette / 100 : 0;

            slot.vignette.style.opacity = strength > 0.005 ? '1' : '0';
            slot.vignette.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) ${Math.round(75 - strength * 45)}%, rgba(0,0,0,${(strength * 0.95).toFixed(2)}) 100%)`;
        }

        this.styleMask(slot, clip, media, sequence, context);
        this.styleText(slot, clip, context);
    }

    /** Color tuning shows through an SVG filter that is made from the same tables the export uses. */
    private colorFilterFor(slot: Slot, color: ColorSettings): string {
        if (isColorNeutral(color) && color.sharpen < 0.5) {
            return '';
        }

        const luts = buildColorLuts(color, 17);
        const saturation = effectiveSaturation(color);
        const sharpen = color.enabled ? color.sharpen / 100 : 0;
        const key = JSON.stringify([luts, saturation, sharpen]);

        if (key === slot.filterKey) {
            return `url(#${slot.filterId})`;
        }

        slot.filterKey = key;

        const svg = this.ensureSvg();
        let filter = svg.querySelector<SVGFilterElement>(`#${slot.filterId}`);

        if (!filter) {
            filter = document.createElementNS(SVG_NAMESPACE, 'filter');
            filter.setAttribute('id', slot.filterId);
            filter.setAttribute('color-interpolation-filters', 'sRGB');
            filter.setAttribute('x', '0');
            filter.setAttribute('y', '0');
            filter.setAttribute('width', '1');
            filter.setAttribute('height', '1');
            svg.appendChild(filter);
        }

        const table = (values: number[]) => values.map((value) => value.toFixed(4)).join(' ');
        const sharpenKernel = `0 ${-sharpen} 0 ${-sharpen} ${1 + 4 * sharpen} ${-sharpen} 0 ${-sharpen} 0`;

        filter.innerHTML = `
            <feComponentTransfer>
                <feFuncR type="table" tableValues="${table(luts.red)}"/>
                <feFuncG type="table" tableValues="${table(luts.green)}"/>
                <feFuncB type="table" tableValues="${table(luts.blue)}"/>
            </feComponentTransfer>
            <feColorMatrix type="saturate" values="${saturation.toFixed(3)}"/>
            ${sharpen > 0.005 ? `<feConvolveMatrix order="3" kernelMatrix="${sharpenKernel}" preserveAlpha="true"/>` : ''}
        `;

        return `url(#${slot.filterId})`;
    }

    private ensureSvg(): SVGSVGElement {
        if (!this.svg) {
            this.svg = document.createElementNS(SVG_NAMESPACE, 'svg');
            this.svg.setAttribute('width', '0');
            this.svg.setAttribute('height', '0');
            this.svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
            this.layer.appendChild(this.svg);
        }

        return this.svg;
    }

    /** A mask is a picture that hides parts of the clip. It is placed over the picture of the clip, not the whole frame. */
    private styleMask(slot: Slot, clip: Clip, media: MediaItem | undefined, sequence: Sequence, context: DrawContext): void {
        const wrapper = slot.wrapper;

        if (!wrapper) {
            return;
        }

        const masks = activeMasks(clip.masks);

        if (masks.length === 0) {
            if (slot.maskKey !== '') {
                slot.maskKey = '';
                wrapper.style.removeProperty('mask-image');
                wrapper.style.removeProperty('-webkit-mask-image');
            }

            return;
        }

        const inner = slot.kind === 'nest' ? context.state.document?.sequences.find((item) => item.id === clip.nestId)?.settings : undefined;
        const sourceWidth = media?.width ?? inner?.width ?? sequence.settings.width;
        const sourceHeight = media?.height ?? inner?.height ?? sequence.settings.height;
        const rect = slot.kind === 'text'
            ? {x: 0, y: 0, width: context.stageWidth, height: context.stageHeight}
            : fitRect(sourceWidth, sourceHeight, context.stageWidth, context.stageHeight);
        const url = maskImageUrl(masks, rect.width, rect.height);
        const key = `${url.length}:${url.slice(-40)}:${rect.x.toFixed(1)}:${rect.y.toFixed(1)}:${rect.width.toFixed(1)}`;

        if (key === slot.maskKey) {
            return;
        }

        slot.maskKey = key;

        for (const name of ['mask-image', '-webkit-mask-image']) {
            wrapper.style.setProperty(name, `url(${url})`);
        }

        for (const [name, value] of [
            ['mask-repeat', 'no-repeat'], ['-webkit-mask-repeat', 'no-repeat'],
            ['mask-size', `${rect.width}px ${rect.height}px`], ['-webkit-mask-size', `${rect.width}px ${rect.height}px`],
            ['mask-position', `${rect.x}px ${rect.y}px`], ['-webkit-mask-position', `${rect.x}px ${rect.y}px`]
        ]) {
            wrapper.style.setProperty(name, value);
        }
    }

    private styleText(slot: Slot, clip: Clip, context: DrawContext): void {
        if (slot.kind !== 'text' || !clip.text || !(slot.element instanceof HTMLImageElement)) {
            return;
        }

        const url = textImageUrl(clip.text, context.stageWidth, context.stageHeight);

        if (slot.url !== url) {
            slot.url = url;
            slot.element.src = url;
        }
    }

    // === Sound === //

    private updateSound(slot: Slot, clip: Clip, track: Track, resolved: ResolvedClip, time: number, context: DrawContext, audible: boolean): void {
        const element = slot.element as HTMLMediaElement;
        const amounts = transitionAmounts(clip, time);
        const clipGain = dbToGain(resolved.volumeDb + amplifyDb(resolved)) * amounts.audio * context.gainFactor;
        const nestedTrackGain = context.isRoot ? 1 : dbToGain(track.volumeDb ?? 0);
        const pan = clamp((resolved.pan + (context.isRoot ? 0 : track.pan ?? 0)) / 100, -1, 1);

        element.preservesPitch = clip.maintainPitch;

        if (slot.output) {
            slot.output.setBus(context.busId ?? track.id);
            slot.output.setLevels(audible ? clipGain * nestedTrackGain : 0, pan);
            element.muted = false;
            element.volume = 1;
            return;
        }

        // No mixing desk: the plain volume of the element is all there is, so it cannot go above 0 dB.
        const trackGain = context.isRoot ? dbToGain(track.volumeDb ?? 0) : 1;

        element.volume = clamp(clipGain * nestedTrackGain * trackGain * dbToGain(editorStore.get().document ? 0 : 0), 0, 1);
        element.muted = !audible;
    }

    // === Slots === //

    private slotFor(
        clip: Clip, media: MediaItem | undefined, kind: Slot['kind'], trackType: 'video' | 'audio', sequence: Sequence, context: DrawContext
    ): Slot | null {
        const existing = this.slots.get(clip.id);
        const url = kind === 'media' && media ? (playbackUrlFor(media.path) ?? '') : kind === 'nest' ? `nest:${clip.nestId}` : (existing?.url ?? '');

        if (kind === 'media' && !url) {
            return null;
        }

        if (existing && existing.kind === kind && existing.trackType === trackType && (kind !== 'media' || existing.url === url)) {
            return existing;
        }

        if (existing) {
            this.removeSlot(clip.id);
        }

        const slot: Slot = {
            clipId: clip.id, kind, trackType, url, element: null, wrapper: null, vignette: null, dip: null, child: null, output: null,
            filterId: `stellar-color-${(filterCounter += 1)}`, filterKey: '', maskKey: ''
        };

        if (trackType === 'video') {
            slot.wrapper = document.createElement('div');
            slot.wrapper.style.cssText = 'position:absolute;inset:0;visibility:hidden;will-change:transform,opacity,filter;';
            slot.vignette = this.makeOverlay();
            slot.dip = this.makeOverlay();
        }

        if (kind === 'nest') {
            const childLayer = document.createElement('div');

            childLayer.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
            (slot.wrapper ?? this.layer).appendChild(childLayer);
            slot.child = new StellarPreviewEngine(childLayer, {video: trackType === 'video', audio: trackType === 'audio'});
            slot.element = null;
        } else {
            slot.element = this.createElement(media, kind, trackType);

            if (kind === 'media') {
                slot.element.src = url;
            }

            if (trackType === 'audio' && slot.element instanceof HTMLMediaElement) {
                slot.output = audioEngine.attach(slot.element);
            }
        }

        if (slot.wrapper) {
            if (slot.element) {
                slot.wrapper.appendChild(slot.element);
            }

            slot.wrapper.appendChild(slot.vignette as HTMLDivElement);
            slot.wrapper.appendChild(slot.dip as HTMLDivElement);
            this.layer.appendChild(slot.wrapper);
        } else if (slot.element) {
            this.layer.appendChild(slot.element);
        }

        this.slots.set(clip.id, slot);
        void sequence;
        void context;

        return slot;
    }

    private makeOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');

        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;';

        return overlay;
    }

    private createElement(media: MediaItem | undefined, kind: Slot['kind'], trackType: 'video' | 'audio'): MediaElement {
        let element: MediaElement;

        if (kind === 'text' || media?.kind === 'image') {
            element = document.createElement('img');
        } else if (trackType === 'audio') {
            element = document.createElement('audio');
            (element as HTMLAudioElement).preload = 'auto';
        } else {
            element = document.createElement('video');
            (element as HTMLVideoElement).playsInline = true;
            (element as HTMLVideoElement).preload = 'auto';
        }

        if (trackType === 'video') {
            element.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
        }

        if (audioEngine.isEnabled() && element instanceof HTMLMediaElement) {
            element.crossOrigin = 'anonymous';
        }

        return element;
    }

    private removeSlot(clipId: string): void {
        const slot = this.slots.get(clipId);

        if (!slot) {
            return;
        }

        slot.child?.dispose();
        slot.output?.dispose();

        if (slot.element && !(slot.element instanceof HTMLImageElement)) {
            slot.element.pause();
        }

        slot.element?.removeAttribute('src');
        slot.element?.remove();
        slot.wrapper?.remove();
        this.svg?.querySelector(`#${slot.filterId}`)?.remove();
        this.slots.delete(clipId);
    }

    /** True while an element is still loading its first frame. The monitor shows a spinner for it. */
    isWaiting(): boolean {
        for (const slot of this.slots.values()) {
            const element = slot.element;

            if (element instanceof HTMLVideoElement && slot.wrapper?.style.visibility === 'visible' && element.readyState < 2) {
                return true;
            }

            if (slot.child?.isWaiting()) {
                return true;
            }
        }

        return false;
    }
}
