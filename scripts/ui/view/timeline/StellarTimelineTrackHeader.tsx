import type {Track} from '../../../common/stellar/StellarContract';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {addTrackOfType, changeTrack, deleteTrack} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openContextMenu, separator} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import {HEADER_WIDTH, TRACK_HEIGHT} from './StellarTimelineConstants';

interface HeaderProps {
    track: Track;
    isTarget: boolean;
}

const small = 'flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-surface-hover';

/** The left side of a track: its name, and the eye / speaker / lock buttons. */
export default function StellarTimelineTrackHeader({track, isTarget}: HeaderProps) {
    const isVideo = track.type === 'video';

    function setAsTarget() {
        editorStore.set(isVideo ? {targetVideoTrackId: track.id} : {targetAudioTrackId: track.id});
    }

    return (
        <div
            className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-b border-r border-line bg-[color-mix(in_srgb,var(--sc-base)_70%,transparent)] px-2 backdrop-blur-md"
            style={{width: HEADER_WIDTH, height: TRACK_HEIGHT}}
            data-theme="StellarTimeline.trackHeader"
            onContextMenu={(event) =>
                openContextMenu(event, [
                    {id: 'target', label: 'Target This Track', action: setAsTarget},
                    {
                        id: 'lock',
                        label: track.locked ? 'Unlock Track' : 'Lock Track',
                        action: () => changeTrack(track.id, {locked: !track.locked})
                    },
                    separator('a'),
                    {id: 'addv', label: 'Add Video Track', action: () => addTrackOfType('video')},
                    {id: 'adda', label: 'Add Audio Track', action: () => addTrackOfType('audio')},
                    separator('b'),
                    {id: 'delete', label: 'Delete Track', danger: true, action: () => deleteTrack(track.id)}
                ])
            }
        >
            <button
                type="button"
                title="Click to target this track for Insert and Overwrite"
                onClick={setAsTarget}
                className={`flex h-6 w-7 items-center justify-center rounded-md text-[11px] font-semibold ${
                    isTarget ? (isVideo ? 'bg-video-clip text-white' : 'bg-audio-clip text-white') : 'bg-surface text-dim hover:text-ink'
                }`}
            >
                {track.name}
            </button>

            <button type="button" className={`${small} ${track.muted ? 'text-danger' : 'text-dim'}`}
                    title={isVideo ? 'Show / hide track' : 'Mute track'}
                    onClick={() => changeTrack(track.id, {muted: !track.muted})}>
                <StellarIcon name={isVideo ? (track.muted ? 'eyeOff' : 'eye') : track.muted ? 'volumeOff' : 'volume'}
                             size={13}/>
            </button>

            {!isVideo ? (
                <button type="button" className={`${small} ${track.solo ? 'bg-warning/30 text-warning' : 'text-dim'}`}
                        title="Solo track" onClick={() => changeTrack(track.id, {solo: !track.solo})}>
                    <span className="text-[10px] font-bold">S</span>
                </button>
            ) : null}

            <button type="button" className={`${small} ml-auto ${track.locked ? 'text-warning' : 'text-dim'}`}
                    title="Lock track" onClick={() => changeTrack(track.id, {locked: !track.locked})}>
                <StellarIcon name={track.locked ? 'lock' : 'unlock'} size={13}/>
            </button>
        </div>
    );
}
