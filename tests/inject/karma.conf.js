/** @typedef {import('karma').Config & {headless: boolean, debug: boolean, ci: boolean, coverage: boolean}} LocalConfig */
/** @typedef {import('karma').ConfigOptions} ConfigOptions */

import fs from 'node:fs';
import os from 'node:os';

import rollupPluginReplace from '@rollup/plugin-replace';
import rollupPluginTypescript from '@rollup/plugin-typescript';
import rollupPluginIstanbul from 'rollup-plugin-istanbul';
import typescript from 'typescript';

import {absolutePath} from '../../tasks/paths.js';

import {createEchoServer} from './support/echo-server.js';

/**
 * @param {Partial<LocalConfig>} config
 * @param {Record<string, string>} env
 * @returns {ConfigOptions}
 */
export function configureKarma(config, env) {
    const headless = config.headless || Boolean(env.KARMA_HEADLESS) || false;

    /** @type {ConfigOptions} */
    const options = {
        failOnFailingTestSuite: true,
        failOnEmptyTestSuite: true,
        basePath: '../..',
        frameworks: ['jasmine'],
        files: [
            'tests/inject/support/customize.ts',
            'tests/inject/support/polyfills.ts',
            {pattern: 'tests/inject/**/*.tests.ts', watched: false},
        ],
        plugins: [
            'karma-chrome-launcher',
            process.platform === 'darwin' ? 'karma-safari-launcher' : null,
            'karma-rollup-preprocessor',
            'karma-jasmine',
            'karma-spec-reporter',
        ].filter(Boolean),
        preprocessors: {
            '**/*.+(ts|tsx)': ['rollup'],
        },
        rollupPreprocessor: {
            plugins: [
                rollupPluginTypescript({
                    typescript,
                    tsconfig: absolutePath('tests/inject/tsconfig.json'),
                    cacheDir: `${fs.realpathSync(os.tmpdir())}/darkreader_typescript_test_cache`,
                }),
                rollupPluginReplace({
                    preventAssignment: true,
                    __DEBUG__: false,
                    __FIREFOX_MV2__: false,
                    __CHROMIUM_MV2__: false,
                    __CHROMIUM_MV3__: false,
                    __THUNDERBIRD__: false,
                    __PORT__: '-1',
                    __TEST__: true,
                    __WATCH__: false,
                }),
            ],
            output: {
                dir: 'build/tests',
                strict: true,
                format: 'iife',
                sourcemap: 'inline',
            },
        },
        reporters: ['spec'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: headless
            ? ['ChromeHeadless']
            : ['Chrome', process.platform === 'darwin' ? 'Safari' : null].filter(Boolean),
        singleRun: true,
        concurrency: 1,
    };

    if (config.debug) {
        options.browsers = ['Chrome'];
        options.singleRun = false;
        options.concurrency = Infinity;
        options.logLevel = config.LOG_DEBUG;
    }

    if (config.ci) {
        options.customLaunchers = {};
        options.browsers = [];

        // CHROME_TEST is used in CI
        const chrome = env.CHROME_TEST;
        const all = !chrome;
        // Chrome
        if (chrome || all) {
            options.customLaunchers['CIChromeHeadless'] = {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--disable-setuid-sandbox'],
            };
            options.browsers.push('CIChromeHeadless');
        }


        options.autoWatch = false;
        options.singleRun = true;
        options.concurrency = 1;
        options.logLevel = config.LOG_DEBUG;
    }

    if (config.coverage) {
        options.plugins.push('karma-coverage');
        const plugin = rollupPluginIstanbul({
            exclude: ['tests/**/*.*', 'src/inject/dynamic-theme/stylesheet-proxy.ts'],
        });
        options.rollupPreprocessor.plugins.push(plugin);
        options.reporters.push('coverage');
        options.coverageReporter = {
            type: 'html',
            dir: 'tests/inject/coverage/',
        };
    }

    // HACK: Create CORS server here
    // Previously a separate Karma runner file was used
    const corsServerPort = 9966;
    createEchoServer(corsServerPort).then(() => console.log(`CORS echo server running on port ${corsServerPort}`));

    return options;
}
