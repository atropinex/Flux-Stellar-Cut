import type {ReactNode} from 'react';
import StellarScrubNumber from './StellarScrubNumber';
import styles from './StellarFields.module.css';

// Small form lines that the panels share. Numbers are always dragged sideways or typed, never sliders.

export function FieldRow({label, children, hint}: {label: string; children: ReactNode; hint?: string}) {
    return (
        <div className={styles.row} title={hint}>
            <span className={styles.textSpan}>{label}</span>
            <div className={styles.row2}>{children}</div>
        </div>
    );
}

interface NumberFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    decimals?: number;
    reset?: number;
    onLive: (value: number) => void;
    onCommit: (value: number) => void;
}

export function NumberField({label, value, min, max, step = 1, unit, decimals = 0, reset, onLive, onCommit}: NumberFieldProps) {
    return (
        <FieldRow label={label}>
            <StellarScrubNumber
                value={value} min={min} max={max} step={step} unit={unit} decimals={decimals}
                onChange={onLive} onCommit={onCommit} onReset={reset === undefined ? undefined : () => onCommit(reset)}
            />
        </FieldRow>
    );
}

export function ColorField({label, value, onLive, onCommit}: {label: string; value: string; onLive: (value: string) => void; onCommit: (value: string) => void}) {
    return (
        <FieldRow label={label}>
            <input
                type="color" value={value} className={styles.input}
                onChange={(event) => onLive(event.target.value)}
                onBlur={(event) => onCommit(event.target.value)}
            />
            <span className={styles.textSpan2}>{value}</span>
        </FieldRow>
    );
}

export function CheckField({label, checked, onChange, text}: {label: string; checked: boolean; onChange: (checked: boolean) => void; text?: string}) {
    return (
        <FieldRow label={label}>
            <label className={styles.rowLabel}>
                <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
                {text ?? (checked ? 'On' : 'Off')}
            </label>
        </FieldRow>
    );
}

export function PanelSection({title, children, actions}: {title: string; children: ReactNode; actions?: ReactNode}) {
    return (
        <div className={styles.section} data-theme="StellarPanel.section">
            <div className={styles.row3}>
                {title}
                <div className={styles.div}>{actions}</div>
            </div>
            {children}
        </div>
    );
}

export function EmptyPanel({icon, children}: {icon: ReactNode; children: ReactNode}) {
    return (
        <div className={styles.empty} data-theme="StellarPanel.empty">
            {icon}
            <div className={styles.text}>{children}</div>
        </div>
    );
}
