import {useRef, useSyncExternalStore} from 'react';

// A very small store: one object that holds the state, plus a way to listen for changes.

export interface Store<T> {
    get: () => T;
    set: (change: Partial<T> | ((state: T) => Partial<T>)) => void;
    subscribe: (listener: () => void) => () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<() => void>();

    return {
        get: () => state,
        set: (change) => {
            const next = typeof change === 'function' ? change(state) : change;
            state = {...state, ...next};
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        }
    };
}

/** Reads a piece of the store in a component. The component renders again only when that piece changes. */
export function useStore<T extends object, S>(store: Store<T>, selector: (state: T) => S): S {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    return useSyncExternalStore(
        store.subscribe,
        () => selectorRef.current(store.get()),
        () => selectorRef.current(store.get())
    );
}
