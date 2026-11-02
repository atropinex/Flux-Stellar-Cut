import {useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent} from 'react';
import {formatTimecode, snapToFrame} from '../../../common/utils/StellarTimeHelper';
import {MARKER_COLORS, MAX_PIXELS_PER_SECOND, MIN_PIXELS_PER_SECOND} from '../../../common/stellar/StellarConfig';
import {editorStore, getShownSequence, type ToolId} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {activateSequence} from '../../controller/project/StellarProject.Controller';
import {sequenceDuration, tracksOfType} from '../../controller/timeline/StellarTimeline.Controller';
import {
    addMarker,
    applyEffect,
    dropMediaOnTimeline,
    setTimelineViewportWidth,
    setZoom,
    toggleLinkedSelection,
    toggleSnapping,
    zoomToFit
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
import {
    EFFECT_DRAG_TYPE,
    EMPTY_TAIL_SECONDS,
    HEADER_WIDTH,
    RULER_HEIGHT,
    TRACK_HEIGHT
} from './StellarTimelineConstants';
import {useStellarTimelineInteraction} from './useStellarTimelineInteraction';

const CURSORS: Record<ToolId, string> = {
    selection: 'default',
    trackSelect: 'e-resize',
    ripple: 'col-resize',
    razor: 'crosshair',
    hand: 'grab',
    zoom: 'zoom-in',
    pen: 'crosshair'
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
            <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
                <StellarIcon name="sequence" size={28}/>
                <p className="text-[12px]">Create a sequence to start editing.</p>
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
        <div className="flex h-full flex-col" data-theme="StellarTimeline.panel">
            {/* Toolbar */}
            <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2"
                 data-theme="StellarTimeline.toolbar">
                {document.sequences.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => activateSequence(item.id)}
                        className={`max-w-40 truncate rounded-md px-2.5 py-1 text-[12px] ${item.id === sequence.id ? 'bg-surface-hover text-ink' : 'text-dim hover:text-ink'}`}
                    >
                        {item.name}
                    </button>
                ))}
                <button type="button" className={BUTTON_GHOST} title="New sequence"
                        onClick={() => editorStore.set({dialog: 'newSequence'})}>
                    <StellarIcon name="plus" size={14}/>
                </button>

                <span
                    className="timecode ml-3 text-[13px] text-accent">{formatTimecode(playhead, sequence.settings.frameRate)}</span>

                <div className="ml-auto flex items-center gap-1">
                    <button type="button" className={`${BUTTON_GHOST} ${snapping ? 'bg-accent/20 text-accent' : ''}`}
                            title="Snap (S)" onClick={toggleSnapping}>
                        <StellarIcon name="magnet" size={15}/>
                    </button>
                    <button type="button" className={`${BUTTON_GHOST} ${linked ? 'bg-accent/20 text-accent' : ''}`}
                            title="Linked selection" onClick={toggleLinkedSelection}>
                        <StellarIcon name="link" size={15}/>
                    </button>
                    <button type="button" className={BUTTON_GHOST} title="Add marker (M)"
                            onClick={() => addMarker(markerColor)}>
                        <StellarIcon name="marker" size={15}/>
                    </button>
                    <button
                        type="button"
                        className="size-4 rounded-full border border-ink/40"
                        style={{background: markerColor}}
                        title="Color of new markers"
                        onClick={(event) => {
                            const box = event.currentTarget.getBoundingClientRect();

                            openMenuAt(box.left, box.bottom + 4, MARKER_COLORS.map((choice) => ({
                                id: choice.id,
                                label: choice.label,
                                checked: choice.color === markerColor,
                                action: () => setMarkerColor(choice.color)
                            })));
                        }}
                    />
                    <span className="mx-1 h-4 w-px bg-line"/>
                    <button type="button" className={BUTTON_GHOST} title="Zoom out"
                            onClick={() => setZoom(pixelsPerSecond / 1.35)}><StellarIcon name="minus" size={14}/>
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={(Math.log(pixelsPerSecond / MIN_PIXELS_PER_SECOND) / Math.log(MAX_PIXELS_PER_SECOND / MIN_PIXELS_PER_SECOND)) * 100}
                        onChange={(event) => setZoom(MIN_PIXELS_PER_SECOND * Math.pow(MAX_PIXELS_PER_SECOND / MIN_PIXELS_PER_SECOND, Number(event.target.value) / 100))}
                        className="w-24"
                    />
                    <button type="button" className={BUTTON_GHOST} title="Zoom in"
                            onClick={() => setZoom(pixelsPerSecond * 1.35)}><StellarIcon name="plus" size={14}/>
                    </button>
                    <button type="button" className={BUTTON_GHOST} title="Zoom to sequence (\)"
                            onClick={() => zoomToFit()}><StellarIcon name="expand" size={14}/></button>
                </div>
            </div>

            {/* Tracks, and the audio meter on the right */}
            <div className="flex min-h-0 flex-1">
                <div className="relative min-h-0 min-w-0 flex-1">
                    <div
                        ref={scrollerRef}
                        className="absolute inset-0 overflow-auto"
                        onScroll={(event) => {
                            const left = event.currentTarget.scrollLeft;

                            if (Math.abs(left - editorStore.get().scrollX) > 1) {
                                editorStore.set({scrollX: left});
                            }
                        }}
                    >
                        <div
                            ref={contentRef}
                            className="relative"
                            style={{width: HEADER_WIDTH + contentWidth, minHeight: '100%', cursor: CURSORS[tool]}}
                            onPointerDown={interaction.onPointerDown}
                            onPointerMove={interaction.onPointerMove}
                            onPointerUp={interaction.onPointerUp}
                            onContextMenu={handleContextMenu}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDropActive(true);
                            }}
                            onDragLeave={() => setDropActive(false)}
                            onDrop={handleDrop}
                        >
                            {/* Ruler row */}
                            <div
                                className="sticky top-0 z-30 flex bg-[color-mix(in_srgb,var(--sc-base)_75%,transparent)] backdrop-blur-md"
                                style={{height: RULER_HEIGHT}}>
                                <div
                                    className="sticky left-0 z-40 shrink-0 border-b border-r border-line bg-[color-mix(in_srgb,var(--sc-base)_80%,transparent)]"
                                    style={{width: HEADER_WIDTH}} data-header="true"/>
                                <StellarTimelineRuler sequence={sequence} pixelsPerSecond={pixelsPerSecond}
                                                      scrollX={scrollX} viewportWidth={viewportWidth}
                                                      width={contentWidth}/>
                            </div>

                            {/* Track rows */}
                            {rows.map((track, index) => {
                                const isFirstAudio = track.type === 'audio' && rows[index - 1]?.type === 'video';

                                return (
                                    <div key={track.id}
                                         className={`flex ${isFirstAudio ? 'border-t-2 border-t-line' : ''}`}
                                         data-track-row={track.id}>
                                        <div data-header="true">
                                            <StellarTimelineTrackHeader track={track}
                                                                        isTarget={track.id === (track.type === 'video' ? targetVideo : targetAudio)}/>
                                        </div>
                                        <div
                                            className={`relative border-b border-line/60 ${track.locked ? 'bg-deep' : index % 2 === 0 ? 'bg-ink/[0.015]' : ''} ${track.muted ? 'opacity-60' : ''}`}
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
                                    className="pointer-events-none absolute bottom-0 z-[5] bg-accent/10"
                                    style={{
                                        left: HEADER_WIDTH + sequence.inPoint * pixelsPerSecond,
                                        width: (sequence.outPoint - sequence.inPoint) * pixelsPerSecond,
                                        top: RULER_HEIGHT
                                    }}
                                />
                            ) : null}

                            {/* Snap guide */}
                            {snapGuide !== null ?
                                <div className="pointer-events-none absolute bottom-0 top-0 z-[25] w-px bg-warning"
                                     style={{left: HEADER_WIDTH + snapGuide * pixelsPerSecond}}/> : null}

                            {/* Playhead */}
                            <div className="pointer-events-none absolute bottom-0 top-0 z-[26]"
                                 style={{left: HEADER_WIDTH + playhead * pixelsPerSecond}}
                                 data-theme="StellarTimeline.playhead">
                                <div
                                    className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[10px] border-x-transparent border-t-playhead"/>
                                <div className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-playhead"/>
                            </div>

                            {/* Marquee */}
                            {interaction.marquee ? (
                                <div
                                    className="pointer-events-none absolute z-[40] border border-accent bg-accent/15"
                                    style={{
                                        left: interaction.marquee.left,
                                        top: interaction.marquee.top,
                                        width: interaction.marquee.width,
                                        height: interaction.marquee.height
                                    }}
                                />
                            ) : null}
                        </div>
                    </div>

                    {dropActive ? <div
                        className="pointer-events-none absolute inset-1 rounded-xl border-2 border-dashed border-accent/60"/> : null}
                </div>

                <div className="flex w-[52px] shrink-0 flex-col items-center border-l border-line pb-2 pt-1"
                     data-theme="StellarTimeline.meter" title="Master level">
                    <div className="mb-1 text-[9px] uppercase tracking-wide text-dim">dB</div>
                    <div className="min-h-0 flex-1" style={{marginTop: RULER_HEIGHT - 14}}>
                        <StellarAudioMeter showScale/>
                    </div>
                </div>
            </div>
        </div>
    );
}
