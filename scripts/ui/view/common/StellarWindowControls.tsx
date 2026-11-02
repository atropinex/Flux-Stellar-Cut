import {useEffect, useState} from 'react';
import StellarIcon from './StellarIcon';

/** Minimize, maximize and close. The window has no frame of its own, so the app draws them. */
export default function StellarWindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        void window.api.isWindowMaximized().then(setIsMaximized);

        return window.api.onMaximizeChange(setIsMaximized);
    }, []);

    const base = 'no-drag flex h-8 w-10 items-center justify-center text-dim transition-colors hover:text-ink';

    return (
        <div className="flex items-center" data-theme="StellarWindowControls.root">
            <button type="button" className={`${base} hover:bg-surface-hover`}
                    onClick={() => window.api.minimizeWindow()} aria-label="Minimize">
                <StellarIcon name="minimize" size={14}/>
            </button>
            <button type="button" className={`${base} hover:bg-surface-hover`}
                    onClick={() => window.api.toggleMaximizeWindow()} aria-label="Maximize">
                <StellarIcon name={isMaximized ? 'restore' : 'maximize'} size={13}/>
            </button>
            <button type="button" className={`${base} hover:bg-danger hover:text-white`}
                    onClick={() => window.api.closeWindow()} aria-label="Close">
                <StellarIcon name="close" size={15}/>
            </button>
        </div>
    );
}
