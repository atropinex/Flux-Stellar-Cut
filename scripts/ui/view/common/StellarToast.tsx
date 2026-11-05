import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import styles from './StellarToast.module.css';

/** A short message at the bottom of the window. */
export default function StellarToast() {
    const toast = useStore(editorStore, (state) => state.toast);

    if (!toast) {
        return null;
    }

    return (
        <div className={styles.overlay}>
            <div key={toast.id} className={`${styles.panel} glass stellar-pop`} data-theme="StellarToast.panel">
                {toast.message}
            </div>
        </div>
    );
}
