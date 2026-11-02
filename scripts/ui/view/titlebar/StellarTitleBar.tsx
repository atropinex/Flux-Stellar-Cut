import {useState} from 'react';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {MENUS} from '../../controller/command/StellarMenu.Controller';
import {runCommand} from '../../controller/command/StellarCommand.Controller';
import {openMenuAt} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarWindowControls from '../common/StellarWindowControls';
import {BUTTON_GHOST, BUTTON_PRIMARY} from '../common/StellarStyles';

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
        <header className="drag-region relative z-10 flex h-10 shrink-0 items-center gap-1 pl-3"
                data-theme="StellarTitleBar.root">
            <div className="mr-1 flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-ink">
                <StellarIcon name="sparkle" size={14} filled/>
            </div>

            <nav className="no-drag flex items-center">
                {MENUS.map((menu) => (
                    <button
                        key={menu.id}
                        type="button"
                        className={`rounded-md px-2.5 py-1 text-[12.5px] transition-colors hover:bg-surface-hover ${activeMenu === menu.id ? 'bg-surface-hover' : ''}`}
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

            <div className="pointer-events-none flex flex-1 items-center justify-center gap-1.5 text-[12.5px] text-dim">
                <span className="max-w-[40vw] truncate">{document?.name ?? ''}</span>
                {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Unsaved changes"/> : null}
            </div>

            <div className="no-drag flex items-center gap-1 pr-1">
                <button type="button" className={BUTTON_GHOST} title="Undo" onClick={() => runCommand('edit.undo')}>
                    <StellarIcon name="undo"/></button>
                <button type="button" className={BUTTON_GHOST} title="Redo" onClick={() => runCommand('edit.redo')}>
                    <StellarIcon name="redo"/></button>
                <button type="button" className={BUTTON_GHOST} title="Save" onClick={() => runCommand('file.save')}>
                    <StellarIcon name="save"/></button>
                <button type="button" className={BUTTON_GHOST} title="Settings"
                        onClick={() => runCommand('file.settings')}><StellarIcon name="settings"/></button>
                <button type="button" className={`${BUTTON_PRIMARY} mx-1`} onClick={() => runCommand('file.export')}>
                    <StellarIcon name="export" size={14}/> Export
                </button>
            </div>
            <StellarWindowControls/>
        </header>
    );
}
