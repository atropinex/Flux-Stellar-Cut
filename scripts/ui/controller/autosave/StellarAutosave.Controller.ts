import {editorStore} from '../project/StellarEditor.Store';
import {documentForSaving} from '../project/StellarProject.Controller';

// Saves a copy of the project into the "Stellar Auto-Save" folder next to it.
// The copy is only made when something changed since the last copy. Your real project file is never touched.

let timer: number | null = null;
let lastAutosavedDocument: unknown = null;

let unsubscribe: (() => void) | null = null;

export function startAutosave(): void {
    stopAutosave();
    schedule();

    // Changing the interval in the settings takes effect on the next check.
    unsubscribe = editorStore.subscribe(() => {
        const settings = editorStore.get().settings;

        if (timer === null && settings.autosaveEnabled) {
            schedule();
        }
    });
}

export function stopAutosave(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
    }
}

function schedule(): void {
    const settings = editorStore.get().settings;

    if (!settings.autosaveEnabled) {
        timer = null;
        return;
    }

    const minutes = Math.max(1, settings.autosaveIntervalMinutes);

    timer = window.setTimeout(async () => {
        timer = null;
        await autosaveNow();
        schedule();
    }, minutes * 60 * 1000);
}

export async function autosaveNow(): Promise<void> {
    const state = editorStore.get();

    if (!state.document || !state.projectPath || !state.dirty) {
        return;
    }

    if (lastAutosavedDocument === state.document) {
        return;
    }

    try {
        await window.api.autosaveProject(state.projectPath, documentForSaving(state.document));
        lastAutosavedDocument = state.document;
        editorStore.set({autosavedAt: Date.now()});
    } catch (error) {
        console.warn('[Autosave] Could not save a copy.', error);
    }
}
