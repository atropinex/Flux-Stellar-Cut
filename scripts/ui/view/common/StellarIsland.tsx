import type {ReactNode} from 'react';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import styles from './StellarIsland.module.css';

export interface IslandTab {
    id: string;
    label: string;
}

interface IslandProps {
    panelId: string;                 // used by the "maximize panel" hotkey and by theme overrides
    title?: string;
    tabs?: IslandTab[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    actions?: ReactNode;             // buttons on the right side of the header
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}

/** One floating, glass panel of the editor. */
export default function StellarIsland({panelId, title, tabs, activeTab, onTabChange, actions, children, className = '', bodyClassName = ''}: IslandProps) {
    return (
        <section
            data-panel={panelId}
            data-theme={`StellarIsland.${panelId}`}
            className={`${styles.columnSection} glass ${className}`}
            onPointerEnter={() => editorStore.set({hoveredPanel: panelId})}
        >
            <header className={`${styles.header} glass-header`} data-theme="StellarIsland.header">
                {tabs ? (
                    <div className={styles.row}>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onTabChange?.(tab.id)}
                                className={`${styles.textButton} ${
                                    tab.id === activeTab ? styles.textButtonActiveTab : styles.textButtonNotActiveTab
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className={styles.textSpan}>{title}</span>
                )}
                <div className={styles.row2}>{actions}</div>
            </header>
            <div className={`${styles.div} ${bodyClassName}`}>{children}</div>
        </section>
    );
}
