import {editorStore, getActiveSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {formatFrameRate} from '../../../common/utils/StellarTimeHelper';

function clockOf(time: number | null): string {
    return time ? new Date(time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
}

/** The thin line at the bottom: sequence settings and the save state. */
export default function StellarStatusBar() {
    const sequence = useStore(editorStore, (state) => getActiveSequence(state));
    const dirty = useStore(editorStore, (state) => state.dirty);
    const savedAt = useStore(editorStore, (state) => state.savedAt);
    const autosavedAt = useStore(editorStore, (state) => state.autosavedAt);
    const autosaveEnabled = useStore(editorStore, (state) => state.settings.autosaveEnabled);
    const sources = useStore(editorStore, (state) => state.playbackSources);
    const building = Object.values(sources).filter((source) => source.mode === 'building');

    return (
        <footer className="relative z-10 flex h-7 shrink-0 items-center gap-4 px-4 text-[11px] text-dim"
                data-theme="StellarStatusBar.root">
            <span>{sequence ? `${sequence.name}  ·  ${sequence.settings.width}x${sequence.settings.height}  ·  ${formatFrameRate(sequence.settings.frameRate)}` : 'No sequence'}</span>
            {building.length > 0 ?
                <span className="text-warning">Preparing {building.length} file{building.length === 1 ? '' : 's'} for smooth playback...</span> : null}
            <span className="ml-auto">
                {dirty ? 'Unsaved changes' : savedAt ? `Saved ${clockOf(savedAt)}` : ''}
                {autosaveEnabled && autosavedAt ? `  ·  Auto-saved ${clockOf(autosavedAt)}` : ''}
            </span>
        </footer>
    );
}
