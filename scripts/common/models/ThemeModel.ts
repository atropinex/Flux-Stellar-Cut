import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'fs';
import {homedir} from 'os';
import {extname, join} from 'path';
import {parse} from 'yaml';
import type {Theme, ThemeGlass, ThemeLayer, ThemeList} from '../CommonInteface';
import {THEME_COLORS, type WindowMaterial} from '../stellar/StellarContract';
import {clamp} from '../utils/StellarTimeHelper';
import {DEFAULT_THEMES} from './DefaultThemeModel';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
};
const MATERIALS: WindowMaterial[] = ['none', 'mica', 'acrylic', 'tabbed'];

const DEFAULT_GLASS: ThemeGlass = {
    island: 'rgba(24, 27, 40, 0.58)',
    header: 'rgba(255, 255, 255, 0.04)',
    blur: 28,
    saturate: 160,
    border: 'rgba(255, 255, 255, 0.10)',
    highlight: 'rgba(255, 255, 255, 0.10)',
    shadow: '0 10px 36px rgba(0, 0, 0, 0.35)'
};

type Raw = Record<string, any>;

function asText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isMapping(value: unknown): value is Raw {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Themes are YAML files in a folder. This writes the default ones, then reads and checks them. */
export class ThemeModel {
    constructor(readonly folder: string) {
        mkdirSync(folder, {recursive: true});
        this.writeMissingDefaults();
    }

    /** Reads every theme file. A broken file is reported without stopping the others. */
    load(): ThemeList {
        const themes: Theme[] = [];
        const errors: string[] = [];

        const files = readdirSync(this.folder)
            .filter((file) => /\.ya?ml$/i.test(file))
            .sort();

        for (const file of files) {
            try {
                const content = readFileSync(join(this.folder, file), 'utf8');

                themes.push(this.toTheme(file.replace(/\.ya?ml$/i, ''), parse(content)));
            } catch (error) {
                errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return {themes, errors};
    }

    /** Finds one theme by id. Falls back to "aurora", then to the first one. */
    find(id: string): Theme | null {
        const {themes} = this.load();

        return themes.find((theme) => theme.id === id)
            ?? themes.find((theme) => theme.id === 'aurora')
            ?? themes[0]
            ?? null;
    }

    private writeMissingDefaults(): void {
        for (const [file, content] of Object.entries(DEFAULT_THEMES)) {
            const target = join(this.folder, file);

            if (!existsSync(target)) {
                writeFileSync(target, content, 'utf8');
            }
        }
    }

    private toTheme(id: string, raw: unknown): Theme {
        if (!isMapping(raw)) {
            throw new Error('the file is empty or is not a YAML mapping');
        }

        const colors: Theme['colors'] = {};

        if (raw.colors !== undefined && !isMapping(raw.colors)) {
            throw new Error('"colors" must be a mapping');
        }

        for (const key of THEME_COLORS) {
            const value = asText(raw.colors?.[key]);

            if (value) {
                colors[key] = value;
            }
        }

        const background: Raw = isMapping(raw.background) ? raw.background : {};
        const layers = Array.isArray(background.layers)
            ? background.layers.map((layer: Raw, index: number) => this.toLayer(layer, index))
            : [];
        const material = asText(raw.window?.material) as WindowMaterial | null;

        return {
            id,
            name: asText(raw.name) ?? id,
            colors,
            glass: this.toGlass(raw.glass),
            radius: clamp(asNumber(raw.layout?.radius, 14), 0, 40),
            gap: clamp(asNumber(raw.layout?.gap, 8), 0, 24),
            material: material && MATERIALS.includes(material) ? material : 'none',
            base: asText(background.base) ?? '#0a0c14',
            layers,
            overrides: this.toOverrides(raw.overrides)
        };
    }

    private toGlass(raw: unknown): ThemeGlass {
        if (raw !== undefined && !isMapping(raw)) {
            throw new Error('"glass" must be a mapping');
        }

        const glass: Raw = raw ?? {};

        return {
            island: asText(glass.island) ?? DEFAULT_GLASS.island,
            header: asText(glass.header) ?? DEFAULT_GLASS.header,
            blur: clamp(asNumber(glass.blur, DEFAULT_GLASS.blur), 0, 100),
            saturate: clamp(asNumber(glass.saturate, DEFAULT_GLASS.saturate), 0, 300),
            border: asText(glass.border) ?? DEFAULT_GLASS.border,
            highlight: asText(glass.highlight) ?? DEFAULT_GLASS.highlight,
            shadow: asText(glass.shadow) ?? DEFAULT_GLASS.shadow
        };
    }

    private toLayer(raw: Raw, index: number): ThemeLayer {
        if (!isMapping(raw)) {
            throw new Error(`layer ${index + 1} must be a mapping`);
        }

        const type = raw.type === 'image' ? 'image' : 'gradient';
        const value = asText(raw.value);

        if (!value) {
            throw new Error(`layer ${index + 1} needs a "value"`);
        }

        return {
            type,
            value: type === 'image' ? this.imageSource(value) : value,
            opacity: clamp(asNumber(raw.opacity, 1), 0, 1),
            blur: Math.max(0, asNumber(raw.blur, 0)),
            size: asText(raw.size) ?? 'cover'
        };
    }

    private imageSource(value: string): string {
        if (/^(https?:|data:)/i.test(value)) {
            return value;
        }

        const path = value.startsWith('~') ? join(homedir(), value.slice(1)) : value;
        const mime = IMAGE_TYPES[extname(path).toLowerCase()];

        if (!mime) {
            throw new Error(`"${value}" must be a png, jpg, webp or gif`);
        }

        if (!existsSync(path)) {
            throw new Error(`image not found: ${value}`);
        }

        if (statSync(path).size > MAX_IMAGE_BYTES) {
            throw new Error(`image is bigger than 20 MB: ${value}`);
        }

        return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
    }

    private toOverrides(raw: unknown): Theme['overrides'] {
        if (raw === undefined || raw === null) {
            return {};
        }

        if (!isMapping(raw)) {
            throw new Error('"overrides" must be a mapping');
        }

        const overrides: Theme['overrides'] = {};

        for (const [target, styles] of Object.entries(raw)) {
            if (!isMapping(styles)) {
                throw new Error(`overrides.${target} must be a mapping`);
            }

            const properties: Record<string, string> = {};

            for (const [property, value] of Object.entries(styles)) {
                if (typeof value !== 'string' && typeof value !== 'number') {
                    throw new Error(`overrides.${target}.${property} must be a string or number`);
                }

                properties[property] = String(value);
            }

            overrides[target] = properties;
        }

        return overrides;
    }
}
