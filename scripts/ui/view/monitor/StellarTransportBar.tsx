import type {ReactNode} from 'react';
import StellarIcon, {type IconName} from '../common/StellarIcon';

export interface TransportButton {
    icon: IconName;
    title: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}

/** A row of round buttons under a monitor. Gaps in the list are spaces. */
export default function StellarTransportBar({buttons, left, right}: {
    buttons: (TransportButton | null)[];
    left?: ReactNode;
    right?: ReactNode
}) {
    return (
        <div className="flex items-center gap-2 px-3 pb-3" data-theme="StellarMonitor.transport">
            <div className="flex min-w-0 flex-1 items-center">{left}</div>
            <div className="flex items-center gap-0.5">
                {buttons.map((button, index) =>
                    button ? (
                        <button
                            key={button.title}
                            type="button"
                            title={button.title}
                            disabled={button.disabled}
                            onClick={button.onClick}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-35 ${
                                button.active ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-surface-hover'
                            }`}
                        >
                            <StellarIcon name={button.icon} size={16}
                                         filled={button.icon === 'play' || button.icon === 'pause'}/>
                        </button>
                    ) : (
                        <span key={`gap-${index}`} className="mx-1 h-4 w-px bg-line"/>
                    )
                )}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end">{right}</div>
        </div>
    );
}
