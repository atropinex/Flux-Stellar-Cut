import {MARKER_COLORS} from '../../../common/stellar/StellarConfig';
import {formatTimecode} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {seekTo} from '../../controller/playback/StellarPlayback.Controller';
import {addMarker, deleteMarker, updateMarker} from '../../controller/timeline/StellarTimelineActions.Controller';
import {BUTTON, INPUT} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';
import {EmptyPanel} from '../common/StellarFields';

// Every marker of the sequence. Click one to go there. The color, name and comment are edited here.

export default function StellarMarkersPanel() {
    const sequence = useStore(editorStore, (state) => getActiveSequence(state));
    const playhead = useStore(editorStore, (state) => state.playhead);

    if (!sequence) {
        return <EmptyPanel icon={<StellarIcon name="marker" size={28}/>}>Open a sequence to see its
            markers.</EmptyPanel>;
    }

    const markers = [...sequence.markers].sort((first, second) => first.time - second.time);
    const frameRate = sequence.settings.frameRate;

    return (
        <div className="flex h-full flex-col" data-theme="StellarMarkers.panel">
            <div className="flex items-center gap-2 border-b border-line p-2">
                <span
                    className="text-[12px] text-dim">{markers.length} {markers.length === 1 ? 'marker' : 'markers'}</span>
                <button type="button" className={`${BUTTON} ml-auto`} onClick={() => addMarker()}>
                    <StellarIcon name="marker" size={13}/> Add Marker
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
                {markers.length === 0 ?
                    <p className="p-4 text-center text-[12px] text-dim">Press M on the timeline to add a marker at the
                        playhead.</p> : null}
                {markers.map((marker) => {
                    const isHere = Math.abs(marker.time - playhead) < 0.5 / frameRate;

                    return (
                        <div key={marker.id}
                             className={`flex flex-col gap-1.5 border-b border-line px-3 py-2 ${isHere ? 'bg-accent/10' : ''}`}
                             data-theme="StellarMarkers.row">
                            <div className="flex items-center gap-2">
                                <span className="size-3 shrink-0 rounded-sm" style={{background: marker.color}}/>
                                <button type="button" className="timecode text-[12px] text-accent hover:underline"
                                        onClick={() => seekTo(marker.time)}>
                                    {formatTimecode(marker.time, frameRate)}
                                </button>
                                <input
                                    className={`${INPUT} py-0.5`} placeholder="Name" defaultValue={marker.name}
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
                                <button type="button" title="Delete marker"
                                        className="rounded p-1 text-dim hover:text-danger"
                                        onClick={() => deleteMarker(marker.id)}>
                                    <StellarIcon name="trash" size={13}/>
                                </button>
                            </div>
                            <div className="flex items-center gap-1 pl-5">
                                {MARKER_COLORS.map((choice) => (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        title={choice.label}
                                        className={`size-4 rounded-full border ${marker.color === choice.color ? 'border-white' : 'border-transparent'}`}
                                        style={{background: choice.color}}
                                        onClick={() => updateMarker(marker.id, {color: choice.color})}
                                    />
                                ))}
                            </div>
                            <textarea
                                className={`${INPUT} ml-5 min-h-[36px] w-[calc(100%-20px)] resize-y py-1`}
                                placeholder="Comment" defaultValue={marker.comment}
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
