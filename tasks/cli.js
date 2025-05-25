/**
 * This file executes build.js in a child process, this is needed for two things:
 *  1. Enable interrupts like Ctrl+C for regular builds
 *  2. Support building older versions of Dark Reader and then inserting signatures into archives
 */

// @ts-check
import {fork} from 'node:child_process';
import {join} from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {execute, log} from './utils.js';


const __filename = join(fileURLToPath(import.meta.url), '../build.js');


async function executeChildProcess(args) {
    const child = fork(__filename, args);
    // Send SIGINTs as SIGKILLs, which are not ignored
    process.on('SIGINT', () => {
        child.kill('SIGKILL');
        process.exit(130);
    });
    return new Promise((resolve, reject) => child.on('error', reject).on('close', resolve));
}

function printHelp() {
    console.log([
        'Dark Reader build utility',
        '',
        'Usage: build [build parameters]',
        '',
        'To narrow down the list of build targets (for efficiency):',
        '  --api          Library build (published to NPM)',
        '  --chrome-mv3   MV3 for Chromium-based browsers',
        '',
        'To specify type of build:',
        '  --release      Release bundle for signing prior to publication',
        '  --debug        Build for development',
        '  --watch        Incremental build for development',
        '',
        'To log errors to disk (for debugging and bug reports):',
        '  --log-info     Log lots of data',
        '  --log-warn     Log only warnings',
        '',
        'Build for testing (not to be used by humans):',
        '  --test',
    ].join('\n'));
}



function validateArguments(args) {
    const validationErrors = [];

    const validFlags = ['--api', '--chrome-mv3', '--release', '--debug', '--watch', '--log-info', '--log-warn', '--test'];
    const invalidFlags = args.filter((flag) => !validFlags.includes(flag));
    invalidFlags.forEach((flag) => validationErrors.push(`Invalid flag ${flag}`));

    return validationErrors;
}

function parseArguments(args) {
    return args;
}

async function run() {
    const args = process.argv.slice(3);

    const shouldPrintHelp = args.length === 0 || process.argv[2] !== 'build' || args.includes('-h') || args.includes('--help');
    if (shouldPrintHelp) {
        printHelp();
        process.exit(0);
    }

    const validationErrors = validateArguments(args);
    if (validationErrors.length > 0) {
        validationErrors.forEach(log.error);
        printHelp();
        process.exit(130);
    }

    const childArgs = parseArguments(args);

    await executeChildProcess(childArgs);
}

run();
