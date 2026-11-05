import {useState} from 'react';
import {EFFECT_CATEGORIES, EFFECTS} from '../../../common/stellar/StellarEffects';
import {applyEffect} from '../../controller/timeline/StellarTimelineActions.Controller';
import {openContextMenu} from '../../controller/contextmenu/StellarContextMenu.Controller';
import StellarIcon from '../common/StellarIcon';
import {INPUT} from '../common/StellarStyles';
import {EFFECT_DRAG_TYPE} from '../timeline/StellarTimelineConstants';
import styles from './StellarEffectsPanel.module.css';

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
        <div className={styles.panel} data-theme="StellarEffects.panel">
            <div className={styles.div}>
                <StellarIcon name="search" size={13} className={styles.textStellarIcon} />
                <input className={`${styles.input} ${INPUT}`} placeholder="Search effects" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className={styles.div2}>
                {EFFECT_CATEGORIES.map((category) => {
                    const items = EFFECTS.filter((effect) => effect.category === category && (!search || effect.label.toLowerCase().includes(search)));

                    if (items.length === 0) {
                        return null;
                    }

                    const isClosed = closed.has(category) && !search;

                    return (
                        <div key={category} className={styles.div3}>
                            <button type="button" className={styles.rowButton} onClick={() => toggle(category)}>
                                <StellarIcon name={isClosed ? 'chevronRight' : 'chevronDown'} size={12} />
                                {category}
                            </button>
                            {isClosed
                                ? null
                                : items.map((effect) => (
                                      <div
                                          key={effect.kind}
                                          draggable
                                          className={styles.row}
                                          onDragStart={(event) => event.dataTransfer.setData(EFFECT_DRAG_TYPE, effect.kind)}
                                          onDoubleClick={() => applyEffect(effect.kind)}
                                          onContextMenu={(event) => openContextMenu(event, [{id: 'apply', label: 'Apply to Selected Clips', action: () => applyEffect(effect.kind)}])}
                                      >
                                          <StellarIcon name="fx" size={13} className={effect.appliesTo === 'video' ? styles.textStellarIconVariant : styles.textStellarIconVariant2} />
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
