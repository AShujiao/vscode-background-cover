/** Run after compilation: node scripts/test-config-update.js */
'use strict';

const assert = require('assert').strict;
const Module = require('module');

const commands = new Map();
const globalState = new Map();
const applied = [];
const mockEnvironment = { sessionId: 'config-window', language: 'en' };
let settings = { imagePath: '', perWindowBackground: false };
let rejectWrite = false;
let modeApplies = 0;
let failures = 0;

class MockEventEmitter {
    constructor() {
        this.listeners = new Set();
        this.event = listener => {
            this.listeners.add(listener);
            return { dispose: () => this.listeners.delete(listener) };
        };
    }
    fire(value) { this.listeners.forEach(listener => listener(value)); }
    dispose() { this.listeners.clear(); }
}

const configurationChanges = new MockEventEmitter();
function getConfiguration() {
    // VS Code returns a snapshot: update() must not mutate existing getters or properties.
    const snapshot = { ...settings };
    return Object.freeze({
        ...snapshot,
        get: (key, fallback) => snapshot[key] ?? fallback,
        update: async (key, value) => {
            await Promise.resolve();
            if (rejectWrite) { throw new Error('settings write failed'); }
            settings = { ...settings, [key]: value };
            configurationChanges.fire({
                affectsConfiguration: section => section === 'backgroundCover' || section === `backgroundCover.${key}`
            });
        }
    });
}

const disposable = () => ({ dispose() {} });
const mockVscode = {
    EventEmitter: MockEventEmitter,
    env: mockEnvironment,
    version: 'config-test',
    ConfigurationTarget: { Global: 1 },
    StatusBarAlignment: { Right: 2 },
    workspace: { getConfiguration, onDidChangeConfiguration: configurationChanges.event },
    commands: {
        registerCommand: (name, handler) => {
            commands.set(name, handler);
            return disposable();
        },
        executeCommand: async (name, ...args) => commands.get(name)?.(...args)
    },
    window: {
        createStatusBarItem: () => ({ show() {}, dispose() {} }),
        registerWebviewViewProvider: disposable,
        createTreeView: disposable,
        setStatusBarMessage: disposable,
        showInformationMessage: async () => undefined,
        showErrorMessage: message => { throw new Error(message); }
    },
    extensions: { getExtension: () => ({ packageJSON: { version: 'config-test' } }) }
};

// Keep the real command, per-window storage, PickList and Studio message handling.
// Replace only UI registration and the workbench file-writing boundary.
const originalLoad = Module._load;
Module._load = function (request, parent) {
    if (request === 'vscode') { return mockVscode; }
    if (request === './FileDom') {
        return {
            CUSTOM_JS_FILE_PATH: __filename,
            detectPatchState: async () => 'latest',
            collectStaleWindowCssFiles: async () => {},
            FileDom: class {
                constructor(config, imagePath, opacity, sizeModel, blur, blendModel) {
                    this.values = { imagePath, opacity, sizeModel, blur, blendModel };
                }
                async install() { applied.push(this.values); return false; }
            }
        };
    }
    if (request === './backgroundCoverView') {
        return { BackgroundCoverViewProvider: class {} };
    }
    if (request === './onlineCache' && /[\\/]out[\\/]extension\.js$/.test(parent.filename)) {
        return { pruneOnlineCache: async () => {} };
    }
    return originalLoad.apply(this, arguments);
};

let activate, PickList, StudioViewProvider;
try {
    ({ activate } = require('../out/extension'));
    ({ PickList } = require('../out/PickList'));
    ({ StudioViewProvider } = require('../out/StudioViewProvider'));
} finally {
    Module._load = originalLoad;
}

PickList.startAutoRandomTask = () => {};
PickList.autoUpdateBackground = () => {};
PickList.applyCurrentBackground = async () => { modeApplies++; return false; };

const context = {
    subscriptions: [],
    globalState: {
        get: (key, fallback) => globalState.get(key) ?? fallback,
        update: async (key, value) => { globalState.set(key, value); }
    }
};
const studio = new StudioViewProvider(context);
const setConfig = (key, value) => studio.handleMessage({ type: 'setConfig', key, value });

function resetFixture(perWindowBackground = false) {
    settings = { imagePath: '/test/wallpaper.png', opacity: 0.2, blur: 0,
        sizeModel: 'cover', blendModel: 'auto', perWindowBackground };
    globalState.clear();
    applied.length = 0;
    mockEnvironment.sessionId = 'config-window';
    rejectWrite = false;
    modeApplies = 0;
}

async function test(name, run) {
    resetFixture();
    try {
        await run();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures++;
        console.error(`FAIL ${name}: ${error.message}`);
    }
}

async function main() {
    globalState.set('ext_version', 'config-test');
    activate(context);
    // Let startup's asynchronous patch check finish before setting a test image.
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(commands.has('backgroundCover.setConfig'));

    await test('configuration mock retains the original snapshot after saving', async () => {
        const before = getConfiguration();
        await before.update('opacity', 0.5);
        assert.equal(before.opacity, 0.2);
        assert.equal(before.get('opacity'), 0.2);
        assert.equal(getConfiguration().opacity, 0.5);
    });

    for (const perWindow of [false, true]) {
        for (const [key, values] of [['opacity', [0.5, 0.1, 0]], ['blur', [20, 60, 0]]]) {
            await test(`${perWindow ? 'per-window' : 'shared'} ${key} applies the current value on every change`, async () => {
                resetFixture(perWindow);
                const initialValue = settings[key];
                for (const value of values) {
                    const count = applied.length;
                    await setConfig(key, value);
                    assert.equal(applied.length, count + 1);
                    assert.equal(applied[count][key], value, `applied ${key} must be ${value}`);
                    assert.equal(settings[key], perWindow ? initialValue : value);
                }
                // A different window uses shared settings, not this window's private records.
                mockEnvironment.sessionId = 'other-window';
                const otherWindow = new PickList(getConfiguration());
                assert.equal(otherWindow[key], perWindow ? initialValue : values[values.length - 1]);
            });
        }
    }

    for (const [key, values] of [['sizeModel', ['contain', 'repeat']], ['blendModel', ['multiply', 'lighten']]]) {
        await test(`${key} uses fresh configuration after saving`, async () => {
            for (const value of values) {
                const count = applied.length;
                await setConfig(key, value);
                assert.equal(applied.length, count + 1);
                assert.equal(applied[count][key], value);
            }
        });
    }

    await test('shared opacity and blur changes preserve each other', async () => {
        await setConfig('opacity', 0.5);
        await setConfig('blur', 20);
        await setConfig('opacity', 0.1);
        assert.deepEqual(applied.map(({ opacity, blur }) => ({ opacity, blur })), [
            { opacity: 0.5, blur: 0 }, { opacity: 0.5, blur: 20 }, { opacity: 0.1, blur: 20 }
        ]);
    });

    await test('failed settings writes do not apply a background', async () => {
        rejectWrite = true;
        for (const [key, value] of [['opacity', 0.5], ['blur', 20], ['sizeModel', 'contain']]) {
            await assert.rejects(setConfig(key, value), /settings write failed/);
        }
        assert.equal(applied.length, 0);
        assert.equal(settings.opacity, 0.2);
        assert.equal(settings.blur, 0);
        assert.equal(settings.sizeModel, 'cover');
    });

    await test('mode switch is applied once by the configuration listener', async () => {
        for (const enabled of [true, false]) {
            await setConfig('perWindowBackground', enabled);
            assert.equal(settings.perWindowBackground, enabled);
        }
        assert.equal(modeApplies, 2);
        assert.equal(applied.length, 0);
    });

    console.log(`\n${failures ? 'FAIL' : 'PASS'} config update regression tests (${failures} failures)`);
    if (failures) { process.exitCode = 1; }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
    context.subscriptions.forEach(subscription => subscription.dispose?.());
    configurationChanges.dispose();
});
