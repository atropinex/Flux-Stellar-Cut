import {useEffect, useState} from 'react';
import type {LaunchContext} from '../../../common/stellar/StellarContract';
import StellarLauncher from '../launcher/StellarLauncher';
import StellarEditor from '../editor/StellarEditor';

/** Shows the launcher (project view) or the editor, depending on which window this is. */
export default function StellarApp() {
    const [context, setContext] = useState<LaunchContext | null>(null);

    useEffect(() => {
        void window.api.getLaunchContext().then(setContext);
    }, []);

    if (!context) {
        return null;
    }

    if (context.view === 'editor' && context.projectPath) {
        return <StellarEditor projectPath={context.projectPath}/>;
    }

    return <StellarLauncher/>;
}
