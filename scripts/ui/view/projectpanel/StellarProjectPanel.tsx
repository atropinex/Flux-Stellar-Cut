import {
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type DragEvent as ReactDragEvent,
    type MouseEvent as ReactMouseEvent
} from 'react';
import type {Bin, MediaItem, Sequence} from '../../../common/stellar/StellarContract';
import {formatDuration, formatFrameRate, formatTimecode} from '../../../common/utils/StellarTimeHelper';
import {ALL_MEDIA_EXTENSIONS} from '../../../common/stellar/StellarConfig';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {
    activateSequence,
    addBin,
    deleteBin,
    deleteMedia,
    deleteSequence,
    moveMediaToBin,
    renameBin,
    renameMedia,
    renameSequence
} from '../../controller/project/StellarProject.Controller';
import {
    createSequenceFromMedia,
    importPaths,
    importWithDialog,
    openInSource,
    relinkMedia
} from '../../controller/project/StellarMedia.Controller';
import {
    appendMediaToTimeline,
    placeSourceOnTimeline
} from '../../controller/timeline/StellarTimelineActions.Controller';
import {
    openContextMenu,
    separator,
    type ContextMenuItem
} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon, {type IconName} from '../common/StellarIcon';
import {BUTTON_GHOST, INPUT} from '../common/StellarStyles';

export type SortColumn = 'name' | 'frameRate' | 'mediaStart' | 'duration';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'list' | 'icon' | 'freeform';

export const MEDIA_DRAG_TYPE = 'application/x-stellar-media';

type Row =
    | { type: 'bin'; id: string; name: string; depth: number; bin: Bin }
    | { type: 'media'; id: string; name: string; depth: number; media: MediaItem }
    | { type: 'sequence'; id: string; name: string; depth: number; sequence: Sequence };

function iconFor(media: MediaItem): IconName {
    if (media.kind === 'audio') {
        return 'music';
    }

    return media.kind === 'image' ? 'image' : 'film';
}

interface SortState {
    column: SortColumn;
    direction: SortDirection;
}

function compareMedia(first: MediaItem, second: MediaItem, sort: SortState): number {
    let result = 0;

    switch (sort.column) {
        case 'frameRate':
            result = first.frameRate - second.frameRate;
            break;
        case 'duration':
            result = first.duration - second.duration;
            break;
        case 'mediaStart':
            result = (first.metadata?.['startTimecode'] ?? '').localeCompare(second.metadata?.['startTimecode'] ?? '');
            break;
        default:
            result = first.name.localeCompare(second.name, undefined, {numeric: true, sensitivity: 'base'});
            break;
    }

    if (result === 0) {
        result = first.name.localeCompare(second.name, undefined, {numeric: true, sensitivity: 'base'});
    }

    return sort.direction === 'asc' ? result : -result;
}

/** Lists bins first, then their media. A closed bin hides what is inside. Sequences live in the "Sequences" bin. */
function buildRows(bins: Bin[], media: MediaItem[], sequences: Sequence[], expanded: Set<string>, query: string, sort: SortState): Row[] {
    const rows: Row[] = [];
    const search = query.trim().toLowerCase();
    const matches = (name: string) => !search || name.toLowerCase().includes(search);
    const sequenceBin = bins.find((bin) => bin.name === 'Sequences' && bin.parentId === null);
    const byName = (first: { name: string }, second: { name: string }) => {
        const result = first.name.localeCompare(second.name, undefined, {numeric: true, sensitivity: 'base'});

        return sort.column === 'name' && sort.direction === 'desc' ? -result : result;
    };

    function addLevel(parentId: string | null, depth: number) {
        for (const bin of bins.filter((item) => item.parentId === parentId).sort(byName)) {
            rows.push({type: 'bin', id: bin.id, name: bin.name, depth, bin});

            if (expanded.has(bin.id) || search) {
                addLevel(bin.id, depth + 1);
            }
        }

        const items = media.filter((candidate) => candidate.binId === parentId && matches(candidate.name)).sort((first, second) => compareMedia(first, second, sort));

        for (const item of items) {
            rows.push({type: 'media', id: item.id, name: item.name, depth, media: item});
        }

        if (parentId === (sequenceBin?.id ?? null)) {
            for (const sequence of sequences.filter((candidate) => matches(candidate.name)).sort(byName)) {
                rows.push({type: 'sequence', id: sequence.id, name: sequence.name, depth, sequence});
            }
        }
    }

    addLevel(null, 0);

    return rows;
}

const COLUMNS: { id: SortColumn; label: string; width: string }[] = [
    {id: 'frameRate', label: 'Frame Rate', width: 'w-[76px]'},
    {id: 'mediaStart', label: 'Media Start', width: 'w-[92px]'},
    {id: 'duration', label: 'Duration', width: 'w-[72px]'}
];

export default function StellarProjectPanel() {
    const document = useStore(editorStore, (state) => state.document);
    const selectedIds = useStore(editorStore, (state) => state.selectedMediaIds);
    const thumbnails = useStore(editorStore, (state) => state.thumbnails);
    const offline = useStore(editorStore, (state) => state.offline);
    const sources = useStore(editorStore, (state) => state.playbackSources);
    const activeSequenceId = document?.activeSequenceId ?? null;
    const [view, setView] = useState<ViewMode>('list');
    const [sort, setSort] = useState<SortState>({column: 'name', direction: 'asc'});
    const [zoom, setZoom] = useState(50); // 0..100, how big the pictures are in icon and freeform view
    const [freeform, setFreeform] = useState<Record<string, { x: number; y: number }>>({});
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set((editorStore.get().document?.bins ?? []).map((bin) => bin.id)));
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [isDropping, setIsDropping] = useState(false);

    const rows = useMemo(
        () => (document ? buildRows(document.bins, document.media, document.sequences, expanded, query, sort) : []),
        [document, expanded, query, sort]
    );

    // F2 and "New Bin" are commands, so they reach this panel as events.
    useEffect(() => {
        const startRename = () => {
            const id = editorStore.get().selectedMediaIds[0];

            if (id) {
                setRenamingId(id);
            }
        };
        const newBin = () => makeBin(editorStore.get().selectedBinId);

        window.addEventListener('stellar:rename-selected-media', startRename);
        window.addEventListener('stellar:new-bin', newBin);

        return () => {
            window.removeEventListener('stellar:rename-selected-media', startRename);
            window.removeEventListener('stellar:new-bin', newBin);
        };
    }, []);

    function makeBin(parentId: string | null) {
        const id = addBin('New Bin', parentId);

        if (parentId) {
            setExpanded((current) => new Set(current).add(parentId));
        }

        setRenamingId(id);
    }

    function selectRow(row: Row, event: ReactMouseEvent) {
        if (row.type === 'bin') {
            editorStore.set({selectedBinId: row.id, selectedMediaIds: []});
            return;
        }

        if (row.type === 'sequence') {
            editorStore.set({selectedMediaIds: []});
            return;
        }

        const current = editorStore.get().selectedMediaIds;

        if (event.ctrlKey || event.metaKey) {
            editorStore.set({selectedMediaIds: current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]});
        } else if (event.shiftKey && current.length > 0) {
            const mediaRows = rows.filter((item) => item.type === 'media').map((item) => item.id);
            const from = mediaRows.indexOf(current[current.length - 1]);
            const to = mediaRows.indexOf(row.id);

            editorStore.set({selectedMediaIds: mediaRows.slice(Math.min(from, to), Math.max(from, to) + 1)});
        } else {
            editorStore.set({selectedMediaIds: [row.id]});
        }
    }

    function openRow(row: Row) {
        if (row.type === 'bin') {
            setExpanded((current) => {
                const next = new Set(current);

                if (next.has(row.id)) {
                    next.delete(row.id);
                } else {
                    next.add(row.id);
                }

                return next;
            });
        } else if (row.type === 'media') {
            openInSource(row.id);
        } else {
            activateSequence(row.id);
        }
    }

    function finishRename(row: Row, name: string) {
        setRenamingId(null);

        if (!name.trim() || name === row.name) {
            return;
        }

        if (row.type === 'bin') {
            renameBin(row.id, name.trim());
        } else if (row.type === 'media') {
            renameMedia(row.id, name.trim());
        } else {
            renameSequence(row.id, name.trim());
        }
    }

    function rowMenu(row: Row): ContextMenuItem[] {
        if (row.type === 'bin') {
            return [
                {id: 'rename', label: 'Rename', action: () => setRenamingId(row.id)},
                {id: 'newbin', label: 'New Bin Inside', action: () => makeBin(row.id)},
                separator('a'),
                {id: 'delete', label: 'Delete Bin', danger: true, action: () => deleteBin(row.id)}
            ];
        }

        if (row.type === 'sequence') {
            return [
                {id: 'open', label: 'Open in Timeline', action: () => activateSequence(row.id)},
                {id: 'rename', label: 'Rename', action: () => setRenamingId(row.id)},
                separator('a'),
                {id: 'delete', label: 'Delete Sequence', danger: true, action: () => deleteSequence(row.id)}
            ];
        }

        const targets = selectedIds.includes(row.id) ? selectedIds : [row.id];
        const items = (document?.media ?? []).filter((item) => targets.includes(item.id));

        return [
            {id: 'source', label: 'Open in Source Monitor', action: () => openInSource(row.id)},
            {id: 'insert', label: 'Insert', hotkey: ',', action: () => placeSourceOnTimeline(row.id, 'insert')},
            {
                id: 'overwrite',
                label: 'Overwrite',
                hotkey: '.',
                action: () => placeSourceOnTimeline(row.id, 'overwrite')
            },
            {id: 'append', label: 'Add to End of Timeline', action: () => appendMediaToTimeline(items)},
            {id: 'seq', label: 'New Sequence From Clip', action: () => createSequenceFromMedia(row.id)},
            separator('a'),
            {id: 'rename', label: 'Rename', hotkey: 'F2', action: () => setRenamingId(row.id)},
            {id: 'relink', label: 'Link Media...', disabled: !offline[row.id], action: () => void relinkMedia(row.id)},
            {
                id: 'reveal',
                label: 'Reveal in Explorer / Finder',
                action: () => window.api.revealInFolder(row.media.path)
            },
            separator('b'),
            {
                id: 'delete',
                label: targets.length > 1 ? `Delete ${targets.length} Items` : 'Delete',
                hotkey: 'Delete',
                danger: true,
                action: () => deleteMedia(targets)
            }
        ];
    }

    function emptyMenu(): ContextMenuItem[] {
        return [
            {id: 'bin', label: 'New Bin', hotkey: 'Mod+B', action: () => makeBin(null)},
            {id: 'sequence', label: 'New Sequence...', action: () => editorStore.set({dialog: 'newSequence'})},
            {id: 'import', label: 'Import...', hotkey: 'Mod+I', action: () => void importWithDialog(null)},
            separator('a'),
            {
                id: 'all',
                label: 'Select All',
                action: () => editorStore.set({selectedMediaIds: (document?.media ?? []).map((item) => item.id)})
            }
        ];
    }

    function handleDrop(event: ReactDragEvent, binId: string | null | undefined) {
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(null);
        setIsDropping(false);

        const dragged = event.dataTransfer.getData(MEDIA_DRAG_TYPE);

        if (dragged && binId !== undefined) {
            moveMediaToBin(JSON.parse(dragged) as string[], binId);
            return;
        }

        const paths = Array.from(event.dataTransfer.files)
            .map((file) => window.api.getPathForFile(file))
            .filter((path) => ALL_MEDIA_EXTENSIONS.includes(path.split('.').pop()?.toLowerCase() ?? ''));

        if (paths.length > 0) {
            void importPaths(paths, binId ?? null);
        }
    }

    function nameCell(row: Row) {
        if (renamingId === row.id) {
            return (
                <input
                    autoFocus
                    defaultValue={row.name}
                    className="w-full rounded border border-accent bg-black/40 px-1 text-[12px] outline-none"
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={(event) => finishRename(row, event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur();
                        }

                        if (event.key === 'Escape') {
                            setRenamingId(null);
                        }
                    }}
                    onClick={(event) => event.stopPropagation()}
                />
            );
        }

        return <span className="truncate">{row.name}</span>;
    }

    const itemCount = (document?.media.length ?? 0) + (document?.sequences.length ?? 0);
    const tile = 72 + zoom * 1.6; // pixels wide, for icon and freeform view
    const mediaRows = rows.filter((row): row is Extract<Row, { type: 'media' }> => row.type === 'media');

    function sortBy(column: SortColumn) {
        setSort((current) => (current.column === column ? {
            column,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
        } : {column, direction: 'asc'}));
    }

    function arrow(column: SortColumn) {
        return sort.column === column ?
            <StellarIcon name="chevronDown" size={11} className={sort.direction === 'asc' ? 'rotate-180' : ''}/> : null;
    }

    function startOf(item: MediaItem): string {
        return item.kind === 'image' ? '' : item.metadata?.['startTimecode'] ?? formatTimecode(0, item.frameRate || 25);
    }

    function iconTile(row: Extract<Row, { type: 'media' }>, style?: CSSProperties) {
        const media = row.media;
        const isSelected = selectedIds.includes(media.id);

        return (
            <div
                key={media.id}
                draggable
                style={{width: tile, ...style}}
                className={`cursor-default rounded-lg p-1.5 ${isSelected ? 'bg-accent/25' : 'hover:bg-surface'}`}
                data-theme="StellarProject.tile"
                onClick={(event) => selectRow(row, event)}
                onDoubleClick={() => openRow(row)}
                onContextMenu={(event) => {
                    if (!selectedIds.includes(media.id)) {
                        editorStore.set({selectedMediaIds: [media.id]});
                    }

                    openContextMenu(event, rowMenu(row));
                }}
                onDragStart={(event) => {
                    event.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(isSelected ? selectedIds : [media.id]));
                    event.dataTransfer.setData('application/x-stellar-origin', JSON.stringify({
                        id: media.id,
                        x: event.clientX,
                        y: event.clientY
                    }));
                }}
                onDragEnd={(event) => {
                    if (view !== 'freeform') {
                        return;
                    }

                    const surface = document_surface();
                    const origin = freeform[media.id] ?? {x: 0, y: 0};

                    if (!surface) {
                        return;
                    }

                    const box = surface.getBoundingClientRect();
                    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;

                    if (inside) {
                        setFreeform((current) => ({
                            ...current,
                            [media.id]: {
                                x: Math.max(0, event.clientX - box.left + surface.scrollLeft - tile / 2),
                                y: Math.max(0, event.clientY - box.top + surface.scrollTop - 30)
                            }
                        }));
                    }

                    void origin;
                }}
            >
                <div
                    className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-black/40">
                    {thumbnails[media.path] ?
                        <img src={thumbnails[media.path]} alt="" className="h-full w-full object-cover"
                             draggable={false}/> : <StellarIcon name={iconFor(media)} size={22} className="text-dim"/>}
                    <span
                        className="absolute bottom-0.5 right-1 rounded bg-black/60 px-1 text-[10px] timecode">{media.kind === 'image' ? 'Still' : formatDuration(media.duration)}</span>
                </div>
                <div
                    className={`mt-1 truncate text-[11px] ${offline[media.id] ? 'text-danger' : ''}`}>{renamingId === media.id ? nameCell(row) : media.name}</div>
            </div>
        );
    }

    function document_surface(): HTMLElement | null {
        return window.document.querySelector<HTMLElement>('[data-freeform-surface]');
    }

    return (
        <div
            className={`flex h-full flex-col ${isDropping ? 'bg-accent/10' : ''}`}
            data-theme="StellarProject.panel"
            onDragOver={(event) => {
                event.preventDefault();
                setIsDropping(true);
            }}
            onDragLeave={() => setIsDropping(false)}
            onDrop={(event) => handleDrop(event, undefined)}
            onContextMenu={(event) => openContextMenu(event, emptyMenu())}
        >
            <div className="flex items-baseline gap-2 border-b border-line px-3 pb-1 pt-2"
                 data-theme="StellarProject.header">
                <span className="truncate text-[13px] font-semibold"
                      title={document?.name}>{document?.name ?? ''}</span>
                <span
                    className="ml-auto shrink-0 text-[11px] text-dim">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            </div>

            <div className="border-b border-line p-2">
                <div className="relative">
                    <StellarIcon name="search" size={13} className="absolute left-2 top-2 text-dim"/>
                    <input className={`${INPUT} py-1 pl-7`} placeholder="Search" value={query}
                           onChange={(event) => setQuery(event.target.value)}/>
                </div>
            </div>

            {view === 'list' ? (
                <div className="flex items-center gap-2 border-b border-line px-3 py-1 text-[11px] text-dim"
                     data-theme="StellarProject.columns">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-ink"
                            onClick={() => sortBy('name')}>Name {arrow('name')}</button>
                    {COLUMNS.map((column) => (
                        <button key={column.id} type="button"
                                className={`flex shrink-0 items-center justify-end gap-1 text-right hover:text-ink ${column.width}`}
                                onClick={() => sortBy(column.id)}>
                            {column.label} {arrow(column.id)}
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto p-1.5"
                 data-freeform-surface={view === 'freeform' ? '' : undefined}
                 style={view === 'freeform' ? {position: 'relative'} : undefined}>
                {rows.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-dim">
                        <StellarIcon name="import" size={28}/>
                        <p className="text-[12px]">Drop media here, or double-click to import.</p>
                    </div>
                ) : view === 'list' ? (
                    rows.map((row) => {
                        const isSelected = row.type === 'media' ? selectedIds.includes(row.id) : row.type === 'bin' ? editorStore.get().selectedBinId === row.id : false;
                        const isOffline = row.type === 'media' && offline[row.id];
                        const isBuilding = row.type === 'media' && sources[row.media.path]?.mode === 'building';
                        const childCount = row.type === 'bin' ? (document?.media.filter((item) => item.binId === row.id).length ?? 0) + (row.name === 'Sequences' ? document?.sequences.length ?? 0 : 0) : 0;

                        return (
                            <div
                                key={`${row.type}-${row.id}`}
                                draggable={row.type === 'media'}
                                data-theme="StellarProject.row"
                                className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-[12px] ${
                                    isSelected ? 'bg-accent/25' : 'hover:bg-surface'
                                } ${dropTarget === row.id ? 'ring-1 ring-accent' : ''} ${isOffline ? 'text-danger' : ''}`}
                                style={{paddingLeft: 8 + row.depth * 16}}
                                onClick={(event) => selectRow(row, event)}
                                onDoubleClick={() => openRow(row)}
                                onContextMenu={(event) => {
                                    if (row.type === 'media' && !selectedIds.includes(row.id)) {
                                        editorStore.set({selectedMediaIds: [row.id]});
                                    }

                                    openContextMenu(event, rowMenu(row));
                                }}
                                onDragStart={(event) => {
                                    const ids = selectedIds.includes(row.id) ? selectedIds : [row.id];

                                    event.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(ids));
                                    event.dataTransfer.effectAllowed = 'copyMove';
                                }}
                                onDragOver={(event) => {
                                    if (row.type === 'bin') {
                                        event.preventDefault();
                                        setDropTarget(row.id);
                                    }
                                }}
                                onDragLeave={() => setDropTarget(null)}
                                onDrop={(event) => (row.type === 'bin' ? handleDrop(event, row.id) : undefined)}
                            >
                                {row.type === 'bin' ? (
                                    <StellarIcon name={expanded.has(row.id) ? 'chevronDown' : 'chevronRight'} size={12}
                                                 className="text-dim"/>
                                ) : null}
                                {row.type === 'bin' ?
                                    <StellarIcon name="folder" size={15} className="text-warning"/> : null}
                                {row.type === 'sequence' ? <StellarIcon name="sequence" size={15}
                                                                        className={row.id === activeSequenceId ? 'text-accent' : 'text-dim'}/> : null}
                                {row.type === 'media' ? <StellarIcon name={iconFor(row.media)} size={15}
                                                                     className={row.media.kind === 'audio' ? 'text-audio-clip' : 'text-video-clip'}/> : null}
                                <div className="min-w-0 flex-1">{nameCell(row)}</div>
                                {row.type === 'bin' ? <span className="text-[11px] text-dim">{childCount}</span> : null}
                                {isBuilding ? <StellarIcon name="clock" size={12} className="text-warning"/> : null}
                                {isOffline ? <StellarIcon name="warning" size={13}/> : null}
                                {row.type === 'media' ? (
                                    <>
                                        <span
                                            className="w-[76px] shrink-0 text-right text-[11px] text-dim">{row.media.hasVideo && row.media.kind === 'video' ? formatFrameRate(row.media.frameRate) : ''}</span>
                                        <span
                                            className="timecode w-[92px] shrink-0 text-right text-[11px] text-dim">{startOf(row.media)}</span>
                                        <span
                                            className="timecode w-[72px] shrink-0 text-right text-[11px] text-dim">{row.media.kind === 'image' ? 'Still' : formatDuration(row.media.duration)}</span>
                                    </>
                                ) : null}
                                {row.type === 'sequence' ? (
                                    <>
                                        <span
                                            className="w-[76px] shrink-0 text-right text-[11px] text-dim">{formatFrameRate(row.sequence.settings.frameRate)}</span>
                                        <span
                                            className="timecode w-[92px] shrink-0 text-right text-[11px] text-dim">{formatTimecode(0, row.sequence.settings.frameRate)}</span>
                                        <span
                                            className="w-[72px] shrink-0 text-right text-[11px] text-dim">{`${row.sequence.settings.width}x${row.sequence.settings.height}`}</span>
                                    </>
                                ) : null}
                            </div>
                        );
                    })
                ) : view === 'icon' ? (
                    <div className="grid gap-2"
                         style={{gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))`}}>
                        {mediaRows.map((row) => iconTile(row, {width: 'auto'}))}
                    </div>
                ) : (
                    <div className="relative min-h-full"
                         style={{height: Math.max(300, Math.ceil(mediaRows.length / 4) * (tile * 0.75 + 40) + 40)}}>
                        {mediaRows.map((row, index) => {
                            const columns = Math.max(1, Math.floor(600 / (tile + 12)));
                            const fallback = {
                                x: 8 + (index % columns) * (tile + 12),
                                y: 8 + Math.floor(index / columns) * (tile * 0.56 + 40)
                            };
                            const position = freeform[row.id] ?? fallback;

                            return iconTile(row, {position: 'absolute', left: position.x, top: position.y});
                        })}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 border-t border-line px-2 py-1.5"
                 data-theme="StellarProject.toolbar">
                {([['list', 'List view', 'list'], ['icon', 'Icon view', 'grid'], ['freeform', 'Freeform view (arrange the clips yourself)', 'expand']] as const).map(([id, title, icon]) => (
                    <button key={id} type="button"
                            className={`${BUTTON_GHOST} ${view === id ? 'bg-surface text-ink' : ''}`} title={title}
                            onClick={() => setView(id)}>
                        <StellarIcon name={icon} size={14}/>
                    </button>
                ))}
                <input
                    type="range" min={0} max={100} value={zoom} className="ml-1 w-[90px]" title="Size of the pictures"
                    disabled={view === 'list'} onChange={(event) => setZoom(Number(event.target.value))}
                />
                <div className="ml-auto flex items-center gap-0.5">
                    <button type="button" className={BUTTON_GHOST} title="Import media"
                            onClick={() => void importWithDialog(null)}><StellarIcon name="import" size={14}/></button>
                    <button type="button" className={BUTTON_GHOST} title="New bin" onClick={() => makeBin(null)}>
                        <StellarIcon name="folderPlus" size={14}/></button>
                    <button type="button" className={BUTTON_GHOST} title="New sequence"
                            onClick={() => editorStore.set({dialog: 'newSequence'})}><StellarIcon name="sequence"
                                                                                                  size={14}/></button>
                    <button
                        type="button" className={BUTTON_GHOST} title="Delete selected"
                        disabled={selectedIds.length === 0}
                        onClick={() => deleteMedia(selectedIds)}
                    >
                        <StellarIcon name="trash" size={14}/>
                    </button>
                </div>
            </div>
        </div>
    );
}
