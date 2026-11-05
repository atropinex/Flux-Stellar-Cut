import type {Clip, ClipEffect, ExportRequest, FrameMode, MediaItem, Sequence, Track} from './StellarContract';
import {PATH, keyframeExpression, valueAt, type Keyframe} from './StellarAnimation';
import {colorFilters} from './StellarColor';
import {clipSourceKind, resolveClip} from './StellarEvaluate';
import {findEffect} from './StellarEffects';
import {findExportFormat, type ExportFormat} from './StellarExportFormats';
import {activeMasks} from './StellarMask';

// Turns a sequence into an ffmpeg command. This file is pure: no electron, no files. That keeps it easy to test.
//
// The picture: a black canvas, then every video clip is drawn over it, lowest track first.
// The sound: every audio clip is delayed to its place, then all of them are mixed.
// A nested sequence is built the same way, inside the same command, on a see-through canvas.

export interface ExportCapabilities {
    amixNormalize: boolean;
}

export interface ExportCommand {
    args: string[];
    duration: number; // seconds of the result
}

/** One clip, cut down to the part that is inside the exported range. Times are relative to the start of the range. */
interface PlannedClip {
    clip: Clip;
    track: Track;
    media: MediaItem;
    start: number;
    duration: number;       // on the timeline
    sourceIn: number;
    sourceDuration: number; // in the file: duration * speed
    headCut: number;        // seconds removed from the front by the range
    tailCut: number;        // seconds removed from the back by the range
    nested: ExportPlan | null;
}

interface ExportPlan {
    sequence: Sequence;
    start: number;
    end: number;
    duration: number;
    videoClips: PlannedClip[];
    audioClips: PlannedClip[];
}

const MAX_NEST_DEPTH = 6;
const ALPHA_IMAGE_EXTENSIONS = ['png', 'gif', 'webp', 'tif', 'tiff', 'avif'];

// === Small helpers === //

/** A number for the command line, never in scientific notation. */
function num(value: number): string {
    return String(Number(value.toFixed(6)));
}

function even(value: number): number {
    return Math.max(2, Math.floor(value / 2) * 2);
}

/** 23.976 -> "24000/1001", 25 -> "25". ffmpeg wants the exact fraction for the TV rates. */
function frameRateText(frameRate: number): string {
    const rounded = Math.round(frameRate * 1.001);
    const isTvRate = Math.abs(frameRate - rounded / 1.001) < 0.002 && Math.abs(frameRate - Math.round(frameRate)) > 0.0005;

    return isTvRate ? `${rounded * 1000}/1001` : num(frameRate);
}

function effectParam(effect: ClipEffect, key: string, fallback: number): number {
    const value = effect.params[key];

    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function activeEffects(clip: Clip, kinds?: string[]): ClipEffect[] {
    return clip.effects.filter((effect) => {
        return effect.enabled && findEffect(effect.kind) !== undefined && (!kinds || kinds.includes(effect.kind));
    });
}

function clipEnd(clip: Clip): number {
    return clip.start + clip.duration;
}

/** Sound formats limit the sample rate. */
function audioSampleRate(format: ExportFormat, wanted: number): number {
    if (format.audioCodec === 'libopus') {
        return 48000;
    }

    if (format.audioCodec === 'libmp3lame' || format.audioCodec === 'mp2') {
        return Math.min(48000, wanted);
    }

    return wanted;
}

function extensionOf(path: string): string {
    const dot = path.lastIndexOf('.');

    return dot < 0 ? '' : path.slice(dot + 1).toLowerCase();
}

function isAnimated(clip: Clip, path: string): boolean {
    return (clip.keyframes?.[path]?.length ?? 0) > 1;
}

// === What a clip draws from === //

/** The file (or the generated picture, or the nested sequence) a clip uses. Null when it cannot be found. */
function sourceOf(clip: Clip, request: ExportRequest): MediaItem | null {
    const kind = clipSourceKind(clip);

    if (kind === 'text') {
        const path = request.assets?.[`text:${clip.id}`];

        if (!path) {
            return null;
        }

        return makeSyntheticMedia(clip.id, clip.name, path, 'image', true, false, request.settings.width, request.settings.height, clip.duration);
    }

    if (kind === 'nest') {
        const nested = clip.nestId ? request.sequences?.[clip.nestId] : undefined;

        if (!nested) {
            return null;
        }

        const length = nested.clips.reduce((latest, item) => Math.max(latest, clipEnd(item)), 0);

        return makeSyntheticMedia(
            nested.id, nested.name, '', 'video',
            sequenceHas(nested, 'video', request, 1), sequenceHas(nested, 'audio', request, 1),
            nested.settings.width, nested.settings.height, length
        );
    }

    return request.media[clip.mediaId] ?? null;
}

function makeSyntheticMedia(
    id: string, name: string, path: string, kind: 'video' | 'image', hasVideo: boolean, hasAudio: boolean, width: number, height: number, duration: number
): MediaItem {
    return {
        id, name, path, kind, binId: null, duration, width, height, frameRate: 0, videoCodec: null, audioCodec: null,
        hasVideo, hasAudio, sampleRate: 48000, channels: 2, fileSize: 0, container: '', importedAt: '', metadata: {}
    };
}

/** True when the sequence has something to see (video) or something to hear (audio). */
function sequenceHas(sequence: Sequence, type: 'video' | 'audio', request: ExportRequest, depth: number): boolean {
    if (depth > MAX_NEST_DEPTH) {
        return false;
    }

    for (const clip of sequence.clips) {
        const track = sequence.tracks.find((item) => item.id === clip.trackId);

        if (!clip.enabled || !track || track.type !== type || track.muted) {
            continue;
        }

        const kind = clipSourceKind(clip);

        if (kind === 'text') {
            if (type === 'video') {
                return true;
            }
        } else if (kind === 'nest') {
            const nested = clip.nestId ? request.sequences?.[clip.nestId] : undefined;

            if (nested && sequenceHas(nested, type, request, depth + 1)) {
                return true;
            }
        } else {
            const item = request.media[clip.mediaId];

            if (item && (type === 'video' ? item.hasVideo : item.hasAudio)) {
                return true;
            }
        }
    }

    return false;
}

/** The clips of a sequence (and of every sequence nested in it) that need a picture drawn by the page. */
export function collectGeneratedClips(
    sequence: Sequence, sequences: Record<string, Sequence>, depth = 0
): { text: Clip[]; masked: Clip[] } {
    const result: { text: Clip[]; masked: Clip[] } = {text: [], masked: []};

    if (depth > MAX_NEST_DEPTH) {
        return result;
    }

    for (const clip of sequence.clips) {
        if (clip.text) {
            result.text.push(clip);
        }

        if (activeMasks(clip.masks).length > 0) {
            result.masked.push(clip);
        }

        if (clip.nestId && sequences[clip.nestId]) {
            const inner = collectGeneratedClips(sequences[clip.nestId], sequences, depth + 1);

            result.text.push(...inner.text);
            result.masked.push(...inner.masked);
        }
    }

    return result;
}

// === Planning === //

function planSequence(sequence: Sequence, request: ExportRequest, start: number, end: number, depth: number): ExportPlan {
    const {settings} = request;
    const format = findExportFormat(settings.formatId);
    const plan: ExportPlan = {sequence, start, end, duration: end - start, videoClips: [], audioClips: []};
    const anySolo = sequence.tracks.some((track) => track.type === 'audio' && track.solo);
    const wantsVideo = format !== undefined && format.type !== 'audio' && settings.exportVideo;
    const wantsAudio = format !== undefined && format.audioCodec !== null && format.type !== 'animation' && settings.exportAudio;

    for (const track of sequence.tracks) {
        const clips = sequence.clips
            .filter((clip) => clip.trackId === track.id)
            .sort((first, second) => first.start - second.start);

        for (const clip of clips) {
            const item = sourceOf(clip, request);
            const visibleStart = Math.max(clip.start, start);
            const visibleEnd = Math.min(clipEnd(clip), end);

            if (!clip.enabled || !item || visibleEnd - visibleStart < 0.001 || track.muted) {
                continue;
            }

            if (clip.nestId && depth >= MAX_NEST_DEPTH) {
                continue;
            }

            const visibleLength = visibleEnd - visibleStart;
            const sourceDuration = visibleLength * clip.speed;
            // A reversed clip is read from its end, so the part that is visible is cut from the other side.
            const sourceIn = clip.reverse
                ? clip.inPoint + (clip.duration - (visibleEnd - clip.start)) * clip.speed
                : clip.inPoint + (visibleStart - clip.start) * clip.speed;

            const planned: PlannedClip = {
                clip,
                track,
                media: item,
                start: visibleStart - start,
                duration: visibleLength,
                sourceIn,
                sourceDuration,
                headCut: visibleStart - clip.start,
                tailCut: clipEnd(clip) - visibleEnd,
                nested: null
            };

            if (clip.nestId) {
                const nestedSequence = request.sequences?.[clip.nestId] as Sequence;

                planned.nested = planSequence(nestedSequence, request, sourceIn, sourceIn + sourceDuration, depth + 1);
            }

            if (track.type === 'video' && wantsVideo && item.hasVideo) {
                plan.videoClips.push(planned);
            }

            const soloAllows = !anySolo || track.solo;

            if (track.type === 'audio' && wantsAudio && item.hasAudio && soloAllows) {
                plan.audioClips.push(planned);
            }
        }
    }

    return plan;
}

function planExport(request: ExportRequest): ExportPlan {
    const {sequence, settings} = request;
    const sequenceEnd = sequence.clips.reduce((latest, clip) => Math.max(latest, clipEnd(clip)), 0);
    const start = settings.range === 'inOut' ? (sequence.inPoint ?? 0) : 0;
    const end = settings.range === 'inOut' ? (sequence.outPoint ?? sequenceEnd) : sequenceEnd;

    return planSequence(sequence, request, start, end, 0);
}

/** Reasons why this request cannot be exported. An empty list means it can. */
export function describeExportProblems(request: ExportRequest): string[] {
    const problems: string[] = [];
    const {settings, sequence} = request;
    const format = findExportFormat(settings.formatId);

    if (!format) {
        return [`Unknown format "${settings.formatId}".`];
    }

    if (!settings.outputPath) {
        problems.push('Choose where to save the file.');
    }

    if (format.type !== 'audio' && (settings.width < 16 || settings.height < 16)) {
        problems.push('The frame size is too small.');
    }

    if (settings.range === 'inOut' && sequence.inPoint !== null && sequence.outPoint !== null && sequence.outPoint <= sequence.inPoint) {
        problems.push('The Out point is before the In point.');
    }

    for (const clip of sequence.clips) {
        const kind = clipSourceKind(clip);

        if (kind === 'media' && !request.media[clip.mediaId]) {
            problems.push('A clip uses media that is no longer in the project.');
            break;
        }

        if (kind === 'nest' && (!clip.nestId || !request.sequences?.[clip.nestId])) {
            problems.push('A nested sequence is missing from the project.');
            break;
        }
    }

    const plan = planExport(request);

    if (plan.duration <= 0.001 || (plan.videoClips.length === 0 && plan.audioClips.length === 0)) {
        problems.push('There is nothing to export. Add clips to the sequence first.');
    } else if (format.type === 'audio' && plan.audioClips.length === 0) {
        problems.push('There is no audio in this range to export.');
    }

    return problems;
}

// === The command that is being built === //

interface Build {
    request: ExportRequest;
    caps: ExportCapabilities;
    width: number;
    height: number;
    frameRate: string;
    sampleRate: number;
    channels: number;
    scaleFactor: number;
    scaleFlags: string;
    inputArgs: string[];
    inputCount: number;
    graph: string[];
    labelCount: number;
}

function addInput(build: Build, args: string[]): number {
    build.inputArgs.push(...args);
    build.inputCount += 1;

    return build.inputCount - 1;
}

function newLabel(build: Build, prefix: string): string {
    build.labelCount += 1;

    return `${prefix}${build.labelCount}`;
}

/** A chain of filters that is written to the graph one piece at a time, each piece with its own label. */
class ClipGraph {
    current: string;

    constructor(private build: Build, input: string) {
        this.current = input;
    }

    filters(list: string[]): void {
        if (list.length === 0) {
            return;
        }

        const output = `[${newLabel(this.build, 'c')}]`;

        this.build.graph.push(`${this.current}${list.join(',')}${output}`);
        this.current = output;
    }

    /** Runs filters that would throw away the see-through parts of the picture, and puts them back afterwards. */
    alphaSafe(list: string[]): void {
        if (list.length === 0) {
            return;
        }

        const colorSide = newLabel(this.build, 's');
        const alphaSide = newLabel(this.build, 's');
        const alphaOnly = newLabel(this.build, 's');
        const colorDone = newLabel(this.build, 's');
        const output = `[${newLabel(this.build, 'c')}]`;

        this.build.graph.push(`${this.current}format=rgba,split[${colorSide}][${alphaSide}]`);
        this.build.graph.push(`[${alphaSide}]alphaextract[${alphaOnly}]`);
        this.build.graph.push(`[${colorSide}]${list.join(',')}[${colorDone}]`);
        this.build.graph.push(`[${colorDone}][${alphaOnly}]alphamerge${output}`);
        this.current = output;
    }

    /** Cuts the picture with a black and white picture. White stays, black goes. */
    mask(maskInput: number): void {
        const colorSide = newLabel(this.build, 'm');
        const alphaSide = newLabel(this.build, 'm');
        const alphaOnly = newLabel(this.build, 'm');
        const gray = newLabel(this.build, 'm');
        const grayScaled = newLabel(this.build, 'm');
        const colorRef = newLabel(this.build, 'm');
        const combined = newLabel(this.build, 'm');
        const output = `[${newLabel(this.build, 'c')}]`;

        this.build.graph.push(`${this.current}format=rgba,split[${colorSide}][${alphaSide}]`);
        this.build.graph.push(`[${alphaSide}]alphaextract[${alphaOnly}]`);
        this.build.graph.push(`[${maskInput}:v]format=gray[${gray}]`);
        this.build.graph.push(`[${gray}][${colorSide}]scale2ref[${grayScaled}][${colorRef}]`);
        this.build.graph.push(`[${alphaOnly}][${grayScaled}]blend=all_mode=multiply:shortest=1[${combined}]`);
        this.build.graph.push(`[${colorRef}][${combined}]alphamerge${output}`);
        this.current = output;
    }
}

// === Picture === //

/** The time inside the clip's content, as an ffmpeg expression. "timeVariable" is the seconds since the visible start of the clip. */
function contentExpression(planned: PlannedClip, timeVariable: string): string {
    const {clip} = planned;
    const local = `(${timeVariable}+${num(planned.headCut)})`;

    if (clip.reverse) {
        return `${num(clip.inPoint + clip.duration * clip.speed)}-${local}*${num(clip.speed)}`;
    }

    return `${num(clip.inPoint)}+${local}*${num(clip.speed)}`;
}

function middleTime(planned: PlannedClip): number {
    return planned.clip.start + planned.headCut + planned.duration / 2;
}

/** Either a plain number or, when the property is animated, an expression of the time variable. */
function animatedValue(planned: PlannedClip, path: string, plain: number, timeVariable: string): { animated: boolean; text: string } {
    const keyframes: Keyframe[] | undefined = planned.clip.keyframes?.[path];

    if (!keyframes || keyframes.length < 2) {
        return {animated: false, text: num(valueAt(keyframes, plain, 0))};
    }

    return {animated: true, text: keyframeExpression(keyframes, plain, contentExpression(planned, timeVariable))};
}

function frameModeFor(planned: PlannedClip, build: Build): FrameMode {
    const {clip, media} = planned;

    if (Math.abs(clip.speed - 1) > 0.001) {
        return clip.frameMode;
    }

    const exportRate = build.request.settings.frameRate;
    const differs = media.frameRate > 0 && Math.abs(media.frameRate - exportRate) / exportRate > 0.01;

    return differs ? build.request.settings.frameInterpolation : 'sampling';
}

function timingFilters(planned: PlannedClip, build: Build, isStill: boolean, hasAlpha: boolean): string[] {
    const {clip} = planned;
    const filters: string[] = [];

    if (isStill) {
        filters.push('setpts=PTS-STARTPTS', `fps=${build.frameRate}`);

        return filters;
    }

    if (clip.reverse) {
        filters.push('reverse');
    }

    filters.push(`setpts=(PTS-STARTPTS)/${num(clip.speed)}`);

    // Frames with see-through parts can only be repeated or dropped, because the smart filters work on opaque pictures.
    const mode = hasAlpha ? 'sampling' : frameModeFor(planned, build);

    if (mode === 'blending') {
        filters.push(`framerate=fps=${build.frameRate}`);
    } else if (mode === 'opticalFlow') {
        filters.push('format=yuv420p', `minterpolate=fps=${build.frameRate}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
    } else {
        filters.push(`fps=${build.frameRate}`);
    }

    return filters;
}

function effectFilters(planned: PlannedClip, build: Build): string[] {
    const {clip} = planned;
    const filters: string[] = [];
    const middle = resolveClip(clip, middleTime(planned));

    for (const effect of activeEffects(clip, ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'grayscale', 'sepia', 'invert'])) {
        const parameter = (key: string, fallback: number) => animatedValue(planned, PATH.effect(effect.id, key), effectParam(effect, key, fallback), 't');

        switch (effect.kind) {
            case 'brightness': {
                const value = parameter('amount', 0);

                filters.push(value.animated ? `eq=brightness='(${value.text})/200':eval=frame` : `eq=brightness=${num(Number(value.text) / 200)}`);
                break;
            }
            case 'contrast': {
                const value = parameter('amount', 0);

                filters.push(value.animated ? `eq=contrast='1+(${value.text})/100':eval=frame` : `eq=contrast=${num(1 + Number(value.text) / 100)}`);
                break;
            }
            case 'saturation': {
                const value = parameter('amount', 100);

                filters.push(value.animated ? `eq=saturation='(${value.text})/100':eval=frame` : `eq=saturation=${num(Number(value.text) / 100)}`);
                break;
            }
            case 'hue': {
                const value = parameter('degrees', 0);

                filters.push(value.animated ? `hue=h='${value.text}'` : `hue=h=${num(Number(value.text))}`);
                break;
            }
            case 'blur': {
                // The blur cannot change over time in ffmpeg, so the value in the middle of the clip is used.
                const resolved = middle.effects.find((item) => item.id === effect.id);
                const sigma = (resolved?.params['radius'] ?? effectParam(effect, 'radius', 0)) * build.scaleFactor;

                if (sigma > 0.05) {
                    filters.push(`gblur=sigma=${num(sigma)}`);
                }
                break;
            }
            case 'grayscale':
                filters.push('hue=s=0');
                break;
            case 'sepia':
                filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0');
                break;
            case 'invert':
                filters.push('negate');
                break;
        }
    }

    // Color tuning. The tables cannot change over time, so the settings in the middle of the clip are used.
    filters.push(...colorFilters(middle.color));

    return filters;
}

function transitionFilters(planned: PlannedClip): string[] {
    const filters: string[] = [];
    const totalLength = planned.headCut + planned.duration + planned.tailCut;

    for (const effect of activeEffects(planned.clip)) {
        const definition = findEffect(effect.kind);

        if (!definition || !definition.edge || definition.appliesTo !== 'video' || !definition.style) {
            continue;
        }

        const length = Math.max(0.01, effectParam(effect, 'duration', 1));
        const color = definition.style === 'dipWhite' ? ':color=white' : definition.style === 'dipBlack' ? ':color=black' : ':alpha=1';

        if (definition.edge === 'in') {
            if (length > planned.headCut + 0.001) {
                filters.push(`fade=t=in:st=${num(-planned.headCut)}:d=${num(length)}${color}`);
            }
        } else {
            const startInVisible = totalLength - length - planned.headCut;

            if (startInVisible < planned.duration - 0.001) {
                filters.push(`fade=t=out:st=${num(startInVisible)}:d=${num(length)}${color}`);
            }
        }
    }

    return filters;
}

/** Builds the filters of one clip and returns the label of the finished picture. */
function buildClipVideo(build: Build, planned: PlannedClip, source: string, hasAlpha: boolean): string {
    const {clip, media} = planned;
    const isStill = media.kind === 'image';
    const graph = new ClipGraph(build, source);
    const {width, height} = build;

    // 1. Make the frames match the sequence time line.
    graph.filters(timingFilters(planned, build, isStill, hasAlpha));

    // 2. Fit the picture inside the frame.
    graph.filters([`scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=${build.scaleFlags}`, 'setsar=1']);

    // 3. Effects and color tuning. Some of these would throw away transparency, so they are protected.
    const colorList = effectFilters(planned, build);

    if (hasAlpha) {
        graph.alphaSafe(colorList);
    } else {
        graph.filters(colorList);
    }

    graph.filters(['format=rgba']);

    // 4. Masks.
    const maskPath = build.request.assets?.[`mask:${clip.id}`];

    if (maskPath && activeMasks(clip.masks).length > 0) {
        const maskInput = addInput(build, ['-an', '-loop', '1', '-framerate', build.frameRate, '-t', num(planned.duration + 0.5), '-i', maskPath]);

        graph.mask(maskInput);
    }

    // 5. Motion: size, then turn.
    const scale = animatedValue(planned, PATH.scale, clip.motion.scale, 't');

    if (scale.animated) {
        graph.filters([
            `scale=w='max(2,trunc(iw*(${scale.text})/200)*2)':h='max(2,trunc(ih*(${scale.text})/200)*2)':eval=frame`,
            'format=rgba'
        ]);
    } else if (Math.abs(Number(scale.text) / 100 - 1) > 0.0001) {
        const factor = num(Number(scale.text) / 100);

        graph.filters([`scale=w='max(2,trunc(iw*${factor}/2)*2)':h='max(2,trunc(ih*${factor}/2)*2)'`]);
    }

    const rotation = animatedValue(planned, PATH.rotation, clip.motion.rotation, 't');

    if (rotation.animated) {
        graph.filters([`rotate=a='(${rotation.text})*PI/180':ow='hypot(iw,ih)':oh='hypot(iw,ih)':c=black@0`]);
    } else if (Math.abs(Number(rotation.text)) > 0.01) {
        const radians = num((Number(rotation.text) * Math.PI) / 180);

        graph.filters([`rotate=${radians}:ow=rotw(${radians}):oh=roth(${radians}):c=black@0`]);
    }

    // 6. Opacity.
    const opacity = animatedValue(planned, PATH.opacity, clip.motion.opacity, 't');

    if (opacity.animated) {
        graph.filters([
            'format=gbrap',
            `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*clip((${opacity.text.replace(/\bt\b/g, 'T')})/100,0,1)'`,
            'format=rgba'
        ]);
    } else if (Number(opacity.text) < 99.99) {
        graph.filters([`colorchannelmixer=aa=${num(Math.max(0, Number(opacity.text)) / 100)}`]);
    }

    // 7. Transitions at the start and the end of the clip.
    graph.filters(transitionFilters(planned));

    // 8. Move the frames to where the clip sits on the time line.
    graph.filters([`setpts=PTS+${num(planned.start)}/TB`]);

    return graph.current;
}

/** Builds the picture of one sequence: its canvas, with every clip drawn over it. Returns the label of the result. */
function buildVideoLayer(build: Build, plan: ExportPlan, transparent: boolean): string {
    const {width, height, frameRate} = build;
    const base = newLabel(build, 'base');
    let previous = `[${base}]`;

    if (transparent) {
        build.graph.push(`color=c=black@0:s=${width}x${height}:r=${frameRate}:d=${num(plan.duration)},format=rgba[${base}]`);
    } else {
        build.graph.push(`color=c=black:s=${width}x${height}:r=${frameRate}:d=${num(plan.duration)}[${base}]`);
    }

    for (const planned of plan.videoClips) {
        const {clip, media} = planned;
        const kind = clipSourceKind(clip);
        let source: string;

        if (planned.nested) {
            source = buildVideoLayer(build, planned.nested, true);
        } else if (media.kind === 'image') {
            const index = addInput(build, ['-an', '-loop', '1', '-framerate', frameRate, '-t', num(planned.duration + 0.5), '-i', media.path]);

            source = `[${index}:v]`;
        } else {
            const index = addInput(build, ['-an', '-ss', num(planned.sourceIn), '-t', num(planned.sourceDuration), '-i', media.path]);

            source = `[${index}:v]`;
        }

        const hasAlpha = kind === 'text' || kind === 'nest' || (media.kind === 'image' && ALPHA_IMAGE_EXTENSIONS.includes(extensionOf(media.path)));
        const finished = buildClipVideo(build, planned, source, hasAlpha);

        // Position, which may change over time. "t" is the time of the canvas.
        const localTime = `t-${num(planned.start)}`;
        const x = animatedValue(planned, PATH.x, clip.motion.x, `(${localTime})`);
        const y = animatedValue(planned, PATH.y, clip.motion.y, `(${localTime})`);
        const offsetX = x.animated ? `(${x.text})*${num(build.scaleFactor)}` : num(Number(x.text) * build.scaleFactor);
        const offsetY = y.animated ? `(${y.text})*${num(build.scaleFactor)}` : num(Number(y.text) * build.scaleFactor);
        const from = num(planned.start);
        const to = num(planned.start + planned.duration);
        const next = newLabel(build, 'base');
        const overlayFormat = transparent ? ':format=auto' : '';

        build.graph.push(
            `${previous}${finished}overlay=x='(W-w)/2+${offsetX}':y='(H-h)/2+${offsetY}':eof_action=pass${overlayFormat}:enable='between(t,${from},${to})'[${next}]`
        );
        previous = `[${next}]`;
    }

    return previous;
}

// === Sound === //

/** atempo only takes 0.5 to 2, so bigger changes are chained. */
function tempoChain(speed: number): string[] {
    const steps: string[] = [];
    let remaining = speed;

    while (remaining > 2) {
        steps.push('atempo=2');
        remaining /= 2;
    }

    while (remaining < 0.5) {
        steps.push('atempo=0.5');
        remaining /= 0.5;
    }

    if (Math.abs(remaining - 1) > 0.0001) {
        steps.push(`atempo=${num(remaining)}`);
    }

    return steps;
}

function balanceGains(pan: number): { left: number; right: number } {
    const clamped = Math.min(100, Math.max(-100, pan));

    return {left: Math.min(1, 1 - clamped / 100), right: Math.min(1, 1 + clamped / 100)};
}

function buildClipAudio(build: Build, planned: PlannedClip, source: string): string {
    const {clip, track, media} = planned;
    const chain: string[] = [];
    const layout = build.channels === 1 ? 'mono' : 'stereo';
    const middle = resolveClip(clip, middleTime(planned));

    if (clip.reverse) {
        chain.push('areverse');
    }

    if (Math.abs(clip.speed - 1) > 0.0001) {
        if (clip.maintainPitch) {
            chain.push(...tempoChain(clip.speed));
        } else {
            chain.push(`asetrate=${Math.round((media.sampleRate || 48000) * clip.speed)}`, `aresample=${build.sampleRate}`);
        }
    }

    const amplify = activeEffects(clip, ['amplify']).reduce((total, effect) => total + effectParam(effect, 'gain', 0), 0);
    const extraDb = amplify + track.volumeDb;
    const volume = animatedValue(planned, PATH.volume, clip.volumeDb, 't');

    if (volume.animated) {
        chain.push(`volume='pow(10,((${volume.text})+${num(extraDb)})/20)':eval=frame`);
    } else if (Math.abs(Number(volume.text) + extraDb) > 0.01) {
        chain.push(`volume=${num(Number(volume.text) + extraDb)}dB`);
    }

    chain.push(`aformat=sample_fmts=fltp:sample_rates=${build.sampleRate}:channel_layouts=${layout}`);

    // The pan of a clip and the pan of its track add up. It cannot change over time, so the middle of the clip is used.
    const pan = (middle.pan ?? 0) + track.pan;

    if (build.channels === 2 && Math.abs(pan) > 0.5) {
        const gains = balanceGains(pan);

        chain.push(`pan=stereo|c0=${num(gains.left)}*c0|c1=${num(gains.right)}*c1`);
    }

    const totalLength = planned.headCut + planned.duration + planned.tailCut;

    for (const effect of activeEffects(clip, ['audioFadeIn', 'audioFadeOut'])) {
        const length = Math.max(0.01, effectParam(effect, 'duration', 1));

        if (effect.kind === 'audioFadeIn') {
            if (length > planned.headCut + 0.001) {
                chain.push(`afade=t=in:st=${num(-planned.headCut)}:d=${num(length)}`);
            }
        } else {
            const startInVisible = totalLength - length - planned.headCut;

            if (startInVisible < planned.duration - 0.001) {
                chain.push(`afade=t=out:st=${num(startInVisible)}:d=${num(length)}`);
            }
        }
    }

    const delayMs = Math.round(planned.start * 1000);

    if (delayMs > 0) {
        chain.push(`adelay=${delayMs}:all=1`);
    }

    const output = `[${newLabel(build, 'a')}]`;

    build.graph.push(`${source}${chain.join(',')}${output}`);

    return output;
}

/** Mixes the sound of one sequence. Returns the label of the mix, or null when there is no sound. */
function buildAudioMix(build: Build, plan: ExportPlan, padToLength: boolean): string | null {
    const labels: string[] = [];

    for (const planned of plan.audioClips) {
        let source: string;

        if (planned.nested) {
            const inner = buildAudioMix(build, planned.nested, false);

            if (!inner) {
                continue;
            }

            source = inner;
        } else {
            const index = addInput(build, ['-vn', '-ss', num(planned.sourceIn), '-t', num(planned.sourceDuration), '-i', planned.media.path]);

            source = `[${index}:a]`;
        }

        labels.push(buildClipAudio(build, planned, source));
    }

    if (labels.length === 0) {
        return null;
    }

    const count = labels.length;
    const mixed = `[${newLabel(build, 'mix')}]`;
    const master = plan.sequence.masterDb;
    const tail: string[] = [];

    if (Math.abs(master) > 0.01) {
        tail.push(`volume=${num(master)}dB`);
    }

    if (padToLength) {
        tail.push(`apad=whole_dur=${num(plan.duration)}`);
    }

    const suffix = tail.length > 0 ? `,${tail.join(',')}` : '';

    if (count === 1) {
        build.graph.push(`${labels[0]}anull${suffix}${mixed}`);
    } else if (build.caps.amixNormalize) {
        build.graph.push(`${labels.join('')}amix=inputs=${count}:duration=longest:normalize=0${suffix}${mixed}`);
    } else {
        build.graph.push(`${labels.join('')}amix=inputs=${count}:duration=longest:dropout_transition=0,volume=${count}${suffix}${mixed}`);
    }

    return mixed;
}

// === Encoders === //

/** The pixel format for the result. "Maximum depth" picks the deepest one the format has. */
function outputPixelFormat(format: ExportFormat, maxDepth: boolean): string {
    switch (format.videoCodec) {
        case 'libx264':
        case 'libx265':
        case 'libvpx-vp9':
        case 'libaom-av1':
            return maxDepth ? 'yuv420p10le' : 'yuv420p';
        case 'prores_ks':
            return maxDepth ? 'yuv444p10le' : 'yuv422p10le';
        case 'dnxhd':
            return maxDepth ? 'yuv422p10le' : 'yuv422p';
        default:
            return 'yuv420p';
    }
}

function videoEncoderArgs(format: ExportFormat, request: ExportRequest): string[] {
    const {settings} = request;
    const useCrf = format.supportsCrf && (settings.rateControl === 'crf' || !format.supportsBitrate);
    const bitrate = `${Math.max(100, Math.round(settings.videoKbps))}k`;
    const presets = {fast: 'veryfast', medium: 'medium', slow: 'slow'};
    const vpxSpeed = {fast: '4', medium: '2', slow: '1'};
    const aomSpeed = {fast: '8', medium: '6', slow: '4'};
    const rate = useCrf ? ['-crf', String(Math.round(settings.crf))] : ['-b:v', bitrate];
    const containerFlags = format.extension === 'mp4' || format.extension === 'mov' ? ['-movflags', '+faststart'] : [];
    const pixelFormat = outputPixelFormat(format, settings.maxDepth);
    const qualityFlags = settings.maxQuality ? ['-sws_flags', 'lanczos+accurate_rnd+full_chroma_int'] : [];

    switch (format.videoCodec) {
        case 'libx264':
            return ['-c:v', 'libx264', '-preset', presets[settings.encodeSpeed], ...rate, '-pix_fmt', pixelFormat, ...qualityFlags, ...containerFlags];
        case 'libx265':
            return ['-c:v', 'libx265', '-preset', presets[settings.encodeSpeed], ...rate, '-tag:v', 'hvc1',
                '-x265-params', 'log-level=error', '-pix_fmt', pixelFormat, ...qualityFlags, ...containerFlags];
        case 'prores_ks':
            return ['-c:v', 'prores_ks', '-profile:v', settings.maxDepth ? '4' : '3', '-vendor', 'apl0', '-pix_fmt', pixelFormat, ...qualityFlags];
        case 'dnxhd':
            return ['-c:v', 'dnxhd', '-profile:v', settings.maxDepth ? 'dnxhr_hqx' : 'dnxhr_hq', '-pix_fmt', pixelFormat, ...qualityFlags];
        case 'libvpx-vp9': {
            const vp9Rate = useCrf ? ['-b:v', '0', '-crf', String(Math.round(settings.crf))] : ['-b:v', bitrate];

            return ['-c:v', 'libvpx-vp9', ...vp9Rate, '-row-mt', '1', '-deadline', 'good', '-cpu-used', vpxSpeed[settings.encodeSpeed], '-pix_fmt', pixelFormat, ...qualityFlags];
        }
        case 'libaom-av1':
            return ['-c:v', 'libaom-av1', '-b:v', '0', '-crf', String(Math.round(settings.crf)),
                '-cpu-used', aomSpeed[settings.encodeSpeed], '-row-mt', '1', '-pix_fmt', pixelFormat, ...qualityFlags];
        case 'mpeg2video':
        case 'mpeg4':
        case 'wmv2':
            return ['-c:v', format.videoCodec, '-b:v', bitrate, '-pix_fmt', 'yuv420p', ...qualityFlags];
        case 'gif':
            return ['-loop', '0'];
        default:
            return [];
    }
}

function audioEncoderArgs(format: ExportFormat, request: ExportRequest, sampleRate: number): string[] {
    const {settings} = request;
    const args = ['-c:a', format.audioCodec ?? 'aac', '-ar', String(sampleRate), '-ac', String(settings.channels)];

    if (format.supportsAudioBitrate) {
        args.push('-b:a', `${Math.round(settings.audioKbps)}k`);
    }

    return args;
}

// === The command === //

export function buildExportCommand(request: ExportRequest, caps: ExportCapabilities): ExportCommand {
    const problems = describeExportProblems(request);

    if (problems.length > 0) {
        throw new Error(problems[0]);
    }

    const {settings, sequence} = request;
    const format = findExportFormat(settings.formatId) as ExportFormat;
    const plan = planExport(request);
    const width = even(settings.width);
    const height = even(settings.height);
    const hasVideoOutput = format.type !== 'audio';
    const hasAudioOutput = plan.audioClips.length > 0 && format.audioCodec !== null && format.type !== 'animation';

    const build: Build = {
        request,
        caps,
        width,
        height,
        frameRate: frameRateText(settings.frameRate),
        sampleRate: audioSampleRate(format, settings.sampleRate),
        channels: settings.channels,
        scaleFactor: width / sequence.settings.width,
        scaleFlags: settings.maxQuality ? 'lanczos+accurate_rnd+full_chroma_int' : 'bicubic',
        inputArgs: [],
        inputCount: 0,
        graph: [],
        labelCount: 0
    };

    let videoLabel: string | null = null;
    let audioLabel: string | null = null;

    if (hasVideoOutput) {
        videoLabel = buildVideoLayer(build, plan, false);

        if (format.id === 'gif') {
            const gifRate = Math.min(settings.frameRate, 15);

            build.graph.push(`${videoLabel}fps=${num(gifRate)},split[ga][gb]`);
            build.graph.push('[ga]palettegen[gp]');
            build.graph.push('[gb][gp]paletteuse[vout]');
        } else {
            build.graph.push(`${videoLabel}format=${outputPixelFormat(format, settings.maxDepth)}[vout]`);
        }
    }

    if (hasAudioOutput) {
        audioLabel = buildAudioMix(build, plan, true);

        if (audioLabel) {
            build.graph.push(`${audioLabel}anull[aout]`);
        }
    }

    const args: string[] = ['-loglevel', 'error', '-y', ...build.inputArgs, '-filter_complex', build.graph.join(';')];

    if (hasVideoOutput) {
        args.push('-map', '[vout]');

        // A GIF sets its own, lower frame rate inside the graph.
        if (format.id !== 'gif') {
            args.push('-r', build.frameRate);
        }
    }

    if (audioLabel) {
        args.push('-map', '[aout]');
    } else if (hasVideoOutput) {
        args.push('-an');
    }

    if (hasVideoOutput) {
        args.push(...videoEncoderArgs(format, request));
    }

    if (audioLabel) {
        args.push(...audioEncoderArgs(format, request, build.sampleRate));
    }

    args.push('-progress', 'pipe:1', '-nostats', '-t', num(plan.duration), settings.outputPath);

    return {args, duration: plan.duration};
}
