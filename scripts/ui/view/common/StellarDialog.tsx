import {useEffect, type ReactNode} from 'react';
import StellarIcon from './StellarIcon';
import {BUTTON_GHOST} from './StellarStyles';
import styles from './StellarDialog.module.css';

interface DialogProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    width?: number;
}

/** A glass window in the middle of the screen. Escape closes it. */
export default function StellarDialog({title, onClose, children, footer, width = 560}: DialogProps) {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className={styles.overlay} onPointerDown={onClose}>
            <div
                className={`${styles.panel} glass stellar-pop`}
                style={{width}}
                data-theme="StellarDialog.panel"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <header className={`${styles.rowHeader} glass-header`}>
                    <h2 className={styles.textH2}>{title}</h2>
                    <button type="button" className={`${styles.button} ${BUTTON_GHOST}`} onClick={onClose} aria-label="Close">
                        <StellarIcon name="close" size={15} />
                    </button>
                </header>
                <div className={styles.div}>{children}</div>
                {footer ? <footer className={styles.rowFooter}>{footer}</footer> : null}
            </div>
        </div>
    );
}
