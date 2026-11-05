import type {ReactNode} from 'react';
import StellarIcon, {type IconName} from '../common/StellarIcon';
import styles from './StellarTransportBar.module.css';

export interface TransportButton {
    icon: IconName;
    title: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}

/** A row of round buttons under a monitor. Gaps in the list are spaces. */
export default function StellarTransportBar({buttons, left, right}: {buttons: (TransportButton | null)[]; left?: ReactNode; right?: ReactNode}) {
    return (
        <div className={styles.transport} data-theme="StellarMonitor.transport">
            <div className={styles.row}>{left}</div>
            <div className={styles.row2}>
                {buttons.map((button, index) =>
                    button ? (
                        <button
                            key={button.title}
                            type="button"
                            title={button.title}
                            disabled={button.disabled}
                            onClick={button.onClick}
                            className={`${styles.rowButton} ${
                                button.active ? styles.textButtonActive : styles.textButtonNotActive
                            }`}
                        >
                            <StellarIcon name={button.icon} size={16} filled={button.icon === 'play' || button.icon === 'pause'} />
                        </button>
                    ) : (
                        <span key={`gap-${index}`} className={styles.span} />
                    )
                )}
            </div>
            <div className={styles.row3}>{right}</div>
        </div>
    );
}
