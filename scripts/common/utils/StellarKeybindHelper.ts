// Hotkeys are written as "Mod+Shift+Z". Mod is Ctrl on Windows and Linux and Cmd on macOS.

const NAMED_KEYS: Record<string, string> = {
    Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Delete: 'Delete', Backspace: 'Delete',
    Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Escape', Tab: 'Tab', Insert: 'Insert',
    Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
    Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\'
};

interface KeyLike {
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}

function keyFromCode(code: string): string | null {
    if (/^Key[A-Z]$/.test(code)) {
        return code.slice(3);
    }

    if (/^Digit\d$/.test(code)) {
        return code.slice(5);
    }

    if (/^Numpad\d$/.test(code)) {
        return code.slice(6);
    }

    if (/^F\d{1,2}$/.test(code)) {
        return code;
    }

    return NAMED_KEYS[code] ?? null;
}

/** Turns a key press into a combo. Returns null for a lone modifier key such as Shift. */
export function eventToCombo(event: KeyLike): string | null {
    const key = keyFromCode(event.code);

    if (!key) {
        return null;
    }

    const parts: string[] = [];

    if (event.ctrlKey || event.metaKey) {
        parts.push('Mod');
    }

    if (event.altKey) {
        parts.push('Alt');
    }

    if (event.shiftKey) {
        parts.push('Shift');
    }

    parts.push(key);

    return parts.join('+');
}

/** "Mod+Shift+Z" -> "Ctrl + Shift + Z" (or "⌘ + Shift + Z" on a Mac) */
export function describeCombo(combo: string, isMac = false): string {
    if (!combo) {
        return 'Not set';
    }

    return combo
        .split(/\+(?=.)/)
        .map((part) => (part === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : part))
        .join(' + ');
}
