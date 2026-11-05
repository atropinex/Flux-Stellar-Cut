import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {jumpToHistory} from '../../controller/project/StellarProject.Controller';
import styles from './StellarHistoryPanel.module.css';

/** Every change in the project, in order. Click one to go back (or forward) to that moment. */
export default function StellarHistoryPanel() {
    const past = useStore(editorStore, (state) => state.past);
    const future = useStore(editorStore, (state) => state.future);
    const currentLabel = useStore(editorStore, (state) => state.currentLabel);
    const labels = [...past.map((entry) => entry.label), currentLabel, ...future.map((entry) => entry.label)];
    const currentIndex = past.length;

    return (
        <div className={styles.panel} data-theme="StellarHistory.panel">
            {labels.map((label, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => jumpToHistory(index)}
                    className={`${styles.rowButton} ${
                        index === currentIndex ? styles.textButtonCurrentIndex : index > currentIndex ? styles.textButtonCurrentIndex2 : styles.textButtonNotCurrentIndex
                    }`}
                >
                    <span className={styles.textSpan}>{index}</span>
                    <span className={styles.textSpan2}>{label}</span>
                </button>
            ))}
        </div>
    );
}
