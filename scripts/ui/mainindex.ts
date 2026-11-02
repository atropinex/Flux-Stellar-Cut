import {app, Menu} from 'electron';
import {join} from 'path';
import {SettingsModel} from '../common/models/SettingsModel';
import {ThemeModel} from '../common/models/ThemeModel';
import {KeybindModel} from '../common/models/KeybindModel';
import {ProjectModel} from '../common/models/ProjectModel';
import {AutosaveModel} from '../common/models/AutosaveModel';
import {FfmpegModel} from '../common/models/FfmpegModel';
import {MediaModel} from '../common/models/MediaModel';
import {ExportModel} from '../common/models/ExportModel';
import {StellarWindowController} from '../common/stellar/controller/StellarWindowController';
import {StellarConnectionController} from '../common/stellar/controller/StellarConnectionController';
import {StellarProjectController} from '../common/stellar/controller/StellarProjectController';
import {StellarMediaController} from '../common/stellar/controller/StellarMediaController';
import {StellarExportController} from '../common/stellar/controller/StellarExportController';
import {StellarProtocolController, registerMediaScheme} from '../common/stellar/controller/StellarProtocolController';
import {StellarIPC} from '../common/stellar/StellarConnection';
import {PROJECT_EXTENSION} from '../common/stellar/StellarConfig';

// The custom address for media files has to be announced before the app is ready.
registerMediaScheme();

// Only one copy may run, otherwise two copies would fight over the same settings files.
if (!app.requestSingleInstanceLock()) {
    app.quit();
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null); // the page draws its own menu bar

    const userData = app.getPath('userData');
    const cacheFolder = join(userData, 'cache');

    const settings = new SettingsModel(userData);
    const themes = new ThemeModel(join(userData, 'themes'));
    const keybinds = new KeybindModel(userData);
    const projects = new ProjectModel(userData);
    const autosaves = new AutosaveModel(projects, () => settings.get().autosaveMaxVersions);
    const ffmpeg = new FfmpegModel();

    const windows = new StellarWindowController(themes, settings);
    const media = new MediaModel(
        ffmpeg,
        cacheFolder,
        () => settings.get(),
        (source) => windows.broadcast(StellarIPC.proxyProgress, source)
    );
    const exporter = new ExportModel(ffmpeg);

    windows.register();
    new StellarConnectionController(settings, themes, keybinds, windows).register();
    new StellarProjectController(projects, autosaves, settings).register();
    new StellarMediaController(media).register();
    new StellarExportController(exporter).register();
    new StellarProtocolController(cacheFolder).register();

    // Double-clicking a project file starts the app with its path.
    const projectArgument = process.argv.find((argument) => argument.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`));

    if (projectArgument) {
        windows.openEditor(projectArgument);
    } else {
        windows.showLauncher();
    }

    app.on('second-instance', (_event, argv) => {
        const path = argv.find((argument) => argument.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`));

        if (path) {
            windows.openEditor(path);
        } else {
            windows.showLauncher();
        }
    });

    app.on('activate', () => windows.showLauncher());
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
