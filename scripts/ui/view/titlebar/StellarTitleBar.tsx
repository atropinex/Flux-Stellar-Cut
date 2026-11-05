import {useState} from 'react';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {MENUS} from '../../controller/command/StellarMenu.Controller';
import {runCommand} from '../../controller/command/StellarCommand.Controller';
import {openMenuAt} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarWindowControls from '../common/StellarWindowControls';
import {BUTTON_GHOST, BUTTON_PRIMARY} from '../common/StellarStyles';
import styles from './StellarTitleBar.module.css';

/** The top bar: menus, project name and window buttons. Empty space in it drags the window. */
export default function StellarTitleBar() {
    const document = useStore(editorStore, (state) => state.document);
    const dirty = useStore(editorStore, (state) => state.dirty);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    function openMenu(menuId: string, button: HTMLElement) {
        const menu = MENUS.find((item) => item.id === menuId);

        if (!menu) {
            return;
        }

        const rect = button.getBoundingClientRect();

        setActiveMenu(menuId);
        openMenuAt(rect.left, rect.bottom + 4, menu.build());
    }

    return (
        <header className={`${styles.root} drag-region`} data-theme="StellarTitleBar.root">
            <div className={styles.row}>
                <StellarIcon name="sparkle" size={14} filled />
            </div>

            <nav className={`${styles.rowNav} no-drag`}>
                {MENUS.map((menu) => (
                    <button
                        key={menu.id}
                        type="button"
                        className={`${styles.textButton} ${activeMenu === menu.id ? styles.buttonId : ''}`}
                        onClick={(event) => openMenu(menu.id, event.currentTarget)}
                        onPointerEnter={(event) => {
                            if (activeMenu && activeMenu !== menu.id) {
                                openMenu(menu.id, event.currentTarget);
                            }
                        }}
                    >
                        {menu.label}
                    </button>
                ))}
            </nav>

            <div className={styles.row2}>
                <span className={styles.textSpan}>{document?.name ?? ''}</span>
                {dirty ? <span className={styles.span} title="Unsaved changes" /> : null}
            </div>

            <div className={`${styles.row3} no-drag`}>
                <button type="button" className={BUTTON_GHOST} title="Undo" onClick={() => runCommand('edit.undo')}><StellarIcon name="undo" /></button>
                <button type="button" className={BUTTON_GHOST} title="Redo" onClick={() => runCommand('edit.redo')}><StellarIcon name="redo" /></button>
                <button type="button" className={BUTTON_GHOST} title="Save" onClick={() => runCommand('file.save')}><StellarIcon name="save" /></button>
                <button type="button" className={BUTTON_GHOST} title="Settings" onClick={() => runCommand('file.settings')}><StellarIcon name="settings" /></button>
                <button type="button" className={`${styles.button} ${BUTTON_PRIMARY}`} onClick={() => runCommand('file.export')}>
                    <StellarIcon name="export" size={14} /> Export
                </button>
            </div>
            <StellarWindowControls />
        </header>
    );
}
