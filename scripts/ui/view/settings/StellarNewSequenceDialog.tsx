import {useState} from 'react';
import {SEQUENCE_PRESETS} from '../../../common/stellar/StellarConfig';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {addSequence} from '../../controller/project/StellarProject.Controller';
import StellarDialog from '../common/StellarDialog';
import {BUTTON, BUTTON_PRIMARY, INPUT, LABEL} from '../common/StellarStyles';
import styles from './StellarNewSequenceDialog.module.css';

export default function StellarNewSequenceDialog() {
    const count = editorStore.get().document?.sequences.length ?? 0;
    const [name, setName] = useState(`Sequence ${String(count + 1).padStart(2, '0')}`);
    const [presetId, setPresetId] = useState('hd1080-24');
    const [width, setWidth] = useState(1920);
    const [height, setHeight] = useState(1080);
    const [frameRate, setFrameRate] = useState(24);

    function choosePreset(id: string) {
        const preset = SEQUENCE_PRESETS.find((item) => item.id === id);

        setPresetId(id);

        if (preset) {
            setWidth(preset.width);
            setHeight(preset.height);
            setFrameRate(preset.frameRate);
        }
    }

    function create() {
        addSequence(name.trim() || 'Sequence', {width, height, frameRate, sampleRate: 48000});
        editorStore.set({dialog: null});
    }

    return (
        <StellarDialog
            title="New Sequence"
            width={480}
            onClose={() => editorStore.set({dialog: null})}
            footer={
                <>
                    <button type="button" className={BUTTON} onClick={() => editorStore.set({dialog: null})}>Cancel</button>
                    <button type="button" className={BUTTON_PRIMARY} onClick={create}>Create</button>
                </>
            }
        >
            <div className={styles.column}>
                <div>
                    <label className={LABEL}>Name</label>
                    <input className={INPUT} value={name} autoFocus onChange={(event) => setName(event.target.value)} />
                </div>
                <div>
                    <label className={LABEL}>Preset</label>
                    <select className={INPUT} value={presetId} onChange={(event) => choosePreset(event.target.value)}>
                        {SEQUENCE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                    </select>
                </div>
                <div className={styles.grid}>
                    <div>
                        <label className={LABEL}>Width</label>
                        <input type="number" className={INPUT} value={width} min={16} step={2} onChange={(event) => setWidth(Math.max(16, Number(event.target.value)))} />
                    </div>
                    <div>
                        <label className={LABEL}>Height</label>
                        <input type="number" className={INPUT} value={height} min={16} step={2} onChange={(event) => setHeight(Math.max(16, Number(event.target.value)))} />
                    </div>
                    <div>
                        <label className={LABEL}>Frame rate</label>
                        <input type="number" className={INPUT} value={Number(frameRate.toFixed(3))} min={1} max={120} step={0.001} onChange={(event) => setFrameRate(Math.max(1, Number(event.target.value)))} />
                    </div>
                </div>
            </div>
        </StellarDialog>
    );
}
