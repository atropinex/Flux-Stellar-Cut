import {useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent} from 'react';
import {formatTimecode, snapToFrame} from '../../../common/utils/StellarTimeHelper';
import {MARKER_COLORS, MAX_PIXELS_PER_SECOND, MIN_PIXELS_PER_SECOND} from '../../../common/stellar/StellarConfig';
import {editorStore, getShownSequence, type ToolId} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {activateSequence} from '../../controller/project/StellarProject.Controller';
import {sequenceDuration, tracksOfType} from '../../controller/timeline/StellarTimeline.Controller';
import {
    addMarker, applyEffect, dropMediaOnTimeline, setTimelineViewportWidth, setZoom, toggleLinkedSelection, toggleSnapping, zoomToFit
} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openContextMenu, openMenuAt} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarAudioMeter from '../mixer/StellarAudioMeter';
import StellarIcon from '../common/StellarIcon';
import {BUTTON_GHOST} from '../common/StellarStyles';
import {MEDIA_DRAG_TYPE} from '../projectpanel/StellarProjectPanel';
import StellarTimelineClip from './StellarTimelineClip';
import StellarTimelineRuler from './StellarTimelineRuler';
import StellarTimelineTrackHeader from './StellarTimelineTrackHeader';
import {clipMenu, laneMenu, rulerMenu} from './StellarTimelineMenus';
import {EFFECT_DRAG_TYPE, EMPTY_TAIL_SECONDS, HEADER_WIDTH, RULER_HEIGHT, TRACK_HEIGHT} from './StellarTimelineConstants';
import {useStellarTimelineInteraction} from './useStellarTimelineInteraction';
import styles from './StellarTimelinePanel.module.css';

const CURSORS: Record<ToolId, string> = {
    selection: 'default', trackSelect: 'e-resize', ripple: 'col-resize', razor: 'crosshair', hand: 'grab', zoom: 'zoom-in', pen: 'crosshair'
};

/** The timeline: tracks, clips, ruler and playhead. */
export default function StellarTimelinePanel() {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const document = useStore(editorStore, (state) => state.document);
    const selection = useStore(editorStore, (state) => state.selection);
    const pixelsPerSecond = useStore(editorStore, (state) => state.pixelsPerSecond);
    const scrollX = useStore(editorStore, (state) => state.scrollX);
    const tool = useStore(editorStore, (state) => state.tool);
    const snapping = useStore(editorStore, (state) => state.snapping);
    const linked = useStore(editorStore, (state) => state.linkedSelection);
    const snapGuide = useStore(editorStore, (state) => state.snapGuide);
    const snapGuideKind = useStore(editorStore, (state) => state.snapGuideKind);
    const targetVideo = useStore(editorStore, (state) => state.targetVideoTrackId);
    const targetAudio = useStore(editorStore, (state) => state.targetAudioTrackId);
    const thumbnails = useStore(editorStore, (state) => state.thumbnails);
    const offline = useStore(editorStore, (state) => state.offline);
    const playhead = useStore(editorStore, (state) => state.playhead);
    const playing = useStore(editorStore, (state) => state.playing);

    const scrollerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [viewportWidth, setViewportWidth] = useState(800);
    const [dropActive, setDropActive] = useState(false);
    const [markerColor, setMarkerColor] = useState<string>(MARKER_COLORS[0].color);
    const interaction = useStellarTimelineInteraction(scrollerRef, contentRef);

    // Keep the viewport size up to date, for the ruler and for "zoom to sequence".
    useEffect(() => {
        const scroller = scrollerRef.current;

        if (!scroller) {
            return;
        }

        const measure = () => {
            setViewportWidth(scroller.clientWidth);
            setTimelineViewportWidth(Math.max(200, scroller.clientWidth - HEADER_WIDTH));
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(scroller);

        return () => observer.disconnect();
    }, []);

    // Ctrl + wheel zooms around the mouse. Shift + wheel scrolls sideways.
    useEffect(() => {
        const scroller = scrollerRef.current;

        if (!scroller) {
            return;
        }

        const handleWheel = (event: WheelEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                event.preventDefault();

                const state = editorStore.get();
                const anchorX = event.clientX - scroller.getBoundingClientRect().left - HEADER_WIDTH;
                const anchorTime = (scroller.scrollLeft + anchorX) / state.pixelsPerSecond;

                setZoom(state.pixelsPerSecond * (event.deltaY < 0 ? 1.15 : 1 / 1.15), anchorTime, anchorX);
            } else if (event.shiftKey) {
                event.preventDefault();
                scroller.scrollLeft += event.deltaY;
            }
        };

        scroller.addEventListener('wheel', handleWheel, {passive: false});

        return () => scroller.removeEventListener('wheel', handleWheel);
    }, []);

    // The store can ask for a new scroll position (after zooming). The scroller can also be dragged by hand.
    useEffect(() => {
        const scroller = scrollerRef.current;

        if (scroller && Math.abs(scroller.scrollLeft - scrollX) > 1) {
            scroller.scrollLeft = scrollX;
        }
    }, [scrollX, pixelsPerSecond]);

    // While playing, the view follows the playhead.
    useEffect(() => {
        const scroller = scrollerRef.current;

        if (!scroller || !playing) {
            return;
        }

        const x = playhead * pixelsPerSecond;
        const visibleWidth = scroller.clientWidth - HEADER_WIDTH;

        if (x > scroller.scrollLeft + visibleWidth - 30 || x < scroller.scrollLeft) {
            scroller.scrollLeft = Math.max(0, x - 60);
        }
    }, [playhead, playing, pixelsPerSecond]);

    if (!sequence || !document) {
        return (
            <div className={styles.column}>
                <StellarIcon name="sequence" size={28} />
                <p className={styles.textP}>Create a sequence to start editing.</p>
            </div>
        );
    }

    const contentWidth = Math.max(viewportWidth - HEADER_WIDTH, (sequenceDuration(sequence) + EMPTY_TAIL_SECONDS) * pixelsPerSecond);
    const videoTracks = [...tracksOfType(sequence, 'video')].reverse(); // the highest track is on top
    const audioTracks = tracksOfType(sequence, 'audio');
    const rows = [...videoTracks, ...audioTracks];

    function clipTime(clientX: number): number {
        return snapToFrame(interaction.timeAt(clientX), sequence!.settings.frameRate);
    }

    function handleContextMenu(event: ReactMouseEvent) {
        const target = event.target as HTMLElement;
        const time = clipTime(event.clientX);

        if (target.closest('[data-ruler]')) {
            const markerId = target.closest<HTMLElement>('[data-marker-id]')?.dataset.markerId ?? null;

            openContextMenu(event, rulerMenu(time, markerId));
            return;
        }

        const clipId = target.closest<HTMLElement>('[data-clip-id]')?.dataset.clipId;

        if (clipId) {
            openContextMenu(event, clipMenu(clipId, time));
            return;
        }

        const trackId = interaction.trackAt(event.clientY);

        if (trackId && !target.closest('[data-header]')) {
            openContextMenu(event, laneMenu(trackId, time));
        }
    }

    function handleDrop(event: ReactDragEvent) {
        event.preventDefault();
        setDropActive(false);

        const target = event.target as HTMLElement;
        const effectKind = event.dataTransfer.getData(EFFECT_DRAG_TYPE);

        if (effectKind) {
            const clipId = target.closest<HTMLElement>('[data-clip-id]')?.dataset.clipId;

            if (clipId) {
                applyEffect(effectKind, [clipId]);
            }

            return;
        }

        const dragged = event.dataTransfer.getData(MEDIA_DRAG_TYPE);
        const trackId = interaction.trackAt(event.clientY);

        if (!dragged || !trackId) {
            return;
        }

        let time = clipTime(event.clientX);

        for (const mediaId of JSON.parse(dragged) as string[]) {
            dropMediaOnTimeline(mediaId, time, trackId);

            const media = document!.media.find((item) => item.id === mediaId);

            time += media ? (media.kind === 'image' ? editorStore.get().settings.stillDurationSeconds : media.duration) : 0;
        }
    }

    return (
        <div className={styles.panel} data-theme="StellarTimeline.panel">
            {/* Toolbar */}
            <div className={styles.toolbar} data-theme="StellarTimeline.toolbar">
                {document.sequences.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => activateSequence(item.id)}
                        className={`${styles.textButton} ${item.id === sequence.id ? styles.textButtonId : styles.textButtonNotId}`}
                    >
                        {item.name}
                    </button>
                ))}
                <button type="button" className={BUTTON_GHOST} title="New sequence" onClick={() => editorStore.set({dialog: 'newSequence'})}>
                    <StellarIcon name="plus" size={14} />
                </button>

                <span className={`${styles.textSpan} timecode`}>{formatTimecode(playhead, sequence.settings.frameRate)}</span>

                <div className={styles.row}>
                    <button type="button" className={`${BUTTON_GHOST} ${snapping ? styles.textButtonSnapping : ''}`} title="Snap (S)" onClick={toggleSnapping}>
                        <StellarIcon name="magnet" size={15} />
                    </button>
                    <button type="button" className={`${BUTTON_GHOST} ${linked ? styles.textButtonSnapping : ''}`} title="Linked selection" onClick={toggleLinkedSelection}>
                        <StellarIcon name="link" size={15} />
                    </button>
                    <button type="button" className={BUTTON_GHOST} title="Add marker (M)" onClick={() => addMarker(markerColor)}>
                        <StellarIcon name="marker" size={15} />
                    </button>
                    <button
                        type="button"
                        className={styles.button}
                        style={{background: markerColor}}
                        title="Color of new markers"
                        onClick={(event) => {
                            const box = event.currentTarget.getBoundingClientRect();

                            openMenuAt(box.left, box.bottom + 4, MARKER_COLORS.map((choice) => ({id: choice.id, label: choice.label, checked: choice.color === markerColor, action: () => setMarkerColor(choice.color)})));
                        }}
                    />
                    <span className={styles.span} />
                    <button type="button" className={BUTTON_GHOST} title="Zoom out" onClick={() => setZoom(pixelsPerSecond / 1.35)}><StellarIcon name="minus" size={14} /></button>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={(Math.log(pixelsPerSecond / MIN_PIXELS_PER_SECOND) / Math.log(MAX_PIXELS_PER_SECOND / MIN_PIXELS_PER_SECOND)) * 100}
                        onChange={(event) => setZoom(MIN_PIXELS_PER_SECOND * Math.pow(MAX_PIXELS_PER_SECOND / MIN_PIXELS_PER_SECOND, Number(event.target.value) / 100))}
                        className={styles.boxInput}
                    />
                    <button type="button" className={BUTTON_GHOST} title="Zoom in" onClick={() => setZoom(pixelsPerSecond * 1.35)}><StellarIcon name="plus" size={14} /></button>
                    <button type="button" className={BUTTON_GHOST} title="Zoom to sequence (\)" onClick={() => zoomToFit()}><StellarIcon name="expand" size={14} /></button>
                </div>
            </div>

            {/* Tracks, and the audio meter on the right */}
            <div className={styles.row2}>
            <div className={styles.div}>
                <div
                    ref={scrollerRef}
                    className={styles.overlay}
                    onScroll={(event) => {
                        const left = event.currentTarget.scrollLeft;

                        if (Math.abs(left - editorStore.get().scrollX) > 1) {
                            editorStore.set({scrollX: left});
                        }
                    }}
                >
                    <div
                        ref={contentRef}
                        className={styles.div2}
                        style={{width: HEADER_WIDTH + contentWidth, minHeight: '100%', cursor: CURSORS[tool]}}
                        onPointerDown={interaction.onPointerDown}
                        onPointerMove={interaction.onPointerMove}
                        onPointerUp={interaction.onPointerUp}
                        onPointerLeave={interaction.onPointerLeave}
                        onContextMenu={handleContextMenu}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDropActive(true);
                        }}
                        onDragLeave={() => setDropActive(false)}
                        onDrop={handleDrop}
                    >
                        {/* Ruler row */}
                        <div className={styles.row3} style={{height: RULER_HEIGHT}}>
                            <div className={styles.div3} style={{width: HEADER_WIDTH}} data-header="true" />
                            <StellarTimelineRuler sequence={sequence} pixelsPerSecond={pixelsPerSecond} scrollX={scrollX} viewportWidth={viewportWidth} width={contentWidth} />
                        </div>

                        {/* Track rows */}
                        {rows.map((track, index) => {
                            const isFirstAudio = track.type === 'audio' && rows[index - 1]?.type === 'video';

                            return (
                                <div key={track.id} className={`${styles.row4} ${isFirstAudio ? styles.divIsFirstAudio : ''}`} data-track-row={track.id}>
                                    <div data-header="true">
                                        <StellarTimelineTrackHeader track={track} isTarget={track.id === (track.type === 'video' ? targetVideo : targetAudio)} />
                                    </div>
                                    <div
                                        className={`${styles.lane} ${track.locked ? styles.laneLocked : index % 2 === 0 ? styles.lane0 : ''} ${track.muted ? styles.laneMuted : ''}`}
                                        style={{width: contentWidth, height: TRACK_HEIGHT}}
                                        data-theme="StellarTimeline.lane"
                                    >
                                        {sequence.clips
                                            .filter((clip) => clip.trackId === track.id)
                                            .map((clip) => {
                                                const media = document.media.find((item) => item.id === clip.mediaId);

                                                return (
                                                    <StellarTimelineClip
                                                        key={clip.id}
                                                        clip={clip}
                                                        media={media}
                                                        trackType={track.type}
                                                        pixelsPerSecond={pixelsPerSecond}
                                                        selected={selection.includes(clip.id)}
                                                        offline={media ? Boolean(offline[media.id]) : true}
                                                        thumbnail={media ? thumbnails[media.path] : undefined}
                                                        locked={track.locked}
                                                    />
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* In / out range over the tracks */}
                        {sequence.inPoint !== null && sequence.outPoint !== null ? (
                            <div
                                className={styles.div4}
                                style={{left: HEADER_WIDTH + sequence.inPoint * pixelsPerSecond, width: (sequence.outPoint - sequence.inPoint) * pixelsPerSecond, top: RULER_HEIGHT}}
                            />
                        ) : null}

                        {/* Snap guide */}
                        {snapGuide !== null ? <div className={`${styles.div5} ${snapGuideKind === 'grid' ? styles.div5Grid : ''}`} style={{left: HEADER_WIDTH + snapGuide * pixelsPerSecond}} /> : null}

                        {/* Playhead */}
                        <div className={styles.playhead} style={{left: HEADER_WIDTH + playhead * pixelsPerSecond}} data-theme="StellarTimeline.playhead">
                            <div className={styles.div6} />
                            <div className={styles.div7} />
                        </div>

                        {/* Marquee */}
                        {interaction.marquee ? (
                            <div
                                className={styles.div8}
                                style={{left: interaction.marquee.left, top: interaction.marquee.top, width: interaction.marquee.width, height: interaction.marquee.height}}
                            />
                        ) : null}
                    </div>
                </div>

                {dropActive ? <div className={styles.overlay2} /> : null}
            </div>

            <div className={styles.meter} data-theme="StellarTimeline.meter" title="Master level">
                <div className={styles.text}>dB</div>
                <div className={styles.div9} style={{marginTop: RULER_HEIGHT - 14}}>
                    <StellarAudioMeter showScale />
                </div>
            </div>
            </div>
        </div>
    );
}
