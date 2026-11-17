// Text clips (titles). The settings are plain data. The page draws them onto a canvas,
// and that picture is used by the preview and sent to the export, so both look the same.

export type TextAlign = 'left' | 'center' | 'right';
export type StrokePosition = 'outside' | 'center' | 'inside';

export interface TextSettings {
    content: string;
    fontFamily: string;
    fontSize: number;          // pixels of a 1080 high frame
    fontWeight: number;        // 100..900
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    uppercase: boolean;
    smallCaps: boolean;
    letterSpacing: number;     // pixels
    lineHeight: number;        // 1 = the font size
    align: TextAlign;
    boxWidth: number;          // percent of the frame width where lines wrap. 0 = never wrap
    color: string;
    fillOpacity: number;       // 0..100
    strokeEnabled: boolean;
    strokeColor: string;
    strokeWidth: number;
    strokePosition: StrokePosition;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowOpacity: number;     // 0..100
    shadowBlur: number;
    shadowDistance: number;
    shadowAngle: number;       // degrees, 0 = right, 90 = down
    backgroundEnabled: boolean;
    backgroundColor: string;
    backgroundOpacity: number; // 0..100
    backgroundPadding: number;
    backgroundRadius: number;
}

export const DEFAULT_TEXT_DURATION = 5;

/**
 * A long list of families. The panel only shows the ones that are installed on this computer. A font can name look-alikes in
 * "fallbacks", which are tried in order before the generic family (Century Gothic, for example, is not on every system).
 */
export const FONT_FAMILIES: { name: string; generic: 'sans-serif' | 'serif' | 'monospace' | 'cursive' | 'fantasy'; fallbacks?: string[] }[] = [
    { name: 'Inter', generic: 'sans-serif' },
    { name: 'Segoe UI', generic: 'sans-serif' },
    { name: 'Segoe UI Black', generic: 'sans-serif' },
    { name: 'Helvetica Neue', generic: 'sans-serif' },
    { name: 'Helvetica', generic: 'sans-serif' },
    { name: 'Arial', generic: 'sans-serif' },
    { name: 'Arial Black', generic: 'sans-serif' },
    { name: 'Arial Narrow', generic: 'sans-serif' },
    { name: 'Verdana', generic: 'sans-serif' },
    { name: 'Tahoma', generic: 'sans-serif' },
    { name: 'Trebuchet MS', generic: 'sans-serif' },
    { name: 'Calibri', generic: 'sans-serif' },
    { name: 'Candara', generic: 'sans-serif' },
    { name: 'Corbel', generic: 'sans-serif' },
    { name: 'Century Gothic', generic: 'sans-serif', fallbacks: ['URW Gothic', 'Avant Garde', 'ITC Avant Garde Gothic', 'Questrial'] },
    { name: 'Gill Sans', generic: 'sans-serif' },
    { name: 'Futura', generic: 'sans-serif' },
    { name: 'Avenir', generic: 'sans-serif' },
    { name: 'Avenir Next', generic: 'sans-serif' },
    { name: 'Optima', generic: 'sans-serif' },
    { name: 'Franklin Gothic Medium', generic: 'sans-serif' },
    { name: 'Lucida Sans', generic: 'sans-serif' },
    { name: 'Geneva', generic: 'sans-serif' },
    { name: 'Myriad Pro', generic: 'sans-serif' },
    { name: 'Frutiger', generic: 'sans-serif' },
    { name: 'Univers', generic: 'sans-serif' },
    { name: 'Roboto', generic: 'sans-serif' },
    { name: 'Open Sans', generic: 'sans-serif' },
    { name: 'Montserrat', generic: 'sans-serif' },
    { name: 'Lato', generic: 'sans-serif' },
    { name: 'Poppins', generic: 'sans-serif' },
    { name: 'Nunito', generic: 'sans-serif' },
    { name: 'Raleway', generic: 'sans-serif' },
    { name: 'Oswald', generic: 'sans-serif' },
    { name: 'Bebas Neue', generic: 'sans-serif' },
    { name: 'Anton', generic: 'sans-serif' },
    { name: 'Questrial', generic: 'sans-serif' },
    { name: 'Josefin Sans', generic: 'sans-serif' },
    { name: 'Quicksand', generic: 'sans-serif' },
    { name: 'Barlow', generic: 'sans-serif' },
    { name: 'Fira Sans', generic: 'sans-serif' },
    { name: 'Rubik', generic: 'sans-serif' },
    { name: 'Karla', generic: 'sans-serif' },
    { name: 'Cabin', generic: 'sans-serif' },
    { name: 'Work Sans', generic: 'sans-serif' },
    { name: 'DM Sans', generic: 'sans-serif' },
    { name: 'Manrope', generic: 'sans-serif' },
    { name: 'Ubuntu', generic: 'sans-serif' },
    { name: 'Noto Sans', generic: 'sans-serif' },
    { name: 'Source Sans Pro', generic: 'sans-serif' },
    { name: 'Impact', generic: 'sans-serif' },
    { name: 'Haettenschweiler', generic: 'sans-serif' },
    { name: 'Times New Roman', generic: 'serif' },
    { name: 'Georgia', generic: 'serif' },
    { name: 'Palatino Linotype', generic: 'serif' },
    { name: 'Palatino', generic: 'serif' },
    { name: 'Book Antiqua', generic: 'serif' },
    { name: 'Bookman Old Style', generic: 'serif' },
    { name: 'Garamond', generic: 'serif' },
    { name: 'Baskerville', generic: 'serif' },
    { name: 'Didot', generic: 'serif' },
    { name: 'Bodoni MT', generic: 'serif' },
    { name: 'Cambria', generic: 'serif' },
    { name: 'Constantia', generic: 'serif' },
    { name: 'Century', generic: 'serif' },
    { name: 'Century Schoolbook', generic: 'serif' },
    { name: 'Rockwell', generic: 'serif' },
    { name: 'Perpetua', generic: 'serif' },
    { name: 'Hoefler Text', generic: 'serif' },
    { name: 'Playfair Display', generic: 'serif' },
    { name: 'Merriweather', generic: 'serif' },
    { name: 'Lora', generic: 'serif' },
    { name: 'Cormorant Garamond', generic: 'serif' },
    { name: 'Noto Serif', generic: 'serif' },
    { name: 'Libre Baskerville', generic: 'serif' },
    { name: 'Consolas', generic: 'monospace' },
    { name: 'Courier New', generic: 'monospace' },
    { name: 'Menlo', generic: 'monospace' },
    { name: 'Monaco', generic: 'monospace' },
    { name: 'Lucida Console', generic: 'monospace' },
    { name: 'JetBrains Mono', generic: 'monospace' },
    { name: 'Fira Code', generic: 'monospace' },
    { name: 'Cascadia Code', generic: 'monospace' },
    { name: 'Source Code Pro', generic: 'monospace' },
    { name: 'SF Mono', generic: 'monospace' },
    { name: 'Roboto Mono', generic: 'monospace' },
    { name: 'Ubuntu Mono', generic: 'monospace' },
    { name: 'Comic Sans MS', generic: 'cursive' },
    { name: 'Brush Script MT', generic: 'cursive' },
    { name: 'Segoe Script', generic: 'cursive' },
    { name: 'Lucida Handwriting', generic: 'cursive' },
    { name: 'Ink Free', generic: 'cursive' },
    { name: 'Bradley Hand', generic: 'cursive' },
    { name: 'Snell Roundhand', generic: 'cursive' },
    { name: 'Pacifico', generic: 'cursive' },
    { name: 'Lobster', generic: 'cursive' },
    { name: 'Dancing Script', generic: 'cursive' },
    { name: 'Caveat', generic: 'cursive' },
    { name: 'Satisfy', generic: 'cursive' },
    { name: 'Papyrus', generic: 'fantasy' },
    { name: 'Copperplate', generic: 'fantasy' },
    { name: 'Chalkduster', generic: 'fantasy' },
    { name: 'Jokerman', generic: 'fantasy' },
    { name: 'Showcard Gothic', generic: 'fantasy' },
    { name: 'Stencil', generic: 'fantasy' },
    { name: 'Bauhaus 93', generic: 'fantasy' },
    { name: 'Algerian', generic: 'fantasy' },
    { name: 'Broadway', generic: 'fantasy' },
    { name: 'Harrington', generic: 'fantasy' },
    { name: 'Magneto', generic: 'fantasy' },
    { name: 'Old English Text MT', generic: 'fantasy' },
    { name: 'Luminari', generic: 'fantasy' },
];

export const FONT_WEIGHTS: { value: number; label: string }[] = [
    { value: 100, label: 'Thin' },
    { value: 200, label: 'Extra Light' },
    { value: 300, label: 'Light' },
    { value: 400, label: 'Regular' },
    { value: 500, label: 'Medium' },
    { value: 600, label: 'Semi Bold' },
    { value: 700, label: 'Bold' },
    { value: 800, label: 'Extra Bold' },
    { value: 900, label: 'Black' }
];

export function genericFamilyOf(name: string): string {
    return FONT_FAMILIES.find((family) => family.name === name)?.generic ?? 'sans-serif';
}

/** The CSS font-family value for a name: "Georgia", serif. Look-alike fonts come before the generic family. */
export function fontStackFor(name: string): string {
    const entry = FONT_FAMILIES.find((family) => family.name === name);
    const names = [name, ...(entry?.fallbacks ?? [])].map((item) => `"${item.replace(/["\\]/g, '')}"`);

    return `${names.join(', ')}, ${genericFamilyOf(name)}`;
}

export function defaultText(content = 'Your Title Here'): TextSettings {
    return {
        content,
        fontFamily: 'Inter',
        fontSize: 96,
        fontWeight: 700,
        italic: false,
        underline: false,
        strikethrough: false,
        uppercase: false,
        smallCaps: false,
        letterSpacing: 0,
        lineHeight: 1.2,
        align: 'center',
        boxWidth: 80,
        color: '#ffffff',
        fillOpacity: 100,
        strokeEnabled: false,
        strokeColor: '#000000',
        strokeWidth: 6,
        strokePosition: 'outside',
        shadowEnabled: true,
        shadowColor: '#000000',
        shadowOpacity: 60,
        shadowBlur: 12,
        shadowDistance: 8,
        shadowAngle: 60,
        backgroundEnabled: false,
        backgroundColor: '#000000',
        backgroundOpacity: 60,
        backgroundPadding: 24,
        backgroundRadius: 12
    };
}

export function normalizeText(raw: Partial<TextSettings> | null | undefined): TextSettings | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    return {...defaultText(), ...raw};
}

/** A key for the drawn picture. When the key is the same, the picture is the same. */
export function textKey(text: TextSettings, width: number, height: number): string {
    return `${width}x${height}:${JSON.stringify(text)}`;
}
