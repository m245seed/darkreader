import {log} from './utils.js';
import watch from './watch.js';



class Task {
    
    constructor(name, run) {
        this.name = name;
        this._run = run;
    }

    
    addWatcher(files, onChange) {
        this._watchFiles = files;
        this._onChange = onChange;
        return this;
    }

    
    async _measureTime(fn) {
        const start = Date.now();
        await fn();
        const end = Date.now();
        log(`${this.name} (${(end - start).toFixed(0)}ms)`);
    }

    
    async run(options) {
        await this._measureTime(
            () => this._run(options)
        );
    }

    watch(platforms) {
        if (!this._watchFiles || !this._onChange) {
            return;
        }

        const watcher = watch({
            files: typeof this._watchFiles === 'function' ?
                this._watchFiles() :
                this._watchFiles,
            onChange: async (files) => {
                await this._measureTime(
                    () => this._onChange(files, watcher, platforms)
                );
            },
        });
    }
}


export function createTask(name, run) {
    return new Task(name, run);
}


export async function runTasks(tasks, options) {
    for (const task of tasks) {
        try {
            await task.run(options);
        } catch (err) {
            log.error(`${task.name} error\n${err.stack || err}`);
            throw err;
        }
    }
}
