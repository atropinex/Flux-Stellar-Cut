import {wheelEventToCombo} from '../../../common/utils/StellarKeybindHelper';
import {editorStore} from '../project/StellarEditor.Store';
import {setZoom} from './StellarTimelineActions.Controller';

// Mouse wheel on the timeline, like Premiere Pro. The modifiers are hotkeys that can be changed in Settings:
//   timeline.wheelZoom    (default Alt)    zooms around the mouse
//   timeline.wheelScroll  (default Shift)  scrolls the timeline sideways
// Trackpad pinch arrives as Ctrl + wheel, so that still zooms unless Ctrl is bound to something else.
// A plain wheel is left alone, so the tracks still scroll up and down.

export type WheelAction = 'zoom' | 'pan' | 'none';

const ZOOM_SENSITIVITY = 0.0015; // one mouse-wheel notch (about 100px) is roughly a 16% zoom step
const MAX_DELTA = 300;           // stops a fast flick from jumping the zoom too far
const LINE_HEIGHT_PX = 16;

/** Which timeline action a wheel event stands for, going by the hotkeys set right now. */
export function resolveWheelAction(event: Pick<WheelEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>): WheelAction {
    const combo = wheelEventToCombo(event);

    if (!combo) {
        return 'none';
    }

    const keybinds = editorStore.get().keybinds;

    if (combo === keybinds['timeline.wheelZoom']) {
        return 'zoom';
    }

    if (combo === keybinds['timeline.wheelScroll']) {
        return 'pan';
    }

    return event.ctrlKey ? 'zoom' : 'none'; // pinch on a trackpad, and keeps the page from zooming
}

/**
 * The wheel movement in pixels. Holding Shift makes some systems (macOS, some Linux setups)
 * report the movement on the X axis instead of Y, so we take whichever axis moved the most.
 */
function wheelDelta(event: WheelEvent, pageSize: number): number {
    const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return raw * LINE_HEIGHT_PX;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return raw * pageSize;
    }

    return raw;
}

/** Zooms around the mouse so the time under the cursor stays where it is on screen. */
function zoomAtMouse(event: WheelEvent, scroller: HTMLElement, headerWidth: number): void {
    const delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, wheelDelta(event, scroller.clientWidth)));

    if (delta === 0) {
        return;
    }

    const pixelsPerSecond = editorStore.get().pixelsPerSecond;
    const anchorX = event.clientX - scroller.getBoundingClientRect().left - headerWidth;
    const anchorTime = (scroller.scrollLeft + anchorX) / pixelsPerSecond;

    // Wheel up (negative) zooms in.
    setZoom(pixelsPerSecond * Math.exp(-delta * ZOOM_SENSITIVITY), anchorTime, anchorX);
}

function panSideways(event: WheelEvent, scroller: HTMLElement): void {
    scroller.scrollLeft += wheelDelta(event, scroller.clientWidth);
}

/** Starts listening for wheel events on the timeline scroller. Returns a function that stops. */
export function attachTimelineWheel(scroller: HTMLElement, headerWidth: number): () => void {
    const listener = (event: WheelEvent) => {
        const action = resolveWheelAction(event);

        if (action === 'none') {
            return;
        }

        // Stops the browser from zooming the whole page or scrolling by itself.
        event.preventDefault();

        if (action === 'zoom') {
            zoomAtMouse(event, scroller, headerWidth);
        } else {
            panSideways(event, scroller);
        }
    };

    // Not passive, because we need preventDefault.
    scroller.addEventListener('wheel', listener, {passive: false});

    return () => scroller.removeEventListener('wheel', listener);
}
