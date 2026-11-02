import type {Theme} from '../../../common/CommonInteface';
import {editorStore} from '../project/StellarEditor.Store';

// Applies a YAML theme: colors and glass settings become CSS variables on the page,
// and the "overrides" section becomes a style sheet that targets elements by their data-theme name.

let initialized = false;
let unsubscribeTheme: (() => void) | null = null;

// Variables set by the previous theme. They are removed first, so a theme that leaves a color out gets the
// built-in value and not the leftover of the theme before it (that left dark text on a dark glass).
let appliedNames: string[] = [];

function applyVariables(theme: Theme): void {
    const root = document.documentElement;

    for (const name of appliedNames) {
        root.style.removeProperty(name);
    }

    const variables: Record<string, string> = {
        '--sc-glass-island': theme.glass.island,
        '--sc-glass-header': theme.glass.header,
        '--sc-glass-blur': `${theme.glass.blur}px`,
        '--sc-glass-saturate': `${theme.glass.saturate}%`,
        '--sc-glass-border': theme.glass.border,
        '--sc-glass-highlight': theme.glass.highlight,
        '--sc-glass-shadow': theme.glass.shadow,
        '--sc-radius': `${theme.radius}px`,
        '--sc-gap': `${theme.gap}px`,
        '--sc-base': theme.base
    };

    for (const [name, value] of Object.entries(theme.colors)) {
        variables[`--sc-${name}`] = value;
    }

    appliedNames = Object.keys(variables);

    for (const [name, value] of Object.entries(variables)) {
        root.style.setProperty(name, value);
    }

    root.style.colorScheme = isLight(theme) ? 'light' : 'dark';
}

/** A theme is light when its text color is dark. */
function isLight(theme: Theme): boolean {
    const ink = theme.colors.ink ?? '#ffffff';
    const match = /^#([0-9a-f]{6})$/i.exec(ink.trim());

    if (!match) {
        return false;
    }

    const value = parseInt(match[1], 16);
    const brightness = (((value >> 16) & 255) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;

    return brightness < 110;
}

function applyOverrides(theme: Theme): void {
    let style = document.querySelector<HTMLStyleElement>('style[data-stellar-theme]');

    if (!style) {
        style = document.createElement('style');
        style.dataset.stellarTheme = '';
        document.head.appendChild(style);
    }

    style.textContent = Object.entries(theme.overrides)
        .map(([target, properties]) => {
            const declarations = Object.entries(properties)
                .filter(([property]) => /^-?[a-z][a-z0-9-]*$/i.test(property))
                .map(([property, value]) => `${property}: ${value};`)
                .join('\n');

            if (!declarations) {
                return '';
            }

            // "StellarTimeline.panel::placeholder" keeps its pseudo part outside the attribute selector.
            const pseudo = /(::[\w-]+|:focus-within|:hover)$/.exec(target);
            const name = pseudo ? target.slice(0, -pseudo[0].length) : target;

            return `[data-theme=${JSON.stringify(name)}]${pseudo ? pseudo[0] : ''} {\n${declarations}\n}`;
        })
        .filter(Boolean)
        .join('\n');
}

export function applyTheme(theme: Theme): void {
    editorStore.set({theme});
    applyVariables(theme);
    applyOverrides(theme);
}

export async function initializeTheme(): Promise<void> {
    if (initialized) {
        return;
    }

    initialized = true;

    if (!window.api) {
        initialized = false;
        console.error('[Theme] The Electron API is missing. Check the preload script.');
        return;
    }

    unsubscribeTheme = window.api.onThemeChanged(applyTheme);

    try {
        const [result, settings] = await Promise.all([window.api.listThemes(), window.api.getSettings()]);
        const theme = result.themes.find((item) => item.id === settings.theme) ?? result.themes[0];

        if (theme) {
            applyTheme(theme);
        }

        if (result.errors.length > 0) {
            console.warn('[Theme] Some theme files have problems:', result.errors);
        }
    } catch (error) {
        initialized = false;
        console.error('[Theme] Could not load the theme.', error);
    }
}

export function disposeTheme(): void {
    unsubscribeTheme?.();
    unsubscribeTheme = null;
    initialized = false;
}
