import {useEffect, useState} from 'react';
import {SEQUENCE_PRESETS} from '../../../common/stellar/StellarConfig';
import StellarDialog from '../common/StellarDialog';
import StellarIcon from '../common/StellarIcon';
import {BUTTON, BUTTON_PRIMARY, INPUT, LABEL} from '../common/StellarStyles';
import styles from './StellarNewProjectDialog.module.css';

interface NewProjectDialogProps {
    onClose: () => void;
    onCreate: (path: string) => void;
}

export default function StellarNewProjectDialog({onClose, onCreate}: NewProjectDialogProps) {
    const [name, setName] = useState('Untitled Project');
    const [folder, setFolder] = useState('');
    const [presetId, setPresetId] = useState('hd1080-24');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void window.api.getSettings().then((settings) => setFolder(settings.lastProjectFolder));
    }, []);

    async function chooseFolder() {
        const picked = await window.api.pickFolder(folder || undefined);

        if (picked) {
            setFolder(picked);
        }
    }

    async function create() {
        const preset = SEQUENCE_PRESETS.find((item) => item.id === presetId);

        if (!name.trim() || !folder) {
            setError('Give the project a name and choose a folder for it.');
            return;
        }

        setBusy(true);
        setError(null);

        try {
            const path = await window.api.createProject({
                name: name.trim(),
                folder,
                sequence: preset ? {name: 'Sequence 01', width: preset.width, height: preset.height, frameRate: preset.frameRate, sampleRate: 48000} : null
            });

            onCreate(path);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
            setBusy(false);
        }
    }

    return (
        <StellarDialog
            title="New Project"
            onClose={onClose}
            width={540}
            footer={
                <>
                    <button type="button" className={BUTTON} onClick={onClose}>Cancel</button>
                    <button type="button" className={BUTTON_PRIMARY} disabled={busy} onClick={() => void create()}>Create</button>
                </>
            }
        >
            <div className={styles.column}>
                <div>
                    <label className={LABEL}>Project name</label>
                    <input className={INPUT} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
                </div>
                <div>
                    <label className={LABEL}>Location</label>
                    <div className={styles.row}>
                        <input className={INPUT} value={folder} readOnly placeholder="Choose a folder..." onClick={() => void chooseFolder()} />
                        <button type="button" className={BUTTON} onClick={() => void chooseFolder()}>
                            <StellarIcon name="folder" size={14} /> Browse
                        </button>
                    </div>
                    <p className={styles.textP}>A folder named after the project is made here. It holds the project file and its auto-saves.</p>
                </div>
                <div>
                    <label className={LABEL}>First sequence</label>
                    <select className={INPUT} value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                        {SEQUENCE_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                        <option value="">Start with no sequence</option>
                    </select>
                </div>
                {error ? <p className={styles.textP2}>{error}</p> : null}
            </div>
        </StellarDialog>
    );
}
