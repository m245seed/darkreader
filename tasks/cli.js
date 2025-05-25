
 
import {fork} from 'node:child_process';
import {join} from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {log} from './utils.js';

const __filename = join(fileURLToPath(import.meta.url), '../build.js');

async function executeChildProcess(args) {
    const child = fork(__filename, args);
    
    process.on('SIGINT', () => {
        child.kill('SIGKILL');
    });

    child.on('exit', (code) => {
        process.exit(code);
    });

    child.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
        process.stderr.write(data);
    });
}

(async () => {
    const args = process.argv.slice(2);
    const validFlags = ['--debug', '--watch', '--log', '--test', '--platform'];

    const invalidFlags = args.filter((flag) => !validFlags.includes(flag));
    if (invalidFlags.length > 0) {
        console.error(`Invalid flags: ${invalidFlags.join(', ')}`);
        process.exit(1);
    }

    await executeChildProcess(args);
})();
