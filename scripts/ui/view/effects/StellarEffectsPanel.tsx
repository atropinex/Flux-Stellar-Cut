import {useState} from 'react';
import {EFFECT_CATEGORIES, EFFECTS} from '../../../common/stellar/StellarEffects';
import {applyEffect} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openContextMenu} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import {INPUT} from '../common/StellarStyles';
import {EFFECT_DRAG_TYPE} from '../timeline/StellarTimelineConstants';

/** All effects and transitions. Double-click one to put it on the selected clips, or drag it onto a clip. */
export default function StellarEffectsPanel() {
    const [query, setQuery] = useState('');
    const [closed, setClosed] = useState<Set<string>>(new Set());
    const search = query.trim().toLowerCase();

    function toggle(category: string) {
        setClosed((current) => {
            const next = new Set(current);

            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }

            return next;
        });
    }

    return (
        <div className="flex h-full flex-col" data-theme="StellarEffects.panel">
            <div className="relative border-b border-line p-2">
                <StellarIcon name="search" size={13} className="absolute left-4 top-4 text-dim"/>
                <input className={`${INPUT} py-1 pl-7`} placeholder="Search effects" value={query}
                       onChange={(event) => setQuery(event.target.value)}/>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-1.5">
                {EFFECT_CATEGORIES.map((category) => {
                    const items = EFFECTS.filter((effect) => effect.category === category && (!search || effect.label.toLowerCase().includes(search)));

                    if (items.length === 0) {
                        return null;
                    }

                    const isClosed = closed.has(category) && !search;

                    return (
                        <div key={category} className="mb-1">
                            <button type="button"
                                    className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-dim hover:text-ink"
                                    onClick={() => toggle(category)}>
                                <StellarIcon name={isClosed ? 'chevronRight' : 'chevronDown'} size={12}/>
                                {category}
                            </button>
                            {isClosed
                                ? null
                                : items.map((effect) => (
                                    <div
                                        key={effect.kind}
                                        draggable
                                        className="flex cursor-grab items-center gap-2 rounded-md px-2.5 py-1 text-[12px] hover:bg-surface-hover"
                                        onDragStart={(event) => event.dataTransfer.setData(EFFECT_DRAG_TYPE, effect.kind)}
                                        onDoubleClick={() => applyEffect(effect.kind)}
                                        onContextMenu={(event) => openContextMenu(event, [{
                                            id: 'apply',
                                            label: 'Apply to Selected Clips',
                                            action: () => applyEffect(effect.kind)
                                        }])}
                                    >
                                        <StellarIcon name="fx" size={13}
                                                     className={effect.appliesTo === 'video' ? 'text-video-clip' : 'text-audio-clip'}/>
                                        {effect.label}
                                    </div>
                                ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
