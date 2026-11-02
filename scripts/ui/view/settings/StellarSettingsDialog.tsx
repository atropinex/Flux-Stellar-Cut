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

type TabId = 'general' | 'appearance' | 'shortcuts' | 'media';

const TABS: { id: TabId; label: string }[] = [
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
function Section({title, note, children}: { title: string; note?: string; children: ReactNode }) {
    return (
        <section className="mb-5" data-theme="StellarSettings.section">
            <h3 className={LABEL}>{title}</h3>
            {note ? <p className="mb-2 text-[11.5px] leading-snug text-dim">{note}</p> : null}
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-deep">{children}</div>
        </section>
    );
}

function Row({label, hint, children}: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div className="flex min-h-11 items-center gap-4 px-3.5 py-2">
            <div className="min-w-0 flex-1">
                <div className="text-[13px] text-ink">{label}</div>
                {hint ? <div className="mt-0.5 text-[11.5px] leading-snug text-dim">{hint}</div> : null}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function Switch({value, onChange}: { value: boolean; onChange: (value: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={() => onChange(!value)}
            className={`relative h-5 w-9 rounded-full border border-line transition-colors ${value ? 'bg-accent' : 'bg-surface-hover'}`}
        >
            <span
                className={`absolute top-0.5 size-3.5 rounded-full transition-all ${value ? 'left-[18px] bg-accent-ink' : 'left-0.5 bg-dim'}`}/>
        </button>
    );
}

function Toggle({label, hint, value, onChange}: {
    label: string;
    hint?: string;
    value: boolean;
    onChange: (value: boolean) => void
}) {
    return (
        <Row label={label} hint={hint}>
            <Switch value={value} onChange={onChange}/>
        </Row>
    );
}

function NumberField({label, hint, value, min, max, onChange}: {
    label: string;
    hint?: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void
}) {
    return (
        <Row label={label} hint={hint}>
            <input type="number"
                   className={`${INPUT} w-24 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
                   value={value} min={min} max={max}
                   onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}/>
        </Row>
    );
}

function GeneralTab() {
    const settings = useStore(editorStore, (state) => state.settings);

    return (
        <div>
            <Section title="Auto-save"
                     note="Copies go to the 'Auto-Save' folder next to your project. Your project file is not changed.">
                <Toggle label="Save a backup copy automatically" value={settings.autosaveEnabled}
                        onChange={(value) => void saveSettings({autosaveEnabled: value})}/>
                <NumberField label="Save every (minutes)" value={settings.autosaveIntervalMinutes} min={1} max={60}
                             onChange={(value) => void saveSettings({autosaveIntervalMinutes: value})}/>
                <NumberField label="Keep this many copies" value={settings.autosaveMaxVersions} min={1} max={100}
                             onChange={(value) => void saveSettings({autosaveMaxVersions: value})}/>
            </Section>
            <Section title="Editing">
                <NumberField label="Still image length (seconds)" value={settings.stillDurationSeconds} min={1} max={60}
                             onChange={(value) => void saveSettings({stillDurationSeconds: value})}/>
                <Toggle label="Snap to clips, markers and the playhead" value={settings.snapping} onChange={(value) => {
                    editorStore.set({snapping: value});
                    void saveSettings({snapping: value});
                }}/>
                <Toggle label="Linked selection" hint="Select a video clip and its sound together."
                        value={settings.linkedSelection} onChange={(value) => {
                    editorStore.set({linkedSelection: value});
                    void saveSettings({linkedSelection: value});
                }}/>
            </Section>
            <Section title="Audio"
                     note="The mixer uses Web Audio for track faders, pan and the meters. Turn it off if you hear crackling; the sound then plays without them.">
                <Toggle label="Use the audio mixer in the preview" value={settings.webAudio}
                        onChange={(value) => void saveSettings({webAudio: value})}/>
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
                <Toggle label="Make playback copies automatically" value={settings.autoProxy}
                        onChange={(value) => void saveSettings({autoProxy: value})}/>
                <NumberField label="Copy height (pixels)" value={settings.proxyHeight} min={240} max={1080}
                             onChange={(value) => void saveSettings({proxyHeight: value})}/>
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
            <div className="mb-3 flex items-center gap-2">
                <h3 className={`${LABEL} mb-0 flex-1`}>Themes (YAML files)</h3>
                <button type="button" className={BUTTON} onClick={() => void reload()}><StellarIcon name="redo"
                                                                                                    size={13}/> Reload
                </button>
                <button type="button" className={BUTTON} onClick={() => window.api.openThemesFolder()}><StellarIcon
                    name="folder" size={13}/> Open Folder
                </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {(list?.themes ?? []).map((theme) => (
                    <button
                        key={theme.id}
                        type="button"
                        onClick={() => void choose(theme)}
                        className={`overflow-hidden rounded-xl border text-left transition-colors ${current?.id === theme.id ? 'border-accent' : 'border-line hover:border-ink/30'}`}
                    >
                        <div className="relative h-16" style={{background: theme.base}}>
                            {theme.layers.map((layer, index) => (
                                <div key={index} className="absolute inset-0" style={{
                                    backgroundImage: layer.type === 'image' ? `url("${layer.value}")` : layer.value,
                                    backgroundSize: 'cover',
                                    opacity: layer.opacity
                                }}/>
                            ))}
                            <div className="absolute inset-3 rounded-lg border"
                                 style={{background: theme.glass.island, borderColor: theme.glass.border}}>
                                <div className="m-2 h-1.5 w-10 rounded-full"
                                     style={{background: theme.colors.accent ?? '#7c9cff'}}/>
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                            <span className="font-medium">{theme.name}</span>
                            {current?.id === theme.id ?
                                <StellarIcon name="check" size={14} className="text-accent"/> : null}
                        </div>
                    </button>
                ))}
            </div>
            {list && list.errors.length > 0 ? (
                <div className="mt-3 rounded-lg bg-danger/15 p-3 text-[12px] text-danger">
                    <p className="mb-1 font-medium">Some theme files have problems:</p>
                    {list.errors.map((error) => <p key={error}>{error}</p>)}
                </div>
            ) : null}
            <p className="mt-3 text-[11px] text-dim">Copy a .yaml file in the themes folder to make your own, edit it,
                then press Reload. The "overrides" section can restyle any panel by its data-theme name.</p>
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

        rows.push(<h3 key={category} className={`${LABEL} mt-4 first:mt-0`}>{category}</h3>);

        for (const command of commands) {
            const combo = keybinds[command.id] ?? '';
            const isRecording = recording === command.id;

            rows.push(
                <div key={command.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface">
                    <span className="flex-1 text-[13px]">{command.label}</span>
                    <button
                        type="button"
                        onClick={() => setRecording(isRecording ? null : command.id)}
                        className={`w-40 shrink-0 rounded-md border px-2.5 py-1 text-center text-[12px] ${isRecording ? 'border-accent bg-accent/20 text-accent' : 'border-line bg-deep hover:border-ink/30'}`}
                    >
                        {isRecording ? 'Press keys...' : describeCombo(combo, isMac)}
                    </button>
                    <button type="button" title="Remove hotkey" disabled={!combo}
                            className="rounded p-1 text-dim hover:text-danger disabled:opacity-30"
                            onClick={() => clearKey(command.id)}>
                        <StellarIcon name="close" size={12}/>
                    </button>
                </div>
            );
        }
    }

    return (
        <div>
            <div className="mb-3 flex items-center gap-2">
                <input className={INPUT} placeholder="Search commands" value={query}
                       onChange={(event) => setQuery(event.target.value)}/>
                <button type="button" className={BUTTON}
                        onClick={() => void window.api.resetKeybinds().then((next) => editorStore.set({keybinds: next}))}>Reset
                    All
                </button>
                <button type="button" className={BUTTON} onClick={() => window.api.openKeybindsFile()}>Open YAML
                </button>
            </div>
            <p className="mb-2 text-[11px] text-dim">Click a hotkey, then press the new keys. If another command already
                uses them, it loses them.</p>
            {rows}
        </div>
    );
}

export default function StellarSettingsDialog() {
    const [tab, setTab] = useState<TabId>('general');

    return (
        <StellarDialog title="Settings" width={760} onClose={() => editorStore.set({dialog: null})}>
            <div className="flex gap-5">
                <nav className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-line pr-3">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`rounded-lg px-3 py-2 text-left text-[13px] ${tab === item.id ? 'bg-surface-hover text-ink' : 'text-dim hover:bg-surface hover:text-ink'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="h-[min(560px,64vh)] min-w-0 flex-1 overflow-auto pr-2"
                     data-theme="StellarSettings.content">
                    {tab === 'general' ? <GeneralTab/> : null}
                    {tab === 'appearance' ? <AppearanceTab/> : null}
                    {tab === 'shortcuts' ? <ShortcutsTab/> : null}
                    {tab === 'media' ? <MediaTab/> : null}
                </div>
            </div>
        </StellarDialog>
    );
}
