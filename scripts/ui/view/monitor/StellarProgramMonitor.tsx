import {useEffect, useRef, useState} from 'react';
import {formatTimecode} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {StellarPreviewEngine} from '../../controller/playback/StellarPreviewEngine';
import {seekTo, stepFrames, togglePlay, toggleLoop} from '../../controller/playback/StellarPlayback.Controller';
import {sequenceDuration} from '../../controller/timeline/StellarTimeline.Controller';
import {
    addEditAtPlayhead,
    goToIn,
    goToNextEdit,
    goToOut,
    goToPreviousEdit,
    markIn,
    markOut,
    removeInOutRange,
    clearInOut,
    addMarker
} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openContextMenu, separator} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarMonitorStage from './StellarMonitorStage';
import StellarMaskOverlay from './StellarMaskOverlay';
import StellarScrubBar from './StellarScrubBar';
import StellarTransportBar from './StellarTransportBar';

/** The picture of the sequence at the playhead. The preview engine fills it with the clips. */
export default function StellarProgramMonitor() {
    const sequence = useStore(editorStore, (state) => getActiveSequence(state));
    const playhead = useStore(editorStore, (state) => state.playhead);
    const playing = useStore(editorStore, (state) => state.playing);
    const loop = useStore(editorStore, (state) => state.loop);
    const sources = useStore(editorStore, (state) => state.playbackSources);
    const layerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<StellarPreviewEngine | null>(null);
    const [showSafe, setShowSafe] = useState(false);
    const [stageWidth, setStageWidth] = useState(0);
    const hasSequence = sequence !== null;

    useEffect(() => {
        if (!layerRef.current) {
            return;
        }

        const engine = new StellarPreviewEngine(layerRef.current);

        engineRef.current = engine;
        engine.start();

        return () => {
            engine.dispose();
            engineRef.current = null;
        };
    }, [hasSequence]);

    if (!sequence) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-dim">
                <StellarIcon name="sequence" size={30}/>
                <p className="text-[12px]">There is no sequence yet.</p>
                <button type="button"
                        className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink"
                        onClick={() => editorStore.set({dialog: 'newSequence'})}>
                    New Sequence
                </button>
            </div>
        );
    }

    const duration = sequenceDuration(sequence);
    const aspect = sequence.settings.width / sequence.settings.height;
    const isBuilding = sequence.clips.some((clip) => {
        const media = editorStore.get().document?.media.find((item) => item.id === clip.mediaId);

        return media ? sources[media.path]?.mode === 'building' : false;
    });

    return (
        <div
            className="flex h-full flex-col"
            data-theme="StellarProgramMonitor.panel"
            onContextMenu={(event) =>
                openContextMenu(event, [
                    {id: 'safe', label: 'Safe Margins', checked: showSafe, action: () => setShowSafe(!showSafe)},
                    {id: 'loop', label: 'Loop Playback', checked: loop, action: toggleLoop},
                    separator('a'),
                    {id: 'in', label: 'Go to In', hotkey: 'Shift+I', action: goToIn},
                    {id: 'out', label: 'Go to Out', hotkey: 'Shift+O', action: goToOut},
                    {id: 'clear', label: 'Clear In and Out', hotkey: 'Mod+Shift+X', action: clearInOut},
                    {id: 'marker', label: 'Add Marker', hotkey: 'M', action: () => addMarker()}
                ])
            }
        >
            <StellarMonitorStage
                aspect={aspect}
                onSize={(width) => {
                    setStageWidth(width);
                    engineRef.current?.refresh();
                }}
                overlay={
                    <>
                        <StellarMaskOverlay stageWidth={stageWidth} stageHeight={stageWidth / aspect}/>
                        {showSafe ? (
                            <div className="pointer-events-none absolute inset-0">
                                <div className="absolute inset-[5%] border border-ink/40"/>
                                <div className="absolute inset-[10%] border border-ink/25"/>
                            </div>
                        ) : null}
                        {isBuilding ? (
                            <div
                                className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-warning">
                                <StellarIcon name="clock" size={12} className="stellar-spin"/> Preparing media for
                                playback...
                            </div>
                        ) : null}
                    </>
                }
            >
                <div ref={layerRef} className="absolute inset-0"/>
            </StellarMonitorStage>

            <StellarScrubBar time={playhead} duration={Math.max(duration, 1)} inPoint={sequence.inPoint}
                             outPoint={sequence.outPoint} onSeek={seekTo}/>

            <StellarTransportBar
                left={<span className="timecode text-[15px] text-accent"
                            data-theme="StellarProgramMonitor.timecode">{formatTimecode(playhead, sequence.settings.frameRate)}</span>}
                right={<span
                    className="timecode text-[12px] text-dim">{formatTimecode(duration, sequence.settings.frameRate)}</span>}
                buttons={[
                    {icon: 'markIn', title: 'Mark In (I)', onClick: markIn},
                    {icon: 'markOut', title: 'Mark Out (O)', onClick: markOut},
                    null,
                    {icon: 'goStart', title: 'Previous Edit (Up)', onClick: goToPreviousEdit},
                    {icon: 'stepBack', title: 'Step Back (Left)', onClick: () => stepFrames(-1)},
                    {
                        icon: playing ? 'pause' : 'play',
                        title: 'Play / Pause (Space)',
                        onClick: togglePlay,
                        active: playing
                    },
                    {icon: 'stepForward', title: 'Step Forward (Right)', onClick: () => stepFrames(1)},
                    {icon: 'goEnd', title: 'Next Edit (Down)', onClick: goToNextEdit},
                    null,
                    {icon: 'loop', title: 'Loop', onClick: toggleLoop, active: loop},
                    {icon: 'scissors', title: 'Add Edit (Ctrl+K)', onClick: () => addEditAtPlayhead(false)},
                    {icon: 'lift', title: 'Lift', onClick: () => removeInOutRange(false)},
                    {icon: 'extract', title: 'Extract', onClick: () => removeInOutRange(true)}
                ]}
            />
        </div>
    );
}
