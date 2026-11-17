import {FONT_FAMILIES} from '../../../common/stellar/StellarText';

// Finds out which of the listed fonts are installed on this computer, by drawing a sample with the font and with a plain
// fallback. If the width differs, the font exists. The picture is drawn by the same canvas as the text clips, so what shows here is what renders.

const SAMPLE = 'mmmmmmmmmwwwwwwlli0O1 gjpqQ';
const BASES = ['monospace', 'serif', 'sans-serif'];

let context: CanvasRenderingContext2D | null = null;
const known = new Map<string, boolean>();

function isInstalled(name: string): boolean {
    const cached = known.get(name);

    if (cached !== undefined) {
        return cached;
    }

    context ??= document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

    const found = BASES.some((base) => {
        context!.font = `72px ${base}`;

        const plain = context!.measureText(SAMPLE).width;

        context!.font = `72px "${name}", ${base}`;

        return context!.measureText(SAMPLE).width !== plain;
    });

    known.set(name, found);

    return found;
}

/** The listed fonts that this computer has, with a look-alike counting too. The font that is already in use is always kept. */
export function installedFonts(keep?: string): typeof FONT_FAMILIES {
    return FONT_FAMILIES.filter((family) => family.name === keep || [family.name, ...(family.fallbacks ?? [])].some(isInstalled));
}
