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
import styles from './StellarSourceMonitor.module.css';

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
            <div className={styles.column}>
                <StellarIcon name="film" size={30} />
                <p className={styles.textP}>Double-click a clip in the Project panel to look at it here.</p>
            </div>
        );
    }

    const aspect = media.hasVideo && media.height > 0 ? media.width / media.height : 16 / 9;
    const building = sources[media.path]?.mode === 'building';

    return (
        <div className={styles.panel} data-theme="StellarSourceMonitor.panel">
            <StellarMonitorStage aspect={aspect}>
                {media.kind === 'image' && url ? (
                    <img src={url} alt="" className={styles.overlayImg} />
                ) : media.kind === 'audio' ? (
                    <div className={styles.overlay}>
                        {thumbnails[media.path] ? null : <StellarIcon name="music" size={40} />}
                        {url ? <video ref={videoRef} src={url} className={styles.video} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : null}
                    </div>
                ) : url ? (
                    <video
                        ref={videoRef}
                        src={url}
                        className={styles.overlayImg}
                        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                    />
                ) : (
                    <div className={styles.overlay2}>
                        <StellarIcon name="clock" size={22} className={building ? 'stellar-spin' : ''} />
                        {building ? 'Preparing for playback...' : 'This file cannot be played.'}
                    </div>
                )}
            </StellarMonitorStage>

            <StellarScrubBar time={time} duration={media.duration} inPoint={marks?.inPoint ?? null} outPoint={marks?.outPoint ?? null} onSeek={seek} />

            <StellarTransportBar
                left={<span className={`${styles.textSpan} timecode`}>{formatTimecode(time, frameRate)}</span>}
                right={<span className={styles.textSpan2}>{media.name}</span>}
                buttons={[
                    {icon: 'markIn', title: 'Mark In', onClick: () => setMark('inPoint')},
                    {icon: 'markOut', title: 'Mark Out', onClick: () => setMark('outPoint')},
                    null,
                    {icon: 'stepBack', title: 'Step Back', onClick: () => seek(Math.max(0, time - 1 / frameRate)), disabled: !isPlayable},
                    {icon: playing ? 'pause' : 'play', title: 'Play / Pause', onClick: togglePlayback, active: playing, disabled: !isPlayable},
                    {icon: 'stepForward', title: 'Step Forward', onClick: () => seek(Math.min(media.duration, time + 1 / frameRate)), disabled: !isPlayable},
                    null,
                    {icon: 'insert', title: 'Insert (,)', onClick: () => placeSourceOnTimeline(media.id, 'insert')},
                    {icon: 'overwrite', title: 'Overwrite (.)', onClick: () => placeSourceOnTimeline(media.id, 'overwrite')}
                ]}
            />
        </div>
    );
}
