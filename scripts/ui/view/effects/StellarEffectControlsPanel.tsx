import {type ReactNode} from 'react';
import type {Clip} from '../../../common/stellar/StellarContract';
import {findEffect} from '../../../common/stellar/StellarEffects';
import {PATH} from '../../../common/stellar/StellarAnimation';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {findClip, findTrack} from '../../controller/timeline/StellarTimeline.Controller';
import {openContextMenu} from '../../controller/contextmenu/StellarContextMenu.Controller';
import {addMask, removeEffectOf, removeMask, setTransitionDuration, toggleEffectOf, updateMask} from '../../controller/timeline/StellarClipEdit.Controller';
import {createMask, type Mask, type MaskShape} from '../../../common/stellar/StellarMask';
import {maskUiStore, selectMask} from '../../controller/timeline/StellarMaskUi.Controller';
import {setTool} from '../../controller/timeline/StellarTimelineActions.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarScrubNumber from '../common/StellarScrubNumber';
import StellarPropertyRow from './StellarPropertyRow';
import styles from './StellarEffectControlsPanel.module.css';

// The settings of the selected clip. Every number can be dragged sideways or typed, and can be keyframed.



function Section({title, children, actions}: {title: string; children: ReactNode; actions?: ReactNode}) {
    return (
        <div className={styles.section} data-theme="StellarEffectControls.section">
            <div className={styles.row}>
                {title}
                <div className={styles.div}>{actions}</div>
            </div>
            {children}
        </div>
    );
}

function Row({label, children, hint}: {label: string; children: ReactNode; hint?: string}) {
    return (
        <div className={styles.row2} title={hint}>
            <span className={styles.textSpan}>{label}</span>
            {children}
        </div>
    );
}

function MaskNumber({label, mask, clip, field, min, max, step = 1, unit = '', decimals = 0}: {
    label: string; mask: Mask; clip: Clip; field: 'feather' | 'expansion' | 'opacity' | 'rotation'; min: number; max: number; step?: number; unit?: string; decimals?: number;
}) {
    return (
        <Row label={label}>
            <StellarScrubNumber
                value={mask[field]} min={min} max={max} step={step} unit={unit} decimals={decimals}
                onChange={(next) => updateMask(clip.id, mask.id, {[field]: next}, false)}
                onCommit={(next) => updateMask(clip.id, mask.id, {[field]: next}, true)}
                onReset={() => updateMask(clip.id, mask.id, {[field]: createMask(mask.shape)[field]}, true)}
            />
        </Row>
    );
}

function MaskSection({clip}: {clip: Clip}) {
    const selectedId = useStore(maskUiStore, (state) => state.selectedMaskId);
    const masks = clip.masks ?? [];

    function add(shape: MaskShape) {
        if (shape === 'polygon') {
            setTool('pen');
            return;
        }

        const mask = createMask(shape);

        addMask(clip.id, mask);
        selectMask(mask.id);
    }

    return (
        <Section
            title="Masks"
            actions={
                <div className={styles.row3}>
                    <button type="button" title="Ellipse mask" className={styles.textButton} onClick={() => add('ellipse')}>Ellipse</button>
                    <button type="button" title="Rectangle mask" className={styles.textButton} onClick={() => add('rectangle')}>Rectangle</button>
                    <button type="button" title="Draw a shape with the Pen tool on the Program monitor" className={styles.rowButton} onClick={() => add('polygon')}>
                        <StellarIcon name="pen" size={11} /> Pen
                    </button>
                </div>
            }
        >
            {masks.length === 0 ? <p className={styles.textP}>Add a shape, or pick the Pen tool and click points on the Program monitor. Click the first point to close the shape.</p> : null}
            {masks.map((mask) => (
                <div key={mask.id} className={`${styles.div2} ${selectedId === mask.id ? styles.divId : ''}`}>
                    <div className={styles.row4}>
                        <input type="checkbox" title="Turn on or off" checked={mask.enabled} onChange={(event) => updateMask(clip.id, mask.id, {enabled: event.target.checked}, true)} />
                        <button type="button" className={styles.textButton2} onClick={() => selectMask(selectedId === mask.id ? null : mask.id)}>
                            {mask.name}
                        </button>
                        <label className={styles.rowLabel}>
                            <input type="checkbox" checked={mask.inverted} onChange={(event) => updateMask(clip.id, mask.id, {inverted: event.target.checked}, true)} />
                            Inverted
                        </label>
                        <button type="button" className={styles.textButton3} title="Delete mask" onClick={() => removeMask(clip.id, mask.id)}>
                            <StellarIcon name="trash" size={12} />
                        </button>
                    </div>
                    {selectedId === mask.id ? (
                        <>
                            <MaskNumber label="Feather" mask={mask} clip={clip} field="feather" min={0} max={500} step={0.5} unit="px" decimals={1} />
                            <MaskNumber label="Expansion" mask={mask} clip={clip} field="expansion" min={-500} max={500} step={0.5} unit="px" decimals={1} />
                            <MaskNumber label="Opacity" mask={mask} clip={clip} field="opacity" min={0} max={100} unit="%" />
                            {mask.shape !== 'polygon' ? <MaskNumber label="Rotation" mask={mask} clip={clip} field="rotation" min={-360} max={360} unit="°" /> : null}
                            {mask.shape === 'polygon' ? (
                                <Row label="Corners">
                                    <label className={styles.rowLabel2}>
                                        <input type="checkbox" checked={mask.smooth} onChange={(event) => updateMask(clip.id, mask.id, {smooth: event.target.checked}, true)} />
                                        Rounded
                                    </label>
                                </Row>
                            ) : null}
                        </>
                    ) : null}
                </div>
            ))}
        </Section>
    );
}

export default function StellarEffectControlsPanel() {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const selection = useStore(editorStore, (state) => state.selection);
    const clipId = selection[0];
    const clip = sequence && clipId ? findClip(sequence, clipId) : undefined;
    const track = sequence && clip ? findTrack(sequence, clip.trackId) : undefined;

    if (!sequence || !clip || !track) {
        return (
            <div className={styles.panel} data-theme="StellarEffectControls.panel">
                <StellarIcon name="fx" size={28} />
                <p className={styles.textP2}>Select a clip on the timeline to change its settings.</p>
            </div>
        );
    }

    const ids = selection;
    const isVideo = track.type === 'video';
    const isText = Boolean(clip.text);

    return (
        <div className={styles.panel2} data-theme="StellarEffectControls.panel">
            <div className={styles.div3}>
                <div className={styles.text}>{clip.name}</div>
                <div className={styles.text2}>
                    {selection.length > 1 ? `${selection.length} clips selected. Changes apply to all.` : `${track.name} · ${isText ? 'Text' : clip.nestId ? 'Nested sequence' : isVideo ? 'Video' : 'Audio'}`}
                </div>
            </div>

            <div>
                {isVideo ? (
                    <Section title="Motion">
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.x} />
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.y} />
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.anchorX} />
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.anchorY} />
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.scale} />
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.rotation} />
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.opacity} />
                    </Section>
                ) : null}

                <Section title="Audio">
                    <StellarPropertyRow clip={clip} ids={ids} path={PATH.volume} />
                    <StellarPropertyRow clip={clip} ids={ids} path={PATH.pan} />
                </Section>


                <Section title="Effects">
                    {clip.effects.length === 0 ? <p className={styles.textP}>Drag an effect from the Effects panel onto the clip, or double-click it.</p> : null}
                    {clip.effects.map((effect) => {
                        const definition = findEffect(effect.kind);
                        const isTransition = Boolean(definition?.edge);

                        return (
                            <div
                                key={effect.id}
                                className={styles.div2}
                                onContextMenu={(event) => openContextMenu(event, [{id: 'remove', label: 'Remove', danger: true, action: () => removeEffectOf(ids, effect.id)}])}
                            >
                                <div className={styles.row4}>
                                    <button
                                        type="button"
                                        title="Turn on or off"
                                        className={`${styles.textButton4} ${effect.enabled ? styles.textButtonEnabled : styles.textButtonNotEnabled}`}
                                        onClick={() => toggleEffectOf(ids, effect.id)}
                                    >
                                        fx
                                    </button>
                                    <span className={styles.textSpan2}>{definition?.label ?? effect.kind}</span>
                                    {isTransition ? <span className={styles.textSpan3}>{definition?.edge === 'in' ? 'Start of clip' : 'End of clip'}</span> : null}
                                    <button type="button" className={styles.textButton5} title="Remove" onClick={() => removeEffectOf(ids, effect.id)}>
                                        <StellarIcon name="close" size={12} />
                                    </button>
                                </div>

                                {isTransition ? (
                                    <Row label="Duration">
                                        <StellarScrubNumber
                                            value={effect.params['duration'] ?? 1} min={0.05} max={Math.max(0.05, clip.duration)} step={0.05} unit="s" decimals={2}
                                            onChange={(next) => setTransitionDuration(clip.id, effect.id, next, false)}
                                            onCommit={(next) => setTransitionDuration(clip.id, effect.id, next, true)}
                                            onReset={() => setTransitionDuration(clip.id, effect.id, Math.min(1, clip.duration / 2), true)}
                                        />
                                    </Row>
                                ) : (
                                    definition?.params.map((param) => (
                                        <StellarPropertyRow key={param.key} clip={clip} ids={ids} path={`effect.${effect.id}.${param.key}`} />
                                    ))
                                )}
                            </div>
                        );
                    })}
                </Section>

                {isVideo ? <MaskSection clip={clip} /> : null}
            </div>
        </div>
    );
}
