import {execFile, spawn, type ChildProcess} from 'child_process';
import {existsSync} from 'fs';

export interface FfmpegCapabilities {
    amixNormalize: boolean; // does the amix filter know the "normalize" option?
}

export interface RunResult {
    code: number;
    stdout: string;
    stderr: string;
}

/** Looks for a packaged binary first (ffmpeg-static / ffprobe-static), then for one on the PATH. */
function findBinary(packageName: string, plain: string): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaded = require(packageName);
        const path: unknown = typeof loaded === 'string' ? loaded : loaded?.path;

        if (typeof path === 'string' && path.length > 0) {
            const unpacked = path.replace('app.asar', 'app.asar.unpacked');

            // The package can be installed without its binary (the download step was blocked or skipped).
            // A path that does not exist would fail later with "code -4058", so the PATH is used instead.
            if (existsSync(unpacked)) {
                return unpacked;
            }

            if (existsSync(path)) {
                return path;
            }
        }
    } catch {
        // The package is not installed. The PATH is used instead.
    }

    return plain;
}

/** Finds ffmpeg and ffprobe and runs them. */
export class FfmpegModel {
    readonly ffmpegPath = findBinary('ffmpeg-static', 'ffmpeg');
    readonly ffprobePath = findBinary('ffprobe-static', 'ffprobe');
    private capabilities: FfmpegCapabilities | null = null;

    /** Runs a program until it ends and collects its output. */
    run(program: string, args: string[], maxBuffer = 64 * 1024 * 1024): Promise<RunResult> {
        return new Promise((resolve) => {
            execFile(program, args, {maxBuffer, windowsHide: true}, (error, stdout, stderr) => {
                const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
                resolve({code, stdout: String(stdout), stderr: String(stderr)});
            });
        });
    }

    runFfmpeg(args: string[]): Promise<RunResult> {
        return this.run(this.ffmpegPath, args);
    }

    runFfprobe(args: string[]): Promise<RunResult> {
        return this.run(this.ffprobePath, args);
    }

    /** Starts ffmpeg and lets the caller read its streams. */
    spawnFfmpeg(args: string[]): ChildProcess {
        return spawn(this.ffmpegPath, args, {windowsHide: true});
    }

    /** Checked once, then remembered. */
    async getCapabilities(): Promise<FfmpegCapabilities> {
        if (this.capabilities) {
            return this.capabilities;
        }

        const result = await this.runFfmpeg(['-hide_banner', '-h', 'filter=amix']);

        this.capabilities = {amixNormalize: /\bnormalize\b/.test(result.stdout + result.stderr)};

        return this.capabilities;
    }
}
