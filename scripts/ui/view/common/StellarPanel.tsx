import type {ReactNode} from 'react';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import styles from './StellarPanel.module.css';

export interface PanelTab {
    id: string;
    label: string;
}

interface PanelProps {
    panelId: string;                 // used by the "maximize panel" hotkey and by theme overrides
    title?: string;
    tabs?: PanelTab[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    actions?: ReactNode;             // buttons on the right side of the tab strip
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}

/** One docked panel of the editor: a tab strip on top and the content below, like in Premiere Pro. */
export default function StellarPanel({panelId, title, tabs, activeTab, onTabChange, actions, children, className = '', bodyClassName = ''}: PanelProps) {
    const hasHeader = Boolean(tabs) || Boolean(title) || Boolean(actions);

    return (
        <section
            data-panel={panelId}
            data-theme={`StellarPanel.${panelId}`}
            className={`${styles.root} ${className}`}
            onPointerEnter={() => editorStore.set({hoveredPanel: panelId})}
        >
            {hasHeader ? (
                <header className={styles.header} data-theme="StellarPanel.header">
                    {tabs ? (
                        <div className={styles.tabs} role="tablist">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab.id === activeTab}
                                    onClick={() => onTabChange?.(tab.id)}
                                    className={`${styles.tab} ${tab.id === activeTab ? styles.tabActive : ''}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span className={`${styles.tab} ${styles.tabActive} ${styles.title}`}>{title}</span>
                    )}
                    <div className={styles.actions}>{actions}</div>
                </header>
            ) : null}
            <div className={`${styles.body} ${bodyClassName}`}>{children}</div>
        </section>
    );
}
