import * as crypto from 'crypto';
import * as path from 'path';
import { ConfigurationTarget, env, workspace, WorkspaceConfiguration } from 'vscode';
import { getContext, onDidChangeGlobalState } from './global';

const WINDOW_IMAGES_KEY = 'backgroundCover.windowImages';
const WORKSPACE_IMAGES_KEY = 'backgroundCover.workspaceImages';
// 全局兜底图。以前这个角色由 settings.json 的 backgroundCover.imagePath 承担，
// 但那份值只在首次为空时写入、之后永久冻结，settings.json 会长期停留在用户第一次
// 选的那张图上。改用独立的 globalState key 后，settings.json 只作为老用户的迁移
// 兜底读取，扩展不再回写它。
const GLOBAL_IMAGE_KEY = 'backgroundCover.globalImage';

// 透明度/模糊度与背景图走同一套「窗口(session) → 工作区 → 兜底」的解析链，
// 让不同工作区的窗口在 webview 里各自显示自己的数值。区别只在最后一层：
// 背景图有 globalState 里的"最后一张全局兜底"，透明度/模糊度则直接落到
// settings.json 的配置值——用户在某窗口调透明度不应该把其他窗口的显示值也
// 刷成同一个数（而且那些窗口的实际渲染用的仍是它们各自记录的旧值，数值跟着
// 全局配置走反而会造成"显示值与实际效果不一致"的困惑）。
const WINDOW_OPACITY_KEY = 'backgroundCover.windowOpacity';
const WORKSPACE_OPACITY_KEY = 'backgroundCover.workspaceOpacity';
const WINDOW_BLUR_KEY = 'backgroundCover.windowBlur';
const WORKSPACE_BLUR_KEY = 'backgroundCover.workspaceBlur';

// window 记录以 session 为键，而 session 每次启动/重载都会变，这张表只增不减。
// 保留最近若干条(按插入顺序淘汰)，当前窗口的记录永不淘汰。
const MAX_WINDOW_RECORDS = 40;

// 非持久化更新(定时自动换图)只改内存：既避免每个间隔都写两个 globalState key
// 并连带刷新 TreeView/Studio，也避免把"换图失败的地址"落盘。session 结束即失效，
// 这本身就是 persist=false 期望的语义。
let volatileImagePath: string | undefined;

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

export function resolveCurrentImagePath(globalFallback?: string): string {
    if (volatileImagePath !== undefined) {
        return volatileImagePath;
    }
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

export interface SetImageOptions {
    /** false 表示只更新当前窗口的内存态(定时自动换图)，不写入 globalState。 */
    persist?: boolean;
}

/**
 * 把某个按窗口/工作区维度存储的值写入 globalState：当前窗口(session)记录 +
 * 当前工作区记录。共用模式(perWindowBackground=false)下不写任何记录，
 * 由调用方走 settings.json 保持旧版全局共享行为。
 * @param globalKey 背景图需要额外维护一份"最后一张全局兜底"，透明度/模糊度不需要。
 */
async function persistLevelValue(
    windowKey: string,
    workspaceKey: string,
    globalKey: string | undefined,
    value: string | number
): Promise<void> {
    const context = getContext();
    if (isPerWindowEnabled()) {
        const sessionHash = getSessionHash();
        const windowMap = { ...(context.globalState.get<Record<string, string | number>>(windowKey, {}) || {}) };
        windowMap[sessionHash] = value;
        await context.globalState.update(windowKey, pruneRecords(windowMap, sessionHash));

        const workspaceHash = getWorkspaceKey();
        if (workspaceHash) {
            const workspaceMap = { ...(context.globalState.get<Record<string, string | number>>(workspaceKey, {}) || {}) };
            workspaceMap[workspaceHash] = value;
            await context.globalState.update(workspaceKey, workspaceMap);
        }
    }
    if (globalKey !== undefined) {
        await context.globalState.update(globalKey, value);
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
 * 解析当前窗口实际生效的透明度/模糊度：窗口记录 → 工作区记录 → settings.json 兜底。
 * 共用模式下直接返回配置值（各窗口共享一份全局配置，旧版行为）。
 */
function resolveLevelValue<T extends string | number>(
    windowKey: string,
    workspaceKey: string,
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
        }
    }
    return settingsFallback;
}

export function resolveCurrentOpacity(settingsFallback: number): number {
    return resolveLevelValue<number>(WINDOW_OPACITY_KEY, WORKSPACE_OPACITY_KEY, settingsFallback);
}

export function resolveCurrentBlur(settingsFallback: number): number {
    return resolveLevelValue<number>(WINDOW_BLUR_KEY, WORKSPACE_BLUR_KEY, settingsFallback);
}

/**
 * 写入当前窗口的透明度。共用模式下回写 settings.json（全局共享），
 * 独立模式下只写 globalState 的窗口/工作区记录，不再触碰 settings.json。
 */
export async function setCurrentOpacity(value: number, cfg: WorkspaceConfiguration): Promise<void> {
    if (Number.isNaN(value)) { return; }
    if (!isPerWindowEnabled()) {
        await cfg.update('opacity', value, ConfigurationTarget.Global);
        return;
    }
    await persistLevelValue(WINDOW_OPACITY_KEY, WORKSPACE_OPACITY_KEY, undefined, value);
}

/** 写入当前窗口的模糊度，语义同 setCurrentOpacity。 */
export async function setCurrentBlur(value: number, cfg: WorkspaceConfiguration): Promise<void> {
    if (Number.isNaN(value)) { return; }
    if (!isPerWindowEnabled()) {
        await cfg.update('blur', value, ConfigurationTarget.Global);
        return;
    }
    await persistLevelValue(WINDOW_BLUR_KEY, WORKSPACE_BLUR_KEY, undefined, value);
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
