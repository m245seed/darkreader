import {createWriteStream} from 'node:fs';
import process from 'node:process';

import {WebSocketServer} from 'ws';

import {createTask} from './task.js';
import {log} from './utils.js';

export const PORT = 9000;
const WAIT_FOR_CONNECTION = 2000;


let server = null;


const sockets = new Set();
const times = new WeakMap();


function createServer(logLevel) {
    return new Promise((resolve) => {
        const server = new WebSocketServer({port: PORT});
        const stream = createWriteStream(`${Date.now()}-${logLevel}.txt`, {flags:'a'});
        server.on('listening', () => {
            log.ok('Loggings started');
            resolve(server);
        });
        server.on('connection', async (ws) => {
            sockets.add(ws);
            times.set(ws, Date.now());
            ws.on('message', async (data) => {
                const message = data.toString();
                stream.write(`${message}\n`);
            });
            ws.on('close', () => sockets.delete(ws));
            if (connectionAwaiter !== null) {
                connectionAwaiter();
            }
        });
    });
}

function closeServer() {
    server && server.close(() => log.ok('Logging exit'));
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
            resolve();
        }, WAIT_FOR_CONNECTION);
    });
}


export async function logging({log}) {
    if (!log) {
        return;
    }
    if (!server) {
        server = await createServer(log);
    }
    if (sockets.size === 0) {
        await waitForConnection();
    }
}

const loggingTask = createTask(
    'logging',
    logging,
);

export default loggingTask;

