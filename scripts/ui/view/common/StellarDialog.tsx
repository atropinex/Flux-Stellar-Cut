import {useEffect, type ReactNode} from 'react';
import StellarIcon from './StellarIcon';
import {BUTTON_GHOST} from './StellarStyles';

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
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[3px]"
             onPointerDown={onClose}>
            <div
                className="glass stellar-pop flex max-h-full flex-col overflow-hidden"
                style={{width}}
                data-theme="StellarDialog.panel"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <header className="glass-header flex h-11 shrink-0 items-center px-4">
                    <h2 className="text-[13px] font-semibold">{title}</h2>
                    <button type="button" className={`${BUTTON_GHOST} ml-auto`} onClick={onClose} aria-label="Close">
                        <StellarIcon name="close" size={15}/>
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
                {footer ? <footer
                    className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer> : null}
            </div>
        </div>
    );
}
