import {useEffect, useState} from 'react';
import StellarIcon from './StellarIcon';
import styles from './StellarWindowControls.module.css';

/** Minimize, maximize and close. The window has no frame of its own, so the app draws them. */
export default function StellarWindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        void window.api.isWindowMaximized().then(setIsMaximized);

        return window.api.onMaximizeChange(setIsMaximized);
    }, []);

    return (
        <div className={styles.root} data-theme="StellarWindowControls.root">
            <button type="button" className={`${styles.rowButton} no-drag`} onClick={() => window.api.minimizeWindow()} aria-label="Minimize">
                <StellarIcon name="minimize" size={14} />
            </button>
            <button type="button" className={`${styles.rowButton} no-drag`} onClick={() => window.api.toggleMaximizeWindow()} aria-label="Maximize">
                <StellarIcon name={isMaximized ? 'restore' : 'maximize'} size={13} />
            </button>
            <button type="button" className={`${styles.rowButton2} no-drag`} onClick={() => window.api.closeWindow()} aria-label="Close">
                <StellarIcon name="close" size={15} />
            </button>
        </div>
    );
}
