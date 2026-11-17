import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import {editorStore, getShownSequence} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {undo} from '../../controller/project/StellarProject.Controller';
import {findClip} from '../../controller/timeline/StellarTimeline.Controller';
import {addTextClip, updateText} from '../../controller/timeline/StellarClipEdit.Controller';
import styles from './StellarTextOverlay.module.css';

// The Type tool. Click on the Program monitor to start a line of text there, or drag to draw a box that the text wraps in.
// You type straight into it. The letters themselves are drawn by the preview, this only shows the caret and the outline.

const DRAG_START = 6;      // px the pointer must move before a click turns into a box
const MIN_BOX_WIDTH = 24;  // px, a smaller box counts as a click
const REFERENCE_HEIGHT = 1080; // font sizes are pixels of a frame this high

interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface Editing {
    clipId: string;
    mode: 'point' | 'box';
    rect: Rect; // for a point, width and height are 0 and left / top is the middle of the text
}

export default function StellarTextOverlay({stageWidth, stageHeight}: {stageWidth: number; stageHeight: number}) {
    const sequence = useStore(editorStore, (state) => getShownSequence(state));
    const tool = useStore(editorStore, (state) => state.tool);
    const [dragBox, setDragBox] = useState<Rect | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [value, setValue] = useState('');
    const layerRef = useRef<HTMLDivElement>(null);
    const startRef = useRef<{x: number; y: number} | null>(null);
    const editingRef = useRef<Editing | null>(null);
    const valueRef = useRef('');

    /** Ends the typing. An empty box is thrown away, so a click never leaves an empty text clip behind. */
    function finishEditing() {
        const current = editingRef.current;

        if (!current) {
            return;
        }

        editingRef.current = null;
        setEditing(null);

        if (valueRef.current.trim() === '') {
            undo(); // takes back the "Add text" step
        } else {
            updateText([current.clipId], {content: valueRef.current}, true);
        }
    }

    useEffect(() => {
        if (tool !== 'text') {
            finishEditing();
        }
    }, [tool]);

    if (tool !== 'text' || !sequence || stageWidth <= 0) {
        return null;
    }

    const unit = sequence.settings.width / stageWidth; // sequence pixels for one pixel of the monitor

    function pointOf(event: ReactPointerEvent): {x: number; y: number} {
        const bounds = (layerRef.current as HTMLDivElement).getBoundingClientRect();

        return {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
    }

    function begin(clipId: string | null, mode: Editing['mode'], rect: Rect) {
        if (!clipId) {
            return;
        }

        const next: Editing = {clipId, mode, rect};

        editingRef.current = next;
        valueRef.current = '';
        setValue('');
        setEditing(next);
    }

    function onPointerDown(event: ReactPointerEvent) {
        if (event.button !== 0) {
            return;
        }

        finishEditing();
        startRef.current = pointOf(event);
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: ReactPointerEvent) {
        const start = startRef.current;

        if (!start) {
            return;
        }

        const point = pointOf(event);

        if (!dragBox && Math.hypot(point.x - start.x, point.y - start.y) < DRAG_START) {
            return;
        }

        setDragBox({
            left: Math.max(0, Math.min(start.x, point.x)),
            top: Math.max(0, Math.min(start.y, point.y)),
            width: Math.min(stageWidth, Math.max(start.x, point.x)) - Math.max(0, Math.min(start.x, point.x)),
            height: Math.min(stageHeight, Math.max(start.y, point.y)) - Math.max(0, Math.min(start.y, point.y))
        });
    }

    function onPointerUp() {
        const start = startRef.current;
        const box = dragBox;

        startRef.current = null;
        setDragBox(null);

        if (!start) {
            return;
        }

        if (box && box.width >= MIN_BOX_WIDTH) {
            // A box: the text wraps at its width, starts at its left edge, and is centered in its height.
            const middleX = box.left + box.width / 2;
            const middleY = box.top + box.height / 2;
            const id = addTextClip('', {
                x: (middleX - stageWidth / 2) * unit,
                y: (middleY - stageHeight / 2) * unit,
                boxWidth: Math.min(100, (box.width / stageWidth) * 100),
                align: 'left'
            });

            begin(id, 'box', box);

            return;
        }

        // A click: one line of text, centered on the point.
        const id = addTextClip('', {x: (start.x - stageWidth / 2) * unit, y: (start.y - stageHeight / 2) * unit, boxWidth: 0, align: 'center'});

        begin(id, 'point', {left: start.x, top: start.y, width: 0, height: 0});
    }

    const clip = editing ? findClip(sequence, editing.clipId) : undefined;
    const text = clip?.text;
    const scale = stageHeight / REFERENCE_HEIGHT;

    return (
        <div
            ref={layerRef}
            className={styles.layer}
            data-theme="StellarTextOverlay.layer"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {dragBox ? <div className={styles.dragBox} style={dragBox} /> : null}

            {editing && text ? (
                <div
                    className={editing.mode === 'box' ? styles.editorBox : styles.editorPoint}
                    style={editing.mode === 'box'
                        ? {left: editing.rect.left, top: editing.rect.top, width: editing.rect.width, height: editing.rect.height}
                        : {left: editing.rect.left, top: editing.rect.top}}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <textarea
                        autoFocus
                        className={`${styles.textarea} ${editing.mode === 'box' ? styles.textareaBox : styles.textareaPoint}`}
                        value={value}
                        rows={1}
                        spellCheck={false}
                        style={{
                            fontFamily: `"${text.fontFamily}", sans-serif`,
                            fontWeight: text.fontWeight,
                            fontStyle: text.italic ? 'italic' : 'normal',
                            fontSize: Math.max(8, text.fontSize * scale),
                            lineHeight: text.lineHeight,
                            letterSpacing: text.letterSpacing * scale,
                            textAlign: text.align,
                            caretColor: text.color
                        }}
                        onChange={(event) => {
                            valueRef.current = event.target.value;
                            setValue(event.target.value);
                            updateText([editing.clipId], {content: event.target.value}, false);
                        }}
                        onBlur={finishEditing}
                        onKeyDown={(event) => {
                            event.stopPropagation(); // typing letters must not trigger hotkeys such as V or Space

                            if (event.key === 'Escape') {
                                finishEditing();
                            }
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}
