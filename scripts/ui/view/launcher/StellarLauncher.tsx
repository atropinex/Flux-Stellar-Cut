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
import styles from './StellarLauncher.module.css';

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
            {id: 'reveal', label: 'Show in Folder', disabled: !project.exists, action: () => window.api.revealInFolder(project.path)},
            {id: 'copy', label: 'Copy Path', action: () => void navigator.clipboard.writeText(project.path)},
            separator('s1'),
            {id: 'remove', label: 'Remove from List', danger: true, action: () => void window.api.removeRecentProject(project.path).then(setProjects)}
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
            className={styles.column}
            onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            <StellarBackground />

            <div className={`${styles.row} drag-region`}>
                <span className={styles.textSpan}>FLUX-STELLAR-CUT</span>
                <StellarWindowControls />
            </div>

            <div className={styles.row2}>
                {/* Sidebar */}
                <aside className={`${styles.sidebar} glass`} data-theme="StellarLauncher.sidebar">
                    <div className={styles.div}>
                        <div className={styles.row3}>
                            <StellarIcon name="sparkle" size={24} filled />
                        </div>
                        <h1 className={styles.textH1}>Flux-Stellar-Cut</h1>
                        <p className={styles.textP}>Cut, color and finish your story.</p>
                    </div>
                    <button type="button" className={`${styles.button} ${BUTTON_PRIMARY}`} onClick={() => setShowNew(true)}>
                        <StellarIcon name="plus" size={15} /> New Project
                    </button>
                    <button type="button" className={`${styles.button} ${BUTTON}`} onClick={() => void browse()}>
                        <StellarIcon name="folder" size={15} /> Open Project
                    </button>
                    <p className={styles.textP2}>
                        Tip: drop a <span className={styles.textSpan2}>.{PROJECT_EXTENSION}</span> file anywhere on this window to open it.
                    </p>
                </aside>

                {/* Recent projects */}
                <main className={`${styles.recent} glass`} data-theme="StellarLauncher.recent">
                    <div className={styles.row4}>
                        <h2 className={styles.textH2}>Recent projects</h2>
                        <div className={styles.div2}>
                            <StellarIcon name="search" size={14} className={styles.textStellarIcon} />
                            <input className={`${styles.input} ${INPUT}`} placeholder="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} />
                        </div>
                        <select className={`${styles.boxSelect} ${INPUT}`} value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                            <option value="recent">Last opened</option>
                            <option value="name">Name</option>
                        </select>
                    </div>

                    <div className={styles.div3}>
                        {visible.length === 0 ? (
                            <div className={styles.column2}>
                                <StellarIcon name="film" size={36} />
                                <p className={styles.textP3}>{projects.length === 0 ? 'No projects yet. Create your first one.' : 'No project matches your search.'}</p>
                            </div>
                        ) : (
                            <div className={styles.grid}>
                                {visible.map((project) => (
                                    <button
                                        key={project.path}
                                        type="button"
                                        disabled={!project.exists}
                                        data-theme="StellarLauncher.card"
                                        className={`${styles.card} group`}
                                        onDoubleClick={() => void open(project.path)}
                                        onContextMenu={(event) => showMenu(event, project)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                void open(project.path);
                                            }
                                        }}
                                    >
                                        <div className={styles.row5} style={{background: cardGradient(project.name)}}>
                                            <StellarIcon name="film" size={30} className={styles.textStellarIcon2} />
                                        </div>
                                        <div className={styles.div4}>
                                            <div className={styles.text}>{project.name}</div>
                                            <div className={styles.text2}>{project.exists ? project.path : 'File not found'}</div>
                                            <div className={styles.text3}>{timeAgo(project.openedAt)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {message ? <p className={styles.textP4}>{message}</p> : null}
                </main>
            </div>

            {isDragging ? (
                <div className={styles.overlay}>
                    Drop a project to open it
                </div>
            ) : null}

            {showNew ? <StellarNewProjectDialog onClose={() => setShowNew(false)} onCreate={(path) => void open(path)} /> : null}
            <StellarContextMenu />
        </div>
    );
}
