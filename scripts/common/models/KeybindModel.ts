import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {parse, stringify} from 'yaml';
import {COMMANDS, defaultKeybinds, type KeybindMap} from '../stellar/StellarCommands';

const HEADER = `# Flux-Stellar-Cut hotkeys. One line per command: "command.id: Combo".
# Mod = Ctrl (Windows, Linux) or Cmd (macOS). Leave the value empty to remove a hotkey.
# Example combos: Space, Mod+Shift+Z, Alt+Left, Delete, F11
`;

/** The hotkeys, saved as keybinds.yaml. */
export class KeybindModel {
    private file: string;
    private keybinds: KeybindMap;

    constructor(folder: string) {
        mkdirSync(folder, {recursive: true});
        this.file = join(folder, 'keybinds.yaml');
        this.keybinds = this.load();

        if (!existsSync(this.file)) {
            this.save();
        }
    }

    get filePath(): string {
        return this.file;
    }

    get(): KeybindMap {
        return {...this.keybinds};
    }

    /** Sets or removes (null) a hotkey. If another command already uses the combo, it loses it. */
    set(commandId: string, combo: string | null): KeybindMap {
        const known = COMMANDS.some((command) => command.id === commandId);

        if (!known) {
            return this.get();
        }

        if (combo) {
            for (const [otherId, otherCombo] of Object.entries(this.keybinds)) {
                if (otherId !== commandId && otherCombo === combo) {
                    this.keybinds[otherId] = '';
                }
            }
        }

        this.keybinds[commandId] = combo ?? '';
        this.save();

        return this.get();
    }

    reset(): KeybindMap {
        this.keybinds = defaultKeybinds();
        this.save();

        return this.get();
    }

    private load(): KeybindMap {
        const merged = defaultKeybinds();

        if (!existsSync(this.file)) {
            return merged;
        }

        try {
            const raw = parse(readFileSync(this.file, 'utf8'));

            if (raw && typeof raw === 'object') {
                for (const [commandId, combo] of Object.entries(raw)) {
                    if (commandId in merged && (typeof combo === 'string' || combo === null)) {
                        merged[commandId] = combo ?? '';
                    }
                }
            }
        } catch {
            // A broken file falls back to the defaults.
        }

        return merged;
    }

    private save(): void {
        writeFileSync(this.file, HEADER + stringify(this.keybinds), 'utf8');
    }
}
