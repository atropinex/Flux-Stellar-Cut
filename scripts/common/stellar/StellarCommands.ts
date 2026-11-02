// Every action that has a hotkey, a menu item or a right-click entry has an id in this list.
// "Mod" means Ctrl on Windows and Linux, and Cmd on macOS.

export type CommandCategory = 'File' | 'Edit' | 'Playback' | 'Marking' | 'Timeline' | 'Tools' | 'Window';

export interface CommandDefinition {
    id: string;
    label: string;
    category: CommandCategory;
    defaultKey: string; // '' = no hotkey
}

export const COMMANDS: CommandDefinition[] = [
    // File
    {id: 'file.newProject', label: 'New Project...', category: 'File', defaultKey: 'Mod+Alt+N'},
    {id: 'file.openProject', label: 'Open Project...', category: 'File', defaultKey: 'Mod+O'},
    {id: 'file.save', label: 'Save', category: 'File', defaultKey: 'Mod+S'},
    {id: 'file.saveAs', label: 'Save As...', category: 'File', defaultKey: 'Mod+Shift+S'},
    {id: 'file.newSequence', label: 'New Sequence...', category: 'File', defaultKey: 'Mod+N'},
    {id: 'file.newBin', label: 'New Bin', category: 'File', defaultKey: 'Mod+B'},
    {id: 'file.import', label: 'Import...', category: 'File', defaultKey: 'Mod+I'},
    {id: 'file.export', label: 'Export Media...', category: 'File', defaultKey: 'Mod+M'},
    {id: 'file.closeProject', label: 'Close Project', category: 'File', defaultKey: 'Mod+Shift+W'},
    {id: 'file.settings', label: 'Settings...', category: 'File', defaultKey: 'Mod+,'},

    // Edit
    {id: 'edit.undo', label: 'Undo', category: 'Edit', defaultKey: 'Mod+Z'},
    {id: 'edit.redo', label: 'Redo', category: 'Edit', defaultKey: 'Mod+Shift+Z'},
    {id: 'edit.cut', label: 'Cut', category: 'Edit', defaultKey: 'Mod+X'},
    {id: 'edit.copy', label: 'Copy', category: 'Edit', defaultKey: 'Mod+C'},
    {id: 'edit.paste', label: 'Paste', category: 'Edit', defaultKey: 'Mod+V'},
    {id: 'edit.pasteInsert', label: 'Paste Insert', category: 'Edit', defaultKey: 'Mod+Shift+V'},
    {id: 'edit.delete', label: 'Delete', category: 'Edit', defaultKey: 'Delete'},
    {id: 'edit.rippleDelete', label: 'Ripple Delete', category: 'Edit', defaultKey: 'Shift+Delete'},
    {id: 'edit.selectAll', label: 'Select All', category: 'Edit', defaultKey: 'Mod+A'},
    {id: 'edit.deselectAll', label: 'Deselect All', category: 'Edit', defaultKey: 'Mod+Shift+A'},
    {id: 'edit.rename', label: 'Rename', category: 'Edit', defaultKey: 'F2'},

    // Playback
    {id: 'playback.togglePlay', label: 'Play / Pause', category: 'Playback', defaultKey: 'Space'},
    {id: 'playback.reverse', label: 'Shuttle Left', category: 'Playback', defaultKey: 'J'},
    {id: 'playback.stop', label: 'Shuttle Stop', category: 'Playback', defaultKey: 'K'},
    {id: 'playback.forward', label: 'Shuttle Right', category: 'Playback', defaultKey: 'L'},
    {id: 'playback.stepBack', label: 'Step Back 1 Frame', category: 'Playback', defaultKey: 'Left'},
    {id: 'playback.stepForward', label: 'Step Forward 1 Frame', category: 'Playback', defaultKey: 'Right'},
    {id: 'playback.stepBackMany', label: 'Step Back 5 Frames', category: 'Playback', defaultKey: 'Shift+Left'},
    {id: 'playback.stepForwardMany', label: 'Step Forward 5 Frames', category: 'Playback', defaultKey: 'Shift+Right'},
    {id: 'playback.prevEdit', label: 'Go to Previous Edit Point', category: 'Playback', defaultKey: 'Up'},
    {id: 'playback.nextEdit', label: 'Go to Next Edit Point', category: 'Playback', defaultKey: 'Down'},
    {id: 'playback.goStart', label: 'Go to Sequence Start', category: 'Playback', defaultKey: 'Home'},
    {id: 'playback.goEnd', label: 'Go to Sequence End', category: 'Playback', defaultKey: 'End'},
    {id: 'playback.loop', label: 'Toggle Loop', category: 'Playback', defaultKey: 'Mod+Shift+L'},

    // Marking
    {id: 'mark.in', label: 'Mark In', category: 'Marking', defaultKey: 'I'},
    {id: 'mark.out', label: 'Mark Out', category: 'Marking', defaultKey: 'O'},
    {id: 'mark.goIn', label: 'Go to In', category: 'Marking', defaultKey: 'Shift+I'},
    {id: 'mark.goOut', label: 'Go to Out', category: 'Marking', defaultKey: 'Shift+O'},
    {id: 'mark.clear', label: 'Clear In and Out', category: 'Marking', defaultKey: 'Mod+Shift+X'},
    {id: 'mark.clip', label: 'Mark Clip', category: 'Marking', defaultKey: 'X'},
    {id: 'mark.marker', label: 'Add Marker', category: 'Marking', defaultKey: 'M'},

    // Timeline
    {id: 'timeline.addEdit', label: 'Add Edit', category: 'Timeline', defaultKey: 'Mod+K'},
    {id: 'timeline.addEditAll', label: 'Add Edit to All Tracks', category: 'Timeline', defaultKey: 'Mod+Shift+K'},
    {id: 'timeline.insert', label: 'Insert', category: 'Timeline', defaultKey: ','},
    {id: 'timeline.overwrite', label: 'Overwrite', category: 'Timeline', defaultKey: '.'},
    {id: 'timeline.lift', label: 'Lift', category: 'Timeline', defaultKey: ';'},
    {id: 'timeline.extract', label: 'Extract', category: 'Timeline', defaultKey: "'"},
    {
        id: 'timeline.rippleTrimPrevious',
        label: 'Ripple Trim Previous Edit to Playhead',
        category: 'Timeline',
        defaultKey: 'Q'
    },
    {id: 'timeline.rippleTrimNext', label: 'Ripple Trim Next Edit to Playhead', category: 'Timeline', defaultKey: 'W'},
    {id: 'timeline.nudgeLeft', label: 'Nudge Clip Left', category: 'Timeline', defaultKey: 'Alt+Left'},
    {id: 'timeline.nudgeRight', label: 'Nudge Clip Right', category: 'Timeline', defaultKey: 'Alt+Right'},
    {id: 'timeline.toggleEnabled', label: 'Enable / Disable Clip', category: 'Timeline', defaultKey: 'Shift+E'},
    {id: 'timeline.link', label: 'Link', category: 'Timeline', defaultKey: 'Mod+L'},
    {id: 'timeline.unlink', label: 'Unlink', category: 'Timeline', defaultKey: 'Mod+Alt+L'},
    {id: 'timeline.snap', label: 'Toggle Snapping', category: 'Timeline', defaultKey: 'S'},
    {id: 'timeline.zoomIn', label: 'Zoom In', category: 'Timeline', defaultKey: '='},
    {id: 'timeline.zoomOut', label: 'Zoom Out', category: 'Timeline', defaultKey: '-'},
    {id: 'timeline.zoomFit', label: 'Zoom to Sequence', category: 'Timeline', defaultKey: '\\'},
    {id: 'timeline.addVideoTrack', label: 'Add Video Track', category: 'Timeline', defaultKey: ''},
    {id: 'timeline.addAudioTrack', label: 'Add Audio Track', category: 'Timeline', defaultKey: ''},
    {id: 'timeline.speed', label: 'Reset Speed', category: 'Timeline', defaultKey: ''},
    {id: 'timeline.reverse', label: 'Reverse Speed', category: 'Timeline', defaultKey: ''},
    {id: 'timeline.addText', label: 'Add Text', category: 'Timeline', defaultKey: 'Mod+T'},
    {id: 'timeline.nest', label: 'Nest...', category: 'Timeline', defaultKey: ''},
    {id: 'timeline.openNest', label: 'Open Nested Sequence', category: 'Timeline', defaultKey: ''},

    // Tools
    {id: 'tool.selection', label: 'Selection Tool', category: 'Tools', defaultKey: 'V'},
    {id: 'tool.trackSelect', label: 'Track Select Forward Tool', category: 'Tools', defaultKey: 'A'},
    {id: 'tool.ripple', label: 'Ripple Edit Tool', category: 'Tools', defaultKey: 'B'},
    {id: 'tool.razor', label: 'Razor Tool', category: 'Tools', defaultKey: 'C'},
    {id: 'tool.hand', label: 'Hand Tool', category: 'Tools', defaultKey: 'H'},
    {id: 'tool.zoom', label: 'Zoom Tool', category: 'Tools', defaultKey: 'Z'},
    {id: 'tool.pen', label: 'Pen Tool', category: 'Tools', defaultKey: 'P'},

    // Window
    {id: 'window.maximizePanel', label: 'Maximize Panel Under Cursor', category: 'Window', defaultKey: '`'},
    {id: 'window.panelEffectControls', label: 'Show Effect Controls', category: 'Window', defaultKey: ''},
    {id: 'window.panelLumetri', label: 'Show Lumetri Color', category: 'Window', defaultKey: ''},
    {id: 'window.panelText', label: 'Show Text', category: 'Window', defaultKey: ''},
    {id: 'window.panelMixer', label: 'Show Audio Clip Mixer', category: 'Window', defaultKey: ''},
    {id: 'window.panelSource', label: 'Show Source Monitor', category: 'Window', defaultKey: ''},
    {id: 'window.panelProject', label: 'Show Project', category: 'Window', defaultKey: ''},
    {id: 'window.panelBrowser', label: 'Show Media Browser', category: 'Window', defaultKey: ''},
    {id: 'window.panelInfo', label: 'Show Info and Metadata', category: 'Window', defaultKey: ''},
    {id: 'window.panelMarkers', label: 'Show Markers', category: 'Window', defaultKey: ''},
    {id: 'window.fullscreen', label: 'Toggle Full Screen', category: 'Window', defaultKey: 'F11'},
];

export function findCommand(id: string): CommandDefinition | undefined {
    return COMMANDS.find((command) => command.id === id);
}

export type KeybindMap = Record<string, string>; // command id -> combo, e.g. "Mod+Shift+Z"

export function defaultKeybinds(): KeybindMap {
    const keybinds: KeybindMap = {};

    for (const command of COMMANDS) {
        keybinds[command.id] = command.defaultKey;
    }

    return keybinds;
}
