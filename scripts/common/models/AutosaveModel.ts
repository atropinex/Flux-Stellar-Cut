import {existsSync, mkdirSync, readdirSync, statSync, unlinkSync} from 'fs';
import {basename, dirname, extname, join} from 'path';
import type {ProjectDocument} from '../stellar/StellarContract';
import {AUTOSAVE_FOLDER_NAME, PROJECT_EXTENSION} from '../stellar/StellarConfig';
import type {ProjectModel} from './ProjectModel';

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/** 2026-10-31 21:35:07 -> "20261031-213507" */
export function autosaveStamp(date: Date): string {
    const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

    return `${day}-${time}`;
}

/** Writes timed copies of the project into "<project folder>/Stellar Auto-Save" and keeps the newest ones. */
export class AutosaveModel {
    constructor(private projects: ProjectModel, private maxVersions: () => number) {}

    save(projectPath: string, document: ProjectDocument, now = new Date()): string {
        const folder = this.folderFor(projectPath);
        const name = basename(projectPath, extname(projectPath));
        const target = join(folder, `${name}-${autosaveStamp(now)}.${PROJECT_EXTENSION}`);

        mkdirSync(folder, {recursive: true});
        this.projects.write(target, document);
        this.prune(projectPath);

        return target;
    }

    /** The newest autosave of this project, but only if it is newer than the saved file. */
    findNewerThan(projectPath: string): string | null {
        if (!existsSync(projectPath)) {
            return null;
        }

        const newest = this.list(projectPath)[0];

        if (!newest) {
            return null;
        }

        const savedTime = statSync(projectPath).mtimeMs;

        return newest.time > savedTime ? newest.path : null;
    }

    /** Autosaves of this project, newest first. */
    list(projectPath: string): {path: string; time: number}[] {
        const folder = this.folderFor(projectPath);

        if (!existsSync(folder)) {
            return [];
        }

        const prefix = `${basename(projectPath, extname(projectPath))}-`;

        return readdirSync(folder)
            .filter((file) => file.startsWith(prefix) && file.endsWith(`.${PROJECT_EXTENSION}`))
            .map((file) => ({path: join(folder, file), time: statSync(join(folder, file)).mtimeMs}))
            .sort((first, second) => second.time - first.time || second.path.localeCompare(first.path));
    }

    private prune(projectPath: string): void {
        const keep = Math.max(1, this.maxVersions());

        for (const old of this.list(projectPath).slice(keep)) {
            try {
                unlinkSync(old.path);
            } catch {
                // A file that is locked is removed next time.
            }
        }
    }

    private folderFor(projectPath: string): string {
        return join(dirname(projectPath), AUTOSAVE_FOLDER_NAME);
    }
}
