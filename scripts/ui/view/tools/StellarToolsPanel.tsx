import {editorStore, type ToolId} from '../../controller/project/StellarEditor.Store';
import {useStore} from '../../controller/store/StellarStore';
import {setTool} from '../../controller/timeline/StellarTimelineActions.Controller';
import {hotkeyOf} from '../../controller/command/StellarCommand.Controller';
import {describeCombo} from '../../../common/utils/StellarKeybindHelper';
import StellarIcon, {type IconName} from '../common/StellarIcon';
import styles from './StellarToolsPanel.module.css';

const TOOLS: {id: ToolId; icon: IconName; label: string; command: string}[] = [
    {id: 'selection', icon: 'selection', label: 'Selection', command: 'tool.selection'},
    {id: 'trackSelect', icon: 'trackSelect', label: 'Track Select Forward', command: 'tool.trackSelect'},
    {id: 'ripple', icon: 'ripple', label: 'Ripple Edit', command: 'tool.ripple'},
    {id: 'razor', icon: 'razor', label: 'Razor', command: 'tool.razor'},
    {id: 'pen', icon: 'pen', label: 'Pen (draw a mask)', command: 'tool.pen'},
    {id: 'hand', icon: 'hand', label: 'Hand', command: 'tool.hand'},
    {id: 'zoom', icon: 'zoom', label: 'Zoom', command: 'tool.zoom'}
];

/** The tool strip next to the timeline. */
export default function StellarToolsPanel() {
    const tool = useStore(editorStore, (state) => state.tool);

    return (
        <div className={styles.panel} data-theme="StellarTools.panel">
            {TOOLS.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    title={`${item.label} (${describeCombo(hotkeyOf(item.command))})`}
                    onClick={() => setTool(item.id)}
                    className={`${styles.rowButton} ${tool === item.id ? styles.textButtonId : styles.textButtonNotId}`}
                >
                    <StellarIcon name={item.icon} size={17} />
                </button>
            ))}
        </div>
    );
}
