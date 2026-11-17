import type {StrokePosition, TextAlign, TextSettings} from '../../../common/stellar/StellarText';
import {FONT_WEIGHTS} from '../../../common/stellar/StellarText';
import {PATH} from '../../../common/stellar/StellarAnimation';
import {resolveClip} from '../../../common/stellar/StellarEvaluate';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {installedFonts} from '../../controller/graphics/StellarFonts';
import {measureTextBlock} from '../../controller/graphics/StellarGraphics';
import {findClip} from '../../controller/timeline/StellarTimeline.Controller';
import {addTextClip, commitProperties, previewProperties, updateText} from '../../controller/timeline/StellarClipEdit.Controller';
import {BUTTON_PRIMARY, INPUT} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';
import {CheckField, ColorField, EmptyPanel, FieldRow, NumberField, PanelSection} from '../common/StellarFields';
import styles from './StellarTextPanel.module.css';

// The look of a text clip, laid out like Essential Graphics in Premiere Pro:
// Align and Transform on top, then the Text settings, then the Appearance (fill, stroke, background, shadow).

const ALIGNMENTS: { id: TextAlign; label: string }[] = [{id: 'left', label: 'Left'}, {id: 'center', label: 'Center'}, {id: 'right', label: 'Right'}];
const STROKE_POSITIONS: StrokePosition[] = ['outside', 'center', 'inside'];

type FrameAlign = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

const FRAME_ALIGNS: { id: FrameAlign; label: string; shapes: string }[] = [
    {id: 'left', label: 'Align left', shapes: 'M3 2v16M5 5h11v4H5zM5 11h7v4H5z'},
    {id: 'centerX', label: 'Align center horizontally', shapes: 'M10 2v16M3 5h14v4H3zM5 11h10v4H5z'},
    {id: 'right', label: 'Align right', shapes: 'M17 2v16M4 5h11v4H4zM8 11h7v4H8z'},
    {id: 'top', label: 'Align top', shapes: 'M2 3h16M5 5h4v11H5zM11 5h4v7h-4z'},
    {id: 'centerY', label: 'Align center vertically', shapes: 'M2 10h16M5 3h4v14H5zM11 5h4v10h-4z'},
    {id: 'bottom', label: 'Align bottom', shapes: 'M2 17h16M5 4h4v11H5zM11 8h4v7h-4z'}
];

export default function StellarTextPanel() {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const selection = useStore(editorStore, (state) => state.selection);
    const playhead = useStore(editorStore, (state) => state.playhead);
    const clip = sequence && selection[0] ? findClip(sequence, selection[0]) : undefined;
    const text = clip?.text;

    if (!clip || !text || !sequence) {
        return (
            <EmptyPanel icon={<StellarIcon name="text" size={28} />}>
                <p className={styles.p}>Select a text clip to change how it looks. To make one, pick the Type tool (T) and click or drag on the Program monitor.</p>
                <button type="button" className={BUTTON_PRIMARY} onClick={() => addTextClip()}>
                    <StellarIcon name="plus" size={14} /> Add Text
                </button>
            </EmptyPanel>
        );
    }

    const ids = selection.filter((id) => findClip(sequence, id)?.text);
    const motion = resolveClip(clip, playhead).motion;
    const frameWidth = sequence.settings.width;
    const frameHeight = sequence.settings.height;
    const live = (change: Partial<TextSettings>) => updateText(ids, change, false);
    const commit = (change: Partial<TextSettings>) => updateText(ids, change, true);

    /** Moves the text box so that its edge or middle lines up with the frame. */
    function alignToFrame(kind: FrameAlign) {
        const block = measureTextBlock(text as TextSettings, frameWidth, frameHeight);
        const halfWidth = (block.width * motion.scale) / 200;
        const halfHeight = (block.height * motion.scale) / 200;
        const values: Record<string, number> = {
            left: {[PATH.x]: -frameWidth / 2 + halfWidth},
            centerX: {[PATH.x]: 0},
            right: {[PATH.x]: frameWidth / 2 - halfWidth},
            top: {[PATH.y]: -frameHeight / 2 + halfHeight},
            centerY: {[PATH.y]: 0},
            bottom: {[PATH.y]: frameHeight / 2 - halfHeight}
        }[kind];

        commitProperties('Align text', ids, values);
    }

    function transform(label: string, path: string, value: number, min: number, max: number, step: number, unit = '', decimals = 0, offset = 0) {
        // Position is shown from the top left corner of the frame, like in Premiere Pro. It is stored from the middle.
        return (
            <NumberField
                label={label} value={value + offset} min={min} max={max} step={step} unit={unit} decimals={decimals}
                onLive={(next) => previewProperties(ids, {[path]: next - offset})}
                onCommit={(next) => commitProperties(`Change ${label.toLowerCase()}`, ids, {[path]: next - offset})}
            />
        );
    }

    function number(label: string, key: keyof TextSettings, min: number, max: number, step = 1, unit = '', decimals = step < 1 ? 1 : 0) {
        return (
            <NumberField
                label={label} value={text?.[key] as number} min={min} max={max} step={step} unit={unit} decimals={decimals}
                onLive={(next) => live({[key]: next})} onCommit={(next) => commit({[key]: next})}
            />
        );
    }

    function color(label: string, key: keyof TextSettings) {
        return <ColorField label={label} value={text?.[key] as string} onLive={(next) => live({[key]: next})} onCommit={(next) => commit({[key]: next})} />;
    }

    const fonts = installedFonts(text.fontFamily);
    const firstLine = text.content.split('\n')[0] || 'Empty text';

    return (
        <div className={styles.panel} data-theme="StellarText.panel">
            <div className={styles.layer} title={text.content}>
                <StellarIcon name="text" size={14} />
                <span className={styles.layerName}>{firstLine}</span>
                {ids.length > 1 ? <span className={styles.layerCount}>+{ids.length - 1}</span> : null}
            </div>

            <PanelSection title="Align and Transform">
                <div className={styles.alignRow}>
                    {FRAME_ALIGNS.map((item) => (
                        <button key={item.id} type="button" title={item.label} className={styles.alignButton} onClick={() => alignToFrame(item.id)}>
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                                <path d={item.shapes} />
                            </svg>
                        </button>
                    ))}
                </div>
                {transform('Position X', PATH.x, motion.x, -100000, 100000, 1, 'px', 1, frameWidth / 2)}
                {transform('Position Y', PATH.y, motion.y, -100000, 100000, 1, 'px', 1, frameHeight / 2)}
                {transform('Scale', PATH.scale, motion.scale, 1, 800, 1, '%', 1)}
                {transform('Rotation', PATH.rotation, motion.rotation, -3600, 3600, 1, '°', 1)}
                {transform('Opacity', PATH.opacity, motion.opacity, 0, 100, 1, '%', 0)}
            </PanelSection>

            <PanelSection title="Text">
                <div className={styles.div}>
                    <textarea
                        className={`${styles.textarea} ${INPUT}`}
                        value={text.content}
                        onChange={(event) => live({content: event.target.value})}
                        onBlur={(event) => commit({content: event.target.value})}
                    />
                </div>
                <FieldRow label="Font">
                    <select
                        className={INPUT}
                        value={text.fontFamily}
                        style={{fontFamily: `"${text.fontFamily}"`}}
                        onChange={(event) => commit({fontFamily: event.target.value})}
                    >
                        {(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'] as const).filter((generic) => fonts.some((family) => family.generic === generic)).map((generic) => (
                            <optgroup key={generic} label={generic}>
                                {fonts.filter((family) => family.generic === generic).map((family) => (
                                    <option key={family.name} value={family.name} style={{fontFamily: `"${family.name}", ${generic}`}}>{family.name}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </FieldRow>
                <FieldRow label="Weight">
                    <select className={INPUT} value={text.fontWeight} onChange={(event) => commit({fontWeight: Number(event.target.value)})}>
                        {FONT_WEIGHTS.map((weight) => <option key={weight.value} value={weight.value}>{weight.label}</option>)}
                    </select>
                </FieldRow>
                {number('Size', 'fontSize', 4, 1000, 1, 'px')}
                <FieldRow label="Align">
                    <div className={styles.row2}>
                        {ALIGNMENTS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`${styles.textButton2} ${text.align === item.id ? styles.textButtonVariant : styles.buttonVariant}`}
                                onClick={() => commit({align: item.id})}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </FieldRow>
                <FieldRow label="Style">
                    <div className={styles.row}>
                        {([['italic', 'I'], ['underline', 'U'], ['strikethrough', 'S'], ['uppercase', 'TT'], ['smallCaps', 'Tt']] as const).map(([key, glyph]) => (
                            <button
                                key={key}
                                type="button"
                                title={key}
                                className={`${styles.textButton} ${text[key] ? styles.textButtonVariant : styles.buttonVariant}`}
                                onClick={() => commit({[key]: !text[key]})}
                            >
                                {glyph}
                            </button>
                        ))}
                    </div>
                </FieldRow>
                {number('Tracking', 'letterSpacing', -50, 200, 0.5, 'px')}
                {number('Leading', 'lineHeight', 0.5, 4, 0.05, '', 2)}
                <CheckField
                    label="Wrapping"
                    checked={text.boxWidth > 0}
                    text={text.boxWidth > 0 ? 'Wrap text' : 'One line'}
                    onChange={(checked) => commit({boxWidth: checked ? 80 : 0})}
                />
                {text.boxWidth > 0 ? number('Wrap width', 'boxWidth', 1, 100, 1, '%') : null}
            </PanelSection>

            <PanelSection title="Appearance">
                {color('Fill', 'color')}
                {number('Fill opacity', 'fillOpacity', 0, 100, 1, '%')}
            </PanelSection>

            <PanelSection title="Stroke" actions={<input type="checkbox" checked={text.strokeEnabled} onChange={(event) => commit({strokeEnabled: event.target.checked})} />}>
                {text.strokeEnabled ? (
                    <>
                        {color('Color', 'strokeColor')}
                        {number('Width', 'strokeWidth', 0, 100, 0.5, 'px')}
                        <FieldRow label="Position">
                            <select className={INPUT} value={text.strokePosition} onChange={(event) => commit({strokePosition: event.target.value as StrokePosition})}>
                                {STROKE_POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                            </select>
                        </FieldRow>
                    </>
                ) : null}
            </PanelSection>

            <PanelSection title="Background" actions={<input type="checkbox" checked={text.backgroundEnabled} onChange={(event) => commit({backgroundEnabled: event.target.checked})} />}>
                {text.backgroundEnabled ? (
                    <>
                        {color('Color', 'backgroundColor')}
                        {number('Opacity', 'backgroundOpacity', 0, 100, 1, '%')}
                        {number('Padding', 'backgroundPadding', 0, 300, 1, 'px')}
                        {number('Corner radius', 'backgroundRadius', 0, 300, 1, 'px')}
                    </>
                ) : null}
            </PanelSection>

            <PanelSection title="Shadow" actions={<input type="checkbox" checked={text.shadowEnabled} onChange={(event) => commit({shadowEnabled: event.target.checked})} />}>
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
        </div>
    );
}
