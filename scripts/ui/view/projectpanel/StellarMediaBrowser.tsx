import {useEffect, useState} from 'react';
import type {DirectoryListing} from '../../../common/CommonInteface';
import {ALL_MEDIA_EXTENSIONS} from '../../../common/stellar/StellarConfig';
import {formatBytes} from '../../../common/utils/StellarTimeHelper';
import {importPaths} from '../../controller/project/StellarMedia.Controller';
import {BUTTON_GHOST} from '../common/StellarStyles';
import StellarIcon from '../common/StellarIcon';
import styles from './StellarMediaBrowser.module.css';

// A small file browser. Double-click a folder to open it, or a media file to bring it into the project.

function extensionOf(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
}

export default function StellarMediaBrowser() {
    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [onlyMedia, setOnlyMedia] = useState(true);

    async function open(path: string | null) {
        try {
            setListing(await window.api.listDirectory(path));
        } catch (error) {
            // A folder that cannot be read shows a message, and the rest of the app keeps working.
            setListing({path: path ?? '', parent: null, entries: [], roots: [], error: error instanceof Error ? error.message : String(error)});
        }
    }

    useEffect(() => {
        void open(null);
    }, []);

    if (!listing) {
        return <div className={styles.text}>Loading...</div>;
    }

    const entries = listing.entries.filter((entry) => entry.isDirectory || !onlyMedia || ALL_MEDIA_EXTENSIONS.includes(extensionOf(entry.name)));

    return (
        <div className={styles.panel} data-theme="StellarMediaBrowser.panel">
            <div className={styles.row}>
                <button type="button" className={BUTTON_GHOST} title="Up one folder" disabled={!listing.parent} onClick={() => open(listing.parent)}>
                    <StellarIcon name="chevronDown" size={14} className={styles.stellarIcon} />
                </button>
                <select className={styles.textSelect} value="" onChange={(event) => event.target.value && open(event.target.value)}>
                    <option value="">Places...</option>
                    {listing.roots.map((root) => <option key={root.path} value={root.path}>{root.name}</option>)}
                </select>
                <span className={styles.textSpan} title={listing.path}>{listing.path}</span>
                <label className={styles.rowLabel}>
                    <input type="checkbox" checked={onlyMedia} onChange={(event) => setOnlyMedia(event.target.checked)} />
                    Media only
                </label>
            </div>

            {listing.error ? <p className={styles.textP}>{listing.error}</p> : null}

            <div className={styles.div}>
                {entries.map((entry) => (
                    <div
                        key={entry.path}
                        className={styles.row2}
                        onDoubleClick={() => (entry.isDirectory ? open(entry.path) : void importPaths([entry.path], null))}
                        title={entry.isDirectory ? 'Double-click to open' : 'Double-click to import'}
                    >
                        <StellarIcon name={entry.isDirectory ? 'folder' : 'film'} size={15} className={entry.isDirectory ? styles.textStellarIconIsDirectory : styles.textStellarIconNotIsDirectory} />
                        <span className={styles.textSpan2}>{entry.name}</span>
                        {!entry.isDirectory ? <span className={styles.textSpan3}>{formatBytes(entry.size)}</span> : null}
                    </div>
                ))}
                {entries.length === 0 && !listing.error ? <p className={styles.textP2}>Nothing to show in this folder.</p> : null}
            </div>
        </div>
    );
}
