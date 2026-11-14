import appIcon from '../../../../build/icon.png';

/** The app icon, shown in the title bar and on the launcher. */
export default function StellarAppLogo({size}: {size: number}) {
    return <img src={appIcon} width={size} height={size} alt="Flux-Stellar-Cut" draggable={false} style={{display: 'block', objectFit: 'contain'}} />;
}
