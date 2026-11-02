import type {ReactNode} from 'react';
import {editorStore} from '../../controller/project/StellarEditor.Store';

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
export default function StellarIsland({
                                          panelId,
                                          title,
                                          tabs,
                                          activeTab,
                                          onTabChange,
                                          actions,
                                          children,
                                          className = '',
                                          bodyClassName = ''
                                      }: IslandProps) {
    return (
        <section
            data-panel={panelId}
            data-theme={`StellarIsland.${panelId}`}
            className={`glass flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
            onPointerEnter={() => editorStore.set({hoveredPanel: panelId})}
        >
            <header className="glass-header flex h-9 shrink-0 items-center gap-1 px-2"
                    data-theme="StellarIsland.header">
                {tabs ? (
                    <div className="flex items-center gap-0.5">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onTabChange?.(tab.id)}
                                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                                    tab.id === activeTab ? 'bg-surface-hover text-ink' : 'text-dim hover:bg-surface hover:text-ink'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className="px-1.5 text-[12px] font-medium text-ink">{title}</span>
                )}
                <div className="ml-auto flex items-center gap-1">{actions}</div>
            </header>
            <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
        </section>
    );
}
