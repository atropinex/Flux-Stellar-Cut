import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {WORKSPACES, setWorkspace} from '../../controller/command/StellarWorkspace.Controller';
import styles from './StellarWorkspaceBar.module.css';

/** The row of workspace names under the title bar. Picking one resets the panel sizes to that workspace. */
export default function StellarWorkspaceBar() {
    const workspace = useStore(editorStore, (state) => state.workspace);

    return (
        <nav className={styles.root} data-theme="StellarWorkspaceBar.root" aria-label="Workspaces">
            {Object.entries(WORKSPACES).map(([id, item]) => (
                <button
                    key={id}
                    type="button"
                    className={`${styles.item} ${id === workspace ? styles.itemActive : ''}`}
                    onClick={() => setWorkspace(id)}
                >
                    {item.label}
                </button>
            ))}
        </nav>
    );
}
