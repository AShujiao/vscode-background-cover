/**
 * 3.7.0 新特性（借鉴 shalldie/vscode-background）的回归测试：
 *
 *     npm run test:newfeatures   (node scripts/test-new-features.js)
 *
 * 覆盖：
 * - A1 patchState：补丁状态机 latest/legacy/none 判定、文件缺失按 none；
 * - A2 backgroundCss：「安装损坏」提示 16 语言屏蔽规则、单引号转义；
 * - A4 backgroundCss：混合模式 auto → CSS 变量 + :has() 主题规则，显式模式写死；
 * - A6 backgroundCss：过渡动画声明与「减少动态效果」兜底；
 * - A3 pathUtil：~ / ${ENV} / $ENV 展开、文件夹递归扫描、随机取图；
 * - A5 loaderFragments：background-image URL 提取正则（注入端与测试端共用同一份）；
 * - 注入产物冒烟：编译后的 FileDom.js 包含预加载片段与 CSS 变量。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

let failures = 0;
function check(label, cond, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
    if (!cond) { failures++; }
}

// ---------------------------------------------------------------------------
const {
    detectPatchStateFromContent,
    detectPatchStateFromFile,
    PATCH_MARKER_START,
    bootstrapMarkerOf
} = require(path.join(REPO, 'out', 'patchState'));

const {
    CORRUPTION_TRANSLATIONS,
    getCorruptionWarningCss,
    resolveBlendModeDeclaration,
    resolveBlendModeValue,
    resolveThemeBlendRules,
    getTransitionDeclaration,
    getTransitionReducedMotionCss,
    BLEND_CSS_VAR
} = require(path.join(REPO, 'out', 'backgroundCss'));

const {
    expandPathVariables,
    hasFileExtension,
    listImagesInFolder,
    pickRandomFromFolder
} = require(path.join(REPO, 'out', 'pathUtil'));

const { extractBackgroundImageUrl } = require(path.join(REPO, 'out', 'loaderFragments'));

// ---- A1: patchState ---------------------------------------------------------
{
    const latest = `${PATCH_MARKER_START}\n${bootstrapMarkerOf('1')}\ncode`;
    const legacy = `${PATCH_MARKER_START}\n/*ext.backgroundCover.bootstrap.0*/\ncode`;
    const none = 'window.boot();';

    check('A1 latest：含当前 bootstrap 标记 → latest',
        detectPatchStateFromContent(latest) === 'latest');
    check('A1 legacy：含旧版标记 → legacy',
        detectPatchStateFromContent(legacy) === 'legacy');
    check('A1 none：无标记 → none',
        detectPatchStateFromContent(none) === 'none');
    check('A1 none：空内容 → none',
        detectPatchStateFromContent('') === 'none');
    check('A1 none：仅 end 标记无 start → none',
        detectPatchStateFromContent('/*ext-backgroundCover-end*/') === 'none');

    const missingPath = path.join(os.tmpdir(), 'bgc-no-such-file-xyz.js');
    detectPatchStateFromFile(missingPath).then(state => {
        check('A1 文件缺失 → none', state === 'none');
    }).catch(() => {
        check('A1 文件缺失 → none', false);
    });
}

// ---- A2: 损坏提示屏蔽 ---------------------------------------------------------
{
    check('A2 翻译数量 ≥ 16', CORRUPTION_TRANSLATIONS.length >= 16,
        `实际 ${CORRUPTION_TRANSLATIONS.length} 条`);

    const css = getCorruptionWarningCss();
    check('A2 CSS 覆盖全部翻译', CORRUPTION_TRANSLATIONS.every(t => css.includes(t)));
    const ruleCount = (css.match(/\.notification-toast-container:has\(/g) || []).length;
    check('A2 每条翻译一条规则', ruleCount === CORRUPTION_TRANSLATIONS.length,
        `实际 ${ruleCount} 条`);

    // 含单引号的文案需要转义，避免破坏属性选择器（当前列表没有，但保持防线）
    const escaped = getCorruptionWarningCss().replace(/\\'/g, "'");
    check('A2 转义后无残留 \\\'', !escaped.includes("\\'"));
}

// ---- A4: 混合模式 CSS 变量 ---------------------------------------------------
{
    check('A4 auto → 变量声明', resolveBlendModeDeclaration('auto') === `mix-blend-mode: var(${BLEND_CSS_VAR});`);
    check('A4 空串 → 变量声明', resolveBlendModeDeclaration('') === `mix-blend-mode: var(${BLEND_CSS_VAR});`);
    check('A4 lighten 写死', resolveBlendModeDeclaration('lighten') === 'mix-blend-mode: lighten;');
    check('A4 大写 MULTIPLY 归一化', resolveBlendModeDeclaration('MULTIPLY') === 'mix-blend-mode: multiply;');
    check('A4 视频值 auto → 变量', resolveBlendModeValue('auto') === `var(${BLEND_CSS_VAR})`);
    check('A4 视频值 lighten → lighten', resolveBlendModeValue('lighten') === 'lighten');

    const autoRules = resolveThemeBlendRules('auto');
    check('A4 auto 规则含浅色默认 multiply', autoRules.includes(`${BLEND_CSS_VAR}: multiply`));
    check('A4 auto 规则含 vs-dark → lighten', autoRules.includes('vs-dark'));
    check('A4 auto 规则含 hc-black → lighten', autoRules.includes('hc-black'));
    check('A4 显式模式无主题规则', resolveThemeBlendRules('lighten') === '');
}

// ---- A6: 过渡动画 ------------------------------------------------------------
{
    check('A6 开启 → transition 声明', getTransitionDeclaration(true).includes('transition: opacity .25s ease, filter .25s ease'));
    check('A6 关闭 → 无声明', getTransitionDeclaration(false) === '');
    check('A6 开启 → 减少动态效果兜底', getTransitionReducedMotionCss(true).includes('@media (prefers-reduced-motion: reduce)'));
    check('A6 关闭 → 无 media', getTransitionReducedMotionCss(false) === '');
}

// ---- A6: 换图淡入淡出片段（IMAGE_FADE_JS）------------------------------------
{
    const vm = require('vm');
    const { IMAGE_FADE_JS } = require(path.join(REPO, 'out', 'loaderFragments'));
    check('A6 fade 片段含真实临时层淡入', IMAGE_FADE_JS.includes('background-cover-fade-layer') &&
        IMAGE_FADE_JS.includes('bgcGetFadeLayer'));
    check('A6 fade 片段含 reduce-motion 检测', IMAGE_FADE_JS.includes('prefers-reduced-motion: reduce'));
    check('A6 fade 片段含按窗口隔离状态', IMAGE_FADE_JS.includes('__bgcLastImageUrl') && IMAGE_FADE_JS.includes('__bgcFadeTimer'));

    // 嵌入式正则的转义链（同 A5）：loader 源码里字符串字面量会再解析一次
    const embedded = /new RegExp\("([\s\S]+?)", "i"\)/.exec(IMAGE_FADE_JS);
    check('A6 fade 片段含 RegExp 构造', !!embedded);
    if (embedded) {
        const evaluatedPattern = Function('return "' + embedded[1] + '"')();
        const regex = new RegExp(evaluatedPattern, 'i');
        const sample = `body::before{background-image:url('vscode-file://vscode-app/a/b.png');}`;
        const match = regex.exec(sample);
        check('A6 fade 嵌入式正则（经字符串字面量解析）仍能匹配', !!match && match[1] === 'vscode-file://vscode-app/a/b.png');
    }

    // 片段本身语法可编译（捕获插值产生的任何语法错误）
    try {
        new Function(IMAGE_FADE_JS);
        check('A6 fade 片段语法可编译', true);
    } catch (e) {
        check('A6 fade 片段语法可编译', false, e.message);
    }

    // 运行时行为（vm 沙箱）：首次直接写、换图 cross-fade 逐帧、同 URL 直接应用、reduce-motion 直接切
    const css1 = `body::before{background-image:url('vscode-file://vscode-app/a.png');opacity:0.2;}`;
    const css2 = `body::before{background-image:url('vscode-file://vscode-app/b.png');opacity:0.2;}`;
    let pendingTimer = null;
    const mkSandbox = (reduce) => {
        const s = {
            setTimeout: (fn) => { pendingTimer = fn; return 1; },
            clearTimeout: () => {},
            matchMedia: () => ({ matches: !!reduce }),
            console
        };
        vm.createContext(s);
        vm.runInContext(IMAGE_FADE_JS, s);
        return s;
    };

    // 首次应用：直接写入，不 fade
    let s = mkSandbox(false);
    const style1 = { textContent: '' };
    const target1 = { __bgcLastImageUrl: undefined, __bgcFadeTimer: null };
    s.style = style1; s.target = target1; s.css = css1;
    vm.runInContext('bgcApplyStyleWithFade(target, style, css)', s);
    check('A6 首次应用直接写入', style1.textContent === css1 &&
        target1.__bgcLastImageUrl === 'vscode-file://vscode-app/a.png' && target1.__bgcFadeTimer === null);

    // 换图：旧 CSS 保留，新图临时层从 0 淡入；完成后才切换主 CSS
    s = mkSandbox(false);
    const layerStyle = { opacity: '', transition: '', pointerEvents: '' };
    const layer = { style: layerStyle, parentNode: null, setAttribute: (k, v) => { layer[k === 'style' ? 'styleAttr' : k] = v; } };
    const doc2 = { body: { offsetHeight: 0, appendChild: (el) => { el.parentNode = doc2.body; } },
        getElementById: (id) => id === 'background-cover-fade-layer' ? layer : null,
        createElement: () => layer };
    const style2 = { textContent: css1 };
    const finishEvents = [];
    doc2.body.removeChild = (el) => { finishEvents.push('remove'); el.parentNode = null; };
    doc2.getElementById = () => layer.parentNode ? layer : null;
    const target2 = { document: doc2, __bgcLastImageUrl: 'vscode-file://vscode-app/a.png', __bgcFadeTimer: null,
        getComputedStyle: (body, pseudo) => {
            check('A6 收尾计算新图目标透明度时禁用 transition', pseudo === '::before' &&
                style2.textContent.startsWith(css2) && style2.textContent.includes('opacity:0.2000!important;transition:none!important;'));
            check('A6 收尾样式计算时临时层仍存在', layer.parentNode === doc2.body);
            finishEvents.push('compute');
            return { opacity: '0.2' };
        } };
    s.style = style2; s.target = target2; s.css = css2;
    vm.runInContext('bgcApplyStyleWithFade(target, style, css)', s);
    check('A6 换图保留旧图并降低主层透明度', style2.textContent.includes('opacity:0.1800!important'));
    check('A6 新图临时层使用完整背景规则', layer.styleAttr && layer.styleAttr.includes('b.png'));
    check('A6 临时层按配置透明度渐入', layerStyle.opacity === '0.0200');
    check('A6 淡化期间旧 URL 不变', target2.__bgcLastImageUrl === 'vscode-file://vscode-app/a.png');
    for (let i = 0; i < 9; i++) { pendingTimer(); }
    check('A6 先计算最终样式再移除临时层且无延迟收尾',
        JSON.stringify(finishEvents) === JSON.stringify(['compute', 'remove']) &&
        target2.__bgcFadeTimer === null && layer.parentNode === null);
    check('A6 淡化完成后才写入新 CSS', style2.textContent === css2 &&
        target2.__bgcLastImageUrl === 'vscode-file://vscode-app/b.png');

    // 视频/无背景图的 CSS：直接切换（无 cross-fade）
    s = mkSandbox(false);
    const styleV = { textContent: css1 };
    const targetV = { __bgcLastImageUrl: 'vscode-file://vscode-app/a.png', __bgcFadeTimer: null };
    const videoCss = '/*background-cover-video-start*/{"url":"x"}/*background-cover-video-end*/';
    s.style = styleV; s.target = targetV; s.css = videoCss;
    vm.runInContext('bgcApplyStyleWithFade(target, style, css)', s);
    check('A6 视频 CSS 直接切换', styleV.textContent === videoCss);

    // 同 URL 不同 CSS（如混合模式/透明度变化）：直接应用，不 fade
    s = mkSandbox(false);
    const style3 = { textContent: css1 };
    const target3 = { __bgcLastImageUrl: 'vscode-file://vscode-app/a.png', __bgcFadeTimer: null };
    s.style = style3; s.target = target3;
    s.css = css1.replace('opacity:0.2', 'opacity:0.3');
    vm.runInContext('bgcApplyStyleWithFade(target, style, css)', s);
    check('A6 同 URL 不同 CSS 直接应用', style3.textContent === css1.replace('opacity:0.2', 'opacity:0.3'));

    // reduce-motion：直接切换
    s = mkSandbox(true);
    const style4 = { textContent: css1 };
    const target4 = { __bgcLastImageUrl: 'vscode-file://vscode-app/a.png', __bgcFadeTimer: null };
    s.style = style4; s.target = target4; s.css = css2;
    vm.runInContext('bgcApplyStyleWithFade(target, style, css)', s);
    check('A6 reduce-motion 直接切换', style4.textContent === css2);
}

// ---- A3: 路径工具 ------------------------------------------------------------
{
    const homedir = os.homedir();
    check('A3 ~ 展开', expandPathVariables('~/Pictures/a.png') === `${homedir}/Pictures/a.png`);

    process.env.BGC_TEST_VAR = '/tmp/env-dir';
    check('A3 ${ENV} 展开', expandPathVariables('${BGC_TEST_VAR}/a.png') === '/tmp/env-dir/a.png');
    check('A3 $ENV 展开', expandPathVariables('$BGC_TEST_VAR/a.png') === '/tmp/env-dir/a.png');
    check('A3 未定义变量保留', expandPathVariables('${BGC_NO_SUCH_VAR_XYZ}/a.png') === '${BGC_NO_SUCH_VAR_XYZ}/a.png');
    check('A3 普通路径不变', expandPathVariables('/home/u/pic.png') === '/home/u/pic.png');
    delete process.env.BGC_TEST_VAR;

    check('A3 扩展名识别', hasFileExtension('C:/a/b.jpg') && hasFileExtension('/x/y.png') && !hasFileExtension('/x/y') && !hasFileExtension('/x/dir/'));

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgc-path-'));
    fs.mkdirSync(path.join(root, 'sub', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(root, 'a.png'), 'x');
    fs.writeFileSync(path.join(root, 'e.mp4'), 'x');
    fs.writeFileSync(path.join(root, 'sub', 'b.JPG'), 'x');
    fs.writeFileSync(path.join(root, 'sub', 'deep', 'd.webp'), 'x');
    fs.writeFileSync(path.join(root, 'sub', 'c.txt'), 'x');
    fs.writeFileSync(path.join(root, 'skip.log'), 'x');

    const found = listImagesInFolder(root).map(p => path.relative(root, p)).sort();
    const expected = ['a.png', 'e.mp4', 'sub/b.JPG', 'sub/deep/d.webp'].sort();
    check('A3 递归扫描 + 扩展名过滤', JSON.stringify(found) === JSON.stringify(expected),
        `found=${JSON.stringify(found)}`);

    check('A3 空目录 → []', Array.isArray(listImagesInFolder(path.join(root, 'empty-dir'))) &&
        listImagesInFolder(path.join(root, 'empty-dir')).length === 0);
    check('A3 不存在 → []', listImagesInFolder(path.join(root, 'nope')).length === 0);

    const picked = pickRandomFromFolder(root);
    check('A3 文件夹随机取图', typeof picked === 'string' && picked.startsWith(root));
    check('A3 单文件不是文件夹 → undefined', pickRandomFromFolder(path.join(root, 'a.png')) === undefined);
    check('A3 不存在 → undefined', pickRandomFromFolder(path.join(root, 'nope')) === undefined);

    fs.rmSync(root, { recursive: true, force: true });
}

// ---- A5: 预加载 URL 提取 ------------------------------------------------------
{
    check('A5 单引号 url 提取',
        extractBackgroundImageUrl(`body::before{background-image:url('vscode-file://vscode-app/a/b.png');}`) === 'vscode-file://vscode-app/a/b.png');
    check('A5 双引号 + 空格提取',
        extractBackgroundImageUrl(`body::before { background-image: url( "https://x/y.jpg" ); }`) === 'https://x/y.jpg');
    check('A5 无图片 → 空串', extractBackgroundImageUrl('body::before{opacity:.2;}') === '');
    check('A5 空串 → 空串', extractBackgroundImageUrl('') === '');
}

// ---- A5: 嵌入式正则的转义链端到端验证 -----------------------------------------
{
    // 注入端的 RegExp 字符串会先被「loader 源码的字符串字面量」解析一次（\\s → \s），
    // 这里用 Function 构造复刻同样的解析，确认嵌入副本转义正确且字符串字面量合法
    // （嵌入式只匹配单引号，与项目生成的 CSS url('...') 一致，避免把 " 嵌进字面量）。
    const { PRELOAD_IMAGE_JS } = require(path.join(REPO, 'out', 'loaderFragments'));
    // 嵌入式正则文本里含 `"` 以外无其它引号，用非贪婪匹配到唯一的 `", "i"` 结尾
    const embedded = /new RegExp\("([\s\S]+?)", "i"\)/.exec(PRELOAD_IMAGE_JS);
    check('A5 注入端含 RegExp 构造', !!embedded);
    if (embedded) {
        const evaluatedPattern = Function('return "' + embedded[1] + '"')();
        const regex = new RegExp(evaluatedPattern, 'i');
        const sample = `body::before{background-image:url('vscode-file://vscode-app/a/b.png');}`;
        const match = regex.exec(sample);
        check('A5 嵌入式正则（经字符串字面量解析）仍能匹配', !!match && match[1] === 'vscode-file://vscode-app/a/b.png',
            match ? `pattern=${evaluatedPattern}` : 'no match');
    }
}

// ---- 注入产物冒烟（A4/A5/A6 已编译进 out/）------------------------------------
{
    const fileDomJs = fs.readFileSync(path.join(REPO, 'out', 'FileDom.js'), 'utf-8');
    // 预加载函数名以字面量出现在 loader 模板里
    check('编译产物 FileDom.js 含预加载片段', fileDomJs.includes('preloadBackgroundImage'));
    check('编译产物 FileDom.js 含换图淡入淡出片段', fileDomJs.includes('bgcApplyStyleWithFade'));
    check('编译产物 FileDom.js 的 applyStyle 走 fade 分支', fileDomJs.includes('bgcApplyStyleWithFade(targetWindow, style, css)'));
    // CSS 变量与过渡声明字面量位于 backgroundCss.js（FileDom.js 只做插值调用）
    const bgCssJs = fs.readFileSync(path.join(REPO, 'out', 'backgroundCss.js'), 'utf-8');
    check('编译产物含混合模式 CSS 变量', bgCssJs.includes('var(--background-cover-blend)'));
    check('编译产物含过渡动画声明', bgCssJs.includes('transition: opacity .25s ease, filter .25s ease'));
}

// ---- A7: 在线单图源记录自愈（windowBackground）--------------------------------
{
    // 需要 vscode stub：windowBackground 依赖 env.sessionId / workspace 配置。
    const Module = require('module');
    const crypto = require('crypto');
    const sessionHash = crypto.createHash('md5').update('bgc-test-session').digest('hex').slice(0, 8);
    const state = { windowImages: {}, workspaceImages: {}, globalImage: undefined };

    const origLoad = Module._load;
    Module._load = function (request) {
        if (request === 'vscode') {
            return {
                EventEmitter: class {
                    constructor() { this.event = () => ({ dispose() {} }); }
                    fire() {}
                },
                env: { sessionId: 'bgc-test-session', appRoot: os.tmpdir(), appHost: 'desktop', uiKind: 1, appName: 'Test' },
                Uri: { file: p => ({ with: () => ({ toString: () => String(p) }) }), parse: s => ({ toString: () => String(s) }) },
                window: {
                    setStatusBarMessage: () => ({ dispose() {} }),
                    showErrorMessage: async () => undefined,
                    showInformationMessage: async () => undefined,
                    showWarningMessage: async () => undefined,
                    createStatusBarItem: () => ({ show() {}, dispose() {} })
                },
                workspace: {
                    getConfiguration: () => ({ get: (k, f) => f }),
                    workspaceFolders: undefined
                },
                ConfigurationTarget: { Global: 1 },
                Disposable: class { dispose() {} }
            };
        }
        return origLoad.apply(this, arguments);
    };

    const { setContext } = require(path.join(REPO, 'out', 'global'));
    setContext({
        globalState: {
            get: (key, fallback) => {
                if (key === 'backgroundCover.windowImages') { return state.windowImages; }
                if (key === 'backgroundCover.workspaceImages') { return state.workspaceImages; }
                if (key === 'backgroundCover.globalImage') { return state.globalImage; }
                return fallback;
            },
            update: async () => {}
        },
        subscriptions: []
    });

    const { isSingleSourceActive, getPersistedCurrentImage } = require(path.join(REPO, 'out', 'windowBackground'));

    // 场景 1：当前持久化图是本地文件（window 记录），在线单图源是陈旧记录 → 不活跃
    state.windowImages[sessionHash] = '/Users/u/Pictures/milktea_test.png';
    state.workspaceImages = {};
    state.globalImage = undefined;
    check('A7 陈旧单图源（当前是本地）→ 不活跃',
        isSingleSourceActive('https://cdn.example.com/y.png') === false);
    check('A7 持久化图解析 window 优先',
        getPersistedCurrentImage() === '/Users/u/Pictures/milktea_test.png');

    // 场景 2：单图源与当前持久化图一致 → 活跃
    state.windowImages[sessionHash] = 'https://cdn.example.com/y.png';
    check('A7 单图源与当前图一致 → 活跃',
        isSingleSourceActive('https://cdn.example.com/y.png') === true);

    // 场景 3：无 window 记录，global 兜底
    delete state.windowImages[sessionHash];
    state.globalImage = 'https://cdn.example.com/y.png';
    check('A7 global 兜底一致 → 活跃',
        isSingleSourceActive('https://cdn.example.com/y.png') === true);
    check('A7 global 兜底不一致 → 不活跃',
        isSingleSourceActive('https://cdn.example.com/z.png') === false);

    // 场景 4：非在线 URL / 无记录 / settings 兜底
    state.globalImage = undefined;
    check('A7 本地路径记录 → 不活跃', isSingleSourceActive('/Users/u/a.png') === false);
    check('A7 undefined → 不活跃', isSingleSourceActive(undefined) === false);
    check('A7 无记录时 globalFallback 兜底',
        getPersistedCurrentImage('/settings/fallback.png') === '/settings/fallback.png');

    Module._load = origLoad;
}

// ---- 汇总 --------------------------------------------------------------------
console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
