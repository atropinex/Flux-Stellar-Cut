import {CLIP_LABELS, MARKER_COLORS} from '../../../common/stellar/StellarConfig';
import {editorStore, getActiveSequence, getMedia} from '../../controller/project/StellarEditor.Store';
import {findClip, findTrack} from '../../controller/timeline/StellarTimeline.Controller';
import {
    addEditAtPlayhead, addTrackOfType, copySelection, cutSelection, deleteMarker, deleteSelection, pasteAtPlayhead, razorAt,
    selectClips, setClipLabel, toggleClipsEnabled, linkSelection, unlinkSelection, zoomToFit, selectedClipIds,
    clearInOut, addMarker, deleteTrack, updateMarker
} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openSpeedDialog} from '../../controller/timeline/StellarClipEdit.Controller';
import {openInSource} from '../../controller/project/StellarMedia.Controller';
import {seekTo} from '../../controller/playback/StellarPlayback.Controller';
import {separator, type ContextMenuItem} from '../../controller/contextmenu/StellarContextMenu.Controller';
import {hotkeyOf} from '../../controller/command/StellarCommand.Controller';

// The right-click menus of the timeline.

export function clipMenu(clipId: string, time: number): ContextMenuItem[] {
    const sequence = getActiveSequence();
    const clip = sequence ? findClip(sequence, clipId) : undefined;
    const media = clip ? getMedia(editorStore.get(), clip.mediaId) : undefined;

    if (!editorStore.get().selection.includes(clipId)) {
        selectClips([clipId]);
    }

    return [
        {id: 'cut', label: 'Cut', hotkey: hotkeyOf('edit.cut'), action: cutSelection},
        {id: 'copy', label: 'Copy', hotkey: hotkeyOf('edit.copy'), action: copySelection},
        {id: 'paste', label: 'Paste', hotkey: hotkeyOf('edit.paste'), disabled: editorStore.get().clipboard.length === 0, action: () => pasteAtPlayhead('overwrite')},
        separator('a'),
        {id: 'razor', label: 'Add Edit Here', action: () => razorAt(time, false, clipId)},
        {id: 'delete', label: 'Delete', hotkey: hotkeyOf('edit.delete'), danger: true, action: () => deleteSelection(false)},
        {id: 'ripple', label: 'Ripple Delete', hotkey: hotkeyOf('edit.rippleDelete'), danger: true, action: () => deleteSelection(true)},
        separator('b'),
        {id: 'enabled', label: clip?.enabled === false ? 'Enable' : 'Disable', hotkey: hotkeyOf('timeline.toggleEnabled'), action: toggleClipsEnabled},
        {id: 'link', label: 'Link', hotkey: hotkeyOf('timeline.link'), action: linkSelection},
        {id: 'unlink', label: 'Unlink', hotkey: hotkeyOf('timeline.unlink'), disabled: !clip?.linkId, action: unlinkSelection},
        separator('c'),
        {id: 'speed', label: 'Speed/Duration...', hotkey: hotkeyOf('timeline.speed'), action: openSpeedDialog},
        {
            id: 'label', label: 'Label', children: Object.keys(CLIP_LABELS).map((name) => ({
                id: `label-${name}`, label: name[0].toUpperCase() + name.slice(1), checked: clip?.label === name, action: () => setClipLabel(name)
            }))
        },
        separator('d'),
        {id: 'source', label: 'Open in Source Monitor', disabled: !media, action: () => media && openInSource(media.id)},
        {id: 'reveal', label: 'Reveal in Explorer / Finder', disabled: !media, action: () => media && window.api.revealInFolder(media.path)}
    ];
}

export function laneMenu(trackId: string, time: number): ContextMenuItem[] {
    const sequence = getActiveSequence();
    const track = sequence ? findTrack(sequence, trackId) : undefined;

    return [
        {id: 'paste', label: 'Paste', hotkey: hotkeyOf('edit.paste'), disabled: editorStore.get().clipboard.length === 0, action: () => {
            seekTo(time);
            pasteAtPlayhead('overwrite');
        }},
        {id: 'edit', label: 'Add Edit to All Tracks Here', action: () => razorAt(time, true, null)},
        separator('a'),
        {id: 'addv', label: 'Add Video Track', action: () => addTrackOfType('video')},
        {id: 'adda', label: 'Add Audio Track', action: () => addTrackOfType('audio')},
        {id: 'deltrack', label: `Delete Track ${track?.name ?? ''}`, danger: true, action: () => deleteTrack(trackId)},
        separator('b'),
        {id: 'fit', label: 'Zoom to Sequence', hotkey: hotkeyOf('timeline.zoomFit'), action: () => zoomToFit()}
    ];
}

export function rulerMenu(time: number, markerId: string | null): ContextMenuItem[] {
    return [
        {id: 'marker', label: 'Add Marker Here', action: () => {
            seekTo(time);
            addMarker();
        }},
        {
            id: 'markercolor', label: 'Marker Color', disabled: !markerId, children: MARKER_COLORS.map((choice) => ({
                id: `marker-${choice.id}`, label: choice.label, action: () => markerId && updateMarker(markerId, {color: choice.color})
            }))
        },
        {id: 'delmarker', label: 'Delete Marker', danger: true, disabled: !markerId, action: () => markerId && deleteMarker(markerId)},
        separator('a'),
        {id: 'clear', label: 'Clear In and Out', hotkey: hotkeyOf('mark.clear'), action: clearInOut},
        {id: 'fit', label: 'Zoom to Sequence', action: () => zoomToFit()},
        {id: 'edit', label: 'Add Edit at Playhead', hotkey: hotkeyOf('timeline.addEdit'), action: () => addEditAtPlayhead(false)}
    ];
}
