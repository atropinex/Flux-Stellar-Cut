import {useEffect, useRef, useState} from 'react';
import {formatTimecode} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getMedia} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {playbackUrlFor} from '../../controller/project/StellarMedia.Controller';
import {placeSourceOnTimeline} from '../../controller/timeline/StellarTimelineActions.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarMonitorStage from './StellarMonitorStage';
import StellarScrubBar from './StellarScrubBar';
import StellarTransportBar from './StellarTransportBar';

/** Plays a single clip from the project, so you can pick the part you want before putting it on the timeline. */
export default function StellarSourceMonitor() {
    const media = useStore(editorStore, (state) => (state.sourceMediaId ? getMedia(state, state.sourceMediaId) ?? null : null));
    const marks = useStore(editorStore, (state) => (state.sourceMediaId ? state.sourceMarks[state.sourceMediaId] : undefined));
    const sources = useStore(editorStore, (state) => state.playbackSources);
    const thumbnails = useStore(editorStore, (state) => state.thumbnails);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(false);

    const url = media ? playbackUrlFor(media.path) : null;
    const frameRate = media && media.frameRate > 0 ? media.frameRate : 24;
    const isPlayable = media?.kind === 'video' || media?.kind === 'audio';

    useEffect(() => {
        setTime(0);
        setPlaying(false);
    }, [media?.id]);

    function setMark(kind: 'inPoint' | 'outPoint') {
        if (!media) {
            return;
        }

        const current = editorStore.get().sourceMarks[media.id] ?? {inPoint: null, outPoint: null};

        editorStore.set((state) => ({sourceMarks: {...state.sourceMarks, [media.id]: {...current, [kind]: time}}}));
    }

    function seek(next: number) {
        setTime(next);

        if (videoRef.current) {
            videoRef.current.currentTime = next;
        }
    }

    function togglePlayback() {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        if (video.paused) {
            void video.play();
        } else {
            video.pause();
        }
    }

    if (!media) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-dim">
                <StellarIcon name="film" size={30}/>
                <p className="text-[12px]">Double-click a clip in the Project panel to look at it here.</p>
            </div>
        );
    }

    const aspect = media.hasVideo && media.height > 0 ? media.width / media.height : 16 / 9;
    const building = sources[media.path]?.mode === 'building';

    return (
        <div className="flex h-full flex-col" data-theme="StellarSourceMonitor.panel">
            <StellarMonitorStage aspect={aspect}>
                {media.kind === 'image' && url ? (
                    <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain"/>
                ) : media.kind === 'audio' ? (
                    <div className="absolute inset-0 flex items-center justify-center text-audio-clip">
                        {thumbnails[media.path] ? null : <StellarIcon name="music" size={40}/>}
                        {url ? <video ref={videoRef} src={url} className="hidden"
                                      onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                                      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}/> : null}
                    </div>
                ) : url ? (
                    <video
                        ref={videoRef}
                        src={url}
                        className="absolute inset-0 h-full w-full object-contain"
                        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                    />
                ) : (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12px] text-warning">
                        <StellarIcon name="clock" size={22} className={building ? 'stellar-spin' : ''}/>
                        {building ? 'Preparing for playback...' : 'This file cannot be played.'}
                    </div>
                )}
            </StellarMonitorStage>

            <StellarScrubBar time={time} duration={media.duration} inPoint={marks?.inPoint ?? null}
                             outPoint={marks?.outPoint ?? null} onSeek={seek}/>

            <StellarTransportBar
                left={<span className="timecode text-[15px] text-accent">{formatTimecode(time, frameRate)}</span>}
                right={<span className="truncate text-[11px] text-dim">{media.name}</span>}
                buttons={[
                    {icon: 'markIn', title: 'Mark In', onClick: () => setMark('inPoint')},
                    {icon: 'markOut', title: 'Mark Out', onClick: () => setMark('outPoint')},
                    null,
                    {
                        icon: 'stepBack',
                        title: 'Step Back',
                        onClick: () => seek(Math.max(0, time - 1 / frameRate)),
                        disabled: !isPlayable
                    },
                    {
                        icon: playing ? 'pause' : 'play',
                        title: 'Play / Pause',
                        onClick: togglePlayback,
                        active: playing,
                        disabled: !isPlayable
                    },
                    {
                        icon: 'stepForward',
                        title: 'Step Forward',
                        onClick: () => seek(Math.min(media.duration, time + 1 / frameRate)),
                        disabled: !isPlayable
                    },
                    null,
                    {icon: 'insert', title: 'Insert (,)', onClick: () => placeSourceOnTimeline(media.id, 'insert')},
                    {
                        icon: 'overwrite',
                        title: 'Overwrite (.)',
                        onClick: () => placeSourceOnTimeline(media.id, 'overwrite')
                    }
                ]}
            />
        </div>
    );
}
