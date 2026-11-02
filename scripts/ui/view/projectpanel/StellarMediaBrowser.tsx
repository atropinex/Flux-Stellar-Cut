import {useEffect, useState} from 'react';
import type {DirectoryListing} from '../../../common/CommonInteface';
import {ALL_MEDIA_EXTENSIONS} from '../../../common/stellar/StellarConfig';
import {formatBytes} from '../../../common/utils/StellarTimeHelper';
import {importPaths} from '../../controller/project/StellarMedia.Controller';
import {BUTTON_GHOST} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';

// A small file browser. Double-click a folder to open it, or a media file to bring it into the project.

function extensionOf(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
}

export default function StellarMediaBrowser() {
    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [onlyMedia, setOnlyMedia] = useState(true);

    function open(path: string | null) {
        void window.api.listDirectory(path).then(setListing);
    }

    useEffect(() => {
        open(null);
    }, []);

    if (!listing) {
        return <div className="p-4 text-[12px] text-dim">Loading...</div>;
    }

    const entries = listing.entries.filter((entry) => entry.isDirectory || !onlyMedia || ALL_MEDIA_EXTENSIONS.includes(extensionOf(entry.name)));

    return (
        <div className="flex h-full flex-col" data-theme="StellarMediaBrowser.panel">
            <div className="flex items-center gap-1 border-b border-line p-2">
                <button type="button" className={BUTTON_GHOST} title="Up one folder" disabled={!listing.parent}
                        onClick={() => open(listing.parent)}>
                    <StellarIcon name="chevronDown" size={14} className="rotate-180"/>
                </button>
                <select className="max-w-[40%] rounded-md border border-line bg-deep px-1.5 py-1 text-[12px]" value=""
                        onChange={(event) => event.target.value && open(event.target.value)}>
                    <option value="">Places...</option>
                    {listing.roots.map((root) => <option key={root.path} value={root.path}>{root.name}</option>)}
                </select>
                <span className="min-w-0 flex-1 truncate px-1 text-[11px] text-dim"
                      title={listing.path}>{listing.path}</span>
                <label className="flex items-center gap-1 text-[11px] text-dim">
                    <input type="checkbox" checked={onlyMedia}
                           onChange={(event) => setOnlyMedia(event.target.checked)}/>
                    Media only
                </label>
            </div>

            {listing.error ? <p className="px-3 py-2 text-[12px] text-danger">{listing.error}</p> : null}

            <div className="min-h-0 flex-1 overflow-auto p-1.5">
                {entries.map((entry) => (
                    <div
                        key={entry.path}
                        className="flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-surface"
                        onDoubleClick={() => (entry.isDirectory ? open(entry.path) : void importPaths([entry.path], null))}
                        title={entry.isDirectory ? 'Double-click to open' : 'Double-click to import'}
                    >
                        <StellarIcon name={entry.isDirectory ? 'folder' : 'film'} size={15}
                                     className={entry.isDirectory ? 'text-warning' : 'text-video-clip'}/>
                        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                        {!entry.isDirectory ?
                            <span className="shrink-0 text-[11px] text-dim">{formatBytes(entry.size)}</span> : null}
                    </div>
                ))}
                {entries.length === 0 && !listing.error ?
                    <p className="p-4 text-center text-[12px] text-dim">Nothing to show in this folder.</p> : null}
            </div>
        </div>
    );
}
