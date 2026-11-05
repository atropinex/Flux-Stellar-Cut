import {useEffect, useRef, useState, type ReactNode} from 'react';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {startEditorSession} from '../../controller/project/StellarSession.Controller';
import {layoutOf, setLayoutValue} from '../../controller/command/StellarWorkspace.Controller';
import StellarSpeedDialog from '../speed/StellarSpeedDialog';
import StellarBackground from '../common/StellarBackground';
import StellarContextMenu from '../common/StellarContextMenu';
import StellarIsland from '../common/StellarIsland';
import StellarSplitter from '../common/StellarSplitter';
import StellarToast from '../common/StellarToast';
import StellarTitleBar from '../titlebar/StellarTitleBar';
import StellarProjectPanel from '../projectpanel/StellarProjectPanel';
import StellarSourceMonitor from '../monitor/StellarSourceMonitor';
import StellarProgramMonitor from '../monitor/StellarProgramMonitor';
import StellarTimelinePanel from '../timeline/StellarTimelinePanel';
import StellarEffectsPanel from '../effects/StellarEffectsPanel';
import StellarEffectControlsPanel from '../effects/StellarEffectControlsPanel';
import StellarToolsPanel from '../tools/StellarToolsPanel';
import StellarHistoryPanel from '../history/StellarHistoryPanel';
import StellarLumetriPanel from '../color/StellarLumetriPanel';
import StellarTextPanel from '../text/StellarTextPanel';
import StellarAudioMixerPanel from '../mixer/StellarAudioMixerPanel';
import StellarInfoPanel from '../info/StellarInfoPanel';
import StellarMarkersPanel from '../markers/StellarMarkersPanel';
import StellarMediaBrowser from '../projectpanel/StellarMediaBrowser';
import StellarExportDialog from '../export/StellarExportDialog';
import StellarSettingsDialog from '../settings/StellarSettingsDialog';
import StellarNewSequenceDialog from '../settings/StellarNewSequenceDialog';
import StellarStatusBar from './StellarStatusBar';
import styles from './StellarEditor.module.css';

const LEFT_TABS = [
    {id: 'source', label: 'Source'},
    {id: 'effectControls', label: 'Effect Controls'},
    {id: 'lumetri', label: 'Lumetri Color'},
    {id: 'text', label: 'Text'},
    {id: 'mixer', label: 'Audio Clip Mixer'}
];

const PROJECT_TABS = [
    {id: 'project', label: 'Project'},
    {id: 'browser', label: 'Media Browser'},
    {id: 'info', label: 'Info'},
    {id: 'effects', label: 'Effects'},
    {id: 'markers', label: 'Markers'}
];

interface EditorProps {
    projectPath: string;
}

/** The editing window: a row of monitors above, and the project, tools and timeline below. */
export default function StellarEditor({projectPath}: EditorProps) {
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [leftTab, setLeftTab] = useState('source');
    const [rightTab, setRightTab] = useState('effects');
    const projectTab = useStore(editorStore, (state) => (PROJECT_TABS.some((tab) => tab.id === state.settings.projectTab) ? state.settings.projectTab : 'project'));
    const workspace = useStore(editorStore, (state) => state.workspace);
    const layoutOverride = useStore(editorStore, (state) => state.layout);
    const maximizedPanel = useStore(editorStore, (state) => state.maximizedPanel);
    const dialog = useStore(editorStore, (state) => state.dialog);
    const bodyRef = useRef<HTMLDivElement>(null);
    const topRowRef = useRef<HTMLDivElement>(null);
    const bottomRowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let stop: (() => void) | null = null;
        let cancelled = false;

        void startEditorSession(projectPath).then((session) => {
            if (cancelled) {
                session.stop();
                return;
            }

            stop = session.stop;
            setReady(session.ok);
            setFailed(!session.ok);
        });

        return () => {
            cancelled = true;
            stop?.();
        };
    }, [projectPath]);

    // Double-clicking a clip in the project panel opens the Source tab.
    useEffect(() => {
        const showSource = () => setLeftTab('source');

        window.addEventListener('stellar:show-source', showSource);

        return () => window.removeEventListener('stellar:show-source', showSource);
    }, []);

    // "Show Lumetri Color" and the other Window menu items arrive here as events.
    useEffect(() => {
        const showPanel = (event: Event) => {
            const id = String((event as CustomEvent).detail);

            if (LEFT_TABS.some((tab) => tab.id === id)) {
                setLeftTab(id);
            } else if (PROJECT_TABS.some((tab) => tab.id === id)) {
                editorStore.set({settings: {...editorStore.get().settings, projectTab: id}});
                void window.api.updateSettings({projectTab: id});
            }
        };

        window.addEventListener('stellar:show-panel', showPanel);

        return () => window.removeEventListener('stellar:show-panel', showPanel);
    }, []);

    // Hovering a panel is how the "maximize panel" hotkey knows which one you mean.
    useEffect(() => {
        const leave = () => editorStore.set({hoveredPanel: null});

        document.body.addEventListener('pointerleave', leave);

        return () => document.body.removeEventListener('pointerleave', leave);
    }, []);

    const layout = layoutOf(layoutOverride, workspace);

    const panels: Record<string, ReactNode> = {
        leftTabs: (
            <StellarIsland
                panelId={leftTab}
                tabs={LEFT_TABS}
                activeTab={leftTab}
                onTabChange={setLeftTab}
                className={styles.boxStellarIsland}
            >
                {leftTab === 'source' ? <StellarSourceMonitor /> : null}
                {leftTab === 'effectControls' ? <StellarEffectControlsPanel /> : null}
                {leftTab === 'lumetri' ? <StellarLumetriPanel /> : null}
                {leftTab === 'text' ? <StellarTextPanel /> : null}
                {leftTab === 'mixer' ? <StellarAudioMixerPanel /> : null}
            </StellarIsland>
        ),
        program: (
            <StellarIsland panelId="program" title="Program" className={styles.boxStellarIsland}>
                <StellarProgramMonitor />
            </StellarIsland>
        ),
        rightTabs: (
            <StellarIsland
                panelId={rightTab}
                tabs={[{id: 'effects', label: 'Effects'}, {id: 'history', label: 'History'}]}
                activeTab={rightTab}
                onTabChange={setRightTab}
                className={styles.boxStellarIsland}
            >
                {rightTab === 'effects' ? <StellarEffectsPanel /> : <StellarHistoryPanel />}
            </StellarIsland>
        ),
        project: (
            <StellarIsland
                panelId={projectTab}
                tabs={PROJECT_TABS}
                activeTab={projectTab}
                onTabChange={(tab) => {
                    editorStore.set({settings: {...editorStore.get().settings, projectTab: tab}});
                    void window.api.updateSettings({projectTab: tab});
                }}
                className={styles.boxStellarIsland}
            >
                {projectTab === 'project' ? <StellarProjectPanel /> : null}
                {projectTab === 'browser' ? <StellarMediaBrowser /> : null}
                {projectTab === 'info' ? <StellarInfoPanel /> : null}
                {projectTab === 'effects' ? <StellarEffectsPanel /> : null}
                {projectTab === 'markers' ? <StellarMarkersPanel /> : null}
            </StellarIsland>
        ),
        tools: (
            <StellarIsland panelId="tools" title="" className={styles.boxStellarIsland2}>
                <StellarToolsPanel />
            </StellarIsland>
        ),
        timeline: (
            <StellarIsland panelId="timeline" title="Timeline" className={styles.boxStellarIsland} bodyClassName={styles.stellarIsland}>
                <StellarTimelinePanel />
            </StellarIsland>
        )
    };

    // The maximize hotkey shows one panel on its own.
    const maximizedKey = maximizedPanel
        ? ({
            source: 'leftTabs', effectControls: 'leftTabs', lumetri: 'leftTabs', text: 'leftTabs', mixer: 'leftTabs', program: 'program',
            history: 'rightTabs', project: 'project', browser: 'project', info: 'project', markers: 'project', tools: 'tools', timeline: 'timeline'
        } as Record<string, string>)[maximizedPanel] ?? (maximizedPanel === 'effects' ? (projectTab === 'effects' ? 'project' : 'rightTabs') : null)
        : null;

    return (
        <div className={styles.column}>
            <StellarBackground />
            <StellarTitleBar />

            <div ref={bodyRef} className={styles.column2}>
                {!ready ? (
                    <div className={styles.row}>{failed ? 'The project could not be opened.' : 'Opening project...'}</div>
                ) : maximizedKey ? (
                    <div className={styles.div}>{panels[maximizedKey]}</div>
                ) : (
                    <>
                        <div ref={topRowRef} className={styles.row2} style={{flexBasis: `${layout.top * 100}%`, flexGrow: 0, flexShrink: 0}}>
                            <div style={{width: `${layout.left * 100}%`}} className={styles.box}>{panels.leftTabs}</div>
                            <StellarSplitter axis="x" containerRef={topRowRef} onChange={(value) => setLayoutValue('left', value)} min={0.15} max={0.5} />
                            <div className={styles.box2}>{panels.program}</div>
                            <StellarSplitter axis="x" containerRef={topRowRef} fromEnd onChange={(value) => setLayoutValue('right', value)} min={0.1} max={0.4} />
                            <div style={{width: `${layout.right * 100}%`}} className={styles.box}>{panels.rightTabs}</div>
                        </div>

                        <StellarSplitter axis="y" containerRef={bodyRef} onChange={(value) => setLayoutValue('top', value)} min={0.2} max={0.75} />

                        <div ref={bottomRowRef} className={styles.row3}>
                            <div style={{width: `${layout.project * 100}%`}} className={styles.box}>{panels.project}</div>
                            <StellarSplitter axis="x" containerRef={bottomRowRef} onChange={(value) => setLayoutValue('project', value)} min={0.12} max={0.6} />
                            {panels.tools}
                            <div className={styles.box3} />
                            <div className={styles.box2}>{panels.timeline}</div>
                        </div>
                    </>
                )}
            </div>

            <StellarStatusBar />

            {ready && dialog === 'export' ? <StellarExportDialog /> : null}
            {ready && dialog === 'settings' ? <StellarSettingsDialog /> : null}
            {ready && dialog === 'speed' ? <StellarSpeedDialog /> : null}
            {ready && dialog === 'newSequence' ? <StellarNewSequenceDialog /> : null}
            <StellarContextMenu />
            <StellarToast />
        </div>
    );
}
