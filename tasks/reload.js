
import process from 'node:process';

import {WebSocketServer} from 'ws';

import {log} from './utils.js';

export const PORT = 8890;
const WAIT_FOR_CONNECTION = 2000;


let server = null;


const sockets = new Set();

const times = new WeakMap();

const userAgents = new WeakMap();


function createServer() {
    return new Promise((resolve) => {
        const server = new WebSocketServer({port: PORT});
        server.on('listening', () => {
            log.ok('Auto-reloader started');
            resolve(server);
        });
        server.on('connection', (ws, request) => {
            const userAgent = request.headers['user-agent'];
            log.ok(`Extension connected: ${userAgent}`);

            sockets.add(ws);
            times.set(ws, Date.now());
            userAgent && userAgents.set(ws, userAgent);

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'reloading') {
                    log.ok('Extension reloading...');
                }
            });
            ws.on('close', () => {
                const userAgent = userAgents.get(ws);
                log.warn(`Extension disconnected: ${userAgent}`);
                sockets.delete(ws);
            });
            if (connectionAwaiter !== null) {
                connectionAwaiter();
            }
        });
    });
}

function closeServer() {
    server && server.close(() => log.ok('Auto-reloader exit'));
    sockets.forEach((ws) => ws.close());
    sockets.clear();
    server = null;
}

process.on('exit', closeServer);
process.on('SIGINT', closeServer);


let connectionAwaiter = null;

function waitForConnection() {
    return new Promise((resolve) => {
        connectionAwaiter = () => {
            connectionAwaiter = null;
            clearTimeout(timeoutId);
            setTimeout(resolve, WAIT_FOR_CONNECTION);
        };
        const timeoutId = setTimeout(() => {
            log.warn('Auto-reloader did not connect');
            connectionAwaiter = null;
            resolve(true);
        }, WAIT_FOR_CONNECTION);
    });
}


function send(ws, message) {
    ws.send(JSON.stringify(message));
}


export async function reload({type}) {
    if (!server) {
        server = await createServer();
    }
    if (sockets.size === 0) {
        await waitForConnection();
    }
    const now = Date.now();
    Array.from(sockets.values())
        .filter((ws) => {
            const created = times.get(ws);
            return created && created < now;
        })
        .forEach((ws) => send(ws, {type}));
}

export function getConnectedBrowsers() {
    
    const browsers = new Set();
    sockets.forEach((ws) => {
        const userAgent = userAgents.get(ws);
        if (userAgent?.includes('Chrome') || userAgent?.includes('Chromium')) {
            browsers.add('chrome');
        }
    });
    return Array.from(browsers);
}

export const CSS = 'reload:css';
export const FULL = 'reload:full';
export const UI = 'reload:ui';
