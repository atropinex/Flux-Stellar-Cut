import type {ReactNode} from 'react';
import StellarScrubNumber from './StellarScrubNumber';

// Small form lines that the panels share. Numbers are always dragged sideways or typed, never sliders.

export function FieldRow({label, children, hint}: { label: string; children: ReactNode; hint?: string }) {
    return (
        <div className="flex items-center gap-2 py-1 pl-3 pr-3" title={hint}>
            <span className="w-[96px] shrink-0 truncate text-[12px] text-dim">{label}</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
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

export function NumberField({
                                label,
                                value,
                                min,
                                max,
                                step = 1,
                                unit,
                                decimals = 0,
                                reset,
                                onLive,
                                onCommit
                            }: NumberFieldProps) {
    return (
        <FieldRow label={label}>
            <StellarScrubNumber
                value={value} min={min} max={max} step={step} unit={unit} decimals={decimals}
                onChange={onLive} onCommit={onCommit} onReset={reset === undefined ? undefined : () => onCommit(reset)}
            />
        </FieldRow>
    );
}

export function ColorField({label, value, onLive, onCommit}: {
    label: string;
    value: string;
    onLive: (value: string) => void;
    onCommit: (value: string) => void
}) {
    return (
        <FieldRow label={label}>
            <input
                type="color" value={value}
                className="h-6 w-10 cursor-pointer rounded border border-line bg-transparent p-0"
                onChange={(event) => onLive(event.target.value)}
                onBlur={(event) => onCommit(event.target.value)}
            />
            <span className="text-[11px] uppercase tabular-nums text-dim">{value}</span>
        </FieldRow>
    );
}

export function CheckField({label, checked, onChange, text}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    text?: string
}) {
    return (
        <FieldRow label={label}>
            <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/>
                {text ?? (checked ? 'On' : 'Off')}
            </label>
        </FieldRow>
    );
}

export function PanelSection({title, children, actions}: { title: string; children: ReactNode; actions?: ReactNode }) {
    return (
        <div className="border-b border-line py-1.5" data-theme="StellarPanel.section">
            <div className="flex items-center px-3 py-1 text-[12px] font-semibold">
                {title}
                <div className="ml-auto">{actions}</div>
            </div>
            {children}
        </div>
    );
}

export function EmptyPanel({icon, children}: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-dim"
             data-theme="StellarPanel.empty">
            {icon}
            <div className="text-[12px]">{children}</div>
        </div>
    );
}
