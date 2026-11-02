import {useCallback, useEffect, useMemo, useState} from 'react';
import type {RecentProject} from '../../../common/stellar/StellarContract';
import {PROJECT_EXTENSION} from '../../../common/stellar/StellarConfig';
import {openContextMenu, separator} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarBackground from '../common/StellarBackground';
import StellarIcon from '../common/StellarIcon';
import StellarWindowControls from '../common/StellarWindowControls';
import StellarContextMenu from '../common/StellarContextMenu';
import {BUTTON, BUTTON_PRIMARY, INPUT} from '../common/StellarStyles';
import StellarNewProjectDialog from './StellarNewProjectDialog';

type SortMode = 'recent' | 'name';

/** A color for a project card, made from its name, so every project looks a little different. */
function cardGradient(name: string): string {
    let hash = 0;

    for (const character of name) {
        hash = (hash * 31 + character.charCodeAt(0)) % 360;
    }

    return `linear-gradient(135deg, hsl(${hash} 70% 45% / 0.9), hsl(${(hash + 50) % 360} 70% 30% / 0.9))`;
}

function timeAgo(iso: string): string {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

    if (minutes < 1) {
        return 'Just now';
    }

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    if (minutes < 60 * 24) {
        return `${Math.round(minutes / 60)} h ago`;
    }

    return new Date(iso).toLocaleDateString();
}

/** The project view: new, open and recent projects. */
export default function StellarLauncher() {
    const [projects, setProjects] = useState<RecentProject[]>([]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortMode>('recent');
    const [showNew, setShowNew] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setProjects(await window.api.listRecentProjects());
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const visible = useMemo(() => {
        const filtered = projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase()) || project.path.toLowerCase().includes(query.toLowerCase()));

        return sort === 'name' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered;
    }, [projects, query, sort]);

    async function open(path: string) {
        try {
            await window.api.openProjectInEditor(path);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        }
    }

    async function browse() {
        const path = await window.api.browseProject();

        if (path) {
            await open(path);
        }
    }

    function showMenu(event: React.MouseEvent, project: RecentProject) {
        openContextMenu(event, [
            {id: 'open', label: 'Open', disabled: !project.exists, action: () => void open(project.path)},
            {
                id: 'reveal',
                label: 'Show in Folder',
                disabled: !project.exists,
                action: () => window.api.revealInFolder(project.path)
            },
            {id: 'copy', label: 'Copy Path', action: () => void navigator.clipboard.writeText(project.path)},
            separator('s1'),
            {
                id: 'remove',
                label: 'Remove from List',
                danger: true,
                action: () => void window.api.removeRecentProject(project.path).then(setProjects)
            }
        ]);
    }

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setIsDragging(false);

        const file = Array.from(event.dataTransfer.files).find((item) => item.name.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`));

        if (file) {
            void open(window.api.getPathForFile(file));
        } else {
            setMessage(`Drop a .${PROJECT_EXTENSION} project file to open it.`);
        }
    }

    return (
        <div
            className="relative flex h-full flex-col"
            onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            <StellarBackground/>

            <div className="drag-region relative z-10 flex h-9 shrink-0 items-center justify-between pl-4">
                <span className="text-[12px] font-semibold tracking-wide text-dim">FLUX-STELLAR-CUT</span>
                <StellarWindowControls/>
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 gap-(--sc-gap) p-(--sc-gap) pt-0">
                {/* Sidebar */}
                <aside className="glass flex w-64 shrink-0 flex-col gap-3 p-5" data-theme="StellarLauncher.sidebar">
                    <div className="mb-4">
                        <div
                            className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-ink">
                            <StellarIcon name="sparkle" size={24} filled/>
                        </div>
                        <h1 className="text-[18px] font-semibold leading-tight">Flux-Stellar-Cut</h1>
                        <p className="mt-1 text-[12px] text-dim">Cut, color and finish your story.</p>
                    </div>
                    <button type="button" className={`${BUTTON_PRIMARY} justify-start py-2.5`}
                            onClick={() => setShowNew(true)}>
                        <StellarIcon name="plus" size={15}/> New Project
                    </button>
                    <button type="button" className={`${BUTTON} justify-start py-2.5`} onClick={() => void browse()}>
                        <StellarIcon name="folder" size={15}/> Open Project
                    </button>
                    <p className="mt-auto text-[11px] leading-relaxed text-dim">
                        Tip: drop a <span className="text-ink">.{PROJECT_EXTENSION}</span> file anywhere on this window
                        to open it.
                    </p>
                </aside>

                {/* Recent projects */}
                <main className="glass flex min-w-0 flex-1 flex-col" data-theme="StellarLauncher.recent">
                    <div className="flex items-center gap-3 p-5 pb-3">
                        <h2 className="shrink-0 whitespace-nowrap text-[15px] font-semibold">Recent projects</h2>
                        <div className="relative ml-auto w-64">
                            <StellarIcon name="search" size={14} className="absolute left-2.5 top-2 text-dim"/>
                            <input className={`${INPUT} pl-8`} placeholder="Search projects" value={query}
                                   onChange={(event) => setQuery(event.target.value)}/>
                        </div>
                        <select className={`${INPUT} w-36`} value={sort}
                                onChange={(event) => setSort(event.target.value as SortMode)}>
                            <option value="recent">Last opened</option>
                            <option value="name">Name</option>
                        </select>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto p-5 pt-2">
                        {visible.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
                                <StellarIcon name="film" size={36}/>
                                <p className="text-[13px]">{projects.length === 0 ? 'No projects yet. Create your first one.' : 'No project matches your search.'}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                                {visible.map((project) => (
                                    <button
                                        key={project.path}
                                        type="button"
                                        disabled={!project.exists}
                                        data-theme="StellarLauncher.card"
                                        className="group overflow-hidden rounded-xl border border-line bg-surface text-left transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-hover disabled:opacity-50"
                                        onDoubleClick={() => void open(project.path)}
                                        onContextMenu={(event) => showMenu(event, project)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                void open(project.path);
                                            }
                                        }}
                                    >
                                        <div className="flex h-28 items-center justify-center"
                                             style={{background: cardGradient(project.name)}}>
                                            <StellarIcon name="film" size={30} className="text-ink/70"/>
                                        </div>
                                        <div className="p-3">
                                            <div className="truncate text-[13px] font-medium">{project.name}</div>
                                            <div
                                                className="mt-0.5 truncate text-[11px] text-dim">{project.exists ? project.path : 'File not found'}</div>
                                            <div className="mt-2 text-[11px] text-dim">{timeAgo(project.openedAt)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {message ?
                        <p className="mx-5 mb-4 rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger">{message}</p> : null}
                </main>
            </div>

            {isDragging ? (
                <div
                    className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-[15px] font-medium">
                    Drop a project to open it
                </div>
            ) : null}

            {showNew ? <StellarNewProjectDialog onClose={() => setShowNew(false)}
                                                onCreate={(path) => void open(path)}/> : null}
            <StellarContextMenu/>
        </div>
    );
}
