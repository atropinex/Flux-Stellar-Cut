import {createStore} from '../store/StellarStore';

// Which mask is being edited. The Effect Controls list and the picture on the Program monitor share it.

export const maskUiStore = createStore<{ selectedMaskId: string | null }>({selectedMaskId: null});

export function selectMask(id: string | null): void {
    maskUiStore.set({selectedMaskId: id});
}
