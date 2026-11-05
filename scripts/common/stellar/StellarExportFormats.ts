import type {EncodeSpeed} from './StellarContract';

// The formats on the export dialog. Each one maps to an ffmpeg encoder in StellarExportCommand.ts.

export type ExportFormatType = 'video' | 'audio' | 'animation';

export interface ExportFormat {
    id: string;
    label: string;
    extension: string;
    type: ExportFormatType;
    videoCodec: string | null;
    audioCodec: string | null;
    supportsCrf: boolean;       // quality slider
    supportsBitrate: boolean;   // target bitrate
    supportsAudioBitrate: boolean;
    defaultCrf: number;
    crfMin: number;
    crfMax: number;
    defaultVideoKbps: number;
    description: string;
}

const NONE = { supportsCrf: false, supportsBitrate: false, supportsAudioBitrate: false, defaultCrf: 0, crfMin: 0, crfMax: 0, defaultVideoKbps: 0 };

export const EXPORT_FORMATS: ExportFormat[] = [
    { id: 'h264', label: 'H.264', extension: 'mp4', type: 'video', videoCodec: 'libx264', audioCodec: 'aac',
        supportsCrf: true, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 20, crfMin: 12, crfMax: 36, defaultVideoKbps: 12000,
        description: 'MP4 for YouTube, social media and almost every player.' },
    { id: 'hevc', label: 'H.265 (HEVC)', extension: 'mp4', type: 'video', videoCodec: 'libx265', audioCodec: 'aac',
        supportsCrf: true, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 24, crfMin: 16, crfMax: 40, defaultVideoKbps: 8000,
        description: 'Half the size of H.264 at the same quality. Slower to encode.' },
    { id: 'quicktime', label: 'QuickTime (H.264)', extension: 'mov', type: 'video', videoCodec: 'libx264', audioCodec: 'aac',
        supportsCrf: true, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 18, crfMin: 12, crfMax: 36, defaultVideoKbps: 16000,
        description: 'MOV container for Apple apps.' },
    { id: 'prores', label: 'Apple ProRes 422 HQ', extension: 'mov', type: 'video', videoCodec: 'prores_ks', audioCodec: 'pcm_s16le',
        ...NONE, description: 'Editing and mastering codec. Very large files.' },
    { id: 'dnxhr', label: 'DNxHR HQ', extension: 'mov', type: 'video', videoCodec: 'dnxhd', audioCodec: 'pcm_s16le',
        ...NONE, description: 'Avid mastering codec. Very large files.' },
    { id: 'mkv', label: 'Matroska (H.264)', extension: 'mkv', type: 'video', videoCodec: 'libx264', audioCodec: 'aac',
        supportsCrf: true, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 20, crfMin: 12, crfMax: 36, defaultVideoKbps: 12000,
        description: 'MKV container.' },
    { id: 'vp9', label: 'WebM (VP9)', extension: 'webm', type: 'video', videoCodec: 'libvpx-vp9', audioCodec: 'libopus',
        supportsCrf: true, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 32, crfMin: 15, crfMax: 50, defaultVideoKbps: 6000,
        description: 'Open format for the web.' },
    { id: 'av1', label: 'WebM (AV1)', extension: 'webm', type: 'video', videoCodec: 'libaom-av1', audioCodec: 'libopus',
        supportsCrf: true, supportsBitrate: false, supportsAudioBitrate: true, defaultCrf: 32, crfMin: 18, crfMax: 50, defaultVideoKbps: 4000,
        description: 'Smallest files. Very slow to encode.' },
    { id: 'mpeg2', label: 'MPEG-2', extension: 'mpg', type: 'video', videoCodec: 'mpeg2video', audioCodec: 'mp2',
        supportsCrf: false, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 0, crfMin: 0, crfMax: 0, defaultVideoKbps: 10000,
        description: 'DVD and broadcast.' },
    { id: 'avi', label: 'AVI (MPEG-4)', extension: 'avi', type: 'video', videoCodec: 'mpeg4', audioCodec: 'libmp3lame',
        supportsCrf: false, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 0, crfMin: 0, crfMax: 0, defaultVideoKbps: 10000,
        description: 'Old players and Windows tools.' },
    { id: 'wmv', label: 'Windows Media (WMV)', extension: 'wmv', type: 'video', videoCodec: 'wmv2', audioCodec: 'wmav2',
        supportsCrf: false, supportsBitrate: true, supportsAudioBitrate: true, defaultCrf: 0, crfMin: 0, crfMax: 0, defaultVideoKbps: 8000,
        description: 'Windows Media Player.' },
    { id: 'gif', label: 'Animated GIF', extension: 'gif', type: 'animation', videoCodec: 'gif', audioCodec: null,
        ...NONE, description: 'Short looping clips. No sound.' },
    { id: 'mp3', label: 'MP3', extension: 'mp3', type: 'audio', videoCodec: null, audioCodec: 'libmp3lame',
        ...NONE, supportsAudioBitrate: true, description: 'Audio only.' },
    { id: 'aac', label: 'AAC', extension: 'm4a', type: 'audio', videoCodec: null, audioCodec: 'aac',
        ...NONE, supportsAudioBitrate: true, description: 'Audio only.' },
    { id: 'wav', label: 'WAV', extension: 'wav', type: 'audio', videoCodec: null, audioCodec: 'pcm_s16le',
        ...NONE, description: 'Uncompressed audio.' },
    { id: 'flac', label: 'FLAC', extension: 'flac', type: 'audio', videoCodec: null, audioCodec: 'flac',
        ...NONE, description: 'Lossless audio.' },
    { id: 'opus', label: 'Opus', extension: 'opus', type: 'audio', videoCodec: null, audioCodec: 'libopus',
        ...NONE, supportsAudioBitrate: true, description: 'Audio only.' }
];

export function findExportFormat(id: string): ExportFormat | undefined {
    return EXPORT_FORMATS.find((format) => format.id === id);
}

export interface ExportPreset {
    id: string;
    label: string;
    formatIds: string[] | null; // null = every video format
    width: number | null;       // null = same as the sequence
    height: number | null;
    frameRate: number | null;
    crf: number | null;
    videoKbps: number | null;
    audioKbps: number;
}

export const EXPORT_PRESETS: ExportPreset[] = [
    { id: 'match', label: 'Match Sequence Settings', formatIds: null, width: null, height: null, frameRate: null, crf: null, videoKbps: null, audioKbps: 192 },
    { id: 'youtube-4k', label: 'YouTube 2160p 4K Ultra HD', formatIds: ['h264', 'hevc'], width: 3840, height: 2160, frameRate: null, crf: 18, videoKbps: 45000, audioKbps: 320 },
    { id: 'youtube-1080', label: 'YouTube 1080p Full HD', formatIds: ['h264', 'hevc'], width: 1920, height: 1080, frameRate: null, crf: 19, videoKbps: 12000, audioKbps: 256 },
    { id: 'youtube-720', label: 'YouTube 720p HD', formatIds: ['h264', 'hevc'], width: 1280, height: 720, frameRate: null, crf: 21, videoKbps: 6000, audioKbps: 192 },
    { id: 'vimeo-1080', label: 'Vimeo 1080p Full HD', formatIds: ['h264', 'hevc'], width: 1920, height: 1080, frameRate: null, crf: 18, videoKbps: 16000, audioKbps: 256 },
    { id: 'social-vertical', label: 'Vertical 1080x1920 (Reels, Shorts, TikTok)', formatIds: ['h264', 'hevc'], width: 1080, height: 1920, frameRate: 30, crf: 21, videoKbps: 8000, audioKbps: 192 },
    { id: 'social-square', label: 'Square 1080x1080', formatIds: ['h264', 'hevc'], width: 1080, height: 1080, frameRate: 30, crf: 21, videoKbps: 8000, audioKbps: 192 },
    { id: 'web-720', label: 'Small web file 720p', formatIds: ['h264', 'hevc', 'vp9'], width: 1280, height: 720, frameRate: 30, crf: 28, videoKbps: 2500, audioKbps: 128 },
    { id: 'draft', label: 'Quick draft 360p', formatIds: ['h264', 'hevc', 'vp9'], width: 640, height: 360, frameRate: 24, crf: 30, videoKbps: 800, audioKbps: 96 }
];

export const ENCODE_SPEEDS: { id: EncodeSpeed; label: string }[] = [
    { id: 'fast', label: 'Fast encode, larger file' },
    { id: 'medium', label: 'Balanced' },
    { id: 'slow', label: 'Slow encode, smaller file' }
];

export const AUDIO_BITRATES = [96, 128, 160, 192, 256, 320];
export const AUDIO_SAMPLE_RATES = [44100, 48000, 96000];
