import {editorStore} from '../project/StellarEditor.Store';

// A workspace is a set of panel sizes. The numbers are fractions of the window (0..1).

export interface WorkspaceLayout {
    top: number;      // height of the monitors row
    left: number;     // width of the source / effect controls panel, inside the monitors row
    right: number;    // width of the effects / history panel, inside the monitors row
    project: number;  // width of the project panel, inside the bottom row
}

export const WORKSPACES: Record<string, { label: string; layout: WorkspaceLayout }> = {
    editing: {label: 'Editing', layout: {top: 0.5, left: 0.27, right: 0.21, project: 0.27}},
    assembly: {label: 'Assembly', layout: {top: 0.42, left: 0.3, right: 0.14, project: 0.42}},
    effects: {label: 'Effects', layout: {top: 0.5, left: 0.3, right: 0.3, project: 0.2}},
    color: {label: 'Color', layout: {top: 0.66, left: 0.2, right: 0.2, project: 0.18}},
    audio: {label: 'Audio', layout: {top: 0.34, left: 0.2, right: 0.16, project: 0.2}}
};

export function layoutOf(layout: Record<string, number>, workspace: string): WorkspaceLayout {
    const preset = WORKSPACES[workspace]?.layout ?? WORKSPACES['editing'].layout;

    return {
        top: layout['top'] ?? preset.top,
        left: layout['left'] ?? preset.left,
        right: layout['right'] ?? preset.right,
        project: layout['project'] ?? preset.project
    };
}

export function setWorkspace(workspace: string): void {
    if (!WORKSPACES[workspace]) {
        return;
    }

    editorStore.set({workspace, layout: {}, maximizedPanel: null});
    void window.api.updateSettings({workspace, layout: {}});
}

let saveTimer: number | undefined;

/** Called while a splitter is dragged. The new sizes are saved when the dragging stops. */
export function setLayoutValue(key: keyof WorkspaceLayout, value: number): void {
    const layout = {...editorStore.get().layout, [key]: value};

    editorStore.set({layout});
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void window.api.updateSettings({layout}), 400);
}

export function toggleMaximizedPanel(): void {
    const state = editorStore.get();

    if (state.maximizedPanel) {
        editorStore.set({maximizedPanel: null});
        return;
    }

    if (state.hoveredPanel) {
        editorStore.set({maximizedPanel: state.hoveredPanel});
    }
}
