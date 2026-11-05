import {useEffect, useMemo, useState, type ReactNode} from 'react';
import type {ExportSettings} from '../../../common/stellar/StellarContract';
import {AUDIO_BITRATES, AUDIO_SAMPLE_RATES, ENCODE_SPEEDS, EXPORT_FORMATS, EXPORT_PRESETS, findExportFormat} from '../../../common/stellar/StellarExportFormats';
import {formatBytes, formatDuration} from '../../../common/utils/StellarTimeHelper';
import {editorStore, getActiveSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {
    applyPreset, cancelExport, defaultExportSettings, exportLength, exportStore, isExportRunning, presetsFor, resetExportState, startExport
} from '../../controller/project/StellarExport.Controller';
import StellarDialog from '../common/StellarDialog';
import StellarIcon from '../common/StellarIcon';
import {BUTTON, BUTTON_PRIMARY, INPUT, LABEL} from '../common/StellarStyles';
import styles from './StellarExportDialog.module.css';

function Field({label, children}: {label: string; children: ReactNode}) {
    return (
        <div>
            <label className={LABEL}>{label}</label>
            {children}
        </div>
    );
}

function estimateBytes(settings: ExportSettings, seconds: number): number {
    const format = findExportFormat(settings.formatId);

    if (!format) {
        return 0;
    }

    const audioKbps = settings.exportAudio && format.audioCodec ? (format.id === 'wav' ? 1536 : format.id === 'flac' ? 900 : settings.audioKbps) : 0;
    let videoKbps = 0;

    if (settings.exportVideo && format.type !== 'audio') {
        if (format.id === 'prores') {
            videoKbps = (settings.width * settings.height * settings.frameRate * 4.2) / 1000;
        } else if (format.id === 'dnxhr') {
            videoKbps = (settings.width * settings.height * settings.frameRate * 3.3) / 1000;
        } else if (settings.rateControl === 'bitrate' && format.supportsBitrate) {
            videoKbps = settings.videoKbps;
        } else if (format.supportsCrf) {
            videoKbps = (settings.width * settings.height * settings.frameRate * 0.09 * Math.pow(2, (23 - settings.crf) / 6)) / 1000;
        } else {
            videoKbps = format.defaultVideoKbps;
        }
    }

    return ((videoKbps + audioKbps) * 1000 * seconds) / 8;
}

export default function StellarExportDialog() {
    const sequence = useStore(editorStore, (state) => getActiveSequence(state));
    const job = useStore(exportStore, (state) => state);
    const [settings, setSettings] = useState<ExportSettings | null>(() => defaultExportSettings());
    const [presetId, setPresetId] = useState('match');
    const running = job.progress?.status === 'running' || job.starting;
    const finished = job.progress && job.progress.status !== 'running';

    useEffect(() => {
        resetExportState();
    }, []);

    const format = settings ? findExportFormat(settings.formatId) : undefined;
    const presets = useMemo(() => (settings ? presetsFor(settings.formatId) : []), [settings?.formatId]);
    const seconds = settings ? exportLength(settings) : 0;
    const hasClips = (sequence?.clips.length ?? 0) > 0;
    const hasRange = sequence?.inPoint !== null && sequence?.outPoint !== null;

    function close() {
        editorStore.set({dialog: null});
    }

    function update(changes: Partial<ExportSettings>) {
        setSettings((current) => (current ? {...current, ...changes} : current));
    }

    function changeFormat(formatId: string) {
        const next = findExportFormat(formatId);

        if (!next || !settings) {
            return;
        }

        const stillValid = EXPORT_PRESETS.find((preset) => preset.id === presetId)?.formatIds?.includes(formatId) ?? presetId === 'match';
        const base = {
            ...settings,
            formatId,
            outputPath: '',
            crf: next.defaultCrf,
            videoKbps: next.defaultVideoKbps,
            exportVideo: next.type !== 'audio',
            exportAudio: next.type !== 'animation',
            rateControl: next.supportsCrf ? ('crf' as const) : ('bitrate' as const)
        };

        if (!stillValid) {
            setPresetId('match');
        }

        setSettings(stillValid ? applyPresetKeepingFormat(base, presetId) : applyPresetKeepingFormat(base, 'match'));
    }

    function applyPresetKeepingFormat(base: ExportSettings, id: string): ExportSettings {
        const preset = EXPORT_PRESETS.find((item) => item.id === id);

        return preset ? applyPreset(base, preset) : base;
    }

    async function chooseFile() {
        if (!settings || !sequence || !format) {
            return;
        }

        const path = await window.api.pickExportPath(sequence.name, format.extension, editorStore.get().projectPath?.replace(/[\\/][^\\/]*$/, ''));

        if (path) {
            update({outputPath: path});
        }
    }

    if (!settings || !sequence || !format) {
        return (
            <StellarDialog title="Export" onClose={close}>
                <p className={styles.textP}>Open a sequence to export it.</p>
            </StellarDialog>
        );
    }

    const isVideoFormat = format.type !== 'audio';
    const isAudioFormat = format.type !== 'animation';

    return (
        <StellarDialog
            title="Export Media"
            width={720}
            onClose={() => {
                if (!running) {
                    close();
                }
            }}
            footer={
                running ? (
                    <button type="button" className={BUTTON} onClick={cancelExport}>Cancel Export</button>
                ) : (
                    <>
                        <button type="button" className={BUTTON} onClick={close}>{finished ? 'Close' : 'Cancel'}</button>
                        <button
                            type="button"
                            className={BUTTON_PRIMARY}
                            disabled={!hasClips || !settings.outputPath || isExportRunning()}
                            onClick={() => void startExport(settings)}
                        >
                            <StellarIcon name="export" size={14} /> Export
                        </button>
                    </>
                )
            }
        >
            <div className={styles.panel} data-theme="StellarExport.panel">
                {!hasClips ? <p className={styles.textP2}>The sequence is empty. Add clips to the timeline first.</p> : null}

                <div className={styles.grid}>
                    <Field label="Format">
                        <select className={INPUT} value={settings.formatId} disabled={running} onChange={(event) => changeFormat(event.target.value)}>
                            <optgroup label="Video">
                                {EXPORT_FORMATS.filter((item) => item.type === 'video').map((item) => <option key={item.id} value={item.id}>{item.label} (.{item.extension})</option>)}
                            </optgroup>
                            <optgroup label="Animation">
                                {EXPORT_FORMATS.filter((item) => item.type === 'animation').map((item) => <option key={item.id} value={item.id}>{item.label} (.{item.extension})</option>)}
                            </optgroup>
                            <optgroup label="Audio only">
                                {EXPORT_FORMATS.filter((item) => item.type === 'audio').map((item) => <option key={item.id} value={item.id}>{item.label} (.{item.extension})</option>)}
                            </optgroup>
                        </select>
                        <p className={styles.textP3}>{format.description}</p>
                    </Field>
                    <Field label="Preset">
                        <select
                            className={INPUT}
                            value={presetId}
                            disabled={running || !isVideoFormat}
                            onChange={(event) => {
                                setPresetId(event.target.value);
                                setSettings(applyPresetKeepingFormat(settings, event.target.value));
                            }}
                        >
                            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                        </select>
                    </Field>
                </div>

                <Field label="Output file">
                    <div className={styles.row}>
                        <input className={INPUT} readOnly value={settings.outputPath} placeholder="Choose where to save..." onClick={() => void chooseFile()} />
                        <button type="button" className={BUTTON} disabled={running} onClick={() => void chooseFile()}>
                            <StellarIcon name="folder" size={14} /> Browse
                        </button>
                    </div>
                </Field>

                <Field label="Range">
                    <select className={INPUT} value={settings.range} disabled={running} onChange={(event) => update({range: event.target.value as ExportSettings['range']})}>
                        <option value="sequence">Entire sequence</option>
                        <option value="inOut" disabled={!hasRange}>Sequence In to Out{hasRange ? '' : ' (set In and Out marks first)'}</option>
                    </select>
                </Field>

                {isVideoFormat ? (
                    <section className={styles.section}>
                        <h3 className={styles.textH3}>Video</h3>
                        <div className={styles.grid2}>
                            <Field label="Width">
                                <input type="number" className={INPUT} min={16} max={8192} step={2} value={settings.width} disabled={running} onChange={(event) => update({width: Math.max(16, Number(event.target.value))})} />
                            </Field>
                            <Field label="Height">
                                <input type="number" className={INPUT} min={16} max={8192} step={2} value={settings.height} disabled={running} onChange={(event) => update({height: Math.max(16, Number(event.target.value))})} />
                            </Field>
                            <Field label="Frame rate">
                                <input type="number" className={INPUT} min={1} max={120} step={0.001} value={Number(settings.frameRate.toFixed(3))} disabled={running} onChange={(event) => update({frameRate: Math.max(1, Number(event.target.value))})} />
                            </Field>
                            <Field label="Encoding">
                                <select className={INPUT} value={settings.encodeSpeed} disabled={running || format.type === 'animation'} onChange={(event) => update({encodeSpeed: event.target.value as ExportSettings['encodeSpeed']})}>
                                    {ENCODE_SPEEDS.map((speed) => <option key={speed.id} value={speed.id}>{speed.label}</option>)}
                                </select>
                            </Field>
                        </div>

                        {format.supportsCrf || format.supportsBitrate ? (
                            <div className={styles.grid3}>
                                <Field label="Rate control">
                                    <select className={INPUT} value={settings.rateControl} disabled={running} onChange={(event) => update({rateControl: event.target.value as ExportSettings['rateControl']})}>
                                        {format.supportsCrf ? <option value="crf">Quality (CRF)</option> : null}
                                        {format.supportsBitrate ? <option value="bitrate">Target bitrate</option> : null}
                                    </select>
                                </Field>
                                {settings.rateControl === 'crf' && format.supportsCrf ? (
                                    <Field label={`Quality: ${settings.crf} (lower is better)`}>
                                        <input type="range" className={styles.boxInput} min={format.crfMin} max={format.crfMax} value={settings.crf} disabled={running} onChange={(event) => update({crf: Number(event.target.value)})} />
                                    </Field>
                                ) : (
                                    <Field label="Bitrate (kbps)">
                                        <input type="number" className={INPUT} min={100} max={200000} step={100} value={settings.videoKbps} disabled={running} onChange={(event) => update({videoKbps: Math.max(100, Number(event.target.value))})} />
                                    </Field>
                                )}
                            </div>
                        ) : null}
                    </section>
                ) : null}

                {isVideoFormat && format.type !== 'animation' ? (
                    <section className={styles.section} data-theme="StellarExport.render">
                        <h3 className={styles.textH3}>Render settings</h3>
                        <div className={styles.grid4}>
                            <Field label="Frame interpolation">
                                <select
                                    className={INPUT}
                                    value={settings.frameInterpolation}
                                    disabled={running}
                                    onChange={(event) => update({frameInterpolation: event.target.value as ExportSettings['frameInterpolation']})}
                                >
                                    <option value="sampling">Frame Sampling</option>
                                    <option value="blending">Frame Blending</option>
                                    <option value="opticalFlow">Optical Flow</option>
                                </select>
                                <p className={styles.textP3}>Used when the frame rate of a clip is not the frame rate of the export.</p>
                            </Field>
                            <div className={styles.column}>
                                <label className={styles.rowLabel}>
                                    <input type="checkbox" checked={settings.maxDepth} disabled={running} onChange={(event) => update({maxDepth: event.target.checked})} />
                                    Render at Maximum Depth
                                    <span className={styles.textP}>(10-bit, for ProRes 4444 and DNxHR HQX)</span>
                                </label>
                                <label className={styles.rowLabel}>
                                    <input type="checkbox" checked={settings.maxQuality} disabled={running} onChange={(event) => update({maxQuality: event.target.checked})} />
                                    Use Maximum Render Quality
                                    <span className={styles.textP}>(best scaling, slower)</span>
                                </label>
                            </div>
                        </div>
                    </section>
                ) : null}

                {isAudioFormat ? (
                    <section className={styles.section}>
                        <h3 className={styles.textH3}>Audio</h3>
                        <div className={styles.grid5}>
                            <Field label="Sample rate">
                                <select className={INPUT} value={settings.sampleRate} disabled={running} onChange={(event) => update({sampleRate: Number(event.target.value)})}>
                                    {AUDIO_SAMPLE_RATES.map((rate) => <option key={rate} value={rate}>{rate / 1000} kHz</option>)}
                                </select>
                            </Field>
                            <Field label="Channels">
                                <select className={INPUT} value={settings.channels} disabled={running} onChange={(event) => update({channels: Number(event.target.value) as 1 | 2})}>
                                    <option value={2}>Stereo</option>
                                    <option value={1}>Mono</option>
                                </select>
                            </Field>
                            <Field label="Bitrate">
                                <select className={INPUT} value={settings.audioKbps} disabled={running || !format.supportsAudioBitrate} onChange={(event) => update({audioKbps: Number(event.target.value)})}>
                                    {AUDIO_BITRATES.map((rate) => <option key={rate} value={rate}>{rate} kbps</option>)}
                                </select>
                            </Field>
                        </div>
                    </section>
                ) : null}

                <p className={styles.textP4}>
                    Length {formatDuration(seconds)} · about {formatBytes(estimateBytes(settings, seconds))}
                </p>

                {job.progress || job.error ? (
                    <section className={styles.section} data-theme="StellarExport.progress">
                        {job.progress ? (
                            <>
                                <div className={styles.row2}>
                                    <span>
                                        {job.progress.status === 'running' ? 'Exporting...' : job.progress.status === 'done' ? 'Export finished' : job.progress.status === 'cancelled' ? 'Export cancelled' : 'Export failed'}
                                    </span>
                                    <span className={styles.textP}>
                                        {Math.round(job.progress.percent)}%
                                        {job.progress.etaSeconds !== null && job.progress.status === 'running' ? ` · ${formatDuration(job.progress.etaSeconds)} left` : ''}
                                        {job.progress.speed ? ` · ${job.progress.speed.toFixed(1)}x` : ''}
                                    </span>
                                </div>
                                <div className={styles.div}>
                                    <div className={`${styles.div2} ${job.progress.status === 'error' ? styles.divVariant : styles.divVariant2}`} style={{width: `${job.progress.percent}%`}} />
                                </div>
                                {job.progress.status === 'done' ? (
                                    <button type="button" className={`${styles.button} ${BUTTON}`} onClick={() => window.api.revealInFolder(job.progress?.outputPath ?? '')}>
                                        <StellarIcon name="reveal" size={14} /> Show in Folder
                                    </button>
                                ) : null}
                            </>
                        ) : null}
                        {job.error ? <p className={styles.textP5}>{job.error}</p> : null}
                    </section>
                ) : null}
            </div>
        </StellarDialog>
    );
}
