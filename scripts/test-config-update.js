/** Run after compilation: node scripts/test-config-update.js */
'use strict';

const assert = require('assert').strict;
const Module = require('module');

const commands = new Map();
const globalState = new Map();
const applied = [];
const mockEnvironment = { sessionId: 'config-window', language: 'en' };
let settings = { imagePath: '', perWindowBackground: false };
// 模拟 .vscode/settings.json 里的工作区级覆盖（用于验证工作区级透明度不会漏进全局兜底）。
let workspaceSettings = {};
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

function hasWorkspaceFolder() {
    return !!(mockVscode.workspace.workspaceFolders && mockVscode.workspace.workspaceFolders.length);
}

const configurationChanges = new MockEventEmitter();
function getConfiguration() {
    // VS Code returns a snapshot: update() must not mutate existing getters or properties.
    // 工作区级覆盖只在该窗口打开了文件夹时才生效（无 folder 窗口拿不到 .vscode/settings.json）。
    const snapshot = hasWorkspaceFolder()
        ? { ...settings, ...workspaceSettings }
        : { ...settings };
    return Object.freeze({
        ...snapshot,
        get: (key, fallback) => snapshot[key] ?? fallback,
        // 与 VS Code 一致：inspect 能区分 user / workspace / workspaceFolder 三个来源。
        inspect: key => {
            const hasUser = Object.prototype.hasOwnProperty.call(settings, key);
            const hasWorkspace = hasWorkspaceFolder() && Object.prototype.hasOwnProperty.call(workspaceSettings, key);
            if (!hasUser && !hasWorkspace) { return undefined; }
            return {
                key,
                defaultValue: undefined,
                globalValue: hasUser ? settings[key] : undefined,
                workspaceValue: hasWorkspace ? workspaceSettings[key] : undefined
            };
        },
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
    workspace: { getConfiguration, onDidChangeConfiguration: configurationChanges.event, workspaceFolders: undefined },
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
    workspaceSettings = {};
    globalState.clear();
    applied.length = 0;
    mockEnvironment.sessionId = 'config-window';
    mockVscode.workspace.workspaceFolders = undefined;
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
                // 另一个工作区的窗口仍用 settings 里的值，不会读到本窗口的私有记录，
                // 也不会读到"最后一次生效值"的全局兜底（否则各工作区又会互相串值）。
                mockEnvironment.sessionId = 'other-window';
                mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: 'D:\\other\\workspace' } }];
                const otherWindow = new PickList(getConfiguration());
                assert.equal(otherWindow[key], perWindow ? initialValue : values[values.length - 1]);
            });
        }
    }

    // #252：没有打开文件夹的窗口既没有工作区记录、session 记录又会随重启失效，
    // 必须能从全局兜底恢复上次的透明度/模糊度，而不是回落到 settings 默认值。
    for (const [key, value] of [['opacity', 0.45], ['blur', 26]]) {
        await test(`per-window folderless window restores ${key} after restart`, async () => {
            resetFixture(true);
            await setConfig(key, value);
            assert.equal(applied[applied.length - 1][key], value);

            // 重启/重载窗口：sessionId 换新，globalState 保留，settings 不变。
            mockEnvironment.sessionId = 'after-restart';
            const restarted = new PickList(getConfiguration());
            assert.equal(restarted[key], value, `folderless window must restore ${key}=${value} after restart`);
        });
    }

    // 有工作区的窗口重启后仍走自己的工作区记录，不依赖全局兜底。
    await test('per-window workspace window keeps its own value after restart', async () => {
        resetFixture(true);
        mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: 'D:\\work\\alpha' } }];
        await setConfig('opacity', 0.6);
        mockEnvironment.sessionId = 'after-restart';
        const restarted = new PickList(getConfiguration());
        assert.equal(restarted.opacity, 0.6);
        // 全局兜底只给没有工作区身份的窗口用，换个工作区仍回到 settings 默认值。
        mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: 'D:\\work\\beta' } }];
        const otherWorkspace = new PickList(getConfiguration());
        assert.equal(otherWorkspace.opacity, 0.2);
    });

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

    // #252 附带问题：直接改 settings.json / 设置界面里的值也要立即重新应用。
    await test('editing settings.json opacity reapplies the background (shared mode)', async () => {
        resetFixture(false);
        assert.equal(applied.length, 0);
        settings = { ...settings, opacity: 0.44 };
        configurationChanges.fire({ affectsConfiguration: section => section === 'backgroundCover.opacity' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(applied.length, 1);
        assert.equal(applied[0].opacity, 0.44);
        // 共用模式下应写回 settings.json 之外不产生任何窗口记录。
        assert.equal(globalState.get('backgroundCover.windowOpacity'), undefined);
    });

    await test('editing settings.json opacity in per-window mode applies it to the current window', async () => {
        resetFixture(true);
        settings = { ...settings, opacity: 0.35 };
        configurationChanges.fire({ affectsConfiguration: section => section === 'backgroundCover.opacity' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(applied.length, 1);
        assert.equal(applied[0].opacity, 0.35);
        // 采纳后同时写入当前窗口记录与全局兜底，重启后仍能恢复。
        assert.equal(globalState.get('backgroundCover.globalOpacity'), 0.35);
        mockEnvironment.sessionId = 'after-restart';
        const restarted = new PickList(getConfiguration());
        assert.equal(restarted.opacity, 0.35);
    });

    await test('editing settings.json blur reapplies the background (shared mode)', async () => {
        resetFixture(false);
        settings = { ...settings, blur: 18 };
        configurationChanges.fire({ affectsConfiguration: section => section === 'backgroundCover.blur' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(applied.length, 1);
        assert.equal(applied[0].blur, 18);
    });

    // 工作区级(.vscode/settings.json)的透明度只属于该工作区，不能写成无 folder 窗口的全局兜底。
    await test('workspace-scoped opacity does not leak into the folderless global fallback', async () => {
        resetFixture(true);
        mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: 'D:\\work\\scoped' } }];
        workspaceSettings = { opacity: 0.77 };
        configurationChanges.fire({ affectsConfiguration: section => section === 'backgroundCover.opacity' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(applied.length, 1);
        assert.equal(applied[0].opacity, 0.77);
        assert.equal(globalState.get('backgroundCover.globalOpacity'), undefined);

        // 没有文件夹的窗口仍用 settings 里的用户级值，不会拿到工作区级 0.77。
        mockVscode.workspace.workspaceFolders = undefined;
        mockEnvironment.sessionId = 'folderless';
        const folderless = new PickList(getConfiguration());
        assert.equal(folderless.opacity, 0.2);
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

    await test('switching from shared back to per-window keeps the last shared value', async () => {
        resetFixture(false);
        await setConfig('opacity', 0.33);
        assert.equal(settings.opacity, 0.33);
        await setConfig('perWindowBackground', true);
        assert.equal(settings.perWindowBackground, true);
        mockEnvironment.sessionId = 'after-switch';
        const switched = new PickList(getConfiguration());
        assert.equal(switched.opacity, 0.33);
    });

    // 快速连续的外部改动：写入是异步读-改-写，必须串行化，否则先发起的慢写会覆盖后发起的值。
    await test('rapid external opacity edits do not lose the latest value', async () => {
        resetFixture(true);
        for (const value of [0.31, 0.5]) {
            settings = { ...settings, opacity: value };
            configurationChanges.fire({ affectsConfiguration: section => section === 'backgroundCover.opacity' });
        }
        await new Promise(resolve => setTimeout(resolve, 20));
        mockEnvironment.sessionId = 'after-rapid';
        const restarted = new PickList(getConfiguration());
        assert.equal(restarted.opacity, 0.5);
        assert.equal(globalState.get('backgroundCover.globalOpacity'), 0.5);
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
