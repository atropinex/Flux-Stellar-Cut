import {createStore} from '../store/StellarStore';

// The right-click menu. Any view can open it with a list of items. The menu itself is drawn once, in StellarContextMenu.tsx.

export interface ContextMenuItem {
    id: string;
    label: string;
    hotkey?: string;        // shown on the right, for information only
    disabled?: boolean;
    checked?: boolean;
    danger?: boolean;
    separator?: boolean;
    children?: ContextMenuItem[];
    action?: () => void;
}

export interface ContextMenuState {
    open: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
}

export const contextMenuStore = createStore<ContextMenuState>({open: false, x: 0, y: 0, items: []});

export function openContextMenu(event: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void }, items: ContextMenuItem[]): void {
    event.preventDefault();
    event.stopPropagation();
    contextMenuStore.set({open: true, x: event.clientX, y: event.clientY, items});
}

export function openMenuAt(x: number, y: number, items: ContextMenuItem[]): void {
    contextMenuStore.set({open: true, x, y, items});
}

export function closeContextMenu(): void {
    if (contextMenuStore.get().open) {
        contextMenuStore.set({open: false});
    }
}

export function separator(id: string): ContextMenuItem {
    return {id, label: '', separator: true};
}
