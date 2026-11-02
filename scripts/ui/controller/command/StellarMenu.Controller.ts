import {findCommand} from '../../../common/stellar/StellarCommands';
import {editorStore} from '../project/StellarEditor.Store';
import type {ContextMenuItem} from '../contextmenu/StellarContextMenu.Controller';
import {separator} from '../contextmenu/StellarContextMenu.Controller';
import {hotkeyOf, runCommand} from './StellarCommand.Controller';

// The menus of the menu bar. Each item runs a command, so it always matches the hotkey list.

export function commandItem(commandId: string, options: Partial<ContextMenuItem> = {}): ContextMenuItem {
    const command = findCommand(commandId);

    return {
        id: commandId,
        label: command?.label ?? commandId,
        hotkey: hotkeyOf(commandId),
        action: () => runCommand(commandId),
        ...options
    };
}

export interface MenuDefinition {
    id: string;
    label: string;
    build: () => ContextMenuItem[];
}

export const MENUS: MenuDefinition[] = [
    {
        id: 'file', label: 'File',
        build: () => [
            commandItem('file.newProject'), commandItem('file.openProject'), separator('a'),
            commandItem('file.newSequence'), commandItem('file.newBin'), commandItem('file.import'), separator('b'),
            commandItem('file.save'), commandItem('file.saveAs'), separator('c'),
            commandItem('file.export'), separator('d'),
            commandItem('file.closeProject'), commandItem('file.settings')
        ]
    },
    {
        id: 'edit', label: 'Edit',
        build: () => [
            commandItem('edit.undo'), commandItem('edit.redo'), separator('a'),
            commandItem('edit.cut'), commandItem('edit.copy'), commandItem('edit.paste'), commandItem('edit.pasteInsert'), separator('b'),
            commandItem('edit.delete', {label: 'Clear'}), commandItem('edit.rippleDelete'), separator('c'),
            commandItem('edit.selectAll'), commandItem('edit.deselectAll')
        ]
    },
    {
        id: 'clip', label: 'Clip',
        build: () => [
            commandItem('timeline.insert'), commandItem('timeline.overwrite'), separator('a'),
            commandItem('timeline.link'), commandItem('timeline.unlink'), commandItem('timeline.toggleEnabled'), separator('b0'),
            commandItem('timeline.addText'), commandItem('timeline.nest'), commandItem('timeline.openNest'), commandItem('timeline.reverse'), separator('b'),
            commandItem('timeline.addEdit'), commandItem('timeline.addEditAll'),
            commandItem('timeline.rippleTrimPrevious'), commandItem('timeline.rippleTrimNext'), separator('c'),
            commandItem('timeline.nudgeLeft'), commandItem('timeline.nudgeRight')
        ]
    },
    {
        id: 'sequence', label: 'Sequence',
        build: () => {
            const state = editorStore.get();

            return [
                commandItem('mark.in'), commandItem('mark.out'), commandItem('mark.clip'), commandItem('mark.clear'),
                commandItem('mark.goIn'), commandItem('mark.goOut'), commandItem('mark.marker'), separator('a'),
                commandItem('timeline.lift'), commandItem('timeline.extract'), separator('b'),
                commandItem('timeline.addVideoTrack'), commandItem('timeline.addAudioTrack'), separator('c'),
                commandItem('timeline.snap', {checked: state.snapping}), commandItem('playback.loop', {checked: state.loop}), separator('d'),
                commandItem('timeline.zoomIn'), commandItem('timeline.zoomOut'), commandItem('timeline.zoomFit')
            ];
        }
    },
    {
        id: 'window', label: 'Window',
        build: () => [
            commandItem('window.panelProject'), commandItem('window.panelBrowser'), commandItem('window.panelInfo'), commandItem('window.panelMarkers'), separator('p1'),
            commandItem('window.panelSource'), commandItem('window.panelEffectControls'), commandItem('window.panelLumetri'),
            commandItem('window.panelText'), commandItem('window.panelMixer'), separator('p2'),
            commandItem('window.maximizePanel'), commandItem('window.fullscreen')
        ]
    },
    {
        id: 'help', label: 'Help',
        build: () => [
            {id: 'shortcuts', label: 'Keyboard Shortcuts...', action: () => editorStore.set({dialog: 'settings'})},
            {id: 'themes', label: 'Open Themes Folder', action: () => window.api.openThemesFolder()},
            {id: 'keybinds', label: 'Open Hotkeys File (YAML)', action: () => window.api.openKeybindsFile()}
        ]
    }
];
