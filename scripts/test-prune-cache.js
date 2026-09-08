/**
 * 在线图片缓存清理逻辑（pruneOnlineCache）的独立回归测试。
 *
 * 直接驱动编译产物 out/onlineCache.js，把 'vscode' 与扩展上下文打桩，因此不需要
 * 启动 VS Code、也不需要 mocha：
 *
 *     npm run test:prune
 *
 * 覆盖：默认值三处一致性、未超限 no-op、清到低水位、保留最新、.tmp 新鲜保留/过期清理、
 * 子目录不递归、历史遗留规模单次收敛、复用缓存的 mtime 刷新不被误删、并发复用同一次执行。
 */
'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO = path.resolve(__dirname, '..');

let failures = 0;
function check(label, cond, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
    if (!cond) { failures++; }
}

// ---- 打桩：vscode 模块 + 扩展上下文 -----------------------------------------
class EventEmitter {
    constructor() { this.event = () => ({ dispose() {} }); }
    fire() {}
    dispose() {}
}
const origLoad = Module._load;
Module._load = function (request) {
    if (request === 'vscode') {
        return {
            EventEmitter,
            commands: { executeCommand() {} },
            // FileDom 在模块加载期就会用 env.appRoot 拼工作台路径
            env: { sessionId: 'test-session', appRoot: path.join(os.tmpdir(), 'bgc-fake-vscode') },
            Uri: { file: p => ({ with: () => ({ toString: () => String(p) }) }) },
            window: {},
            workspace: { getConfiguration: () => ({ get: (key, fallback) => fallback }) },
            UIKind: { Desktop: 1, Web: 2 },
            ConfigurationTarget: { Global: 1 },
            Disposable: class {}
        };
    }
    return origLoad.apply(this, arguments);
};

const { setContext } = require(path.join(REPO, 'out', 'global'));
const { pruneOnlineCache, getOnlineCacheLimit, DEFAULT_ONLINE_CACHE_LIMIT,
    findCachedOnlineImage, getOnlineCacheHash } =
    require(path.join(REPO, 'out', 'onlineCache'));

// ---- 测试夹具 ---------------------------------------------------------------
const tempRoots = [];
let cacheDir;

/** 新建一个干净的缓存目录并指向它。 */
function freshCacheDir() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgc-prune-test-'));
    tempRoots.push(root);
    cacheDir = path.join(root, 'images');
    fs.mkdirSync(cacheDir, { recursive: true });
    setContext({ globalStorageUri: { fsPath: root }, subscriptions: [] });
}

function writeFile(name, mtimeMs) {
    const full = path.join(cacheDir, name);
    fs.writeFileSync(full, 'x');
    if (mtimeMs) {
        const t = new Date(mtimeMs);
        fs.utimesSync(full, t, t);
    }
    return full;
}

const readDir = () => fs.readdirSync(cacheDir);
const imageFiles = () => readDir().filter(n => !n.endsWith('.tmp') && fs.statSync(path.join(cacheDir, n)).isFile());
const tmpFiles = () => readDir().filter(n => n.endsWith('.tmp'));

const HOUR = 60 * 60 * 1000;

// ---- 用例 -------------------------------------------------------------------
async function testDefaultsMatchEverywhere() {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const setting = manifest.contributes.configuration.properties['backgroundCover.cacheLimit'];
    const hostSource = fs.readFileSync(path.join(REPO, 'src', 'onlineCache.ts'), 'utf8');
    const webviewSource = fs.readFileSync(path.join(REPO, 'webview', 'src', 'constants.ts'), 'utf8');
    const advancedTab = fs.readFileSync(path.join(REPO, 'webview', 'src', 'views', 'AdvancedTab.vue'), 'utf8');

    const hostDefault = Number(/export const DEFAULT_ONLINE_CACHE_LIMIT = (\d+)/.exec(hostSource)?.[1]);
    const webviewDefault = Number(/export const DEFAULT_CACHE_LIMIT = (\d+)/.exec(webviewSource)?.[1]);

    check('package.json 默认值与 host 常量一致',
        setting.default === hostDefault && hostDefault === DEFAULT_ONLINE_CACHE_LIMIT,
        `package.json=${setting.default} host=${hostDefault}`);
    check('webview 常量与 host 常量一致',
        webviewDefault === hostDefault, `webview=${webviewDefault} host=${hostDefault}`);
    check('package.json min/max 与 webview 输入框一致',
        advancedTab.includes(`:min="${setting.minimum}"`) && advancedTab.includes(`:max="${setting.maximum}"`),
        `min=${setting.minimum} max=${setting.maximum}`);
    check('读取不到配置时回退到默认上限', getOnlineCacheLimit() === DEFAULT_ONLINE_CACHE_LIMIT,
        `实际 ${getOnlineCacheLimit()}`);
}

async function testMissingDirIsSafe() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgc-prune-missing-'));
    tempRoots.push(root);
    setContext({ globalStorageUri: { fsPath: path.join(root, 'not-created') }, subscriptions: [] });
    await pruneOnlineCache(10);
    check('缓存目录不存在时不抛异常', true);
}

async function testUnderLimitIsNoop() {
    freshCacheDir();
    const base = Date.now() - 10 * HOUR;
    for (let i = 0; i < 50; i++) { writeFile(`f${i}.jpg`, base + i * 1000); }
    writeFile('fresh.tmp', Date.now() - 1000);   // 新鲜临时文件：不删

    await pruneOnlineCache(200);
    check('未超限时不删除任何文件', imageFiles().length === 50 && tmpFiles().length === 1,
        `images=${imageFiles().length} tmp=${tmpFiles().length}`);
}

async function testPrunesToLowWatermark() {
    freshCacheDir();
    const base = Date.now() - 100 * HOUR;
    for (let i = 0; i < 250; i++) { writeFile(`f${String(i).padStart(3, '0')}.jpg`, base + i * 1000); }

    await pruneOnlineCache(100);   // 低水位 80
    const left = imageFiles();
    check('limit=100 时清到低水位 80', left.length === 80, `实际 ${left.length}`);
    check('保留最新的 f249', left.includes('f249.jpg'));
    check('删除最旧的 f000', !left.includes('f000.jpg'));
    check('分界点正确：保留 f170、删除 f169', left.includes('f170.jpg') && !left.includes('f169.jpg'));
}

async function testTmpHandling() {
    freshCacheDir();
    writeFile('stale.tmp', Date.now() - 3 * HOUR);      // 孤儿临时文件：清理
    writeFile('fresh.tmp', Date.now() - 5 * 1000);      // 正在下载：保留

    await pruneOnlineCache(200);   // 文件数远未超限，只有 .tmp 触发扫描
    check('超过 1 小时的孤儿 .tmp 被清理', !readDir().includes('stale.tmp'));
    check('新鲜 .tmp 保留（不打断进行中的下载）', readDir().includes('fresh.tmp'));
}

async function testSubdirectoryUntouched() {
    freshCacheDir();
    fs.mkdirSync(path.join(cacheDir, 'sub'));
    fs.writeFileSync(path.join(cacheDir, 'sub', 'nested.jpg'), 'x');
    const base = Date.now() - 100 * HOUR;
    for (let i = 0; i < 300; i++) { writeFile(`f${i}.jpg`, base + i * 1000); }

    await pruneOnlineCache(100);
    check('不递归删除子目录', fs.existsSync(path.join(cacheDir, 'sub', 'nested.jpg')));
}

async function testLegacyBacklogConverges() {
    freshCacheDir();
    const base = Date.now() - 100 * HOUR;
    for (let i = 0; i < 5000; i++) { writeFile(`g${i}.jpg`, base + i * 1000); }

    await pruneOnlineCache(200);   // 低水位 160
    check('历史遗留 5000 个文件单次收敛到 160', imageFiles().length === 160, `实际 ${imageFiles().length}`);
}

async function testRecentlyUsedSurvives() {
    freshCacheDir();
    const base = Date.now() - 100 * HOUR;
    const reused = writeFile('reused.jpg', base);           // 最旧
    for (let i = 0; i < 300; i++) { writeFile(`f${i}.jpg`, base + (i + 1) * 1000); }
    const now = new Date();
    fs.utimesSync(reused, now, now);                        // 模拟 FileDom 复用缓存时刷新 mtime

    await pruneOnlineCache(200);
    check('刷新过 mtime（最近使用）的旧文件不被误删', fs.existsSync(reused));
}

async function testConcurrentCallsAreDeduped() {
    freshCacheDir();
    const base = Date.now() - 100 * HOUR;
    for (let i = 0; i < 5000; i++) { writeFile(`h${i}.jpg`, base + i * 1000); }

    const first = pruneOnlineCache(200);
    const second = pruneOnlineCache(50);
    check('并发调用返回同一个执行', first === second);

    await Promise.all([first, second]);
    // 第一次按 200 清到 160，随后补跑按最新的 50 清到 40
    check('清理期间的更严格上限会被补跑（收敛到 50 的低水位 40）',
        imageFiles().length === 40, `实际 ${imageFiles().length}`);
}

/**
 * 动态源改成 `<urlHash>-<内容哈希><ext>` 命名后，findCachedOnlineImage 的 URL→文件
 * 查找必须继续工作（下载失败兜底、Studio 预览都依赖它），且要同时兼容老的时间戳命名。
 */
async function testContentHashNamingIsLookupCompatible() {
    freshCacheDir();
    const url = 'https://example.com/api/random';
    const urlHash = getOnlineCacheHash(url);
    const base = Date.now() - 10 * HOUR;

    const legacy = writeFile(`${urlHash}-1700000000000.jpg`, base);                 // 老命名
    const contentAddressed = writeFile(`${urlHash}-${'a'.repeat(64)}.jpg`, base + 1000);
    const other = writeFile(`${getOnlineCacheHash('https://example.com/other')}-${'b'.repeat(64)}.jpg`, base + 2000);

    check('内容哈希命名能被 URL→文件查找命中',
        findCachedOnlineImage(url) === contentAddressed, `实际 ${path.basename(findCachedOnlineImage(url) || '')}`);
    check('老的时间戳命名仍然命中',
        findCachedOnlineImage(url, [path.basename(legacy)]) === legacy);

    const now = new Date();
    fs.utimesSync(legacy, now, now);   // 老文件变成"最近使用"
    check('同一 URL 的多个副本取 mtime 最新的一个',
        findCachedOnlineImage(url) === legacy, `实际 ${path.basename(findCachedOnlineImage(url) || '')}`);

    check('不会误命中其它 URL 的缓存文件',
        findCachedOnlineImage('https://example.com/other') === other);
}

/**
 * 内容寻址命名依赖 FileDom.hashFile 的流式 sha256。直接调编译产物上的真实方法
 * （private 只是 TS 语法，运行时仍在原型上），不重新实现一份。
 */
async function testContentHashPrimitive() {
    const crypto = require('crypto');
    const { FileDom } = require(path.join(REPO, 'out', 'FileDom'));
    const hashFile = file => FileDom.prototype.hashFile.call({}, file);
    const probe = path.join(os.tmpdir(), `bgc-hash-probe-${process.pid}.bin`);

    try {
        fs.writeFileSync(probe, 'hello background cover');
        check('hashFile 产出 sha256',
            await hashFile(probe) === crypto.createHash('sha256').update('hello background cover').digest('hex'));

        const big = crypto.randomBytes(3 * 1024 * 1024);   // 跨多个数据块，验证流式更新
        fs.writeFileSync(probe, big);
        check('hashFile 流式处理大文件结果正确',
            await hashFile(probe) === crypto.createHash('sha256').update(big).digest('hex'));

        check('hashFile 读取失败返回 undefined（回退时间戳命名）',
            await hashFile(probe + '.missing') === undefined);
    } finally {
        fs.rmSync(probe, { force: true });
    }
}

async function main() {
    await testDefaultsMatchEverywhere();
    await testMissingDirIsSafe();
    await testUnderLimitIsNoop();
    await testPrunesToLowWatermark();
    await testTmpHandling();
    await testSubdirectoryUntouched();
    await testLegacyBacklogConverges();
    await testRecentlyUsedSurvives();
    await testConcurrentCallsAreDeduped();
    await testContentHashNamingIsLookupCompatible();
    await testContentHashPrimitive();
}

main()
    .then(() => {
        console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
        process.exitCode = failures === 0 ? 0 : 1;
    })
    .catch(error => {
        console.error('\n测试执行出错:', error);
        process.exitCode = 1;
    })
    .finally(() => {
        for (const root of tempRoots) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
