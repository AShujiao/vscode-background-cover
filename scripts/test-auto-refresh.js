/** Run after compilation: node scripts/test-auto-refresh.js */
'use strict';

const assert = require('assert').strict;
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

const randomImageUrl = 'https://img.aierlanta.net/api/random?sfw=true&format=webp';
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bgc-auto-refresh-'));
const localFolder = path.join(temporaryRoot, 'wallpapers');
fs.mkdirSync(localFolder);
const localImagePath = path.join(localFolder, 'wallpaper.webp');
fs.writeFileSync(localImagePath, 'local test image');

const globalState = new Map();
const scheduledTimers = new Set();
const appliedImages = [];
let settings;
let selectedFolder;
let failures = 0;

function getConfiguration() {
    return {
        ...settings,
        get: (key, fallback) => settings[key] ?? fallback,
        update: async (key, value) => { settings[key] = value; }
    };
}

class MockEventEmitter {
    constructor() { this.event = () => ({ dispose() {} }); }
    fire() {}
    dispose() {}
}

const originalLoad = Module._load;
Module._load = function (request) {
    if (request === 'vscode') {
        return {
            EventEmitter: MockEventEmitter,
            env: { sessionId: 'auto-refresh-test', appRoot: temporaryRoot },
            workspace: { getConfiguration },
            window: {
                setStatusBarMessage: () => ({ dispose() {} }),
                showOpenDialog: async () => selectedFolder ? [{ fsPath: selectedFolder }] : undefined
            },
            commands: { executeCommand() {} },
            Uri: { file: value => ({ with: () => ({ toString: () => String(value) }) }) },
            ConfigurationTarget: { Global: 1 },
            UIKind: { Desktop: 1, Web: 2 },
            Disposable: class {}
        };
    }
    return originalLoad.apply(this, arguments);
};

const { setContext } = require('../out/global');
const { setCurrentImagePath, isSingleSourceActive } = require('../out/windowBackground');
const { PickList, ActionType } = require('../out/PickList');
Module._load = originalLoad;

// Exercise real scheduling and source selection without modifying the editor's workbench.
const originalUpdateDom = PickList.prototype.updateDom;
PickList.prototype.updateDom = async function () {
    appliedImages.push({
        imagePath: this.imgPath,
        skipOnlineCache: this.skipOnlineCache,
        silent: this.silentApply
    });
    return false;
};

const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
global.setInterval = (callback, intervalMilliseconds) => {
    const timer = { callback, intervalMilliseconds, elapsedMilliseconds: 0 };
    scheduledTimers.add(timer);
    return timer;
};
global.clearInterval = timer => scheduledTimers.delete(timer);

async function advanceTime(milliseconds) {
    for (const timer of [...scheduledTimers]) {
        timer.elapsedMilliseconds += milliseconds;
        while (scheduledTimers.has(timer) && timer.elapsedMilliseconds >= timer.intervalMilliseconds) {
            timer.elapsedMilliseconds -= timer.intervalMilliseconds;
            await timer.callback();
        }
    }
}

async function resetFixture(overrides = {}) {
    PickList.stopAutoRandomTask();
    globalState.clear();
    appliedImages.length = 0;
    selectedFolder = localFolder;
    settings = {
        autoStatus: true,
        autoInterval: 600,
        imagePath: randomImageUrl,
        randomImageFolder: '',
        perWindowBackground: true,
        opacity: 0.2,
        blur: 0,
        ...overrides
    };
    setContext({
        globalStorageUri: { fsPath: temporaryRoot },
        globalState: {
            get: (key, fallback) => globalState.get(key) ?? fallback,
            update: async (key, value) => {
                if (value === undefined) { globalState.delete(key); }
                else { globalState.set(key, value); }
            }
        }
    });
    await setCurrentImagePath(settings.imagePath);
    globalState.set('backgroundCoverSingleImageSource', randomImageUrl);
}

async function runTest(label, test) {
    try {
        await test();
        console.log(`PASS ${label}`);
    } catch (error) {
        failures++;
        console.error(`FAIL ${label}`, error);
    } finally {
        PickList.stopAutoRandomTask();
    }
}

async function main() {
    await runTest('600-second ticks refresh an active API despite a missing old folder', async () => {
        await resetFixture({ randomImageFolder: path.join(temporaryRoot, 'missing-old-folder') });
        PickList.startAutoRandomTask();
        await advanceTime(599999);
        assert.equal(appliedImages.length, 0);
        await advanceTime(1);
        assert.deepEqual(appliedImages, [{ imagePath: randomImageUrl, skipOnlineCache: true, silent: true }]);
        await advanceTime(600000);
        assert.equal(appliedImages.length, 2);
        assert.equal(appliedImages[1].imagePath, randomImageUrl);
    });

    await runTest('the active API also takes precedence over an existing old folder', async () => {
        await resetFixture({ randomImageFolder: localFolder });
        PickList.startAutoRandomTask();
        await advanceTime(600000);
        assert.equal(appliedImages.length, 1);
        assert.equal(appliedImages[0].imagePath, randomImageUrl);
    });

    await runTest('legacy settings-only sources remain active across timer ticks', async () => {
        await resetFixture();
        globalState.clear();
        globalState.set('backgroundCoverSingleImageSource', randomImageUrl);
        assert.equal(isSingleSourceActive(randomImageUrl), true);
        PickList.startAutoRandomTask();
        await advanceTime(1200000);
        assert.equal(appliedImages.length, 2);
        assert.ok(appliedImages.every(image => image.imagePath === randomImageUrl));
    });

    await runTest('a stale API does not override the current window local background', async () => {
        await resetFixture({ randomImageFolder: localFolder });
        await setCurrentImagePath(localImagePath);
        globalState.set('backgroundCover.globalImage', randomImageUrl);
        assert.equal(isSingleSourceActive(randomImageUrl), false);
        PickList.startAutoRandomTask();
        await advanceTime(600000);
        assert.equal(appliedImages.length, 1);
        assert.equal(appliedImages[0].imagePath, localImagePath);
    });

    await runTest('explicit local-folder selection replaces the active single source', async () => {
        await resetFixture();
        await new PickList(getConfiguration()).handleAction(ActionType.AddDirectory);
        assert.equal(settings.randomImageFolder, localFolder);
        assert.equal(globalState.has('backgroundCoverSingleImageSource'), false);
        PickList.startAutoRandomTask();
        await advanceTime(600000);
        assert.equal(appliedImages.length, 1);
        assert.equal(appliedImages[0].imagePath, localImagePath);
    });

    await runTest('cancelling local-folder selection preserves the active API', async () => {
        await resetFixture();
        selectedFolder = undefined;
        await new PickList(getConfiguration()).handleAction(ActionType.AddDirectory);
        assert.equal(settings.randomImageFolder, '');
        assert.equal(globalState.get('backgroundCoverSingleImageSource'), randomImageUrl);
        PickList.startAutoRandomTask();
        await advanceTime(600000);
        assert.equal(appliedImages.length, 1);
        assert.equal(appliedImages[0].imagePath, randomImageUrl);
    });

    await runTest('temporary images do not invalidate a persisted online source', async () => {
        await resetFixture();
        await setCurrentImagePath(localImagePath, { persist: false });
        assert.equal(isSingleSourceActive(randomImageUrl), true);
        PickList.startAutoRandomTask();
        await advanceTime(600000);
        assert.equal(appliedImages[0].imagePath, randomImageUrl);
    });

    await runTest('an explicit empty image does not fall back to an old settings URL', async () => {
        await resetFixture();
        await setCurrentImagePath('');
        assert.equal(isSingleSourceActive(randomImageUrl), false);
        PickList.startAutoRandomTask();
        await advanceTime(600000);
        assert.equal(appliedImages.length, 0);
    });

    await runTest('disabled automatic refresh schedules no updates', async () => {
        await resetFixture({ autoStatus: false });
        PickList.startAutoRandomTask();
        await advanceTime(1200000);
        assert.equal(scheduledTimers.size, 0);
        assert.equal(appliedImages.length, 0);
    });
}

main().catch(error => {
    failures++;
    console.error(error);
}).finally(() => {
    PickList.stopAutoRandomTask();
    PickList.prototype.updateDom = originalUpdateDom;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    console.log(failures ? `${failures} test(s) failed` : 'All auto-refresh tests passed');
    process.exitCode = failures ? 1 : 0;
});
