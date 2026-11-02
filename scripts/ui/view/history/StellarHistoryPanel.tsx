import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {jumpToHistory} from '../../controller/project/StellarProject.Controller';

/** Every change in the project, in order. Click one to go back (or forward) to that moment. */
export default function StellarHistoryPanel() {
    const past = useStore(editorStore, (state) => state.past);
    const future = useStore(editorStore, (state) => state.future);
    const currentLabel = useStore(editorStore, (state) => state.currentLabel);
    const labels = [...past.map((entry) => entry.label), currentLabel, ...future.map((entry) => entry.label)];
    const currentIndex = past.length;

    return (
        <div className="h-full overflow-auto p-1.5" data-theme="StellarHistory.panel">
            {labels.map((label, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => jumpToHistory(index)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] ${
                        index === currentIndex ? 'bg-accent/25 text-ink' : index > currentIndex ? 'text-dim/60 hover:bg-surface' : 'text-dim hover:bg-surface hover:text-ink'
                    }`}
                >
                    <span className="w-5 text-right text-[10px] opacity-60">{index}</span>
                    <span className="truncate">{label}</span>
                </button>
            ))}
        </div>
    );
}
