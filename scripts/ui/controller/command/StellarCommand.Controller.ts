import {COMMANDS, findCommand} from '../../../common/stellar/StellarCommands';
import {editorStore, getActiveSequence} from '../project/StellarEditor.Store';
import {
    closeProject, confirmDiscardOrSave, deleteMedia, redo, saveProject, saveProjectAs, showToast, undo
} from '../project/StellarProject.Controller';
import {importWithDialog} from '../project/StellarMedia.Controller';
import {
    goToPreviousEdit, goToNextEdit, goToSequenceEnd, goToIn, goToOut, markIn, markOut, clearInOut, markClip, addMarker,
    addEditAtPlayhead, placeSourceOnTimeline, removeInOutRange, rippleTrimAtPlayhead, nudgeSelection, toggleClipsEnabled,
    linkSelection, unlinkSelection, toggleSnapping, zoomIn, zoomOut, zoomToFit, addTrackOfType, copySelection, cutSelection,
    pasteAtPlayhead, deleteSelection, selectAllClips, deselectAll, setTool, setClipSpeed
} from '../timeline/StellarTimelineActions.Controller';
import {seekTo, shuttle, stepFrames, toggleLoop, togglePlay} from '../playback/StellarPlayback.Controller';
import {toggleMaximizedPanel} from './StellarWorkspace.Controller';
import {addTextClip, applySpeed, openSpeedDialog} from '../timeline/StellarClipEdit.Controller';
import {nestSelection, openNestedSequence} from '../timeline/StellarNest.Controller';

/** Asks the editor window to bring a panel to the front. */
function showPanel(id: string): void {
    window.dispatchEvent(new CustomEvent('stellar:show-panel', {detail: id}));
}

// One place that knows what every command does. Hotkeys, menus and right-click menus all call runCommand().

type Handler = () => unknown;

async function openAnotherProject(): Promise<void> {
    const path = await window.api.browseProject();

    if (path && (await confirmDiscardOrSave())) {
        await window.api.openProjectInEditor(path);
    }
}

function isProjectPanelActive(): boolean {
    return editorStore.get().hoveredPanel === 'project';
}

function renameInProjectPanel(): void {
    window.dispatchEvent(new CustomEvent('stellar:rename-selected-media'));
}

const HANDLERS: Record<string, Handler> = {
    // File
    'file.newProject': closeProject,
    'file.openProject': openAnotherProject,
    'file.save': saveProject,
    'file.saveAs': saveProjectAs,
    'file.newSequence': () => editorStore.set({dialog: 'newSequence'}),
    'file.newBin': () => window.dispatchEvent(new CustomEvent('stellar:new-bin')),
    'file.import': () => importWithDialog(editorStore.get().selectedBinId),
    'file.export': () => editorStore.set({dialog: 'export'}),
    'file.closeProject': closeProject,
    'file.settings': () => editorStore.set({dialog: 'settings'}),

    // Edit
    'edit.undo': undo,
    'edit.redo': redo,
    'edit.cut': cutSelection,
    'edit.copy': copySelection,
    'edit.paste': () => pasteAtPlayhead('overwrite'),
    'edit.pasteInsert': () => pasteAtPlayhead('insert'),
    'edit.delete': () => {
        if (isProjectPanelActive()) {
            deleteMedia(editorStore.get().selectedMediaIds);
        } else {
            deleteSelection(false);
        }
    },
    'edit.rippleDelete': () => deleteSelection(true),
    'edit.selectAll': () => {
        if (isProjectPanelActive()) {
            const media = editorStore.get().document?.media ?? [];

            editorStore.set({selectedMediaIds: media.map((item) => item.id)});
        } else {
            selectAllClips();
        }
    },
    'edit.deselectAll': () => {
        deselectAll();
        editorStore.set({selectedMediaIds: []});
    },
    'edit.rename': renameInProjectPanel,

    // Playback
    'playback.togglePlay': togglePlay,
    'playback.reverse': () => shuttle('reverse'),
    'playback.stop': () => shuttle('stop'),
    'playback.forward': () => shuttle('forward'),
    'playback.stepBack': () => stepFrames(-1),
    'playback.stepForward': () => stepFrames(1),
    'playback.stepBackMany': () => stepFrames(-5),
    'playback.stepForwardMany': () => stepFrames(5),
    'playback.prevEdit': goToPreviousEdit,
    'playback.nextEdit': goToNextEdit,
    'playback.goStart': () => seekTo(0),
    'playback.goEnd': goToSequenceEnd,
    'playback.loop': toggleLoop,

    // Marking
    'mark.in': markIn,
    'mark.out': markOut,
    'mark.goIn': goToIn,
    'mark.goOut': goToOut,
    'mark.clear': clearInOut,
    'mark.clip': markClip,
    'mark.marker': () => {
        addMarker();
    },

    // Timeline
    'timeline.addEdit': () => addEditAtPlayhead(false),
    'timeline.addEditAll': () => addEditAtPlayhead(true),
    'timeline.insert': () => placeSourceOnTimeline(editorStore.get().sourceMediaId ?? '', 'insert'),
    'timeline.overwrite': () => placeSourceOnTimeline(editorStore.get().sourceMediaId ?? '', 'overwrite'),
    'timeline.speed': openSpeedDialog,
    'timeline.reverse': () => {
        const sequence = getActiveSequence();
        const first = sequence?.clips.find((clip) => clip.id === editorStore.get().selection[0]);

        if (first) {
            applySpeed(editorStore.get().selection, {reverse: !first.reverse}, 'Reverse speed');
        }
    },
    'timeline.addText': () => {
        addTextClip();
    },
    'timeline.nest': nestSelection,
    'timeline.openNest': () => {
        const clipId = editorStore.get().selection[0];

        if (clipId) {
            openNestedSequence(clipId);
        }
    },
    'timeline.lift': () => removeInOutRange(false),
    'timeline.extract': () => removeInOutRange(true),
    'timeline.rippleTrimPrevious': () => rippleTrimAtPlayhead('previous'),
    'timeline.rippleTrimNext': () => rippleTrimAtPlayhead('next'),
    'timeline.nudgeLeft': () => nudgeSelection(-1),
    'timeline.nudgeRight': () => nudgeSelection(1),
    'timeline.toggleEnabled': toggleClipsEnabled,
    'timeline.link': linkSelection,
    'timeline.unlink': unlinkSelection,
    'timeline.snap': toggleSnapping,
    'timeline.zoomIn': zoomIn,
    'timeline.zoomOut': zoomOut,
    'timeline.zoomFit': () => zoomToFit(),
    'timeline.addVideoTrack': () => addTrackOfType('video'),
    'timeline.addAudioTrack': () => addTrackOfType('audio'),

    // Tools
    'tool.selection': () => setTool('selection'),
    'tool.trackSelect': () => setTool('trackSelect'),
    'tool.ripple': () => setTool('ripple'),
    'tool.razor': () => setTool('razor'),
    'tool.hand': () => setTool('hand'),
    'tool.zoom': () => setTool('zoom'),
    'tool.pen': () => setTool('pen'),

    // Window
    'window.panelEffectControls': () => showPanel('effectControls'),
    'window.panelLumetri': () => showPanel('lumetri'),
    'window.panelText': () => showPanel('text'),
    'window.panelMixer': () => showPanel('mixer'),
    'window.panelSource': () => showPanel('source'),
    'window.panelProject': () => showPanel('project'),
    'window.panelBrowser': () => showPanel('browser'),
    'window.panelInfo': () => showPanel('info'),
    'window.panelMarkers': () => showPanel('markers'),
    'window.maximizePanel': toggleMaximizedPanel,
    'window.fullscreen': () => window.api.toggleFullscreen(),
};

export function runCommand(id: string): void {
    const handler = HANDLERS[id];

    if (!handler) {
        console.warn(`[Command] "${id}" does nothing yet.`);
        return;
    }

    if (!getActiveSequence() && id.startsWith('timeline.') && id !== 'timeline.zoomFit') {
        showToast('Create or open a sequence first.');
        return;
    }

    void Promise.resolve(handler()).catch((error) => console.error(`[Command] "${id}" failed.`, error));
}

/** Commands that exist in the list but have no handler (a mistake while adding a command). */
export function findMissingHandlers(): string[] {
    return COMMANDS.filter((command) => !HANDLERS[command.id]).map((command) => command.id);
}

/** The hotkey of a command as set right now, for menus. */
export function hotkeyOf(id: string): string {
    return editorStore.get().keybinds[id] ?? findCommand(id)?.defaultKey ?? '';
}
