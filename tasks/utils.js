
import {exec} from 'node:child_process';
import {accessSync} from 'node:fs';
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';


const colors = Object.entries({
    gray: '\x1b[90m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
}).reduce((map, [key, value]) => Object.assign(map, {[key]: (text) => `${value}${text}\x1b[0m`}), {});


export async function execute(command) {
    return new Promise((resolve, reject) => exec(command, (error, stdout) => {
        if (error) {
            reject(`Failed to execute command ${command}`);
        } else {
            resolve(stdout);
        }
    }));
}


export function logWithTime(text) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const leftpad = (n) => String(n).padStart(2, '0');
    return console.log(`${colors.gray([hours, minutes, seconds].map(leftpad).join(':'))} ${text}`);
}

export const log = Object.assign((text) => logWithTime(text), {
    ok: (text) => logWithTime(colors.green(text)),
    warn: (text) => logWithTime(colors.yellow(text)),
    error: (text) => logWithTime(colors.red(text)),
});


export async function pathExists(dest) {
    try {
        await fs.access(dest);
        return true;
    } catch (err) {
        log.error(`Failed to access path: ${dest}`);
        return false;
    }
}


export function pathExistsSync(dest) {
    try {
        accessSync(dest);
        return true;
    } catch (err) {
        log.error(`Failed to access path synchronously: ${dest}`);
        return false;
    }
}


export async function removeFolder(dir) {
    if (await pathExists(dir)) {
        await fs.rm(dir, {recursive: true});
    }
}


export async function mkDirIfMissing(dest) {
    const dir = path.dirname(dest);
    if (!(await pathExists(dir))) {
        await fs.mkdir(dir, {recursive: true});
    }
}


export async function copyFile(src, dest) {
    await mkDirIfMissing(dest);
    await fs.copyFile(src, dest);
}


export async function readFile(src, encoding = 'utf8') {
    return await fs.readFile(src, encoding);
}


export async function fileExists(src) {
    try {
        await fs.access(src, fs.constants.R_OK);
        return true;
    } catch (e) {
        log.error(`Failed to access file: ${src}`);
        return false;
    }
}


export async function writeFile(dest, content, encoding = 'utf8') {
    await mkDirIfMissing(dest);
    await fs.writeFile(dest, content, encoding);
}


export async function readJSON(path) {
    const file = await readFile(path);
    return JSON.parse(file);
}


export async function writeJSON(dest, content, space = 4) {
    const string = JSON.stringify(content, null, space);
    return await writeFile(dest, string);
}


export async function getPaths(patterns) {
    const {globby} = await import('globby');
    return await globby(patterns);
}


export function timeout(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}


export function httpsRequest(url) {
    return new Promise((resolve) => {
        
        const data = [];
        const handleResponse = (response) => {
            response
                .on('data', (chunk) => data.push(chunk))
                .on('end', () => {
                    const buffer = Buffer.concat(data);
                    resolve({
                        buffer: () => buffer,
                        text: (encoding = 'utf8') => buffer.toString(encoding),
                        type: () => response.headers['content-type'] || '',
                    });
                });
        };
        const handleError = (_) => {
            log.error(`Failed to fetch URL: ${url}`);
            resolve({
                buffer: () => Buffer.from(''),
                text: () => '',
                type: () => '',
            });
        };
        https.get(url, handleResponse).on('error', handleError);
    });
}
