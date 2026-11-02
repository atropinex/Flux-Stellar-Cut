import {editorStore} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';

/** The color and gradient layers behind the glass panels. They come from the "background" section of the YAML theme. */
export default function StellarBackground() {
    const theme = useStore(editorStore, (state) => state.theme);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" data-theme="StellarBackground.root"
             style={{background: 'var(--sc-base)'}}>
            {(theme?.layers ?? []).map((layer, index) => (
                <div
                    key={index}
                    className="absolute inset-0"
                    style={{
                        backgroundImage: layer.type === 'image' ? `url("${layer.value}")` : layer.value,
                        backgroundSize: layer.size,
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        opacity: layer.opacity,
                        filter: layer.blur > 0 ? `blur(${layer.blur}px)` : undefined
                    }}
                />
            ))}
        </div>
    );
}
