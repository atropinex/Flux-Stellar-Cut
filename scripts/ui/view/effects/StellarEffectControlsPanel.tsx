import {type ReactNode} from 'react';
import type {Clip} from '../../../common/stellar/StellarContract';
import {findEffect} from '../../../common/stellar/StellarEffects';
import {PATH} from '../../../common/stellar/StellarAnimation';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {findClip, findTrack} from '../../controller/timeline/StellarTimeline.Controller';
import {openContextMenu} from '../../controller/contextmenu/StellarContextMenu.Controller';
import {
    addMask,
    removeEffectOf,
    removeMask,
    setTransitionDuration,
    toggleEffectOf,
    updateMask
} from '../../controller/timeline/StellarClipEdit.Controller';
import {createMask, type Mask, type MaskShape} from '../../../common/stellar/StellarMask';
import {maskUiStore, selectMask} from '../../controller/timeline/StellarMaskUi.Controller';
import {setTool} from '../../controller/timeline/StellarTimelineActions.Controller';
import StellarIcon from '../common/StellarIcon';
import StellarScrubNumber from '../common/StellarScrubNumber';
import StellarPropertyRow from './StellarPropertyRow';

// The settings of the selected clip. Every number can be dragged sideways or typed, and can be keyframed.


function Section({title, children, actions}: { title: string; children: ReactNode; actions?: ReactNode }) {
    return (
        <div className="border-b border-line py-1.5" data-theme="StellarEffectControls.section">
            <div className="flex items-center px-3 py-1 text-[12px] font-semibold">
                {title}
                <div className="ml-auto">{actions}</div>
            </div>
            {children}
        </div>
    );
}

function Row({label, children, hint}: { label: string; children: ReactNode; hint?: string }) {
    return (
        <div className="flex items-center gap-2 py-1 pl-3 pr-2" title={hint}>
            <span className="w-[100px] shrink-0 truncate pl-1 text-[12px] text-dim">{label}</span>
            {children}
        </div>
    );
}

function MaskNumber({label, mask, clip, field, min, max, step = 1, unit = '', decimals = 0}: {
    label: string;
    mask: Mask;
    clip: Clip;
    field: 'feather' | 'expansion' | 'opacity' | 'rotation';
    min: number;
    max: number;
    step?: number;
    unit?: string;
    decimals?: number;
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

function MaskSection({clip}: { clip: Clip }) {
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
                <div className="flex gap-1">
                    <button type="button" title="Ellipse mask"
                            className="rounded bg-surface px-1.5 py-0.5 text-[11px] hover:bg-surface-hover"
                            onClick={() => add('ellipse')}>Ellipse
                    </button>
                    <button type="button" title="Rectangle mask"
                            className="rounded bg-surface px-1.5 py-0.5 text-[11px] hover:bg-surface-hover"
                            onClick={() => add('rectangle')}>Rectangle
                    </button>
                    <button type="button" title="Draw a shape with the Pen tool on the Program monitor"
                            className="flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[11px] hover:bg-surface-hover"
                            onClick={() => add('polygon')}>
                        <StellarIcon name="pen" size={11}/> Pen
                    </button>
                </div>
            }
        >
            {masks.length === 0 ?
                <p className="px-3 py-2 text-[12px] text-dim">Add a shape, or pick the Pen tool and click points on the
                    Program monitor. Click the first point to close the shape.</p> : null}
            {masks.map((mask) => (
                <div key={mask.id} className={`mb-1 ${selectedId === mask.id ? 'bg-accent/10' : ''}`}>
                    <div className="flex items-center gap-2 px-3 py-1 text-[12px]">
                        <input type="checkbox" title="Turn on or off" checked={mask.enabled}
                               onChange={(event) => updateMask(clip.id, mask.id, {enabled: event.target.checked}, true)}/>
                        <button type="button"
                                className="min-w-0 flex-1 truncate text-left font-medium hover:text-accent"
                                onClick={() => selectMask(selectedId === mask.id ? null : mask.id)}>
                            {mask.name}
                        </button>
                        <label className="flex items-center gap-1 text-[11px] text-dim">
                            <input type="checkbox" checked={mask.inverted}
                                   onChange={(event) => updateMask(clip.id, mask.id, {inverted: event.target.checked}, true)}/>
                            Inverted
                        </label>
                        <button type="button" className="rounded p-0.5 text-dim hover:text-danger" title="Delete mask"
                                onClick={() => removeMask(clip.id, mask.id)}>
                            <StellarIcon name="trash" size={12}/>
                        </button>
                    </div>
                    {selectedId === mask.id ? (
                        <>
                            <MaskNumber label="Feather" mask={mask} clip={clip} field="feather" min={0} max={500}
                                        step={0.5} unit="px" decimals={1}/>
                            <MaskNumber label="Expansion" mask={mask} clip={clip} field="expansion" min={-500} max={500}
                                        step={0.5} unit="px" decimals={1}/>
                            <MaskNumber label="Opacity" mask={mask} clip={clip} field="opacity" min={0} max={100}
                                        unit="%"/>
                            {mask.shape !== 'polygon' ?
                                <MaskNumber label="Rotation" mask={mask} clip={clip} field="rotation" min={-360}
                                            max={360} unit="°"/> : null}
                            {mask.shape === 'polygon' ? (
                                <Row label="Corners">
                                    <label className="flex items-center gap-2 text-[12px]">
                                        <input type="checkbox" checked={mask.smooth}
                                               onChange={(event) => updateMask(clip.id, mask.id, {smooth: event.target.checked}, true)}/>
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
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-dim"
                 data-theme="StellarEffectControls.panel">
                <StellarIcon name="fx" size={28}/>
                <p className="text-[12px]">Select a clip on the timeline to change its settings.</p>
            </div>
        );
    }

    const ids = selection;
    const isVideo = track.type === 'video';
    const isText = Boolean(clip.text);

    return (
        <div className="h-full overflow-auto" data-theme="StellarEffectControls.panel">
            <div className="border-b border-line px-3 py-2">
                <div className="truncate text-[13px] font-medium">{clip.name}</div>
                <div className="text-[11px] text-dim">
                    {selection.length > 1 ? `${selection.length} clips selected. Changes apply to all.` : `${track.name} · ${isText ? 'Text' : clip.nestId ? 'Nested sequence' : isVideo ? 'Video' : 'Audio'}`}
                </div>
            </div>

            <div>
                {isVideo ? (
                    <Section title="Motion">
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.x}/>
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.y}/>
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.scale}/>
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.rotation}/>
                        <StellarPropertyRow clip={clip} ids={ids} path={PATH.opacity}/>
                    </Section>
                ) : null}

                <Section title="Audio">
                    <StellarPropertyRow clip={clip} ids={ids} path={PATH.volume}/>
                    <StellarPropertyRow clip={clip} ids={ids} path={PATH.pan}/>
                </Section>


                <Section title="Effects">
                    {clip.effects.length === 0 ?
                        <p className="px-3 py-2 text-[12px] text-dim">Drag an effect from the Effects panel onto the
                            clip, or double-click it.</p> : null}
                    {clip.effects.map((effect) => {
                        const definition = findEffect(effect.kind);
                        const isTransition = Boolean(definition?.edge);

                        return (
                            <div
                                key={effect.id}
                                className="mb-1"
                                onContextMenu={(event) => openContextMenu(event, [{
                                    id: 'remove',
                                    label: 'Remove',
                                    danger: true,
                                    action: () => removeEffectOf(ids, effect.id)
                                }])}
                            >
                                <div className="flex items-center gap-2 px-3 py-1 text-[12px]">
                                    <button
                                        type="button"
                                        title="Turn on or off"
                                        className={`rounded px-1 text-[10px] font-semibold italic ${effect.enabled ? 'bg-accent/30 text-accent' : 'bg-surface text-dim'}`}
                                        onClick={() => toggleEffectOf(ids, effect.id)}
                                    >
                                        fx
                                    </button>
                                    <span className="font-medium">{definition?.label ?? effect.kind}</span>
                                    {isTransition ? <span
                                        className="rounded bg-surface px-1.5 text-[10px] text-dim">{definition?.edge === 'in' ? 'Start of clip' : 'End of clip'}</span> : null}
                                    <button type="button" className="ml-auto rounded p-0.5 text-dim hover:text-danger"
                                            title="Remove" onClick={() => removeEffectOf(ids, effect.id)}>
                                        <StellarIcon name="close" size={12}/>
                                    </button>
                                </div>

                                {isTransition ? (
                                    <Row label="Duration">
                                        <StellarScrubNumber
                                            value={effect.params['duration'] ?? 1} min={0.05}
                                            max={Math.max(0.05, clip.duration)} step={0.05} unit="s" decimals={2}
                                            onChange={(next) => setTransitionDuration(clip.id, effect.id, next, false)}
                                            onCommit={(next) => setTransitionDuration(clip.id, effect.id, next, true)}
                                            onReset={() => setTransitionDuration(clip.id, effect.id, Math.min(1, clip.duration / 2), true)}
                                        />
                                    </Row>
                                ) : (
                                    definition?.params.map((param) => (
                                        <StellarPropertyRow key={param.key} clip={clip} ids={ids}
                                                            path={`effect.${effect.id}.${param.key}`}/>
                                    ))
                                )}
                            </div>
                        );
                    })}
                </Section>

                {isVideo ? <MaskSection clip={clip}/> : null}
            </div>
        </div>
    );
}
