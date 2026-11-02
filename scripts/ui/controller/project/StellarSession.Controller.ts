import {editorStore} from './StellarEditor.Store';
import {confirmDiscardOrSave, openProjectFile} from './StellarProject.Controller';
import {prepareAllMedia, startMediaListeners} from './StellarMedia.Controller';
import {startAutosave, stopAutosave} from '../autosave/StellarAutosave.Controller';
import {startKeybinds} from '../keybind/StellarKeybind.Controller';
import {findMissingHandlers} from '../command/StellarCommand.Controller';

// Everything the editor window needs to do once, when it opens.

let latestSession = 0; // only the newest session may stop the shared autosave (React can start two in dev mode)

/** Loads settings and hotkeys, opens the project and starts listening. Returns a function that stops it all. */
export async function startEditorSession(projectPath: string): Promise<{ ok: boolean; stop: () => void }> {
    const sessionId = ++latestSession;
    const [settings, keybinds] = await Promise.all([window.api.getSettings(), window.api.getKeybinds()]);

    editorStore.set({
        settings,
        keybinds,
        snapping: settings.snapping,
        linkedSelection: settings.linkedSelection,
        workspace: 'editing',
        layout: settings.layout
    });

    const missing = findMissingHandlers();

    if (missing.length > 0) {
        console.warn('[Command] These commands have no action yet:', missing);
    }

    startMediaListeners();

    const ok = await openProjectFile(projectPath);

    if (!ok) {
        return {ok: false, stop: () => undefined};
    }

    void prepareAllMedia();
    startAutosave();

    const stopKeybinds = startKeybinds();
    const stopCloseListener = window.api.onCloseRequested(() => {
        void confirmDiscardOrSave().then((canClose) => {
            if (canClose) {
                window.api.confirmClose();
            }
        });
    });

    return {
        ok: true,
        stop: () => {
            stopKeybinds();
            stopCloseListener();

            if (sessionId === latestSession) {
                stopAutosave();
            }
        }
    };
}
