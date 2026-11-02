import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {parse, stringify} from 'yaml';
import type {AppSettings, UpdatableSettings} from '../CommonInteface';
import {DEFAULT_SETTINGS} from '../stellar/StellarConfig';
import {clamp} from '../utils/StellarTimeHelper';

/** The app settings, saved as settings.yaml in the given folder. */
export class SettingsModel {
    private file: string;
    private settings: AppSettings;

    constructor(folder: string) {
        mkdirSync(folder, {recursive: true});
        this.file = join(folder, 'settings.yaml');
        this.settings = this.load();
    }

    get(): AppSettings {
        return {...this.settings, layout: {...this.settings.layout}};
    }

    update(changes: UpdatableSettings): AppSettings {
        this.settings = this.clean({...this.settings, ...changes});
        this.save();

        return this.get();
    }

    private load(): AppSettings {
        if (!existsSync(this.file)) {
            return {...DEFAULT_SETTINGS, layout: {}};
        }

        try {
            const raw = parse(readFileSync(this.file, 'utf8'));

            if (raw && typeof raw === 'object') {
                return this.clean({...DEFAULT_SETTINGS, ...raw});
            }
        } catch {
            // A broken file falls back to the defaults.
        }

        return {...DEFAULT_SETTINGS, layout: {}};
    }

    private save(): void {
        const header = '# Flux-Stellar-Cut settings. Safe to edit while the app is closed.\n';

        writeFileSync(this.file, header + stringify(this.settings), 'utf8');
    }

    /** Keeps only valid values, because the changes come from the window. */
    private clean(input: AppSettings): AppSettings {
        const defaults = DEFAULT_SETTINGS;
        const text = (value: unknown, fallback: string): string => {
            return typeof value === 'string' ? value : fallback;
        };
        const flag = (value: unknown, fallback: boolean): boolean => {
            return typeof value === 'boolean' ? value : fallback;
        };
        const number = (value: unknown, fallback: number, min: number, max: number): number => {
            return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
        };

        const layout: Record<string, number> = {};

        if (input.layout && typeof input.layout === 'object') {
            for (const [key, value] of Object.entries(input.layout)) {
                if (typeof value === 'number' && Number.isFinite(value)) {
                    layout[key] = value;
                }
            }
        }

        return {
            theme: text(input.theme, defaults.theme),
            workspace: text(input.workspace, defaults.workspace),
            layout,
            autosaveEnabled: flag(input.autosaveEnabled, defaults.autosaveEnabled),
            autosaveIntervalMinutes: Math.round(number(input.autosaveIntervalMinutes, defaults.autosaveIntervalMinutes, 1, 120)),
            autosaveMaxVersions: Math.round(number(input.autosaveMaxVersions, defaults.autosaveMaxVersions, 1, 200)),
            autoProxy: flag(input.autoProxy, defaults.autoProxy),
            proxyHeight: Math.round(number(input.proxyHeight, defaults.proxyHeight, 144, 2160)),
            stillDurationSeconds: number(input.stillDurationSeconds, defaults.stillDurationSeconds, 0.5, 600),
            snapping: flag(input.snapping, defaults.snapping),
            linkedSelection: flag(input.linkedSelection, defaults.linkedSelection),
            lastProjectFolder: text(input.lastProjectFolder, defaults.lastProjectFolder),
            webAudio: flag(input.webAudio, defaults.webAudio),
            projectTab: text(input.projectTab, defaults.projectTab)
        };
    }
}
