
import process from 'node:process';

import bundleAPI from './bundle-api.js';
import bundleCSS from './bundle-css.js';
import bundleHTML from './bundle-html.js';
import bundleJS from './bundle-js.js';
import bundleLocales from './bundle-locales.js';
import bundleManifest from './bundle-manifest.js';
import clean from './clean.js';
import codeStyle from './code-style.js';
import copy from './copy.js';
import saveLog from './log.js';
import {PLATFORM} from './platform.js';
import * as reload from './reload.js';
import {runTasks} from './task.js';
import {log} from './utils.js';
import zip from './zip.js';

const standardTask = [
    clean,
    bundleHTML,
    bundleJS,
    bundleCSS,
    bundleLocales,
    bundleManifest,
    copy,
    saveLog,
];

const buildTask = [
    ...standardTask,
    codeStyle,
    zip,
];

async function build({platforms, debug, watch, log: logging, test, version}) {
    log.ok('BUILD');
    platforms = {
        ...platforms,
        [PLATFORM.API]: false,
    };
    try {
        await runTasks(debug ? standardTask : buildTask, {platforms, debug, watch, log: logging, test, version});
        if (watch) {
            standardTask.forEach((task) => task.watch(platforms));
            reload.reload({type: reload.FULL});
            log.ok('Watching...');
        } else {
            log.ok('MISSION PASSED! RESPECT +');
        }
    } catch (err) {
        console.log(err);
        log.error(`MISSION FAILED!`);
        process.exit(13);
    }
}

async function api(debug, watch) {
    log.ok('API');
    try {
        const tasks = [bundleAPI];
        if (!debug) {
            tasks.push(codeStyle);
        }
        await runTasks(tasks, {platforms: {[PLATFORM.API]: true}, debug, watch, log: false, test: false, version: '1.0.0'});
        if (watch) {
            bundleAPI.watch();
            log.ok('Watching...');
        }
        log.ok('MISSION PASSED! RESPECT +');
    } catch (err) {
        console.log(err);
        log.error(`MISSION FAILED!`);
        process.exit(13);
    }
}

async function run({release, debug, platforms, watch, log, test}) {
    const regular = Object.keys(platforms).some((platform) => platform !== PLATFORM.API && platforms[platform]);
    if (release && regular) {
        await build({platforms, debug: false, watch: false, log: null, test: false, version: '1.0.0'});
    }
    if (debug && regular) {
        await build({platforms, debug, watch, log, test, version: '1.0.0'});
    }
    if (platforms[PLATFORM.API]) {
        await api(debug, watch);
    }
}

function getParams(args) {
    const argMap = {
        '--api': PLATFORM.API,
        '--chrome-mv3': PLATFORM.CHROMIUM_MV3,
    };
    const platforms = {
        [PLATFORM.CHROMIUM_MV3]: false,
    };
    let allPlatforms = true;
    for (const arg of args) {
        if (argMap[arg]) {
            platforms[argMap[arg]] = true;
            allPlatforms = false;
        }
    }
    if (allPlatforms) {
        Object.keys(platforms).forEach((platform) => platforms[platform] = true);
    }

    const release = args.includes('--release');
    const debug = args.includes('--debug');
    const watch = args.includes('--watch');
    const logInfo = watch && args.includes('--log-info');
    const logWarn = watch && args.includes('--log-warn');
    const logAssert = watch && args.includes('--log-assert');
    const log = logWarn ? 'warn' : (logInfo ? 'info' : (logAssert ? 'assert' : null));
    const test = args.includes('--test');

    return {release, debug, platforms, watch, log, test};
}

const args = process.argv.slice(2);
const params = getParams(args);
run(params);
