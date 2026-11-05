import {activeMasks, type Mask} from '../../../common/stellar/StellarMask';
import {fontStackFor, textKey, type TextSettings} from '../../../common/stellar/StellarText';

// Draws the pictures that the page makes itself: text clips and masks.
// The same pictures are shown in the preview and sent to the export, so both look the same.

const REFERENCE_HEIGHT = 1080; // sizes in the settings are for a frame this high

function makeCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(2, Math.round(width));
    canvas.height = Math.max(2, Math.round(height));

    return canvas;
}

function rgba(hex: string, opacityPercent: number): string {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((letter) => letter + letter).join('') : clean.padEnd(6, '0');
    const red = parseInt(full.slice(0, 2), 16);
    const green = parseInt(full.slice(2, 4), 16);
    const blue = parseInt(full.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacityPercent / 100))})`;
}

// === Text === //

function fontFor(text: TextSettings, size: number): string {
    const style = text.italic ? 'italic ' : '';
    const variant = text.smallCaps ? 'small-caps ' : '';

    return `${style}${variant}${text.fontWeight} ${size}px ${fontStackFor(text.fontFamily)}`;
}

/** Breaks the text into lines: where the person pressed Enter, and where a line gets too wide. */
function layoutLines(context: CanvasRenderingContext2D, content: string, maxWidth: number): string[] {
    const lines: string[] = [];

    for (const paragraph of content.split('\n')) {
        if (maxWidth <= 0 || paragraph.length === 0) {
            lines.push(paragraph);
            continue;
        }

        let line = '';

        for (const word of paragraph.split(' ')) {
            const attempt = line ? `${line} ${word}` : word;

            if (line && context.measureText(attempt).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = attempt;
            }
        }

        lines.push(line);
    }

    return lines;
}

function roundedRectangle(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));

    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
}

/** Draws a text clip onto a see-through picture the size of the frame. The text is centered. */
export function renderTextCanvas(text: TextSettings, width: number, height: number): HTMLCanvasElement {
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    const unit = canvas.height / REFERENCE_HEIGHT;
    const size = Math.max(1, text.fontSize * unit);
    const content = text.uppercase ? text.content.toUpperCase() : text.content;

    context.font = fontFor(text, size);
    context.letterSpacing = `${text.letterSpacing * unit}px`;
    context.textBaseline = 'alphabetic';

    const boxWidth = text.boxWidth > 0 ? (canvas.width * text.boxWidth) / 100 : 0;
    const lines = layoutLines(context, content, boxWidth);
    const lineHeight = size * text.lineHeight;
    const blockHeight = lineHeight * lines.length;
    const widest = Math.max(1, ...lines.map((line) => context.measureText(line).width));
    const blockWidth = boxWidth > 0 ? Math.max(boxWidth, widest) : widest;
    const left = (canvas.width - blockWidth) / 2;
    const top = (canvas.height - blockHeight) / 2;

    // A layer for the letters, so the shadow follows the letters and not the box behind them.
    const layer = makeCanvas(canvas.width, canvas.height);
    const draw = layer.getContext('2d') as CanvasRenderingContext2D;

    draw.font = context.font;
    draw.letterSpacing = context.letterSpacing;
    draw.textBaseline = 'alphabetic';
    draw.lineJoin = 'round';
    draw.miterLimit = 2;

    const strokeWidth = Math.max(0, text.strokeWidth * unit);

    lines.forEach((line, index) => {
        const width = draw.measureText(line).width;
        const x = text.align === 'left' ? left : text.align === 'right' ? left + blockWidth - width : left + (blockWidth - width) / 2;
        const baseline = top + index * lineHeight + (lineHeight + size * 0.7) / 2;

        if (text.strokeEnabled && strokeWidth > 0 && text.strokePosition === 'outside') {
            draw.strokeStyle = text.strokeColor;
            draw.lineWidth = strokeWidth * 2;
            draw.strokeText(line, x, baseline);
        }

        draw.fillStyle = rgba(text.color, text.fillOpacity);
        draw.fillText(line, x, baseline);

        if (text.strokeEnabled && strokeWidth > 0 && text.strokePosition !== 'outside') {
            draw.save();
            draw.strokeStyle = text.strokeColor;

            if (text.strokePosition === 'inside') {
                draw.globalCompositeOperation = 'source-atop';
                draw.lineWidth = strokeWidth * 2;
            } else {
                draw.lineWidth = strokeWidth;
            }

            draw.strokeText(line, x, baseline);
            draw.restore();
        }

        const thickness = Math.max(1, size / 18);

        if (text.underline) {
            draw.fillStyle = text.color;
            draw.fillRect(x, baseline + size * 0.1, width, thickness);
        }

        if (text.strikethrough) {
            draw.fillStyle = text.color;
            draw.fillRect(x, baseline - size * 0.3, width, thickness);
        }
    });

    if (text.backgroundEnabled) {
        const padding = text.backgroundPadding * unit;

        context.fillStyle = rgba(text.backgroundColor, text.backgroundOpacity);
        roundedRectangle(context, left - padding, top - padding, blockWidth + padding * 2, blockHeight + padding * 2, text.backgroundRadius * unit);
        context.fill();
    }

    if (text.shadowEnabled) {
        const angle = (text.shadowAngle * Math.PI) / 180;

        context.save();
        context.shadowColor = rgba(text.shadowColor, text.shadowOpacity);
        context.shadowBlur = text.shadowBlur * unit;
        context.shadowOffsetX = Math.cos(angle) * text.shadowDistance * unit;
        context.shadowOffsetY = Math.sin(angle) * text.shadowDistance * unit;
        context.drawImage(layer, 0, 0);
        context.restore();
    }

    context.drawImage(layer, 0, 0);

    return canvas;
}

// === Masks === //

function traceMask(context: CanvasRenderingContext2D, mask: Mask, width: number, height: number): void {
    context.beginPath();

    if (mask.shape === 'ellipse') {
        context.ellipse(mask.cx * width, mask.cy * height, Math.max(1, (mask.width * width) / 2), Math.max(1, (mask.height * height) / 2), (mask.rotation * Math.PI) / 180, 0, Math.PI * 2);
        return;
    }

    if (mask.shape === 'rectangle') {
        context.save();
        context.translate(mask.cx * width, mask.cy * height);
        context.rotate((mask.rotation * Math.PI) / 180);
        context.rect((-mask.width * width) / 2, (-mask.height * height) / 2, mask.width * width, mask.height * height);
        context.restore();
        return;
    }

    const points = mask.points.map((point) => ({x: point.x * width, y: point.y * height}));

    if (points.length < 3) {
        return;
    }

    if (!mask.smooth) {
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
        return;
    }

    // Rounded corners: curves that pass through the middle of every side.
    const middle = (first: { x: number; y: number }, second: { x: number; y: number }) => ({x: (first.x + second.x) / 2, y: (first.y + second.y) / 2});
    const start = middle(points[points.length - 1], points[0]);

    context.moveTo(start.x, start.y);

    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const end = middle(point, next);

        context.quadraticCurveTo(point.x, point.y, end.x, end.y);
    });
    context.closePath();
}

function renderOneMask(mask: Mask, width: number, height: number): HTMLCanvasElement {
    const unit = height / REFERENCE_HEIGHT;
    const layer = makeCanvas(width, height);
    const context = layer.getContext('2d') as CanvasRenderingContext2D;

    context.fillStyle = '#ffffff';
    context.strokeStyle = '#ffffff';
    traceMask(context, mask, layer.width, layer.height);
    context.fill();

    // Growing and shrinking the shape.
    if (Math.abs(mask.expansion) > 0.01) {
        context.lineWidth = Math.abs(mask.expansion) * unit * 2;
        context.lineJoin = 'round';

        if (mask.expansion > 0) {
            traceMask(context, mask, layer.width, layer.height);
            context.stroke();
        } else {
            context.save();
            context.globalCompositeOperation = 'destination-out';
            traceMask(context, mask, layer.width, layer.height);
            context.stroke();
            context.restore();
        }
    }

    const result = makeCanvas(width, height);
    const out = result.getContext('2d') as CanvasRenderingContext2D;

    out.globalAlpha = Math.max(0, Math.min(1, mask.opacity / 100));

    if (mask.feather > 0.05) {
        out.filter = `blur(${(mask.feather * unit) / 2}px)`;
    }

    out.drawImage(layer, 0, 0);
    out.filter = 'none';
    out.globalAlpha = 1;

    if (mask.inverted) {
        const flipped = makeCanvas(width, height);
        const flip = flipped.getContext('2d') as CanvasRenderingContext2D;

        flip.fillStyle = '#ffffff';
        flip.fillRect(0, 0, flipped.width, flipped.height);
        flip.globalCompositeOperation = 'destination-out';
        flip.drawImage(result, 0, 0);

        return flipped;
    }

    return result;
}

/** All masks of a clip as one picture. White (and see-through when drawn) is what stays visible. */
export function renderMaskCanvas(masks: Mask[], width: number, height: number, asGray: boolean): HTMLCanvasElement {
    const canvas = makeCanvas(width, height);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;

    if (asGray) {
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const mask of activeMasks(masks)) {
        context.drawImage(renderOneMask(mask, canvas.width, canvas.height), 0, 0);
    }

    return canvas;
}

// === Pictures to show and to send === //

const textCache = new Map<string, string>();
const maskCache = new Map<string, string>();
const CACHE_LIMIT = 40;

function remember(cache: Map<string, string>, key: string, value: string): string {
    cache.set(key, value);

    if (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next().value;

        if (oldest !== undefined) {
            cache.delete(oldest);
        }
    }

    return value;
}

export function textImageUrl(text: TextSettings, width: number, height: number): string {
    const key = textKey(text, Math.round(width), Math.round(height));

    return textCache.get(key) ?? remember(textCache, key, renderTextCanvas(text, width, height).toDataURL('image/png'));
}

/** A mask picture for CSS "mask-image": see-through where the clip is hidden. */
export function maskImageUrl(masks: Mask[], width: number, height: number): string {
    const key = `${Math.round(width)}x${Math.round(height)}:${JSON.stringify(activeMasks(masks))}`;

    return maskCache.get(key) ?? remember(maskCache, key, renderMaskCanvas(masks, width, height, false).toDataURL('image/png'));
}

/** The base64 text of a PNG, for the export. */
export function toBase64Png(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}
