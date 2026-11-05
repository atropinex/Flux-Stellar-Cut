import {useEffect, useState, type ReactNode} from 'react';
import type {Theme, ThemeList, UpdatableSettings} from '../../../common/CommonInteface';
import {COMMANDS, type CommandCategory} from '../../../common/stellar/StellarCommands';
import {describeCombo, eventToCombo} from '../../../common/utils/StellarKeybindHelper';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {applyTheme} from '../../controller/theme/StellarTheme.Controller';
import {setHotkeysPaused} from '../../controller/keybind/StellarKeybind.Controller';
import StellarDialog from '../common/StellarDialog';
import StellarIcon from '../common/StellarIcon';
import {BUTTON, INPUT, LABEL} from '../common/StellarStyles';
import styles from './StellarSettingsDialog.module.css';

type TabId = 'general' | 'appearance' | 'shortcuts' | 'media';

const TABS: {id: TabId; label: string}[] = [
    {id: 'general', label: 'General'},
    {id: 'appearance', label: 'Appearance'},
    {id: 'shortcuts', label: 'Shortcuts'},
    {id: 'media', label: 'Media'}
];

const isMac = navigator.userAgent.includes('Mac');

async function saveSettings(changes: UpdatableSettings): Promise<void> {
    const settings = await window.api.updateSettings(changes);

    editorStore.set({settings});
}

/** A titled group of rows. Every row inside has the text on the left and its control on the right. */
function Section({title, note, children}: {title: string; note?: string; children: ReactNode}) {
    return (
        <section className={styles.section} data-theme="StellarSettings.section">
            <h3 className={LABEL}>{title}</h3>
            {note ? <p className={styles.textP}>{note}</p> : null}
            <div className={styles.div}>{children}</div>
        </section>
    );
}

function Row({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
    return (
        <div className={styles.row}>
            <div className={styles.box}>
                <div className={styles.text}>{label}</div>
                {hint ? <div className={styles.text2}>{hint}</div> : null}
            </div>
            <div className={styles.box2}>{children}</div>
        </div>
    );
}

function Switch({value, onChange}: {value: boolean; onChange: (value: boolean) => void}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={() => onChange(!value)}
            className={`${styles.button} ${value ? styles.buttonValue : styles.buttonNotValue}`}
        >
            <span className={`${styles.span} ${value ? styles.spanValue : styles.spanNotValue}`} />
        </button>
    );
}

function Toggle({label, hint, value, onChange}: {label: string; hint?: string; value: boolean; onChange: (value: boolean) => void}) {
    return (
        <Row label={label} hint={hint}>
            <Switch value={value} onChange={onChange} />
        </Row>
    );
}

function NumberField({label, hint, value, min, max, onChange}: {label: string; hint?: string; value: number; min: number; max: number; onChange: (value: number) => void}) {
    return (
        <Row label={label} hint={hint}>
            <input type="number" className={`${styles.textInput} ${INPUT}`} value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} />
        </Row>
    );
}

function GeneralTab() {
    const settings = useStore(editorStore, (state) => state.settings);

    return (
        <div>
            <Section title="Auto-save" note="Copies go to the 'Auto-Save' folder next to your project. Your project file is not changed.">
                <Toggle label="Save a backup copy automatically" value={settings.autosaveEnabled} onChange={(value) => void saveSettings({autosaveEnabled: value})} />
                <NumberField label="Save every (minutes)" value={settings.autosaveIntervalMinutes} min={1} max={60} onChange={(value) => void saveSettings({autosaveIntervalMinutes: value})} />
                <NumberField label="Keep this many copies" value={settings.autosaveMaxVersions} min={1} max={100} onChange={(value) => void saveSettings({autosaveMaxVersions: value})} />
            </Section>
            <Section title="Editing">
                <NumberField label="Still image length (seconds)" value={settings.stillDurationSeconds} min={1} max={60} onChange={(value) => void saveSettings({stillDurationSeconds: value})} />
                <Toggle label="Snap to clips, markers and the playhead" value={settings.snapping} onChange={(value) => {
                    editorStore.set({snapping: value});
                    void saveSettings({snapping: value});
                }} />
                <Toggle label="Linked selection" hint="Select a video clip and its sound together." value={settings.linkedSelection} onChange={(value) => {
                    editorStore.set({linkedSelection: value});
                    void saveSettings({linkedSelection: value});
                }} />
            </Section>
            <Section title="Audio" note="The mixer uses Web Audio for track faders, pan and the meters. Turn it off if you hear crackling; the sound then plays without them.">
                <Toggle label="Use the audio mixer in the preview" value={settings.webAudio} onChange={(value) => void saveSettings({webAudio: value})} />
            </Section>
        </div>
    );
}

function MediaTab() {
    const settings = useStore(editorStore, (state) => state.settings);

    return (
        <div>
            <Section
                title="Playback copies"
                note="Some files (MKV, AVI, ProRes, HEVC...) cannot be played smoothly by the preview. Flux-Stellar-Cut can make a light copy for the preview. Your original files and your export are never affected."
            >
                <Toggle label="Make playback copies automatically" value={settings.autoProxy} onChange={(value) => void saveSettings({autoProxy: value})} />
                <NumberField label="Copy height (pixels)" value={settings.proxyHeight} min={240} max={1080} onChange={(value) => void saveSettings({proxyHeight: value})} />
            </Section>
        </div>
    );
}

function AppearanceTab() {
    const current = useStore(editorStore, (state) => state.theme);
    const [list, setList] = useState<ThemeList | null>(null);

    async function reload() {
        const result = await window.api.listThemes();

        setList(result);

        // A theme file that was edited shows its changes right away.
        const updated = result.themes.find((theme) => theme.id === editorStore.get().theme?.id);

        if (updated) {
            applyTheme(updated);
        }
    }

    useEffect(() => {
        void reload();
    }, []);

    async function choose(theme: Theme) {
        const applied = await window.api.selectTheme(theme.id);

        applyTheme(applied);
    }

    return (
        <div>
            <div className={styles.row2}>
                <h3 className={`${styles.h3} ${LABEL}`}>Themes (YAML files)</h3>
                <button type="button" className={BUTTON} onClick={() => void reload()}><StellarIcon name="redo" size={13} /> Reload</button>
                <button type="button" className={BUTTON} onClick={() => window.api.openThemesFolder()}><StellarIcon name="folder" size={13} /> Open Folder</button>
            </div>
            <div className={styles.grid}>
                {(list?.themes ?? []).map((theme) => (
                    <button
                        key={theme.id}
                        type="button"
                        onClick={() => void choose(theme)}
                        className={`${styles.textButton} ${current?.id === theme.id ? styles.buttonId : styles.buttonNotId}`}
                    >
                        <div className={styles.div2} style={{background: theme.base}}>
                            {theme.layers.map((layer, index) => (
                                <div key={index} className={styles.overlay} style={{backgroundImage: layer.type === 'image' ? `url("${layer.value}")` : layer.value, backgroundSize: 'cover', opacity: layer.opacity}} />
                            ))}
                            <div className={styles.overlay2} style={{background: theme.glass.island, borderColor: theme.glass.border}}>
                                <div className={styles.div3} style={{background: theme.colors.accent ?? '#7c9cff'}} />
                            </div>
                        </div>
                        <div className={styles.row3}>
                            <span className={styles.textSpan}>{theme.name}</span>
                            {current?.id === theme.id ? <StellarIcon name="check" size={14} className={styles.textStellarIcon} /> : null}
                        </div>
                    </button>
                ))}
            </div>
            {list && list.errors.length > 0 ? (
                <div className={styles.text3}>
                    <p className={styles.textP2}>Some theme files have problems:</p>
                    {list.errors.map((error) => <p key={error}>{error}</p>)}
                </div>
            ) : null}
            <p className={styles.textP3}>Copy a .yaml file in the themes folder to make your own, edit it, then press Reload. The "overrides" section can restyle any panel by its data-theme name.</p>
        </div>
    );
}

function ShortcutsTab() {
    const keybinds = useStore(editorStore, (state) => state.keybinds);
    const [query, setQuery] = useState('');
    const [recording, setRecording] = useState<string | null>(null);

    useEffect(() => {
        if (!recording) {
            return;
        }

        setHotkeysPaused(true);

        const handleKey = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                setRecording(null);
                return;
            }

            const combo = eventToCombo(event);

            if (!combo) {
                return; // only a modifier so far
            }

            setRecording(null);
            void window.api.setKeybind(recording, combo).then((next) => editorStore.set({keybinds: next}));
        };

        window.addEventListener('keydown', handleKey, true);

        return () => {
            window.removeEventListener('keydown', handleKey, true);
            setHotkeysPaused(false);
        };
    }, [recording]);

    const search = query.trim().toLowerCase();
    const categories = [...new Set(COMMANDS.map((command) => command.category))] as CommandCategory[];

    function clearKey(commandId: string) {
        void window.api.setKeybind(commandId, null).then((next) => editorStore.set({keybinds: next}));
    }

    const rows: ReactNode[] = [];

    for (const category of categories) {
        const commands = COMMANDS.filter((command) => command.category === category && (!search || command.label.toLowerCase().includes(search)));

        if (commands.length === 0) {
            continue;
        }

        rows.push(<h3 key={category} className={`${styles.h32} ${LABEL}`}>{category}</h3>);

        for (const command of commands) {
            const combo = keybinds[command.id] ?? '';
            const isRecording = recording === command.id;

            rows.push(
                <div key={command.id} className={styles.row4}>
                    <span className={styles.textSpan2}>{command.label}</span>
                    <button
                        type="button"
                        onClick={() => setRecording(isRecording ? null : command.id)}
                        className={`${styles.textButton2} ${isRecording ? styles.textButtonIsRecording : styles.buttonNotIsRecording}`}
                    >
                        {isRecording ? 'Press keys...' : describeCombo(combo, isMac)}
                    </button>
                    <button type="button" title="Remove hotkey" disabled={!combo} className={styles.textButton3} onClick={() => clearKey(command.id)}>
                        <StellarIcon name="close" size={12} />
                    </button>
                </div>
            );
        }
    }

    return (
        <div>
            <div className={styles.row2}>
                <input className={INPUT} placeholder="Search commands" value={query} onChange={(event) => setQuery(event.target.value)} />
                <button type="button" className={BUTTON} onClick={() => void window.api.resetKeybinds().then((next) => editorStore.set({keybinds: next}))}>Reset All</button>
                <button type="button" className={BUTTON} onClick={() => window.api.openKeybindsFile()}>Open YAML</button>
            </div>
            <p className={styles.textP4}>Click a hotkey, then press the new keys. If another command already uses them, it loses them.</p>
            {rows}
        </div>
    );
}

export default function StellarSettingsDialog() {
    const [tab, setTab] = useState<TabId>('general');

    return (
        <StellarDialog title="Settings" width={760} onClose={() => editorStore.set({dialog: null})}>
            <div className={styles.row5}>
                <nav className={styles.columnNav}>
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`${styles.textButton4} ${tab === item.id ? styles.textButtonId : styles.textButtonNotId}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className={styles.content} data-theme="StellarSettings.content">
                    {tab === 'general' ? <GeneralTab /> : null}
                    {tab === 'appearance' ? <AppearanceTab /> : null}
                    {tab === 'shortcuts' ? <ShortcutsTab /> : null}
                    {tab === 'media' ? <MediaTab /> : null}
                </div>
            </div>
        </StellarDialog>
    );
}
