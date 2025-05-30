
import {getDestDir, absolutePath} from './paths.js';
import {PLATFORM} from './platform.js';
import * as reload from './reload.js';
import {createTask} from './task.js';
import {readJSON, writeJSON} from './utils.js';

async function patchManifest(platform, debug, watch, test) {
    const manifest = await readJSON(absolutePath('src/manifest.json'));
    const manifestPatch = await readJSON(absolutePath('src/manifest-chrome-mv3.json'));
    const patched = {...manifest, ...manifestPatch};
    if (debug && platform === PLATFORM.CHROMIUM_MV3) {
        patched.name = 'Dark Reader MV3';
    }
    if (platform === PLATFORM.CHROMIUM_MV3) {
        patched.browser_action = undefined;
    }
    if (debug) {
        patched.version = '1';
        patched.description = `Debug build, platform: ${platform}, watch: ${watch ? 'yes' : 'no'}.`;
        patched.version_name = 'Debug';
    }
    
    if (test || debug) {
        patched.permissions.push('downloads');
    }
    return patched;
}

async function manifests({platforms, debug, watch, test}) {
    const enabledPlatforms = Object.values(PLATFORM).filter((platform) => platform !== PLATFORM.API && platforms[platform]);
    for (const platform of enabledPlatforms) {
        const manifest = await patchManifest(platform, debug, watch, test);
        const destDir = getDestDir({debug, platform});
        await writeJSON(`${destDir}/manifest.json`, manifest);
    }
}

const bundleManifestTask = createTask(
    'bundle-manifest',
    manifests,
).addWatcher(
    ['src/manifest.json', 'src/manifest-chrome-mv3.json'],
    async (changedFiles, _, buildPlatforms) => {
        const platforms = {[PLATFORM.CHROMIUM_MV3]: changedFiles.length > 0 && buildPlatforms[PLATFORM.CHROMIUM_MV3]};
        await manifests({platforms, debug: true, watch: true, test: false});
        reload.reload({type: reload.FULL});
    },
);

export default bundleManifestTask;
