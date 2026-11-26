/** Run after compilation: node scripts/test-css-refresh.js */
'use strict';

const assert = require('assert').strict;
const Module = require('module');
const vm = require('vm');

// Generate the real workbench loader. Only the VS Code host boundary and the
// unrelated pet catalog are mocked; DOM, fetch and status bar mutations are
// controlled below to exercise the actual refresh pipeline.
const originalLoad = Module._load;
Module._load = function (request, parent) {
    if (request === 'vscode') {
        return {
            EventEmitter: class {},
            UIKind: { Desktop: 1 },
            env: { appRoot: '/nonexistent', sessionId: 'css-refresh-test', uiKind: 1 },
            workspace: { getConfiguration: () => ({ get: () => false }) },
            Uri: {
                file: filePath => ({
                    with() { return this; },
                    toString: () => 'vscode-file://vscode-app/' + filePath
                })
            }
        };
    }
    if (request === './PickList' && /[\\/]out[\\/]FileDom\.js$/.test(parent.filename)) {
        return { getAllPets: () => [{ value: 'akita', folder: 'akita', idle: 'idle.gif', walk: 'walk.gif' }] };
    }
    return originalLoad.apply(this, arguments);
};

let FileDom;
let setContext;
try {
    ({ FileDom } = require('../out/FileDom'));
    ({ setContext } = require('../out/global'));
} finally {
    Module._load = originalLoad;
}
setContext({ globalState: { get: (_key, fallback) => fallback }, extensionPath: '' });

function createLoader() {
    const dom = new FileDom({ get: () => '' }, '/test.png', 0.2, 'cover', 0, 'auto');
    const generated = dom.getDynamicJs();
    const end = generated.indexOf('// Little Assistant Logic');
    assert.ok(end > 0, 'generated loader must contain the assistant boundary');
    // The assistant is independent of background refresh. Omit only that tail,
    // leaving the complete IIFE and all CSS refresh logic intact.
    return generated.slice(0, end) + '})();';
}

function createHarness() {
    const timers = [];
    const requests = [];
    const statusBar = { textContent: '', listeners: [] };
    const styles = {};
    let revision = 'old';

    const document = {
        readyState: 'complete',
        hidden: false,
        baseURI: 'vscode-file://vscode-app/',
        head: {
            appendChild: node => {
                styles[node.id] = node;
                node.parentNode = document.head;
            }
        },
        body: {
            offsetHeight: 0,
            appendChild: node => { node.parentNode = document.body; },
            prepend: node => { node.parentNode = document.body; },
            removeChild: node => { node.parentNode = null; }
        },
        querySelector: selector => selector === '.statusbar' ? statusBar : null,
        getElementById: id => styles[id] || null,
        getElementsByTagName: () => [],
        createElement: tag => ({
            tag,
            style: {},
            setAttribute(key, value) { this[key] = value; },
            remove() { this.parentNode = null; }
        }),
        addEventListener() {},
        removeEventListener() {}
    };
    const sandbox = {
        document,
        console,
        URL,
        Set,
        JSON,
        Promise,
        setTimeout: fn => { timers.push(fn); return timers.length; },
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {},
        addEventListener() {},
        removeEventListener() {},
        fetch: () => {
            let resolve;
            let reject;
            const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
            requests.push({ revision, resolve, reject, promise });
            return promise;
        },
        MutationObserver: class {
            constructor(handler) { this.handler = handler; statusBar.listeners.push(handler); }
            observe() {}
            disconnect() {}
        },
        matchMedia: () => ({ matches: true })
    };
    sandbox.window = sandbox;
    sandbox.window.location = {
        href: 'vscode-file://vscode-app/index.html',
        origin: 'vscode-file://vscode-app'
    };
    vm.createContext(sandbox);
    vm.runInContext(createLoader(), sandbox);

    function flushTimers() {
        timers.splice(0).forEach(fn => {
            fn();
            // Status-bar follow-ups are harmless duplicates. Coalescing handles
            // them; test the next external action with a quiet timer queue.
            timers.length = 0;
        });
    }
    async function flushPromises() {
        // Native promises in the VM schedule one turn per link of the real
        // fetch -> text -> preload -> apply -> finally chain.
        for (let i = 0; i < 20; i++) { await Promise.resolve(); }
    }
    function refresh() {
        statusBar.textContent = 'background-cover-reload-trigger:css:1:shared';
        statusBar.listeners.forEach(handler => handler([{ target: statusBar }]));
    }
    function respond(css) {
        const request = requests[requests.length - 1];
        assert.ok(request, 'a CSS request must be pending');
        request.resolve({ text: async () => css });
    }
    function appliedCss() {
        const style = styles['background-cover-style'];
        return style ? style.textContent : '';
    }

    return {
        requests,
        flushTimers,
        flushPromises,
        refresh,
        respond,
        appliedCss,
        setRevision: value => { revision = value; },
        cssFor: name => `body::before{content:"${name}";background-image:url("${name}.png");}`
    };
}

async function main() {
    const harness = createHarness();
    const {
        requests, flushTimers, flushPromises, refresh, respond, appliedCss, setRevision, cssFor
    } = harness;

    flushTimers();
    assert.equal(requests.length, 1, 'startup must load the CSS once');
    requests[0].resolve({ text: async () => cssFor('old') });
    await flushPromises();

    // The first refresh and its delayed follow-up may overlap the same request.
    // A later notification must not be lost merely because that request is pending.
    refresh();
    flushTimers();
    assert.equal(requests.length, 2);
    setRevision('new');
    refresh();
    flushTimers();
    flushTimers();
    requests[1].resolve({ text: async () => cssFor('old') });
    await flushPromises();
    flushTimers();
    await flushPromises();
    respond(cssFor('new'));
    await flushPromises();
    assert.ok(appliedCss().includes('new.png'), 'the latest CSS must appear without another manual refresh');
    assert.equal(requests.length, 3, 'in-flight refreshes must coalesce into exactly one follow-up');

    // A failed fetch must not create an unbounded retry loop.
    setRevision('failure');
    refresh();
    flushTimers();
    refresh();
    flushTimers();
    const failureCount = requests.length;
    requests[requests.length - 1].reject(new Error('simulated fetch failure'));
    await flushPromises();
    flushTimers();
    await flushPromises();
    assert.equal(requests.length, failureCount + 1, 'a pending refresh must retry once after a failed request');
    assert.equal(requests.length, failureCount + 1, 'the failed CSS request must leave no extra pending retries');

    console.log('PASS CSS refresh during an in-flight request is applied exactly once');
    console.log('PASS failed CSS requests settle without retrying indefinitely');
}

main().catch(error => {
    console.error(`FAIL CSS refresh regression: ${error.stack || error.message}`);
    process.exitCode = 1;
});
