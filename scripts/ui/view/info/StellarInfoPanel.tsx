import {useEffect, useState} from 'react';
import type {MediaItem} from '../../../common/stellar/StellarContract';
import {formatBytes, formatDuration} from '../../../common/utils/StellarTimeHelper';
import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {setMediaMetadata} from '../../controller/project/StellarProject.Controller';
import {INPUT} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';
import {EmptyPanel, PanelSection} from '../common/StellarFields';

// The facts about a file (what the probe found), and the notes the person writes about it.

export const METADATA_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
    {key: 'title', label: 'Title'},
    {key: 'description', label: 'Description', multiline: true},
    {key: 'scene', label: 'Scene'},
    {key: 'shot', label: 'Shot'},
    {key: 'take', label: 'Take'},
    {key: 'creator', label: 'Creator'},
    {key: 'copyright', label: 'Copyright'},
    {key: 'tags', label: 'Tags (comma separated)'},
    {key: 'comment', label: 'Comment', multiline: true}
];

function Fact({label, value}: { label: string; value: string }) {
    return (
        <div className="flex gap-2 px-3 py-0.5 text-[12px]">
            <span className="w-[110px] shrink-0 text-dim">{label}</span>
            <span className="min-w-0 flex-1 break-words">{value}</span>
        </div>
    );
}

function factsOf(item: MediaItem): [string, string][] {
    const facts: [string, string][] = [
        ['File name', item.name],
        ['Path', item.path],
        ['Type', item.kind],
        ['Container', item.container || '-'],
        ['Duration', item.kind === 'image' ? 'Still' : formatDuration(item.duration)],
        ['File size', formatBytes(item.fileSize)]
    ];

    if (item.hasVideo || item.kind === 'image') {
        facts.push(['Image size', `${item.width} x ${item.height}`]);
        facts.push(['Frame rate', item.kind === 'image' ? '-' : `${Number(item.frameRate.toFixed(3))} fps`]);
        facts.push(['Video codec', item.videoCodec ?? '-']);
    }

    if (item.hasAudio) {
        facts.push(['Audio', `${item.audioCodec ?? '-'}, ${item.sampleRate / 1000} kHz, ${item.channels === 1 ? 'mono' : item.channels === 2 ? 'stereo' : `${item.channels} channels`}`]);
    }

    facts.push(['Imported', new Date(item.importedAt).toLocaleString()]);

    return facts;
}

/** Info for the first selected item of the project, with fields that are saved in the project file. */
export default function StellarInfoPanel() {
    const selectedIds = useStore(editorStore, (state) => state.selectedMediaIds);
    const media = useStore(editorStore, (state) => state.document?.media ?? []);
    const items = media.filter((item) => selectedIds.includes(item.id));
    const item = items[0];
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        setDrafts({});
    }, [selectedIds.join(',')]);

    if (!item) {
        return <EmptyPanel icon={<StellarIcon name="list" size={28}/>}>Select a file in the Project panel to see its
            information.</EmptyPanel>;
    }

    function valueOf(key: string): string {
        if (key in drafts) {
            return drafts[key];
        }

        const values = new Set(items.map((entry) => entry.metadata?.[key] ?? ''));

        return values.size === 1 ? [...values][0] : '';
    }

    function save(key: string) {
        if (!(key in drafts)) {
            return;
        }

        setMediaMetadata(items.map((entry) => entry.id), {[key]: drafts[key]});
        setDrafts((current) => {
            const next = {...current};

            delete next[key];

            return next;
        });
    }

    return (
        <div className="h-full overflow-auto" data-theme="StellarInfo.panel">
            <PanelSection title={items.length > 1 ? `${items.length} items selected` : 'Information'}>
                {items.length > 1 ?
                    <p className="px-3 pb-1 text-[11px] text-dim">Notes you type are saved on all selected
                        files.</p> : null}
                {items.length === 1 ? factsOf(item).map(([label, value]) => <Fact key={label} label={label}
                                                                                  value={value}/>) : null}
            </PanelSection>

            <PanelSection title="Metadata">
                {METADATA_FIELDS.map((field) => (
                    <div key={field.key} className="px-3 pb-2">
                        <label className="mb-0.5 block text-[11px] text-dim">{field.label}</label>
                        {field.multiline ? (
                            <textarea
                                className={`${INPUT} min-h-[52px] resize-y`} value={valueOf(field.key)}
                                onChange={(event) => setDrafts({...drafts, [field.key]: event.target.value})}
                                onBlur={() => save(field.key)}
                            />
                        ) : (
                            <input
                                className={INPUT} value={valueOf(field.key)}
                                onChange={(event) => setDrafts({...drafts, [field.key]: event.target.value})}
                                onBlur={() => save(field.key)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.currentTarget.blur();
                                    }
                                }}
                            />
                        )}
                    </div>
                ))}
            </PanelSection>
        </div>
    );
}
