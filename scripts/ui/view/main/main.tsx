import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '../../main.css';
import StellarApp from '../app/StellarApp';
import {initializeTheme} from '../../controller/theme/StellarTheme.Controller';

async function startApp() {
    await initializeTheme();

    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <StellarApp/>
        </StrictMode>
    );
}

void startApp();
