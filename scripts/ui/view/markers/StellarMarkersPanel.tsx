import {MARKER_COLORS} from '../../../common/stellar/StellarConfig';
import {formatTimecode} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {seekTo} from '../../controller/playback/StellarPlayback.Controller';
import {addMarker, deleteMarker, updateMarker} from '../../controller/timeline/StellarTimelineActions.Controller';
import {BUTTON, INPUT} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';
import {EmptyPanel} from '../common/StellarFields';
import styles from './StellarMarkersPanel.module.css';

// Every marker of the sequence. Click one to go there. The color, name and comment are edited here.

export default function StellarMarkersPanel() {
    const sequence = useStore(editorStore, (state) => getActiveSequence(state));
    const playhead = useStore(editorStore, (state) => state.playhead);

    if (!sequence) {
        return <EmptyPanel icon={<StellarIcon name="marker" size={28} />}>Open a sequence to see its markers.</EmptyPanel>;
    }

    const markers = [...sequence.markers].sort((first, second) => first.time - second.time);
    const frameRate = sequence.settings.frameRate;

    return (
        <div className={styles.panel} data-theme="StellarMarkers.panel">
            <div className={styles.row}>
                <span className={styles.textSpan}>{markers.length} {markers.length === 1 ? 'marker' : 'markers'}</span>
                <button type="button" className={`${styles.button} ${BUTTON}`} onClick={() => addMarker()}>
                    <StellarIcon name="marker" size={13} /> Add Marker
                </button>
            </div>

            <div className={styles.div}>
                {markers.length === 0 ? <p className={styles.textP}>Press M on the timeline to add a marker at the playhead.</p> : null}
                {markers.map((marker) => {
                    const isHere = Math.abs(marker.time - playhead) < 0.5 / frameRate;

                    return (
                        <div key={marker.id} className={`${styles.row2} ${isHere ? styles.rowIsHere : ''}`} data-theme="StellarMarkers.row">
                            <div className={styles.row3}>
                                <span className={styles.span} style={{background: marker.color}} />
                                <button type="button" className={`${styles.textButton} timecode`} onClick={() => seekTo(marker.time)}>
                                    {formatTimecode(marker.time, frameRate)}
                                </button>
                                <input
                                    className={`${styles.input} ${INPUT}`} placeholder="Name" defaultValue={marker.name}
                                    key={`${marker.id}-${marker.name}`}
                                    onBlur={(event) => {
                                        if (event.target.value !== marker.name) {
                                            updateMarker(marker.id, {name: event.target.value});
                                        }
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                                <button type="button" title="Delete marker" className={styles.textButton2} onClick={() => deleteMarker(marker.id)}>
                                    <StellarIcon name="trash" size={13} />
                                </button>
                            </div>
                            <div className={styles.row4}>
                                {MARKER_COLORS.map((choice) => (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        title={choice.label}
                                        className={`${styles.button2} ${marker.color === choice.color ? styles.buttonColor : styles.buttonNotColor}`}
                                        style={{background: choice.color}}
                                        onClick={() => updateMarker(marker.id, {color: choice.color})}
                                    />
                                ))}
                            </div>
                            <textarea
                                className={`${styles.textarea} ${INPUT}`} placeholder="Comment" defaultValue={marker.comment}
                                key={`${marker.id}-c-${marker.comment}`}
                                onBlur={(event) => {
                                    if (event.target.value !== marker.comment) {
                                        updateMarker(marker.id, {comment: event.target.value});
                                    }
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
