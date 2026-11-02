import {eventToCombo} from '../../../common/utils/StellarKeybindHelper';
import {editorStore} from '../project/StellarEditor.Store';
import {runCommand} from '../command/StellarCommand.Controller';
import {closeContextMenu} from '../contextmenu/StellarContextMenu.Controller';

// Listens for key presses and runs the command that is bound to them.

let isRecording = false; // the settings dialog turns the hotkeys off while it listens for a new combo

export function setHotkeysPaused(paused: boolean): void {
    isRecording = paused;
}

function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const tag = target.tagName;

    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** The combos as a lookup: combo -> command id. */
function buildLookup(keybinds: Record<string, string>): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const [commandId, combo] of Object.entries(keybinds)) {
        if (combo) {
            lookup.set(combo, commandId);
        }
    }

    return lookup;
}

let cachedKeybinds: Record<string, string> | null = null;
let cachedLookup = new Map<string, string>();

function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        closeContextMenu();
    }

    if (isRecording || (event.repeat && event.code === 'Space')) {
        return;
    }

    const combo = eventToCombo(event);

    if (!combo) {
        return;
    }

    const keybinds = editorStore.get().keybinds;

    if (keybinds !== cachedKeybinds) {
        cachedKeybinds = keybinds;
        cachedLookup = buildLookup(keybinds);
    }

    const commandId = cachedLookup.get(combo);

    if (!commandId) {
        return;
    }

    // While typing in a text box, only combos with Ctrl/Cmd (like Save) still work.
    if (isTyping(event.target) && !combo.startsWith('Mod+')) {
        return;
    }

    if (isTyping(event.target) && (combo === 'Mod+A' || combo === 'Mod+C' || combo === 'Mod+V' || combo === 'Mod+X' || combo === 'Mod+Z')) {
        return; // let the text box do its own copy, paste, undo
    }

    event.preventDefault();
    runCommand(commandId);
}

export function startKeybinds(): () => void {
    // A new function each time, so stopping one start never removes the listener of another.
    const listener = (event: KeyboardEvent) => handleKeyDown(event);

    window.addEventListener('keydown', listener);

    return () => window.removeEventListener('keydown', listener);
}
