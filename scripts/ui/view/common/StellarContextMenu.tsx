import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {closeContextMenu, contextMenuStore, type ContextMenuItem} from '../../controller/contextmenu/StellarContextMenu.Controller';
import {useStore} from '../../controller/store/StellarStore';
import {describeCombo} from '../../../common/utils/StellarKeybindHelper';
import StellarIcon from './StellarIcon';
import styles from './StellarContextMenu.module.css';

const isMac = navigator.userAgent.includes('Mac');

/** A sub menu next to its item. It moves up when it would go below the window, flips to the left at the right edge, and scrolls if it is taller than the window. */
function Submenu({children}: {children: ReactNode}) {
    const ref = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<{top: number; flip: boolean; maxHeight: number}>({top: 0, flip: false, maxHeight: window.innerHeight - 8});

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const parent = element.parentElement?.getBoundingClientRect();
        const width = element.firstElementChild?.getBoundingClientRect().width ?? 210;
        const height = element.firstElementChild?.getBoundingClientRect().height ?? 0;
        const maxHeight = window.innerHeight - 8;
        const shown = Math.min(height, maxHeight);
        const parentTop = parent?.top ?? 0;
        const top = Math.min(0, window.innerHeight - 10 - shown - parentTop);
        const flip = (parent?.right ?? 0) + width + 8 > window.innerWidth;

        setPlace({top: Math.max(top, 4 - parentTop), flip, maxHeight});
    }, []);

    return (
        <div
            ref={ref}
            className={`${styles.div} ${place.flip ? styles.divFlip : styles.divNotFlip}`}
            style={{top: place.top, maxHeight: place.maxHeight}}
        >
            {children}
        </div>
    );
}

function MenuList({items, onClose}: {items: ContextMenuItem[]; onClose: () => void}) {
    const [openChild, setOpenChild] = useState<string | null>(null);

    return (
        <div className={`${styles.panel} glass stellar-pop`} data-theme="StellarContextMenu.panel">
            {items.map((item) => {
                if (item.separator) {
                    return <div key={item.id} className={styles.div2} />;
                }

                const hasChildren = Boolean(item.children?.length);

                return (
                    <div key={item.id} className={styles.div3} onPointerEnter={() => setOpenChild(hasChildren ? item.id : null)}>
                        <button
                            type="button"
                            disabled={item.disabled}
                            onClick={() => {
                                if (hasChildren) {
                                    return;
                                }

                                onClose();
                                item.action?.();
                            }}
                            className={`${styles.rowButton} ${
                                item.danger ? styles.textButtonDanger : styles.textButtonNotDanger
                            }`}
                        >
                            <span className={styles.rowSpan}>{item.checked ? <StellarIcon name="check" size={13} /> : null}</span>
                            <span className={styles.textSpan}>{item.label}</span>
                            {item.hotkey ? <span className={styles.textSpan2}>{describeCombo(item.hotkey, isMac)}</span> : null}
                            {hasChildren ? <StellarIcon name="chevronRight" size={12} className={styles.textStellarIcon} /> : null}
                        </button>
                        {hasChildren && openChild === item.id ? (
                            <Submenu>
                                <MenuList items={item.children ?? []} onClose={onClose} />
                            </Submenu>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

/** The one right-click menu of the app. It keeps itself inside the window. */
export default function StellarContextMenu() {
    const state = useStore(contextMenuStore, (value) => value);
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({x: 0, y: 0});

    useLayoutEffect(() => {
        if (!state.open || !ref.current) {
            return;
        }

        const rect = ref.current.getBoundingClientRect();
        const x = Math.max(4, Math.min(state.x, window.innerWidth - rect.width - 4));
        const y = Math.max(4, Math.min(state.y, window.innerHeight - rect.height - 4));

        setPosition({x, y});
    }, [state.open, state.x, state.y, state.items]);

    useEffect(() => {
        if (!state.open) {
            return;
        }

        const close = () => closeContextMenu();

        window.addEventListener('blur', close);
        window.addEventListener('resize', close);

        return () => {
            window.removeEventListener('blur', close);
            window.removeEventListener('resize', close);
        };
    }, [state.open]);

    if (!state.open) {
        return null;
    }

    return (
        <div
            className={styles.overlay}
            onPointerDown={() => closeContextMenu()}
            onContextMenu={(event) => {
                event.preventDefault();
                closeContextMenu();
            }}
        >
            <div ref={ref} className={styles.div4} style={{left: position.x, top: position.y}} onPointerDown={(event) => event.stopPropagation()}>
                <MenuList items={state.items} onClose={closeContextMenu} />
            </div>
        </div>
    );
}
