import type {CSSProperties} from 'react';
import type {Clip, Track} from '../../../common/stellar/StellarContract';
import {PATH} from '../../../common/stellar/StellarAnimation';
import {isAnimatedProperty} from '../../../common/stellar/StellarProperty';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {tracksOfType} from '../../controller/timeline/StellarTimeline.Controller';
import {cancelPreview, changeTrack, previewMasterDb, previewTrackMix, setMasterDb} from '../../controller/timeline/StellarTimelineActions.Controller';
import {commitProperty, previewProperty, toggleAnimationOf, valueOfProperty} from '../../controller/timeline/StellarClipEdit.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarScrubNumber from '../common/StellarScrubNumber';
import {EmptyPanel} from '../common/StellarFields';
import StellarAudioMeter from './StellarAudioMeter';
import styles from './StellarAudioMixerPanel.module.css';

// The audio mixing desk. One strip for every audio track, and one for the master.
// The big fader of a strip is the volume of the clip under the playhead. The small one is the volume of the whole track.

const FADER_MIN = -60;
const FADER_MAX = 15;

const VERTICAL_RANGE: CSSProperties = {writingMode: 'vertical-lr', direction: 'rtl', width: 22, height: '100%'};

function Fader({value, onLive, onCommit, disabled}: {value: number; onLive: (value: number) => void; onCommit: (value: number) => void; disabled?: boolean}) {
    return (
        <input
            type="range" min={FADER_MIN} max={FADER_MAX} step={0.5} value={Math.max(FADER_MIN, value)} disabled={disabled}
            style={VERTICAL_RANGE} className={styles.boxInput}
            onChange={(event) => onLive(Number(event.target.value))}
            onPointerUp={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
            onKeyUp={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
        />
    );
}

function DbReadout({value, onLive, onCommit, onReset}: {value: number; onLive: (value: number) => void; onCommit: (value: number) => void; onReset: () => void}) {
    return <StellarScrubNumber value={value} min={FADER_MIN} max={FADER_MAX} step={0.1} unit=" dB" decimals={1} onChange={onLive} onCommit={onCommit} onReset={onReset} />;
}

function Strip({track, clip, ids, playhead}: {track: Track; clip: Clip | undefined; ids: string[]; playhead: number}) {
    const level = clip ? valueOfProperty(clip, PATH.volume) : 0;
    const pan = clip ? valueOfProperty(clip, PATH.pan) : 0;
    const animated = clip ? isAnimatedProperty(clip, PATH.volume) : false;

    void playhead;

    return (
        <div className={styles.strip} data-theme="StellarMixer.strip">
            <div className={styles.row}>
                <span className={styles.textSpan}>{track.name}</span>
                <div className={styles.row2}>
                    <button type="button" title="Mute" className={`${styles.textButton} ${track.muted ? styles.textButtonMuted : styles.textButtonNotMuted}`} onClick={() => changeTrack(track.id, {muted: !track.muted})}>M</button>
                    <button type="button" title="Solo" className={`${styles.textButton} ${track.solo ? styles.textButtonSolo : styles.textButtonNotMuted}`} onClick={() => changeTrack(track.id, {solo: !track.solo})}>S</button>
                </div>
            </div>

            <div className={styles.text} title={clip?.name}>{clip ? clip.name : 'No clip here'}</div>

            <div className={styles.row3}>
                Pan
                {clip ? (
                    <StellarScrubNumber
                        value={pan} min={-100} max={100} step={1} decimals={0}
                        onChange={(next) => previewProperty([clip.id], PATH.pan, next)}
                        onCommit={(next) => commitProperty([clip.id], PATH.pan, next)}
                        onReset={() => commitProperty([clip.id], PATH.pan, 0)}
                    />
                ) : <span>-</span>}
            </div>

            <div className={styles.row4}>
                <Fader
                    value={level} disabled={!clip}
                    onLive={(next) => clip && previewProperty([clip.id], PATH.volume, next)}
                    onCommit={(next) => clip && commitProperty([clip.id], PATH.volume, next)}
                />
                <StellarAudioMeter busId={track.id} />
            </div>

            <div className={styles.row}>
                {clip ? (
                    <>
                        <DbReadout
                            value={level}
                            onLive={(next) => previewProperty([clip.id], PATH.volume, next)}
                            onCommit={(next) => commitProperty([clip.id], PATH.volume, next)}
                            onReset={() => commitProperty([clip.id], PATH.volume, 0)}
                        />
                        <button
                            type="button"
                            title={animated ? 'This level is keyframed. Click to stop animating.' : 'Animate this level'}
                            className={`${styles.button} ${animated ? styles.textButtonAnimated : styles.textButtonNotAnimated}`}
                            onClick={() => toggleAnimationOf(clip.id, PATH.volume)}
                        >
                            <StellarIcon name="clock" size={12} />
                        </button>
                    </>
                ) : <span className={styles.textSpan2}>0.0 dB</span>}
            </div>

            <div className={styles.div}>
                <div className={styles.text2}>Whole track</div>
                <div className={styles.row3}>
                    <DbReadout
                        value={track.volumeDb ?? 0}
                        onLive={(next) => previewTrackMix(track.id, {volumeDb: next})}
                        onCommit={(next) => {
                            cancelPreview();
                            changeTrack(track.id, {volumeDb: next});
                        }}
                        onReset={() => changeTrack(track.id, {volumeDb: 0})}
                    />
                    <StellarScrubNumber
                        value={track.pan ?? 0} min={-100} max={100} step={1} decimals={0} unit=" pan"
                        onChange={(next) => previewTrackMix(track.id, {pan: next})}
                        onCommit={(next) => {
                            cancelPreview();
                            changeTrack(track.id, {pan: next});
                        }}
                        onReset={() => changeTrack(track.id, {pan: 0})}
                    />
                </div>
            </div>
        </div>
    );
}

export default function StellarAudioMixerPanel() {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const playhead = useStore(editorStore, (state) => state.playhead);
    const webAudio = useStore(editorStore, (state) => state.settings.webAudio);

    if (!sequence) {
        return <EmptyPanel icon={<StellarIcon name="volume" size={28} />}>Open a sequence to use the mixer.</EmptyPanel>;
    }

    const tracks = tracksOfType(sequence, 'audio');
    const masterDb = sequence.masterDb ?? 0;

    return (
        <div className={styles.panel} data-theme="StellarMixer.panel">
            {!webAudio ? <p className={styles.textP}>Web audio is off in Settings. Faders work in the export, but the preview cannot go above 0 dB and the meters stay empty.</p> : null}
            <div className={styles.row5}>
                {tracks.map((track) => {
                    const clip = sequence.clips.find((item) => item.trackId === track.id && playhead >= item.start && playhead < item.start + item.duration);
                    const ids = clip ? [clip.id] : [];

                    return <Strip key={track.id} track={track} clip={clip} ids={ids} playhead={playhead} />;
                })}

                <div className={styles.master} data-theme="StellarMixer.master">
                    <span className={styles.textSpan}>Master</span>
                    <div className={styles.row4}>
                        <Fader value={masterDb} onLive={previewMasterDb} onCommit={setMasterDb} />
                        <StellarAudioMeter showScale />
                    </div>
                    <DbReadout value={masterDb} onLive={previewMasterDb} onCommit={setMasterDb} onReset={() => setMasterDb(0)} />
                </div>
            </div>
        </div>
    );
}
