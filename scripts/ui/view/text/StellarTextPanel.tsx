import type {StrokePosition, TextAlign, TextSettings} from '../../../common/stellar/StellarText';
import {FONT_FAMILIES, FONT_WEIGHTS} from '../../../common/stellar/StellarText';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {findClip} from '../../controller/timeline/StellarTimeline.Controller';
import {addTextClip, updateText} from '../../controller/timeline/StellarClipEdit.Controller';
import {BUTTON_PRIMARY, INPUT} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';
import {ColorField, EmptyPanel, FieldRow, NumberField, PanelSection} from '../common/StellarFields';

// The look of a text clip: font, size, color, stroke, shadow and a box behind the letters.

const ALIGNMENTS: { id: TextAlign; label: string }[] = [{id: 'left', label: 'Left'}, {
    id: 'center',
    label: 'Center'
}, {id: 'right', label: 'Right'}];
const STROKE_POSITIONS: StrokePosition[] = ['outside', 'center', 'inside'];

export default function StellarTextPanel() {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const selection = useStore(editorStore, (state) => state.selection);
    const clip = sequence && selection[0] ? findClip(sequence, selection[0]) : undefined;
    const text = clip?.text;

    if (!clip || !text) {
        return (
            <EmptyPanel icon={<StellarIcon name="text" size={28}/>}>
                <p className="mb-3">Select a text clip to change how it looks.</p>
                <button type="button" className={BUTTON_PRIMARY} onClick={() => addTextClip()}>
                    <StellarIcon name="plus" size={14}/> Add Text
                </button>
            </EmptyPanel>
        );
    }

    const ids = selection;
    const live = (change: Partial<TextSettings>) => updateText(ids, change, false);
    const commit = (change: Partial<TextSettings>) => updateText(ids, change, true);

    function number(label: string, key: keyof TextSettings, min: number, max: number, step = 1, unit = '', decimals = step < 1 ? 1 : 0) {
        return (
            <NumberField
                label={label} value={text?.[key] as number} min={min} max={max} step={step} unit={unit}
                decimals={decimals}
                onLive={(next) => live({[key]: next})} onCommit={(next) => commit({[key]: next})}
            />
        );
    }

    function color(label: string, key: keyof TextSettings) {
        return <ColorField label={label} value={text?.[key] as string} onLive={(next) => live({[key]: next})}
                           onCommit={(next) => commit({[key]: next})}/>;
    }

    return (
        <div className="h-full overflow-auto" data-theme="StellarText.panel">
            <PanelSection title="Text">
                <div className="px-3 pb-1">
                    <textarea
                        className={`${INPUT} min-h-[64px] resize-y`}
                        value={text.content}
                        onChange={(event) => live({content: event.target.value})}
                        onBlur={(event) => commit({content: event.target.value})}
                    />
                </div>
            </PanelSection>

            <PanelSection title="Font">
                <FieldRow label="Family">
                    <select
                        className={INPUT}
                        value={text.fontFamily}
                        style={{fontFamily: `"${text.fontFamily}"`}}
                        onChange={(event) => commit({fontFamily: event.target.value})}
                    >
                        {(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'] as const).map((generic) => (
                            <optgroup key={generic} label={generic}>
                                {FONT_FAMILIES.filter((family) => family.generic === generic).map((family) => (
                                    <option key={family.name} value={family.name}
                                            style={{fontFamily: `"${family.name}", ${generic}`}}>{family.name}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </FieldRow>
                <FieldRow label="Weight">
                    <select className={INPUT} value={text.fontWeight}
                            onChange={(event) => commit({fontWeight: Number(event.target.value)})}>
                        {FONT_WEIGHTS.map((weight) => <option key={weight.value}
                                                              value={weight.value}>{weight.label}</option>)}
                    </select>
                </FieldRow>
                {number('Size', 'fontSize', 4, 1000, 1, 'px')}
                {number('Letter spacing', 'letterSpacing', -50, 200, 0.5, 'px')}
                {number('Line height', 'lineHeight', 0.5, 4, 0.05, '', 2)}
                {number('Wrap width', 'boxWidth', 0, 100, 1, '%')}
                <FieldRow label="Style">
                    <div className="flex flex-wrap gap-1">
                        {([['italic', 'I'], ['underline', 'U'], ['strikethrough', 'S'], ['uppercase', 'AA'], ['smallCaps', 'Aa']] as const).map(([key, glyph]) => (
                            <button
                                key={key}
                                type="button"
                                title={key}
                                className={`min-w-7 rounded-md px-1.5 py-0.5 text-[12px] ${text[key] ? 'bg-accent text-accent-ink' : 'bg-surface hover:bg-surface-hover'}`}
                                onClick={() => commit({[key]: !text[key]})}
                            >
                                {glyph}
                            </button>
                        ))}
                    </div>
                </FieldRow>
                <FieldRow label="Align">
                    <div className="flex gap-1">
                        {ALIGNMENTS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`rounded-md px-2 py-0.5 text-[12px] ${text.align === item.id ? 'bg-accent text-accent-ink' : 'bg-surface hover:bg-surface-hover'}`}
                                onClick={() => commit({align: item.id})}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </FieldRow>
            </PanelSection>

            <PanelSection title="Fill">
                {color('Color', 'color')}
                {number('Opacity', 'fillOpacity', 0, 100, 1, '%')}
            </PanelSection>

            <PanelSection title="Stroke" actions={<input type="checkbox" checked={text.strokeEnabled}
                                                         onChange={(event) => commit({strokeEnabled: event.target.checked})}/>}>
                {text.strokeEnabled ? (
                    <>
                        {color('Color', 'strokeColor')}
                        {number('Width', 'strokeWidth', 0, 100, 0.5, 'px')}
                        <FieldRow label="Position">
                            <select className={INPUT} value={text.strokePosition}
                                    onChange={(event) => commit({strokePosition: event.target.value as StrokePosition})}>
                                {STROKE_POSITIONS.map((position) => <option key={position}
                                                                            value={position}>{position}</option>)}
                            </select>
                        </FieldRow>
                    </>
                ) : null}
            </PanelSection>

            <PanelSection title="Shadow" actions={<input type="checkbox" checked={text.shadowEnabled}
                                                         onChange={(event) => commit({shadowEnabled: event.target.checked})}/>}>
                {text.shadowEnabled ? (
                    <>
                        {color('Color', 'shadowColor')}
                        {number('Opacity', 'shadowOpacity', 0, 100, 1, '%')}
                        {number('Blur', 'shadowBlur', 0, 200, 0.5, 'px')}
                        {number('Distance', 'shadowDistance', 0, 300, 0.5, 'px')}
                        {number('Angle', 'shadowAngle', -360, 360, 1, '°')}
                    </>
                ) : null}
            </PanelSection>

            <PanelSection title="Background" actions={<input type="checkbox" checked={text.backgroundEnabled}
                                                             onChange={(event) => commit({backgroundEnabled: event.target.checked})}/>}>
                {text.backgroundEnabled ? (
                    <>
                        {color('Color', 'backgroundColor')}
                        {number('Opacity', 'backgroundOpacity', 0, 100, 1, '%')}
                        {number('Padding', 'backgroundPadding', 0, 300, 1, 'px')}
                        {number('Corner radius', 'backgroundRadius', 0, 300, 1, 'px')}
                    </>
                ) : null}
            </PanelSection>

        </div>
    );
}
