import type {Track} from '../../../common/stellar/StellarContract';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {addTrackOfType, changeTrack, deleteTrack} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openContextMenu, separator} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import {HEADER_WIDTH, TRACK_HEIGHT} from './StellarTimelineConstants';
import styles from './StellarTimelineTrackHeader.module.css';

interface HeaderProps {
    track: Track;
    isTarget: boolean;
}

/** The left side of a track: its name, and the eye / speaker / lock buttons. */
export default function StellarTimelineTrackHeader({track, isTarget}: HeaderProps) {
    const isVideo = track.type === 'video';

    function setAsTarget() {
        editorStore.set(isVideo ? {targetVideoTrackId: track.id} : {targetAudioTrackId: track.id});
    }

    return (
        <div
            className={styles.trackHeader}
            style={{width: HEADER_WIDTH, height: TRACK_HEIGHT}}
            data-theme="StellarTimeline.trackHeader"
            onContextMenu={(event) =>
                openContextMenu(event, [
                    {id: 'target', label: 'Target This Track', action: setAsTarget},
                    {id: 'lock', label: track.locked ? 'Unlock Track' : 'Lock Track', action: () => changeTrack(track.id, {locked: !track.locked})},
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
                className={`${styles.rowButton} ${
                    isTarget ? (isVideo ? styles.textButtonIsVideo : styles.textButtonNotIsVideo) : styles.textButtonNotIsVideo2
                }`}
            >
                {track.name}
            </button>

            <button type="button" className={`${styles.smallButton} ${track.muted ? styles.textButtonMuted : styles.textButtonNotMuted}`} title={isVideo ? 'Show / hide track' : 'Mute track'} onClick={() => changeTrack(track.id, {muted: !track.muted})}>
                <StellarIcon name={isVideo ? (track.muted ? 'eyeOff' : 'eye') : track.muted ? 'volumeOff' : 'volume'} size={13} />
            </button>

            {!isVideo ? (
                <button type="button" className={`${styles.smallButton} ${track.solo ? styles.textButtonSolo : styles.textButtonNotMuted}`} title="Solo track" onClick={() => changeTrack(track.id, {solo: !track.solo})}>
                    <span className={styles.textSpan}>S</span>
                </button>
            ) : null}

            <button type="button" className={`${styles.button} ${styles.smallButton} ${track.locked ? styles.textButtonLocked : styles.textButtonNotMuted}`} title="Lock track" onClick={() => changeTrack(track.id, {locked: !track.locked})}>
                <StellarIcon name={track.locked ? 'lock' : 'unlock'} size={13} />
            </button>
        </div>
    );
}
