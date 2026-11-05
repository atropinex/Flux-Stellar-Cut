import styles from './StellarIcon.module.css';
// Small line icons (24x24 grid). Each one is a list of SVG paths.
const ICONS = {
    play: 'M7 4.5v15l12-7.5z',
    pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
    stepBack: 'M6 5v14M19 5v14L9 12z',
    stepForward: 'M18 5v14M5 5v14l10-7z',
    goStart: 'M5 5v14M19 6l-9 6 9 6z',
    goEnd: 'M19 5v14M5 6l9 6-9 6z',
    loop: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
    markIn: 'M9 4v16M9 4h8M9 12h5',
    markOut: 'M15 4v16M15 4H7M15 12h-5',
    marker: 'M6 4h12v10l-6 6-6-6z',
    insert: 'M12 3v12M7 10l5 5 5-5M4 20h16',
    overwrite: 'M12 3v10M7 8l5 5 5-5M4 17h16M4 21h16',
    lift: 'M4 20h16M8 14V4h8v10M12 8v6',
    extract: 'M4 20h16M7 4l5 6 5-6M12 10v6',
    selection: 'M5 3l14 8-6 2-2 6z',
    trackSelect: 'M4 6h8M4 12h8M4 18h8M15 9l5 3-5 3z',
    ripple: 'M5 4v16M9 8l-4 4 4 4M13 7h7M13 12h7M13 17h7',
    razor: 'M5 19L19 5M8 8l-3-3M19 19l-5-5',
    hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2-3a1.4 1.4 0 0 1 2-2l2 2',
    zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M11 8v6M8 11h6',
    folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    folderPlus: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9 13h6',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
    music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    image: 'M4 4h16v16H4zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM20 16l-5-5L5 20',
    sequence: 'M3 6h18M3 12h12M3 18h16',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12l5 5 9-10',
    chevronRight: 'M9 6l6 6-6 6',
    chevronDown: 'M6 9l6 6 6-6',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    eyeOff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 7.6A17 17 0 0 0 2 12s4 6 10 6a9.7 9.7 0 0 0 3.4-.6',
    volume: 'M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7',
    volumeOff: 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-2',
    solo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 15c.5 1 1.7 1.5 3 1.5 1.7 0 3-.8 3-2.2 0-2.7-6-1.3-6-4 0-1.2 1.2-2 3-2 1.2 0 2.200.4 2.700 1.200',
    link: 'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1',
    magnet: 'M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0zM5 8h4M15 8h4',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    save: 'M5 3h11l4 4v14H5zM8 3v6h7V3M8 21v-7h8v7',
    export: 'M12 3v12M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
    import: 'M12 15V3M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1.500-2-3.400-2.300.8a7 7 0 0 0-1.700-1L14.500 4h-4L10 6.900a7 7 0 0 0-1.700 1L6 7.100 4 10.500 6 12a7 7 0 0 0 0 2l-2 1.500 2 3.400 2.300-.8a7 7 0 0 0 1.700 1l.5 2.900h4l.5-2.900a7 7 0 0 0 1.700-1l2.300.8 2-3.400L19 14a7 7 0 0 0 0-2z',
    fx: 'M4 18l5-12M4 12h6M13 8l6 10M19 8l-6 10',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    reveal: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    minimize: 'M5 12h14',
    maximize: 'M5 5h14v14H5z',
    restore: 'M8 8V4h12v12h-4M4 8h12v12H4z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    warning: 'M12 4L2 20h20zM12 10v4M12 17h.01',
    sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
    history: 'M3 12a9 9 0 1 0 3-6.700L3 8M3 3v5h5M12 7v5l3 2',
    keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
    palette: 'M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2-.5-1 0-2 1.500-2h2a3 3 0 0 0 3-3 9 9 0 0 0-8-11zM7.500 11h.01M10 7h.01M15 7h.01',
    film2: 'M4 5h16v14H4zM4 9h16',
    scissors: 'M6 6a3 3 0 1 0 0 .01zM6 18a3 3 0 1 0 0 .01zM8.500 8.500L20 20M8.500 15.500L20 4',
    expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    text: 'M5 6V4h14v2M12 4v16M9 20h6',
    pen: 'M12 19l7-7-3-3-7 7zM9 16l-4 4 1-5M16 9l2-2a1.400 1.400 0 0 1 2 2l-2 2',
    mask: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 0 0 0 10z',
    meter: 'M5 20V10M10 20V4M15 20V13M20 20V7'
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
    name: IconName;
    size?: number;
    className?: string;
    filled?: boolean;
}

export default function StellarIcon({name, size = 16, className = '', filled = false}: IconProps) {
    return (
        <svg
            className={`${styles.boxSvg} ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={ICONS[name]} />
        </svg>
    );
}
