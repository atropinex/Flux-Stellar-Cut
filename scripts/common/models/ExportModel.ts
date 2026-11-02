import {existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {dirname, join} from 'path';
import type {ChildProcess} from 'child_process';
import type {ExportProgress, ExportRequest, ExportStartResult} from '../stellar/StellarContract';
import {buildExportCommand} from '../stellar/StellarExportCommand';
import {createId} from '../utils/StellarTimeHelper';
import type {FfmpegModel} from './FfmpegModel';

interface RunningJob {
    id: string;
    process: ChildProcess;
    outputPath: string;
    wasCancelled: boolean;
    tempFolder: string | null;
}

/** Renders a sequence with ffmpeg. One export runs at a time. */
export class ExportModel {
    private job: RunningJob | null = null;

    constructor(private ffmpeg: FfmpegModel) {
    }

    isBusy(): boolean {
        return this.job !== null;
    }

    /** Starts the render. The progress callback is called until the status is "done", "error" or "cancelled". */
    async start(request: ExportRequest, onProgress: (progress: ExportProgress) => void): Promise<ExportStartResult> {
        if (this.job) {
            return {ok: false, jobId: null, error: 'Another export is still running.'};
        }

        let command;
        let tempFolder: string | null = null;

        try {
            // The pictures the page drew (text and masks) become files that ffmpeg can read.
            const assets: Record<string, string> = {...(request.assets ?? {})};
            const inline = request.inlineAssets ?? {};

            if (Object.keys(inline).length > 0) {
                tempFolder = mkdtempSync(join(tmpdir(), 'stellar-export-'));

                for (const [key, base64] of Object.entries(inline)) {
                    const path = join(tempFolder, `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`);

                    writeFileSync(path, Buffer.from(base64, 'base64'));
                    assets[key] = path;
                }
            }

            command = buildExportCommand({
                ...request,
                assets,
                inlineAssets: undefined
            }, await this.ffmpeg.getCapabilities());
            mkdirSync(dirname(request.settings.outputPath), {recursive: true});
        } catch (error) {
            this.removeTempFolder(tempFolder);

            return {ok: false, jobId: null, error: error instanceof Error ? error.message : String(error)};
        }

        const jobId = createId('export');
        const outputPath = request.settings.outputPath;
        const process = this.ffmpeg.spawnFfmpeg(command.args);
        const job: RunningJob = {id: jobId, process, outputPath, wasCancelled: false, tempFolder};
        const startedAt = Date.now();
        let speed: number | null = null;
        let buffer = '';
        let errorText = '';

        this.job = job;

        const report = (status: ExportProgress['status'], percent: number, message: string | null): void => {
            const elapsed = (Date.now() - startedAt) / 1000;
            const eta = status === 'running' && percent > 1 ? (elapsed / percent) * (100 - percent) : null;

            onProgress({jobId, status, percent, etaSeconds: eta, speed, outputPath, message});
        };

        process.stdout?.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');

            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const time = /^out_time_(?:us|ms)=(-?\d+)/.exec(line);
                const rate = /^speed=\s*([\d.]+)x/.exec(line);

                if (rate) {
                    speed = Number(rate[1]);
                }

                if (time) {
                    const seconds = Math.max(0, Number(time[1]) / 1_000_000);

                    report('running', Math.min(99.9, (seconds / command.duration) * 100), null);
                }
            }
        });

        process.stderr?.on('data', (chunk: Buffer) => {
            // Only the last lines matter. They hold the reason for a failure.
            errorText = (errorText + chunk.toString()).split('\n').slice(-12).join('\n');
        });

        let startFailed = false;

        process.on('error', (error) => {
            startFailed = true;
            this.job = null;
            this.removeTempFolder(tempFolder);
            report('error', 0, `ffmpeg could not be started (${error.message}). Looked for: ${this.ffmpeg.ffmpegPath}. Run "npm install" again so ffmpeg-static can download its program, or install ffmpeg and add it to your PATH.`);
        });

        process.on('close', (code) => {
            // A program that could not be started also "closes" (with code -4058 on Windows). The reason was already reported.
            if (startFailed) {
                return;
            }

            this.job = null;
            this.removeTempFolder(tempFolder);

            if (job.wasCancelled) {
                this.removePartialFile(outputPath);
                report('cancelled', 0, null);
            } else if (code === 0) {
                report('done', 100, null);
            } else {
                this.removePartialFile(outputPath);
                report('error', 0, errorText.trim() || `ffmpeg stopped with code ${code}.`);
            }
        });

        report('running', 0, null);

        return {ok: true, jobId, error: null};
    }

    cancel(jobId: string): void {
        if (this.job && this.job.id === jobId) {
            this.job.wasCancelled = true;
            this.job.process.kill();
        }
    }

    private removeTempFolder(folder: string | null): void {
        if (!folder) {
            return;
        }

        try {
            rmSync(folder, {recursive: true, force: true});
        } catch {
            // The system cleans its temp folder later.
        }
    }

    private removePartialFile(path: string): void {
        try {
            if (existsSync(path)) {
                unlinkSync(path);
            }
        } catch {
            // The file is locked or already gone.
        }
    }
}
