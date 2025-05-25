// @ts-check
import {getDestDir} from './paths.js';
import {PLATFORM} from './platform.js';
import * as reload from './reload.js';
import {createTask} from './task.js';
import {writeFile} from './utils.js';

/** @typedef {import('./types').HTMLEntry} HTMLEntry */

/**
 * Generates an HTML string for an entry.
 * @param {string} platform
 * @param {string} title
 * @param {boolean} hasLoader
 * @param {boolean} hasStyleSheet
 */
function html(platform, title, hasLoader, hasStyleSheet) {
    return [
        '<!DOCTYPE html>',
        '<html>',
        '    <head>',
        '        <meta charset="utf-8" />',
        `        <title>${title}</title>`,
        ...(hasStyleSheet ? [
            '        <meta name="theme-color" content="#0B2228" />',
            '        <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '        <link rel="preconnect" href="https://darkreader.org" />',
            '        <link rel="stylesheet" type="text/css" href="style.css" />',
            '        <link',
            '            rel="shortcut icon"',
            '            href="../assets/images/darkreader-icon-256x256.webp"',
            '        />',
        ] : []),
        '        <script src="index.js" defer></script>',
        '    </head>',
        '',
        ...(hasLoader ? [
            '    <body>',
            '        <div class="loader">',
            '            <label class="loader__message">Loading, please wait</label>',
            '        </div>',
            '    </body>',
        ] : [
            '    <body></body>',
        ]),
        '</html>',
        '',
    ].join('\r\n');
}

/** @type {HTMLEntry[]} */
const htmlEntries = [
    {
        reloadType: reload.FULL,
        title: 'Dark Reader background',
        hasLoader: false,
        path: 'background/index.html',
        hasStyleSheet: false,
    },
    {
        platforms: [PLATFORM.CHROMIUM_MV3],
        title: 'Dark Reader settings',
        path: 'ui/popup/index.html',
        hasLoader: true,
        hasStyleSheet: true,
        hasCompatibilityCheck: false,
        reloadType: reload.UI,
    },
    {
        title: 'Dark Reader settings',
        path: 'ui/options/index.html',
        hasLoader: false,
        hasStyleSheet: true,
        hasCompatibilityCheck: false,
        reloadType: reload.UI,
    },
    {
        title: 'Dark Reader developer tools',
        path: 'ui/devtools/index.html',
        hasLoader: false,
        hasStyleSheet: true,
        hasCompatibilityCheck: false,
        reloadType: reload.UI,
    },
    {
        title: 'Dark Reader CSS editor',
        path: 'ui/stylesheet-editor/index.html',
        hasLoader: false,
        hasStyleSheet: true,
        hasCompatibilityCheck: false,
        reloadType: reload.UI,
    },
];

/**
 * Writes an HTML entry to the file system.
 * @param {HTMLEntry} entry
 * @param {{debug: boolean, platform: string}} options
 */
async function writeEntry({path, title, hasLoader, hasStyleSheet}, {debug, platform}) {
    const destDir = getDestDir({debug, platform});
    const d = `${destDir}/${path}`;
    await writeFile(d, html(platform, title, hasLoader, hasStyleSheet));
}

/**
 * Creates the bundle-html task.
 * @param {HTMLEntry[]} htmlEntries
 * @returns {ReturnType<typeof createTask>}
 */
export function createBundleHTMLTask(htmlEntries) {
    const bundleHTML = async ({platforms, debug}) => {
        const promises = [];
        const enabledPlatforms = Object.values(PLATFORM).filter(
            (platform) => platform !== PLATFORM.API && platforms[platform]
        );
        for (const entry of htmlEntries) {
            if (entry.platforms && !entry.platforms.some((platform) => platforms[platform])) {
                continue;
            }
            for (const platform of enabledPlatforms) {
                if (entry.platforms === undefined || entry.platforms.includes(platform)) {
                    promises.push(writeEntry(entry, {debug, platform}));
                }
            }
        }
        await Promise.all(promises);
    };

    return createTask(
        'bundle-html',
        bundleHTML,
    );
}

export default createBundleHTMLTask(htmlEntries);
