/**
 * 粒子特效帧率节流（issue #230）的回归测试。
 *
 * 直接在沙箱里执行「注入到 VS Code 工作台页面」的那段真实代码（out/ParticleEffect.js
 * 生成的字符串），用假的 window / document / canvas / rAF / 时钟驱动它，统计每秒真实
 * 重绘次数。不需要浏览器，也不需要 VS Code：
 *
 *     npm run test:particle
 *
 * 覆盖：帧率上限生效、60Hz 屏无回归、窗口不可见不绘制、系统「减少动态效果」时降到 1 帧/秒、
 * 跳过帧不堆积 rAF 回调、扩展侧与 webview 侧常量一致、非法 fps 回退默认。
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const {
    getParticleEffectJs,
    normalizeParticleFps,
    DEFAULT_PARTICLE_FPS,
    MIN_PARTICLE_FPS,
    MAX_PARTICLE_FPS
} = require(path.join(REPO, 'out', 'ParticleEffect'));

let failures = 0;
function check(label, cond, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
    if (!cond) { failures++; }
}

/**
 * 搭一个能跑 canvas-nest 的最小浏览器环境。
 * 每次 drawCanvas 都会调用一次 ctx.clearRect，用它统计真实重绘帧数。
 */
function createHarness({ hidden = false, reducedMotion = false } = {}) {
    const state = { now: 0, rafQueue: [], draws: 0, hidden, reducedMotion };

    const ctx = {
        clearRect() { state.draws++; },
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        set fillStyle(_v) {},
        set strokeStyle(_v) {},
        set lineWidth(_v) {}
    };

    const body = {
        clientWidth: 1920,
        clientHeight: 1080,
        offsetLeft: 0,
        offsetTop: 0,
        style: {},
        _attrs: {},
        getAttribute(name) { return this._attrs[name] || null; },
        setAttribute(name, value) { this._attrs[name] = value; },
        removeAttribute(name) { delete this._attrs[name]; },
        appendChild(child) { child.parentNode = this; },
        removeChild(child) { child.parentNode = null; }
    };

    const documentStub = {
        body,
        scrollingElement: { scrollLeft: 0, scrollTop: 0 },
        createElement(tag) {
            if (tag !== 'canvas') { return {}; }
            return { style: { cssText: '' }, width: 0, height: 0, parentNode: null, getContext: () => ctx };
        },
        get hidden() { return state.hidden; }
    };

    class ResizeObserverStub {
        constructor(callback) { this.callback = callback; }
        observe() { this.callback(); }
        disconnect() {}
    }

    const windowStub = {
        requestAnimationFrame(callback) { state.rafQueue.push(callback); return state.rafQueue.length; },
        cancelAnimationFrame() {},
        performance: { now: () => state.now },
        matchMedia: () => ({ matches: state.reducedMotion })
    };

    const sandbox = {
        window: windowStub,
        document: documentStub,
        getComputedStyle: () => ({ position: 'absolute' }),
        ResizeObserver: ResizeObserverStub,
        // 尺寸传感器内部用 debounce(setTimeout 30ms)，这里同步执行即可
        setTimeout: callback => { callback(); return 0; },
        clearTimeout() {},
        console
    };

    return {
        state,
        run(code) { vm.runInNewContext(code, sandbox); },
        /** 按给定刷新率推进 seconds 秒，统计重绘帧数。 */
        drive(refreshHz, seconds) {
            const frameMs = 1000 / refreshHz;
            const frames = Math.round(refreshHz * seconds);
            for (let i = 0; i < frames; i++) {
                state.now += frameMs;
                const pending = state.rafQueue.splice(0);
                for (const callback of pending) { callback(state.now); }
            }
            return state.draws;
        }
    };
}

function drawCount(options, refreshHz, seconds) {
    const harness = createHarness(options);
    harness.run(getParticleEffectJs(0.6, '255,255,255', 50, options.fps));
    harness.drive(refreshHz, seconds);
    return { draws: harness.state.draws, queue: harness.state.rafQueue.length };
}

function near(actual, expected, tolerance) {
    return Math.abs(actual - expected) <= tolerance;
}

function testThrottle() {
    // 240Hz 屏：不节流时 1 秒会重绘 240 次，节流后应降到设定值
    const at60 = drawCount({ fps: 60 }, 240, 1);
    check('240Hz + 60fps → 每秒约 60 帧（原为 240）', near(at60.draws, 60, 2), `实际 ${at60.draws}`);

    const at30 = drawCount({ fps: 30 }, 240, 1);
    check('240Hz + 30fps → 每秒约 30 帧', near(at30.draws, 30, 2), `实际 ${at30.draws}`);

    const at120 = drawCount({ fps: 120 }, 240, 1);
    check('240Hz + 120fps → 每秒约 120 帧', near(at120.draws, 120, 3), `实际 ${at120.draws}`);

    // 60Hz 屏：默认 60fps 不应改变原有观感
    const at60hz = drawCount({ fps: 60 }, 60, 1);
    check('60Hz + 60fps → 每秒约 60 帧（无回归）', near(at60hz.draws, 60, 2), `实际 ${at60hz.draws}`);

    const at144 = drawCount({ fps: 60 }, 144, 1);
    check('144Hz + 60fps → 每秒约 60 帧', near(at144.draws, 60, 2), `实际 ${at144.draws}`);

    check('跳过的帧不会堆积 rAF 回调', at60.queue <= 1, `队列 ${at60.queue}`);

    // 首帧不能被节流拖太久：20ms 内应已绘制
    const harness = createHarness({});
    harness.run(getParticleEffectJs(0.6, '255,255,255', 50, 60));
    harness.drive(240, 0.02);
    check('首帧在 20ms 内绘制（不会长时间空白）', harness.state.draws >= 1, `实际 ${harness.state.draws}`);
}

function testHiddenAndReducedMotion() {
    const hidden = drawCount({ fps: 60, hidden: true }, 240, 1);
    check('窗口不可见时完全不绘制', hidden.draws === 0, `实际 ${hidden.draws}`);

    const reduced = drawCount({ fps: 60, reducedMotion: true }, 240, 1);
    check('系统「减少动态效果」时降到约 1 帧/秒', reduced.draws <= 2, `实际 ${reduced.draws}`);
    check('「减少动态效果」下画面仍会被绘制（不是完全空白）', reduced.draws >= 1, `实际 ${reduced.draws}`);
}

function testNormalizeAndConstants() {
    check('非法 fps 回退默认值', normalizeParticleFps(0) === DEFAULT_PARTICLE_FPS
        && normalizeParticleFps('abc') === DEFAULT_PARTICLE_FPS
        && normalizeParticleFps(null) === DEFAULT_PARTICLE_FPS);
    check('fps 超上限被夹紧', normalizeParticleFps(9999) === MAX_PARTICLE_FPS);
    check('fps 低于下限被夹紧', normalizeParticleFps(1) === MIN_PARTICLE_FPS);
    check('字符串数字被接受', normalizeParticleFps('45') === 45);

    const code = getParticleEffectJs(0.6, '255,255,255', 50, 45);
    check('生成的代码使用传入的帧率', code.includes('_fps=45'), '');
    check('生成的代码包含节流补丁', code.includes('__bgcLastDraw') && code.includes('_frameMs'));
    check('生成的代码包含隐藏窗口跳过', code.includes('document.hidden'));

    const webviewConstants = fs.readFileSync(path.join(REPO, 'webview', 'src', 'constants.ts'), 'utf8');
    const readWebviewConst = name => Number(new RegExp(`export const ${name} = (\\d+)`).exec(webviewConstants)?.[1]);
    check('webview 默认帧率与扩展侧一致',
        readWebviewConst('DEFAULT_PARTICLE_FPS') === DEFAULT_PARTICLE_FPS,
        `webview=${readWebviewConst('DEFAULT_PARTICLE_FPS')} host=${DEFAULT_PARTICLE_FPS}`);
    check('webview 帧率上下限与扩展侧一致',
        readWebviewConst('MIN_PARTICLE_FPS') === MIN_PARTICLE_FPS
        && readWebviewConst('MAX_PARTICLE_FPS') === MAX_PARTICLE_FPS);

    const decorationTab = fs.readFileSync(path.join(REPO, 'webview', 'src', 'views', 'DecorationTab.vue'), 'utf8');
    check('Studio 滑块的上下限与常量一致',
        decorationTab.includes(':min="MIN_PARTICLE_FPS"') && decorationTab.includes(':max="MAX_PARTICLE_FPS"'));

    // 参数注入仍然正确（颜色/数量没有因为改动而错位）
    const custom = getParticleEffectJs(0.35, '12,34,56', 77, 30);
    check('粒子参数注入未受影响',
        custom.includes('opacity:"0.35"') && custom.includes('color:"12,34,56"') && custom.includes('count:77'));
}

function main() {
    testThrottle();
    testHiddenAndReducedMotion();
    testNormalizeAndConstants();
    console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
    process.exitCode = failures === 0 ? 0 : 1;
}

main();
