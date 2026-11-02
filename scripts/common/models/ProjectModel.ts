import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'fs';
import {basename, dirname, extname, join} from 'path';
import {parse, stringify} from 'yaml';
import type {NewProjectOptions, ProjectDocument, RecentProject} from '../stellar/StellarContract';
import {PROJECT_EXTENSION, RECENT_PROJECTS_LIMIT} from '../stellar/StellarConfig';
import {createEmptyProject, createSequence, normalizeProject} from '../stellar/StellarProjectFactory';

const HEADER = '# Flux-Stellar-Cut project. It is plain YAML, so it can be read, diffed and fixed by hand.\n';

/** Characters that Windows, macOS or Linux do not allow in a file name. */
export function sanitizeFileName(name: string): string {
    const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/[. ]+$/g, '').trim();

    return cleaned.length > 0 ? cleaned : 'Untitled';
}

/** Creates, reads and writes project files, and remembers the recent ones. */
export class ProjectModel {
    private recentFile: string;

    constructor(userDataFolder: string) {
        mkdirSync(userDataFolder, {recursive: true});
        this.recentFile = join(userDataFolder, 'recent-projects.yaml');
    }

    /** Makes "<folder>/<name>/<name>.stellarproj". An existing project is never overwritten. */
    create(options: NewProjectOptions): string {
        const baseName = sanitizeFileName(options.name);
        let name = baseName;
        let counter = 2;

        while (existsSync(join(options.folder, name))) {
            name = `${baseName} ${counter}`;
            counter += 1;
        }

        const projectFolder = join(options.folder, name);
        const path = join(projectFolder, `${name}.${PROJECT_EXTENSION}`);

        mkdirSync(projectFolder, {recursive: true});

        const sequence = options.sequence
            ? createSequence(options.sequence.name, options.sequence)
            : null;

        this.write(path, createEmptyProject(baseName, sequence));

        return path;
    }

    read(path: string): ProjectDocument {
        const text = readFileSync(path, 'utf8');
        let raw: unknown;

        try {
            raw = parse(text);
        } catch (error) {
            throw new Error(`the project file is damaged (${error instanceof Error ? error.message : String(error)})`);
        }

        return normalizeProject(raw);
    }

    /** Writes to a temporary file first, so a crash can never leave half a project behind. */
    write(path: string, document: ProjectDocument): void {
        const saved: ProjectDocument = {...document, modifiedAt: new Date().toISOString()};
        const temporaryPath = `${path}.tmp`;

        mkdirSync(dirname(path), {recursive: true});
        writeFileSync(temporaryPath, HEADER + stringify(saved), 'utf8');
        renameSync(temporaryPath, path);
    }

    /** Adds the extension when the user left it out. */
    withExtension(path: string): string {
        return extname(path).toLowerCase() === `.${PROJECT_EXTENSION}` ? path : `${path}.${PROJECT_EXTENSION}`;
    }

    // === Recent projects === //

    listRecent(): RecentProject[] {
        return this.readRecent().map((entry) => ({...entry, exists: existsSync(entry.path)}));
    }

    addRecent(path: string, name?: string): void {
        const recent = this.readRecent().filter((entry) => entry.path !== path);

        recent.unshift({
            name: name ?? basename(path, extname(path)),
            path,
            openedAt: new Date().toISOString()
        });

        this.writeRecent(recent.slice(0, RECENT_PROJECTS_LIMIT));
    }

    removeRecent(path: string): RecentProject[] {
        this.writeRecent(this.readRecent().filter((entry) => entry.path !== path));

        return this.listRecent();
    }

    private readRecent(): Omit<RecentProject, 'exists'>[] {
        if (!existsSync(this.recentFile)) {
            return [];
        }

        try {
            const raw = parse(readFileSync(this.recentFile, 'utf8'));
            const list: unknown[] = Array.isArray(raw?.projects) ? raw.projects : [];

            return list
                .filter((entry): entry is Omit<RecentProject, 'exists'> => {
                    const candidate = entry as Partial<RecentProject> | null;

                    return typeof candidate?.path === 'string' && typeof candidate?.name === 'string';
                })
                .map((entry) => ({name: entry.name, path: entry.path, openedAt: String(entry.openedAt ?? '')}));
        } catch {
            return [];
        }
    }

    private writeRecent(projects: Omit<RecentProject, 'exists'>[]): void {
        writeFileSync(this.recentFile, '# Projects shown on the launcher, newest first.\n' + stringify({projects}), 'utf8');
    }
}
