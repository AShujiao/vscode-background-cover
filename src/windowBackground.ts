import * as crypto from 'crypto';
import * as path from 'path';
import { ConfigurationTarget, env, workspace, WorkspaceConfiguration } from 'vscode';
import { getContext, onDidChangeGlobalState } from './global';
import { isOnlineUrl } from './pathUtil';

const WINDOW_IMAGES_KEY = 'backgroundCover.windowImages';
const WORKSPACE_IMAGES_KEY = 'backgroundCover.workspaceImages';
// 全局兜底图。以前这个角色由 settings.json 的 backgroundCover.imagePath 承担，
// 但那份值只在首次为空时写入、之后永久冻结，settings.json 会长期停留在用户第一次
// 选的那张图上。改用独立的 globalState key 后，settings.json 只作为老用户的迁移
// 兜底读取，扩展不再回写它。
const GLOBAL_IMAGE_KEY = 'backgroundCover.globalImage';

// 透明度/模糊度与背景图走同一套「窗口(session) → 工作区 → 全局兜底 → settings」的
// 解析链，让不同工作区的窗口在 webview 里各自显示自己的数值：窗口/工作区记录永远
// 优先，所以某个窗口调数值不会把已有记录的其他窗口刷成同一个数。
//
// 最后一层兜底不能依赖 settings.json：独立模式下扩展从不写它（见 #252），而没有
// 打开文件夹的窗口既没有工作区 key，session key 又在每次启动/重载后失效，于是这类
// 窗口重启后只能回到 schema 默认值。这里改用 globalState 里最后一次生效的值（与
// GLOBAL_IMAGE_KEY 同思路），让无文件夹窗口也能跨会话恢复；其余窗口仍命中各自的
// 窗口/工作区记录，互不影响。
const WINDOW_OPACITY_KEY = 'backgroundCover.windowOpacity';
const WORKSPACE_OPACITY_KEY = 'backgroundCover.workspaceOpacity';
const WINDOW_BLUR_KEY = 'backgroundCover.windowBlur';
const WORKSPACE_BLUR_KEY = 'backgroundCover.workspaceBlur';
const GLOBAL_OPACITY_KEY = 'backgroundCover.globalOpacity';
const GLOBAL_BLUR_KEY = 'backgroundCover.globalBlur';

// window 记录以 session 为键，而 session 每次启动/重载都会变，这张表只增不减。
// 保留最近若干条(按插入顺序淘汰)，当前窗口的记录永不淘汰。
const MAX_WINDOW_RECORDS = 40;

// 非持久化更新(定时自动换图)只改内存：既避免每个间隔都写两个 globalState key
// 并连带刷新 TreeView/Studio，也避免把"换图失败的地址"落盘。session 结束即失效，
// 这本身就是 persist=false 期望的语义。
let volatileImagePath: string | undefined;

// 共用模式下扩展自己回写 settings.json 的透明度/模糊度会触发 onDidChangeConfiguration。
// 记下刚写入的值，让配置监听跳过这次"自己触发自己"的事件，避免同一个改动被应用两遍。
const selfWrittenLevels: { opacity?: number; blur?: number } = {};

// 记录写入是"读-改-写"的异步操作：快速连续的外部改动可能并发读同一份旧 map，
// 后发起的慢写会把先发起的写入覆盖掉（lost update）。用一条 promise 队列串行化。
let levelWriteQueue: Promise<void> = Promise.resolve();

function enqueueLevelWrite(task: () => Promise<void>): Promise<void> {
    const run = levelWriteQueue.then(task, task);
    levelWriteQueue = run.catch(() => undefined);
    return run;
}

function rememberSelfWrittenLevel(key: 'opacity' | 'blur', value: number): void {
    selfWrittenLevels[key] = value;
}

function forgetSelfWrittenLevel(key: 'opacity' | 'blur', value: number): void {
    if (selfWrittenLevels[key] === value) {
        delete selfWrittenLevels[key];
    }
}

/**
 * 判断这次 settings.json 中透明度/模糊度的变化是否由扩展自己回写引起，并消费标记。
 * 扩展自己写入时该值已经应用过，监听端不应再重复应用一遍。
 * 无论是否命中都清掉标记：避免旧标记把后续用户的真实修改误判为"自己写的"而跳过。
 */
export function consumeSelfWrittenLevel(key: 'opacity' | 'blur', value: number | undefined): boolean {
    const marker = selfWrittenLevels[key];
    delete selfWrittenLevels[key];
    return marker !== undefined && value !== undefined && marker === value;
}

/**
 * 关掉后回到旧版行为：所有窗口共用一张背景图、共用一份 CSS 文件。
 * 每次读取而不缓存，配置改动后无需重启窗口即可生效。
 */
export function isPerWindowEnabled(): boolean {
    try {
        return workspace.getConfiguration('backgroundCover').get<boolean>('perWindowBackground', true);
    } catch {
        return true;
    }
}

function shortHash(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
}

function hasOwn(target: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(target, key);
}

export function getSessionHash(): string {
    return shortHash(env.sessionId || 'default-session');
}

export function getWorkspaceKey(): string | undefined {
    const folder = workspace.workspaceFolders && workspace.workspaceFolders[0];
    if (!folder) {
        return undefined;
    }
    const normalized = path.normalize(folder.uri.fsPath).replace(/\\+/g, '/').replace(/\/+$/, '').toLowerCase();
    return shortHash(normalized);
}

export function getWindowCssFileName(): string {
    return `css-background-cover.${getSessionHash()}.css`;
}

function readImageMap(key: string): Record<string, string> {
    return { ...(getContext().globalState.get<Record<string, string>>(key, {}) || {}) };
}

function readGlobalImage(): string | undefined {
    const value = getContext().globalState.get<string>(GLOBAL_IMAGE_KEY);
    return typeof value === 'string' ? value : undefined;
}

export function hasCurrentImageRecord(): boolean {
    if (volatileImagePath !== undefined) {
        return true;
    }
    // 共用模式下窗口/工作区级记录一律忽略，只认全局值。
    if (isPerWindowEnabled()) {
        const windowMap = readImageMap(WINDOW_IMAGES_KEY);
        if (hasOwn(windowMap, getSessionHash())) {
            return true;
        }
        const workspaceKey = getWorkspaceKey();
        if (workspaceKey) {
            const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
            if (hasOwn(workspaceMap, workspaceKey)) {
                return true;
            }
        }
    }
    // 记录过空字符串也算"记录过"——用户显式关掉了背景，不该再被全局兜底复活。
    return readGlobalImage() !== undefined;
}

/**
 * 当前"持久化"的背景图：window → workspace → global → settings 兜底。
 * 与 resolveCurrentImagePath 的区别是刻意忽略 volatile 内存态（定时自动换图
 * 只写内存的临时图），供判断"在线单图源记录是否仍是当前背景"这类场景使用。
 */
export function getPersistedCurrentImage(globalFallback?: string): string {
    if (isPerWindowEnabled()) {
        const windowMap = readImageMap(WINDOW_IMAGES_KEY);
        const sessionHash = getSessionHash();
        if (hasOwn(windowMap, sessionHash)) {
            return windowMap[sessionHash] || '';
        }
        const workspaceKey = getWorkspaceKey();
        if (workspaceKey) {
            const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
            if (hasOwn(workspaceMap, workspaceKey)) {
                return workspaceMap[workspaceKey] || '';
            }
        }
    }
    const globalImage = readGlobalImage();
    if (globalImage !== undefined) {
        return globalImage;
    }
    // 老用户迁移路径：globalState 里还没有记录时，读 settings.json 的旧值。
    return globalFallback || '';
}

export function resolveCurrentImagePath(globalFallback?: string): string {
    if (volatileImagePath !== undefined) {
        return volatileImagePath;
    }
    return getPersistedCurrentImage(globalFallback);
}

/**
 * 在线单图源记录（backgroundCoverSingleImageSource）是否仍有效：
 * 记录本身必须是在线 URL，且与当前持久化的背景图一致（用户确实还在用这张
 * 在线单图）。一旦用户已经换成本地图/文件夹，这条记录就是陈旧的 —— 自动
 * 换图时它会把本地 randomImageFolder 短路成"每轮重下同一张在线图"，图片
 * 永远不会变，因此陈旧记录必须被识别并清理。
 */
export function isSingleSourceActive(singleSource: string | undefined): boolean {
    if (!singleSource || !isOnlineUrl(singleSource)) {
        return false;
    }
    const settingsFallback = workspace.getConfiguration('backgroundCover').get<string>('imagePath') || '';
    return getPersistedCurrentImage(settingsFallback) === singleSource;
}

export interface SetImageOptions {
    /** false 表示只更新当前窗口的内存态(定时自动换图)，不写入 globalState。 */
    persist?: boolean;
}

/**
 * 把某个按窗口/工作区维度存储的值写入 globalState：当前窗口(session)记录 +
 * 当前工作区记录 + 一份"最后一次生效值"的全局兜底。
 * 共用模式(perWindowBackground=false)下不写任何记录，由调用方走 settings.json
 * 保持旧版全局共享行为。
 * @param globalKey 全局兜底 key。背景图与透明度/模糊度都需要它：没有打开文件夹的
 * 窗口既没有工作区 key，session key 又会随重启失效，只能靠这一层恢复上次的值。
 * @param options.seedGlobal 是否同时更新全局兜底。默认 true；采纳工作区级
 * (.vscode/settings.json) 的透明度/模糊度时传 false —— 那个值只属于该工作区，
 * 不该漏给没有文件夹的窗口。
 */
function persistLevelValue(
    windowKey: string,
    workspaceKey: string,
    globalKey: string | undefined,
    value: string | number,
    options: { seedGlobal?: boolean } = {}
): Promise<void> {
    // 串行执行读-改-写，避免并发写丢失更新（快速连续的外部 settings 改动会并发进入这里）。
    return enqueueLevelWrite(() => doPersistLevelValue(windowKey, workspaceKey, globalKey, value, options));
}

async function doPersistLevelValue(
    windowKey: string,
    workspaceKey: string,
    globalKey: string | undefined,
    value: string | number,
    options: { seedGlobal?: boolean } = {}
): Promise<void> {
    const context = getContext();
    if (isPerWindowEnabled()) {
        const sessionHash = getSessionHash();
        const windowMap = { ...(context.globalState.get<Record<string, string | number>>(windowKey, {}) || {}) };
        delete windowMap[sessionHash];
        windowMap[sessionHash] = value;
        await context.globalState.update(windowKey, pruneRecords(windowMap, sessionHash));

        const workspaceHash = getWorkspaceKey();
        if (workspaceHash) {
            const workspaceMap = { ...(context.globalState.get<Record<string, string | number>>(workspaceKey, {}) || {}) };
            // 先删再写，把当前工作区挪到末尾：pruneRecords 按插入顺序淘汰最久未写入的记录。
            delete workspaceMap[workspaceHash];
            workspaceMap[workspaceHash] = value;
            await context.globalState.update(workspaceKey, pruneRecords(workspaceMap, workspaceHash));
        }
    }
    if (globalKey !== undefined && options.seedGlobal !== false) {
        // 值没变时跳过写入：拖动滑块会连续写同一个数值的情况很多，没必要每次都落盘。
        if (context.globalState.get(globalKey) !== value) {
            await context.globalState.update(globalKey, value);
        }
    }
    onDidChangeGlobalState.fire();
}

export async function setCurrentImagePath(imagePath: string, options: SetImageOptions = {}): Promise<void> {
    const value = imagePath || '';
    if (options.persist === false) {
        volatileImagePath = value;
        onDidChangeGlobalState.fire();
        return;
    }

    // 有显式持久化写入时，内存态的临时图就失去意义了。
    volatileImagePath = undefined;

    await persistLevelValue(WINDOW_IMAGES_KEY, WORKSPACE_IMAGES_KEY, GLOBAL_IMAGE_KEY, value);
}

/**
 * 解析当前窗口实际生效的透明度/模糊度：窗口记录 → 工作区记录 → 全局兜底 →
 * settings.json 兜底。共用模式下直接返回配置值（各窗口共享一份全局配置，旧版行为），
 * 不读这些记录，避免残留值盖住用户刚在设置里改的全局值。
 */
function resolveLevelValue<T extends string | number>(
    windowKey: string,
    workspaceKey: string,
    globalKey: string,
    settingsFallback: T
): T {
    if (isPerWindowEnabled()) {
        const windowMap = { ...(getContext().globalState.get<Record<string, T>>(windowKey, {}) || {}) };
        const sessionHash = getSessionHash();
        if (hasOwn(windowMap, sessionHash)) {
            return windowMap[sessionHash];
        }
        const workspaceHash = getWorkspaceKey();
        if (workspaceHash) {
            const workspaceMap = { ...(getContext().globalState.get<Record<string, T>>(workspaceKey, {}) || {}) };
            if (hasOwn(workspaceMap, workspaceHash)) {
                return workspaceMap[workspaceHash];
            }
            // 有工作区身份时不再读全局兜底：没单独设置过的工作区仍回到 settings 默认值，
            // 保持 3.6.1 起"各工作区互不串值"的语义。
            return settingsFallback;
        }
        // 没有工作区身份（空窗口 / 单文件窗口 / 无 folder 的 .code-workspace）：
        // session 记录随重启失效，只能靠"最后一次生效值"恢复（#252）。
        const globalValue = getContext().globalState.get<T>(globalKey);
        if (globalValue !== undefined && globalValue !== null) {
            return globalValue;
        }
    }
    return settingsFallback;
}

export function resolveCurrentOpacity(settingsFallback: number): number {
    return resolveLevelValue<number>(WINDOW_OPACITY_KEY, WORKSPACE_OPACITY_KEY, GLOBAL_OPACITY_KEY, settingsFallback);
}

export function resolveCurrentBlur(settingsFallback: number): number {
    return resolveLevelValue<number>(WINDOW_BLUR_KEY, WORKSPACE_BLUR_KEY, GLOBAL_BLUR_KEY, settingsFallback);
}

/** 写入透明度/模糊度时的行为选项。 */
export interface SetLevelOptions {
    /** false 表示不更新"最后一次生效值"的全局兜底（工作区级配置不应漏给无 folder 窗口）。 */
    seedGlobal?: boolean;
}

/**
 * 写入当前窗口的透明度。共用模式下回写 settings.json（全局共享），
 * 独立模式下写 globalState 的窗口/工作区记录 + 全局兜底，不再触碰 settings.json。
 * 全局兜底让没有打开文件夹的窗口重启后也能恢复上次的值（#252）。
 */
export async function setCurrentOpacity(
    value: number,
    cfg: WorkspaceConfiguration,
    options: SetLevelOptions = {}
): Promise<void> {
    if (Number.isNaN(value)) { return; }
    if (!isPerWindowEnabled()) {
        rememberSelfWrittenLevel('opacity', value);
        try {
            await cfg.update('opacity', value, ConfigurationTarget.Global);
        } catch (error) {
            forgetSelfWrittenLevel('opacity', value);
            throw error;
        }
        // 同步全局兜底：之后切回独立模式时，新窗口应沿用刚在共用模式里设置的值。
        if (options.seedGlobal !== false) {
            await getContext().globalState.update(GLOBAL_OPACITY_KEY, value);
        }
        return;
    }
    await persistLevelValue(WINDOW_OPACITY_KEY, WORKSPACE_OPACITY_KEY, GLOBAL_OPACITY_KEY, value, options);
}

/** 写入当前窗口的模糊度，语义同 setCurrentOpacity。 */
export async function setCurrentBlur(
    value: number,
    cfg: WorkspaceConfiguration,
    options: SetLevelOptions = {}
): Promise<void> {
    if (Number.isNaN(value)) { return; }
    if (!isPerWindowEnabled()) {
        rememberSelfWrittenLevel('blur', value);
        try {
            await cfg.update('blur', value, ConfigurationTarget.Global);
        } catch (error) {
            forgetSelfWrittenLevel('blur', value);
            throw error;
        }
        if (options.seedGlobal !== false) {
            await getContext().globalState.update(GLOBAL_BLUR_KEY, value);
        }
        return;
    }
    await persistLevelValue(WINDOW_BLUR_KEY, WORKSPACE_BLUR_KEY, GLOBAL_BLUR_KEY, value, options);
}

/**
 * 配置里的这个值是否来自工作区级设置(.vscode/settings.json 或多根工作区的文件夹设置)。
 * 工作区级的值只属于该工作区，不能写成"无 folder 窗口"的全局兜底。
 */
function isWorkspaceScopedSettings(cfg: WorkspaceConfiguration, key: 'opacity' | 'blur'): boolean {
    try {
        const inspected = cfg.inspect<number>(key);
        if (!inspected) { return false; }
        return inspected.workspaceValue !== undefined || inspected.workspaceFolderValue !== undefined;
    } catch {
        return false;
    }
}

/** 配置监听对透明度/模糊度变化的处理结果。 */
export type LevelAdoptResult = 'adopted' | 'shared' | 'skipped';

/**
 * 把 settings.json 里的透明度/模糊度采纳为"当前窗口的值"。
 *
 * 独立模式下窗口/工作区记录优先于 settings，所以用户直接改设置界面或 settings.json
 * 时，如果不把新值写成当前窗口的记录，改动就会被旧记录遮蔽、看起来完全没生效
 * （#252 的附带问题）。共用模式下配置本身就是生效值，交给调用方直接重新应用。
 *
 * 注意：用户级(全局)设置变化会被每个已打开窗口收到并分别采纳，即"手改用户级设置 =
 * 覆盖所有窗口各自保存的值"；工作区级设置不会被写成全局兜底，避免串到无 folder 窗口。
 *
 * @param key 只采纳实际发生变化的那个键，避免顺手把另一个键的窗口自定义值刷掉。
 */
export async function adoptSettingsLevelValue(
    cfg: WorkspaceConfiguration,
    key: 'opacity' | 'blur'
): Promise<LevelAdoptResult> {
    if (!isPerWindowEnabled()) {
        return 'shared';
    }
    const value = cfg.get<number>(key);
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'skipped';
    }
    const options: SetLevelOptions = { seedGlobal: !isWorkspaceScopedSettings(cfg, key) };
    if (key === 'opacity') {
        await setCurrentOpacity(value, cfg, options);
    } else {
        await setCurrentBlur(value, cfg, options);
    }
    return 'adopted';
}

function pruneRecords(map: Record<string, string | number>, keepKey: string): Record<string, string | number> {
    const keys = Object.keys(map);
    if (keys.length <= MAX_WINDOW_RECORDS) {
        return map;
    }
    const pruned = { ...map };
    let toRemove = keys.length - MAX_WINDOW_RECORDS;
    for (const key of keys) {
        if (toRemove <= 0) {
            break;
        }
        if (key === keepKey) {
            continue;
        }
        delete pruned[key];
        toRemove--;
    }
    return pruned;
}
