import {createHash} from 'crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync} from 'fs';
import {basename, extname, join} from 'path';
import type {MediaDescription, MediaKind, PlaybackSource, ProbeResult, WaveformData} from '../stellar/StellarContract';
import {toMediaUrl} from '../stellar/StellarConnection';
import {AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, WEB_IMAGE_EXTENSIONS} from '../stellar/StellarConfig';
import type {FfmpegModel} from './FfmpegModel';

/** The settings that the media code reads. They can change while the app runs, so they are read when needed. */
export interface MediaSettings {
    stillDurationSeconds: number;
    proxyHeight: number;
    autoProxy: boolean;
}

const NATIVE_CONTAINERS = ['mp4', 'm4v', 'mov', 'webm'];
const NATIVE_VIDEO_CODECS = ['h264', 'vp8', 'vp9', 'av1'];
const NATIVE_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];
const NATIVE_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus'];
const THUMBNAIL_HEIGHT = 180;
const WAVEFORM_SAMPLE_RATE = 4000;
const WAVEFORM_PEAKS_PER_SECOND = 50;
const SAMPLES_PER_PEAK = WAVEFORM_SAMPLE_RATE / WAVEFORM_PEAKS_PER_SECOND;

interface ProbeStream {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
    duration?: string;
    sample_rate?: string;
    channels?: number;
    disposition?: {attached_pic?: number};
    tags?: Record<string, string>;
    side_data_list?: {rotation?: number}[];
}

interface ProbeOutput {
    streams?: ProbeStream[];
    format?: {format_name?: string; duration?: string; size?: string; tags?: Record<string, string>};
}

function extensionOf(path: string): string {
    return extname(path).slice(1).toLowerCase();
}

/** "30000/1001" -> 29.97 */
export function parseFrameRate(text: string | undefined): number {
    if (!text) {
        return 0;
    }

    const [top, bottom] = text.split('/').map(Number);

    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
        return Number.isFinite(top) ? top : 0;
    }

    return top / bottom;
}

/** Reads files with ffprobe, makes thumbnails, waveforms and smooth-playback copies (proxies) with ffmpeg. */
export class MediaModel {
    private probeCache = new Map<string, ProbeResult>();
    private thumbnailJobs = new Map<string, Promise<string | null>>();
    private waveformCache = new Map<string, WaveformData | null>();
    private proxyState = new Map<string, PlaybackSource>();
    private proxyQueue: (() => Promise<void>)[] = [];
    private proxyRunning = false;

    constructor(
        private ffmpeg: FfmpegModel,
        readonly cacheFolder: string,
        private getSettings: () => MediaSettings,
        private onProxyUpdate: (source: PlaybackSource) => void
    ) {
        for (const folder of ['thumbs', 'proxies', 'waveforms', 'images']) {
            mkdirSync(join(cacheFolder, folder), {recursive: true});
        }
    }

    // === Probe === //

    async probeMany(paths: string[]): Promise<ProbeResult[]> {
        const results: ProbeResult[] = [];

        for (const path of paths) {
            results.push(await this.probe(path));
        }

        return results;
    }

    async probe(path: string): Promise<ProbeResult> {
        if (!existsSync(path)) {
            return {path, media: null, error: 'The file was not found.'};
        }

        const key = this.fileKey(path);
        const cached = this.probeCache.get(key);

        if (cached) {
            return cached;
        }

        const result = await this.probeFile(path);

        this.probeCache.set(key, result);

        return result;
    }

    private async probeFile(path: string): Promise<ProbeResult> {
        const extension = extensionOf(path);
        const knownType = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS].includes(extension);

        const output = await this.ffmpeg.runFfprobe([
            '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path
        ]);

        if (output.code !== 0) {
            return {path, media: null, error: knownType ? 'The file is damaged or cannot be read.' : 'This file type is not supported.'};
        }

        let data: ProbeOutput;

        try {
            data = JSON.parse(output.stdout) as ProbeOutput;
        } catch {
            return {path, media: null, error: 'The file could not be read.'};
        }

        const streams = data.streams ?? [];
        const videoStream = streams.find((stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
        const audioStream = streams.find((stream) => stream.codec_type === 'audio');
        const isImage = IMAGE_EXTENSIONS.includes(extension) && videoStream !== undefined;

        if (!videoStream && !audioStream) {
            return {path, media: null, error: 'There is no video or audio in this file.'};
        }

        const kind: MediaKind = isImage ? 'image' : videoStream ? 'video' : 'audio';
        const media = this.describe(path, kind, data, videoStream, audioStream);

        return {path, media, error: null};
    }

    private describe(path: string, kind: MediaKind, data: ProbeOutput, video?: ProbeStream, audio?: ProbeStream): MediaDescription {
        let width = video?.width ?? 0;
        let height = video?.height ?? 0;
        const rotation = this.rotationOf(video);

        // A phone video that is stored sideways and flagged as rotated.
        if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) {
            [width, height] = [height, width];
        }

        const frameRate = this.frameRateOf(video);
        let duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0);

        if (!Number.isFinite(duration)) {
            duration = 0;
        }

        if (kind === 'image') {
            duration = this.getSettings().stillDurationSeconds;
        }

        return {
            name: basename(path),
            path,
            kind,
            duration,
            width,
            height,
            frameRate: kind === 'video' ? frameRate : 0,
            videoCodec: video?.codec_name ?? null,
            audioCodec: audio?.codec_name ?? null,
            hasVideo: video !== undefined,
            hasAudio: audio !== undefined && kind !== 'image',
            sampleRate: audio ? Number(audio.sample_rate ?? 0) : 0,
            channels: audio?.channels ?? 0,
            fileSize: Number(data.format?.size ?? statSync(path).size),
            container: (data.format?.format_name ?? extensionOf(path)).split(',')[0],
            // Tags written in the file (title, artist, encoder...) start the metadata the person can edit later.
            metadata: Object.fromEntries(Object.entries(data.format?.tags ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]))
        };
    }

    private rotationOf(video?: ProbeStream): number {
        const fromSideData = video?.side_data_list?.find((item) => typeof item.rotation === 'number')?.rotation;
        const fromTag = Number(video?.tags?.rotate);

        if (typeof fromSideData === 'number') {
            return fromSideData;
        }

        return Number.isFinite(fromTag) ? fromTag : 0;
    }

    private frameRateOf(video?: ProbeStream): number {
        const average = parseFrameRate(video?.avg_frame_rate);
        const real = parseFrameRate(video?.r_frame_rate);

        if (average > 0 && average < 1000) {
            return average;
        }

        return real > 0 && real < 1000 ? real : 25;
    }

    // === Files === //

    checkFiles(paths: string[]): Record<string, boolean> {
        const result: Record<string, boolean> = {};

        for (const path of paths) {
            result[path] = existsSync(path);
        }

        return result;
    }

    /** A short name that changes when the file changes. */
    private fileKey(path: string, extra = ''): string {
        let signature = 'missing';

        try {
            const info = statSync(path);

            signature = `${info.size}|${info.mtimeMs}`;
        } catch {
            // The file is gone. The key is still valid.
        }

        return createHash('sha1').update(`${path}|${signature}|${extra}`).digest('hex');
    }

    // === Thumbnails === //

    getThumbnail(path: string, kind: MediaKind, duration: number): Promise<string | null> {
        if (kind === 'audio' || !existsSync(path)) {
            return Promise.resolve(null);
        }

        const target = join(this.cacheFolder, 'thumbs', `${this.fileKey(path)}.jpg`);

        if (existsSync(target)) {
            return Promise.resolve(toMediaUrl(target));
        }

        const running = this.thumbnailJobs.get(target);

        if (running) {
            return running;
        }

        const job = this.makeThumbnail(path, kind, duration, target).finally(() => {
            this.thumbnailJobs.delete(target);
        });

        this.thumbnailJobs.set(target, job);

        return job;
    }

    private async makeThumbnail(path: string, kind: MediaKind, duration: number, target: string): Promise<string | null> {
        const seekTime = kind === 'video' ? Math.min(duration * 0.1, 1) : 0;
        const temporary = target.replace(/\.jpg$/, '.part.jpg');

        const result = await this.ffmpeg.runFfmpeg([
            '-v', 'error', '-y', '-ss', String(seekTime), '-i', path,
            '-frames:v', '1', '-vf', `scale=-2:${THUMBNAIL_HEIGHT}`, '-q:v', '4', temporary
        ]);

        if (result.code !== 0 || !existsSync(temporary)) {
            return null;
        }

        renameSync(temporary, target);

        return toMediaUrl(target);
    }

    // === Playback === //

    async getPlaybackSource(path: string, kind: MediaKind): Promise<PlaybackSource> {
        const original: PlaybackSource = {path, url: toMediaUrl(path), mode: 'original', progress: 0};
        const extension = extensionOf(path);

        if (!existsSync(path)) {
            return {...original, mode: 'failed'};
        }

        if (kind === 'image') {
            return WEB_IMAGE_EXTENSIONS.includes(extension) ? original : this.convertImage(path);
        }

        const probed = await this.probe(path);

        if (!probed.media || this.isNative(extension, probed.media)) {
            return original;
        }

        if (!this.getSettings().autoProxy) {
            return original;
        }

        return this.requestProxy(path, probed.media);
    }

    /** True when the built-in player can decode the file as it is. */
    isNative(extension: string, media: MediaDescription): boolean {
        if (media.kind === 'audio') {
            return NATIVE_AUDIO_EXTENSIONS.includes(extension);
        }

        const videoOk = media.videoCodec !== null && NATIVE_VIDEO_CODECS.includes(media.videoCodec);
        const audioOk = media.audioCodec === null
            || NATIVE_AUDIO_CODECS.includes(media.audioCodec)
            || media.audioCodec.startsWith('pcm_');

        return NATIVE_CONTAINERS.includes(extension) && videoOk && audioOk;
    }

    private async convertImage(path: string): Promise<PlaybackSource> {
        const target = join(this.cacheFolder, 'images', `${this.fileKey(path)}.png`);
        const base: PlaybackSource = {path, url: toMediaUrl(target), mode: 'proxy', progress: 1};

        if (existsSync(target)) {
            return base;
        }

        const result = await this.ffmpeg.runFfmpeg(['-v', 'error', '-y', '-i', path, '-frames:v', '1', target]);

        if (result.code !== 0) {
            return {...base, url: toMediaUrl(path), mode: 'failed', progress: 0};
        }

        return base;
    }

    private requestProxy(path: string, media: MediaDescription): PlaybackSource {
        const settings = this.getSettings();
        const extension = media.kind === 'audio' ? 'm4a' : 'mp4';
        const hash = this.fileKey(path, String(settings.proxyHeight));
        const target = join(this.cacheFolder, 'proxies', `${hash}.${extension}`);
        const known = this.proxyState.get(target);

        if (known && known.mode !== 'failed') {
            return known;
        }

        if (existsSync(target)) {
            const ready: PlaybackSource = {path, url: toMediaUrl(target), mode: 'proxy', progress: 1};

            this.proxyState.set(target, ready);

            return ready;
        }

        const building: PlaybackSource = {path, url: toMediaUrl(path), mode: 'building', progress: 0};

        this.proxyState.set(target, building);
        this.proxyQueue.push(() => this.buildProxy(path, media, target));
        void this.runProxyQueue();

        return building;
    }

    /** Proxies are made one at a time, so the computer stays usable. */
    private async runProxyQueue(): Promise<void> {
        if (this.proxyRunning) {
            return;
        }

        this.proxyRunning = true;

        while (this.proxyQueue.length > 0) {
            const next = this.proxyQueue.shift();

            if (next) {
                await next();
            }
        }

        this.proxyRunning = false;
    }

    private buildProxy(path: string, media: MediaDescription, target: string): Promise<void> {
        const height = this.getSettings().proxyHeight;
        const temporary = target.replace(/\.(mp4|m4a)$/, '.part.$1');
        const args = ['-v', 'error', '-y', '-i', path];

        if (media.kind === 'audio') {
            args.push('-vn', '-c:a', 'aac', '-b:a', '160k');
        } else {
            args.push(
                '-map', '0:v:0', '-map', '0:a:0?',
                '-vf', `scale=-2:'min(${height},ih)',format=yuv420p`,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-g', '15',
                '-c:a', 'aac', '-b:a', '160k'
            );
        }

        args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', temporary);

        return new Promise((resolve) => {
            const child = this.ffmpeg.spawnFfmpeg(args);
            let buffer = '';

            child.stdout?.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');

                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const match = /^out_time_(?:us|ms)=(\d+)/.exec(line);

                    if (match && media.duration > 0) {
                        const progress = Math.min(0.99, Number(match[1]) / 1_000_000 / media.duration);

                        this.setProxyState(target, {path, url: toMediaUrl(path), mode: 'building', progress});
                    }
                }
            });

            child.on('close', (code) => {
                if (code === 0 && existsSync(temporary)) {
                    renameSync(temporary, target);
                    this.setProxyState(target, {path, url: toMediaUrl(target), mode: 'proxy', progress: 1});
                } else {
                    this.setProxyState(target, {path, url: toMediaUrl(path), mode: 'failed', progress: 0});
                }

                resolve();
            });

            child.on('error', () => {
                this.setProxyState(target, {path, url: toMediaUrl(path), mode: 'failed', progress: 0});
                resolve();
            });
        });
    }

    private setProxyState(target: string, source: PlaybackSource): void {
        this.proxyState.set(target, source);
        this.onProxyUpdate(source);
    }

    // === Waveform === //

    async getWaveform(path: string): Promise<WaveformData | null> {
        if (!existsSync(path)) {
            return null;
        }

        const key = this.fileKey(path);

        if (this.waveformCache.has(key)) {
            return this.waveformCache.get(key) ?? null;
        }

        const file = join(this.cacheFolder, 'waveforms', `${key}.peaks`);
        let data: WaveformData | null = null;

        if (existsSync(file)) {
            data = {peaksPerSecond: WAVEFORM_PEAKS_PER_SECOND, peaks: readFileSync(file).toString('base64')};
        } else {
            const peaks = await this.readPeaks(path);

            if (peaks.length > 0) {
                writeFileSync(file, peaks);
                data = {peaksPerSecond: WAVEFORM_PEAKS_PER_SECOND, peaks: peaks.toString('base64')};
            }
        }

        this.waveformCache.set(key, data);

        return data;
    }

    /** Decodes the audio to mono 4000 Hz and keeps the loudest sample of every 20 ms. */
    private readPeaks(path: string): Promise<Buffer> {
        return new Promise((resolve) => {
            const child = this.ffmpeg.spawnFfmpeg([
                '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', String(WAVEFORM_SAMPLE_RATE), '-f', 's16le', '-'
            ]);
            const peaks: number[] = [];
            let leftover = Buffer.alloc(0);
            let samplesInBucket = 0;
            let bucketMax = 0;

            child.stdout?.on('data', (chunk: Buffer) => {
                const data = Buffer.concat([leftover, chunk]);
                const usable = data.length - (data.length % 2);

                leftover = data.subarray(usable);

                for (let offset = 0; offset < usable; offset += 2) {
                    bucketMax = Math.max(bucketMax, Math.abs(data.readInt16LE(offset)));
                    samplesInBucket += 1;

                    if (samplesInBucket === SAMPLES_PER_PEAK) {
                        peaks.push(Math.min(255, Math.round((bucketMax / 32768) * 255)));
                        samplesInBucket = 0;
                        bucketMax = 0;
                    }
                }
            });

            child.on('close', () => {
                if (samplesInBucket > 0) {
                    peaks.push(Math.min(255, Math.round((bucketMax / 32768) * 255)));
                }

                resolve(Buffer.from(peaks));
            });

            child.on('error', () => resolve(Buffer.alloc(0)));
        });
    }
}
