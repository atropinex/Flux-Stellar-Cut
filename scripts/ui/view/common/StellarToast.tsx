import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';

/** A short message at the bottom of the window. */
export default function StellarToast() {
    const toast = useStore(editorStore, (state) => state.toast);

    if (!toast) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-10 z-[900] flex justify-center">
            <div key={toast.id} className="glass stellar-pop rounded-full px-4 py-2 text-[12.5px] text-ink"
                 data-theme="StellarToast.panel">
                {toast.message}
            </div>
        </div>
    );
}
